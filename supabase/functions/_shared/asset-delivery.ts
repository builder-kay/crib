import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type ServiceClient = ReturnType<typeof createClient>;

type OrderSnapshotRow = {
  id: string;
  asset_id: string;
  delivery_storage_path: string | null;
  delivery_original_name: string | null;
  delivery_file_type: string | null;
  delivery_file_size: number | null;
  delivery_file_sha256: string | null;
  delivery_locked_at: string | null;
};

type AssetFileRow = {
  id: string;
  asset_id: string;
  storage_path: string;
  original_name: string;
  file_type: string;
  file_size: number;
  immutable_storage_path: string | null;
  file_sha256: string | null;
  immutable_locked_at: string | null;
};

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function sanitizeFilenameSegment(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "asset-download.bin";
  }

  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "asset-download.bin";
}

function buildImmutableStoragePath(file: Pick<AssetFileRow, "asset_id" | "id" | "original_name">) {
  return `immutable/${file.asset_id}/${file.id}/${sanitizeFilenameSegment(file.original_name)}`;
}

function isCompleteOrderSnapshot(order: OrderSnapshotRow) {
  return Boolean(
    order.delivery_storage_path &&
      order.delivery_original_name &&
      order.delivery_file_type &&
      typeof order.delivery_file_size === "number" &&
      order.delivery_file_size >= 0 &&
      order.delivery_file_sha256 &&
      order.delivery_locked_at
  );
}

function isAlreadyExistsError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("already exists") || normalized.includes("duplicate");
}

async function computeBlobSha256(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return toHex(digest);
}

export async function ensureOrderDeliverySnapshot(supabase: ServiceClient, orderId: string) {
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, asset_id, delivery_storage_path, delivery_original_name, delivery_file_type, delivery_file_size, delivery_file_sha256, delivery_locked_at"
    )
    .eq("id", orderId)
    .single();

  if (orderError || !orderData) {
    throw new Error(orderError?.message ?? "Order not found");
  }

  const order = orderData as OrderSnapshotRow;
  if (isCompleteOrderSnapshot(order)) {
    return {
      storagePath: order.delivery_storage_path as string,
      originalName: order.delivery_original_name as string,
      fileType: order.delivery_file_type as string,
      fileSize: order.delivery_file_size as number,
      fileSha256: order.delivery_file_sha256 as string,
      lockedAt: order.delivery_locked_at as string
    };
  }

  const { data: fileData, error: fileError } = await supabase
    .from("asset_files")
    .select(
      "id, asset_id, storage_path, original_name, file_type, file_size, immutable_storage_path, file_sha256, immutable_locked_at"
    )
    .eq("asset_id", order.asset_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (fileError || !fileData) {
    throw new Error(fileError?.message ?? "Asset file not found");
  }

  const file = fileData as AssetFileRow;
  const immutableStoragePath = order.delivery_storage_path || file.immutable_storage_path || buildImmutableStoragePath(file);

  if (!file.immutable_storage_path || !order.delivery_storage_path) {
    const { error: copyError } = await supabase.storage.from("assets").copy(file.storage_path, immutableStoragePath);
    if (copyError && !isAlreadyExistsError(copyError.message)) {
      throw new Error(copyError.message);
    }
  }

  let fileSha256 = order.delivery_file_sha256 || file.file_sha256;
  if (!fileSha256) {
    const { data: blob, error: downloadError } = await supabase.storage.from("assets").download(immutableStoragePath);
    if (downloadError || !blob) {
      throw new Error(downloadError?.message ?? "Unable to read immutable delivery file");
    }
    fileSha256 = await computeBlobSha256(blob);
  }

  const lockedAt = order.delivery_locked_at || file.immutable_locked_at || new Date().toISOString();

  const assetFilePatch: Record<string, string> = {};
  if (file.immutable_storage_path !== immutableStoragePath) {
    assetFilePatch.immutable_storage_path = immutableStoragePath;
  }
  if (file.file_sha256 !== fileSha256) {
    assetFilePatch.file_sha256 = fileSha256;
  }
  if (!file.immutable_locked_at) {
    assetFilePatch.immutable_locked_at = lockedAt;
  }

  if (Object.keys(assetFilePatch).length > 0) {
    const { error: assetFileUpdateError } = await supabase.from("asset_files").update(assetFilePatch).eq("id", file.id);
    if (assetFileUpdateError) {
      throw new Error(assetFileUpdateError.message);
    }
  }

  const orderPatch: Record<string, string | number> = {};
  if (order.delivery_storage_path !== immutableStoragePath) {
    orderPatch.delivery_storage_path = immutableStoragePath;
  }
  if (order.delivery_original_name !== file.original_name) {
    orderPatch.delivery_original_name = file.original_name;
  }
  if (order.delivery_file_type !== file.file_type) {
    orderPatch.delivery_file_type = file.file_type;
  }
  if (order.delivery_file_size !== file.file_size) {
    orderPatch.delivery_file_size = file.file_size;
  }
  if (order.delivery_file_sha256 !== fileSha256) {
    orderPatch.delivery_file_sha256 = fileSha256;
  }
  if (!order.delivery_locked_at) {
    orderPatch.delivery_locked_at = lockedAt;
  }

  if (Object.keys(orderPatch).length > 0) {
    const { error: orderUpdateError } = await supabase.from("orders").update(orderPatch).eq("id", order.id);
    if (orderUpdateError) {
      throw new Error(orderUpdateError.message);
    }
  }

  return {
    storagePath: immutableStoragePath,
    originalName: file.original_name,
    fileType: file.file_type,
    fileSize: file.file_size,
    fileSha256,
    lockedAt
  };
}
