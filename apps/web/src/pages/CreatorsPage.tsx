import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { HireCreatorModal } from "@/components/HireCreatorModal";
import { PageLoader } from "@/components/PageLoader";
import { SearchInput } from "@/components/SearchInput";
import { StarRating } from "@/components/StarRating";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { getCreatorDirectory } from "@/lib/api";
import type { CreatorDirectoryEntry } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

type CreatorSpotlight = "all" | "hire-ready" | "verified" | "top-rated";

const MOSAIC_FALLBACKS = [
  "from-[#eaf2ff] via-white to-[#dcf7f5]",
  "from-[#fff1e7] via-[#fff8f2] to-[#ffe3da]",
  "from-[#f2eeff] via-[#fbf8ff] to-[#dfe6ff]",
  "from-[#eefdf4] via-[#ffffff] to-[#d8f7e6]"
] as const;

function initials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "C";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function firstName(name: string) {
  return name.trim().split(/\s+/).filter(Boolean)[0] ?? "Creator";
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0
  }).format(value);
}

function isNewCreator(createdAt: string) {
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) {
    return false;
  }

  const days = (Date.now() - created) / (1000 * 60 * 60 * 24);
  return days <= 45;
}

function sortCreators(creators: CreatorDirectoryEntry[], spotlight: CreatorSpotlight) {
  const next = [...creators];

  next.sort((left, right) => {
    if (spotlight === "top-rated") {
      return (
        right.average_rating - left.average_rating ||
        right.review_count - left.review_count ||
        right.follower_count - left.follower_count ||
        right.trending_score - left.trending_score
      );
    }

    if (spotlight === "hire-ready") {
      return (
        Number(right.hire_enabled) - Number(left.hire_enabled) ||
        Number(right.editor_pick) - Number(left.editor_pick) ||
        right.trending_score - left.trending_score ||
        right.follower_count - left.follower_count
      );
    }

    if (spotlight === "verified") {
      return (
        Number(right.is_verified) - Number(left.is_verified) ||
        Number(right.editor_pick) - Number(left.editor_pick) ||
        right.trending_score - left.trending_score ||
        right.follower_count - left.follower_count
      );
    }

    return (
      Number(right.editor_pick) - Number(left.editor_pick) ||
      right.trending_score - left.trending_score ||
      right.follower_count - left.follower_count
    );
  });

  return next;
}

export function CreatorsPage() {
  const user = useAuthStore((state) => state.user);
  const directoryRef = useRef<HTMLElement | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [spotlight, setSpotlight] = useState<CreatorSpotlight>("all");

  const deferredSearch = useDeferredValue(search);
  const creatorsQuery = useQuery({
    queryKey: ["creator-directory", deferredSearch],
    queryFn: () => getCreatorDirectory({ search: deferredSearch, sort: "trending" })
  });

  const creators = creatorsQuery.data ?? [];
  const categories = useMemo(() => ["all", ...new Set(creators.map((creator) => creator.creator_category))], [creators]);
  const hireReadyCount = useMemo(() => creators.filter((creator) => creator.hire_enabled).length, [creators]);
  const verifiedCount = useMemo(() => creators.filter((creator) => creator.is_verified).length, [creators]);
  const ratedCount = useMemo(() => creators.filter((creator) => creator.review_count > 0).length, [creators]);

  const spotlightFilters = useMemo(
    () =>
      [
        { key: "all", label: "All creators", count: creators.length },
        { key: "hire-ready", label: "Hire ready", count: hireReadyCount },
        { key: "verified", label: "Verified", count: verifiedCount },
        { key: "top-rated", label: "Top rated", count: ratedCount }
      ] as Array<{ key: CreatorSpotlight; label: string; count: number }>,
    [creators.length, hireReadyCount, ratedCount, verifiedCount]
  );

  const filteredCreators = useMemo(() => {
    let next = category === "all" ? creators : creators.filter((creator) => creator.creator_category === category);

    if (spotlight === "hire-ready") {
      next = next.filter((creator) => creator.hire_enabled);
    }

    if (spotlight === "verified") {
      next = next.filter((creator) => creator.is_verified);
    }

    return sortCreators(next, spotlight);
  }, [category, creators, spotlight]);

  function focusSpotlight(nextSpotlight: CreatorSpotlight) {
    setSpotlight(nextSpotlight);
    directoryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const resultsLabel =
    spotlight === "hire-ready"
      ? "Hire-ready creators"
      : spotlight === "verified"
        ? "Verified creators"
        : spotlight === "top-rated"
          ? "Top-rated creators"
          : "Browse creators";

  return (
    <div className="creators-shell space-y-5">
      <section className="creators-hire-banner relative overflow-hidden rounded-[1.9rem] px-5 py-6 sm:px-6 md:px-8 md:py-8">
        <div className="pointer-events-none absolute inset-y-0 right-[-8%] w-[42%] rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute left-[8%] top-[18%] h-28 w-28 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.22)]">People</p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-white md:text-[2.8rem]">
            Looking to hire a creator?
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.24)] md:text-base">
            Review published work, followership, category fit, and ratings before you reach out. Every card here is built from real CRIB profiles and live creator activity.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => focusSpotlight("hire-ready")}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-sand-100"
            >
              View hire-ready creators
            </button>
            <Link
              to="/market"
              className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/16"
            >
              Explore creator work
            </Link>
          </div>
        </div>
      </section>

      <section className="surface-card creators-filter-panel p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="min-w-0 flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search creators, niches, categories, or styles..." />
          </div>

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-full border border-sand-200 bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-cobalt-400"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All categories" : item}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-2">
            {spotlightFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setSpotlight(filter.key)}
                className={`creators-segment-button ${spotlight === filter.key ? "creators-segment-button-active" : ""}`}
              >
                <span>{filter.label}</span>
                <span className="creators-segment-count">{formatCompact(filter.count)}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section ref={directoryRef} className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-600">Creator directory</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink md:text-3xl">{resultsLabel}</h2>
            <p className="mt-2 max-w-2xl text-sm text-sand-700">
              {filteredCreators.length} profile{filteredCreators.length === 1 ? "" : "s"} matched your current browse view.
            </p>
          </div>

          <div className="rounded-full border border-sand-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-sand-700">
            {category === "all" ? "All categories" : category}
          </div>
        </div>

        {creatorsQuery.isLoading ? <PageLoader label="Loading creators" /> : null}
        {creatorsQuery.isError ? (
          <div className="surface-card p-5 text-sm text-rose-700">
            {creatorsQuery.error instanceof Error ? creatorsQuery.error.message : "Unable to load creators."}
          </div>
        ) : null}

        {!creatorsQuery.isLoading && filteredCreators.length === 0 ? (
          <EmptyState title="No creators found" body="Try another search, category, or spotlight filter to discover more profiles." />
        ) : null}

        {!creatorsQuery.isLoading && filteredCreators.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {filteredCreators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} canViewProfiles={Boolean(user)} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function CreatorCard({ creator, canViewProfiles }: { creator: CreatorDirectoryEntry; canViewProfiles: boolean }) {
  const fresh = isNewCreator(creator.created_at);
  const [hireOpen, setHireOpen] = useState(false);
  const authenticatedCreatorProfilePath = `/profile/${creator.id}`;
  const creatorProfilePath = canViewProfiles
    ? authenticatedCreatorProfilePath
    : `/auth?redirect=${encodeURIComponent(authenticatedCreatorProfilePath)}`;
  const previewSlots = [...creator.featured_preview_urls.slice(0, 4)];

  while (previewSlots.length < 4) {
    previewSlots.push("");
  }

  return (
    <article className="creator-profile-card group overflow-hidden rounded-[1.6rem] border border-sand-200 bg-white">
      <div className="creator-card-mosaic grid grid-cols-4 gap-1 border-b border-sand-200 bg-sand-100 p-1.5">
        {previewSlots.map((previewUrl, index) =>
          previewUrl ? (
            <div key={`${creator.id}-preview-${index}`} className="aspect-[1.05/1] overflow-hidden rounded-[0.85rem] bg-sand-200">
              <img
                src={previewUrl}
                alt={`${creator.display_name} preview ${index + 1}`}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
              />
            </div>
          ) : (
            <div
              key={`${creator.id}-fallback-${index}`}
              className={`aspect-[1.05/1] rounded-[0.85rem] bg-gradient-to-br ${MOSAIC_FALLBACKS[index % MOSAIC_FALLBACKS.length]}`}
            />
          )
        )}
      </div>

      <div className="relative px-4 pb-5 pt-14">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
          <div className="creator-profile-avatar grid h-20 w-20 place-items-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-cobalt-50 via-white to-lagoon-50 shadow-[0_18px_34px_-24px_rgba(18,53,148,0.52)]">
            {creator.avatar_url ? (
              <img src={creator.avatar_url} alt={creator.display_name} className="h-full w-full rounded-full object-cover" />
            ) : (
              <span className="font-display text-xl font-bold text-cobalt-700">{initials(creator.display_name)}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-1.5">
          {creator.editor_pick ? <Tag tone="cobalt">Featured</Tag> : null}
          {fresh ? <Tag tone="sunset">New</Tag> : null}
        </div>

        <div className="mt-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <Link to={creatorProfilePath} className="font-display text-[1.45rem] font-bold text-ink transition hover:text-cobalt-700">
              {creator.display_name}
            </Link>
            {creator.is_verified ? <VerifiedBadge size="sm" /> : null}
          </div>
          <p className="mt-1 text-sm text-sand-700">{creator.niche?.trim() || creator.creator_category}</p>
        </div>

        <p className="mt-3 line-clamp-2 text-center text-sm leading-6 text-sand-700">
          {creator.bio?.trim() || "Creative professional building polished digital work and product-ready assets on CRIB."}
        </p>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-sand-700">
          <StarRating value={creator.average_rating} size="sm" />
          <span>
            {creator.review_count > 0
              ? `${creator.average_rating.toFixed(1)} rating from ${creator.review_count} review${creator.review_count === 1 ? "" : "s"}`
              : "Fresh on CRIB"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 border-y border-sand-200 py-3 text-center">
          <CreatorMetric label="Assets" value={formatCompact(creator.published_assets)} />
          <CreatorMetric label="Followers" value={formatCompact(creator.follower_count)} />
          <CreatorMetric label="Reviews" value={formatCompact(creator.review_count)} />
        </div>

        <div className="mt-6 space-y-3 border-t border-sand-100 pt-6">
          {creator.hire_enabled ? (
            <button
              type="button"
              onClick={() => setHireOpen(true)}
              className="w-full rounded-full bg-cobalt-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-700"
            >
              Hire {firstName(creator.display_name)}
            </button>
          ) : (
            <Link
              to={creatorProfilePath}
              className="flex w-full items-center justify-center rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#20273d]"
            >
              {canViewProfiles ? "View profile" : "Sign in to view"}
            </Link>
          )}

          <div className="flex items-center justify-center gap-6 pt-1 text-xs font-semibold uppercase tracking-[0.1em] text-cobalt-700">
            <Link to={creatorProfilePath} className="transition hover:text-cobalt-800">
              Profile
            </Link>
            <Link to={`/market?q=${encodeURIComponent(creator.display_name)}`} className="transition hover:text-cobalt-800">
              Assets
            </Link>
          </div>
        </div>
      </div>

      <HireCreatorModal open={hireOpen} creatorId={creator.id} creatorName={creator.display_name} onClose={() => setHireOpen(false)} />
    </article>
  );
}

function CreatorMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-sand-600">{label}</p>
      <p className="mt-1 text-base font-semibold text-ink">{value}</p>
    </div>
  );
}

function Tag({ children, tone }: { children: string; tone: "cobalt" | "forest" | "sunset" | "ink" }) {
  const toneClassName =
    tone === "cobalt"
      ? "border-cobalt-200 bg-cobalt-50 text-cobalt-700"
      : tone === "forest"
        ? "border-forest-200 bg-forest-50 text-forest-700"
        : tone === "sunset"
          ? "border-sunset-200 bg-sunset-50 text-sunset-700"
          : "border-sand-200 bg-white text-sand-700";

  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] ${toneClassName}`}>{children}</span>;
}
