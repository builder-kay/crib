import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { PriceTag } from "@/components/PriceTag";
import type { Asset } from "@/lib/types";
import { SectionHeader, assetStatusChip, useAdminWorkspace } from "@/pages/admin/AdminWorkspace";

export function AdminListingsPage() {
  const { assets, assetsLoading, pendingAssetStatusId, setAssetStatus } = useAdminWorkspace();
  const [assetSearch, setAssetSearch] = useState("");
  const [assetStatusFilter, setAssetStatusFilter] = useState<Asset["status"] | "all">("all");

  const filteredAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    return assets.filter((asset) => {
      if (assetStatusFilter !== "all" && asset.status !== assetStatusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [asset.title, asset.category, asset.profile?.display_name ?? "", ...(asset.tags ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [assetSearch, assetStatusFilter, assets]);

  return (
    <section className="admin-platform-shell space-y-5">
      <header className="surface-card-vivid admin-hero-panel p-5 md:p-6">
        <SectionHeader eyebrow="Moderation" title="Listings" body="Search the catalog, inspect creator uploads, and change listing status from a dedicated moderation page." />
      </header>

      <section className="surface-card admin-panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[440px]">
            <label className="admin-input-group">
              <span>Search listings</span>
              <input value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="Title, creator, category, or tag" className="admin-input" />
            </label>
            <label className="admin-input-group">
              <span>Status</span>
              <select value={assetStatusFilter} onChange={(event) => setAssetStatusFilter(event.target.value as Asset["status"] | "all")} className="admin-input">
                <option value="all">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {!assetsLoading && filteredAssets.length === 0 ? <EmptyState title="No listings match this filter" body="Try a wider search or switch the status filter back to all." /> : null}
          {filteredAssets.map((asset) => {
            const isUpdating = pendingAssetStatusId === asset.id;

            return (
              <article key={asset.id} className="admin-record-card">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/asset/${asset.id}`} className="font-display text-xl font-semibold text-ink hover:text-cobalt-700">
                        {asset.title}
                      </Link>
                      <span className={assetStatusChip(asset.status)}>{asset.status}</span>
                      <span className="admin-chip admin-chip-sand">{asset.category}</span>
                    </div>
                    <p className="mt-2 max-w-3xl text-sm text-sand-700">{asset.description || "No listing description yet."}</p>
                  </div>

                  <div className="admin-record-actions">
                    <PriceTag amountKobo={asset.price_kobo} currency={asset.currency} />
                    <label className="admin-input-group w-full">
                      <span>Publish state</span>
                      <select value={asset.status} disabled={isUpdating} onChange={(event) => setAssetStatus(asset.id, event.target.value as Asset["status"])} className="admin-input">
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
                    </label>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
