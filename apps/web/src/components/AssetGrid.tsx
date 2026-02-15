import { AssetCard } from "@/components/AssetCard";
import type { Asset } from "@/lib/types";

type AssetGridProps = {
  assets: Asset[];
};

export function AssetGrid({ assets }: AssetGridProps) {
  return (
    <section className="grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {assets.map((asset) => (
        <AssetCard key={asset.id} asset={asset} />
      ))}
    </section>
  );
}
