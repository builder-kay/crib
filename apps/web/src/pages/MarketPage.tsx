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

  return (
    <div className="space-y-5">
      <header className="surface-card-vivid space-y-4 p-5 md:p-6">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cobalt-600">Discover</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">Creative Assets Marketplace</h1>
            <p className="mt-1 max-w-3xl text-sm text-sand-600 md:text-base">
              Explore curated digital products from designers, producers, and visual storytellers.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="flex w-max items-center gap-2 pr-2">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                category === "all" ? "bg-cobalt-600 text-white" : "border border-sand-200 bg-white text-sand-700 hover:bg-sand-100"
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
                  category === item ? "bg-cobalt-600 text-white" : "border border-sand-200 bg-white text-sand-700 hover:bg-sand-100"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-2">
        <FeedTab mode={feedMode} value="for-you" label="For You" onSelect={setFeedMode} />
        <FeedTab mode={feedMode} value="recent" label="Latest" onSelect={setFeedMode} />
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
      />

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
        isActive ? "border-cobalt-600 bg-cobalt-600 text-white" : "border-sand-200 bg-white text-sand-700 hover:bg-sand-100"
      }`}
    >
      {label}
    </button>
  );
}
