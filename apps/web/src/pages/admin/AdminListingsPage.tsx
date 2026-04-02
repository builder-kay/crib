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

  const assetSummary = useMemo(
    () =>
      assets.reduce(
        (summary, asset) => {
          summary.total += 1;
          summary[asset.status] += 1;
          return summary;
        },
        { total: 0, published: 0, draft: 0, archived: 0 }
      ),
    [assets]
  );

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
        <div className="admin-page-hero-grid">
          <SectionHeader eyebrow="Moderation" title="Listings" body="Search the catalog, inspect creator uploads, and move each listing cleanly between draft, published, and archived states." />
          <aside className="admin-page-hero-rail">
            <div className="admin-hero-glance-card">
              <p className="admin-hero-glance-eyebrow">Catalog Balance</p>
              <div className="mt-3 admin-glance-grid">
                <div className="admin-hero-glance-item admin-hero-glance-item-cobalt">
                  <span>Total listings</span>
                  <strong>{assetSummary.total}</strong>
                </div>
                <div className="admin-hero-glance-item admin-hero-glance-item-lagoon">
                  <span>Published</span>
                  <strong>{assetSummary.published}</strong>
                </div>
                <div className="admin-hero-glance-item admin-hero-glance-item-sunset">
                  <span>Draft</span>
                  <strong>{assetSummary.draft}</strong>
                </div>
                <div className="admin-hero-glance-item admin-hero-glance-item-rose">
                  <span>Archived</span>
                  <strong>{assetSummary.archived}</strong>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </header>

      <section className="surface-card admin-panel p-5">
        <div className="admin-toolbar">
          <div className="admin-toolbar-layout">
            <div className="admin-toolbar-fields">
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

            <div className="admin-toolbar-copy">
              <p className="admin-toolbar-label">Visible results</p>
              <p className="admin-toolbar-value">{filteredAssets.length}</p>
              <p className="admin-toolbar-note">
                Use this lane to review previews, pricing, creator context, and the current publish state without leaving the admin workspace.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 admin-summary-grid">
          <div className="admin-mini-insight admin-mini-insight-cobalt">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Total</p>
            <p className="mt-2 font-display text-2xl font-bold">{assetSummary.total}</p>
            <p className="mt-1 text-sm opacity-90">All creator uploads</p>
          </div>
          <div className="admin-mini-insight admin-summary-pill-lagoon">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Published</p>
            <p className="mt-2 font-display text-2xl font-bold">{assetSummary.published}</p>
            <p className="mt-1 text-sm opacity-90">Live in marketplace</p>
          </div>
          <div className="admin-mini-insight admin-summary-pill-sunset">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Draft</p>
            <p className="mt-2 font-display text-2xl font-bold">{assetSummary.draft}</p>
            <p className="mt-1 text-sm opacity-90">Waiting on refinement</p>
          </div>
          <div className="admin-mini-insight admin-summary-pill-rose">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Archived</p>
            <p className="mt-2 font-display text-2xl font-bold">{assetSummary.archived}</p>
            <p className="mt-1 text-sm opacity-90">Removed from live catalog</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {!assetsLoading && filteredAssets.length === 0 ? <EmptyState title="No listings match this filter" body="Try a wider search or switch the status filter back to all." /> : null}
          {filteredAssets.map((asset) => {
            const isUpdating = pendingAssetStatusId === asset.id;
            const previewUrl = asset.previews?.[0]?.preview_url;

            return (
              <article key={asset.id} className="admin-record-card">
                <div className="admin-record-layout">
                  <div className="admin-record-media-shell">
                    {previewUrl ? (
                      <img src={previewUrl} alt={asset.title} className="admin-record-media" />
                    ) : (
                      <div className="admin-record-media admin-record-media-fallback">No preview</div>
                    )}
                  </div>

                  <div className="admin-record-primary">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/asset/${asset.id}`} className="font-display text-xl font-semibold text-ink hover:text-cobalt-700">
                        {asset.title}
                      </Link>
                      <span className={assetStatusChip(asset.status)}>{asset.status}</span>
                      <span className="admin-chip admin-chip-sand">{asset.category}</span>
                    </div>
                    <p className="mt-2 max-w-3xl text-sm text-sand-700">{asset.description || "No listing description yet."}</p>

                    <div className="mt-4 admin-detail-grid">
                      <div className="admin-record-mini">
                        <p className="admin-record-mini-label">Creator</p>
                        <p className="admin-record-mini-value">{asset.profile?.display_name ?? "Unknown creator"}</p>
                      </div>
                      <div className="admin-record-mini">
                        <p className="admin-record-mini-label">Created</p>
                        <p className="admin-record-mini-value">{new Date(asset.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="admin-record-mini">
                        <p className="admin-record-mini-label">Tags</p>
                        <p className="admin-record-mini-value">{asset.tags.length > 0 ? `${asset.tags.length} attached` : "No tags"}</p>
                      </div>
                    </div>

                    {asset.tags.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {asset.tags.slice(0, 6).map((tag) => (
                          <span key={tag} className="admin-chip admin-chip-sand">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
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
