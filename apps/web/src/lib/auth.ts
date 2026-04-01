import type { User } from "@supabase/supabase-js";

export type ArkeselSupportedCountry = {
  code: string;
  country: string;
  dialCode: string;
  exampleLocalNumber: string;
};

export const ARKESEL_SUPPORTED_COUNTRIES: ArkeselSupportedCountry[] = [
  { code: "GH", country: "Ghana", dialCode: "+233", exampleLocalNumber: "0241234567" },
  { code: "NG", country: "Nigeria", dialCode: "+234", exampleLocalNumber: "08012345678" },
  { code: "KE", country: "Kenya", dialCode: "+254", exampleLocalNumber: "0712345678" },
  { code: "TZ", country: "Tanzania", dialCode: "+255", exampleLocalNumber: "0712345678" },
  { code: "ZA", country: "South Africa", dialCode: "+27", exampleLocalNumber: "0821234567" }
];

function normalizeEmail(input: unknown): string | null {
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

export function normalizeAuthPhoneInput(input: string): string | null {
  const stripped = input.trim().replace(/[^\d+]/g, "");
  if (!stripped) {
    return null;
  }

  const digits = stripped.startsWith("+") ? stripped.slice(1) : stripped;
  if (!/^[1-9]\d{9,14}$/.test(digits)) {
    return null;
  }

  return `+${digits}`;
}

export function composeArkeselPhoneInput(countryDialCode: string, localInput: string): string | null {
  const trimmedLocalInput = localInput.trim();
  if (!trimmedLocalInput) {
    return null;
  }

  if (trimmedLocalInput.startsWith("+")) {
    return normalizeAuthPhoneInput(trimmedLocalInput);
  }

  const countryDigits = countryDialCode.replace(/\D/g, "");
  const localDigits = trimmedLocalInput.replace(/\D/g, "");
  if (!countryDigits || !localDigits) {
    return null;
  }

  const pastedInternationalDigits = ARKESEL_SUPPORTED_COUNTRIES.find((country) => {
    const supportedCountryDigits = country.dialCode.replace(/\D/g, "");
    return localDigits.startsWith(supportedCountryDigits) && localDigits.length >= supportedCountryDigits.length + 8;
  });
  if (pastedInternationalDigits) {
    return normalizeAuthPhoneInput(`+${localDigits}`);
  }

  const nationalNumber = localDigits.startsWith(countryDigits) ? localDigits.slice(countryDigits.length) : localDigits.replace(/^0+/, "");
  return normalizeAuthPhoneInput(`+${countryDigits}${nationalNumber}`);
}

export function looksLikeEmailIdentifier(input: string): boolean {
  return input.includes("@");
}

export function getUserContactEmail(user: User | null | undefined): string | null {
  if (!user) {
    return null;
  }

  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  return normalizeEmail(user.email) ?? normalizeEmail(metadata?.contact_email);
}

export function getUserMobileNumber(user: User | null | undefined): string | null {
  return user?.phone?.trim() ? user.phone : null;
}

export function maskPhoneNumber(input: string | null | undefined): string {
  const normalized = normalizeAuthPhoneInput(input ?? "");
  if (!normalized) {
    return "hidden";
  }

  const digits = normalized.slice(1);
  if (digits.length <= 4) {
    return normalized;
  }

  const visibleStart = digits.slice(0, Math.min(3, digits.length - 4));
  const visibleEnd = digits.slice(-4);
  return `+${visibleStart}${"*".repeat(Math.max(0, digits.length - visibleStart.length - 4))}${visibleEnd}`;
}

export function getUserIdentityLabel(user: User | null | undefined, fallback = "Account"): string {
  if (!user) {
    return fallback;
  }

  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const displayName = typeof metadata?.display_name === "string" ? metadata.display_name.trim() : "";
  if (displayName) {
    return displayName;
  }

  const email = getUserContactEmail(user);
  if (email) {
    return email.split("@")[0] ?? fallback;
  }

  const phone = getUserMobileNumber(user);
  if (phone) {
    return maskPhoneNumber(phone);
  }

  return fallback;
}
