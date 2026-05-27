import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type ServiceClient = ReturnType<typeof createClient>;
type DeliveryMode = "file" | "external_link";
type AssetFileRole = "primary" | "audio_preview" | "source_wav" | "source_zip" | "project_file" | "midi" | "supporting";

type AssetSummaryRow = {
  title: string;
  category: string | null;
  delivery_mode: DeliveryMode | null;
  external_delivery_url: string | null;
};

type OrderSnapshotRow = {
  id: string;
  asset_id: string;
  delivery_mode: DeliveryMode | null;
  delivery_external_url: string | null;
  delivery_storage_path: string | null;
  delivery_original_name: string | null;
  delivery_file_type: string | null;
  delivery_file_size: number | null;
  delivery_file_sha256: string | null;
  delivery_locked_at: string | null;
  asset: AssetSummaryRow | AssetSummaryRow[] | null;
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
  file_role: AssetFileRole | null;
  sort_order: number | null;
};

type OrderDeliveryFileRow = {
  id: string;
  order_id: string;
  asset_file_id: string | null;
  file_role: AssetFileRole | null;
  sort_order: number | null;
  storage_path: string;
  original_name: string;
  file_type: string;
  file_size: number;
  file_sha256: string;
  locked_at: string;
};

type ImmutableAssetFile = {
  assetFileId: string;
  fileRole: AssetFileRole;
  sortOrder: number;
  storagePath: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  fileSha256: string;
  lockedAt: string;
};

type FileDeliverySnapshot = {
  deliveryType: "file";
  storagePath: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  fileSha256: string;
  lockedAt: string;
  actionLabel: string;
};

type ExternalLinkDeliverySnapshot = {
  deliveryType: "external_link";
  url: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  fileSha256: null;
  lockedAt: string;
  actionLabel: string;
};

const FILE_ROLE_PRIORITY: Record<AssetFileRole, number> = {
  source_zip: 0,
  primary: 1,
  source_wav: 2,
  audio_preview: 3,
  project_file: 4,
  midi: 5,
  supporting: 6
};

function normalizeJoinedRecord<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function isSeedStoragePath(value: string | null | undefined) {
  return typeof value === "string" && value.trim().toLowerCase().startsWith("seed/");
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function computeTextSha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(digest);
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

function inferDeliveryMode(order: OrderSnapshotRow, asset: AssetSummaryRow | null): DeliveryMode {
  if (order.delivery_mode === "external_link" || asset?.delivery_mode === "external_link") {
    return "external_link";
  }

  if (normalizeUrl(order.delivery_external_url) || normalizeUrl(asset?.external_delivery_url)) {
    return "external_link";
  }

  return "file";
}

function inferExternalLinkLabel(url: string) {
  const normalized = url.toLowerCase();
  if (normalized.includes("canva.com")) {
    return "Canva link";
  }
  if (normalized.includes("figma.com")) {
    return "Figma file";
  }
  return "template link";
}

function buildExternalDeliveryName(title: string | null | undefined, url: string) {
  const baseName = title?.trim() || inferExternalLinkLabel(url);
  return `${sanitizeFilenameSegment(baseName)}-access-link.url`;
}

function buildExternalActionLabel(url: string) {
  const normalized = url.toLowerCase();
  if (normalized.includes("canva.com")) {
    return "Open Canva link";
  }
  if (normalized.includes("figma.com")) {
    return "Open Figma file";
  }
  return "Open template link";
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

function sortDeliveryFiles<T extends { file_role?: AssetFileRole | null; sort_order?: number | null; original_name: string }>(files: readonly T[]) {
  return [...files].sort((left, right) => {
    const leftPriority = FILE_ROLE_PRIORITY[left.file_role ?? "primary"] ?? FILE_ROLE_PRIORITY.primary;
    const rightPriority = FILE_ROLE_PRIORITY[right.file_role ?? "primary"] ?? FILE_ROLE_PRIORITY.primary;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftOrder = left.sort_order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.original_name.localeCompare(right.original_name);
  });
}

function getDeliverableAssetFiles(assetFiles: readonly AssetFileRow[]) {
  const zipFiles = assetFiles.filter((file) => file.file_role === "source_zip");
  const hasLegacyAudioDeliveryFiles = assetFiles.some(
    (file) =>
      file.file_role === "audio_preview" ||
      file.file_role === "source_wav" ||
      file.file_role === "project_file" ||
      file.file_role === "midi"
  );

  if (zipFiles.length > 0 && hasLegacyAudioDeliveryFiles) {
    return zipFiles;
  }

  return assetFiles.filter((file) => file.file_role !== "audio_preview");
}

async function ensureImmutableAssetFile(supabase: ServiceClient, file: AssetFileRow): Promise<ImmutableAssetFile> {
  if (isSeedStoragePath(file.storage_path)) {
    const immutableStoragePath = file.immutable_storage_path || file.storage_path;
    const fileSha256 =
      file.file_sha256 ??
      (await computeTextSha256(
        `${file.asset_id}:${file.id}:${file.storage_path}:${file.original_name}:${file.file_size}:${file.file_role ?? "primary"}`
      ));
    const lockedAt = file.immutable_locked_at || new Date().toISOString();
    const patch: Record<string, string> = {};

    // Seeded demo rows intentionally point at placeholder paths, so we lock a deterministic
    // snapshot without requiring an object copy from the storage bucket.
    if (file.immutable_storage_path !== immutableStoragePath) {
      patch.immutable_storage_path = immutableStoragePath;
    }
    if (file.file_sha256 !== fileSha256) {
      patch.file_sha256 = fileSha256;
    }
    if (!file.immutable_locked_at) {
      patch.immutable_locked_at = lockedAt;
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("asset_files").update(patch).eq("id", file.id);
      if (error) {
        throw new Error(error.message);
      }
    }

    return {
      assetFileId: file.id,
      fileRole: file.file_role ?? "primary",
      sortOrder: file.sort_order ?? 0,
      storagePath: immutableStoragePath,
      originalName: file.original_name,
      fileType: file.file_type,
      fileSize: file.file_size,
      fileSha256,
      lockedAt
    };
  }

  const immutableStoragePath = file.immutable_storage_path || buildImmutableStoragePath(file);

  if (!file.immutable_storage_path) {
    const { error: copyError } = await supabase.storage.from("assets").copy(file.storage_path, immutableStoragePath);
    if (copyError && !isAlreadyExistsError(copyError.message)) {
      throw new Error(copyError.message);
    }
  }

  let fileSha256 = file.file_sha256;
  if (!fileSha256) {
    const { data: blob, error: downloadError } = await supabase.storage.from("assets").download(immutableStoragePath);
    if (downloadError || !blob) {
      throw new Error(downloadError?.message ?? "Unable to read immutable delivery file");
    }
    fileSha256 = await computeBlobSha256(blob);
  }

  const lockedAt = file.immutable_locked_at || new Date().toISOString();
  const patch: Record<string, string> = {};

  if (file.immutable_storage_path !== immutableStoragePath) {
    patch.immutable_storage_path = immutableStoragePath;
  }
  if (file.file_sha256 !== fileSha256) {
    patch.file_sha256 = fileSha256;
  }
  if (!file.immutable_locked_at) {
    patch.immutable_locked_at = lockedAt;
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("asset_files").update(patch).eq("id", file.id);
    if (error) {
      throw new Error(error.message);
    }
  }

  return {
    assetFileId: file.id,
    fileRole: file.file_role ?? "primary",
    sortOrder: file.sort_order ?? 0,
    storagePath: immutableStoragePath,
    originalName: file.original_name,
    fileType: file.file_type,
    fileSize: file.file_size,
    fileSha256,
    lockedAt
  };
}

async function ensureOrderDeliveryFileRows(
  supabase: ServiceClient,
  orderId: string,
  assetId: string
): Promise<OrderDeliveryFileRow[]> {
  const [{ data: assetFilesData, error: assetFilesError }, { data: existingRowsData, error: existingRowsError }] = await Promise.all([
    supabase
      .from("asset_files")
      .select(
        "id, asset_id, storage_path, original_name, file_type, file_size, immutable_storage_path, file_sha256, immutable_locked_at, file_role, sort_order"
      )
      .eq("asset_id", assetId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("order_delivery_files")
      .select("id, order_id, asset_file_id, file_role, sort_order, storage_path, original_name, file_type, file_size, file_sha256, locked_at")
      .eq("order_id", orderId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
  ]);

  if (assetFilesError) {
    throw new Error(assetFilesError.message);
  }
  if (existingRowsError) {
    throw new Error(existingRowsError.message);
  }

  const assetFiles = (assetFilesData ?? []) as AssetFileRow[];
  const deliverableAssetFiles = getDeliverableAssetFiles(assetFiles);
  if (deliverableAssetFiles.length === 0) {
    throw new Error("Asset file not found");
  }

  const existingRows = (existingRowsData ?? []) as OrderDeliveryFileRow[];
  const deliverableAssetFileIds = new Set(deliverableAssetFiles.map((file) => file.id));
  const existingByAssetFileId = new Map(
    existingRows
      .filter((row) => row.asset_file_id && deliverableAssetFileIds.has(row.asset_file_id))
      .map((row) => [row.asset_file_id as string, row])
  );
  const upsertRows: Array<{
    order_id: string;
    asset_file_id: string;
    file_role: AssetFileRole;
    sort_order: number;
    storage_path: string;
    original_name: string;
    file_type: string;
    file_size: number;
    file_sha256: string;
    locked_at: string;
  }> = [];

  const staleRowIds = existingRows
    .filter((row) => !row.asset_file_id || !deliverableAssetFileIds.has(row.asset_file_id))
    .map((row) => row.id);

  if (staleRowIds.length > 0) {
    const { error: deleteError } = await supabase.from("order_delivery_files").delete().in("id", staleRowIds);
    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  for (const assetFile of sortDeliveryFiles(deliverableAssetFiles)) {
    const immutableFile = await ensureImmutableAssetFile(supabase, assetFile);
    const existing = existingByAssetFileId.get(assetFile.id);

    if (
      !existing ||
      existing.storage_path !== immutableFile.storagePath ||
      existing.original_name !== immutableFile.originalName ||
      existing.file_type !== immutableFile.fileType ||
      existing.file_size !== immutableFile.fileSize ||
      existing.file_sha256 !== immutableFile.fileSha256 ||
      existing.locked_at !== immutableFile.lockedAt ||
      existing.file_role !== immutableFile.fileRole ||
      (existing.sort_order ?? 0) !== immutableFile.sortOrder
    ) {
      upsertRows.push({
        order_id: orderId,
        asset_file_id: immutableFile.assetFileId,
        file_role: immutableFile.fileRole,
        sort_order: immutableFile.sortOrder,
        storage_path: immutableFile.storagePath,
        original_name: immutableFile.originalName,
        file_type: immutableFile.fileType,
        file_size: immutableFile.fileSize,
        file_sha256: immutableFile.fileSha256,
        locked_at: immutableFile.lockedAt
      });
    }
  }

  if (upsertRows.length > 0) {
    const { error: upsertError } = await supabase.from("order_delivery_files").upsert(upsertRows, {
      onConflict: "order_id,asset_file_id"
    });
    if (upsertError) {
      throw new Error(upsertError.message);
    }
  }

  const { data: finalRowsData, error: finalRowsError } = await supabase
    .from("order_delivery_files")
    .select("id, order_id, asset_file_id, file_role, sort_order, storage_path, original_name, file_type, file_size, file_sha256, locked_at")
    .eq("order_id", orderId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (finalRowsError) {
    throw new Error(finalRowsError.message);
  }

  return sortDeliveryFiles((finalRowsData ?? []) as OrderDeliveryFileRow[]);
}

function buildFileActionLabel(file: OrderDeliveryFileRow, fileCount: number) {
  if (file.file_role === "source_zip") {
    return "Download ZIP bundle";
  }
  if (file.file_role === "source_wav") {
    return "Download WAV file";
  }
  if (file.file_role === "audio_preview") {
    return "Download audio preview";
  }
  if (file.file_role === "project_file") {
    return "Download project file";
  }
  if (file.file_role === "midi") {
    return "Download MIDI file";
  }
  return fileCount > 1 ? "Download file" : "Download file";
}

export async function ensureOrderDeliveryFiles(supabase: ServiceClient, orderId: string): Promise<OrderDeliveryFileRow[]> {
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select("id, asset_id")
    .eq("id", orderId)
    .single();

  if (orderError || !orderData) {
    throw new Error(orderError?.message ?? "Order not found");
  }

  return ensureOrderDeliveryFileRows(supabase, orderData.id, orderData.asset_id);
}

export async function ensureOrderDeliverySnapshot(
  supabase: ServiceClient,
  orderId: string
): Promise<FileDeliverySnapshot | ExternalLinkDeliverySnapshot> {
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select(
      `id,
      asset_id,
      delivery_mode,
      delivery_external_url,
      delivery_storage_path,
      delivery_original_name,
      delivery_file_type,
      delivery_file_size,
      delivery_file_sha256,
      delivery_locked_at,
      asset:assets!inner(title, category, delivery_mode, external_delivery_url)`
    )
    .eq("id", orderId)
    .single();

  if (orderError || !orderData) {
    throw new Error(orderError?.message ?? "Order not found");
  }

  const order = orderData as OrderSnapshotRow;
  const asset = normalizeJoinedRecord(order.asset);
  const deliveryMode = inferDeliveryMode(order, asset);

  if (deliveryMode === "external_link") {
    const deliveryUrl = normalizeUrl(order.delivery_external_url) ?? normalizeUrl(asset?.external_delivery_url);
    if (!deliveryUrl) {
      throw new Error("Template access link is missing for this order");
    }

    const lockedAt = order.delivery_locked_at ?? new Date().toISOString();
    const originalName = order.delivery_original_name ?? buildExternalDeliveryName(asset?.title, deliveryUrl);
    const fileType = order.delivery_file_type ?? "external_link";
    const fileSize = order.delivery_file_size ?? 0;
    const orderPatch: Record<string, string | number | null> = {};

    if (order.delivery_mode !== "external_link") {
      orderPatch.delivery_mode = "external_link";
    }
    if (order.delivery_external_url !== deliveryUrl) {
      orderPatch.delivery_external_url = deliveryUrl;
    }
    if (order.delivery_original_name !== originalName) {
      orderPatch.delivery_original_name = originalName;
    }
    if (order.delivery_file_type !== fileType) {
      orderPatch.delivery_file_type = fileType;
    }
    if (order.delivery_file_size !== fileSize) {
      orderPatch.delivery_file_size = fileSize;
    }
    if (order.delivery_storage_path !== null) {
      orderPatch.delivery_storage_path = null;
    }
    if (order.delivery_file_sha256 !== null) {
      orderPatch.delivery_file_sha256 = null;
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
      deliveryType: "external_link",
      url: deliveryUrl,
      originalName,
      fileType,
      fileSize,
      fileSha256: null,
      lockedAt,
      actionLabel: buildExternalActionLabel(deliveryUrl)
    };
  }

  const deliveryFiles = await ensureOrderDeliveryFileRows(supabase, order.id, order.asset_id);
  const primaryFile = deliveryFiles[0];

  if (!primaryFile) {
    throw new Error("Asset file not found");
  }

  const orderPatch: Record<string, string | number | null> = {};
  if (order.delivery_mode !== "file") {
    orderPatch.delivery_mode = "file";
  }
  if (order.delivery_external_url !== null) {
    orderPatch.delivery_external_url = null;
  }
  if (order.delivery_storage_path !== primaryFile.storage_path) {
    orderPatch.delivery_storage_path = primaryFile.storage_path;
  }
  if (order.delivery_original_name !== primaryFile.original_name) {
    orderPatch.delivery_original_name = primaryFile.original_name;
  }
  if (order.delivery_file_type !== primaryFile.file_type) {
    orderPatch.delivery_file_type = primaryFile.file_type;
  }
  if (order.delivery_file_size !== primaryFile.file_size) {
    orderPatch.delivery_file_size = primaryFile.file_size;
  }
  if (order.delivery_file_sha256 !== primaryFile.file_sha256) {
    orderPatch.delivery_file_sha256 = primaryFile.file_sha256;
  }
  if (order.delivery_locked_at !== primaryFile.locked_at) {
    orderPatch.delivery_locked_at = primaryFile.locked_at;
  }

  if (Object.keys(orderPatch).length > 0) {
    const { error: orderUpdateError } = await supabase.from("orders").update(orderPatch).eq("id", order.id);
    if (orderUpdateError) {
      throw new Error(orderUpdateError.message);
    }
  }

  return {
    deliveryType: "file",
    storagePath: primaryFile.storage_path,
    originalName: primaryFile.original_name,
    fileType: primaryFile.file_type,
    fileSize: primaryFile.file_size,
    fileSha256: primaryFile.file_sha256,
    lockedAt: primaryFile.locked_at,
    actionLabel: buildFileActionLabel(primaryFile, deliveryFiles.length)
  };
}
