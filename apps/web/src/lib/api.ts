import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { slugify } from "@/lib/format";
import {
  formatFileSize,
  looksLikeUploadSizeError,
  MAX_PROFILE_AVATAR_SIZE_BYTES,
  MAX_PREVIEW_FILE_SIZE_BYTES,
  MAX_PRIMARY_ASSET_SIZE_BYTES
} from "@/lib/uploadLimits";
import { supabase } from "@/lib/supabaseClient";
import type { Asset, CreatorDashboard, CreatorDirectoryEntry, Order, PayoutAccount, PayoutBank, Profile } from "@/lib/types";
import type { EditorialPost, EditorialSection } from "@/lib/editorial";
import type { UploadAssetInput, ProfileInput } from "@/lib/validators/asset";

export type MarketFilters = {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  fileType?: string;
};

export type CreatorDirectoryFilters = {
  search?: string;
  category?: string;
  sort?: "trending" | "newest";
};

type AssetProfileRow = {
  display_name: string;
  avatar_url: string | null;
  niche: string | null;
  creator_category: string | null;
  sales_count: number | null;
  is_verified: boolean | null;
};

const PROFILE_FIELDS_SELECT = "display_name, avatar_url, niche, creator_category, sales_count, is_verified";

type AssetRow = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price_kobo: number;
  currency: string;
  status: "draft" | "published" | "archived";
  created_at: string;
  profile?: AssetProfileRow | AssetProfileRow[] | null;
  previews?: Array<{ id: string; preview_url: string }>;
  files?: Array<{ id: string; file_type: string; file_size: number; original_name: string }>;
};

type OrderRow = {
  id: string;
  email: string;
  email_token: string;
  status: "pending" | "paid" | "failed" | "refunded";
  amount_kobo: number;
  currency: string;
  created_at: string;
  asset?:
    | {
        id: string;
        title: string;
        category: string;
        previews?: Array<{ id: string; preview_url: string }>;
      }
    | Array<{
        id: string;
        title: string;
        category: string;
        previews?: Array<{ id: string; preview_url: string }>;
      }>;
};

type CreatorProfileRow = {
  id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  creator_category: string | null;
  niche: string | null;
  sales_count: number | null;
  is_verified: boolean | null;
  created_at: string;
};

type CreatorAssetStatRow = {
  creator_id: string;
  created_at: string;
};

type PayoutSetupResponse = {
  country: string;
  account: PayoutAccount | null;
  banks: PayoutBank[];
  mobile_money_providers: PayoutBank[];
};

type EditorialSectionRow = {
  heading?: unknown;
  paragraphs?: unknown;
  points?: unknown;
};

type EditorialPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: EditorialPost["category"];
  published_at: string;
  read_time_minutes: number;
  cover_image: string;
  spotlight: boolean | null;
  tags: string[] | null;
  author_name: string;
  author_role: string;
  sections: unknown;
  created_at?: string;
  updated_at?: string;
};

export type CreateEditorialPostInput = {
  title: string;
  excerpt: string;
  category: EditorialPost["category"];
  publishedAt?: string;
  readTimeMinutes: number;
  coverImage: string;
  spotlight?: boolean;
  tags: string[];
  authorName: string;
  authorRole: string;
  sections: EditorialSection[];
};

export type UpdateEditorialPostInput = {
  title: string;
  excerpt: string;
  category: EditorialPost["category"];
  publishedAt?: string;
  readTimeMinutes: number;
  coverImage: string;
  spotlight?: boolean;
  tags: string[];
  authorName: string;
  authorRole: string;
  sections: EditorialSection[];
};

function mapAsset(row: AssetRow): Asset {
  const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;

  return {
    id: row.id,
    creator_id: row.creator_id,
    title: row.title,
    description: row.description,
    category: row.category,
    tags: row.tags ?? [],
    price_kobo: row.price_kobo,
    currency: row.currency,
    status: row.status,
    created_at: row.created_at,
    profile: profile
      ? {
          ...profile,
          creator_category: profile.creator_category ?? "General",
          sales_count: profile.sales_count ?? 0,
          is_verified: Boolean(profile.is_verified)
        }
      : null,
    previews: row.previews ?? [],
    files: row.files ?? []
  };
}

function mapOrder(row: OrderRow): Order {
  const asset = Array.isArray(row.asset) ? row.asset[0] : row.asset;

  return {
    id: row.id,
    email: row.email,
    email_token: row.email_token,
    status: row.status,
    amount_kobo: row.amount_kobo,
    currency: row.currency,
    created_at: row.created_at,
    asset: asset
      ? {
          id: asset.id,
          title: asset.title,
          category: asset.category,
          previews: asset.previews ?? []
        }
      : undefined
  };
}

function normalizeEditorialSections(value: unknown): EditorialSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const row = (item ?? {}) as EditorialSectionRow;
      const heading = typeof row.heading === "string" ? row.heading.trim() : "";
      const paragraphs = Array.isArray(row.paragraphs)
        ? row.paragraphs.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean)
        : [];
      const points = Array.isArray(row.points)
        ? row.points.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean)
        : undefined;

      if (!heading || paragraphs.length === 0) {
        return null;
      }

      return {
        heading,
        paragraphs,
        points: points && points.length > 0 ? points : undefined
      } as EditorialSection;
    })
    .filter((section): section is EditorialSection => section !== null);
}

function mapEditorialPost(row: EditorialPostRow): EditorialPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    published_at: row.published_at,
    read_time_minutes: row.read_time_minutes,
    cover_image: row.cover_image,
    spotlight: Boolean(row.spotlight),
    tags: row.tags ?? [],
    author: {
      name: row.author_name,
      role: row.author_role
    },
    sections: normalizeEditorialSections(row.sections),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function parseErrorResponse(text: string): string {
  if (!text) {
    return "Unknown error";
  }

  try {
    const json = JSON.parse(text) as { error?: string; details?: string; message?: string };
    return json.error ?? json.message ?? json.details ?? text;
  } catch {
    return text;
  }
}

function buildApiError(responseStatus: number, text: string) {
  let message = "Unknown error";
  let code: string | undefined;
  let payload: Record<string, unknown> | undefined;

  if (text) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
      message = String(payload.error ?? payload.message ?? payload.details ?? text);
      code = typeof payload.code === "string" ? payload.code : undefined;
    } catch {
      message = text;
    }
  }

  const error = new Error(message) as Error & {
    code?: string;
    status?: number;
    payload?: Record<string, unknown>;
  };
  error.code = code;
  error.status = responseStatus;
  error.payload = payload;

  return error;
}

function mapStorageUploadError(
  error: unknown,
  context: {
    fileName: string;
    maxBytes: number;
  }
): Error {
  const message = error instanceof Error ? error.message : String(error ?? "Upload failed");

  if (looksLikeUploadSizeError(message)) {
    return new Error(
      `Upload failed: "${context.fileName}" exceeded the upload limit (${formatFileSize(context.maxBytes)}).`
    );
  }

  if (message.toLowerCase().includes("failed to fetch")) {
    return new Error(
      `Upload failed while sending "${context.fileName}". This can happen with unstable network or when file size exceeds provider limits.`
    );
  }

  return error instanceof Error ? error : new Error(message);
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, bio, avatar_url, creator_category, niche, sales_count, is_verified, socials")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Profile | null;
}

export async function updateProfile(userId: string, input: ProfileInput) {
  const socials = {
    website: input.website ?? "",
    instagram: input.instagram ?? "",
    x: input.x ?? ""
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        display_name: input.display_name,
        bio: input.bio,
        creator_category: input.creator_category,
        niche: input.niche ?? "",
        socials
      },
      { onConflict: "id" }
    )
    .select("id, display_name, bio, avatar_url, creator_category, niche, sales_count, is_verified, socials")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Profile;
}

export async function uploadProfileAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Profile photo must be an image file.");
  }

  if (file.size > MAX_PROFILE_AVATAR_SIZE_BYTES) {
    throw new Error(`Profile photo must be ${formatFileSize(MAX_PROFILE_AVATAR_SIZE_BYTES)} or smaller.`);
  }

  const avatarPath = `${userId}/avatar`;

  const { error: uploadError } = await supabase.storage.from("previews").upload(avatarPath, file, {
    upsert: true,
    contentType: file.type || "image/jpeg"
  });

  if (uploadError) {
    throw mapStorageUploadError(uploadError, {
      fileName: file.name,
      maxBytes: MAX_PROFILE_AVATAR_SIZE_BYTES
    });
  }

  const { data: publicUrlData } = supabase.storage.from("previews").getPublicUrl(avatarPath);
  const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId)
    .select("avatar_url")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update profile photo.");
  }

  return data.avatar_url as string;
}

type UpsertPayoutAccountInput = {
  country?: string;
  payout_type: "bank" | "mobile_money";
  business_name: string;
  settlement_bank_code: string;
  settlement_bank_name?: string;
  account_number: string;
};

export async function getPayoutAccountSetup(country?: string): Promise<PayoutSetupResponse> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("You must be signed in to manage payouts.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`
  };

  const endpoint = new URL(`${env.VITE_SUPABASE_URL}/functions/v1/manage-payout-account`);
  if (country) {
    endpoint.searchParams.set("country", country);
  }

  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers
  });

  if (!response.ok) {
    const text = await response.text();
    throw buildApiError(response.status, text);
  }

  const payload = (await response.json()) as {
    country?: string;
    account?: PayoutAccount | null;
    banks?: PayoutBank[];
    mobile_money_providers?: PayoutBank[];
  };

  return {
    country: payload.country ?? country ?? "ghana",
    account: payload.account ?? null,
    banks: payload.banks ?? [],
    mobile_money_providers: payload.mobile_money_providers ?? []
  };
}

export async function upsertPayoutAccount(input: UpsertPayoutAccountInput): Promise<PayoutAccount> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("You must be signed in to manage payouts.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`
  };

  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/manage-payout-account`, {
    method: "POST",
    headers,
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const text = await response.text();
    throw buildApiError(response.status, text);
  }

  const payload = (await response.json()) as {
    ok?: boolean;
    account?: PayoutAccount;
  };

  if (!payload.account) {
    throw new Error("Payout account was not returned by server.");
  }

  return payload.account;
}

function toTimestamp(value: string | null) {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function trendingScore(entry: Pick<CreatorDirectoryEntry, "sales_count" | "published_assets" | "latest_asset_at" | "is_verified">) {
  const now = Date.now();
  const latest = toTimestamp(entry.latest_asset_at);
  const daysSinceLatest = latest > 0 ? Math.floor((now - latest) / (1000 * 60 * 60 * 24)) : 9999;
  const recencyBoost = daysSinceLatest <= 30 ? 4 : daysSinceLatest <= 90 ? 2 : 0;
  const verificationBoost = entry.is_verified ? 3 : 0;
  return entry.sales_count * 5 + entry.published_assets * 2 + recencyBoost + verificationBoost;
}

export async function getCreatorDirectory(filters: CreatorDirectoryFilters = {}): Promise<CreatorDirectoryEntry[]> {
  const [{ data: profilesData, error: profilesError }, { data: assetsData, error: assetsError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, bio, avatar_url, creator_category, niche, sales_count, is_verified, created_at"),
    supabase.from("assets").select("creator_id, created_at").eq("status", "published")
  ]);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  if (assetsError) {
    throw new Error(assetsError.message);
  }

  const profileRows = (profilesData ?? []) as CreatorProfileRow[];
  const assetRows = (assetsData ?? []) as CreatorAssetStatRow[];
  const creatorStats = new Map<string, { published_assets: number; latest_asset_at: string | null }>();

  for (const row of assetRows) {
    const current = creatorStats.get(row.creator_id) ?? { published_assets: 0, latest_asset_at: null };
    const currentLatest = toTimestamp(current.latest_asset_at);
    const rowCreatedAt = toTimestamp(row.created_at);

    creatorStats.set(row.creator_id, {
      published_assets: current.published_assets + 1,
      latest_asset_at: rowCreatedAt > currentLatest ? row.created_at : current.latest_asset_at
    });
  }

  const baseCreators = profileRows
    .map((profile) => {
      const stats = creatorStats.get(profile.id) ?? { published_assets: 0, latest_asset_at: null };

      return {
        id: profile.id,
        display_name: profile.display_name?.trim() || "Creator",
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        creator_category: profile.creator_category?.trim() || "General",
        niche: profile.niche,
        sales_count: profile.sales_count ?? 0,
        is_verified: Boolean(profile.is_verified),
        created_at: profile.created_at,
        published_assets: stats.published_assets,
        latest_asset_at: stats.latest_asset_at,
        trending_score: 0,
        editor_pick: false
      } as CreatorDirectoryEntry;
    })
    .filter((creator) => creator.published_assets > 0);

  const withTrending = baseCreators.map((creator) => ({
    ...creator,
    trending_score: trendingScore(creator)
  }));

  const editorPickIds = new Set(
    [...withTrending]
      .sort((a, b) => b.trending_score - a.trending_score || b.sales_count - a.sales_count)
      .slice(0, 6)
      .map((creator) => creator.id)
  );

  let creators = withTrending.map((creator) => ({
    ...creator,
    editor_pick: editorPickIds.has(creator.id)
  }));

  const normalizedSearch = filters.search?.trim().toLowerCase() ?? "";
  if (normalizedSearch) {
    creators = creators.filter((creator) =>
      [
        creator.display_name,
        creator.bio ?? "",
        creator.niche ?? "",
        creator.creator_category
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }

  if (filters.category && filters.category !== "all") {
    creators = creators.filter((creator) => creator.creator_category === filters.category);
  }

  const sort = filters.sort ?? "trending";
  creators.sort((a, b) => {
    if (sort === "newest") {
      return toTimestamp(b.created_at) - toTimestamp(a.created_at) || b.trending_score - a.trending_score;
    }
    return (
      b.trending_score - a.trending_score ||
      b.sales_count - a.sales_count ||
      toTimestamp(b.latest_asset_at) - toTimestamp(a.latest_asset_at)
    );
  });

  return creators;
}

export async function getPublishedAssets(filters: MarketFilters = {}): Promise<Asset[]> {
  const { data, error } = await supabase
    .from("assets")
    .select(
      `id,
      creator_id,
      title,
      description,
      category,
      tags,
      price_kobo,
      currency,
      status,
      created_at,
      profile:profiles!assets_creator_id_fkey(${PROFILE_FIELDS_SELECT}),
      previews:asset_previews(id, preview_url),
      files:asset_files(id, file_type, file_size, original_name)`
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const all = (data as AssetRow[]).map(mapAsset);

  return all.filter((asset) => {
    const normalizedSearch = filters.search?.trim().toLowerCase() ?? "";
    const searchableText = [
      asset.title,
      asset.description,
      asset.category,
      asset.tags.join(" "),
      asset.profile?.display_name ?? "",
      asset.profile?.niche ?? "",
      asset.profile?.creator_category ?? ""
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = normalizedSearch.length === 0 ? true : searchableText.includes(normalizedSearch);

    const matchesCategory = !filters.category || filters.category === "all" ? true : asset.category === filters.category;

    const matchesMin = typeof filters.minPrice === "number" ? asset.price_kobo >= Math.round(filters.minPrice * 100) : true;
    const matchesMax = typeof filters.maxPrice === "number" ? asset.price_kobo <= Math.round(filters.maxPrice * 100) : true;

    const firstFileType = asset.files?.[0]?.file_type ?? "";
    const matchesFileType = !filters.fileType || filters.fileType === "all" ? true : firstFileType.includes(filters.fileType);

    return matchesSearch && matchesCategory && matchesMin && matchesMax && matchesFileType;
  });
}

export async function getAssetById(assetId: string): Promise<Asset> {
  const { data, error } = await supabase
    .from("assets")
    .select(
      `id,
      creator_id,
      title,
      description,
      category,
      tags,
      price_kobo,
      currency,
      status,
      created_at,
      profile:profiles!assets_creator_id_fkey(${PROFILE_FIELDS_SELECT}),
      previews:asset_previews(id, preview_url),
      files:asset_files(id, file_type, file_size, original_name)`
    )
    .eq("id", assetId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Asset not found");
  }

  return mapAsset(data as AssetRow);
}

export async function getCreatorAssets(userId: string): Promise<Asset[]> {
  const { data, error } = await supabase
    .from("assets")
    .select(
      `id,
      creator_id,
      title,
      description,
      category,
      tags,
      price_kobo,
      currency,
      status,
      created_at,
      profile:profiles!assets_creator_id_fkey(${PROFILE_FIELDS_SELECT}),
      previews:asset_previews(id, preview_url),
      files:asset_files(id, file_type, file_size, original_name)`
    )
    .eq("creator_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as AssetRow[]).map(mapAsset);
}

export async function createAssetListing(
  userId: string,
  input: UploadAssetInput,
  mainFile: File,
  previewFiles: File[]
): Promise<{ assetId: string }> {
  const tags = input.tags
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .insert({
      creator_id: userId,
      title: input.title,
      description: input.description,
      category: input.category,
      tags,
      price_kobo: Math.round(input.price * 100),
      currency: input.currency.toUpperCase(),
      status: input.status
    })
    .select("id")
    .single();

  if (assetError || !asset) {
    throw new Error(assetError?.message ?? "Unable to create asset record");
  }

  const uploadedPaths: Array<{ bucket: "assets" | "previews"; path: string }> = [];

  try {
    const safeName = slugify(mainFile.name.replace(/\.[^.]+$/, ""));
    const mainPath = `${userId}/${asset.id}/${Date.now()}-${safeName}-${mainFile.name}`;

    const { error: uploadMainError } = await supabase.storage.from("assets").upload(mainPath, mainFile, {
      upsert: false,
      contentType: mainFile.type || "application/octet-stream"
    });

    if (uploadMainError) {
      throw mapStorageUploadError(uploadMainError, {
        fileName: mainFile.name,
        maxBytes: MAX_PRIMARY_ASSET_SIZE_BYTES
      });
    }

    uploadedPaths.push({ bucket: "assets", path: mainPath });

    const { error: fileRowError } = await supabase.from("asset_files").insert({
      asset_id: asset.id,
      storage_path: mainPath,
      file_type: mainFile.type || "application/octet-stream",
      file_size: mainFile.size,
      original_name: mainFile.name
    });

    if (fileRowError) {
      throw new Error(fileRowError.message);
    }

    if (previewFiles.length > 0) {
      const previewRows: Array<{ asset_id: string; preview_url: string }> = [];

      for (let index = 0; index < previewFiles.length; index += 1) {
        const preview = previewFiles[index];
        const previewPath = `${userId}/${asset.id}/preview-${index}-${Date.now()}-${preview.name}`;

        const { error: uploadPreviewError } = await supabase.storage.from("previews").upload(previewPath, preview, {
          upsert: false,
          contentType: preview.type || "image/jpeg"
        });

        if (uploadPreviewError) {
          throw mapStorageUploadError(uploadPreviewError, {
            fileName: preview.name,
            maxBytes: MAX_PREVIEW_FILE_SIZE_BYTES
          });
        }

        uploadedPaths.push({ bucket: "previews", path: previewPath });

        const { data: publicUrlData } = supabase.storage.from("previews").getPublicUrl(previewPath);
        previewRows.push({
          asset_id: asset.id,
          preview_url: publicUrlData.publicUrl
        });
      }

      const { error: previewInsertError } = await supabase.from("asset_previews").insert(previewRows);
      if (previewInsertError) {
        throw new Error(previewInsertError.message);
      }
    }

    return { assetId: asset.id };
  } catch (error) {
    await Promise.all(
      uploadedPaths.map((uploaded) => supabase.storage.from(uploaded.bucket).remove([uploaded.path]))
    );

    await supabase.from("assets").delete().eq("id", asset.id);

    throw mapStorageUploadError(error, {
      fileName: mainFile.name,
      maxBytes: MAX_PRIMARY_ASSET_SIZE_BYTES
    });
  }
}

export async function createPayment(assetId: string, email?: string) {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: env.VITE_SUPABASE_ANON_KEY
  };

  if (data.session?.access_token) {
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/create-payment`, {
    method: "POST",
    headers,
    body: JSON.stringify({ asset_id: assetId, email })
  });

  if (!response.ok) {
    const text = await response.text();
    throw buildApiError(response.status, text);
  }

  const payload = (await response.json()) as {
    order_id: string;
    order_token?: string;
    reference: string;
    email?: string;
    amount_kobo?: number;
    currency?: string;
    authorization_url: string;
    access_code?: string;
    public_key?: string;
  };

  return payload;
}

export async function generateDownload(orderId: string, emailToken?: string) {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: env.VITE_SUPABASE_ANON_KEY
  };

  if (data.session?.access_token) {
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/generate-download`, {
    method: "POST",
    headers,
    body: JSON.stringify({ order_id: orderId, email_token: emailToken })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseErrorResponse(text));
  }

  return (await response.json()) as {
    url: string;
    expires_in: number;
    filename: string;
  };
}

export async function verifyPayment(reference: string, emailToken?: string) {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: env.VITE_SUPABASE_ANON_KEY
  };

  if (data.session?.access_token) {
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/verify-payment`, {
    method: "POST",
    headers,
    body: JSON.stringify({ reference, email_token: emailToken })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseErrorResponse(text));
  }

  return (await response.json()) as {
    ok: boolean;
    order_status: "pending" | "paid" | "failed" | "refunded";
    payment_status: "pending" | "paid" | "failed" | "refunded";
    credited?: boolean;
    net_payout?: number;
    commission?: number;
  };
}

export async function getBuyerOrders(options: {
  userId?: string;
  emailToken?: string;
}): Promise<Order[]> {
  if (!options.userId && !options.emailToken) {
    return [];
  }

  const client = options.emailToken && !options.userId
    ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
        global: {
          headers: {
            "x-order-token": options.emailToken
          }
        }
      })
    : supabase;

  let query = client
    .from("orders")
    .select(
      `id,
      email,
      email_token,
      status,
      amount_kobo,
      currency,
      created_at,
      asset:assets(id, title, category, previews:asset_previews(id, preview_url))`
    )
    .order("created_at", { ascending: false });

  if (options.userId) {
    query = query.eq("buyer_id", options.userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as OrderRow[]).map(mapOrder);
}

export async function hasPaidOrderForAsset(assetId: string, userId: string, userEmail?: string | null): Promise<boolean> {
  let query = supabase
    .from("orders")
    .select("id")
    .eq("asset_id", assetId)
    .eq("status", "paid")
    .limit(1);

  if (userEmail) {
    query = query.or(`buyer_id.eq.${userId},email.eq.${userEmail}`);
  } else {
    query = query.eq("buyer_id", userId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function getCreatorDashboard(userId: string): Promise<CreatorDashboard> {
  const [{ count, error: countError }, { data: ordersData, error: ordersError }, { data: walletData, error: walletError }] =
    await Promise.all([
      supabase.from("assets").select("id", { count: "exact", head: true }).eq("creator_id", userId),
      supabase
        .from("orders")
        .select(
          `id,
          email,
          email_token,
          status,
          amount_kobo,
          currency,
          created_at,
          asset:assets!inner(id, title, category, creator_id, previews:asset_previews(id, preview_url))`
        )
        .eq("assets.creator_id", userId)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase.from("wallet").select("balance_kobo").eq("creator_id", userId).maybeSingle()
    ]);

  if (countError) {
    throw new Error(countError.message);
  }

  if (ordersError) {
    throw new Error(ordersError.message);
  }

  if (walletError) {
    throw new Error(walletError.message);
  }

  const recentOrders = ((ordersData ?? []) as OrderRow[]).map(mapOrder);
  const paidOrders = recentOrders.filter((order) => order.status === "paid");
  const totalRevenueKobo = paidOrders.reduce((total, order) => total + order.amount_kobo, 0);

  return {
    assetCount: count ?? 0,
    paidOrders: paidOrders.length,
    totalRevenueKobo,
    walletBalanceKobo: walletData?.balance_kobo ?? 0,
    recentOrders
  };
}

export async function getEditorialPostsFromDb(): Promise<EditorialPost[]> {
  const { data, error } = await supabase
    .from("editorial_posts")
    .select(
      "id, slug, title, excerpt, category, published_at, read_time_minutes, cover_image, spotlight, tags, author_name, author_role, sections, created_at, updated_at"
    )
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as EditorialPostRow[]).map(mapEditorialPost);
}

export async function createEditorialPost(userId: string, input: CreateEditorialPostInput): Promise<EditorialPost> {
  const baseSlug = slugify(input.title);
  const safeSlug = baseSlug || `editorial-${Date.now()}`;

  if (!Number.isFinite(input.readTimeMinutes) || input.readTimeMinutes <= 0) {
    throw new Error("Read time must be a positive number.");
  }

  const normalizedSections = input.sections
    .map((section) => ({
      heading: section.heading.trim(),
      paragraphs: section.paragraphs.map((paragraph) => paragraph.trim()).filter(Boolean),
      points: section.points?.map((point) => point.trim()).filter(Boolean) ?? []
    }))
    .filter((section) => section.heading && section.paragraphs.length > 0)
    .map((section) => ({
      heading: section.heading,
      paragraphs: section.paragraphs,
      ...(section.points.length > 0 ? { points: section.points } : {})
    }));

  if (normalizedSections.length === 0) {
    throw new Error("At least one valid section is required.");
  }

  const normalizedTags = Array.from(
    new Set(
      input.tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  let attempt = 0;
  let slug = safeSlug;

  while (attempt < 3) {
    const { data, error } = await supabase
      .from("editorial_posts")
      .insert({
        slug,
        title: input.title.trim(),
        excerpt: input.excerpt.trim(),
        category: input.category,
        published_at: input.publishedAt ?? new Date().toISOString(),
        read_time_minutes: input.readTimeMinutes,
        cover_image: input.coverImage.trim(),
        spotlight: Boolean(input.spotlight),
        tags: normalizedTags,
        author_name: input.authorName.trim(),
        author_role: input.authorRole.trim(),
        sections: normalizedSections,
        created_by: userId
      })
      .select(
        "id, slug, title, excerpt, category, published_at, read_time_minutes, cover_image, spotlight, tags, author_name, author_role, sections, created_at, updated_at"
      )
      .single();

    if (!error && data) {
      return mapEditorialPost(data as EditorialPostRow);
    }

    if (error?.code === "23505") {
      attempt += 1;
      slug = `${safeSlug}-${Date.now().toString().slice(-5)}`;
      continue;
    }

    throw new Error(error?.message ?? "Failed to create editorial post");
  }

  throw new Error("Unable to generate a unique post slug. Try a different title.");
}

export async function updateEditorialPost(postId: string, input: UpdateEditorialPostInput): Promise<EditorialPost> {
  if (!postId) {
    throw new Error("Post ID is required.");
  }

  if (!Number.isFinite(input.readTimeMinutes) || input.readTimeMinutes <= 0) {
    throw new Error("Read time must be a positive number.");
  }

  const normalizedSections = input.sections
    .map((section) => ({
      heading: section.heading.trim(),
      paragraphs: section.paragraphs.map((paragraph) => paragraph.trim()).filter(Boolean),
      points: section.points?.map((point) => point.trim()).filter(Boolean) ?? []
    }))
    .filter((section) => section.heading && section.paragraphs.length > 0)
    .map((section) => ({
      heading: section.heading,
      paragraphs: section.paragraphs,
      ...(section.points.length > 0 ? { points: section.points } : {})
    }));

  if (normalizedSections.length === 0) {
    throw new Error("At least one valid section is required.");
  }

  const normalizedTags = Array.from(
    new Set(
      input.tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const payload: {
    title: string;
    excerpt: string;
    category: EditorialPost["category"];
    read_time_minutes: number;
    cover_image: string;
    spotlight: boolean;
    tags: string[];
    author_name: string;
    author_role: string;
    sections: Array<{
      heading: string;
      paragraphs: string[];
      points?: string[];
    }>;
    published_at?: string;
  } = {
    title: input.title.trim(),
    excerpt: input.excerpt.trim(),
    category: input.category,
    read_time_minutes: Math.round(input.readTimeMinutes),
    cover_image: input.coverImage.trim(),
    spotlight: Boolean(input.spotlight),
    tags: normalizedTags,
    author_name: input.authorName.trim(),
    author_role: input.authorRole.trim(),
    sections: normalizedSections
  };

  if (input.publishedAt) {
    payload.published_at = input.publishedAt;
  }

  const { data, error } = await supabase
    .from("editorial_posts")
    .update(payload)
    .eq("id", postId)
    .select(
      "id, slug, title, excerpt, category, published_at, read_time_minutes, cover_image, spotlight, tags, author_name, author_role, sections, created_at, updated_at"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update editorial post");
  }

  return mapEditorialPost(data as EditorialPostRow);
}

export async function deleteEditorialPost(postId: string): Promise<void> {
  if (!postId) {
    throw new Error("Post ID is required.");
  }

  const { error } = await supabase
    .from("editorial_posts")
    .delete()
    .eq("id", postId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function isCurrentUserAdmin(userId: string) {
  const { data, error } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function getAdminAssets() {
  const { data, error } = await supabase
    .from("assets")
    .select(
      `id,
      creator_id,
      title,
      description,
      category,
      tags,
      price_kobo,
      currency,
      status,
      created_at,
      profile:profiles!assets_creator_id_fkey(${PROFILE_FIELDS_SELECT}),
      previews:asset_previews(id, preview_url),
      files:asset_files(id, file_type, file_size, original_name)`
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as AssetRow[]).map(mapAsset);
}

export async function updateAssetStatus(assetId: string, status: "draft" | "published" | "archived") {
  const { data, error } = await supabase
    .from("assets")
    .update({ status })
    .eq("id", assetId)
    .select(
      `id,
      creator_id,
      title,
      description,
      category,
      tags,
      price_kobo,
      currency,
      status,
      created_at,
      profile:profiles!assets_creator_id_fkey(${PROFILE_FIELDS_SELECT}),
      previews:asset_previews(id, preview_url),
      files:asset_files(id, file_type, file_size, original_name)`
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to update asset status");
  }

  return mapAsset(data as AssetRow);
}
