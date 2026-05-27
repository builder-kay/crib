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
  const quickToolFilters = [
    { value: "all", label: "Explore all", kicker: "Every format" },
    { value: "Figma Templates", label: "Figma", kicker: "UI kits" },
    { value: "Canva Templates", label: "Canva", kicker: "Social packs" },
    { value: "Audio / Beats", label: "Audio", kicker: "Beats" }
  ];
  const activeToolLabel =
    quickToolFilters.find((item) => item.value === category)?.label ?? (selectedAdobeCategory ? "Adobe" : "Custom");

  const showMobileFilters = mobileOpen;
  const showMobileToggle = compactOnMobile || mobileOpen;

  return (
    <section
      className={`surface-card discover-filter-panel p-3 md:p-4 ${
        subdued ? "discover-filter-panel-subdued" : ""
      } ${compactOnMobile && !mobileOpen ? "discover-filter-panel-mobile-compact" : ""}`}
    >
      <div className="discover-filter-topline">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cobalt-700">Creative filter</p>
          <p className="mt-0.5 text-sm font-semibold text-ink">Shape the marketplace around your next build.</p>
        </div>
        <span className="discover-filter-live-badge">{activeToolLabel}</span>
      </div>

      <div className={`${showMobileFilters ? "block" : "hidden"} md:block mt-2 space-y-2`}>
        <div className="discover-tool-strip">
          <div className="flex w-full flex-wrap items-stretch gap-2">
            {quickToolFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onCategoryChange(item.value)}
                className={`discover-tool-chip ${category === item.value ? "discover-tool-chip-active" : ""}`}
              >
                <span>{item.label}</span>
                <small>{item.kicker}</small>
              </button>
            ))}
            <select
              value={selectedAdobeCategory}
              onChange={(event) => onCategoryChange(event.target.value || "all")}
              className={`discover-adobe-select ${selectedAdobeCategory ? "discover-adobe-select-active" : ""}`}
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

      <div className="mt-2 grid gap-2 md:grid-cols-[2fr,1.2fr,1.5fr,1fr,auto]">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SearchInput value={search} onChange={onSearchChange} placeholder="Search assets, beats, creators, apps, or styles..." />
          {showMobileToggle ? (
            <button
              type="button"
              onClick={() => onMobileOpenChange?.(!mobileOpen)}
              className="discover-filter-toggle md:hidden"
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
            className="discover-filter-select"
          >
            <option value="all">All asset categories</option>
            {ASSET_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <div className="discover-price-field">
            <input
              type="number"
              min={0}
              value={minPrice}
              onChange={(event) => onMinPriceChange(event.target.value)}
              placeholder="Min price"
              className="w-full bg-transparent text-sm outline-none placeholder:text-sand-400"
            />
            <span className="text-sand-400">to</span>
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
            className="discover-filter-select"
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
              className="discover-reset-button"
            >
              Reset filters
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
