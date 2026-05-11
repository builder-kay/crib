import { useMemo } from "react";
import { ASSET_CATEGORIES, ADOBE_APP_CATEGORIES, MARKET_FILE_FILTERS } from "@/lib/validators/asset";
import { SearchInput } from "@/components/SearchInput";

type FilterBarProps = {
  search: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  fileType: string;
  compactOnMobile?: boolean;
  mobileOpen?: boolean;
  subdued?: boolean;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
  onFileTypeChange: (value: string) => void;
  onMobileOpenChange?: (value: boolean) => void;
  onResetFilters?: () => void;
  canResetFilters?: boolean;
};

export function FilterBar({
  search,
  category,
  minPrice,
  maxPrice,
  fileType,
  compactOnMobile = false,
  mobileOpen = false,
  subdued = false,
  onSearchChange,
  onCategoryChange,
  onMinPriceChange,
  onMaxPriceChange,
  onFileTypeChange,
  onMobileOpenChange,
  onResetFilters,
  canResetFilters = false
}: FilterBarProps) {
  const selectedAdobeCategory = useMemo(
    () => (ADOBE_APP_CATEGORIES as readonly string[]).includes(category) ? category : "",
    [category]
  );

  const showMobileFilters = mobileOpen;
  const showMobileToggle = compactOnMobile || mobileOpen;

  return (
    <section
      className={`surface-card discover-filter-panel p-3 md:p-4 ${
        subdued ? "discover-filter-panel-subdued" : ""
      } ${compactOnMobile && !mobileOpen ? "discover-filter-panel-mobile-compact" : ""}`}
    >
      <div className={`${showMobileFilters ? "block" : "hidden"} md:block space-y-3 mb-3 md:mb-4`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sand-500">Browse by tool</p>
        <div className="overflow-hidden pb-1">
          <div className="flex w-full flex-wrap items-center gap-2 pr-2">
            <button
              type="button"
              onClick={() => onCategoryChange("all")}
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
              onClick={() => onCategoryChange("Figma Templates")}
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
              onClick={() => onCategoryChange("Canva Templates")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                category === "Canva Templates"
                  ? "border-cobalt-600 bg-cobalt-600 text-white"
                  : "border border-sand-200 bg-white text-sand-700 hover:border-cobalt-200 hover:bg-cobalt-50"
              }`}
            >
              Canva
            </button>
            <button
              type="button"
              onClick={() => onCategoryChange("Audio / Beats")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                category === "Audio / Beats"
                  ? "border-cobalt-600 bg-cobalt-600 text-white"
                  : "border border-sand-200 bg-white text-sand-700 hover:border-cobalt-200 hover:bg-cobalt-50"
              }`}
            >
              Audio / Beats
            </button>
            <select
              value={selectedAdobeCategory}
              onChange={(event) => onCategoryChange(event.target.value || "all")}
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

      <div className="grid gap-3 md:grid-cols-[2fr,1.2fr,1.5fr,1fr,auto]">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SearchInput value={search} onChange={onSearchChange} placeholder="Search assets, beats, creators, apps, or styles..." />
          {showMobileToggle ? (
            <button
              type="button"
              onClick={() => onMobileOpenChange?.(!mobileOpen)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-sand-200 bg-white text-sand-700 transition hover:border-cobalt-200 hover:bg-cobalt-50 md:hidden"
              aria-label={mobileOpen ? "Hide filter options" : "Show filter options"}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          ) : null}
        </div>

        <div className={`discover-filter-controls ${showMobileFilters ? "grid gap-3" : "hidden"} md:contents`}>
          <select
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
            className="rounded-full border border-sand-200 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-cobalt-400"
          >
            <option value="all">All asset categories</option>
            {ASSET_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-2">
            <input
              type="number"
              min={0}
              value={minPrice}
              onChange={(event) => onMinPriceChange(event.target.value)}
              placeholder="Min price"
              className="w-full bg-transparent text-sm outline-none placeholder:text-sand-400"
            />
            <span className="text-sand-400">-</span>
            <input
              type="number"
              min={0}
              value={maxPrice}
              onChange={(event) => onMaxPriceChange(event.target.value)}
              placeholder="Max price"
              className="w-full bg-transparent text-sm outline-none placeholder:text-sand-400"
            />
          </div>

          <select
            value={fileType}
            onChange={(event) => onFileTypeChange(event.target.value)}
            className="rounded-full border border-sand-200 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-cobalt-400"
          >
            {MARKET_FILE_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          {onResetFilters ? (
            <button
              type="button"
              onClick={onResetFilters}
              disabled={!canResetFilters}
              className="rounded-full border border-sand-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink transition hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-50 md:self-center md:whitespace-nowrap"
            >
              Reset filters
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
