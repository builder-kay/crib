const formatterCache = new Map<string, Intl.NumberFormat>();

export function formatCurrency(amountKobo: number, currency = "GHS") {
  const cacheKey = currency;
  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(
      cacheKey,
      new Intl.NumberFormat("en-GH", {
        style: "currency",
        currency,
        minimumFractionDigits: 2
      })
    );
  }

  return formatterCache.get(cacheKey)!.format(amountKobo / 100);
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