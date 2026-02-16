import { useMemo } from "react";

type StarRatingProps = {
  value: number;
  onChange?: (next: number) => void;
  max?: number;
  size?: "sm" | "md";
  className?: string;
};

export function StarRating({ value, onChange, max = 5, size = "md", className = "" }: StarRatingProps) {
  const clamped = useMemo(() => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(max, value));
  }, [max, value]);
  const filledCount = useMemo(() => Math.floor(clamped), [clamped]);
  const starSize = size === "sm" ? "text-sm" : "text-lg";

  return (
    <div className={`inline-flex items-center gap-1 ${className}`.trim()} aria-label={`Rating ${clamped.toFixed(1)} out of ${max}`}>
      {Array.from({ length: max }).map((_, index) => {
        const star = index + 1;
        const active = star <= filledCount;
        const baseClass = `${starSize} leading-none ${active ? "text-amber-500" : "text-sand-300"}`;

        if (!onChange) {
          return (
            <span key={star} className={baseClass} aria-hidden="true">
              <StarIcon />
            </span>
          );
        }

        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`${baseClass} transition hover:scale-110 hover:text-amber-600`}
            aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`}
          >
            <StarIcon />
          </button>
        );
      })}
    </div>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-[1em] w-[1em]">
      <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.13 3.46a1 1 0 0 0 .95.69h3.64c.97 0 1.37 1.24.59 1.81l-2.95 2.14a1 1 0 0 0-.36 1.12l1.13 3.46c.3.92-.76 1.68-1.54 1.12L10.59 14.6a1 1 0 0 0-1.18 0l-2.95 2.14c-.78.56-1.84-.2-1.54-1.12l1.13-3.46a1 1 0 0 0-.36-1.12L2.74 8.89c-.78-.57-.38-1.81.59-1.81h3.64a1 1 0 0 0 .95-.69l1.13-3.46z" />
    </svg>
  );
}
