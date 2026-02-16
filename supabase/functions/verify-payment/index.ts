import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { verifyPaystackTransaction } from "../_shared/paystack.ts";

type VerifyPaymentPayload = {
  reference?: string;
  email_token?: string;
};

function parseCommissionBps(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1000", 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 1000;
  }
  return parsed;
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
  const emailToken = typeof body.email_token === "string" ? body.email_token.trim() : "";

  if (!reference) {
    return jsonResponse({ error: "reference is required" }, 400);
  }

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  let requesterId: string | null = null;
  let requesterEmail: string | null = null;

  if (accessToken) {
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (!authError && authData.user) {
      requesterId = authData.user.id;
      requesterEmail = authData.user.email ?? null;
    }
  }

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
    .select("id, asset_id, amount_kobo, currency, status, buyer_id, email, email_token, assets!inner(creator_id)")
    .eq("id", payment.order_id)
    .single();

  if (orderError || !order) {
    return jsonResponse({ error: "Unable to load linked order", details: orderError?.message }, 500);
  }

  const creatorId = (order.assets as { creator_id: string }).creator_id;

  const authorizedByAuth =
    Boolean(requesterId) &&
    (order.buyer_id === requesterId || creatorId === requesterId || (requesterEmail !== null && order.email === requesterEmail));

  const authorizedByToken = emailToken !== "" && emailToken === order.email_token;

  if (!authorizedByAuth && !authorizedByToken) {
    return jsonResponse({ error: "You are not authorized to verify this payment" }, 403);
  }

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
      order_status: "paid",
      payment_status: "paid"
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

    const { error: paymentUpdateError } = await supabase
      .from("payments")
      .update({ status: "paid", raw: { verify: verifyResponse, source: "verify-payment" } })
      .eq("id", payment.id);

    if (paymentUpdateError) {
      return jsonResponse({ error: "Unable to update payment", details: paymentUpdateError.message }, 500);
    }

    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", order.id);

    if (orderUpdateError) {
      return jsonResponse({ error: "Unable to update order", details: orderUpdateError.message }, 500);
    }

    const commission = Math.floor((order.amount_kobo * commissionBps) / 10_000);
    const netPayout = Math.max(order.amount_kobo - commission, 0);

    let credited = false;
    if (netPayout > 0) {
      const { data: creditResult, error: creditError } = await supabase.rpc("credit_wallet", {
        p_creator_id: creatorId,
        p_order_id: order.id,
        p_amount_kobo: netPayout
      });

      if (creditError) {
        return jsonResponse({ error: "Unable to credit creator wallet", details: creditError.message }, 500);
      }

      credited = Boolean(creditResult);
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
      credited,
      net_payout: netPayout,
      commission
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
    verification: transactionStatus
  });
});
