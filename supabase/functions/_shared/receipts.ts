import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type ServiceClient = ReturnType<typeof createClient>;

type ExistingReceiptRow = {
  id: string;
  receipt_number: string;
};

type OrderRow = {
  id: string;
  buyer_id: string | null;
  email: string;
  amount_kobo: number;
  currency: string;
  paid_at: string | null;
  created_at: string;
  commission_kobo: number | null;
  seller_net_amount_kobo: number | null;
  asset_id: string;
  asset: {
    creator_id: string;
    title: string;
    category: string;
  } | {
    creator_id: string;
    title: string;
    category: string;
  }[] | null;
};

type PaymentRow = {
  id: string;
  provider: string;
  reference: string;
};

type ProfileRow = {
  display_name: string | null;
};

function normalizeJoinedRecord<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function buildReceiptNumber(orderId: string, paidAt: string | null, createdAt: string) {
  const date = new Date(paidAt ?? createdAt);
  const year = Number.isNaN(date.getTime()) ? "0000" : String(date.getUTCFullYear()).padStart(4, "0");
  const month = Number.isNaN(date.getTime()) ? "00" : String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = Number.isNaN(date.getTime()) ? "00" : String(date.getUTCDate()).padStart(2, "0");
  const suffix = orderId.replace(/-/g, "").slice(-8).toUpperCase();
  return `CRIB-RCP-${year}${month}${day}-${suffix}`;
}

function fallbackDisplayName(input: { displayName: string | null; email: string | null; fallback: string }) {
  const trimmedDisplayName = input.displayName?.trim() ?? "";
  if (trimmedDisplayName) {
    return trimmedDisplayName;
  }

  const emailPrefix = input.email?.split("@")[0]?.trim() ?? "";
  if (emailPrefix) {
    return emailPrefix;
  }

  return input.fallback;
}

export async function ensureOrderReceipt(supabase: ServiceClient, orderId: string) {
  const { data: existingReceipt, error: existingReceiptError } = await supabase
    .from("order_receipts")
    .select("id, receipt_number")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existingReceiptError) {
    throw new Error(existingReceiptError.message);
  }

  if (existingReceipt) {
    return existingReceipt as ExistingReceiptRow;
  }

  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select(
      `id,
      buyer_id,
      email,
      amount_kobo,
      currency,
      paid_at,
      created_at,
      commission_kobo,
      seller_net_amount_kobo,
      asset_id,
      asset:assets!inner(creator_id, title, category)`
    )
    .eq("id", orderId)
    .single();

  if (orderError || !orderData) {
    throw new Error(orderError?.message ?? "Order not found for receipt creation");
  }

  const order = orderData as OrderRow;
  const asset = normalizeJoinedRecord(order.asset);
  if (!asset) {
    throw new Error("Receipt creation could not load the purchased asset");
  }

  const { data: paymentData, error: paymentError } = await supabase
    .from("payments")
    .select("id, provider, reference")
    .eq("order_id", orderId)
    .maybeSingle();

  if (paymentError) {
    throw new Error(paymentError.message);
  }

  const payment = (paymentData ?? null) as PaymentRow | null;

  const [{ data: sellerProfileData, error: sellerProfileError }, { data: buyerProfileData, error: buyerProfileError }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", asset.creator_id).maybeSingle(),
    order.buyer_id ? supabase.from("profiles").select("display_name").eq("id", order.buyer_id).maybeSingle() : Promise.resolve({ data: null, error: null })
  ]);

  if (sellerProfileError) {
    throw new Error(sellerProfileError.message);
  }

  if (buyerProfileError) {
    throw new Error(buyerProfileError.message);
  }

  const sellerProfile = (sellerProfileData ?? null) as ProfileRow | null;
  const buyerProfile = (buyerProfileData ?? null) as ProfileRow | null;

  let sellerEmail: string | null = null;
  const sellerAuthResult = await supabase.auth.admin.getUserById(asset.creator_id);
  if (!sellerAuthResult.error) {
    sellerEmail = sellerAuthResult.data.user?.email?.trim() ?? null;
  }

  const paidAt = order.paid_at ?? new Date().toISOString();
  const receiptNumber = buildReceiptNumber(order.id, order.paid_at, order.created_at);

  const { data: insertedReceipt, error: insertError } = await supabase
    .from("order_receipts")
    .insert({
      order_id: order.id,
      payment_id: payment?.id ?? null,
      receipt_number: receiptNumber,
      buyer_id: order.buyer_id,
      seller_id: asset.creator_id,
      asset_id: order.asset_id,
      buyer_email: order.email,
      seller_email: sellerEmail,
      buyer_display_name: fallbackDisplayName({
        displayName: buyerProfile?.display_name ?? null,
        email: order.email,
        fallback: "Buyer"
      }),
      seller_display_name: fallbackDisplayName({
        displayName: sellerProfile?.display_name ?? null,
        email: sellerEmail,
        fallback: "Creator"
      }),
      asset_title: asset.title,
      asset_category: asset.category,
      payment_provider: payment?.provider ?? (order.amount_kobo === 0 ? "free" : "paystack"),
      payment_reference: payment?.reference ?? (order.amount_kobo === 0 ? `free-${order.id.replace(/-/g, "")}` : `order-${order.id.replace(/-/g, "")}`),
      amount_kobo: order.amount_kobo,
      commission_kobo: order.commission_kobo ?? 0,
      seller_net_amount_kobo: order.seller_net_amount_kobo ?? Math.max(order.amount_kobo - (order.commission_kobo ?? 0), 0),
      currency: order.currency,
      paid_at: paidAt
    })
    .select("id, receipt_number")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: racedReceipt, error: racedReceiptError } = await supabase
        .from("order_receipts")
        .select("id, receipt_number")
        .eq("order_id", orderId)
        .maybeSingle();

      if (racedReceiptError) {
        throw new Error(racedReceiptError.message);
      }

      if (racedReceipt) {
        return racedReceipt as ExistingReceiptRow;
      }
    }

    throw new Error(insertError.message);
  }

  return insertedReceipt as ExistingReceiptRow;
}

