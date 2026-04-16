import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency, formatDate } from "@/lib/format";
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
                This lane now uses a spreadsheet-style table so you can scan pricing, tags, creator info, and publish state more quickly.
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

        <div className="mt-5">
          {!assetsLoading && filteredAssets.length === 0 ? <EmptyState title="No listings match this filter" body="Try a wider search or switch the status filter back to all." /> : null}

          {filteredAssets.length > 0 ? (
            <div className="admin-data-table-shell">
              <table className="admin-data-table admin-data-table-wide">
                <thead>
                  <tr>
                    <th>Listing</th>
                    <th>Creator</th>
                    <th>Category</th>
                    <th>Tags</th>
                    <th>Pricing</th>
                    <th>Created</th>
                    <th>Publish state</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((asset) => {
                    const isUpdating = pendingAssetStatusId === asset.id;
                    const previewUrl = asset.previews?.[0]?.preview_url;

                    return (
                      <tr key={asset.id}>
                        <td>
                          <div className="admin-data-table-cell">
                            <div className="flex min-w-0 items-start gap-3">
                              {previewUrl ? (
                                <img src={previewUrl} alt={asset.title} className="h-14 w-14 rounded-2xl border border-sand-200 object-cover" />
                              ) : (
                                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-dashed border-sand-300 bg-sand-50 text-[10px] font-semibold uppercase tracking-[0.14em] text-sand-500">
                                  No preview
                                </div>
                              )}
                              <div className="min-w-0">
                                <Link to={`/asset/${asset.id}`} className="admin-data-table-main admin-data-table-main-link">
                                  {asset.title}
                                </Link>
                                <span className="admin-data-table-meta">{asset.description?.trim() || "No listing description yet."}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="admin-data-table-cell">
                            <span className="admin-data-table-main">{asset.profile?.display_name ?? "Unknown creator"}</span>
                            <span className="admin-data-table-meta">{asset.profile?.creator_category ?? "Creator profile unavailable"}</span>
                          </div>
                        </td>
                        <td>
                          <div className="admin-data-table-stack">
                            <span className="admin-chip admin-chip-sand">{asset.category}</span>
                            <span className={assetStatusChip(asset.status)}>{asset.status}</span>
                          </div>
                        </td>
                        <td>
                          {asset.tags.length > 0 ? (
                            <div className="admin-table-chip-row">
                              {asset.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="admin-chip admin-chip-sand">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="admin-data-table-meta">No tags</span>
                          )}
                        </td>
                        <td>
                          <div className="admin-data-table-cell">
                            <span className="admin-data-table-main">{formatListingPrice(asset)}</span>
                            <span className="admin-data-table-meta">{asset.pricing_model.replace(/_/g, " ")}</span>
                          </div>
                        </td>
                        <td>
                          <div className="admin-data-table-cell">
                            <span className="admin-data-table-main">{formatDate(asset.created_at)}</span>
                            <span className="admin-data-table-meta">{asset.tags.length > 0 ? `${asset.tags.length} tag${asset.tags.length === 1 ? "" : "s"}` : "No tags attached"}</span>
                          </div>
                        </td>
                        <td>
                          <label className="admin-input-group min-w-[11rem]">
                            <span>State</span>
                            <select value={asset.status} disabled={isUpdating} onChange={(event) => setAssetStatus(asset.id, event.target.value as Asset["status"])} className="admin-input">
                              <option value="draft">Draft</option>
                              <option value="published">Published</option>
                              <option value="archived">Archived</option>
                            </select>
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function formatListingPrice(asset: Asset) {
  if (asset.pricing_model === "free" || asset.price_kobo <= 0) {
    return "Free";
  }

  if (asset.pricing_model === "pay_what_you_want") {
    return `From ${formatCurrency(asset.minimum_price_kobo, asset.currency)}`;
  }

  return formatCurrency(asset.price_kobo, asset.currency);
}
