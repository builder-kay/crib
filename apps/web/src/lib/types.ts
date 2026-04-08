export type Profile = {
  id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  creator_category: string;
  niche: string | null;
  sales_count: number;
  is_verified: boolean;
  socials: Record<string, string>;
  seller_account_status: SellerAccountStatus;
  seller_account_note: string | null;
  hire_enabled: boolean;
  hire_terms: string;
  verification: CreatorVerificationRequest | null;
};

export type ProfileVerificationField =
  | "avatar"
  | "display_name"
  | "creator_category"
  | "niche"
  | "bio"
  | "social_link"
  | "payout_details";
export type CreatorVerificationStatus = "incomplete" | "pending" | "approved" | "rejected";

export type CreatorVerificationRequest = {
  creator_id: string;
  status: CreatorVerificationStatus;
  is_profile_complete: boolean;
  missing_fields: ProfileVerificationField[];
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
};

export type RatingSummary = {
  average_rating: number;
  review_count: number;
};

export type AssetPreview = {
  id: string;
  preview_url: string;
};

export type AssetFile = {
  id: string;
  file_type: string;
  file_size: number;
  original_name: string;
};

export type AssetDeliveryMode = "file" | "external_link";
export type AssetPricingModel = "free" | "paid" | "pay_what_you_want";

export type Asset = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price_kobo: number;
  minimum_price_kobo: number;
  currency: string;
  delivery_mode: AssetDeliveryMode;
  external_delivery_url: string | null;
  pricing_model: AssetPricingModel;
  sold_count: number;
  status: "draft" | "published" | "archived";
  created_at: string;
  average_rating?: number;
  review_count?: number;
  profile?: Pick<Profile, "display_name" | "avatar_url" | "niche" | "creator_category" | "sales_count" | "is_verified"> | null;
  previews?: AssetPreview[];
  files?: AssetFile[];
};

export type AssetReview = {
  id: string;
  asset_id: string;
  reviewer_id: string;
  rating: number;
  review_text: string;
  created_at: string;
  updated_at: string;
  reviewer: Pick<Profile, "id" | "display_name" | "avatar_url"> | null;
};

export type CreatorReview = {
  id: string;
  creator_id: string;
  reviewer_id: string;
  rating: number;
  review_text: string;
  created_at: string;
  updated_at: string;
  reviewer: Pick<Profile, "id" | "display_name" | "avatar_url"> | null;
};

export type OrderEscrowStatus = "awaiting_review" | "released" | "scam_reported";
export type OrderScamResolutionStatus = "pending_review" | "genuine_released" | "buyer_refunded";
export type SellerModerationAction = "none" | "warned" | "suspended";
export type SellerAccountStatus = "active" | "warned" | "suspended";

export type Order = {
  id: string;
  email: string;
  status: "pending" | "paid" | "failed" | "refunded";
  amount_kobo: number;
  currency: string;
  created_at: string;
  paid_at?: string | null;
  commission_kobo: number;
  seller_net_amount_kobo: number;
  delivery_mode: AssetDeliveryMode;
  delivery_external_url: string | null;
  escrow_status: OrderEscrowStatus | null;
  escrow_due_at: string | null;
  buyer_opened_at: string | null;
  buyer_confirmed_at: string | null;
  buyer_reported_at: string | null;
  escrow_released_at: string | null;
  escrow_release_reason: string | null;
  scam_report_reason: string | null;
  scam_resolution_status: OrderScamResolutionStatus | null;
  scam_resolution_note: string | null;
  seller_issue_note: string | null;
  seller_moderation_action: SellerModerationAction | null;
  refund_reference: string | null;
  refund_provider_status: string | null;
  asset?: Pick<Asset, "id" | "title" | "category" | "files" | "delivery_mode" | "pricing_model"> & {
    previews?: AssetPreview[];
  };
};

export type OrderReceipt = {
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
  order_status: Order["status"];
  order_created_at: string;
  escrow_status: OrderEscrowStatus | null;
  escrow_due_at: string | null;
  buyer_confirmed_at: string | null;
  buyer_reported_at: string | null;
  escrow_released_at: string | null;
  escrow_release_reason: string | null;
  refund_reference: string | null;
  refund_provider_status: string | null;
  scam_report_reason: string | null;
  scam_resolution_status: OrderScamResolutionStatus | null;
  asset_preview_url: string | null;
  seller:
    | {
        avatar_url: string | null;
        creator_category: string;
        is_verified: boolean;
      }
    | null;
};

export type CreatorDashboard = {
  assetCount: number;
  totalRevenueKobo: number;
  paidOrders: number;
  escrowPendingOrders: number;
  escrowPendingAmountKobo: number;
  walletBalanceKobo: number;
  sellerAccountStatus: SellerAccountStatus;
  sellerAccountNote: string | null;
  recentOrders: Order[];
};

export type CreatorDirectoryEntry = {
  id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  creator_category: string;
  niche: string | null;
  sales_count: number;
  is_verified: boolean;
  created_at: string;
  published_assets: number;
  latest_asset_at: string | null;
  trending_score: number;
  editor_pick: boolean;
  follower_count: number;
  average_rating: number;
  review_count: number;
  hire_enabled: boolean;
  featured_preview_urls: string[];
};

export type NotificationDeliveryStatus = "pending" | "sent" | "dismissed" | "failed";

export type ReleaseNotification = {
  kind: "release";
  id: string;
  created_at: string;
  read_at: string | null;
  delivery_status: NotificationDeliveryStatus;
  creator_id: string;
  follower_id: string;
  asset_id: string;
  creator_name: string;
  asset_title: string;
};

export type HireRequestNotification = {
  kind: "hire_request";
  id: string;
  created_at: string;
  read_at: string | null;
  delivery_status: NotificationDeliveryStatus;
  creator_id: string;
  requester_id: string;
  requester_name: string;
  requester_email: string | null;
  requester_avatar_url: string | null;
  terms_snapshot: string;
};

export type AccountNotification = ReleaseNotification | HireRequestNotification;

export type CreatorFunnelSummary = {
  asset_views: number;
  asset_clicks: number;
  checkout_starts: number;
  purchases: number;
};

export type AdminCurrencySummary = {
  currency: string;
  amount_kobo: number;
  order_count: number;
};

export type PlatformSocialSettings = {
  instagram_handle: string;
  x_handle: string;
  tiktok_handle: string;
  linkedin_handle: string;
  facebook_handle: string;
  whatsapp_channel: string;
  support_email: string;
  admin_whatsapp_number: string;
  admin_whatsapp_message: string;
};

export type AdminOverview = {
  total_profiles: number;
  active_creators: number;
  total_admins: number;
  total_assets: number;
  published_assets: number;
  draft_assets: number;
  archived_assets: number;
  total_orders: number;
  paid_orders: number;
  pending_orders: number;
  failed_orders: number;
  refunded_orders: number;
  escrow_pending_orders: number;
  released_orders: number;
  scam_reported_orders: number;
  order_volume: AdminCurrencySummary[];
  active_payout_accounts: number;
  editorial_posts: number;
  asset_reviews: number;
  creator_reviews: number;
  wishlists: number;
  creator_follows: number;
};

export type AdminOrderRecord = {
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
  escrow_status: OrderEscrowStatus | null;
  escrow_due_at: string | null;
  buyer_opened_at: string | null;
  buyer_confirmed_at: string | null;
  buyer_reported_at: string | null;
  escrow_released_at: string | null;
  escrow_release_reason: string | null;
  scam_report_reason: string | null;
  scam_resolution_status: OrderScamResolutionStatus | null;
  scam_resolution_note: string | null;
  seller_issue_note: string | null;
  seller_moderation_action: SellerModerationAction | null;
  refund_reference: string | null;
  refund_provider_status: string | null;
  payment:
    | {
        provider: string;
        reference: string;
        status: "pending" | "paid" | "failed" | "refunded";
        updated_at: string | null;
      }
    | null;
  asset:
    | {
        id: string;
        title: string;
        category: string;
        creator_id: string;
        creator: Pick<Profile, "display_name" | "avatar_url" | "creator_category" | "is_verified" | "seller_account_status" | "seller_account_note"> | null;
      }
    | null;
};

export type AdminCreatorRecord = {
  id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  creator_category: string;
  niche: string | null;
  sales_count: number;
  is_verified: boolean;
  created_at: string;
  asset_count: number;
  published_assets: number;
  draft_assets: number;
  archived_assets: number;
  latest_asset_at: string | null;
  follower_count: number;
  wallet_balance_kobo: number;
  seller_account_status: SellerAccountStatus;
  seller_account_note: string | null;
  verification_request: CreatorVerificationRequest | null;
  payout_account:
    | {
        status: "active" | "inactive";
        country: string;
        payout_type: "bank" | "mobile_money";
        settlement_bank_name: string | null;
        updated_at: string;
      }
    | null;
};

export type PayoutAccount = {
  provider: "paystack";
  status: "active" | "inactive";
  payout_type: "bank" | "mobile_money";
  country: string;
  business_name: string;
  subaccount_code: string;
  settlement_bank_code: string;
  settlement_bank_name: string | null;
  account_number_last4: string;
  account_name: string | null;
  updated_at: string;
};

export type PayoutBank = {
  code: string;
  name: string;
};





