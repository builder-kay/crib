import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AssetGrid } from "@/components/AssetGrid";
import { EmptyState } from "@/components/EmptyState";
import { FilterBar } from "@/components/FilterBar";
import { SkeletonCard } from "@/components/SkeletonCard";
import { getUserContactEmail } from "@/lib/auth";
import { getPublishedAssets, trackAnalyticsEvent } from "@/lib/api";
import type { Asset } from "@/lib/types";
import { ADOBE_APP_CATEGORIES, MARKET_FILE_FILTERS } from "@/lib/validators/asset";
import { useAuthStore } from "@/store/authStore";

export function MarketPage() {
  const user = useAuthStore((state) => state.user);
  const userContactEmail = getUserContactEmail(user);
  const [searchParams, setSearchParams] = useSearchParams();
  const querySearch = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(querySearch);
  const [category, setCategory] = useState("all");
  const [creator, setCreator] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [fileType, setFileType] = useState("all");

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
      creator,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      fileType
    }),
    [deferredSearch, category, creator, minPrice, maxPrice, fileType]
  );

  const assetsQuery = useQuery({
    queryKey: ["market-assets", filters],
    queryFn: () => getPublishedAssets(filters)
  });

  const displayAssets = assetsQuery.data ?? [];
  const fileTypeLabel = useMemo(
    () => MARKET_FILE_FILTERS.find((item) => item.value === fileType)?.label ?? fileType,
    [fileType]
  );
  const selectedAdobeCategory = (ADOBE_APP_CATEGORIES as readonly string[]).includes(category) ? category : "";
  const hasActiveFilters =
    search.trim().length > 0 ||
    category !== "all" ||
    creator.trim().length > 0 ||
    minPrice.trim().length > 0 ||
    maxPrice.trim().length > 0 ||
    fileType !== "all";

  function handleResetFilters() {
    setSearch("");
    setCategory("all");
    setCreator("");
    setMinPrice("");
    setMaxPrice("");
    setFileType("all");

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("q");
    setSearchParams(nextParams, { replace: true });
  }

  useEffect(() => {
    if (displayAssets.length === 0 || typeof window === "undefined") {
      return;
    }

    const storageKey = "crib.analytics.asset_views";
    const existing = window.sessionStorage.getItem(storageKey);
    let parsed: string[] = [];
    if (existing) {
      try {
        const value = JSON.parse(existing) as unknown;
        if (Array.isArray(value)) {
          parsed = value.filter((entry): entry is string => typeof entry === "string");
        }
      } catch {
        parsed = [];
      }
    }

    const seen = new Set<string>(parsed);
    const nextSeen = new Set(seen);

    for (const asset of displayAssets.slice(0, 24)) {
      const key = `${asset.id}:view`;
      if (seen.has(key)) {
        continue;
      }

      nextSeen.add(key);
      void trackAnalyticsEvent({
        eventName: "asset_view",
        assetId: asset.id,
        creatorId: asset.creator_id,
        actorUserId: user?.id,
        actorEmail: userContactEmail,
        metadata: {
          page: "market"
        }
      });
    }

    if (nextSeen.size !== seen.size) {
      window.sessionStorage.setItem(storageKey, JSON.stringify(Array.from(nextSeen)));
    }
  }, [displayAssets, user?.id, userContactEmail]);

  return (
    <div className="discover-shell space-y-5">
      <header className="surface-card-vivid discover-hero-panel relative overflow-hidden p-5 md:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-cobalt-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/4 h-44 w-44 rounded-full bg-lagoon-100/60 blur-3xl" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cobalt-600">Template Discovery</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">Marketplace</h1>
              <p className="mt-1 max-w-3xl text-sm text-sand-700 md:text-base">Buy and Sell Creative Templates</p>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.1em]">
              <span className="rounded-full border border-cobalt-200 bg-white/90 px-3 py-1 text-cobalt-700">Editable files</span>
              <span className="rounded-full border border-cobalt-200 bg-white/90 px-3 py-1 text-cobalt-700">Curated creator templates</span>
              <span className="rounded-full border border-cobalt-200 bg-white/90 px-3 py-1 text-cobalt-700">Instant downloads</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sand-500">Browse by platform</p>
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
                  Explore all
                </button>
                <button
                  type="button"
                  onClick={() => setCategory("Figma Templates")}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                    category === "Figma Templates"
                      ? "border-cobalt-600 bg-cobalt-600 text-white"
                      : "border border-sand-200 bg-white text-sand-700 hover:border-cobalt-200 hover:bg-cobalt-50"
                  }`}
                >
                  Figma
                </button>
                <button
                  type="button"
                  onClick={() => setCategory("Canva Templates")}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                    category === "Canva Templates"
                      ? "border-cobalt-600 bg-cobalt-600 text-white"
                      : "border border-sand-200 bg-white text-sand-700 hover:border-cobalt-200 hover:bg-cobalt-50"
                  }`}
                >
                  Canva
                </button>
                <select
                  value={selectedAdobeCategory}
                  onChange={(event) => setCategory(event.target.value || "all")}
                  className="shrink-0 rounded-full border border-sand-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-sand-700 outline-none transition hover:border-cobalt-200 focus:border-cobalt-300"
                >
                  <option value="">Adobe apps</option>
                  {ADOBE_APP_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      <FilterBar
        search={search}
        category={category}
        creator={creator}
        minPrice={minPrice}
        maxPrice={maxPrice}
        fileType={fileType}
        onSearchChange={setSearch}
        onCategoryChange={setCategory}
        onCreatorChange={setCreator}
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
          {creator.trim() ? <FilterPill label={`Creator ${creator.trim()}`} onClear={() => setCreator("")} /> : null}
          {fileType !== "all" ? <FilterPill label={fileTypeLabel} onClear={() => setFileType("all")} /> : null}
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
        <EmptyState title="No templates found" body="Adjust your filters or check back soon for fresh creator releases." />
      ) : null}
    </div>
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
