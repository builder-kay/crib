import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { verifyPaystackSignature, verifyPaystackTransaction } from "../_shared/paystack.ts";

type PaystackWebhookPayload = {
  event?: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
  };
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
  buyerEmail: string | null;
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
      source: "paystack-webhook",
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

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  const signatureValid = await verifyPaystackSignature(signature, paystackSecretKey, rawBody);

  if (!signatureValid) {
    return jsonResponse({ error: "Invalid signature" }, 401);
  }

  let payload: PaystackWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PaystackWebhookPayload;
  } catch {
    return jsonResponse({ error: "Invalid webhook payload" }, 400);
  }

  const reference = payload.data?.reference?.trim();
  if (!reference) {
    return jsonResponse({ ok: true, ignored: "No reference supplied" }, 200);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, order_id, status")
    .eq("reference", reference)
    .maybeSingle();

  if (paymentError) {
    return jsonResponse({ error: "Unable to load payment", details: paymentError.message }, 500);
  }

  if (!payment) {
    return jsonResponse({ ok: true, ignored: "Unknown payment reference" }, 200);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, amount_kobo, currency, status, paid_at, asset_id, buyer_id, email, commission_kobo, seller_net_amount_kobo, escrow_status, escrow_due_at, assets!inner(creator_id)")
    .eq("id", payment.order_id)
    .single();

  if (orderError || !order) {
    return jsonResponse({ error: "Unable to load order for payment", details: orderError?.message }, 500);
  }

  const creatorId = (order.assets as { creator_id: string }).creator_id;
  const failureEvents = new Set(["charge.failed", "paymentrequest.failed", "invoice.payment_failed"]);

  if (payload.event === "charge.success") {
    if (payment.status === "paid" && order.status === "paid") {
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
        escrow_status: order.escrow_status ?? "released",
        escrow_due_at: order.escrow_due_at,
        seller_net_amount_kobo: order.seller_net_amount_kobo,
        commission_kobo: order.commission_kobo
      }, 200);
    }

    let verifyResponse;
    try {
      verifyResponse = await verifyPaystackTransaction(paystackSecretKey, reference);
    } catch (error) {
      await supabase.from("payments").update({ status: "failed", raw: { webhook: payload, error: "verify_failed" } }).eq("id", payment.id);
      await supabase.from("orders").update({ status: "failed" }).eq("id", order.id).neq("status", "paid");
      return jsonResponse({ error: "Could not verify Paystack transaction", details: error instanceof Error ? error.message : "Unknown" }, 502);
    }

    const verified = verifyResponse.status && verifyResponse.data?.status === "success";
    if (!verified || !verifyResponse.data) {
      await supabase.from("payments").update({ status: "failed", raw: { webhook: payload, verify: verifyResponse } }).eq("id", payment.id);
      await supabase.from("orders").update({ status: "failed" }).eq("id", order.id).neq("status", "paid");
      return jsonResponse({ ok: true, processed: "failed_verification" }, 200);
    }

    const verifiedAmount = Number(verifyResponse.data.amount ?? 0);
    const verifiedCurrency = (verifyResponse.data.currency ?? "").toUpperCase();
    const orderCurrency = String(order.currency ?? "").toUpperCase();
    if (!Number.isFinite(verifiedAmount) || verifiedAmount < order.amount_kobo || (verifiedCurrency && verifiedCurrency !== orderCurrency)) {
      await supabase.from("payments").update({ status: "failed", raw: { webhook: payload, verify: verifyResponse, reason: "amount_mismatch" } }).eq("id", payment.id);
      await supabase.from("orders").update({ status: "failed" }).eq("id", order.id).neq("status", "paid");
      return jsonResponse({ ok: true, processed: "amount_mismatch" }, 200);
    }

    const { error: paymentUpdateError } = await supabase
      .from("payments")
      .update({
        status: "paid",
        raw: {
          webhook: payload,
          verify: verifyResponse
        }
      })
      .eq("id", payment.id);

    if (paymentUpdateError) {
      return jsonResponse({ error: "Failed to update payment", details: paymentUpdateError.message }, 500);
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
      return jsonResponse({ error: "Failed to update order", details: orderUpdateError.message }, 500);
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
      escrow_status: "awaiting_review",
      escrow_due_at: escrowDueAt,
      seller_net_amount_kobo: sellerNetAmount,
      commission_kobo: commission
    }, 200);
  }

  if (failureEvents.has(payload.event ?? "")) {
    await supabase
      .from("payments")
      .update({
        status: "failed",
        raw: {
          webhook: payload
        }
      })
      .eq("id", payment.id)
      .neq("status", "paid");

    await supabase.from("orders").update({ status: "failed" }).eq("id", order.id).neq("status", "paid");

    return jsonResponse({ ok: true, processed: "failed" }, 200);
  }

  return jsonResponse({ ok: true, ignored: payload.event ?? "unknown_event" }, 200);
});