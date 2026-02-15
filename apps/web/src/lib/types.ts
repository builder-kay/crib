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
  profile?: Pick<Profile, "display_name" | "avatar_url" | "niche" | "creator_category" | "sales_count" | "is_verified"> | null;
  previews?: AssetPreview[];
  files?: AssetFile[];
};

export type Order = {
  id: string;
  email: string;
  email_token?: string;
  status: "pending" | "paid" | "failed" | "refunded";
  amount_kobo: number;
  currency: string;
  created_at: string;
  asset?: Pick<Asset, "id" | "title" | "category"> & {
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
};
