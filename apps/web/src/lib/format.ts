const formatterCache = new Map<string, Intl.NumberFormat>();

export function formatCurrency(amountKobo: number, currency = "GHS") {
  const cacheKey = currency.toUpperCase();

  try {
    if (!formatterCache.has(cacheKey)) {
      formatterCache.set(
        cacheKey,
        new Intl.NumberFormat("en-GH", {
          style: "currency",
          currency: cacheKey,
          minimumFractionDigits: 2
        })
      );
    }

    return formatterCache.get(cacheKey)!.format(amountKobo / 100);
  } catch {
    return `${cacheKey} ${(amountKobo / 100).toFixed(2)}`;
  }
}

export function formatMajorCurrency(amount: number, currency = "GHS") {
  return formatCurrency(Math.round(amount * 100), currency);
}

export function formatDate(input: string) {
  return new Date(input).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
