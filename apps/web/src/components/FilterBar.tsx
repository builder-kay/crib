import { ASSET_CATEGORIES } from "@/lib/validators/asset";
import { SearchInput } from "@/components/SearchInput";

type FilterBarProps = {
  search: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  fileType: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
  onFileTypeChange: (value: string) => void;
};

const FILE_TYPES = [
  { value: "all", label: "Any file" },
  { value: "image", label: "Image" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
  { value: "application", label: "Document / ZIP" }
];

export function FilterBar({
  search,
  category,
  minPrice,
  maxPrice,
  fileType,
  onSearchChange,
  onCategoryChange,
  onMinPriceChange,
  onMaxPriceChange,
  onFileTypeChange
}: FilterBarProps) {
  return (
    <section className="surface-card space-y-3 p-3 md:p-4">
      <div className="grid gap-3 md:grid-cols-[2.1fr,1fr,1.2fr,1fr]">
        <SearchInput value={search} onChange={onSearchChange} placeholder="Search projects, tools, presets..." />

        <select
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
          className="rounded-full border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ink outline-none transition focus:border-cobalt-400 focus:bg-white"
        >
          <option value="all">All categories</option>
          {ASSET_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 rounded-full border border-sand-200 bg-sand-50 px-3 py-2">
          <input
            type="number"
            min={0}
            value={minPrice}
            onChange={(event) => onMinPriceChange(event.target.value)}
            placeholder="Min GHS"
            className="w-full bg-transparent text-sm outline-none placeholder:text-sand-400"
          />
          <span className="text-sand-400">-</span>
          <input
            type="number"
            min={0}
            value={maxPrice}
            onChange={(event) => onMaxPriceChange(event.target.value)}
            placeholder="Max GHS"
            className="w-full bg-transparent text-sm outline-none placeholder:text-sand-400"
          />
        </div>

        <select
          value={fileType}
          onChange={(event) => onFileTypeChange(event.target.value)}
          className="rounded-full border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-ink outline-none transition focus:border-cobalt-400 focus:bg-white"
        >
          {FILE_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-sand-600">
        <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1.5">Curated picks</span>
        <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1.5">Ready-to-use packs</span>
        <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1.5">Commercial license</span>
      </div>
    </section>
  );
}
