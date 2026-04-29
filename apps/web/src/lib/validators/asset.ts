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
  "Audio / Beats",
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

export const ASSET_TYPES = ["canva", "figma", "adobe", "audio", "other"] as const;
export const CANVA_ASSET_CATEGORIES = ["Canva Templates"] as const;
export const FIGMA_ASSET_CATEGORIES = ["Figma Templates"] as const;
export const AUDIO_ASSET_CATEGORIES = ["Audio / Beats"] as const;
export const OTHER_ASSET_CATEGORIES = ["Creative Cloud Bundles", "Other Creative Cloud Assets"] as const;
export const PRICING_MODE_OPTIONS = ["free", "paid", "pay_what_you_want"] as const;
export const DELIVERY_MODE_OPTIONS = ["file", "external_link"] as const;
export const AUDIO_LICENSE_OPTIONS = ["personal_use", "commercial_use", "exclusive_rights"] as const;
export const HIRE_PRICING_MODE_OPTIONS = ["hourly", "custom_list", "dm_to_know"] as const;
export const AUDIO_GENRE_OPTIONS = [
  "Afrobeats",
  "Amapiano",
  "Drill",
  "Gospel",
  "Hip Hop",
  "House",
  "Lo-fi",
  "Pop",
  "R&B",
  "Trap"
] as const;

export const MARKET_FILE_FILTERS = [
  { value: "all", label: "Any format" },
  { value: "editable", label: "Editable files" },
  { value: "audio", label: "Audio / stems" },
  { value: "document", label: "Documents / PDF" },
  { value: "image", label: "Images / exports" },
  { value: "motion", label: "Motion / video" },
  { value: "bundle", label: "Bundles / ZIP" },
  { value: "link", label: "Access links" }
] as const;

export const PRIMARY_ASSET_ACCEPT =
  ".zip,.pdf,.psd,.psb,.ai,.eps,.indd,.indt,.idml,.aep,.aet,.mogrt,.prproj,.prfpset,.xmp,.lrtemplate,.lrcat,.fig,.figjam,.sketch,.xd,.svg,.jpg,.jpeg,.png";
export const AUDIO_PREVIEW_ACCEPT = ".mp3,.wav";
export const AUDIO_BUNDLE_ACCEPT = ".zip";

function normalizeExternalUrl(value: string) {
  return value.trim();
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function hostIncludes(value: string, expected: string) {
  try {
    return new URL(value).hostname.toLowerCase().includes(expected);
  } catch {
    return false;
  }
}

export const uploadAssetSchema = z
  .object({
    title: z.string().min(3).max(120),
    description: z.string().min(10).max(4000),
    asset_type: z.enum(ASSET_TYPES),
    category: z.enum(ASSET_CATEGORIES),
    tags: z.string().max(200).default(""),
    price: z.coerce.number().min(0),
    minimum_price: z.coerce.number().min(0).default(0),
    currency: z.string().min(3).max(6).default("GHS"),
    pricing_model: z.enum(PRICING_MODE_OPTIONS).default("paid"),
    delivery_mode: z.enum(DELIVERY_MODE_OPTIONS).default("file"),
    external_delivery_url: z.string().max(2000).default(""),
    audio_genre: z.string().max(80).default(""),
    audio_bpm: z.coerce.number().int().min(1).max(400).optional().nullable(),
    audio_key: z.string().max(40).default(""),
    license_options: z.array(z.enum(AUDIO_LICENSE_OPTIONS)).default([]),
    status: z.enum(["draft", "published"]).default("published")
  })
  .superRefine((value, context) => {
    const externalUrl = normalizeExternalUrl(value.external_delivery_url);
    const audioGenre = value.audio_genre.trim();
    const audioKey = value.audio_key.trim();

    if (value.asset_type === "canva") {
      if (!(CANVA_ASSET_CATEGORIES as readonly string[]).includes(value.category)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["category"],
          message: "Canva listings must stay in Canva Templates."
        });
      }

      if (value.delivery_mode !== "external_link") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["delivery_mode"],
          message: "Canva templates are delivered as template links."
        });
      }

      if (!externalUrl || !hostIncludes(externalUrl, "canva.com")) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["external_delivery_url"],
          message: "Paste a valid Canva template link."
        });
      }
    }

    if (value.asset_type === "figma" && !(FIGMA_ASSET_CATEGORIES as readonly string[]).includes(value.category)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: "Figma listings must stay in Figma Templates."
      });
    }

    if (
      value.asset_type === "adobe" &&
      !([...ADOBE_APP_CATEGORIES, "Creative Cloud Bundles"] as readonly string[]).includes(value.category)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: "Choose an Adobe category for this listing."
      });
    }

    if (value.asset_type === "audio") {
      if (!(AUDIO_ASSET_CATEGORIES as readonly string[]).includes(value.category)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["category"],
          message: "Audio listings must stay in Audio / Beats."
        });
      }

      if (value.delivery_mode !== "file") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["delivery_mode"],
          message: "Audio / Beats listings are delivered as files."
        });
      }

      if (!audioGenre) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["audio_genre"],
          message: "Choose the beat genre."
        });
      }

      if (typeof value.audio_bpm !== "number" || !Number.isFinite(value.audio_bpm)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["audio_bpm"],
          message: "Add the BPM for this beat."
        });
      }

      if (!audioKey) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["audio_key"],
          message: "Add the musical key."
        });
      }

      if (value.license_options.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["license_options"],
          message: "Choose at least one license type."
        });
      }
    }

    if (value.asset_type === "other" && !(OTHER_ASSET_CATEGORIES as readonly string[]).includes(value.category)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: "Other listings should use the generic design categories."
      });
    }

    if (value.delivery_mode === "external_link") {
      if (!externalUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["external_delivery_url"],
          message: "Paste the template access link buyers should receive."
        });
      } else if (!isHttpUrl(externalUrl)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["external_delivery_url"],
          message: "Use a full http or https template link."
        });
      }

      if (value.asset_type === "figma" && externalUrl && !hostIncludes(externalUrl, "figma.com")) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["external_delivery_url"],
          message: "Paste a valid Figma file link."
        });
      }
    }

    if (value.delivery_mode === "file" && externalUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["external_delivery_url"],
        message: "Remove the link when this template is delivered as a file upload."
      });
    }

    if (value.pricing_model === "free") {
      if (value.price !== 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["price"],
          message: "Free listings must have a price of 0."
        });
      }
      if (value.minimum_price !== 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["minimum_price"],
          message: "Free listings cannot have a minimum price."
        });
      }
    }

    if (value.pricing_model === "paid") {
      if (value.price < 0.5) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["price"],
          message: "Paid listings must be at least 0.50 in the selected currency."
        });
      }
      if (value.minimum_price !== value.price) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["minimum_price"],
          message: "For fixed-price listings, minimum price must match the selling price."
        });
      }
    }

    if (value.pricing_model === "pay_what_you_want" && value.price < value.minimum_price) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: "Suggested price must be at least the minimum buyer amount."
      });
    }
  });

export type UploadAssetInput = z.infer<typeof uploadAssetSchema>;

const optionalProfileNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return value;
}, z.number().finite().nonnegative().nullable().optional());

export const profileSchema = z.object({
  display_name: z.string().min(2).max(80),
  bio: z.string().min(20).max(280),
  creator_category: z.string().min(2).max(80),
  niche: z.string().max(80).optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  instagram: z.string().max(120).optional().or(z.literal("")),
  x: z.string().max(120).optional().or(z.literal("")),
  hire_enabled: z.boolean().default(true),
  hire_terms: z.string().min(40).max(2400).default(DEFAULT_HIRE_TERMS),
  hire_pricing_mode: z.enum(HIRE_PRICING_MODE_OPTIONS).default("dm_to_know"),
  hire_hourly_rate: optionalProfileNumber,
  hire_pricing_currency: z.string().min(3).max(6).default("GHS"),
  hire_pricing_guide: z.string().max(1600).optional().or(z.literal("")).default("")
}).superRefine((value, context) => {
  const pricingGuide = value.hire_pricing_guide.trim();
  const pricingCurrency = value.hire_pricing_currency.trim();

  if (value.hire_pricing_mode === "hourly") {
    if (typeof value.hire_hourly_rate !== "number" || !Number.isFinite(value.hire_hourly_rate) || value.hire_hourly_rate < 0.5) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hire_hourly_rate"],
        message: "Set an hourly rate of at least 0.50."
      });
    }

    if (pricingCurrency.length < 3) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hire_pricing_currency"],
        message: "Add a 3-letter currency code."
      });
    }
  }

  if (value.hire_pricing_mode === "custom_list" && pricingGuide.length < 8) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["hire_pricing_guide"],
      message: "Add a short pricing list clients can review."
    });
  }
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

