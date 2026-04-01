export type PlatformSocialKind = "instagram" | "x" | "tiktok" | "linkedin" | "facebook" | "whatsapp";
export const DEFAULT_ADMIN_WHATSAPP_MESSAGE = "Hi CRIB admin, I need help with the marketplace.";

export function normalizePlatformSocialHandle(kind: PlatformSocialKind, rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "";
  }

  let candidate = trimmed;

  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      const pathname = url.pathname.replace(/\/+$/, "");

      if (kind === "instagram") {
        candidate = pathname.split("/").filter(Boolean)[0] ?? "";
      } else if (kind === "x") {
        candidate = pathname.split("/").filter(Boolean)[0] ?? "";
      } else if (kind === "tiktok") {
        candidate = pathname.split("/").filter(Boolean).pop() ?? "";
      } else {
        return `${url.origin}${pathname}`.trim();
      }
    } catch {
      candidate = trimmed;
    }
  }

  if (kind === "whatsapp") {
    const digits = candidate.replace(/[^\d]/g, "");
    if (digits.length >= 7) {
      return digits;
    }
  }

  candidate = candidate.split("?")[0]?.split("#")[0] ?? candidate;
  candidate = candidate.replace(/^@+/, "").replace(/^\/+/, "").replace(/\/+$/, "").trim();

  return candidate;
}

export function buildPlatformSocialUrl(kind: PlatformSocialKind, rawValue: string) {
  const handle = normalizePlatformSocialHandle(kind, rawValue);
  if (!handle) {
    return null;
  }

  if (kind === "instagram") {
    return `https://instagram.com/${handle}`;
  }

  if (kind === "x") {
    return `https://x.com/${handle}`;
  }

  if (kind === "tiktok") {
    return `https://www.tiktok.com/@${handle}`;
  }

  if (kind === "linkedin") {
    return handle.startsWith("http") ? handle : `https://www.linkedin.com/${handle.includes("/") ? handle : `company/${handle}`}`;
  }

  if (kind === "facebook") {
    return handle.startsWith("http") ? handle : `https://www.facebook.com/${handle}`;
  }

  if (handle.startsWith("http")) {
    return handle;
  }

  if (/^\d{7,}$/.test(handle)) {
    return `https://wa.me/${handle}`;
  }

  return `https://whatsapp.com/${handle}`;
}

export function formatPlatformSocialHandle(kind: PlatformSocialKind, rawValue: string) {
  const handle = normalizePlatformSocialHandle(kind, rawValue);
  if (!handle) {
    return "";
  }

  if (kind === "instagram" || kind === "x" || kind === "tiktok") {
    return `@${handle}`;
  }

  if (kind === "whatsapp" && /^\d{7,}$/.test(handle)) {
    return `+${handle}`;
  }

  return handle;
}

export function normalizePlatformSupportEmail(rawValue: string) {
  return rawValue.trim();
}

export function normalizeAdminWhatsAppNumber(rawValue: string) {
  const digits = rawValue.replace(/[^\d]/g, "");
  return digits.length >= 7 ? digits : "";
}

export function formatAdminWhatsAppNumber(rawValue: string) {
  const digits = normalizeAdminWhatsAppNumber(rawValue);
  return digits ? `+${digits}` : "";
}

export function normalizeAdminWhatsAppMessage(rawValue: string) {
  return rawValue.trim();
}

export function buildAdminWhatsAppSupportUrl(rawNumber: string, rawMessage: string) {
  const digits = normalizeAdminWhatsAppNumber(rawNumber);
  if (!digits) {
    return null;
  }

  const message = normalizeAdminWhatsAppMessage(rawMessage) || DEFAULT_ADMIN_WHATSAPP_MESSAGE;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
