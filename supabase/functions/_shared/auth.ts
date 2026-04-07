import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type AuthIdentity = {
  user_id: string;
  phone: string | null;
  email: string | null;
  display_name: string | null;
};

export type NormalizedPhone = {
  e164: string;
  digits: string;
};

export type ArkeselSupportedCountry = {
  code: string;
  country: string;
  dialCode: string;
};

export const ARKESEL_SUPPORTED_COUNTRIES: ArkeselSupportedCountry[] = [
  { code: "GH", country: "Ghana", dialCode: "233" },
  { code: "NG", country: "Nigeria", dialCode: "234" },
  { code: "KE", country: "Kenya", dialCode: "254" },
  { code: "TZ", country: "Tanzania", dialCode: "255" },
  { code: "ZA", country: "South Africa", dialCode: "27" }
];

const GHANA_MOBILE_PREFIXES = new Set([
  "20",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "50",
  "53",
  "54",
  "55",
  "56",
  "57",
  "59"
]);

export function createServiceRoleClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role environment variables");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const value = input.trim().toLowerCase();
  if (!value) {
    return null;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(value) ? value : null;
}

export function looksLikeEmail(input: string): boolean {
  return input.includes("@");
}

function normalizeGhanaPhoneDigits(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  const nationalNumber = digits.startsWith("233")
    ? digits.slice(3)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;

  if (!/^\d{9}$/.test(nationalNumber)) {
    return null;
  }

  if (!GHANA_MOBILE_PREFIXES.has(nationalNumber.slice(0, 2))) {
    return null;
  }

  return `233${nationalNumber}`;
}

export function normalizePhone(input: unknown): NormalizedPhone | null {
  if (typeof input !== "string") {
    return null;
  }

  const stripped = input.trim().replace(/[^\d+]/g, "");
  if (!stripped) {
    return null;
  }

  const normalizedDigits = stripped.startsWith("+")
    ? stripped.slice(1)
    : normalizeGhanaPhoneDigits(stripped) ?? stripped;

  if (!/^[1-9]\d{9,14}$/.test(normalizedDigits)) {
    return null;
  }

  return {
    e164: `+${normalizedDigits}`,
    digits: normalizedDigits
  };
}

export function getArkeselSupportedCountryForPhone(input: string | NormalizedPhone | null | undefined): ArkeselSupportedCountry | null {
  const normalized =
    typeof input === "string"
      ? normalizePhone(input)
      : input && typeof input === "object" && "digits" in input && typeof input.digits === "string"
        ? input
        : null;

  if (!normalized) {
    return null;
  }

  return ARKESEL_SUPPORTED_COUNTRIES.find((country) => normalized.digits.startsWith(country.dialCode)) ?? null;
}

export function isArkeselSupportedPhone(input: string | NormalizedPhone | null | undefined): boolean {
  return Boolean(getArkeselSupportedCountryForPhone(input));
}

export function getArkeselSupportedCountryNames() {
  return ARKESEL_SUPPORTED_COUNTRIES.map((country) => country.country);
}

export function maskPhone(input: string | null | undefined): string {
  const normalized = normalizePhone(input ?? "");
  if (!normalized) {
    return "hidden";
  }

  const digits = normalized.digits;
  if (digits.length <= 4) {
    return digits;
  }

  const visibleStart = digits.slice(0, Math.min(3, digits.length - 4));
  const visibleEnd = digits.slice(-4);
  return `+${visibleStart}${"*".repeat(Math.max(0, digits.length - visibleStart.length - 4))}${visibleEnd}`;
}

export async function lookupAuthIdentity(
  supabase: ReturnType<typeof createServiceRoleClient>,
  input: {
    phone?: string | null;
    email?: string | null;
  }
): Promise<AuthIdentity | null> {
  const { data, error } = await supabase.rpc("lookup_auth_identity", {
    p_phone: input.phone ?? null,
    p_email: input.email ?? null
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return null;
  }

  return row as AuthIdentity;
}

export function getUserContactEmail(user: { email?: string | null; user_metadata?: Record<string, unknown> | null }): string | null {
  return normalizeEmail(user.email) ?? normalizeEmail(user.user_metadata?.contact_email);
}
