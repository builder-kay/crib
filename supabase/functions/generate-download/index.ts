import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

type GenerateDownloadPayload = {
  order_id?: string;
  email_token?: string;
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
  const emailToken = typeof body.email_token === "string" ? body.email_token.trim() : "";
  const expiresIn = clampExpiry(body.expires_in);

  if (!orderId) {
    return jsonResponse({ error: "order_id is required" }, 400);
  }

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  let requesterId: string | null = null;
  let requesterEmail: string | null = null;

  if (accessToken) {
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (!userError && userData.user) {
      requesterId = userData.user.id;
      requesterEmail = userData.user.email ?? null;
    }
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, asset_id, buyer_id, email, email_token, buyer_opened_at, assets!inner(creator_id)")
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
    Boolean(requesterId) &&
    (
      order.buyer_id === requesterId ||
      creatorId === requesterId ||
      (requesterEmail !== null && order.email === requesterEmail) ||
      isAdmin
    );

  const authorizedByToken = emailToken !== "" && order.email_token === emailToken;

  if (!authorizedByAuth && !authorizedByToken) {
    return jsonResponse({ error: "You are not allowed to access this download" }, 403);
  }

  const isCreatorOrAdmin = Boolean(requesterId) && (creatorId === requesterId || isAdmin);
  if (order.status !== "paid" && !isCreatorOrAdmin) {
    return jsonResponse({ error: "Order is not paid yet" }, 403);
  }

  const { data: file, error: fileError } = await supabase
    .from("asset_files")
    .select("storage_path, original_name")
    .eq("asset_id", order.asset_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (fileError || !file) {
    return jsonResponse({ error: "Asset file not found" }, 404);
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from("assets")
    .createSignedUrl(file.storage_path, expiresIn, {
      download: file.original_name
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
    filename: file.original_name
  });
});