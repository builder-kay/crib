import { formatCurrency } from "@/lib/format";
import type { AssetPricingModel } from "@/lib/types";

type PriceTagProps = {
  amountKobo: number;
  currency: string;
  className?: string;
  pricingModel?: AssetPricingModel;
  minimumPriceKobo?: number;
};

export function PriceTag({ amountKobo, currency, className, pricingModel, minimumPriceKobo }: PriceTagProps) {
  let label = formatCurrency(amountKobo, currency);

  if (pricingModel === "free") {
    label = "Free";
  } else if (pricingModel === "pay_what_you_want") {
    const normalizedMinimum = Math.max(minimumPriceKobo ?? 0, 0);
    label = normalizedMinimum > 0 ? `From ${formatCurrency(normalizedMinimum, currency)}` : "Pay what you want";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border border-cobalt-100 bg-cobalt-50 px-3 py-1 text-sm font-semibold text-cobalt-700 ${className ?? ""}`}
    >
      {label}
    </span>
  );
}
