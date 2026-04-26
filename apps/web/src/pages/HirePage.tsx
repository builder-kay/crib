import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { HireCreatorModal } from "@/components/HireCreatorModal";
import { PageLoader } from "@/components/PageLoader";
import { SearchInput } from "@/components/SearchInput";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { getCreatorDirectory } from "@/lib/api";
import type { CreatorDirectoryEntry } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

type HireSpotlight = "all" | "verified" | "top-rated";

const CARD_FALLBACKS = [
  "from-[#f6d1a7] via-[#f5efe5] to-[#e2a27e]",
  "from-[#e9c98f] via-[#f8f1e6] to-[#c9825a]",
  "from-[#e7d7b5] via-[#fbf7f0] to-[#d2a57f]",
  "from-[#d9c2a7] via-[#f9f4ee] to-[#c98868]"
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

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0
  }).format(value);
}

function sortCreators(creators: CreatorDirectoryEntry[], spotlight: HireSpotlight) {
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

function pickFallbackTone(seed: string) {
  const total = Array.from(seed).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return CARD_FALLBACKS[total % CARD_FALLBACKS.length];
}

function creatorSummary(creator: CreatorDirectoryEntry) {
  return creator.bio?.trim() || `${creator.creator_category} creator building polished, client-ready work on Crib.`;
}

export function HirePage() {
  const user = useAuthStore((state) => state.user);
  const directoryRef = useRef<HTMLElement | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [spotlight, setSpotlight] = useState<HireSpotlight>("all");
  const [filtersSubdued, setFiltersSubdued] = useState(false);
  const [isFilterPanelFocused, setIsFilterPanelFocused] = useState(false);

  const deferredSearch = useDeferredValue(search);
  const creatorsQuery = useQuery({
    queryKey: ["creator-directory", deferredSearch],
    queryFn: () => getCreatorDirectory({ search: deferredSearch, sort: "trending" })
  });

  const creators = creatorsQuery.data ?? [];
  const categories = useMemo(() => ["all", ...new Set(creators.map((creator) => creator.creator_category))], [creators]);
  const verifiedCount = useMemo(() => creators.filter((creator) => creator.is_verified).length, [creators]);
  const ratedCount = useMemo(() => creators.filter((creator) => creator.review_count > 0).length, [creators]);

  const spotlightFilters = useMemo(
    () =>
      [
        { key: "all", label: "All talent", count: creators.length },
        { key: "verified", label: "Verified", count: verifiedCount },
        { key: "top-rated", label: "Top rated", count: ratedCount }
      ] as Array<{ key: HireSpotlight; label: string; count: number }>,
    [creators.length, ratedCount, verifiedCount]
  );

  const filteredCreators = useMemo(() => {
    let next = category === "all" ? creators : creators.filter((creator) => creator.creator_category === category);

    if (spotlight === "verified") {
      next = next.filter((creator) => creator.is_verified);
    }

    return sortCreators(next, spotlight);
  }, [category, creators, spotlight]);

  useEffect(() => {
    const syncStickyFilterState = () => {
      const nextSubdued = window.scrollY > 28;
      setFiltersSubdued((current) => (current === nextSubdued ? current : nextSubdued));
    };

    syncStickyFilterState();
    window.addEventListener("scroll", syncStickyFilterState, { passive: true });

    return () => {
      window.removeEventListener("scroll", syncStickyFilterState);
    };
  }, []);

  const isMobileFilterCompact = filtersSubdued && !isFilterPanelFocused;

  return (
    <div className="creators-shell space-y-5">
      <section className="creators-hire-banner relative overflow-hidden rounded-[1.7rem] px-4 py-5 sm:rounded-[1.9rem] sm:px-5 sm:py-6 md:px-8 md:py-8">
        <div className="pointer-events-none absolute inset-y-0 right-[-8%] w-[42%] rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute left-[8%] top-[18%] h-28 w-28 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.22)]">Hire</p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-white md:text-[2.8rem]">
            Find the right creator for your next brief.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.24)] md:text-base">
            Compare vibe, proof of work, social proof, and availability before you reach out. Every card here is built from live
            Crib profiles and tuned for quick hiring decisions.
          </p>
        </div>
      </section>

      <div
        className={`creators-filter-shell sticky top-[4.7rem] z-30 -mx-1 rounded-[1.45rem] px-1 py-1.5 sm:-mx-2 sm:rounded-[1.8rem] sm:px-2 sm:py-2 md:top-[5.35rem] md:-mx-3 md:px-3 ${
          filtersSubdued ? "creators-filter-shell-subdued" : ""
        }`}
      >
        <section
          className={`surface-card creators-filter-panel p-2.5 sm:p-4 ${
            filtersSubdued ? "creators-filter-panel-subdued" : ""
          } ${isMobileFilterCompact ? "creators-filter-panel-mobile-compact" : ""}`}
          onFocusCapture={() => setIsFilterPanelFocused(true)}
          onBlurCapture={(event) => {
            const nextTarget = event.relatedTarget;
            if (!event.currentTarget.contains(nextTarget as Node | null)) {
              setIsFilterPanelFocused(false);
            }
          }}
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="min-w-0 flex-1">
              <SearchInput value={search} onChange={setSearch} placeholder="Search talent, niches, categories, or styles..." />
            </div>

            <div className="creators-filter-controls flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:flex-nowrap">
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
          </div>
        </section>
      </div>

      <section ref={directoryRef} className="space-y-4">
        {creatorsQuery.isLoading ? <PageLoader label="Loading hire talent" /> : null}
        {creatorsQuery.isError ? (
          <div className="surface-card p-5 text-sm text-rose-700">
            {creatorsQuery.error instanceof Error ? creatorsQuery.error.message : "Unable to load hire talent."}
          </div>
        ) : null}

        {!creatorsQuery.isLoading && filteredCreators.length === 0 ? (
          <EmptyState title="No talent found" body="Try another search, category, or spotlight filter to discover more profiles." />
        ) : null}

        {!creatorsQuery.isLoading && filteredCreators.length > 0 ? (
          <div className="grid gap-x-2 gap-y-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCreators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} canViewProfiles={Boolean(user)} viewerId={user?.id ?? null} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function CreatorCard({
  creator,
  canViewProfiles,
  viewerId
}: {
  creator: CreatorDirectoryEntry;
  canViewProfiles: boolean;
  viewerId: string | null;
}) {
  const [hireOpen, setHireOpen] = useState(false);
  const authenticatedCreatorProfilePath = `/profile/${creator.id}`;
  const creatorProfilePath = canViewProfiles
    ? authenticatedCreatorProfilePath
    : `/auth?redirect=${encodeURIComponent(authenticatedCreatorProfilePath)}`;
  const isOwnProfile = Boolean(viewerId && viewerId === creator.id);
  const heroImageUrl = creator.featured_preview_urls[0] ?? "";
  const workPath = `/market?q=${encodeURIComponent(creator.display_name)}`;
  const stats = [
    { label: "Rating", value: creator.review_count > 0 ? creator.average_rating.toFixed(1) : "New", accent: true },
    { label: "Sales", value: formatCompact(creator.sales_count), accent: false },
    { label: "Portfolio", value: formatCompact(creator.published_assets), accent: false }
  ];
  const fallbackTone = pickFallbackTone(creator.id);

  return (
    <article className="hire-creator-card group mx-auto w-full max-w-none overflow-hidden rounded-[1.9rem] p-2.5 md:max-w-[19.1rem] xl:max-w-none">
      <div className="hire-creator-frame relative overflow-hidden rounded-[1.65rem]">
        <div className="relative aspect-[0.72/1] overflow-hidden rounded-[1.65rem] bg-[#0d1017]">
          {heroImageUrl ? (
            <img
              src={heroImageUrl}
              alt={`${creator.display_name} portfolio preview`}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className={`flex h-full w-full flex-col justify-between bg-gradient-to-br ${fallbackTone} p-5`}>
              <div className="flex justify-end">
                {creator.avatar_url ? (
                  <img
                    src={creator.avatar_url}
                    alt={creator.display_name}
                    className="h-16 w-16 rounded-full border border-white/70 object-cover shadow-[0_18px_28px_-18px_rgba(16,19,36,0.55)]"
                  />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-full border border-white/70 bg-white/55 shadow-[0_18px_28px_-18px_rgba(16,19,36,0.55)]">
                    <span className="font-display text-xl font-bold text-[#24130c]">{initials(creator.display_name)}</span>
                  </div>
                )}
              </div>

              <div className="max-w-[11rem]">
                <p className="text-sm font-medium text-[#513728]/70">{creator.creator_category}</p>
                <p className="mt-2 line-clamp-2 font-display text-[1.75rem] font-bold leading-[0.95] text-[#26160f]">{creator.display_name}</p>
              </div>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#060709] via-[#060709]/90 to-transparent" />

          <div className="absolute inset-x-5 bottom-4">
            <div className="hire-creator-overlay">
              <div className="flex items-center gap-2">
                <Link to={creatorProfilePath} className="truncate text-[1.6rem] font-semibold leading-none text-white transition hover:text-white/92">
                  {creator.display_name}
                </Link>
                {creator.is_verified ? <VerifiedBadge size="sm" /> : null}
              </div>

              <p className="mt-2.5 line-clamp-2 text-[0.92rem] leading-6 text-white/80">{creatorSummary(creator)}</p>

              <div className="mt-4 grid grid-cols-3">
                {stats.map((stat, index) => (
                  <CreatorStat
                    key={`${creator.id}-${stat.label}`}
                    label={stat.label}
                    value={stat.value}
                    accent={stat.accent}
                    hasDivider={index < stats.length - 1}
                  />
                ))}
              </div>

              <div className="mt-5 flex items-center gap-2.5">
                {isOwnProfile ? (
                  <Link to="/profile" className="hire-creator-primary inline-flex flex-1 items-center justify-center">
                    <span className="hire-creator-primary-content">Manage Profile</span>
                  </Link>
                ) : creator.hire_enabled ? (
                  <button type="button" onClick={() => setHireOpen(true)} className="hire-creator-primary inline-flex flex-1 items-center justify-center gap-2">
                    <span className="hire-creator-primary-content">
                      <svg className="h-[1.2rem] w-[1.2rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="6" width="18" height="12" rx="3" />
                        <path d="m4.9 8.2 6.42 4.82a1.18 1.18 0 0 0 1.36 0L19.1 8.2" />
                      </svg>
                      Get In Touch
                    </span>
                  </button>
                ) : (
                  <Link to={workPath} className="hire-creator-primary inline-flex flex-1 items-center justify-center">
                    <span className="hire-creator-primary-content">Browse Work</span>
                  </Link>
                )}

                <Link to={creatorProfilePath} className="hire-creator-secondary" aria-label={`View ${creator.display_name} profile`}>
                  <svg className="h-[1.25rem] w-[1.25rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7.25 5.75A1.75 1.75 0 0 1 9 4h6a1.75 1.75 0 0 1 1.75 1.75v13a.5.5 0 0 1-.8.4L12 16.2l-3.95 2.95a.5.5 0 0 1-.8-.4v-13Z" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <HireCreatorModal open={hireOpen} creatorId={creator.id} creatorName={creator.display_name} onClose={() => setHireOpen(false)} />
    </article>
  );
}

function CreatorStat({
  label,
  value,
  accent,
  hasDivider
}: {
  label: string;
  value: string;
  accent: boolean;
  hasDivider: boolean;
}) {
  return (
    <div className={`px-3 ${hasDivider ? "border-r border-white/18" : ""}`}>
      <p className="flex items-center justify-center gap-1.5 text-[1.1rem] font-semibold text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.42)]">
        {accent ? (
          <svg className="h-[1.05rem] w-[1.05rem] shrink-0 text-[#f2a748]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="m12 3.8 2.52 5.1 5.63.82-4.08 3.97.96 5.6L12 16.62l-5.03 2.67.96-5.6L3.85 9.72l5.63-.82L12 3.8Z" />
          </svg>
        ) : null}
        <span>{value}</span>
      </p>
      <p className="mt-1 text-center text-[0.98rem] leading-5 text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.42)]">{label}</p>
    </div>
  );
}
