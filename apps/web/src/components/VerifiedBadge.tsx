type VerifiedBadgeProps = {
  size?: "sm" | "md" | "lg";
  label?: string;
};

const SIZE_CLASS: Record<NonNullable<VerifiedBadgeProps["size"]>, string> = {
  sm: "h-[1.125rem] w-[1.125rem]",
  md: "h-[1.375rem] w-[1.375rem]",
  lg: "h-[1.625rem] w-[1.625rem]"
};

const ICON_CLASS: Record<NonNullable<VerifiedBadgeProps["size"]>, string> = {
  sm: "h-[0.6rem] w-[0.6rem]",
  md: "h-[0.72rem] w-[0.72rem]",
  lg: "h-[0.85rem] w-[0.85rem]"
};

export function VerifiedBadge({ size = "md", label = "CRIB verified creator" }: VerifiedBadgeProps) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`relative inline-flex shrink-0 items-center justify-center text-[#3797F0] drop-shadow-[0_10px_18px_rgba(55,151,240,0.32)] ${SIZE_CLASS[size]}`}
    >
      <span
        className="absolute inset-0 bg-current"
        style={{
          clipPath:
            "polygon(50% 0%, 61% 8%, 75% 4%, 80% 18%, 94% 18%, 90% 31%, 100% 43%, 90% 55%, 94% 69%, 80% 69%, 75% 82%, 61% 78%, 50% 86%, 39% 78%, 25% 82%, 20% 69%, 6% 69%, 10% 55%, 0% 43%, 10% 31%, 6% 18%, 20% 18%, 25% 4%, 39% 8%)"
        }}
      />
      <span className="relative grid h-full w-full place-items-center text-white">
        <svg viewBox="0 0 16 16" fill="none" className={ICON_CLASS[size]} aria-hidden="true">
          <path
            d="m6.55 10.85-2.3-2.3 1.15-1.15 1.15 1.15 3.9-3.9 1.15 1.15-5.05 5.05Z"
            fill="currentColor"
          />
        </svg>
      </span>
    </span>
  );
}
