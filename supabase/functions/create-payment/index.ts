import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { ensureOrderDeliverySnapshot } from "../_shared/asset-delivery.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { initializePaystackTransaction } from "../_shared/paystack.ts";
import { ensureOrderReceipt } from "../_shared/receipts.ts";

type CreatePaymentPayload = {
  asset_id?: string;
  email?: string;
  amount_kobo?: number;
};

type DeliveryMode = "file" | "external_link";
type PricingModel = "free" | "paid" | "pay_what_you_want";

type AssetRow = {
  id: string;
  title: string;
  creator_id: string;
  price_kobo: number;
  minimum_price_kobo: number | null;
  currency: string;
  status: string;
  delivery_mode: DeliveryMode | null;
  external_delivery_url: string | null;
  pricing_model: PricingModel | null;
};

function parseCommissionBps(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1000", 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 1000;
  }
  return Math.min(parsed, 10_000);
}

function parseEmail(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const value = input.trim().toLowerCase();
  if (!value) {
    return null;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(value) ? value : null;
}

function parseUserContactEmail(user: { email?: string | null; user_metadata?: Record<string, unknown> | null }): string | null {
  return parseEmail(user.email) ?? parseEmail(user.user_metadata?.contact_email);
}

function parseAmountKobo(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) {
    return Math.max(Math.round(input), 0);
  }

  if (typeof input === "string" && input.trim()) {
    const parsed = Number.parseInt(input.trim(), 10);
    if (!Number.isNaN(parsed)) {
      return Math.max(parsed, 0);
    }
  }

  return null;
}

function normalizeUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function hasUnsupportedBuyerDomain(email: string): boolean {
  const [, domain = ""] = email.split("@");
  const normalizedDomain = domain.trim().toLowerCase();
  if (!normalizedDomain) {
    return true;
  }

  return normalizedDomain === "localhost" || normalizedDomain.endsWith(".local");
}

function normalizeDeliveryMode(asset: AssetRow): DeliveryMode {
  if (asset.delivery_mode === "external_link" || normalizeUrl(asset.external_delivery_url)) {
    return "external_link";
  }

  return "file";
}

function normalizePricingModel(asset: AssetRow): PricingModel {
  if (asset.pricing_model) {
    return asset.pricing_model;
  }

  return asset.price_kobo > 0 ? "paid" : "free";
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
      source: "create-payment",
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
  const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:5173";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing required environment variables" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let body: CreatePaymentPayload;
  try {
    body = (await request.json()) as CreatePaymentPayload;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const assetId = typeof body.asset_id === "string" ? body.asset_id.trim() : "";
  if (!assetId) {
    return jsonResponse({ error: "asset_id is required" }, 400);
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

  const buyerId = authData.user.id;
  const buyerEmail = parseUserContactEmail(authData.user) ?? parseEmail(body.email) ?? null;

  if (!buyerEmail) {
    return jsonResponse({ error: "A valid buyer email is required" }, 400);
  }

  if (hasUnsupportedBuyerDomain(buyerEmail)) {
    return jsonResponse(
      {
        error: "Use a real email domain for checkout (example: yourname@gmail.com)",
        code: "invalid_buyer_email"
      },
      400
    );
  }

  const { data: assetRows, error: assetError } = await supabase
    .from("assets")
    .select("id, title, creator_id, price_kobo, minimum_price_kobo, currency, status, delivery_mode, external_delivery_url, pricing_model")
    .eq("id", assetId)
    .limit(1);

  if (assetError) {
    return jsonResponse({ error: "Unable to load asset", details: assetError.message }, 500);
  }

  const asset = ((assetRows ?? [])[0] ?? null) as AssetRow | null;
  if (!asset) {
    return jsonResponse({ error: "Asset not found" }, 404);
  }

  if (asset.status !== "published") {
    return jsonResponse(
      {
        error: `Asset is not available for purchase (status: ${asset.status})`,
        code: "asset_not_published"
      },
      403
    );
  }

  const { data: creatorProfile, error: creatorProfileError } = await supabase
    .from("profiles")
    .select("seller_account_status")
    .eq("id", asset.creator_id)
    .maybeSingle();

  if (creatorProfileError) {
    return jsonResponse({ error: "Unable to check seller account status", details: creatorProfileError.message }, 500);
  }

  if (creatorProfile?.seller_account_status === "suspended") {
    return jsonResponse(
      {
        error: "This seller account is currently unavailable while a marketplace review is in progress.",
        code: "seller_suspended"
      },
      403
    );
  }

  if (asset.creator_id === buyerId) {
    return jsonResponse({ error: "You cannot purchase your own asset", code: "own_asset" }, 403);
  }

  const { data: creatorAuthData, error: creatorAuthError } = await supabase.auth.admin.getUserById(asset.creator_id);
  if (!creatorAuthError) {
    const creatorEmail = parseEmail(creatorAuthData.user?.email);
    if (creatorEmail && creatorEmail === buyerEmail) {
      return jsonResponse({ error: "You cannot purchase your own asset", code: "own_asset" }, 403);
    }
  }

  const deliveryMode = normalizeDeliveryMode(asset);
  const externalDeliveryUrl = deliveryMode === "external_link" ? normalizeUrl(asset.external_delivery_url) : null;
  if (deliveryMode === "external_link" && !externalDeliveryUrl) {
    return jsonResponse(
        {
        error: "This listing is missing its delivery link. Ask the creator to update it.",
        code: "invalid_delivery_config"
      },
      422
    );
  }

  const pricingModel = normalizePricingModel(asset);
  const minimumPriceKobo = Math.max(asset.minimum_price_kobo ?? asset.price_kobo, 0);
  const requestedAmountKobo = parseAmountKobo(body.amount_kobo);

  let checkoutAmountKobo = 0;
  if (pricingModel === "free") {
    checkoutAmountKobo = 0;
  } else if (pricingModel === "paid") {
    checkoutAmountKobo = Math.max(asset.price_kobo, minimumPriceKobo, 0);
    if (checkoutAmountKobo <= 0) {
      return jsonResponse(
        {
          error: "This listing has an invalid fixed price. Ask the creator to update it.",
          code: "invalid_price_config"
        },
        422
      );
    }
  } else {
    const suggestedAmountKobo = Math.max(asset.price_kobo, minimumPriceKobo, 0);
    checkoutAmountKobo = requestedAmountKobo ?? suggestedAmountKobo;
    if (checkoutAmountKobo < minimumPriceKobo) {
      return jsonResponse(
        {
          error: "Amount is below the minimum for this listing.",
          code: "invalid_amount"
        },
        400
      );
    }
  }

  let existingPaidOrder: { id: string } | null = null;
  if (buyerId) {
    const [{ data: buyerOrders, error: buyerOrdersError }, { data: emailOrders, error: emailOrdersError }] = await Promise.all([
      supabase.from("orders").select("id").eq("asset_id", asset.id).eq("status", "paid").eq("buyer_id", buyerId).limit(1),
      supabase.from("orders").select("id").eq("asset_id", asset.id).eq("status", "paid").eq("email", buyerEmail).limit(1)
    ]);

    if (buyerOrdersError || emailOrdersError) {
      return jsonResponse(
        {
          error: "Unable to check existing purchases",
          details: buyerOrdersError?.message ?? emailOrdersError?.message
        },
        500
      );
    }

    existingPaidOrder = (buyerOrders?.[0] ?? emailOrders?.[0] ?? null) as { id: string } | null;
  } else {
    const { data: emailOrders, error: emailOrdersError } = await supabase
      .from("orders")
      .select("id")
      .eq("asset_id", asset.id)
      .eq("status", "paid")
      .eq("email", buyerEmail)
      .limit(1);

    if (emailOrdersError) {
      return jsonResponse({ error: "Unable to check existing purchases", details: emailOrdersError.message }, 500);
    }

    existingPaidOrder = ((emailOrders ?? [])[0] ?? null) as { id: string } | null;
  }

  if (existingPaidOrder) {
    return jsonResponse(
      {
        error: "You already purchased this asset",
        code: "already_purchased",
        existing_order_id: existingPaidOrder.id
      },
      409
    );
  }

  if (checkoutAmountKobo > 0) {
    const { data: payoutAccounts, error: payoutError } = await supabase
      .from("creator_payout_accounts")
      .select("creator_id")
      .eq("creator_id", asset.creator_id)
      .eq("status", "active")
      .limit(1);

    if (payoutError) {
      return jsonResponse({ error: "Unable to check seller payout status", details: payoutError.message }, 500);
    }

    if (!payoutAccounts || payoutAccounts.length === 0) {
      return jsonResponse(
        {
          error: "This creator has not configured payouts yet. Please try again later.",
          code: "creator_payout_unavailable"
        },
        403
      );
    }
  }

  const { commission, sellerNetAmount } = getEscrowAmounts(checkoutAmountKobo, commissionBps);
  const paidAt = checkoutAmountKobo === 0 ? new Date().toISOString() : null;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      buyer_id: buyerId,
      email: buyerEmail,
      asset_id: asset.id,
      amount_kobo: checkoutAmountKobo,
      currency: asset.currency,
      status: checkoutAmountKobo === 0 ? "paid" : "pending",
      commission_kobo: commission,
      seller_net_amount_kobo: sellerNetAmount,
      delivery_mode: deliveryMode,
      delivery_external_url: externalDeliveryUrl,
      paid_at: paidAt,
      buyer_confirmed_at: checkoutAmountKobo === 0 ? paidAt : null,
      escrow_status: checkoutAmountKobo === 0 ? "released" : null,
      escrow_due_at: null,
      escrow_released_at: checkoutAmountKobo === 0 ? paidAt : null,
      escrow_release_reason: checkoutAmountKobo === 0 ? "free_access" : null
    })
    .select("id, amount_kobo, currency, commission_kobo, seller_net_amount_kobo")
    .single();

  if (orderError || !order) {
    return jsonResponse({ error: "Unable to create order", details: orderError?.message }, 500);
  }

  if (order.amount_kobo === 0) {
    try {
      await ensureOrderDeliverySnapshot(supabase, order.id);
      await ensureOrderReceipt(supabase, order.id);
      await trackPurchaseEvent({
        supabase,
        orderId: order.id,
        assetId: asset.id,
        creatorId: asset.creator_id,
        buyerId,
        buyerEmail,
        reference: `free_${order.id.replace(/-/g, "")}`
      });
    } catch (error) {
      return jsonResponse(
        {
          error: "Unable to unlock this listing instantly",
          details: error instanceof Error ? error.message : "Unknown error"
        },
        500
      );
    }

    return jsonResponse({
      order_id: order.id,
      email: buyerEmail,
      amount_kobo: order.amount_kobo,
      currency: order.currency,
      checkout_mode: "instant"
    });
  }

  if (!paystackSecretKey) {
    await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
    return jsonResponse({ error: "Missing required payment configuration" }, 500);
  }

  const reference = `crib_${order.id.replace(/-/g, "")}_${Date.now()}`;

  try {
    const paystackPayload = {
      email: buyerEmail,
      amount: order.amount_kobo,
      currency: order.currency,
      reference,
      callback_url: `${siteUrl}/orders?reference=${encodeURIComponent(reference)}`,
      metadata: {
        source: "crib",
        asset_id: asset.id,
        asset_title: asset.title,
        order_id: order.id,
        buyer_id: buyerId,
        creator_id: asset.creator_id,
        commission_bps: commissionBps,
        commission_kobo: order.commission_kobo,
        seller_net_amount_kobo: order.seller_net_amount_kobo,
        payout_mode: "escrow_hold",
        delivery_mode: deliveryMode,
        pricing_model: pricingModel
      }
    };

    const paystackResponse = await initializePaystackTransaction(paystackSecretKey, paystackPayload);
    if (!paystackResponse.status || !paystackResponse.data) {
      throw new Error(paystackResponse.message || "Paystack initialization failed");
    }

    const { error: paymentError } = await supabase.from("payments").insert({
      order_id: order.id,
      provider: "paystack",
      reference,
      status: "pending",
      raw: paystackResponse
    });

    if (paymentError) {
      throw new Error(`Unable to persist payment: ${paymentError.message}`);
    }

    return jsonResponse({
      order_id: order.id,
      reference,
      email: buyerEmail,
      amount_kobo: order.amount_kobo,
      currency: order.currency,
      authorization_url: paystackResponse.data.authorization_url,
      access_code: paystackResponse.data.access_code,
      public_key: Deno.env.get("PAYSTACK_PUBLIC_KEY") ?? "",
      checkout_mode: "paystack"
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
    await supabase.from("payments").upsert(
      {
        order_id: order.id,
        provider: "paystack",
        reference,
        status: "failed",
        raw: {
          error: errorMessage
        }
      },
      { onConflict: "order_id" }
    );

    const normalizedError = errorMessage.toLowerCase();
    if (normalizedError.includes("invalid email address")) {
      return jsonResponse(
        {
          error: "Paystack rejected the buyer email. Use a valid public email address.",
          code: "invalid_buyer_email"
        },
        400
      );
    }

    return jsonResponse(
      {
        error: "Unable to initialize payment",
        details: errorMessage
      },
      502
    );
  }
});

