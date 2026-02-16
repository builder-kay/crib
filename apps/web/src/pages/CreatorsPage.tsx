import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { SearchInput } from "@/components/SearchInput";
import { getCreatorDirectory } from "@/lib/api";
import type { CreatorDirectoryEntry } from "@/lib/types";

type CreatorSort = "trending" | "newest";

const SORT_OPTIONS: Array<{ value: CreatorSort; label: string }> = [
  { value: "trending", label: "Trending" },
  { value: "newest", label: "Newest" }
];

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
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<CreatorSort>("trending");

  const deferredSearch = useDeferredValue(search);
  const creatorsQuery = useQuery({
    queryKey: ["creator-directory", deferredSearch, sort],
    queryFn: () => getCreatorDirectory({ search: deferredSearch, sort })
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
    <div className="space-y-6">
      <header className="surface-card-vivid subtle-pattern p-5 md:p-6">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-600">Creator Discovery</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">Browse Creator Profiles</h1>
            <p className="mt-2 max-w-3xl text-sm text-sand-700 md:text-base">
              Discover creatives by niche, category, and momentum. Follow trending talent and spot rising newcomers early.
            </p>
          </div>
        </div>
      </header>

      <section className="surface-card space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-[2fr,1fr,1fr]">
          <SearchInput value={search} onChange={setSearch} placeholder="Search creator name, niche, category..." />

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-full border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ink outline-none transition focus:border-cobalt-400 focus:bg-white"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All categories" : item}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as CreatorSort)}
            className="rounded-full border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ink outline-none transition focus:border-cobalt-400 focus:bg-white"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCreators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CreatorCard({
  creator,
  variant = "default"
}: {
  creator: CreatorDirectoryEntry;
  variant?: "default" | "featured";
}) {
  const fresh = isNewCreator(creator.created_at);
  const classes =
    variant === "featured"
      ? "surface-card-vivid border-cobalt-200"
      : "surface-card border-sand-200";

  return (
    <article className={`overflow-hidden p-4 ${classes}`}>
      <div className="flex items-start gap-3">
        {creator.avatar_url ? (
          <img src={creator.avatar_url} alt={creator.display_name} className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded-full bg-cobalt-100 font-display text-lg font-bold text-cobalt-700">
            {initials(creator.display_name)}
          </div>
        )}

        <div className="min-w-0">
          <Link to={`/profile/${creator.id}`} className="block truncate font-display text-lg font-bold text-ink hover:text-cobalt-700">
            {creator.display_name}
          </Link>
          <p className="text-sm text-sand-600">{creator.niche || creator.creator_category}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5 text-[11px] font-medium text-sand-700">
              {creator.creator_category}
            </span>
            {creator.is_verified ? (
              <span className="rounded-full bg-forest-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-forest-700">
                Verified
              </span>
            ) : null}
            {fresh ? (
              <span className="rounded-full bg-sunset-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-sunset-700">
                New
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-sand-700">{creator.bio || "Creative building digital products on Crib."}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-sand-200 bg-white p-2 text-center">
        <StatBlock label="Assets" value={String(creator.published_assets)} />
        <StatBlock label="Joined" value={toDateLabel(creator.created_at)} />
      </div>

      <Link
        to={`/profile/${creator.id}`}
        className="mt-4 inline-flex rounded-full border border-sand-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink transition hover:bg-sand-100"
      >
        View profile
      </Link>
    </article>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-sand-50 px-2 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sand-500">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-ink">{value}</p>
    </div>
  );
}
