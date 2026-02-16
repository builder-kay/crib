import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AssetGrid } from "@/components/AssetGrid";
import { EmptyState } from "@/components/EmptyState";
import { FilterBar } from "@/components/FilterBar";
import { SkeletonCard } from "@/components/SkeletonCard";
import { getPublishedAssets } from "@/lib/api";
import type { Asset } from "@/lib/types";
import { ASSET_CATEGORIES } from "@/lib/validators/asset";

type FeedMode = "for-you" | "recent";

function sortFeed(assets: Asset[], mode: FeedMode) {
  const source = [...assets];

  if (mode === "recent") {
    return source.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  return source.sort((a, b) => {
    const byTags = (b.tags?.length ?? 0) - (a.tags?.length ?? 0);
    if (byTags !== 0) {
      return byTags;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function MarketPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const querySearch = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(querySearch);
  const [category, setCategory] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [fileType, setFileType] = useState("all");
  const [feedMode, setFeedMode] = useState<FeedMode>("for-you");

  useEffect(() => {
    setSearch((previous) => (previous === querySearch ? previous : querySearch));
  }, [querySearch]);

  useEffect(() => {
    const normalizedSearch = search.trim();
    if (normalizedSearch === querySearch) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    if (normalizedSearch) {
      nextParams.set("q", normalizedSearch);
    } else {
      nextParams.delete("q");
    }
    setSearchParams(nextParams, { replace: true });
  }, [querySearch, search, searchParams, setSearchParams]);

  const deferredSearch = useDeferredValue(search);

  const filters = useMemo(
    () => ({
      search: deferredSearch,
      category,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      fileType
    }),
    [deferredSearch, category, minPrice, maxPrice, fileType]
  );

  const assetsQuery = useQuery({
    queryKey: ["market-assets", filters],
    queryFn: () => getPublishedAssets(filters)
  });

  const displayAssets = useMemo(() => sortFeed(assetsQuery.data ?? [], feedMode), [assetsQuery.data, feedMode]);
  const hasActiveFilters =
    search.trim().length > 0 ||
    category !== "all" ||
    minPrice.trim().length > 0 ||
    maxPrice.trim().length > 0 ||
    fileType !== "all";

  function handleResetFilters() {
    setSearch("");
    setCategory("all");
    setMinPrice("");
    setMaxPrice("");
    setFileType("all");

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("q");
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <div className="discover-shell space-y-5">
      <header className="surface-card-vivid discover-hero-panel relative overflow-hidden p-5 md:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-cobalt-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/4 h-44 w-44 rounded-full bg-lagoon-100/60 blur-3xl" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cobalt-600">Discover</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">Creative Assets Marketplace</h1>
              <p className="mt-1 max-w-3xl text-sm text-sand-700 md:text-base">
                Explore curated digital products from designers, producers, and visual storytellers.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.1em]">
              <span className="rounded-full border border-cobalt-200 bg-white/90 px-3 py-1 text-cobalt-700">Curated digital catalog</span>
              <span className="rounded-full border border-cobalt-200 bg-white/90 px-3 py-1 text-cobalt-700">Creator-first marketplace</span>
              <span className="rounded-full border border-cobalt-200 bg-white/90 px-3 py-1 text-cobalt-700">Instant purchase flow</span>
            </div>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="flex w-max items-center gap-2 pr-2">
              <button
                type="button"
                onClick={() => setCategory("all")}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  category === "all"
                    ? "border-cobalt-600 bg-cobalt-600 text-white"
                    : "border border-sand-200 bg-white text-sand-700 hover:border-cobalt-200 hover:bg-cobalt-50"
                }`}
              >
                All
              </button>
              {ASSET_CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                    category === item
                      ? "border-cobalt-600 bg-cobalt-600 text-white"
                      : "border border-sand-200 bg-white text-sand-700 hover:border-cobalt-200 hover:bg-cobalt-50"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="surface-card discover-mode-bar flex flex-wrap items-center gap-2 p-2">
        <FeedTab mode={feedMode} value="for-you" label="For You" onSelect={setFeedMode} />
        <FeedTab mode={feedMode} value="recent" label="Latest" onSelect={setFeedMode} />

        <div className="ml-auto flex items-center gap-2 text-xs text-sand-600">
          <span className="rounded-full border border-sand-200 bg-white px-2.5 py-1 font-semibold uppercase tracking-[0.1em]">
            {assetsQuery.isLoading ? "Loading..." : `${displayAssets.length} results`}
          </span>
        </div>
      </section>

      <FilterBar
        search={search}
        category={category}
        minPrice={minPrice}
        maxPrice={maxPrice}
        fileType={fileType}
        onSearchChange={setSearch}
        onCategoryChange={setCategory}
        onMinPriceChange={setMinPrice}
        onMaxPriceChange={setMaxPrice}
        onFileTypeChange={setFileType}
        onResetFilters={handleResetFilters}
        canResetFilters={hasActiveFilters}
      />

      {hasActiveFilters ? (
        <section className="flex flex-wrap items-center gap-2 px-1 text-xs">
          <span className="font-medium uppercase tracking-[0.1em] text-sand-500">Active filters</span>
          {category !== "all" ? <FilterPill label={category} onClear={() => setCategory("all")} /> : null}
          {fileType !== "all" ? <FilterPill label={fileType} onClear={() => setFileType("all")} /> : null}
          {minPrice ? <FilterPill label={`Min ${minPrice}`} onClear={() => setMinPrice("")} /> : null}
          {maxPrice ? <FilterPill label={`Max ${maxPrice}`} onClear={() => setMaxPrice("")} /> : null}
          {search.trim() ? <FilterPill label={`"${search.trim()}"`} onClear={() => setSearch("")} /> : null}
        </section>
      ) : null}

      {assetsQuery.isLoading ? (
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </section>
      ) : null}

      {assetsQuery.isError ? (
        <EmptyState
          title="Could not load assets"
          body={assetsQuery.error instanceof Error ? assetsQuery.error.message : "Try again shortly."}
        />
      ) : null}

      {displayAssets.length > 0 ? <AssetGrid assets={displayAssets} /> : null}

      {assetsQuery.data && assetsQuery.data.length === 0 ? (
        <EmptyState title="No assets found" body="Adjust your filters or check back soon for fresh creative work." />
      ) : null}
    </div>
  );
}

function FeedTab({
  mode,
  value,
  label,
  onSelect
}: {
  mode: FeedMode;
  value: FeedMode;
  label: string;
  onSelect: (value: FeedMode) => void;
}) {
  const isActive = mode === value;

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
        isActive
          ? "border-cobalt-600 bg-cobalt-600 text-white"
          : "border-sand-200 bg-white text-sand-700 hover:border-cobalt-200 hover:bg-cobalt-50"
      }`}
    >
      {label}
    </button>
  );
}

function FilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-full border border-cobalt-200 bg-cobalt-50 px-2.5 py-1 font-semibold tracking-[0.06em] text-cobalt-700 transition hover:border-cobalt-300 hover:bg-cobalt-100"
    >
      <span>{label}</span>
      <span aria-hidden="true">x</span>
    </button>
  );
}
