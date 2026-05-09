import { ASSET_CATEGORIES, MARKET_FILE_FILTERS } from "@/lib/validators/asset";
import { SearchInput } from "@/components/SearchInput";

type FilterBarProps = {
  search: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  fileType: string;
  compactOnMobile?: boolean;
  subdued?: boolean;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
  onFileTypeChange: (value: string) => void;
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
  subdued = false,
  onSearchChange,
  onCategoryChange,
  onMinPriceChange,
  onMaxPriceChange,
  onFileTypeChange,
  onResetFilters,
  canResetFilters = false
}: FilterBarProps) {
  return (
    <section
      className={`surface-card discover-filter-panel p-3 md:p-4 ${
        subdued ? "discover-filter-panel-subdued" : ""
      } ${compactOnMobile ? "discover-filter-panel-mobile-compact" : ""}`}
    >
      <div className="grid gap-3 md:grid-cols-[2fr,1fr,1.2fr,1fr,auto]">
        <div className="min-w-0">
          <SearchInput value={search} onChange={onSearchChange} placeholder="Search assets, beats, creators, apps, or styles..." />
        </div>

        <div className="discover-filter-controls grid gap-3 md:contents">
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
