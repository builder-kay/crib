import { z } from "zod";
import { DEFAULT_HIRE_TERMS } from "@/lib/hire";

export const ASSET_CATEGORIES = [
  "Figma Templates",
  "Canva Templates",
  "Photoshop Templates",
  "Illustrator Templates",
  "InDesign Templates",
  "Lightroom Presets",
  "Premiere Pro Templates",
  "After Effects Templates",
  "Creative Cloud Bundles",
  "Other Creative Cloud Assets"
] as const;

export const ADOBE_APP_CATEGORIES = [
  "Photoshop Templates",
  "Illustrator Templates",
  "InDesign Templates",
  "Lightroom Presets",
  "Premiere Pro Templates",
  "After Effects Templates"
] as const;

export const MARKET_FILE_FILTERS = [
  { value: "all", label: "Any format" },
  { value: "editable", label: "Editable files" },
  { value: "document", label: "Documents / PDF" },
  { value: "image", label: "Images / exports" },
  { value: "motion", label: "Motion / video" },
  { value: "bundle", label: "Bundles / ZIP" }
] as const;

export const PRIMARY_ASSET_ACCEPT =
  ".zip,.pdf,.psd,.psb,.ai,.eps,.indd,.indt,.idml,.aep,.aet,.mogrt,.prproj,.prfpset,.xmp,.lrtemplate,.lrcat,.fig,.figjam,.sketch,.xd,.svg,.jpg,.jpeg,.png";

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
  x: z.string().max(120).optional().or(z.literal("")),
  hire_enabled: z.boolean().default(true),
  hire_terms: z.string().min(40).max(2400).default(DEFAULT_HIRE_TERMS)
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const payoutAccountSchema = z.object({
  payout_type: z.enum(["bank", "mobile_money"]).default("bank"),
  country: z.string().min(2).max(40).optional().or(z.literal("")),
  business_name: z.string().min(2).max(120),
  settlement_bank_code: z.string().min(2).max(20),
  settlement_bank_name: z.string().max(120).optional().or(z.literal("")),
  account_number: z.string().regex(/^\d{6,20}$/, "Account number must be 6 to 20 digits")
});

export type PayoutAccountInput = z.infer<typeof payoutAccountSchema>;

export const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().min(2).max(80).optional()
});

export type AuthInput = z.infer<typeof authSchema>;
