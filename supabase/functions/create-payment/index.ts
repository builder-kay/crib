import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";
import { initializePaystackTransaction } from "../_shared/paystack.ts";

type CreatePaymentPayload = {
  asset_id?: string;
  email?: string;
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

function hasUnsupportedBuyerDomain(email: string): boolean {
  const [, domain = ""] = email.split("@");
  const normalizedDomain = domain.trim().toLowerCase();
  if (!normalizedDomain) {
    return true;
  }

  return normalizedDomain === "localhost" || normalizedDomain.endsWith(".local");
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

  if (!supabaseUrl || !serviceRoleKey || !paystackSecretKey) {
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

  let buyerId: string | null = null;
  let buyerEmail = parseEmail(body.email) ?? null;

  if (accessToken) {
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (!authError && authData.user) {
      buyerId = authData.user.id;
      buyerEmail = parseUserContactEmail(authData.user) ?? buyerEmail;
    }
  }

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

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, title, creator_id, price_kobo, currency, status")
    .eq("id", assetId)
    .single();

  if (assetError || !asset) {
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

  if (buyerId && asset.creator_id === buyerId) {
    return jsonResponse({ error: "You cannot purchase your own asset", code: "own_asset" }, 403);
  }

  const { data: creatorAuthData, error: creatorAuthError } = await supabase.auth.admin.getUserById(asset.creator_id);
  if (!creatorAuthError) {
    const creatorEmail = parseEmail(creatorAuthData.user?.email);
    if (creatorEmail && creatorEmail === buyerEmail) {
      return jsonResponse({ error: "You cannot purchase your own asset", code: "own_asset" }, 403);
    }
  }

  let existingPaidOrderQuery = supabase
    .from("orders")
    .select("id")
    .eq("asset_id", asset.id)
    .eq("status", "paid")
    .limit(1);

  if (buyerId) {
    existingPaidOrderQuery = existingPaidOrderQuery.or(`buyer_id.eq.${buyerId},email.eq.${buyerEmail}`);
  } else {
    existingPaidOrderQuery = existingPaidOrderQuery.eq("email", buyerEmail);
  }

  const { data: existingPaidOrder, error: existingPaidOrderError } = await existingPaidOrderQuery.maybeSingle();

  if (existingPaidOrderError) {
    return jsonResponse({ error: "Unable to check existing purchases", details: existingPaidOrderError.message }, 500);
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

  const commission = Math.floor((asset.price_kobo * commissionBps) / 10_000);
  const sellerNetAmount = Math.max(asset.price_kobo - commission, 0);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      buyer_id: buyerId,
      email: buyerEmail,
      asset_id: asset.id,
      amount_kobo: asset.price_kobo,
      currency: asset.currency,
      status: "pending",
      commission_kobo: commission,
      seller_net_amount_kobo: sellerNetAmount
    })
    .select("id, email_token, amount_kobo, currency, commission_kobo, seller_net_amount_kobo")
    .single();

  if (orderError || !order) {
    return jsonResponse({ error: "Unable to create order", details: orderError?.message }, 500);
  }

  const reference = `crib_${order.id.replace(/-/g, "")}_${Date.now()}`;

  try {
    const paystackPayload = {
      email: buyerEmail,
      amount: order.amount_kobo,
      currency: order.currency,
      reference,
      callback_url: `${siteUrl}/orders?reference=${encodeURIComponent(reference)}&token=${order.email_token}`,
      metadata: {
        source: "crib",
        asset_id: asset.id,
        asset_title: asset.title,
        order_id: order.id,
        order_token: order.email_token,
        buyer_id: buyerId,
        creator_id: asset.creator_id,
        commission_bps: commissionBps,
        commission_kobo: order.commission_kobo,
        seller_net_amount_kobo: order.seller_net_amount_kobo,
        payout_mode: "escrow_hold"
      }
    };

    const paystackResponse = await initializePaystackTransaction(paystackSecretKey, paystackPayload);

    if (!paystackResponse.status || !paystackResponse.data) {
      await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
      return jsonResponse({ error: paystackResponse.message || "Paystack initialization failed" }, 502);
    }

    const { error: paymentError } = await supabase.from("payments").insert({
      order_id: order.id,
      provider: "paystack",
      reference,
      status: "pending",
      raw: paystackResponse
    });

    if (paymentError) {
      await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
      return jsonResponse({ error: "Unable to persist payment", details: paymentError.message }, 500);
    }

    return jsonResponse(
      {
        order_id: order.id,
        order_token: order.email_token,
        reference,
        email: buyerEmail,
        amount_kobo: order.amount_kobo,
        currency: order.currency,
        authorization_url: paystackResponse.data.authorization_url,
        access_code: paystackResponse.data.access_code,
        public_key: Deno.env.get("PAYSTACK_PUBLIC_KEY") ?? ""
      },
      200,
      corsHeaders
    );
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
