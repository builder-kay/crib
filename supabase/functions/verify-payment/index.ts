import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { ensureOrderDeliverySnapshot } from "../_shared/asset-delivery.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { verifyPaystackTransaction } from "../_shared/paystack.ts";
import { ensureOrderReceipt } from "../_shared/receipts.ts";

type VerifyPaymentPayload = {
  reference?: string;
};

function parseCommissionBps(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1000", 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 1000;
  }
  return Math.min(parsed, 10_000);
}

function getEscrowAmounts(amountKobo: number, commissionBps: number) {
  const commission = Math.floor((amountKobo * commissionBps) / 10_000);
  return {
    commission,
    sellerNetAmount: Math.max(amountKobo - commission, 0)
  };
}

async function trackPurchaseEvent(input: {
  supabase: ReturnType<typeof createClient>;
  orderId: string;
  assetId: string;
  creatorId: string;
  buyerId: string | null;
  buyerEmail: string;
  reference: string;
}) {
  const { error } = await input.supabase.from("analytics_events").insert({
    event_name: "purchase",
    order_id: input.orderId,
    asset_id: input.assetId,
    creator_id: input.creatorId,
    actor_user_id: input.buyerId,
    actor_email: input.buyerEmail,
    metadata: {
      source: "verify-payment",
      reference: input.reference
    }
  });

  if (error && error.code !== "23505") {
    console.error("purchase analytics insert failed", error.message);
  }
}

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) {
    return corsResponse;
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  const commissionBps = parseCommissionBps(Deno.env.get("COMMISSION_BPS"));

  if (!supabaseUrl || !serviceRoleKey || !paystackSecretKey) {
    return jsonResponse({ error: "Missing required environment variables" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let body: VerifyPaymentPayload;
  try {
    body = (await request.json()) as VerifyPaymentPayload;
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const reference = typeof body.reference === "string" ? body.reference.trim() : "";
  if (!reference) {
    return jsonResponse({ error: "reference is required" }, 400);
  }

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (!accessToken) {
    return jsonResponse({ error: "Authentication required" }, 401);
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return jsonResponse({ error: "Invalid authentication token" }, 401);
  }

  const requesterId = authData.user.id;
  const requesterEmail = authData.user.email ?? null;

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, order_id, status")
    .eq("reference", reference)
    .maybeSingle();

  if (paymentError) {
    return jsonResponse({ error: "Unable to load payment", details: paymentError.message }, 500);
  }

  if (!payment) {
    return jsonResponse({ error: "Payment reference not found" }, 404);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, asset_id, amount_kobo, currency, status, paid_at, buyer_id, email, commission_kobo, seller_net_amount_kobo, escrow_status, escrow_due_at, assets!inner(creator_id)")
    .eq("id", payment.order_id)
    .single();

  if (orderError || !order) {
    return jsonResponse({ error: "Unable to load linked order", details: orderError?.message }, 500);
  }

  const creatorId = (order.assets as { creator_id: string }).creator_id;

  const authorizedByAuth =
    order.buyer_id === requesterId || creatorId === requesterId || (requesterEmail !== null && order.email === requesterEmail);

  if (!authorizedByAuth) {
    return jsonResponse({ error: "You are not authorized to verify this payment" }, 403);
  }

  if (payment.status === "paid" && order.status === "paid") {
    try {
      await ensureOrderReceipt(supabase, order.id);
    } catch (error) {
      return jsonResponse({ error: "Unable to issue order receipt", details: error instanceof Error ? error.message : "Unknown error" }, 500);
    }

    await trackPurchaseEvent({
      supabase,
      orderId: order.id,
      assetId: order.asset_id,
      creatorId,
      buyerId: order.buyer_id,
      buyerEmail: order.email,
      reference
    });

    return jsonResponse({
      ok: true,
      idempotent: true,
      order_status: "paid",
      payment_status: "paid",
      escrow_status: order.escrow_status ?? "released",
      escrow_due_at: order.escrow_due_at,
      seller_net_amount_kobo: order.seller_net_amount_kobo,
      commission_kobo: order.commission_kobo
    });
  }

  let verifyResponse;
  try {
    verifyResponse = await verifyPaystackTransaction(paystackSecretKey, reference);
  } catch (error) {
    return jsonResponse({ error: "Paystack verification failed", details: error instanceof Error ? error.message : "Unknown" }, 502);
  }

  if (!verifyResponse.status || !verifyResponse.data) {
    return jsonResponse({
      ok: true,
      order_status: order.status,
      payment_status: payment.status,
      escrow_status: order.escrow_status ?? null,
      escrow_due_at: order.escrow_due_at,
      verification: "unavailable"
    });
  }

  const transactionStatus = verifyResponse.data.status;

  if (transactionStatus === "success") {
    const verifiedAmount = Number(verifyResponse.data.amount ?? 0);
    const verifiedCurrency = (verifyResponse.data.currency ?? "").toUpperCase();
    const orderCurrency = String(order.currency ?? "").toUpperCase();

    if (!Number.isFinite(verifiedAmount) || verifiedAmount < order.amount_kobo || (verifiedCurrency && verifiedCurrency !== orderCurrency)) {
      await supabase
        .from("payments")
        .update({ status: "failed", raw: { verify: verifyResponse, reason: "amount_or_currency_mismatch", source: "verify-payment" } })
        .eq("id", payment.id)
        .neq("status", "paid");

      await supabase.from("orders").update({ status: "failed" }).eq("id", order.id).neq("status", "paid");

      return jsonResponse({
        ok: true,
        order_status: "failed",
        payment_status: "failed",
        reason: "amount_or_currency_mismatch"
      });
    }

    try {
      await ensureOrderDeliverySnapshot(supabase, order.id);
    } catch (error) {
      return jsonResponse(
        {
          error: "Unable to lock the purchased delivery file",
          details: error instanceof Error ? error.message : "Unknown error"
        },
        500
      );
    }

    const { error: paymentUpdateError } = await supabase
      .from("payments")
      .update({ status: "paid", raw: { verify: verifyResponse, source: "verify-payment" } })
      .eq("id", payment.id);

    if (paymentUpdateError) {
      return jsonResponse({ error: "Unable to update payment", details: paymentUpdateError.message }, 500);
    }

    const paidAt = order.paid_at ?? new Date().toISOString();
    const escrowDueAt = order.escrow_due_at ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { commission, sellerNetAmount } = getEscrowAmounts(order.amount_kobo, commissionBps);

    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        status: "paid",
        paid_at: paidAt,
        commission_kobo: commission,
        seller_net_amount_kobo: sellerNetAmount,
        escrow_status: "awaiting_review",
        escrow_due_at: escrowDueAt
      })
      .eq("id", order.id);

    if (orderUpdateError) {
      return jsonResponse({ error: "Unable to update order", details: orderUpdateError.message }, 500);
    }

    try {
      await ensureOrderReceipt(supabase, order.id);
    } catch (error) {
      return jsonResponse({ error: "Unable to issue order receipt", details: error instanceof Error ? error.message : "Unknown error" }, 500);
    }

    await trackPurchaseEvent({
      supabase,
      orderId: order.id,
      assetId: order.asset_id,
      creatorId,
      buyerId: order.buyer_id,
      buyerEmail: order.email,
      reference
    });

    return jsonResponse({
      ok: true,
      order_status: "paid",
      payment_status: "paid",
      escrow_status: "awaiting_review",
      escrow_due_at: escrowDueAt,
      seller_net_amount_kobo: sellerNetAmount,
      commission_kobo: commission
    });
  }

  const failedStatuses = new Set(["failed", "abandoned", "reversed"]);
  if (failedStatuses.has(transactionStatus)) {
    await supabase
      .from("payments")
      .update({ status: "failed", raw: { verify: verifyResponse, source: "verify-payment" } })
      .eq("id", payment.id)
      .neq("status", "paid");

    await supabase.from("orders").update({ status: "failed" }).eq("id", order.id).neq("status", "paid");

    return jsonResponse({ ok: true, order_status: "failed", payment_status: "failed" });
  }

  await supabase
    .from("payments")
    .update({ raw: { verify: verifyResponse, source: "verify-payment" } })
    .eq("id", payment.id);

  return jsonResponse({
    ok: true,
    order_status: order.status,
    payment_status: payment.status,
    escrow_status: order.escrow_status ?? null,
    escrow_due_at: order.escrow_due_at,
    verification: transactionStatus
  });
});
