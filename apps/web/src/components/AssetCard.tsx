import { Link } from "react-router-dom";
import { PriceTag } from "@/components/PriceTag";
import { StarRating } from "@/components/StarRating";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { getUserContactEmail } from "@/lib/auth";
import { trackAnalyticsEvent } from "@/lib/api";
import type { Asset } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

function resolvePreview(asset: Asset) {
  return asset.previews?.[0]?.preview_url ?? "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1200&q=80";
}

type AssetCardProps = {
  asset: Asset;
  isWishlisted?: boolean;
  onToggleWishlist?: (assetId: string, nextState: boolean) => void;
};

function categoryChipClass(category: string) {
  const key = category.toLowerCase();
  if (key.includes("figma")) {
    return "bg-lagoon-600 text-white";
  }
  if (key.includes("audio / beats")) {
    return "bg-forest-700 text-white";
  }
  if (key.includes("canva")) {
    return "bg-sunset-600 text-white";
  }
  if (key.includes("after effects") || key.includes("premiere")) {
    return "bg-orchid-600 text-white";
  }
  if (key.includes("lightroom")) {
    return "bg-lagoon-600 text-white";
  }
  if (key.includes("photoshop")) {
    return "bg-cobalt-600 text-white";
  }
  if (key.includes("illustrator")) {
    return "bg-forest-600 text-white";
  }
  if (key.includes("indesign")) {
    return "bg-sunset-600 text-white";
  }
  return "bg-ink text-white";
}

export function AssetCard({ asset, isWishlisted = false, onToggleWishlist }: AssetCardProps) {
  const user = useAuthStore((state) => state.user);
  const userContactEmail = getUserContactEmail(user);
  const creatorName = asset.profile?.display_name ?? "Creator";
  const creatorCategory = asset.profile?.creator_category || asset.profile?.niche || "Creative Seller";
  const soldCount = Math.max(0, asset.sold_count ?? 0);
  const soldLabel = `${new Intl.NumberFormat("en-US").format(soldCount)} sold`;
  const isVerified = Boolean(asset.profile?.is_verified);
  const rating = asset.average_rating ?? 0;
  const reviewCount = asset.review_count ?? 0;
  const creatorProfilePath = user
    ? `/profile/${asset.creator_id}`
    : `/auth?redirect=${encodeURIComponent(`/profile/${asset.creator_id}`)}`;

  function handleAssetClick(surface: "image" | "title" | "cta") {
    void trackAnalyticsEvent({
      eventName: "asset_click",
      assetId: asset.id,
      creatorId: asset.creator_id,
      actorUserId: user?.id,
      actorEmail: userContactEmail,
      metadata: { surface }
    });
  }

  return (
    <article className="group flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white transition hover:-translate-y-0.5 hover:border-sand-300 hover:shadow-lg">
      <Link to={`/asset/${asset.id}`} className="block" onClick={() => handleAssetClick("image")}>
        <div className="relative aspect-[4/3] overflow-hidden bg-sand-100">
          <img
            src={resolvePreview(asset)}
            alt={asset.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />
          <div
            className={`absolute left-3 top-3 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide shadow ${categoryChipClass(asset.category)}`}
          >
            {asset.category}
          </div>

          {onToggleWishlist ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleWishlist(asset.id, !isWishlisted);
              }}
              className={`absolute right-3 top-3 inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                isWishlisted
                  ? "border-cobalt-600 bg-cobalt-600 text-white"
                  : "border-white/80 bg-white/90 text-sand-700 hover:border-cobalt-300 hover:text-cobalt-700"
              }`}
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              {isWishlisted ? "Saved" : "Save"}
            </button>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 px-3 pb-3 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={`/asset/${asset.id}`}
              className="line-clamp-2 font-display text-base font-semibold text-ink hover:text-cobalt-700"
              onClick={() => handleAssetClick("title")}
            >
              {asset.title}
            </Link>
            <p className="mt-0.5 text-xs text-sand-600">
              by{" "}
              <span className="inline-flex items-center gap-1.5">
                <Link to={creatorProfilePath} className="font-medium text-sand-700 hover:text-cobalt-700">
                  {creatorName}
                </Link>
                {isVerified ? <VerifiedBadge size="sm" /> : null}
              </span>
            </p>
          </div>
          <PriceTag amountKobo={asset.price_kobo} currency={asset.currency} pricingModel={asset.pricing_model} minimumPriceKobo={asset.minimum_price_kobo} className="shrink-0 text-[11px]" />
        </div>

        <p className="line-clamp-2 text-sm leading-relaxed text-sand-600">{asset.description}</p>

        <div className="flex items-center gap-2 text-xs text-sand-600">
          <StarRating value={rating} size="sm" />
          <span>{reviewCount > 0 ? `${rating.toFixed(1)}/5 (${reviewCount})` : "No ratings yet"}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5 text-[11px] font-medium text-sand-700">{creatorCategory}</span>
          <span className="rounded-full border border-cobalt-100 bg-cobalt-50 px-2 py-0.5 text-[11px] font-semibold text-cobalt-700">{soldLabel}</span>
        </div>

        <div className="mt-auto flex items-center justify-between pt-1">
          <div className="flex flex-wrap gap-1">
            {(asset.tags ?? []).slice(0, 2).map((tag) => (
              <span key={tag} className="rounded-full bg-sand-100 px-2 py-0.5 text-[11px] font-medium text-sand-700">
                #{tag}
              </span>
            ))}
          </div>
          <Link
            to={`/asset/${asset.id}`}
            onClick={() => handleAssetClick("cta")}
            className="group inline-flex items-center gap-1 rounded-full bg-cobalt-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-cobalt-700 hover:shadow-md"
          >
            <span>View</span>
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
              {">"}
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}
