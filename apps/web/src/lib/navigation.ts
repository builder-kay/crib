function sanitizeInternalPath(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  try {
    const url = new URL(trimmed, "https://crib.local");
    if (url.origin !== "https://crib.local") {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function sanitizeAppRedirectPath(input: string | null | undefined, fallback: string) {
  return sanitizeInternalPath(input) ?? sanitizeInternalPath(fallback) ?? "/";
}
