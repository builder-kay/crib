import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { ensureOrderDeliverySnapshot } from "../_shared/asset-delivery.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

type GenerateDownloadPayload = {
  order_id?: string;
  expires_in?: number;
};

function clampExpiry(input: unknown): number {
  const parsed = typeof input === "number" ? input : Number.parseInt(String(input ?? "600"), 10);
  if (Number.isNaN(parsed)) {
    return 600;
  }
  return Math.min(900, Math.max(300, parsed));
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

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing required environment variables" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let body: GenerateDownloadPayload;
  try {
    body = (await request.json()) as GenerateDownloadPayload;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
  const expiresIn = clampExpiry(body.expires_in);

  if (!orderId) {
    return jsonResponse({ error: "order_id is required" }, 400);
  }

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (!accessToken) {
    return jsonResponse({ error: "Authentication required" }, 401);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return jsonResponse({ error: "Invalid authentication token" }, 401);
  }

  const requesterId = userData.user.id;
  const requesterEmail = userData.user.email ?? null;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, status, asset_id, buyer_id, email, buyer_opened_at, delivery_storage_path, delivery_original_name, assets!inner(creator_id)"
    )
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return jsonResponse({ error: "Order not found" }, 404);
  }

  const creatorId = (order.assets as { creator_id: string }).creator_id;

  let isAdmin = false;
  if (requesterId) {
    const { data: admin } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", requesterId)
      .maybeSingle();
    isAdmin = Boolean(admin);
  }

  const authorizedByAuth =
    order.buyer_id === requesterId ||
    creatorId === requesterId ||
    (requesterEmail !== null && order.email === requesterEmail) ||
    isAdmin;

  if (!authorizedByAuth) {
    return jsonResponse({ error: "You are not allowed to access this download" }, 403);
  }

  const isCreatorOrAdmin = Boolean(requesterId) && (creatorId === requesterId || isAdmin);
  if (order.status !== "paid" && !isCreatorOrAdmin) {
    return jsonResponse({ error: "Order is not paid yet" }, 403);
  }

  let deliverySnapshot;
  try {
    deliverySnapshot = await ensureOrderDeliverySnapshot(supabase, order.id);
  } catch (error) {
    return jsonResponse(
      {
        error: "Unable to load the locked delivery file",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      500
    );
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from("assets")
    .createSignedUrl(deliverySnapshot.storagePath, expiresIn, {
      download: deliverySnapshot.originalName
    });

  if (signedError || !signedData) {
    return jsonResponse({ error: "Unable to create signed URL", details: signedError?.message }, 500);
  }

  if (!isCreatorOrAdmin && order.status === "paid" && !order.buyer_opened_at) {
    await supabase
      .from("orders")
      .update({ buyer_opened_at: new Date().toISOString() })
      .eq("id", order.id)
      .is("buyer_opened_at", null);
  }

  return jsonResponse({
    url: signedData.signedUrl,
    expires_in: expiresIn,
    filename: deliverySnapshot.originalName
  });
});
