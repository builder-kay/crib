import { formatCurrency } from "@/lib/format";

type PriceTagProps = {
  amountKobo: number;
  currency: string;
  className?: string;
};

export function PriceTag({ amountKobo, currency, className }: PriceTagProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-cobalt-100 bg-cobalt-50 px-3 py-1 text-sm font-semibold text-cobalt-700 ${className ?? ""}`}
    >
      {formatCurrency(amountKobo, currency)}
    </span>
  );
}
