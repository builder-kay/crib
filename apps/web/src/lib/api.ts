import { getUserContactEmail, looksLikeEmailIdentifier, normalizeAuthPhoneInput } from "@/lib/auth";
import { getAssetAppLabel, getAssetDeliveryLabel, getAssetFilterFileType, getAssetFormatLabel, getAssetPrimaryFilename } from "@/lib/assetCatalog";
import { env } from "@/lib/env";
import { slugify } from "@/lib/format";
import { DEFAULT_HIRE_TERMS } from "@/lib/hire";
import { sanitizeAppRedirectPath } from "@/lib/navigation";
import {
  normalizeAdminWhatsAppMessage,
  normalizeAdminWhatsAppNumber,
  normalizePlatformSocialHandle,
  normalizePlatformSupportEmail
} from "@/lib/platform";
import {
  MAX_AUDIO_BUNDLE_FILE_SIZE_BYTES,
  MAX_AUDIO_PREVIEW_FILE_SIZE_BYTES,
  formatFileSize,
  looksLikeUploadSizeError,
  MAX_PROFILE_AVATAR_SIZE_BYTES,
  MAX_PREVIEW_FILE_SIZE_BYTES,
  MAX_PRIMARY_ASSET_SIZE_BYTES
} from "@/lib/uploadLimits";
import { supabase } from "@/lib/supabaseClient";
import type {
  AccountNotification,
  AdminCreatorRecord,
  AdminOrderRecord,
  AdminOverview,
  Asset,
  AssetFileRole,
  AssetLicenseOption,
  AssetDeliveryMode,
  AssetPricingModel,
  AssetReview,
  CreatorDashboard,
  CreatorDirectoryEntry,
  CreatorFunnelSummary,
  CreatorVerificationRequest,
  CreatorVerificationStatus,
  HireRequestNotification,
  NotificationDeliveryStatus,
  CreatorReview,
  Order,
  OrderDeliveryFile,
  OrderReceipt,
  PayoutAccount,
  PayoutBank,
  PlatformSocialSettings,
  ProfileVerificationField,
  Profile,
  RatingSummary,
  ReleaseNotification
} from "@/lib/types";
import type { EditorialPost, EditorialSection } from "@/lib/editorial";
import type { UploadAssetInput, ProfileInput } from "@/lib/validators/asset";

export type MarketFilters = {
  search?: string;
  category?: string;
  creator?: string;
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
  seller_account_status?: string | null;
  seller_account_note?: string | null;
};

const PROFILE_FIELDS_SELECT = "display_name, avatar_url, niche, creator_category, sales_count, is_verified, seller_account_status, seller_account_note";
const PROFILE_SELECT =
  "id, display_name, bio, avatar_url, creator_category, niche, sales_count, is_verified, socials, seller_account_status, seller_account_note, hire_enabled, hire_terms";
const CREATOR_VERIFICATION_SELECT =
  "creator_id, status, is_profile_complete, missing_fields, submitted_at, reviewed_at, reviewed_by, review_note";

type AssetRow = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price_kobo: number;
  minimum_price_kobo?: number | null;
  currency: string;
  delivery_mode?: AssetDeliveryMode | null;
  external_delivery_url?: string | null;
  pricing_model?: AssetPricingModel | null;
  audio_preview_url?: string | null;
  audio_genre?: string | null;
  audio_bpm?: number | null;
  audio_key?: string | null;
  license_options?: AssetLicenseOption[] | null;
  status: "draft" | "published" | "archived";
  created_at: string;
  profile?: AssetProfileRow | AssetProfileRow[] | null;
  previews?: Array<{ id: string; preview_url: string }>;
  files?: Array<{ id: string; file_type: string; file_size: number; original_name: string; file_role?: AssetFileRole | null; sort_order?: number | null }>;
};

type AssetRatingRow = {
  asset_id: string;
  rating: number;
};

type AssetOrderCountRow = {
  asset_id: string;
  status: Order["status"];
};

type OrderRow = {
  id: string;
  email: string;
  status: "pending" | "paid" | "failed" | "refunded";
  amount_kobo: number;
  currency: string;
  created_at: string;
  paid_at?: string | null;
  commission_kobo?: number | null;
  seller_net_amount_kobo?: number | null;
  delivery_mode?: AssetDeliveryMode | null;
  delivery_external_url?: string | null;
  escrow_status?: Order["escrow_status"];
  escrow_due_at?: string | null;
  buyer_opened_at?: string | null;
  buyer_confirmed_at?: string | null;
  buyer_reported_at?: string | null;
  escrow_released_at?: string | null;
  escrow_release_reason?: string | null;
  scam_report_reason?: string | null;
  scam_resolution_status?: Order["scam_resolution_status"];
  scam_resolution_note?: string | null;
  seller_issue_note?: string | null;
  seller_moderation_action?: Order["seller_moderation_action"];
  refund_reference?: string | null;
  refund_provider_status?: string | null;
  asset?:
    | {
        id: string;
        title: string;
        category: string;
        delivery_mode?: AssetDeliveryMode | null;
        pricing_model?: AssetPricingModel | null;
        audio_preview_url?: string | null;
        audio_genre?: string | null;
        audio_bpm?: number | null;
        audio_key?: string | null;
        license_options?: AssetLicenseOption[] | null;
        previews?: Array<{ id: string; preview_url: string }>;
        files?: Array<{ id: string; file_type: string; file_size: number; original_name: string; file_role?: AssetFileRole | null; sort_order?: number | null }>;
      }
    | Array<{
        id: string;
        title: string;
        category: string;
        delivery_mode?: AssetDeliveryMode | null;
        pricing_model?: AssetPricingModel | null;
        audio_preview_url?: string | null;
        audio_genre?: string | null;
        audio_bpm?: number | null;
        audio_key?: string | null;
        license_options?: AssetLicenseOption[] | null;
        previews?: Array<{ id: string; preview_url: string }>;
        files?: Array<{ id: string; file_type: string; file_size: number; original_name: string; file_role?: AssetFileRole | null; sort_order?: number | null }>;
      }>;
  delivery_files?:
    | Array<{ id: string; file_type: string; file_size: number; original_name: string; file_role?: AssetFileRole | null; sort_order?: number | null }>
    | null;
};

type OrderReceiptRow = {
  id: string;
  order_id: string;
  receipt_number: string;
  buyer_id: string | null;
  seller_id: string;
  asset_id: string;
  buyer_email: string;
  seller_email: string | null;
  buyer_display_name: string | null;
  seller_display_name: string;
  asset_title: string;
  asset_category: string | null;
  payment_provider: string;
  payment_reference: string;
  amount_kobo: number;
  commission_kobo: number;
  seller_net_amount_kobo: number;
  currency: string;
  paid_at: string;
  created_at: string;
  updated_at: string;
};

type OrderReceiptStatusRow = {
  status: Order["status"];
  created_at: string;
  escrow_status: Order["escrow_status"];
  escrow_due_at: string | null;
  buyer_confirmed_at: string | null;
  buyer_reported_at: string | null;
  escrow_released_at: string | null;
  escrow_release_reason: string | null;
  refund_reference: string | null;
  refund_provider_status: string | null;
  scam_report_reason: string | null;
  scam_resolution_status: Order["scam_resolution_status"];
};

type ReceiptSellerProfileRow = {
  display_name?: string | null;
  avatar_url: string | null;
  creator_category: string | null;
  is_verified: boolean | null;
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
  seller_account_status?: string | null;
  seller_account_note?: string | null;
  hire_enabled?: boolean | null;
  hire_terms?: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  creator_category: string | null;
  niche: string | null;
  sales_count: number | null;
  is_verified: boolean | null;
  socials: Record<string, string> | null;
  seller_account_status?: string | null;
  seller_account_note?: string | null;
  hire_enabled?: boolean | null;
  hire_terms?: string | null;
};

type CreatorAssetStatRow = {
  creator_id: string;
  status: Asset["status"];
  created_at: string;
  previews?: Array<{ preview_url: string }>;
};

type CreatorReviewRatingRow = {
  creator_id: string;
  rating: number;
};

type CreatorFollowRow = {
  creator_id: string;
};

type PlatformSettingsRow = {
  singleton: boolean;
  instagram_handle: string | null;
  x_handle: string | null;
  tiktok_handle: string | null;
  linkedin_handle: string | null;
  facebook_handle: string | null;
  whatsapp_channel: string | null;
  support_email: string | null;
  admin_whatsapp_number: string | null;
  admin_whatsapp_message: string | null;
};

type AssetReviewRow = {
  id: string;
  asset_id: string;
  reviewer_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  updated_at: string;
  reviewer?: { id: string; display_name: string; avatar_url: string | null } | Array<{ id: string; display_name: string; avatar_url: string | null }> | null;
};

type CreatorReviewRow = {
  id: string;
  creator_id: string;
  reviewer_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  updated_at: string;
  reviewer?: { id: string; display_name: string; avatar_url: string | null } | Array<{ id: string; display_name: string; avatar_url: string | null }> | null;
};

type WishlistAssetRow = {
  asset: AssetRow | AssetRow[] | null;
};

type CreatorReleaseNotificationRow = {
  id: string;
  created_at: string;
  read_at: string | null;
  delivery_status: NotificationDeliveryStatus;
  creator_id: string;
  follower_id: string;
  asset_id: string;
  creator?: { display_name: string } | { display_name: string }[] | null;
  asset?: { title: string } | { title: string }[] | null;
};

type CreatorHireRequestRow = {
  id: string;
  created_at: string;
  read_at: string | null;
  delivery_status: NotificationDeliveryStatus;
  creator_id: string;
  requester_id: string;
  requester_display_name: string | null;
  requester_email: string | null;
  terms_snapshot: string | null;
  requester?:
    | { id: string; display_name: string; avatar_url: string | null }
    | Array<{ id: string; display_name: string; avatar_url: string | null }>
    | null;
};

type CreatorVerificationRequestRow = {
  creator_id: string;
  status: CreatorVerificationStatus;
  is_profile_complete: boolean | null;
  missing_fields: string[] | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
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
    minimum_price_kobo: row.minimum_price_kobo ?? row.price_kobo,
    currency: row.currency,
    delivery_mode: row.delivery_mode ?? "file",
    external_delivery_url: row.external_delivery_url ?? null,
    pricing_model: row.pricing_model ?? (row.price_kobo > 0 ? "paid" : "free"),
    audio_preview_url: row.audio_preview_url ?? null,
    audio_genre: row.audio_genre?.trim() || null,
    audio_bpm: typeof row.audio_bpm === "number" ? row.audio_bpm : null,
    audio_key: row.audio_key?.trim() || null,
    license_options: (row.license_options ?? []) as AssetLicenseOption[],
    sold_count: 0,
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
    files: (row.files ?? []).map((file) => ({
      id: file.id,
      file_type: file.file_type,
      file_size: file.file_size,
      original_name: file.original_name,
      file_role: file.file_role ?? "primary",
      sort_order: file.sort_order ?? 0
    }))
  };
}

function mapOrder(row: OrderRow): Order {
  const asset = Array.isArray(row.asset) ? row.asset[0] : row.asset;

  return {
    id: row.id,
    email: row.email,
    status: row.status,
    amount_kobo: row.amount_kobo,
    currency: row.currency,
    created_at: row.created_at,
    paid_at: row.paid_at ?? null,
    commission_kobo: row.commission_kobo ?? 0,
    seller_net_amount_kobo: row.seller_net_amount_kobo ?? Math.max(row.amount_kobo - (row.commission_kobo ?? 0), 0),
    delivery_mode: row.delivery_mode ?? asset?.delivery_mode ?? "file",
    delivery_external_url: row.delivery_external_url ?? null,
    escrow_status: row.escrow_status ?? (row.status === "paid" ? "released" : null),
    escrow_due_at: row.escrow_due_at ?? null,
    buyer_opened_at: row.buyer_opened_at ?? null,
    buyer_confirmed_at: row.buyer_confirmed_at ?? null,
    buyer_reported_at: row.buyer_reported_at ?? null,
    escrow_released_at: row.escrow_released_at ?? null,
    escrow_release_reason: row.escrow_release_reason ?? null,
    scam_report_reason: row.scam_report_reason ?? null,
    scam_resolution_status: row.scam_resolution_status ?? null,
    scam_resolution_note: row.scam_resolution_note ?? null,
    seller_issue_note: row.seller_issue_note ?? null,
    seller_moderation_action: row.seller_moderation_action ?? null,
    refund_reference: row.refund_reference ?? null,
    refund_provider_status: row.refund_provider_status ?? null,
    asset: asset
      ? {
          id: asset.id,
          title: asset.title,
          category: asset.category,
          delivery_mode: asset.delivery_mode ?? row.delivery_mode ?? "file",
          pricing_model: asset.pricing_model ?? "paid",
          audio_preview_url: asset.audio_preview_url ?? null,
          audio_genre: asset.audio_genre?.trim() || null,
          audio_bpm: typeof asset.audio_bpm === "number" ? asset.audio_bpm : null,
          audio_key: asset.audio_key?.trim() || null,
          license_options: (asset.license_options ?? []) as AssetLicenseOption[],
          previews: asset.previews ?? [],
          files: (asset.files ?? []).map((file) => ({
            id: file.id,
            file_type: file.file_type,
            file_size: file.file_size,
            original_name: file.original_name,
            file_role: file.file_role ?? "primary",
            sort_order: file.sort_order ?? 0
          }))
        }
      : undefined,
    delivery_files: (row.delivery_files ?? []).map((file): OrderDeliveryFile => ({
      id: file.id,
      file_type: file.file_type,
      file_size: file.file_size,
      original_name: file.original_name,
      file_role: file.file_role ?? "primary",
      sort_order: file.sort_order ?? 0
    }))
  };
}

function mapOrderReceipt(
  receipt: OrderReceiptRow,
  order: OrderReceiptStatusRow | null,
  seller: ReceiptSellerProfileRow | null,
  previewUrl: string | null
): OrderReceipt {
  return {
    id: receipt.id,
    order_id: receipt.order_id,
    receipt_number: receipt.receipt_number,
    buyer_id: receipt.buyer_id,
    seller_id: receipt.seller_id,
    asset_id: receipt.asset_id,
    buyer_email: receipt.buyer_email,
    seller_email: receipt.seller_email ?? null,
    buyer_display_name: receipt.buyer_display_name ?? null,
    seller_display_name: receipt.seller_display_name,
    asset_title: receipt.asset_title,
    asset_category: receipt.asset_category ?? null,
    payment_provider: receipt.payment_provider,
    payment_reference: receipt.payment_reference,
    amount_kobo: receipt.amount_kobo,
    commission_kobo: receipt.commission_kobo,
    seller_net_amount_kobo: receipt.seller_net_amount_kobo,
    currency: receipt.currency,
    paid_at: receipt.paid_at,
    created_at: receipt.created_at,
    updated_at: receipt.updated_at,
    order_status: order?.status ?? "paid",
    order_created_at: order?.created_at ?? receipt.created_at,
    escrow_status: order?.escrow_status ?? null,
    escrow_due_at: order?.escrow_due_at ?? null,
    buyer_confirmed_at: order?.buyer_confirmed_at ?? null,
    buyer_reported_at: order?.buyer_reported_at ?? null,
    escrow_released_at: order?.escrow_released_at ?? null,
    escrow_release_reason: order?.escrow_release_reason ?? null,
    refund_reference: order?.refund_reference ?? null,
    refund_provider_status: order?.refund_provider_status ?? null,
    scam_report_reason: order?.scam_report_reason ?? null,
    scam_resolution_status: order?.scam_resolution_status ?? null,
    asset_preview_url: previewUrl,
    seller: seller
      ? {
          avatar_url: seller.avatar_url,
          creator_category: seller.creator_category ?? "General",
          is_verified: Boolean(seller.is_verified)
        }
      : null
  };
}

const DUE_ORDER_ESCROW_SYNC_TTL_MS = 15_000;
let dueOrderEscrowSyncPromise: Promise<void> | null = null;
let lastDueOrderEscrowSyncAt = 0;

async function syncDueOrderEscrows() {
  const now = Date.now();

  if (dueOrderEscrowSyncPromise) {
    return dueOrderEscrowSyncPromise;
  }

  if (lastDueOrderEscrowSyncAt > 0 && now - lastDueOrderEscrowSyncAt < DUE_ORDER_ESCROW_SYNC_TTL_MS) {
    return;
  }

  dueOrderEscrowSyncPromise = (async () => {
    const { error } = await supabase.rpc("release_due_order_escrows");

    if (error) {
      throw new Error(error.message);
    }

    lastDueOrderEscrowSyncAt = Date.now();
  })();

  try {
    await dueOrderEscrowSyncPromise;
  } finally {
    dueOrderEscrowSyncPromise = null;
  }
}

async function requireAccessToken(message: string) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error(message);
  }
  return accessToken;
}
function mapAssetReview(row: AssetReviewRow): AssetReview {
  const reviewer = Array.isArray(row.reviewer) ? row.reviewer[0] : row.reviewer;

  return {
    id: row.id,
    asset_id: row.asset_id,
    reviewer_id: row.reviewer_id,
    rating: row.rating,
    review_text: row.review_text ?? "",
    created_at: row.created_at,
    updated_at: row.updated_at,
    reviewer: reviewer
      ? {
          id: reviewer.id,
          display_name: reviewer.display_name,
          avatar_url: reviewer.avatar_url
        }
      : null
  };
}

function mapCreatorReview(row: CreatorReviewRow): CreatorReview {
  const reviewer = Array.isArray(row.reviewer) ? row.reviewer[0] : row.reviewer;

  return {
    id: row.id,
    creator_id: row.creator_id,
    reviewer_id: row.reviewer_id,
    rating: row.rating,
    review_text: row.review_text ?? "",
    created_at: row.created_at,
    updated_at: row.updated_at,
    reviewer: reviewer
      ? {
          id: reviewer.id,
          display_name: reviewer.display_name,
          avatar_url: reviewer.avatar_url
        }
      : null
  };
}

function mapReleaseNotification(row: CreatorReleaseNotificationRow): ReleaseNotification {
  const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
  const asset = Array.isArray(row.asset) ? row.asset[0] : row.asset;

  return {
    kind: "release",
    id: row.id,
    created_at: row.created_at,
    read_at: row.read_at,
    delivery_status: row.delivery_status,
    creator_id: row.creator_id,
    follower_id: row.follower_id,
    asset_id: row.asset_id,
    creator_name: creator?.display_name ?? "Creator",
    asset_title: asset?.title ?? "New release"
  };
}

function mapHireRequestNotification(row: CreatorHireRequestRow): HireRequestNotification {
  const requester = normalizeJoinedRecord(row.requester);

  return {
    kind: "hire_request",
    id: row.id,
    created_at: row.created_at,
    read_at: row.read_at,
    delivery_status: row.delivery_status,
    creator_id: row.creator_id,
    requester_id: row.requester_id,
    requester_name: (requester?.display_name ?? row.requester_display_name?.trim()) || "Client",
    requester_email: row.requester_email ?? null,
    requester_avatar_url: requester?.avatar_url ?? null,
    terms_snapshot: row.terms_snapshot?.trim() || DEFAULT_HIRE_TERMS
  };
}

function mapCreatorVerificationRequest(row: CreatorVerificationRequestRow | null | undefined): CreatorVerificationRequest | null {
  if (!row) {
    return null;
  }

  return {
    creator_id: row.creator_id,
    status: row.status,
    is_profile_complete: row.is_profile_complete === true,
    missing_fields: ((row.missing_fields ?? []) as string[]).filter(Boolean) as ProfileVerificationField[],
    submitted_at: row.submitted_at ?? null,
    reviewed_at: row.reviewed_at ?? null,
    reviewed_by: row.reviewed_by ?? null,
    review_note: row.review_note?.trim() || null
  };
}

function mapProfile(row: ProfileRow, verificationRow?: CreatorVerificationRequestRow | null): Profile {
  return {
    id: row.id,
    display_name: row.display_name,
    bio: row.bio,
    avatar_url: row.avatar_url,
    creator_category: row.creator_category ?? "General",
    niche: row.niche ?? null,
    sales_count: row.sales_count ?? 0,
    is_verified: Boolean(row.is_verified),
    socials: (row.socials ?? {}) as Record<string, string>,
    seller_account_status: (row.seller_account_status as Profile["seller_account_status"] | null) ?? "active",
    seller_account_note: row.seller_account_note ?? null,
    hire_enabled: row.hire_enabled ?? true,
    hire_terms: row.hire_terms?.trim() || DEFAULT_HIRE_TERMS,
    verification: mapCreatorVerificationRequest(verificationRow)
  };
}

function normalizeJoinedRecord<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

type AdminOverviewAssetRow = {
  creator_id: string;
};

type AdminOverviewPaidOrderVolumeRow = {
  amount_kobo: number;
  currency: string;
};
type AdminOrderRow = {
  id: string;
  buyer_id: string | null;
  email: string;
  status: Order["status"];
  amount_kobo: number;
  currency: string;
  created_at: string;
  paid_at: string | null;
  commission_kobo: number;
  seller_net_amount_kobo: number;
  escrow_status: Order["escrow_status"];
  escrow_due_at: string | null;
  buyer_opened_at: string | null;
  buyer_confirmed_at: string | null;
  buyer_reported_at: string | null;
  escrow_released_at: string | null;
  escrow_release_reason: string | null;
  scam_report_reason: string | null;
  scam_resolution_status: Order["scam_resolution_status"];
  scam_resolution_note: string | null;
  seller_issue_note: string | null;
  seller_moderation_action: Order["seller_moderation_action"];
  refund_reference: string | null;
  refund_provider_status: string | null;
  asset?:
    | {
        id: string;
        title: string;
        category: string;
        creator_id: string;
        profile?: AssetProfileRow | AssetProfileRow[] | null;
      }
    | Array<{
        id: string;
        title: string;
        category: string;
        creator_id: string;
        profile?: AssetProfileRow | AssetProfileRow[] | null;
      }>
    | null;
  payment?:
    | {
        provider: string;
        reference: string;
        status: "pending" | "paid" | "failed" | "refunded";
        updated_at: string | null;
      }
    | Array<{
        provider: string;
        reference: string;
        status: "pending" | "paid" | "failed" | "refunded";
        updated_at: string | null;
      }>
    | null;
};
type AdminCreatorPayoutRow = {
  creator_id: string;
  status: "active" | "inactive";
  country: string;
  payout_type: "bank" | "mobile_money";
  settlement_bank_name: string | null;
  updated_at: string;
};

type WalletRow = {
  creator_id: string;
  balance_kobo: number | null;
};

function summarizeRatings(ratings: number[]): RatingSummary {
  if (ratings.length === 0) {
    return { average_rating: 0, review_count: 0 };
  }

  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  const average = total / ratings.length;

  return {
    average_rating: Number(average.toFixed(2)),
    review_count: ratings.length
  };
}

async function attachAssetRatingSummaries(assets: Asset[]): Promise<Asset[]> {
  if (assets.length === 0) {
    return assets;
  }

  const assetIds = Array.from(new Set(assets.map((asset) => asset.id)));
  const [{ data: ratingData, error: ratingError }, { data: orderData, error: orderError }] = await Promise.all([
    supabase.from("asset_reviews").select("asset_id, rating").in("asset_id", assetIds),
    supabase.from("orders").select("asset_id, status").in("asset_id", assetIds).in("status", ["paid", "refunded"])
  ]);

  if (ratingError) {
    throw new Error(ratingError.message);
  }

  if (orderError) {
    throw new Error(orderError.message);
  }

  const ratingsByAsset = new Map<string, number[]>();
  for (const row of (ratingData ?? []) as AssetRatingRow[]) {
    const existing = ratingsByAsset.get(row.asset_id) ?? [];
    existing.push(row.rating);
    ratingsByAsset.set(row.asset_id, existing);
  }

  const salesByAsset = new Map<string, number>();
  for (const row of (orderData ?? []) as AssetOrderCountRow[]) {
    salesByAsset.set(row.asset_id, (salesByAsset.get(row.asset_id) ?? 0) + 1);
  }

  return assets.map((asset) => {
    const ratings = ratingsByAsset.get(asset.id) ?? [];
    const summary = summarizeRatings(ratings);
    return {
      ...asset,
      sold_count: salesByAsset.get(asset.id) ?? asset.sold_count ?? 0,
      average_rating: summary.average_rating,
      review_count: summary.review_count
    };
  });
}

function toNormalizedTokens(value: string) {
  return value
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function scoreAssetSearchMatch(asset: Asset, tokens: string[]): number {
  if (tokens.length === 0) {
    return 0;
  }

  const title = asset.title.toLowerCase();
  const description = asset.description.toLowerCase();
  const category = asset.category.toLowerCase();
  const creator = (asset.profile?.display_name ?? "").toLowerCase();
  const creatorCategory = (asset.profile?.creator_category ?? "").toLowerCase();
  const creatorNiche = (asset.profile?.niche ?? "").toLowerCase();
  const appLabel = getAssetAppLabel(asset).toLowerCase();
  const formatLabel = getAssetFormatLabel(asset).toLowerCase();
  const deliveryLabel = getAssetDeliveryLabel(asset).toLowerCase();
  const primaryFileName = getAssetPrimaryFilename(asset).toLowerCase();
  const tags = (asset.tags ?? []).map((tag) => tag.toLowerCase());

  let score = 0;
  for (const token of tokens) {
    let tokenScore = 0;
    if (title.includes(token)) {
      tokenScore += 8;
    }
    if (creator.includes(token)) {
      tokenScore += 6;
    }
    if (creatorCategory.includes(token)) {
      tokenScore += 5;
    }
    if (creatorNiche.includes(token)) {
      tokenScore += 5;
    }
    if (category.includes(token)) {
      tokenScore += 4;
    }
    if (appLabel.includes(token)) {
      tokenScore += 4;
    }
    if (formatLabel.includes(token)) {
      tokenScore += 4;
    }
    if (deliveryLabel.includes(token)) {
      tokenScore += 3;
    }
    if (primaryFileName.includes(token)) {
      tokenScore += 5;
    }
    if (description.includes(token)) {
      tokenScore += 2;
    }

    for (const tag of tags) {
      if (tag === token) {
        tokenScore += 7;
      } else if (tag.includes(token)) {
        tokenScore += 5;
      }
    }

    if (tokenScore === 0) {
      return 0;
    }

    score += tokenScore;
  }

  return score;
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

export type ResolveAuthIdentifierResult = {
  ok: boolean;
  phone: string | null;
  email: string | null;
  display_name: string;
  destination: string;
};

export type SendAuthOtpInput =
  | {
      intent: "register";
      phone: string;
      email?: string;
    }
  | {
      intent: "reset";
      identifier: string;
    };

export type SendAuthOtpResult = {
  ok: boolean;
  intent: "register" | "reset";
  destination: string;
  phone: string;
  expires_in_seconds: number;
};

export type VerifyAuthOtpInput =
  | {
      intent: "register";
      phone: string;
      email?: string;
      code: string;
      display_name: string;
      password: string;
    }
  | {
      intent: "reset";
      phone: string;
      code: string;
      new_password: string;
    };

export type ProvisionEditorialAdminInput =
  | {
      credential_type: "email";
      email: string;
      password: string;
      display_name?: string;
    }
  | {
      credential_type: "phone";
      phone: string;
      password: string;
      display_name?: string;
    };

export type ProvisionEditorialAdminResult = {
  ok: boolean;
  mode: "created" | "updated";
  user_id: string;
  credential_type: "email" | "phone";
  email: string | null;
  phone: string | null;
  display_name: string;
};

export type ResolveAdminOrderScamInput = {
  orderId: string;
  resolution: "genuine" | "refund";
  sellerAction?: "none" | "warn" | "suspend";
  adminNote?: string;
  sellerNote?: string;
};

export type ResolveAdminOrderScamResult = {
  ok: boolean;
  order_id: string;
  order_status: Order["status"];
  escrow_status: Order["escrow_status"];
  escrow_release_reason?: string | null;
  scam_resolution_status: Order["scam_resolution_status"];
  seller_moderation_action: Order["seller_moderation_action"];
  refund_provider_status?: string | null;
  seller_account_status: "active" | "warned" | "suspended";
};

export async function resolveAuthIdentifier(identifier: string): Promise<ResolveAuthIdentifierResult> {
  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/resolve-auth-identifier`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.VITE_SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ identifier })
  });

  if (!response.ok) {
    const text = await response.text();
    throw buildApiError(response.status, text);
  }

  return (await response.json()) as ResolveAuthIdentifierResult;
}

export async function sendAuthOtp(input: SendAuthOtpInput): Promise<SendAuthOtpResult> {
  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/send-auth-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.VITE_SUPABASE_ANON_KEY
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const text = await response.text();
    throw buildApiError(response.status, text);
  }

  return (await response.json()) as SendAuthOtpResult;
}

export async function verifyAuthOtp(input: VerifyAuthOtpInput): Promise<{
  ok: boolean;
  intent: "register" | "reset";
  phone: string;
  email?: string | null;
  user_id?: string;
}> {
  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/verify-auth-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.VITE_SUPABASE_ANON_KEY
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const text = await response.text();
    throw buildApiError(response.status, text);
  }

  return (await response.json()) as {
    ok: boolean;
    intent: "register" | "reset";
    phone: string;
    email?: string | null;
    user_id?: string;
  };
}

export async function provisionEditorialAdmin(input: ProvisionEditorialAdminInput): Promise<ProvisionEditorialAdminResult> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("You must be signed in to manage editorial accounts.");
  }

  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/provision-editorial-admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const text = await response.text();
    throw buildApiError(response.status, text);
  }

  return (await response.json()) as ProvisionEditorialAdminResult;
}

export async function resolveAdminOrderScam(input: ResolveAdminOrderScamInput): Promise<ResolveAdminOrderScamResult> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("You must be signed in to resolve reported orders.");
  }

  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/resolve-order-scam-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      order_id: input.orderId,
      resolution: input.resolution,
      seller_action: input.sellerAction ?? "none",
      admin_note: input.adminNote ?? "",
      seller_note: input.sellerNote ?? ""
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw buildApiError(response.status, text);
  }

  return (await response.json()) as ResolveAdminOrderScamResult;
}

export async function signInWithIdentifier(identifier: string, password: string) {
  const trimmedIdentifier = identifier.trim();
  if (!trimmedIdentifier) {
    throw new Error("Enter your email or mobile number.");
  }

  if (looksLikeEmailIdentifier(trimmedIdentifier)) {
    const directEmailAttempt = await supabase.auth.signInWithPassword({
      email: trimmedIdentifier.toLowerCase(),
      password
    });

    if (!directEmailAttempt.error) {
      return directEmailAttempt.data;
    }

    const resolved = await resolveAuthIdentifier(trimmedIdentifier);
    if (!resolved.phone) {
      throw directEmailAttempt.error;
    }

    const fallbackPhoneAttempt = await supabase.auth.signInWithPassword({
      phone: resolved.phone,
      password
    });

    if (fallbackPhoneAttempt.error) {
      throw fallbackPhoneAttempt.error;
    }

    return fallbackPhoneAttempt.data;
  }

  const normalizedPhone = normalizeAuthPhoneInput(trimmedIdentifier);
  if (!normalizedPhone) {
    throw new Error("Enter a valid mobile number, for example 024... or +233...");
  }

  const phoneAttempt = await supabase.auth.signInWithPassword({
    phone: normalizedPhone,
    password
  });

  if (phoneAttempt.error) {
    throw phoneAttempt.error;
  }

  return phoneAttempt.data;
}

export async function signInWithGoogle(redirectPath: string) {
  const safeRedirectPath = sanitizeAppRedirectPath(redirectPath, "/market");
  const baseUrl = typeof window !== "undefined" ? window.location.origin : env.VITE_SITE_URL;
  const redirectUrl = new URL(baseUrl);
  redirectUrl.pathname = "/auth";
  redirectUrl.search = "";
  redirectUrl.hash = "";
  redirectUrl.searchParams.set("redirect", safeRedirectPath);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl.toString(),
      queryParams: {
        access_type: "offline",
        prompt: "select_account"
      }
    }
  });

  if (error) {
    throw error;
  }

  return data;
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
  const { data: sessionData } = await supabase.auth.getSession();
  const viewerId = sessionData.session?.user?.id ?? null;
  const shouldLoadVerification = viewerId === userId;

  const [profileResult, verificationResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", userId)
      .maybeSingle(),
    shouldLoadVerification
      ? supabase
          .from("creator_verification_requests")
          .select(CREATOR_VERIFICATION_SELECT)
          .eq("creator_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  if (verificationResult.error) {
    throw new Error(verificationResult.error.message);
  }

  if (!profileResult.data) {
    return null;
  }

  return mapProfile(profileResult.data as ProfileRow, (verificationResult.data ?? null) as CreatorVerificationRequestRow | null);
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
        socials,
        hire_enabled: input.hire_enabled,
        hire_terms: input.hire_terms.trim()
      },
      { onConflict: "id" }
    )
    .select(PROFILE_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const { data: verificationData, error: verificationError } = await supabase
    .from("creator_verification_requests")
    .select(CREATOR_VERIFICATION_SELECT)
    .eq("creator_id", userId)
    .maybeSingle();

  if (verificationError) {
    throw new Error(verificationError.message);
  }

  return mapProfile(data as ProfileRow, (verificationData ?? null) as CreatorVerificationRequestRow | null);
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

function trendingScore(
  entry: Pick<
    CreatorDirectoryEntry,
    "sales_count" | "published_assets" | "latest_asset_at" | "is_verified" | "follower_count" | "average_rating" | "review_count"
  >
) {
  const now = Date.now();
  const latest = toTimestamp(entry.latest_asset_at);
  const daysSinceLatest = latest > 0 ? Math.floor((now - latest) / (1000 * 60 * 60 * 24)) : 9999;
  const recencyBoost = daysSinceLatest <= 30 ? 4 : daysSinceLatest <= 90 ? 2 : 0;
  const verificationBoost = entry.is_verified ? 3 : 0;
  const followerBoost = entry.follower_count * 1.5;
  const ratingBoost = entry.average_rating * 3 + Math.min(entry.review_count, 20) * 0.25;
  return entry.sales_count * 5 + entry.published_assets * 2 + recencyBoost + verificationBoost + followerBoost + ratingBoost;
}

export async function getCreatorDirectory(filters: CreatorDirectoryFilters = {}): Promise<CreatorDirectoryEntry[]> {
  const [
    { data: profilesData, error: profilesError },
    { data: assetsData, error: assetsError },
    { data: reviewData, error: reviewError },
    { data: followData, error: followError }
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, bio, avatar_url, creator_category, niche, sales_count, is_verified, created_at, hire_enabled"),
    supabase.from("assets").select("creator_id, created_at, previews:asset_previews(preview_url)").eq("status", "published").order("created_at", { ascending: false }),
    supabase.from("creator_reviews").select("creator_id, rating"),
    supabase.from("creator_follows").select("creator_id")
  ]);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  if (assetsError) {
    throw new Error(assetsError.message);
  }

  if (reviewError) {
    throw new Error(reviewError.message);
  }

  if (followError) {
    throw new Error(followError.message);
  }

  const profileRows = (profilesData ?? []) as CreatorProfileRow[];
  const assetRows = (assetsData ?? []) as CreatorAssetStatRow[];
  const creatorReviewRows = (reviewData ?? []) as CreatorReviewRatingRow[];
  const creatorFollowRows = (followData ?? []) as CreatorFollowRow[];
  const creatorStats = new Map<string, { published_assets: number; latest_asset_at: string | null; featured_preview_urls: string[] }>();
  const creatorRatingMap = new Map<string, { total: number; count: number }>();
  const creatorFollowerMap = new Map<string, number>();

  for (const row of assetRows) {
    const current = creatorStats.get(row.creator_id) ?? { published_assets: 0, latest_asset_at: null, featured_preview_urls: [] };
    const currentLatest = toTimestamp(current.latest_asset_at);
    const rowCreatedAt = toTimestamp(row.created_at);
    const nextPreviewUrl = row.previews?.find((preview) => typeof preview.preview_url === "string" && preview.preview_url.trim().length > 0)?.preview_url?.trim();
    const featuredPreviewUrls = nextPreviewUrl
      ? [...current.featured_preview_urls, nextPreviewUrl].filter((value, index, values) => values.indexOf(value) === index).slice(0, 4)
      : current.featured_preview_urls;

    creatorStats.set(row.creator_id, {
      published_assets: current.published_assets + 1,
      latest_asset_at: rowCreatedAt > currentLatest ? row.created_at : current.latest_asset_at,
      featured_preview_urls: featuredPreviewUrls
    });
  }

  for (const row of creatorReviewRows) {
    const current = creatorRatingMap.get(row.creator_id) ?? { total: 0, count: 0 };
    creatorRatingMap.set(row.creator_id, {
      total: current.total + row.rating,
      count: current.count + 1
    });
  }

  for (const row of creatorFollowRows) {
    const current = creatorFollowerMap.get(row.creator_id) ?? 0;
    creatorFollowerMap.set(row.creator_id, current + 1);
  }

  const baseCreators = profileRows
    .map((profile) => {
      const stats = creatorStats.get(profile.id) ?? { published_assets: 0, latest_asset_at: null, featured_preview_urls: [] };
      const rating = creatorRatingMap.get(profile.id) ?? { total: 0, count: 0 };
      const averageRating = rating.count > 0 ? Number((rating.total / rating.count).toFixed(2)) : 0;
      const followerCount = creatorFollowerMap.get(profile.id) ?? 0;

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
        editor_pick: false,
        follower_count: followerCount,
        average_rating: averageRating,
        review_count: rating.count,
        hire_enabled: profile.hire_enabled ?? true,
        featured_preview_urls: stats.featured_preview_urls
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
      b.follower_count - a.follower_count ||
      toTimestamp(b.latest_asset_at) - toTimestamp(a.latest_asset_at)
    );
  });

  return creators;
}

export async function getPublishedAssets(filters: MarketFilters = {}, viewerId?: string | null): Promise<Asset[]> {
  const assetQuery = supabase
    .from("assets")
    .select(
      `id,
      creator_id,
      title,
      description,
      category,
      tags,
      price_kobo,
      minimum_price_kobo,
      currency,
      delivery_mode,
      external_delivery_url,
      pricing_model,
      audio_preview_url,
      audio_genre,
      audio_bpm,
      audio_key,
      license_options,
      status,
      created_at,
      profile:profiles!assets_creator_id_fkey(${PROFILE_FIELDS_SELECT}),
      previews:asset_previews(id, preview_url),
      files:asset_files(id, file_type, file_size, original_name, file_role, sort_order)`
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });

  const [{ data, error }, followResult] = await Promise.all([
    assetQuery,
    viewerId ? supabase.from("creator_follows").select("creator_id").eq("follower_id", viewerId) : Promise.resolve({ data: [], error: null })
  ]);

  if (error) {
    throw new Error(error.message);
  }

  if (followResult.error) {
    throw new Error(followResult.error.message);
  }

  const followedCreatorIds = new Set(((followResult.data ?? []) as CreatorFollowRow[]).map((row) => row.creator_id));
  const withRatings = await attachAssetRatingSummaries((data as AssetRow[]).map(mapAsset));
  const searchTokens = toNormalizedTokens(filters.search ?? "");
  const creatorQuery = (filters.creator ?? "").trim().toLowerCase();

  const filtered = withRatings
    .map((asset) => ({
      asset,
      relevance: scoreAssetSearchMatch(asset, searchTokens),
      followed: followedCreatorIds.has(asset.creator_id)
    }))
    .filter(({ asset, relevance }) => {
      const comparablePriceKobo = asset.pricing_model === "pay_what_you_want" ? asset.minimum_price_kobo : asset.price_kobo;
      const matchesSearch = searchTokens.length === 0 ? true : relevance > 0;
      const matchesCategory = !filters.category || filters.category === "all" ? true : asset.category === filters.category;
      const matchesCreator = creatorQuery ? (asset.profile?.display_name ?? "").toLowerCase().includes(creatorQuery) : true;
      const matchesMin = typeof filters.minPrice === "number" ? comparablePriceKobo >= Math.round(filters.minPrice * 100) : true;
      const matchesMax = typeof filters.maxPrice === "number" ? comparablePriceKobo <= Math.round(filters.maxPrice * 100) : true;
      const matchesFileType =
        !filters.fileType || filters.fileType === "all" ? true : getAssetFilterFileType(asset) === filters.fileType;

      return matchesSearch && matchesCategory && matchesCreator && matchesMin && matchesMax && matchesFileType;
    });

  filtered.sort((a, b) => {
    if (a.followed !== b.followed) {
      return a.followed ? -1 : 1;
    }

    if (searchTokens.length > 0) {
      return b.relevance - a.relevance || toTimestamp(b.asset.created_at) - toTimestamp(a.asset.created_at);
    }

    return toTimestamp(b.asset.created_at) - toTimestamp(a.asset.created_at);
  });

  return filtered.map((entry) => entry.asset);
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
      minimum_price_kobo,
      currency,
      delivery_mode,
      external_delivery_url,
      pricing_model,
      audio_preview_url,
      audio_genre,
      audio_bpm,
      audio_key,
      license_options,
      status,
      created_at,
      profile:profiles!assets_creator_id_fkey(${PROFILE_FIELDS_SELECT}),
      previews:asset_previews(id, preview_url),
      files:asset_files(id, file_type, file_size, original_name, file_role, sort_order)`
    )
    .eq("id", assetId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Asset not found");
  }

  const [asset] = await attachAssetRatingSummaries([mapAsset(data as AssetRow)]);
  return asset;
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
      minimum_price_kobo,
      currency,
      delivery_mode,
      external_delivery_url,
      pricing_model,
      audio_preview_url,
      audio_genre,
      audio_bpm,
      audio_key,
      license_options,
      status,
      created_at,
      profile:profiles!assets_creator_id_fkey(${PROFILE_FIELDS_SELECT}),
      previews:asset_previews(id, preview_url),
      files:asset_files(id, file_type, file_size, original_name, file_role, sort_order)`
    )
    .eq("creator_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return attachAssetRatingSummaries((data as AssetRow[]).map(mapAsset));
}

export async function getAssetRatingSummary(assetId: string): Promise<RatingSummary> {
  const { data, error } = await supabase.rpc("get_asset_rating_summary", { p_asset_id: assetId });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    average_rating: Number(row?.average_rating ?? 0),
    review_count: Number(row?.review_count ?? 0)
  };
}

export async function getAssetReviews(assetId: string): Promise<AssetReview[]> {
  const { data, error } = await supabase
    .from("asset_reviews")
    .select("id, asset_id, reviewer_id, rating, review_text, created_at, updated_at, reviewer:profiles!asset_reviews_reviewer_id_fkey(id, display_name, avatar_url)")
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AssetReviewRow[]).map(mapAssetReview);
}

export async function upsertAssetReview(input: {
  userId: string;
  assetId: string;
  rating: number;
  reviewText?: string;
}): Promise<AssetReview> {
  const { data, error } = await supabase
    .from("asset_reviews")
    .upsert(
      {
        asset_id: input.assetId,
        reviewer_id: input.userId,
        rating: input.rating,
        review_text: input.reviewText?.trim() ?? ""
      },
      { onConflict: "asset_id,reviewer_id" }
    )
    .select("id, asset_id, reviewer_id, rating, review_text, created_at, updated_at, reviewer:profiles!asset_reviews_reviewer_id_fkey(id, display_name, avatar_url)")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to submit asset review.");
  }

  return mapAssetReview(data as AssetReviewRow);
}

export async function deleteAssetReview(reviewId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("asset_reviews").delete().eq("id", reviewId).eq("reviewer_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getReviewedAssetIdsForUser(userId: string, assetIds: string[]): Promise<string[]> {
  const normalizedAssetIds = Array.from(new Set(assetIds.filter(Boolean)));
  if (normalizedAssetIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("asset_reviews")
    .select("asset_id")
    .eq("reviewer_id", userId)
    .in("asset_id", normalizedAssetIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => String(row.asset_id));
}

export async function getCreatorRatingSummary(creatorId: string): Promise<RatingSummary> {
  const { data, error } = await supabase.rpc("get_creator_rating_summary", { p_creator_id: creatorId });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    average_rating: Number(row?.average_rating ?? 0),
    review_count: Number(row?.review_count ?? 0)
  };
}

export async function getCreatorReviews(creatorId: string): Promise<CreatorReview[]> {
  const { data, error } = await supabase
    .from("creator_reviews")
    .select("id, creator_id, reviewer_id, rating, review_text, created_at, updated_at, reviewer:profiles!creator_reviews_reviewer_id_fkey(id, display_name, avatar_url)")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as CreatorReviewRow[]).map(mapCreatorReview);
}

export async function upsertCreatorReview(input: {
  userId: string;
  creatorId: string;
  rating: number;
  reviewText?: string;
}): Promise<CreatorReview> {
  const { data, error } = await supabase
    .from("creator_reviews")
    .upsert(
      {
        creator_id: input.creatorId,
        reviewer_id: input.userId,
        rating: input.rating,
        review_text: input.reviewText?.trim() ?? ""
      },
      { onConflict: "creator_id,reviewer_id" }
    )
    .select("id, creator_id, reviewer_id, rating, review_text, created_at, updated_at, reviewer:profiles!creator_reviews_reviewer_id_fkey(id, display_name, avatar_url)")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to submit creator review.");
  }

  return mapCreatorReview(data as CreatorReviewRow);
}

export async function deleteCreatorReview(reviewId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("creator_reviews").delete().eq("id", reviewId).eq("reviewer_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getWishlistAssetIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("wishlists").select("asset_id").eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => String(row.asset_id));
}

export async function getWishlistCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("wishlists")
    .select("asset_id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function addAssetToWishlist(userId: string, assetId: string): Promise<void> {
  const { error } = await supabase.from("wishlists").upsert({ user_id: userId, asset_id: assetId }, { onConflict: "user_id,asset_id" });

  if (error) {
    throw new Error(error.message);
  }
}

export async function removeAssetFromWishlist(userId: string, assetId: string): Promise<void> {
  const { error } = await supabase.from("wishlists").delete().eq("user_id", userId).eq("asset_id", assetId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getWishlistAssets(userId: string): Promise<Asset[]> {
  const { data, error } = await supabase
    .from("wishlists")
    .select(
      `asset:assets(
        id,
        creator_id,
        title,
        description,
        category,
        tags,
        price_kobo,
        minimum_price_kobo,
        currency,
        delivery_mode,
        external_delivery_url,
        pricing_model,
        audio_preview_url,
        audio_genre,
        audio_bpm,
        audio_key,
        license_options,
        status,
        created_at,
        profile:profiles!assets_creator_id_fkey(${PROFILE_FIELDS_SELECT}),
        previews:asset_previews(id, preview_url),
        files:asset_files(id, file_type, file_size, original_name, file_role, sort_order)
      )`
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const assets = ((data ?? []) as WishlistAssetRow[])
    .map((row) => (Array.isArray(row.asset) ? row.asset[0] : row.asset))
    .filter((row): row is AssetRow => Boolean(row))
    .map(mapAsset)
    .filter((asset) => asset.status === "published");

  return attachAssetRatingSummaries(assets);
}

export async function getCreatorFollowStats(creatorId: string, followerId?: string | null): Promise<{ followerCount: number; isFollowing: boolean }> {
  const [{ count, error: countError }, followRow] = await Promise.all([
    supabase.from("creator_follows").select("*", { count: "exact", head: true }).eq("creator_id", creatorId),
    followerId
      ? supabase.from("creator_follows").select("creator_id").eq("creator_id", creatorId).eq("follower_id", followerId).maybeSingle()
      : Promise.resolve({ data: null, error: null as { message?: string } | null })
  ]);

  if (countError) {
    throw new Error(countError.message);
  }

  if (followRow.error) {
    throw new Error(followRow.error.message ?? "Unable to load follow state.");
  }

  return {
    followerCount: count ?? 0,
    isFollowing: Boolean(followRow.data)
  };
}

export async function followCreator(followerId: string, creatorId: string): Promise<void> {
  const { error } = await supabase
    .from("creator_follows")
    .upsert({ follower_id: followerId, creator_id: creatorId }, { onConflict: "follower_id,creator_id" });

  if (error) {
    throw new Error(error.message);
  }
}

export async function unfollowCreator(followerId: string, creatorId: string): Promise<void> {
  const { error } = await supabase.from("creator_follows").delete().eq("follower_id", followerId).eq("creator_id", creatorId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getReleaseNotifications(userId: string): Promise<ReleaseNotification[]> {
  const { data, error } = await supabase
    .from("creator_release_notifications")
    .select(
      "id, created_at, read_at, delivery_status, creator_id, follower_id, asset_id, creator:profiles!creator_release_notifications_creator_id_fkey(display_name), asset:assets!creator_release_notifications_asset_id_fkey(title)"
    )
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as CreatorReleaseNotificationRow[]).map(mapReleaseNotification);
}

export async function getHireRequestNotifications(userId: string): Promise<HireRequestNotification[]> {
  const { data, error } = await supabase
    .from("creator_hire_requests")
    .select(
      "id, created_at, read_at, delivery_status, creator_id, requester_id, requester_display_name, requester_email, terms_snapshot, requester:profiles!creator_hire_requests_requester_id_fkey(id, display_name, avatar_url)"
    )
    .eq("creator_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as CreatorHireRequestRow[]).map(mapHireRequestNotification);
}

export async function getAccountNotifications(userId: string): Promise<AccountNotification[]> {
  const [releaseNotifications, hireRequestNotifications] = await Promise.all([
    getReleaseNotifications(userId),
    getHireRequestNotifications(userId)
  ]);

  return [...hireRequestNotifications, ...releaseNotifications].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at)
  );
}

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  const [releaseCountResult, hireCountResult] = await Promise.all([
    supabase
      .from("creator_release_notifications")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", userId)
      .is("read_at", null),
    supabase
      .from("creator_hire_requests")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", userId)
      .is("read_at", null)
  ]);

  if (releaseCountResult.error) {
    throw new Error(releaseCountResult.error.message);
  }

  if (hireCountResult.error) {
    throw new Error(hireCountResult.error.message);
  }

  return (releaseCountResult.count ?? 0) + (hireCountResult.count ?? 0);
}

export async function markReleaseNotificationAsRead(notificationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("creator_release_notifications")
    .update({ read_at: new Date().toISOString(), delivery_status: "sent" })
    .eq("id", notificationId)
    .eq("follower_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markHireRequestAsRead(notificationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("creator_hire_requests")
    .update({ read_at: new Date().toISOString(), delivery_status: "sent" })
    .eq("id", notificationId)
    .eq("creator_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markAccountNotificationAsRead(notification: AccountNotification, userId: string): Promise<void> {
  if (notification.kind === "hire_request") {
    await markHireRequestAsRead(notification.id, userId);
    return;
  }

  await markReleaseNotificationAsRead(notification.id, userId);
}

export async function submitCreatorHireRequest(creatorId: string): Promise<void> {
  await requireAccessToken("Sign in to hire this creator.");
  const { error } = await supabase.rpc("submit_creator_hire_request", {
    p_creator_id: creatorId
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getCreatorFunnelSummary(creatorId: string): Promise<CreatorFunnelSummary> {
  const { data, error } = await supabase.rpc("get_creator_funnel_summary", { p_creator_id: creatorId });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    asset_views: Number(row?.asset_views ?? 0),
    asset_clicks: Number(row?.asset_clicks ?? 0),
    checkout_starts: Number(row?.checkout_starts ?? 0),
    purchases: Number(row?.purchases ?? 0)
  };
}

type AnalyticsEventName = "asset_view" | "asset_click" | "checkout_start" | "purchase";

type TrackAnalyticsEventInput = {
  eventName: AnalyticsEventName;
  assetId?: string;
  creatorId?: string;
  orderId?: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  sessionId?: string;
  metadata?: Record<string, unknown>;
};

const ANALYTICS_SESSION_STORAGE_KEY = "crib.analytics.session";

function getAnalyticsSessionId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(ANALYTICS_SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const generated =
    typeof window.crypto !== "undefined" && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(ANALYTICS_SESSION_STORAGE_KEY, generated);
  return generated;
}

export async function trackAnalyticsEvent(input: TrackAnalyticsEventInput): Promise<void> {
  if (!input.creatorId || !input.assetId) {
    return;
  }

  const payload = {
    event_name: input.eventName,
    asset_id: input.assetId,
    creator_id: input.creatorId,
    order_id: input.orderId ?? null,
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? null,
    session_id: input.sessionId ?? getAnalyticsSessionId(),
    metadata: input.metadata ?? {}
  };

  const { error } = await supabase.from("analytics_events").insert(payload);
  if (error) {
    console.error("analytics tracking failed", error.message);
  }
}

export type CreateAssetListingFiles = {
  mainFile: File | null;
  previewFiles: File[];
  audioPreviewFile?: File | null;
  audioBundleFile?: File | null;
};

type PendingAssetFileUpload = {
  file: File;
  role: AssetFileRole;
  sortOrder: number;
  maxBytes: number;
};

export async function createAssetListing(
  userId: string,
  input: UploadAssetInput,
  files: CreateAssetListingFiles
): Promise<{ assetId: string }> {
  const {
    mainFile,
    previewFiles,
    audioPreviewFile = null,
    audioBundleFile = null
  } = files;
  const { data: moderationProfile, error: moderationProfileError } = await supabase
    .from("profiles")
    .select("seller_account_status, seller_account_note")
    .eq("id", userId)
    .maybeSingle();

  if (moderationProfileError) {
    throw new Error(moderationProfileError.message);
  }

  if (moderationProfile?.seller_account_status === "suspended") {
    throw new Error(
      moderationProfile.seller_account_note?.trim()
        ? `Your seller account is suspended. ${moderationProfile.seller_account_note.trim()}`
        : "Your seller account is suspended. Contact the marketplace admin before uploading again."
    );
  }

  const tags = input.tags
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const isAudioAsset = input.asset_type === "audio";
  const generatedAssetId =
    typeof window !== "undefined" && typeof window.crypto !== "undefined" && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
          const random = Math.floor(Math.random() * 16);
          const value = character === "x" ? random : (random & 0x3) | 0x8;
          return value.toString(16);
        });
  const uploadedPaths: Array<{ bucket: "assets" | "previews"; path: string }> = [];

  let audioPreviewUrl: string | null = null;
  if (isAudioAsset) {
    if (!audioPreviewFile) {
      throw new Error("Audio listings need an MP3 or WAV preview before publishing.");
    }

    const audioPreviewPublicPath = `${userId}/${generatedAssetId}/audio-preview-${Date.now()}-${audioPreviewFile.name}`;
    const { error: uploadPublicPreviewError } = await supabase.storage.from("previews").upload(audioPreviewPublicPath, audioPreviewFile, {
      upsert: false,
      contentType: audioPreviewFile.type || "audio/mpeg"
    });

    if (uploadPublicPreviewError) {
      throw mapStorageUploadError(uploadPublicPreviewError, {
        fileName: audioPreviewFile.name,
        maxBytes: MAX_AUDIO_PREVIEW_FILE_SIZE_BYTES
      });
    }

    uploadedPaths.push({ bucket: "previews", path: audioPreviewPublicPath });
    const { data: publicAudioPreviewUrl } = supabase.storage.from("previews").getPublicUrl(audioPreviewPublicPath);
    audioPreviewUrl = publicAudioPreviewUrl.publicUrl;
  }

  const normalizedPriceKobo = Math.round(input.price * 100);
  const normalizedMinimumPriceKobo = input.pricing_model === "paid" ? normalizedPriceKobo : Math.round(input.minimum_price * 100);
  const normalizedExternalDeliveryUrl = input.delivery_mode === "external_link" ? input.external_delivery_url.trim() : null;

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .insert({
      id: generatedAssetId,
      creator_id: userId,
      title: input.title,
      description: input.description,
      category: input.category,
      tags,
      price_kobo: normalizedPriceKobo,
      minimum_price_kobo: normalizedMinimumPriceKobo,
      currency: input.currency.toUpperCase(),
      delivery_mode: input.delivery_mode,
      external_delivery_url: normalizedExternalDeliveryUrl,
      pricing_model: input.pricing_model,
      audio_preview_url: audioPreviewUrl,
      audio_genre: isAudioAsset ? input.audio_genre.trim() : null,
      audio_bpm: isAudioAsset ? input.audio_bpm ?? null : null,
      audio_key: isAudioAsset ? input.audio_key.trim() : null,
      license_options: isAudioAsset ? input.license_options : [],
      status: input.status
    })
    .select("id")
    .single();

  if (assetError || !asset) {
    await Promise.all(uploadedPaths.map((uploaded) => supabase.storage.from(uploaded.bucket).remove([uploaded.path])));
    throw new Error(assetError?.message ?? "Unable to create asset record");
  }

  try {
    if (isAudioAsset) {
      if (!audioBundleFile) {
        throw new Error("Audio listings need a ZIP bundle for buyer delivery.");
      }

      const assetFileUploads: PendingAssetFileUpload[] = [
        { file: audioBundleFile, role: "source_zip", sortOrder: 0, maxBytes: MAX_AUDIO_BUNDLE_FILE_SIZE_BYTES }
      ];

      const assetFileRows: Array<{
        asset_id: string;
        storage_path: string;
        file_type: string;
        file_size: number;
        original_name: string;
        file_role: AssetFileRole;
        sort_order: number;
      }> = [];

      for (const entry of assetFileUploads) {
        const safeName = slugify(entry.file.name.replace(/\.[^.]+$/, ""));
        const assetPath = `${userId}/${asset.id}/${Date.now()}-${entry.sortOrder}-${safeName}-${entry.file.name}`;

        const { error: uploadAssetFileError } = await supabase.storage.from("assets").upload(assetPath, entry.file, {
          upsert: false,
          contentType: entry.file.type || "application/octet-stream"
        });

        if (uploadAssetFileError) {
          throw mapStorageUploadError(uploadAssetFileError, {
            fileName: entry.file.name,
            maxBytes: entry.maxBytes
          });
        }

        uploadedPaths.push({ bucket: "assets", path: assetPath });
        assetFileRows.push({
          asset_id: asset.id,
          storage_path: assetPath,
          file_type: entry.file.type || "application/octet-stream",
          file_size: entry.file.size,
          original_name: entry.file.name,
          file_role: entry.role,
          sort_order: entry.sortOrder
        });
      }

      const { error: assetFilesInsertError } = await supabase.from("asset_files").insert(assetFileRows);
      if (assetFilesInsertError) {
        throw new Error(assetFilesInsertError.message);
      }
    } else if (input.delivery_mode === "file") {
      if (!mainFile) {
        throw new Error("Attach the main file buyers should receive.");
      }

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
        original_name: mainFile.name,
        file_role: "primary",
        sort_order: 0
      });

      if (fileRowError) {
        throw new Error(fileRowError.message);
      }
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
      fileName: audioBundleFile?.name ?? audioPreviewFile?.name ?? mainFile?.name ?? `${slugify(input.title)}-listing`,
      maxBytes: isAudioAsset ? MAX_AUDIO_BUNDLE_FILE_SIZE_BYTES : MAX_PRIMARY_ASSET_SIZE_BYTES
    });
  }
}

export async function createPayment(
  assetId: string,
  options?: {
    buyerEmailOverride?: string;
    amountKobo?: number;
  }
) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  const buyerEmail = getUserContactEmail(data.session?.user) ?? options?.buyerEmailOverride?.trim() ?? "";
  const normalizedAmountKobo = typeof options?.amountKobo === "number" && Number.isFinite(options.amountKobo)
    ? Math.max(Math.round(options.amountKobo), 0)
    : undefined;

  if (!accessToken) {
    throw new Error("Sign in to continue to checkout.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`
  };

  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/create-payment`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      asset_id: assetId,
      ...(buyerEmail ? { email: buyerEmail } : {}),
      ...(typeof normalizedAmountKobo === "number" ? { amount_kobo: normalizedAmountKobo } : {})
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw buildApiError(response.status, text);
  }

  const payload = (await response.json()) as {
    order_id: string;
    reference?: string;
    email?: string;
    amount_kobo?: number;
    currency?: string;
    authorization_url?: string;
    access_code?: string;
    public_key?: string;
    checkout_mode?: "paystack" | "instant";
  };

  return payload;
}

export async function generateDownload(orderId: string, orderFileId?: string) {
  const accessToken = await requireAccessToken("Sign in to access your secure download.");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`
  };

  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/generate-download`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      order_id: orderId,
      ...(orderFileId ? { order_file_id: orderFileId } : {})
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseErrorResponse(text));
  }

  return (await response.json()) as {
    url: string;
    expires_in: number;
    filename: string;
    delivery_type: "file" | "external_link";
    action_label?: string;
  };
}

export async function verifyPayment(reference: string) {
  const accessToken = await requireAccessToken("Sign in to verify this payment.");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`
  };

  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/verify-payment`, {
    method: "POST",
    headers,
    body: JSON.stringify({ reference })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseErrorResponse(text));
  }

  return (await response.json()) as {
    ok: boolean;
    order_status: "pending" | "paid" | "failed" | "refunded";
    payment_status: "pending" | "paid" | "failed" | "refunded";
    escrow_status?: Order["escrow_status"];
    escrow_due_at?: string | null;
    escrow_released_at?: string | null;
    escrow_release_reason?: string | null;
    seller_net_amount_kobo?: number;
    commission_kobo?: number;
  };
}

export async function confirmOrderEscrow(orderId: string) {
  await requireAccessToken("Sign in to confirm this purchase.");
  const { data, error } = await supabase.rpc("confirm_order_escrow", {
    p_order_id: orderId
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    orderId: String(row?.order_id ?? orderId),
    escrowStatus: (row?.escrow_status ?? "released") as NonNullable<Order["escrow_status"]>,
    credited: Boolean(row?.credited),
    sellerNetAmountKobo: Number(row?.seller_net_amount_kobo ?? 0),
    commissionKobo: Number(row?.commission_kobo ?? 0),
    escrowDueAt: row?.escrow_due_at ?? null,
    escrowReleasedAt: row?.escrow_released_at ?? null,
    escrowReleaseReason: row?.escrow_release_reason ?? null
  };
}

export async function reportOrderFileScam(orderId: string, reason: string) {
  await requireAccessToken("Sign in to report a delivery issue.");
  const { data, error } = await supabase.rpc("report_order_file_scam", {
    p_order_id: orderId,
    p_reason: reason.trim()
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    orderId: String(row?.order_id ?? orderId),
    escrowStatus: (row?.escrow_status ?? "scam_reported") as NonNullable<Order["escrow_status"]>,
    reportedAt: row?.reported_at ?? null,
    scamReportReason: row?.scam_report_reason ?? ""
  };
}
export async function resolveReportedOrderAsGenuine(orderId: string) {
  await requireAccessToken("Sign in to resolve this reported delivery.");
  const { data, error } = await supabase.rpc("resolve_reported_order_as_genuine", {
    p_order_id: orderId
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    orderId: String(row?.order_id ?? orderId),
    escrowStatus: (row?.escrow_status ?? "released") as NonNullable<Order["escrow_status"]>,
    credited: Boolean(row?.credited),
    escrowReleasedAt: row?.escrow_released_at ?? null,
    escrowReleaseReason: row?.escrow_release_reason ?? null,
    scamResolutionStatus: row?.scam_resolution_status ?? "genuine_released"
  };
}
export async function getBuyerOrders(options: {
  userId?: string;
}): Promise<Order[]> {
  if (!options.userId) {
    return [];
  }

  await syncDueOrderEscrows();

  let query = supabase
    .from("orders")
    .select(
      `id,
      email,
      status,
      amount_kobo,
      currency,
      created_at,
      paid_at,
      commission_kobo,
      seller_net_amount_kobo,
      delivery_mode,
      delivery_external_url,
      escrow_status,
      escrow_due_at,
      buyer_opened_at,
      buyer_confirmed_at,
      buyer_reported_at,
      escrow_released_at,
      escrow_release_reason,
      scam_report_reason,
      scam_resolution_status,
      scam_resolution_note,
      seller_issue_note,
      seller_moderation_action,
      refund_reference,
      refund_provider_status,
      delivery_files:order_delivery_files(id, file_type, file_size, original_name, file_role, sort_order),
      asset:assets(id, title, category, delivery_mode, pricing_model, audio_preview_url, audio_genre, audio_bpm, audio_key, license_options, previews:asset_previews(id, preview_url), files:asset_files(id, file_type, file_size, original_name, file_role, sort_order))`
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

export async function getOrderReceipt(orderId: string): Promise<OrderReceipt> {
  if (!orderId.trim()) {
    throw new Error("Order ID is required.");
  }

  const buildFallbackReceiptNumber = (nextOrderId: string, paidAt: string | null, createdAt: string) => {
    const date = new Date(paidAt ?? createdAt);
    const year = Number.isNaN(date.getTime()) ? "0000" : String(date.getUTCFullYear()).padStart(4, "0");
    const month = Number.isNaN(date.getTime()) ? "00" : String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = Number.isNaN(date.getTime()) ? "00" : String(date.getUTCDate()).padStart(2, "0");
    const suffix = nextOrderId.replace(/-/g, "").slice(-8).toUpperCase();
    return `CRIB-RCP-${year}${month}${day}-${suffix}`;
  };

  const fallbackDisplayName = (displayName: string | null | undefined, email: string | null | undefined, fallback: string) => {
    const trimmedDisplayName = displayName?.trim() ?? "";
    if (trimmedDisplayName) {
      return trimmedDisplayName;
    }

    const emailPrefix = email?.split("@")[0]?.trim() ?? "";
    if (emailPrefix) {
      return emailPrefix;
    }

    return fallback;
  };

  const { data: receiptRows, error: receiptError } = await supabase
    .from("order_receipts")
    .select(
      `id,
      order_id,
      receipt_number,
      buyer_id,
      seller_id,
      asset_id,
      buyer_email,
      seller_email,
      buyer_display_name,
      seller_display_name,
      asset_title,
      asset_category,
      payment_provider,
      payment_reference,
      amount_kobo,
      commission_kobo,
      seller_net_amount_kobo,
      currency,
      paid_at,
      created_at,
      updated_at`
    )
    .eq("order_id", orderId)
    .limit(1);

  if (receiptError) {
    throw new Error(receiptError.message);
  }

  const receipt = ((receiptRows ?? []) as OrderReceiptRow[])[0] ?? null;

  if (receipt) {
    const [{ data: orderRows, error: orderError }, { data: sellerRows, error: sellerError }, { data: previewRows, error: previewError }] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "status, created_at, escrow_status, escrow_due_at, buyer_confirmed_at, buyer_reported_at, escrow_released_at, escrow_release_reason, refund_reference, refund_provider_status, scam_report_reason, scam_resolution_status"
        )
        .eq("id", receipt.order_id)
        .limit(1),
      supabase
        .from("profiles")
        .select("display_name, avatar_url, creator_category, is_verified")
        .eq("id", receipt.seller_id)
        .limit(1),
      supabase
        .from("asset_previews")
        .select("preview_url")
        .eq("asset_id", receipt.asset_id)
        .order("created_at", { ascending: true })
        .limit(1)
    ]);

    if (orderError) {
      throw new Error(orderError.message);
    }
    if (sellerError) {
      throw new Error(sellerError.message);
    }
    if (previewError) {
      throw new Error(previewError.message);
    }

    return mapOrderReceipt(
      receipt,
      (((orderRows ?? []) as OrderReceiptStatusRow[])[0] ?? null) as OrderReceiptStatusRow | null,
      (((sellerRows ?? []) as ReceiptSellerProfileRow[])[0] ?? null) as ReceiptSellerProfileRow | null,
      ((previewRows ?? []) as Array<{ preview_url: string | null }>)[0]?.preview_url ?? null
    );
  }

  const { data: orderRows, error: orderError } = await supabase
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
      status,
      escrow_status,
      escrow_due_at,
      buyer_confirmed_at,
      buyer_reported_at,
      escrow_released_at,
      escrow_release_reason,
      refund_reference,
      refund_provider_status,
      scam_report_reason,
      scam_resolution_status,
      asset:assets!inner(id, title, category, creator_id),
      payment:payments(id, provider, reference)`
    )
    .eq("id", orderId)
    .limit(1);

  if (orderError) {
    throw new Error(orderError.message);
  }

  const fallbackOrder = ((orderRows ?? [])[0] ?? null) as ({
    id: string;
    buyer_id: string | null;
    email: string;
    amount_kobo: number;
    currency: string;
    paid_at: string | null;
    created_at: string;
    commission_kobo: number | null;
    seller_net_amount_kobo: number | null;
    status: Order["status"];
    escrow_status: Order["escrow_status"];
    escrow_due_at: string | null;
    buyer_confirmed_at: string | null;
    buyer_reported_at: string | null;
    escrow_released_at: string | null;
    escrow_release_reason: string | null;
    refund_reference: string | null;
    refund_provider_status: string | null;
    scam_report_reason: string | null;
    scam_resolution_status: Order["scam_resolution_status"];
    asset: { id: string; title: string; category: string; creator_id: string } | Array<{ id: string; title: string; category: string; creator_id: string }> | null;
    payment: { id?: string; provider?: string | null; reference?: string | null } | Array<{ id?: string; provider?: string | null; reference?: string | null }> | null;
  }) | null;

  if (!fallbackOrder) {
    throw new Error("Receipt not found.");
  }

  if (!["paid", "refunded"].includes(fallbackOrder.status)) {
    throw new Error("Receipt not found.");
  }

  const fallbackAsset = normalizeJoinedRecord(fallbackOrder.asset);
  const fallbackPayment = normalizeJoinedRecord(fallbackOrder.payment);

  if (!fallbackAsset) {
    throw new Error("Receipt not found.");
  }

  const [{ data: sellerRows, error: sellerError }, { data: previewRows, error: previewError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url, creator_category, is_verified")
      .eq("id", fallbackAsset.creator_id)
      .limit(1),
    supabase
      .from("asset_previews")
      .select("preview_url")
      .eq("asset_id", fallbackAsset.id)
      .order("created_at", { ascending: true })
      .limit(1)
  ]);

  if (sellerError) {
    throw new Error(sellerError.message);
  }

  if (previewError) {
    throw new Error(previewError.message);
  }

  const fallbackSeller = (((sellerRows ?? []) as ReceiptSellerProfileRow[])[0] ?? null) as ReceiptSellerProfileRow | null;
  const paidAt = fallbackOrder.paid_at ?? fallbackOrder.created_at;
  const fallbackReferenceSuffix = fallbackOrder.id.replace(/-/g, "");
  const fallbackReceiptRow: OrderReceiptRow = {
    id: `derived-${fallbackOrder.id}`,
    order_id: fallbackOrder.id,
    receipt_number: buildFallbackReceiptNumber(fallbackOrder.id, fallbackOrder.paid_at, fallbackOrder.created_at),
    buyer_id: fallbackOrder.buyer_id,
    seller_id: fallbackAsset.creator_id,
    asset_id: fallbackAsset.id,
    buyer_email: fallbackOrder.email,
    seller_email: null,
    buyer_display_name: fallbackDisplayName(null, fallbackOrder.email, "Buyer"),
    seller_display_name: fallbackDisplayName(fallbackSeller?.display_name ?? null, null, "Creator"),
    asset_title: fallbackAsset.title,
    asset_category: fallbackAsset.category,
    payment_provider: fallbackPayment?.provider?.trim() || (fallbackOrder.amount_kobo === 0 ? "free" : "paystack"),
    payment_reference:
      fallbackPayment?.reference?.trim() ||
      (fallbackOrder.amount_kobo === 0 ? `free-${fallbackReferenceSuffix}` : `order-${fallbackReferenceSuffix}`),
    amount_kobo: fallbackOrder.amount_kobo,
    commission_kobo: fallbackOrder.commission_kobo ?? 0,
    seller_net_amount_kobo: fallbackOrder.seller_net_amount_kobo ?? Math.max(fallbackOrder.amount_kobo - (fallbackOrder.commission_kobo ?? 0), 0),
    currency: fallbackOrder.currency,
    paid_at: paidAt,
    created_at: fallbackOrder.created_at,
    updated_at: paidAt
  };

  const fallbackStatusRow: OrderReceiptStatusRow = {
    status: fallbackOrder.status,
    created_at: fallbackOrder.created_at,
    escrow_status: fallbackOrder.escrow_status,
    escrow_due_at: fallbackOrder.escrow_due_at,
    buyer_confirmed_at: fallbackOrder.buyer_confirmed_at,
    buyer_reported_at: fallbackOrder.buyer_reported_at,
    escrow_released_at: fallbackOrder.escrow_released_at,
    escrow_release_reason: fallbackOrder.escrow_release_reason,
    refund_reference: fallbackOrder.refund_reference,
    refund_provider_status: fallbackOrder.refund_provider_status,
    scam_report_reason: fallbackOrder.scam_report_reason,
    scam_resolution_status: fallbackOrder.scam_resolution_status
  };

  return mapOrderReceipt(
    fallbackReceiptRow,
    fallbackStatusRow,
    fallbackSeller,
    ((previewRows ?? []) as Array<{ preview_url: string | null }>)[0]?.preview_url ?? null
  );
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

export async function hasPaidOrderWithCreator(creatorId: string, userId: string, userEmail?: string | null): Promise<boolean> {
  let query = supabase
    .from("orders")
    .select("id, assets!inner(creator_id)")
    .eq("status", "paid")
    .eq("assets.creator_id", creatorId)
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
  await syncDueOrderEscrows();

  const [{ count, error: countError }, { data: ordersData, error: ordersError }, { data: walletData, error: walletError }, { data: profileData, error: profileError }] =
    await Promise.all([
      supabase.from("assets").select("id", { count: "exact", head: true }).eq("creator_id", userId),
      supabase
        .from("orders")
        .select(
          `id,
          email,
          status,
          amount_kobo,
          currency,
          created_at,
          paid_at,
          commission_kobo,
          seller_net_amount_kobo,
          escrow_status,
          escrow_due_at,
          buyer_opened_at,
          buyer_confirmed_at,
          buyer_reported_at,
          escrow_released_at,
          escrow_release_reason,
          scam_report_reason,
          scam_resolution_status,
          scam_resolution_note,
          seller_issue_note,
          seller_moderation_action,
          refund_reference,
          refund_provider_status,
          asset:assets!inner(id, title, category, creator_id, delivery_mode, pricing_model, audio_preview_url, audio_genre, audio_bpm, audio_key, license_options, previews:asset_previews(id, preview_url), files:asset_files(id, file_type, file_size, original_name, file_role, sort_order))`
        )
        .eq("assets.creator_id", userId)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase.from("wallet").select("balance_kobo").eq("creator_id", userId).maybeSingle(),
      supabase.from("profiles").select("seller_account_status, seller_account_note").eq("id", userId).maybeSingle()
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
  if (profileError) {
    throw new Error(profileError.message);
  }

  const recentOrders = ((ordersData ?? []) as OrderRow[]).map(mapOrder);
  const releasedOrders = recentOrders.filter((order) => order.status === "paid" && order.escrow_status === "released");
  const pendingEscrowOrders = recentOrders.filter((order) => order.status === "paid" && order.escrow_status === "awaiting_review");
  const totalRevenueKobo = releasedOrders.reduce((total, order) => total + order.seller_net_amount_kobo, 0);
  const escrowPendingAmountKobo = pendingEscrowOrders.reduce((total, order) => total + order.seller_net_amount_kobo, 0);

  return {
    assetCount: count ?? 0,
    paidOrders: releasedOrders.length,
    escrowPendingOrders: pendingEscrowOrders.length,
    escrowPendingAmountKobo,
    totalRevenueKobo,
    walletBalanceKobo: walletData?.balance_kobo ?? 0,
    sellerAccountStatus: (profileData?.seller_account_status as CreatorDashboard["sellerAccountStatus"] | null) ?? "active",
    sellerAccountNote: profileData?.seller_account_note ?? null,
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

export async function isCurrentUserEditorialAdmin(userId: string) {
  const { data, error } = await supabase
    .from("editorial_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

function normalizePlatformSettings(row: PlatformSettingsRow | null | undefined): PlatformSocialSettings {
  return {
    instagram_handle: normalizePlatformSocialHandle("instagram", row?.instagram_handle ?? ""),
    x_handle: normalizePlatformSocialHandle("x", row?.x_handle ?? ""),
    tiktok_handle: normalizePlatformSocialHandle("tiktok", row?.tiktok_handle ?? ""),
    linkedin_handle: normalizePlatformSocialHandle("linkedin", row?.linkedin_handle ?? ""),
    facebook_handle: normalizePlatformSocialHandle("facebook", row?.facebook_handle ?? ""),
    whatsapp_channel: normalizePlatformSocialHandle("whatsapp", row?.whatsapp_channel ?? ""),
    support_email: normalizePlatformSupportEmail(row?.support_email ?? ""),
    admin_whatsapp_number: normalizeAdminWhatsAppNumber(row?.admin_whatsapp_number ?? ""),
    admin_whatsapp_message: normalizeAdminWhatsAppMessage(row?.admin_whatsapp_message ?? "")
  };
}

export async function getPlatformSocialSettings(): Promise<PlatformSocialSettings> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("singleton, instagram_handle, x_handle, tiktok_handle, linkedin_handle, facebook_handle, whatsapp_channel, support_email, admin_whatsapp_number, admin_whatsapp_message")
    .eq("singleton", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return normalizePlatformSettings((data ?? null) as PlatformSettingsRow | null);
}

export async function updatePlatformSocialSettings(input: PlatformSocialSettings): Promise<PlatformSocialSettings> {
  const payload = normalizePlatformSettings({
    singleton: true,
    instagram_handle: input.instagram_handle,
    x_handle: input.x_handle,
    tiktok_handle: input.tiktok_handle,
    linkedin_handle: input.linkedin_handle,
    facebook_handle: input.facebook_handle,
    whatsapp_channel: input.whatsapp_channel,
    support_email: input.support_email,
    admin_whatsapp_number: input.admin_whatsapp_number,
    admin_whatsapp_message: input.admin_whatsapp_message
  });

  const { data, error } = await supabase
    .from("platform_settings")
    .upsert(
      {
        singleton: true,
        ...payload
      },
      { onConflict: "singleton" }
    )
    .select("singleton, instagram_handle, x_handle, tiktok_handle, linkedin_handle, facebook_handle, whatsapp_channel, support_email, admin_whatsapp_number, admin_whatsapp_message")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to update platform settings");
  }

  return normalizePlatformSettings(data as PlatformSettingsRow);
}

export async function getAdminOverview(): Promise<AdminOverview> {
  await syncDueOrderEscrows();

  const [
    profileCountResult,
    adminCountResult,
    creatorIdsResult,
    pendingVerificationResult,
    totalAssetsResult,
    publishedAssetsResult,
    draftAssetsResult,
    archivedAssetsResult,
    totalOrdersResult,
    paidOrdersResult,
    pendingOrdersResult,
    failedOrdersResult,
    refundedOrdersResult,
    escrowPendingOrdersResult,
    scamReportedOrdersResult,
    paidOrderVolumeResult,
    payoutCountResult,
    editorialCountResult,
    assetReviewsCountResult,
    creatorReviewsCountResult,
    wishlistCountResult,
    followsCountResult
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("admins").select("user_id", { count: "exact", head: true }),
    supabase.from("assets").select("creator_id"),
    supabase.from("creator_verification_requests").select("creator_id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("assets").select("id", { count: "exact", head: true }),
    supabase.from("assets").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("assets").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("assets").select("id", { count: "exact", head: true }).eq("status", "archived"),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "refunded"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid").eq("escrow_status", "awaiting_review"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid").eq("escrow_status", "scam_reported"),
    supabase.from("orders").select("amount_kobo, currency").eq("status", "paid"),
    supabase.from("creator_payout_accounts").select("creator_id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("editorial_posts").select("id", { count: "exact", head: true }),
    supabase.from("asset_reviews").select("id", { count: "exact", head: true }),
    supabase.from("creator_reviews").select("id", { count: "exact", head: true }),
    supabase.from("wishlists").select("asset_id", { count: "exact", head: true }),
    supabase.from("creator_follows").select("creator_id", { count: "exact", head: true })
  ]);

  for (const result of [
    profileCountResult,
    adminCountResult,
    creatorIdsResult,
    pendingVerificationResult,
    totalAssetsResult,
    publishedAssetsResult,
    draftAssetsResult,
    archivedAssetsResult,
    totalOrdersResult,
    paidOrdersResult,
    pendingOrdersResult,
    failedOrdersResult,
    refundedOrdersResult,
    escrowPendingOrdersResult,
    scamReportedOrdersResult,
    paidOrderVolumeResult,
    payoutCountResult,
    editorialCountResult,
    assetReviewsCountResult,
    creatorReviewsCountResult,
    wishlistCountResult,
    followsCountResult
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const creatorIds = new Set<string>(((creatorIdsResult.data ?? []) as AdminOverviewAssetRow[]).map((asset) => asset.creator_id));
  const paidOrders = paidOrdersResult.count ?? 0;
  const pendingOrders = pendingOrdersResult.count ?? 0;
  const failedOrders = failedOrdersResult.count ?? 0;
  const refundedOrders = refundedOrdersResult.count ?? 0;
  const escrowPendingOrders = escrowPendingOrdersResult.count ?? 0;
  const scamReportedOrders = scamReportedOrdersResult.count ?? 0;
  const releasedOrders = Math.max(paidOrders - escrowPendingOrders - scamReportedOrders, 0);
  const volumeByCurrency = new Map<string, { amount_kobo: number; order_count: number }>();

  for (const order of (paidOrderVolumeResult.data ?? []) as AdminOverviewPaidOrderVolumeRow[]) {
    const currency = order.currency.toUpperCase();
    const current = volumeByCurrency.get(currency) ?? { amount_kobo: 0, order_count: 0 };
    current.amount_kobo += order.amount_kobo;
    current.order_count += 1;
    volumeByCurrency.set(currency, current);
  }

  return {
    total_profiles: profileCountResult.count ?? 0,
    active_creators: creatorIds.size,
    total_admins: adminCountResult.count ?? 0,
    pending_verification_requests: pendingVerificationResult.count ?? 0,
    total_assets: totalAssetsResult.count ?? 0,
    published_assets: publishedAssetsResult.count ?? 0,
    draft_assets: draftAssetsResult.count ?? 0,
    archived_assets: archivedAssetsResult.count ?? 0,
    total_orders: totalOrdersResult.count ?? 0,
    paid_orders: paidOrders,
    pending_orders: pendingOrders,
    failed_orders: failedOrders,
    refunded_orders: refundedOrders,
    escrow_pending_orders: escrowPendingOrders,
    released_orders: releasedOrders,
    scam_reported_orders: scamReportedOrders,
    order_volume: Array.from(volumeByCurrency.entries())
      .map(([currency, entry]) => ({
        currency,
        amount_kobo: entry.amount_kobo,
        order_count: entry.order_count
      }))
      .sort((left, right) => right.amount_kobo - left.amount_kobo),
    active_payout_accounts: payoutCountResult.count ?? 0,
    editorial_posts: editorialCountResult.count ?? 0,
    asset_reviews: assetReviewsCountResult.count ?? 0,
    creator_reviews: creatorReviewsCountResult.count ?? 0,
    wishlists: wishlistCountResult.count ?? 0,
    creator_follows: followsCountResult.count ?? 0
  };
}
export async function getAdminOrders(limit = 18): Promise<AdminOrderRecord[]> {
  await syncDueOrderEscrows();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `id,
      buyer_id,
      email,
      status,
      amount_kobo,
      currency,
      created_at,
      paid_at,
      commission_kobo,
      seller_net_amount_kobo,
      delivery_mode,
      delivery_external_url,
      escrow_status,
      escrow_due_at,
      buyer_opened_at,
      buyer_confirmed_at,
      buyer_reported_at,
      escrow_released_at,
      escrow_release_reason,
      scam_report_reason,
      scam_resolution_status,
      scam_resolution_note,
      seller_issue_note,
      seller_moderation_action,
      refund_reference,
      refund_provider_status,
      asset:assets(
        id,
        title,
        category,
        creator_id,
        profile:profiles!assets_creator_id_fkey(${PROFILE_FIELDS_SELECT})
      ),
      payment:payments(provider, reference, status, updated_at)`
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AdminOrderRow[]).map((row) => {
    const asset = normalizeJoinedRecord(row.asset);
    const creator = normalizeJoinedRecord(asset?.profile);
    const payment = normalizeJoinedRecord(row.payment);

    return {
      id: row.id,
      buyer_id: row.buyer_id,
      email: row.email,
      status: row.status,
      amount_kobo: row.amount_kobo,
      currency: row.currency,
      created_at: row.created_at,
      paid_at: row.paid_at,
      commission_kobo: row.commission_kobo ?? 0,
      seller_net_amount_kobo: row.seller_net_amount_kobo ?? Math.max(row.amount_kobo - (row.commission_kobo ?? 0), 0),
      escrow_status: row.escrow_status ?? (row.status === "paid" ? "released" : null),
      escrow_due_at: row.escrow_due_at,
      buyer_opened_at: row.buyer_opened_at,
      buyer_confirmed_at: row.buyer_confirmed_at,
      buyer_reported_at: row.buyer_reported_at,
      escrow_released_at: row.escrow_released_at,
      escrow_release_reason: row.escrow_release_reason,
      scam_report_reason: row.scam_report_reason,
      scam_resolution_status: row.scam_resolution_status ?? null,
      scam_resolution_note: row.scam_resolution_note ?? null,
      seller_issue_note: row.seller_issue_note ?? null,
      seller_moderation_action: row.seller_moderation_action ?? null,
      refund_reference: row.refund_reference ?? null,
      refund_provider_status: row.refund_provider_status ?? null,
      payment: payment
        ? {
            provider: payment.provider,
            reference: payment.reference,
            status: payment.status,
            updated_at: payment.updated_at
          }
        : null,
      asset: asset
        ? {
            id: asset.id,
            title: asset.title,
            category: asset.category,
            creator_id: asset.creator_id,
            creator: creator
              ? {
                  display_name: creator.display_name,
                  avatar_url: creator.avatar_url,
                  creator_category: creator.creator_category ?? "General",
                  is_verified: Boolean(creator.is_verified),
                  seller_account_status: (creator.seller_account_status as "active" | "warned" | "suspended" | null) ?? "active",
                  seller_account_note: creator.seller_account_note ?? null
                }
              : null
          }
        : null
    };
  });
}

export async function reviewCreatorVerificationRequest(creatorId: string, decision: "approve" | "reject", reviewNote = "") {
  const { data, error } = await supabase.rpc("review_creator_verification_request", {
    p_creator_id: creatorId,
    p_decision: decision,
    p_review_note: reviewNote.trim()
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("Verification review did not return an updated record.");
  }

  return {
    creator_id: String(row.creator_id ?? creatorId),
    status: row.status as CreatorVerificationStatus,
    is_verified: Boolean(row.is_verified),
    review_note: typeof row.review_note === "string" ? row.review_note : null,
    reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null
  };
}

export async function getAdminCreators(limit?: number): Promise<AdminCreatorRecord[]> {
  let profilesQuery = supabase
    .from("profiles")
    .select("id, display_name, bio, avatar_url, creator_category, niche, sales_count, is_verified, created_at, seller_account_status, seller_account_note")
    .order("created_at", { ascending: false });

  if (typeof limit === "number") {
    profilesQuery = profilesQuery.limit(limit);
  }

  const { data: profiles, error: profilesError } = await profilesQuery;

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const creatorList = (profiles ?? []) as CreatorProfileRow[];
  if (creatorList.length === 0) {
    return [];
  }

  const creatorIds = creatorList.map((profile) => profile.id);

  const [assetsResult, walletsResult, payoutAccountsResult, followsResult, verificationResult] = await Promise.all([
    supabase.from("assets").select("creator_id, status, created_at").in("creator_id", creatorIds),
    supabase.from("wallet").select("creator_id, balance_kobo").in("creator_id", creatorIds),
    supabase
      .from("creator_payout_accounts")
      .select("creator_id, status, country, payout_type, settlement_bank_name, updated_at")
      .in("creator_id", creatorIds),
    supabase.from("creator_follows").select("creator_id").in("creator_id", creatorIds),
    supabase.from("creator_verification_requests").select(CREATOR_VERIFICATION_SELECT).in("creator_id", creatorIds)
  ]);

  if (assetsResult.error) {
    throw new Error(assetsResult.error.message);
  }
  if (walletsResult.error) {
    throw new Error(walletsResult.error.message);
  }
  if (payoutAccountsResult.error) {
    throw new Error(payoutAccountsResult.error.message);
  }
  if (followsResult.error) {
    throw new Error(followsResult.error.message);
  }
  if (verificationResult.error) {
    throw new Error(verificationResult.error.message);
  }

  const assetStats = new Map<
    string,
    {
      asset_count: number;
      published_assets: number;
      draft_assets: number;
      archived_assets: number;
      latest_asset_at: string | null;
    }
  >();

  for (const row of (assetsResult.data ?? []) as CreatorAssetStatRow[]) {
    const existing = assetStats.get(row.creator_id) ?? {
      asset_count: 0,
      published_assets: 0,
      draft_assets: 0,
      archived_assets: 0,
      latest_asset_at: null
    };

    existing.asset_count += 1;
    if (row.status === "published") {
      existing.published_assets += 1;
    } else if (row.status === "draft") {
      existing.draft_assets += 1;
    } else {
      existing.archived_assets += 1;
    }

    if (!existing.latest_asset_at || Date.parse(row.created_at) > Date.parse(existing.latest_asset_at)) {
      existing.latest_asset_at = row.created_at;
    }

    assetStats.set(row.creator_id, existing);
  }

  const walletByCreator = new Map(
    ((walletsResult.data ?? []) as WalletRow[]).map((row) => [row.creator_id, Number(row.balance_kobo ?? 0)])
  );

  const payoutByCreator = new Map(
    ((payoutAccountsResult.data ?? []) as AdminCreatorPayoutRow[]).map((row) => [row.creator_id, row])
  );

  const followerCounts = new Map<string, number>();
  for (const row of (followsResult.data ?? []) as CreatorFollowRow[]) {
    followerCounts.set(row.creator_id, (followerCounts.get(row.creator_id) ?? 0) + 1);
  }

  const verificationByCreator = new Map(
    ((verificationResult.data ?? []) as CreatorVerificationRequestRow[]).map((row) => [row.creator_id, mapCreatorVerificationRequest(row)])
  );

  return creatorList.map((profile) => {
    const stats = assetStats.get(profile.id) ?? {
      asset_count: 0,
      published_assets: 0,
      draft_assets: 0,
      archived_assets: 0,
      latest_asset_at: null
    };
    const payout = payoutByCreator.get(profile.id) ?? null;

    return {
      id: profile.id,
      display_name: profile.display_name,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      creator_category: profile.creator_category ?? "General",
      niche: profile.niche,
      sales_count: profile.sales_count ?? 0,
      is_verified: Boolean(profile.is_verified),
      created_at: profile.created_at,
      asset_count: stats.asset_count,
      published_assets: stats.published_assets,
      draft_assets: stats.draft_assets,
      archived_assets: stats.archived_assets,
      latest_asset_at: stats.latest_asset_at,
      follower_count: followerCounts.get(profile.id) ?? 0,
      wallet_balance_kobo: walletByCreator.get(profile.id) ?? 0,
      seller_account_status: (profile.seller_account_status as AdminCreatorRecord["seller_account_status"] | null) ?? "active",
      seller_account_note: profile.seller_account_note ?? null,
      verification_request: verificationByCreator.get(profile.id) ?? null,
      payout_account: payout
        ? {
            status: payout.status,
            country: payout.country,
            payout_type: payout.payout_type,
            settlement_bank_name: payout.settlement_bank_name,
            updated_at: payout.updated_at
          }
        : null
    };
  });
}

type AdminAssetSnapshotRow = {
  id: string;
  creator_id: string;
  title: string;
  category: string;
  status: Asset["status"];
  created_at: string;
  profile?: AssetProfileRow | AssetProfileRow[] | null;
};

export async function getAdminAssetSnapshots(limit = 4): Promise<Asset[]> {
  const { data, error } = await supabase
    .from("assets")
    .select(`id, creator_id, title, category, status, created_at, profile:profiles!assets_creator_id_fkey(${PROFILE_FIELDS_SELECT})`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AdminAssetSnapshotRow[]).map((row) => {
    const profile = normalizeJoinedRecord(row.profile);

    return {
      id: row.id,
      creator_id: row.creator_id,
      title: row.title,
      description: "",
      category: row.category,
      tags: [],
      price_kobo: 0,
      minimum_price_kobo: 0,
      currency: "GHS",
      delivery_mode: "file",
      external_delivery_url: null,
      pricing_model: "free",
      audio_preview_url: null,
      audio_genre: null,
      audio_bpm: null,
      audio_key: null,
      license_options: [],
      sold_count: 0,
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
      previews: [],
      files: []
    };
  });
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
      minimum_price_kobo,
      currency,
      delivery_mode,
      external_delivery_url,
      pricing_model,
      audio_preview_url,
      audio_genre,
      audio_bpm,
      audio_key,
      license_options,
      status,
      created_at,
      profile:profiles!assets_creator_id_fkey(${PROFILE_FIELDS_SELECT}),
      previews:asset_previews(id, preview_url),
      files:asset_files(id, file_type, file_size, original_name, file_role, sort_order)`
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return attachAssetRatingSummaries((data as AssetRow[]).map(mapAsset));
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
      minimum_price_kobo,
      currency,
      delivery_mode,
      external_delivery_url,
      pricing_model,
      audio_preview_url,
      audio_genre,
      audio_bpm,
      audio_key,
      license_options,
      status,
      created_at,
      profile:profiles!assets_creator_id_fkey(${PROFILE_FIELDS_SELECT}),
      previews:asset_previews(id, preview_url),
      files:asset_files(id, file_type, file_size, original_name, file_role, sort_order)`
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to update asset status");
  }

  const [asset] = await attachAssetRatingSummaries([mapAsset(data as AssetRow)]);
  return asset;
}







