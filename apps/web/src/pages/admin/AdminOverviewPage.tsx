import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Order } from "@/lib/types";
import { InsightCard, MetricCard, SectionHeader, SignalRow, SummaryPill, assetStatusChip, orderStatusChip, useAdminWorkspace } from "@/pages/admin/AdminWorkspace";

export function AdminOverviewPage() {
  const { overview, assets, orders } = useAdminWorkspace();

  return (
    <div className="admin-platform-shell space-y-5">
      <header className="surface-card-vivid admin-hero-panel overflow-hidden p-5 md:p-6">
        <div className="admin-page-hero-grid">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Marketplace Command Center</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">Overview</h2>
            <p className="mt-2 text-sm text-sand-700 md:text-base">
              Start here for the storefront pulse, including which paid orders are still sitting in escrow and which ones have already released to creators.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="admin-chip admin-chip-cobalt">Storefront health</span>
              <span className="admin-chip admin-chip-sunset">Escrow monitoring</span>
              <span className="admin-chip admin-chip-forest">Creator network</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/admin/listings" className="admin-action-button">
                Review listings
              </Link>
              <Link to="/admin/orders" className="admin-action-button admin-action-button-secondary">
                Review orders
              </Link>
            </div>
          </div>

          <aside className="admin-page-hero-rail">
            <div className="admin-hero-volume-panel">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cobalt-700">Secured order volume</p>
              <p className="mt-2 font-display text-2xl font-bold text-ink">
                {overview?.order_volume[0] ? formatCurrency(overview.order_volume[0].amount_kobo, overview.order_volume[0].currency) : "No paid volume yet"}
              </p>
              <p className="mt-1 text-sm text-sand-700">
                {overview?.order_volume[0]
                  ? `${overview.order_volume[0].order_count} paid order${overview.order_volume[0].order_count === 1 ? "" : "s"} in the largest active currency bucket`
                  : "Revenue totals will appear here once buyers start completing checkout."}
              </p>
            </div>

            <div className="admin-hero-glance-card">
              <p className="admin-hero-glance-eyebrow">Today's Watch</p>
              <div className="mt-3 admin-glance-grid">
                <div className="admin-hero-glance-item admin-hero-glance-item-sunset">
                  <span>Escrow queue</span>
                  <strong>{overview ? `${overview.escrow_pending_orders}` : "..."}</strong>
                </div>
                <div className="admin-hero-glance-item admin-hero-glance-item-rose">
                  <span>Reported cases</span>
                  <strong>{overview ? `${overview.scam_reported_orders}` : "..."}</strong>
                </div>
                <div className="admin-hero-glance-item admin-hero-glance-item-lagoon">
                  <span>Draft listings</span>
                  <strong>{overview ? `${overview.draft_assets}` : "..."}</strong>
                </div>
                <div className="admin-hero-glance-item admin-hero-glance-item-forest">
                  <span>Payout-ready</span>
                  <strong>{overview ? `${overview.active_payout_accounts}` : "..."}</strong>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-5">
          <div className="admin-hero-summary-grid">
            <InsightCard label="Accounts" value={overview ? `${overview.total_profiles}` : "Loading..."} helper={overview ? `${overview.total_admins} platform admins` : "Checking access"} tone="cobalt" />
            <InsightCard label="Catalog" value={overview ? `${overview.published_assets} published` : "Loading..."} helper={overview ? `${overview.draft_assets} drafts waiting` : "Checking listings"} tone="forest" />
            <InsightCard label="Escrow" value={overview ? `${overview.escrow_pending_orders} held` : "Loading..."} helper={overview ? `${overview.released_orders} already released` : "Checking payout flow"} tone="sunset" />
          </div>
        </div>
      </header>

      <section className="admin-summary-grid gap-4">
        <MetricCard label="Accounts" value={overview ? `${overview.total_profiles}` : "Loading..."} helper={overview ? `${overview.active_creators} creators with listings` : "Loading creator footprint"} tone="cobalt" />
        <MetricCard label="Listings" value={overview ? `${overview.total_assets}` : "Loading..."} helper={overview ? `${overview.published_assets} live / ${overview.draft_assets} draft` : "Loading listing totals"} tone="lagoon" />
        <MetricCard label="Paid Orders" value={overview ? `${overview.paid_orders}` : "Loading..."} helper={overview ? `${overview.escrow_pending_orders} held / ${overview.released_orders} released` : "Loading order totals"} tone="sunset" />
        <MetricCard label="Network" value={overview ? `${overview.creator_follows}` : "Loading..."} helper={overview ? `${overview.wishlists} wishlist saves` : "Loading growth signals"} tone="forest" />
      </section>

      <section className="space-y-5">
        <section className="surface-card admin-panel p-5">
          <SectionHeader eyebrow="Recent activity" title="Latest listings and orders" body="A quick pulse check across the storefront areas that usually need the fastest admin response." />

          <div className="mt-4 space-y-4">
            <div className="admin-subpanel">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-lg font-semibold text-ink">Newest listings</h3>
                <Link to="/admin/listings" className="admin-inline-link">
                  Open listings
                </Link>
              </div>
              <div className="mt-3 space-y-3">
                {assets.slice(0, 4).map((asset) => (
                  <article key={asset.id} className="admin-compact-row">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{asset.title}</p>
                      <p className="mt-0.5 text-xs text-sand-600">
                        {asset.profile?.display_name ?? "Creator"} - {formatDate(asset.created_at)}
                      </p>
                    </div>
                    <span className={assetStatusChip(asset.status)}>{asset.status}</span>
                  </article>
                ))}

                {assets.length === 0 ? <p className="rounded-2xl border border-dashed border-sand-200 px-4 py-4 text-sm text-sand-600">No listings have been created yet.</p> : null}
              </div>
            </div>

            <div className="admin-subpanel">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-lg font-semibold text-ink">Recent orders</h3>
                <Link to="/admin/orders" className="admin-inline-link">
                  Open orders
                </Link>
              </div>
              <div className="mt-3 space-y-3">
                {orders.slice(0, 4).map((order) => (
                  <article key={order.id} className="admin-compact-row admin-compact-row-stack">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-ink">{order.asset?.title ?? "Order record"}</p>
                      <span className={orderStatusChip(order.status)}>{order.status}</span>
                      {order.status === "paid" ? <span className={escrowChip(order.escrow_status)}>{escrowLabel(order.escrow_status)}</span> : null}
                    </div>
                    <span className="text-xs text-sand-600">
                      {order.asset?.creator?.display_name ?? "Marketplace"} - {formatDate(order.created_at)}
                    </span>
                  </article>
                ))}

                {orders.length === 0 ? <p className="rounded-2xl border border-dashed border-sand-200 px-4 py-4 text-sm text-sand-600">No orders have landed yet.</p> : null}
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <section className="surface-card admin-panel p-5">
            <SectionHeader eyebrow="Operations" title="Signals worth watching" body="Marketplace admins stay focused on reviews, payouts, and general storefront health." />
            <div className="mt-4 space-y-3">
              <SignalRow label="Orders in escrow" value={overview ? `${overview.escrow_pending_orders}` : "Loading..."} tone="sunset" />
              <SignalRow label="Reported file scams" value={overview ? `${overview.scam_reported_orders}` : "Loading..."} tone="rose" />
              <SignalRow label="Active payout setups" value={overview ? `${overview.active_payout_accounts}` : "Loading..."} tone="forest" />
              <SignalRow label="Asset reviews" value={overview ? `${overview.asset_reviews}` : "Loading..."} tone="lagoon" />
              <SignalRow label="Creator reviews" value={overview ? `${overview.creator_reviews}` : "Loading..."} tone="lagoon" />
            </div>
          </section>

          <section className="surface-card admin-panel p-5">
            <SectionHeader eyebrow="Quick access" title="Jump straight to the lane you need" body="Each sidebar destination is its own page now, so the admin workspace stays focused and easier to navigate." />
            <div className="mt-4 space-y-3">
              <Link to="/admin/listings" className="admin-compact-row admin-compact-row-stack">
                <span className="text-sm font-semibold text-ink">Listings moderation</span>
                <span className="text-xs text-sand-600">Review uploads, descriptions, and publish states.</span>
              </Link>
              <Link to="/admin/orders" className="admin-compact-row admin-compact-row-stack">
                <span className="text-sm font-semibold text-ink">Orders and escrow</span>
                <span className="text-xs text-sand-600">Track paid, held, released, and reported orders.</span>
              </Link>
              <Link to="/admin/editors" className="admin-compact-row admin-compact-row-stack">
                <span className="text-sm font-semibold text-ink">Editor access</span>
                <span className="text-xs text-sand-600">Create separate editorial logins with email or phone credentials.</span>
              </Link>
            </div>
          </section>

          <section className="surface-card admin-panel p-5">
            <SectionHeader eyebrow="Escrow mix" title="Current payout state" body="A simple read on how many paid orders are still waiting on buyer action." />
            <div className="mt-4 admin-summary-grid">
              <SummaryPill label="Held" value={overview ? `${overview.escrow_pending_orders}` : "..."} tone="sunset" />
              <SummaryPill label="Released" value={overview ? `${overview.released_orders}` : "..."} tone="forest" />
              <SummaryPill label="Reported" value={overview ? `${overview.scam_reported_orders}` : "..."} tone="rose" />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function escrowChip(status: Order["escrow_status"]) {
  if (status === "released") {
    return "admin-chip admin-chip-forest";
  }
  if (status === "scam_reported") {
    return "admin-chip admin-chip-rose";
  }
  return "admin-chip admin-chip-cobalt";
}

function escrowLabel(status: Order["escrow_status"]) {
  if (status === "released") {
    return "released";
  }
  if (status === "scam_reported") {
    return "reported";
  }
  return "in escrow";
}
