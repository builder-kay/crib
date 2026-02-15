import { z } from "zod";

export const ASSET_CATEGORIES = [
  "Templates",
  "Beats",
  "Presets",
  "UI Kits",
  "Fonts",
  "Photos",
  "Videos",
  "Mockups",
  "Other"
] as const;

export const uploadAssetSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(4000),
  category: z.enum(ASSET_CATEGORIES),
  tags: z.string().max(200).default(""),
  price: z.coerce.number().min(0.5),
  currency: z.string().min(3).max(6).default("GHS"),
  status: z.enum(["draft", "published"]).default("published")
});

export type UploadAssetInput = z.infer<typeof uploadAssetSchema>;

export const profileSchema = z.object({
  display_name: z.string().min(2).max(80),
  bio: z.string().min(20).max(280),
  creator_category: z.string().min(2).max(80),
  niche: z.string().max(80).optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  instagram: z.string().max(120).optional().or(z.literal("")),
  x: z.string().max(120).optional().or(z.literal(""))
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().min(2).max(80).optional()
});

export type AuthInput = z.infer<typeof authSchema>;
