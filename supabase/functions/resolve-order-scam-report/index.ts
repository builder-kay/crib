import { createServiceRoleClient } from "../_shared/auth.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { createPaystackRefund } from "../_shared/paystack.ts";

type ResolveOrderScamPayload = {
  order_id?: string;
  resolution?: string;
  seller_action?: string;
  admin_note?: string;
  seller_note?: string;
};

type AuthenticatedUser = {
  id: string;
};

type OrderAssetRecord = {
  id: string;
  title: string;
  creator_id: string;
};

type PaymentRecord = {
  id: string;
  provider: string;
  reference: string;
  status: string;
  raw: Record<string, unknown> | null;
};

type OrderRecord = {
  id: string;
  status: string;
  amount_kobo: number;
  currency: string;
  commission_kobo: number | null;
  seller_net_amount_kobo: number | null;
  escrow_status: string | null;
  escrow_due_at: string | null;
  escrow_released_at: string | null;
  escrow_release_reason: string | null;
  scam_report_reason: string | null;
  scam_resolution_status: string | null;
  scam_resolution_note: string | null;
  seller_issue_note: string | null;
  refund_reference: string | null;
  refund_provider_status: string | null;
  asset: OrderAssetRecord | OrderAssetRecord[] | null;
  payment: PaymentRecord | PaymentRecord[] | null;
};

type CreatorRecord = {
  id: string;
  display_name: string;
  seller_account_status: string | null;
  seller_account_note: string | null;
};

function normalizeJoinedRecord<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

async function authenticateUser(
  supabase: ReturnType<typeof createServiceRoleClient>,
  request: Request
): Promise<{ user: AuthenticatedUser | null; response: Response | null }> {
  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (!accessToken) {
    return {
      user: null,
      response: jsonResponse({ error: "Authentication required" }, 401)
    };
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    return {
      user: null,
      response: jsonResponse({ error: "Invalid authentication token" }, 401)
    };
  }

  return {
    user: { id: data.user.id },
    response: null
  };
}

function normalizeResolution(input: unknown): "genuine" | "refund" | null {
  const value = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (value === "genuine" || value === "refund") {
    return value;
  }
  return null;
}

function normalizeSellerAction(input: unknown): "none" | "warn" | "suspend" {
  const value = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (value === "warn" || value === "suspend") {
    return value;
  }
  return "none";
}

function normalizeNote(input: unknown) {
  return leftTrimmedText(input, 1200);
}

function leftTrimmedText(input: unknown, maxLength: number) {
  return typeof input === "string" ? input.trim().slice(0, maxLength) : "";
}

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) {
    return corsResponse;
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabase = createServiceRoleClient();
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    const authResult = await authenticateUser(supabase, request);
    if (authResult.response) {
      return authResult.response;
    }

    const requester = authResult.user as AuthenticatedUser;

    const { data: requesterAdmin, error: requesterAdminError } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", requester.id)
      .maybeSingle();

    if (requesterAdminError) {
      return jsonResponse({ error: requesterAdminError.message }, 500);
    }

    if (!requesterAdmin) {
      return jsonResponse({ error: "Only marketplace admins can resolve reported orders." }, 403);
    }

    let body: ResolveOrderScamPayload;
    try {
      body = (await request.json()) as ResolveOrderScamPayload;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
    const resolution = normalizeResolution(body.resolution);
    const sellerAction = normalizeSellerAction(body.seller_action);
    const adminNote = normalizeNote(body.admin_note);
    const sellerNote = normalizeNote(body.seller_note);

    if (!orderId) {
      return jsonResponse({ error: "order_id is required" }, 400);
    }

    if (!resolution) {
      return jsonResponse({ error: "resolution must be genuine or refund" }, 400);
    }

    if (resolution === "genuine" && sellerAction !== "none") {
      return jsonResponse({ error: "Seller action is only available when refunding the buyer." }, 400);
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(
        `id,
        status,
        amount_kobo,
        currency,
        commission_kobo,
        seller_net_amount_kobo,
        escrow_status,
        escrow_due_at,
        escrow_released_at,
        escrow_release_reason,
        scam_report_reason,
        scam_resolution_status,
        scam_resolution_note,
        seller_issue_note,
        refund_reference,
        refund_provider_status,
        asset:assets!inner(id, title, creator_id),
        payment:payments!inner(id, provider, reference, status, raw)`
      )
      .eq("id", orderId)
      .single();

    if (orderError || !orderData) {
      return jsonResponse({ error: orderError?.message ?? "Order not found" }, orderError?.code === "PGRST116" ? 404 : 500);
    }

    const order = orderData as OrderRecord;
    const asset = normalizeJoinedRecord(order.asset);
    const payment = normalizeJoinedRecord(order.payment);

    if (!asset || !payment) {
      return jsonResponse({ error: "Order is missing linked asset or payment data." }, 409);
    }

    const { data: creatorData, error: creatorError } = await supabase
      .from("profiles")
      .select("id, display_name, seller_account_status, seller_account_note")
      .eq("id", asset.creator_id)
      .single();

    if (creatorError || !creatorData) {
      return jsonResponse({ error: creatorError?.message ?? "Creator profile not found" }, creatorError?.code === "PGRST116" ? 404 : 500);
    }

    const creator = creatorData as CreatorRecord;

    const alreadyResolved =
      (resolution === "genuine" && order.scam_resolution_status === "genuine_released") ||
      (resolution === "refund" && order.scam_resolution_status === "buyer_refunded");

    if (alreadyResolved) {
      return jsonResponse({
        ok: true,
        idempotent: true,
        order_id: order.id,
        order_status: order.status,
        escrow_status: order.escrow_status,
        scam_resolution_status: order.scam_resolution_status,
        refund_provider_status: order.refund_provider_status,
        seller_account_status: creator.seller_account_status ?? "active"
      });
    }

    if (order.status !== "paid" || order.escrow_status !== "scam_reported") {
      return jsonResponse(
        {
          error: "Only paid orders that are currently marked as reported scams can be resolved.",
          order_status: order.status,
          escrow_status: order.escrow_status
        },
        409
      );
    }

    if (resolution === "genuine") {
      const sellerNetAmount = Math.max(order.seller_net_amount_kobo ?? 0, 0);

      if (sellerNetAmount > 0) {
        const { data: creditResult, error: creditError } = await supabase.rpc("credit_wallet", {
          p_creator_id: asset.creator_id,
          p_order_id: order.id,
          p_amount_kobo: sellerNetAmount
        });

        if (creditError) {
          return jsonResponse({ error: creditError.message }, 500);
        }

        if (creditResult === false && !order.escrow_released_at) {
          return jsonResponse({ error: "Could not release seller payout for this order." }, 409);
        }
      }

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          escrow_status: "released",
          buyer_confirmed_at: new Date().toISOString(),
          escrow_released_at: order.escrow_released_at ?? new Date().toISOString(),
          escrow_release_reason: "admin_ignored_report",
          scam_resolution_status: "genuine_released",
          scam_resolution_note: adminNote || null,
          seller_issue_note: sellerNote || null,
          scam_resolved_at: new Date().toISOString(),
          scam_resolved_by: requester.id,
          seller_moderation_action: "none",
          refund_reference: null,
          refund_provider_status: null
        })
        .eq("id", order.id);

      if (updateError) {
        return jsonResponse({ error: updateError.message }, 500);
      }

      return jsonResponse({
        ok: true,
        order_id: order.id,
        order_status: "paid",
        escrow_status: "released",
        escrow_release_reason: "admin_ignored_report",
        scam_resolution_status: "genuine_released",
        seller_moderation_action: "none",
        seller_account_status: creator.seller_account_status ?? "active"
      });
    }

    if (!paystackSecretKey) {
      return jsonResponse({ error: "Missing required environment variables" }, 500);
    }

    if (payment.provider !== "paystack") {
      return jsonResponse({ error: "Automatic refunds are only configured for Paystack payments right now." }, 409);
    }

    const merchantNote = [
      `CRIB admin refund for order ${order.id}`,
      adminNote ? `Admin note: ${adminNote}` : "",
      sellerNote ? `Seller note: ${sellerNote}` : ""
    ]
      .filter(Boolean)
      .join(" | ");

    let refundResponse;
    try {
      refundResponse = await createPaystackRefund(paystackSecretKey, {
        transaction: payment.reference,
        amount: order.amount_kobo,
        currency: order.currency,
        customer_note: "CRIB approved a refund after reviewing the reported file issue.",
        merchant_note: merchantNote
      });
    } catch (error) {
      return jsonResponse(
        {
          error: "Refund request failed",
          details: error instanceof Error ? error.message : "Unknown error"
        },
        502
      );
    }

    if (!refundResponse.status || !refundResponse.data) {
      return jsonResponse({ error: refundResponse.message || "Refund request failed" }, 502);
    }

    const refundStatus = String(refundResponse.data.status ?? "").trim().toLowerCase();
    if (refundStatus === "failed" || refundStatus === "needs-attention") {
      return jsonResponse(
        {
          error:
            refundStatus === "needs-attention"
              ? "Paystack needs customer refund details before this refund can complete."
              : refundResponse.message || "Refund request failed",
          refund_provider_status: refundStatus || null
        },
        409
      );
    }

    const sellerModerationAction = sellerAction === "warn" ? "warned" : sellerAction === "suspend" ? "suspended" : "none";
    const sellerAccountStatus = sellerAction === "warn" ? "warned" : sellerAction === "suspend" ? "suspended" : creator.seller_account_status ?? "active";
    const sellerAccountNote = sellerNote || adminNote || creator.seller_account_note || null;
    const resolvedAt = new Date().toISOString();

    const nextPaymentRaw = {
      ...(payment.raw ?? {}),
      refund: refundResponse,
      refund_resolution: {
        order_id: order.id,
        resolved_by: requester.id,
        resolved_at: resolvedAt,
        seller_action: sellerModerationAction,
        admin_note: adminNote || null,
        seller_note: sellerNote || null
      }
    };

    const { error: paymentUpdateError } = await supabase
      .from("payments")
      .update({
        status: "refunded",
        raw: nextPaymentRaw
      })
      .eq("id", payment.id);

    if (paymentUpdateError) {
      return jsonResponse({ error: paymentUpdateError.message }, 500);
    }

    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        status: "refunded",
        scam_resolution_status: "buyer_refunded",
        scam_resolution_note: adminNote || null,
        seller_issue_note: sellerNote || null,
        scam_resolved_at: resolvedAt,
        scam_resolved_by: requester.id,
        seller_moderation_action: sellerModerationAction,
        refund_reference: refundResponse.data.reference ?? payment.reference,
        refund_provider_status: refundStatus || null
      })
      .eq("id", order.id);

    if (orderUpdateError) {
      return jsonResponse({ error: orderUpdateError.message }, 500);
    }

    if (sellerAction !== "none") {
      const { error: creatorUpdateError } = await supabase
        .from("profiles")
        .update({
          seller_account_status: sellerAccountStatus,
          seller_account_note: sellerAccountNote,
          seller_account_updated_at: resolvedAt,
          seller_account_updated_by: requester.id
        })
        .eq("id", asset.creator_id);

      if (creatorUpdateError) {
        return jsonResponse({ error: creatorUpdateError.message }, 500);
      }
    }

    if (sellerAction === "suspend") {
      const { error: archiveAssetsError } = await supabase
        .from("assets")
        .update({ status: "archived" })
        .eq("creator_id", asset.creator_id)
        .neq("status", "archived");

      if (archiveAssetsError) {
        return jsonResponse({ error: archiveAssetsError.message }, 500);
      }
    }

    return jsonResponse({
      ok: true,
      order_id: order.id,
      order_status: "refunded",
      escrow_status: "scam_reported",
      scam_resolution_status: "buyer_refunded",
      seller_moderation_action: sellerModerationAction,
      refund_provider_status: refundStatus || null,
      seller_account_status: sellerAccountStatus
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to resolve reported order"
      },
      500
    );
  }
});
