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

export type Asset = {
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

export type Order = {
  id: string;
  email: string;
  email_token?: string;
  status: "pending" | "paid" | "failed" | "refunded";
  amount_kobo: number;
  currency: string;
  created_at: string;
  asset?: Pick<Asset, "id" | "title" | "category" | "files"> & {
    previews?: AssetPreview[];
  };
};

export type CreatorDashboard = {
  assetCount: number;
  totalRevenueKobo: number;
  paidOrders: number;
  walletBalanceKobo: number;
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
};

export type ReleaseNotification = {
  id: string;
  created_at: string;
  read_at: string | null;
  delivery_status: "pending" | "sent" | "dismissed" | "failed";
  creator_id: string;
  follower_id: string;
  asset_id: string;
  creator_name: string;
  asset_title: string;
};

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
        creator: Pick<Profile, "display_name" | "avatar_url" | "creator_category" | "is_verified"> | null;
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
