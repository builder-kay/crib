import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { ensureOrderDeliveryFiles, ensureOrderDeliverySnapshot } from "../_shared/asset-delivery.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

type GenerateDownloadPayload = {
  order_id?: string;
  order_file_id?: string;
  expires_in?: number;
};

function clampExpiry(input: unknown): number {
  const parsed = typeof input === "number" ? input : Number.parseInt(String(input ?? "600"), 10);
  if (Number.isNaN(parsed)) {
    return 600;
  }
  return Math.min(900, Math.max(300, parsed));
}

async function markBuyerOpened(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  isCreatorOrAdmin: boolean,
  orderStatus: string,
  buyerOpenedAt: string | null
) {
  if (isCreatorOrAdmin || orderStatus !== "paid" || buyerOpenedAt) {
    return;
  }

  await supabase
    .from("orders")
    .update({ buyer_opened_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("buyer_opened_at", null);
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
  const orderFileId = typeof body.order_file_id === "string" ? body.order_file_id.trim() : "";
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
      "id, status, asset_id, buyer_id, email, buyer_opened_at, delivery_mode, delivery_external_url, delivery_storage_path, delivery_original_name, assets!inner(creator_id)"
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
    return jsonResponse({ error: "You are not allowed to access this delivery" }, 403);
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
        error: "Unable to load the purchased delivery",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      500
    );
  }

  await markBuyerOpened(supabase, order.id, isCreatorOrAdmin, order.status, order.buyer_opened_at ?? null);

  if (deliverySnapshot.deliveryType === "external_link") {
    return jsonResponse({
      url: deliverySnapshot.url,
      expires_in: 0,
      filename: deliverySnapshot.originalName,
      delivery_type: "external_link",
      action_label: deliverySnapshot.actionLabel
    });
  }

  let targetStoragePath = deliverySnapshot.storagePath;
  let targetOriginalName = deliverySnapshot.originalName;
  let targetActionLabel = deliverySnapshot.actionLabel;

  if (orderFileId) {
    const deliveryFiles = await ensureOrderDeliveryFiles(supabase, order.id);
    const selectedFile = deliveryFiles.find((file) => file.id === orderFileId) ?? null;

    if (!selectedFile) {
      return jsonResponse({ error: "Requested delivery file not found for this order" }, 404);
    }

    targetStoragePath = selectedFile.storage_path;
    targetOriginalName = selectedFile.original_name;
    targetActionLabel =
      selectedFile.file_role === "source_zip"
        ? "Download ZIP bundle"
        : selectedFile.file_role === "source_wav"
          ? "Download WAV file"
          : selectedFile.file_role === "audio_preview"
            ? "Download MP3 preview"
            : selectedFile.file_role === "project_file"
              ? "Download project file"
              : selectedFile.file_role === "midi"
                ? "Download MIDI file"
                : "Download file";
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from("assets")
    .createSignedUrl(targetStoragePath, expiresIn, {
      download: targetOriginalName
    });

  if (signedError || !signedData) {
    return jsonResponse({ error: "Unable to create signed URL", details: signedError?.message }, 500);
  }

  return jsonResponse({
    url: signedData.signedUrl,
    expires_in: expiresIn,
    filename: targetOriginalName,
    delivery_type: "file",
    action_label: targetActionLabel
  });
});
