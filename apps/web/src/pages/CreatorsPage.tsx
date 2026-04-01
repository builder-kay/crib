import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { SearchInput } from "@/components/SearchInput";
import { StarRating } from "@/components/StarRating";
import { getCreatorDirectory } from "@/lib/api";
import type { CreatorDirectoryEntry } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

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

function toDateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

function isNewCreator(createdAt: string) {
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) {
    return false;
  }
  const days = (Date.now() - created) / (1000 * 60 * 60 * 24);
  return days <= 45;
}

export function CreatorsPage() {
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const deferredSearch = useDeferredValue(search);
  const creatorsQuery = useQuery({
    queryKey: ["creator-directory", deferredSearch],
    queryFn: () => getCreatorDirectory({ search: deferredSearch, sort: "newest" })
  });

  const creators = creatorsQuery.data ?? [];
  const categories = useMemo(() => ["all", ...new Set(creators.map((creator) => creator.creator_category))], [creators]);

  const filteredCreators = useMemo(() => {
    if (category === "all") {
      return creators;
    }
    return creators.filter((creator) => creator.creator_category === category);
  }, [category, creators]);

  return (
    <div className="creators-shell space-y-6">
      <header className="surface-card-vivid subtle-pattern creators-hero-panel relative overflow-hidden p-5 md:p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cobalt-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-24 h-52 w-52 rounded-full bg-lagoon-100/60 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-600">Creator Discovery</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">Browse Creator Profiles</h1>
            <p className="mt-2 max-w-3xl text-sm text-sand-700 md:text-base">
              Discover creatives by niche and category, then explore the profiles behind the work.
            </p>
          </div>
        </div>
      </header>

      <section className="surface-card creators-filter-panel space-y-3 p-3 sm:p-4">
        <div className="grid gap-3 md:grid-cols-[2fr,1fr]">
          <SearchInput value={search} onChange={setSearch} placeholder="Search creator name, niche, category..." />

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-full border border-sand-200 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-cobalt-400"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All categories" : item}
              </option>
            ))}
          </select>
        </div>
      </section>

      {creatorsQuery.isLoading ? <div className="surface-card p-5 text-sm text-sand-600">Loading creators...</div> : null}
      {creatorsQuery.isError ? (
        <div className="surface-card p-5 text-sm text-rose-700">
          {creatorsQuery.error instanceof Error ? creatorsQuery.error.message : "Unable to load creators."}
        </div>
      ) : null}

      {!creatorsQuery.isLoading && filteredCreators.length === 0 ? (
        <EmptyState title="No creators found" body="Try another search or category filter to discover more profiles." />
      ) : null}

      {filteredCreators.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl font-bold text-ink">All Creators</h2>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {filteredCreators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} canViewProfiles={Boolean(user)} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CreatorCard({ creator, canViewProfiles }: { creator: CreatorDirectoryEntry; canViewProfiles: boolean }) {
  const fresh = isNewCreator(creator.created_at);
  const creatorProfilePath = canViewProfiles
    ? `/profile/${creator.id}`
    : `/auth?redirect=${encodeURIComponent(`/profile/${creator.id}`)}`;

  return (
    <article className="creator-profile-card group relative overflow-hidden rounded-2xl border border-sand-200 bg-white p-3 sm:p-4">
      <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-cobalt-100/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-10 h-32 w-32 rounded-full bg-lagoon-100/50 blur-3xl" />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <div className="creator-profile-avatar grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cobalt-50 via-white to-lagoon-50 sm:h-14 sm:w-14 sm:rounded-2xl">
              {creator.avatar_url ? (
                <img src={creator.avatar_url} alt={creator.display_name} className="h-9 w-9 rounded-full object-cover sm:h-11 sm:w-11" />
              ) : (
                <span className="font-display text-base font-bold text-cobalt-700 sm:text-lg">{initials(creator.display_name)}</span>
              )}
            </div>

            <div className="min-w-0">
              <Link to={creatorProfilePath} className="block truncate font-display text-lg font-bold text-ink transition hover:text-cobalt-700 sm:text-xl">
                {creator.display_name}
              </Link>
              <p className="mt-0.5 text-xs text-sand-600 sm:text-sm">{creator.niche || creator.creator_category}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1">
            <span className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.09em] text-sand-700 sm:px-2.5 sm:text-[10px]">
              {creator.creator_category}
            </span>
            {creator.is_verified ? (
              <span className="rounded-full bg-forest-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.09em] text-forest-700 sm:px-2.5 sm:text-[10px]">
                Verified
              </span>
            ) : null}
            {fresh ? (
              <span className="rounded-full bg-sunset-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.09em] text-sunset-700 sm:px-2.5 sm:text-[10px]">
                New
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-sand-200 bg-sand-50/80 p-2.5 sm:mt-4 sm:p-3">
          <p className="line-clamp-2 text-xs text-sand-700 sm:line-clamp-3 sm:text-sm">{creator.bio || "Template creator building digital products on Crib."}</p>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-2.5 py-2 text-xs text-sand-700 sm:mt-4">
          <StarRating value={creator.average_rating} size="sm" />
          <span>
            {creator.review_count > 0
              ? `${creator.average_rating.toFixed(1)}/5 (${creator.review_count} review${creator.review_count === 1 ? "" : "s"})`
              : "No reviews yet"}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl border border-sand-200 bg-white p-1.5 sm:mt-4 sm:gap-2 sm:p-2">
          <StatBlock label="Assets" value={String(creator.published_assets)} />
          <StatBlock label="Followers" value={new Intl.NumberFormat("en-US").format(creator.follower_count)} />
        </div>

        <p className="mt-2 text-[11px] text-sand-500">Joined {toDateLabel(creator.created_at)}</p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4">
          <Link
            to={creatorProfilePath}
            className="inline-flex items-center justify-center rounded-full bg-cobalt-600 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-white transition hover:bg-cobalt-700 sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.1em]"
          >
            {canViewProfiles ? "View profile" : "Sign in to view"}
          </Link>
          <Link
            to={`/market?q=${encodeURIComponent(creator.display_name)}`}
            className="inline-flex items-center justify-center rounded-full border border-sand-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-ink transition hover:bg-sand-100 sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.1em]"
          >
            Browse work
          </Link>
        </div>
      </div>
    </article>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-sand-50 px-1.5 py-1 text-center sm:px-2 sm:py-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-sand-500 sm:text-[10px] sm:tracking-[0.1em]">{label}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-ink sm:text-xs">{value}</p>
    </div>
  );
}
