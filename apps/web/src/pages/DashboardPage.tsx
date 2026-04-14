import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { PriceTag } from "@/components/PriceTag";
import { getCreatorAssets, getCreatorDashboard, getCreatorFunnelSummary } from "@/lib/api";
import { getAssetAppLabel, getAssetFormatLabel } from "@/lib/assetCatalog";
import { formatDate, formatCurrency } from "@/lib/format";
import type { Asset, Order } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  const dashboardQuery = useQuery({
    queryKey: ["creator-dashboard", user?.id],
    queryFn: () => getCreatorDashboard(user!.id),
    enabled: Boolean(user?.id)
  });

  const assetsQuery = useQuery({
    queryKey: ["creator-assets", user?.id],
    queryFn: () => getCreatorAssets(user!.id),
    enabled: Boolean(user?.id)
  });

  const funnelSummaryQuery = useQuery({
    queryKey: ["creator-funnel-summary", user?.id],
    queryFn: () => getCreatorFunnelSummary(user!.id),
    enabled: Boolean(user?.id)
  });

  const recentOrders = dashboardQuery.data?.recentOrders ?? [];
  const assetList = assetsQuery.data ?? [];
  const funnel = funnelSummaryQuery.data ?? {
    asset_views: 0,
    asset_clicks: 0,
    checkout_starts: 0,
    purchases: 0
  };

  const paymentBreakdown = useMemo(() => {
    const initial = { paid: 0, pending: 0, failed: 0, refunded: 0 };

    return recentOrders.reduce((acc, order) => {
      acc[order.status] += 1;
      return acc;
    }, initial);
  }, [recentOrders]);

  const escrowBreakdown = useMemo(() => {
    const initial = { released: 0, awaitingReview: 0, reported: 0 };

    return recentOrders.reduce((acc, order) => {
      if (order.status !== "paid") {
        return acc;
      }

      if (order.escrow_status === "awaiting_review") {
        acc.awaitingReview += 1;
      } else if (order.escrow_status === "scam_reported") {
        acc.reported += 1;
      } else {
        acc.released += 1;
      }

      return acc;
    }, initial);
  }, [recentOrders]);

  const assetBreakdown = useMemo(() => {
    const initial = { published: 0, draft: 0, archived: 0 };

    return assetList.reduce((acc, asset) => {
      acc[asset.status] += 1;
      return acc;
    }, initial);
  }, [assetList]);

  const releasedOrderCount = dashboardQuery.data?.paidOrders ?? 0;
  const escrowPendingOrderCount = dashboardQuery.data?.escrowPendingOrders ?? 0;
  const escrowPendingAmountKobo = dashboardQuery.data?.escrowPendingAmountKobo ?? 0;
  const sellerAccountStatus = dashboardQuery.data?.sellerAccountStatus ?? "active";
  const sellerAccountNote = dashboardQuery.data?.sellerAccountNote ?? null;
  const avgReleasedOrderLabel = useMemo(() => {
    if (!dashboardQuery.data || releasedOrderCount === 0) {
      return "GHS 0.00";
    }
    return formatCurrency(Math.round(dashboardQuery.data.totalRevenueKobo / releasedOrderCount), "GHS");
  }, [dashboardQuery.data, releasedOrderCount]);

  const conversionLabel = useMemo(() => {
    if (recentOrders.length === 0) {
      return "0%";
    }
    const rate = Math.round((paymentBreakdown.paid / recentOrders.length) * 100);
    return `${rate}%`;
  }, [paymentBreakdown.paid, recentOrders.length]);

  const latestAsset = assetList[0];
  const lastReleasedOrder = recentOrders.find((order) => order.status === "paid" && order.escrow_status === "released");
  const clickThrough = funnel.asset_views > 0 ? Math.round((funnel.asset_clicks / funnel.asset_views) * 100) : 0;
  const checkoutRate = funnel.asset_clicks > 0 ? Math.round((funnel.checkout_starts / funnel.asset_clicks) * 100) : 0;
  const purchaseRate = funnel.checkout_starts > 0 ? Math.round((funnel.purchases / funnel.checkout_starts) * 100) : 0;

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {sellerAccountStatus !== "active" ? (
        <section
          className={`rounded-[1.6rem] border px-5 py-4 ${
            sellerAccountStatus === "suspended"
              ? "border-rose-200 bg-rose-50"
              : "border-sunset-200 bg-sunset-50"
          }`}
        >
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
              sellerAccountStatus === "suspended" ? "text-rose-700" : "text-sunset-700"
            }`}
          >
            Seller account {sellerAccountStatus}
          </p>
          <p className={`mt-2 text-sm ${sellerAccountStatus === "suspended" ? "text-rose-800" : "text-sunset-800"}`}>
            {sellerAccountNote?.trim()
              ? sellerAccountNote
              : sellerAccountStatus === "suspended"
                ? "Marketplace admin paused this seller account while a file issue is being handled."
                : "Marketplace admin added a warning to this seller account. Review your recent reported order notes below."}
          </p>
        </section>
      ) : null}

      <header className="surface-card-vivid subtle-pattern overflow-hidden p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt-600">Creator Cockpit</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">Dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm text-sand-700 md:text-base">
              Track released revenue, payouts still in escrow, and the orders waiting on buyer confirmation before cash reaches your wallet.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/profile"
              className="rounded-xl border border-sand-300 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-wide text-ink transition hover:bg-sand-100"
            >
              Profile
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <MiniInsight
            label="Latest Released Sale"
            value={lastReleasedOrder ? formatDate(lastReleasedOrder.created_at) : "No release yet"}
            tone="bg-forest-100/80 text-forest-700"
          />
          <MiniInsight
            label="Latest Listing"
            value={latestAsset ? latestAsset.title : "No listings yet"}
            tone="bg-cobalt-100/70 text-cobalt-700"
          />
          <MiniInsight
            label="In Escrow"
            value={formatCurrency(escrowPendingAmountKobo, "GHS")}
            tone="bg-sunset-100 text-sunset-700"
          />
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Released Revenue"
          value={formatCurrency(dashboardQuery.data?.totalRevenueKobo ?? 0, "GHS")}
          helper={`From ${releasedOrderCount} released orders`}
          tone="cobalt"
        />
        <MetricCard
          label="Wallet Balance"
          value={formatCurrency(dashboardQuery.data?.walletBalanceKobo ?? 0, "GHS")}
          helper="Available after escrow release"
          tone="forest"
        />
        <MetricCard
          label="Escrow Holding"
          value={formatCurrency(escrowPendingAmountKobo, "GHS")}
          helper={`${escrowPendingOrderCount} order${escrowPendingOrderCount === 1 ? "" : "s"} awaiting buyer check`}
          tone="sunset"
        />
        <MetricCard label="Listing Count" value={String(dashboardQuery.data?.assetCount ?? 0)} helper="Total listings created" tone="lagoon" />
      </section>

      <section className="surface-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Acquisition Funnel</h2>
            <p className="mt-1 text-sm text-sand-600">Track where buyers drop between discovery and completed purchase.</p>
          </div>
          <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-sand-700">
            Views to purchase {funnel.asset_views > 0 ? `${Math.round((funnel.purchases / funnel.asset_views) * 100)}%` : "0%"}
          </span>
        </div>

        {funnelSummaryQuery.isLoading ? <p className="mt-4 text-sm text-sand-600">Loading funnel analytics...</p> : null}
        {funnelSummaryQuery.isError ? <p className="mt-4 text-sm text-rose-700">Could not load funnel analytics.</p> : null}

        {!funnelSummaryQuery.isLoading ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <FunnelStage label="Views" count={funnel.asset_views} sublabel="Listing viewed" tone="cobalt" />
            <FunnelStage label="Clicks" count={funnel.asset_clicks} sublabel={`${clickThrough}% from views`} tone="lagoon" />
            <FunnelStage label="Checkout" count={funnel.checkout_starts} sublabel={`${checkoutRate}% from clicks`} tone="sunset" />
            <FunnelStage label="Purchases" count={funnel.purchases} sublabel={`${purchaseRate}% from checkout`} tone="forest" />
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr,0.8fr]">
        <section className="surface-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">Recent Orders</h2>
              <p className="mt-1 text-sm text-sand-600">Paid orders now sit in escrow until the buyer confirms the file or the 24-hour review window ends.</p>
            </div>
            <Link to="/dashboard/orders" className="text-xs font-semibold uppercase tracking-wide text-cobalt-700 hover:text-cobalt-800">
              View all
            </Link>
          </div>

          {dashboardQuery.isLoading ? <p className="mt-3 text-sm text-sand-600">Loading orders...</p> : null}
          {dashboardQuery.isError ? <p className="mt-3 text-sm text-rose-700">Unable to load order data.</p> : null}

          {dashboardQuery.data && recentOrders.length === 0 ? (
            <EmptyState title="No sales yet" body="Share your listings, previews, and delivery links to start collecting orders." />
          ) : null}

          {recentOrders.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-sand-200 bg-white">
              {recentOrders.map((order, index) => (
                <article
                  key={order.id}
                  className={`flex flex-col gap-3 px-4 py-3 ${index !== 0 ? "border-t border-sand-200" : ""}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{order.asset?.title ?? "Listing"}</p>
                      <p className="mt-0.5 text-xs text-sand-600">
                        #{order.id.slice(0, 8)} - {formatDate(order.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <PriceTag amountKobo={order.amount_kobo} currency={order.currency} />
                      <span className={statusChip(order.status)}>{order.status}</span>
                      {order.status === "paid" ? <span className={escrowStatusChip(order)}>{escrowStatusLabel(order)}</span> : null}
                      {(order.status === "paid" || order.status === "refunded") ? (
                        <Link
                          to={`/receipts/${order.id}`}
                          className="rounded-full border border-cobalt-200 bg-cobalt-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cobalt-700 transition hover:border-cobalt-300 hover:bg-cobalt-100"
                        >
                          Receipt
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs text-sand-600">{orderEscrowNote(order)}</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <aside className="surface-card p-5">
          <h2 className="font-display text-xl font-semibold text-ink">Order Performance</h2>
          <p className="mt-1 text-sm text-sand-600">Based on your latest {recentOrders.length} order records.</p>

          <div className="mt-4 space-y-3">
            <PerformanceRow label="Released" count={escrowBreakdown.released} total={recentOrders.length} barClass="bg-forest-500" />
            <PerformanceRow label="In Escrow" count={escrowBreakdown.awaitingReview} total={recentOrders.length} barClass="bg-cobalt-500" />
            <PerformanceRow label="Reported" count={escrowBreakdown.reported} total={recentOrders.length} barClass="bg-rose-600" />
            <PerformanceRow label="Pending Payment" count={paymentBreakdown.pending} total={recentOrders.length} barClass="bg-sunset-500" />
          </div>

          <div className="mt-5 grid gap-3 rounded-xl border border-sand-200 bg-sand-50 p-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-sand-500">Paid Conversion</p>
              <p className="mt-1 font-display text-2xl font-bold text-ink">{conversionLabel}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-sand-500">Avg Released Order</p>
              <p className="mt-1 font-display text-2xl font-bold text-ink">{avgReleasedOrderLabel}</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-cobalt-100 bg-cobalt-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cobalt-700">Escrow Reminder</p>
            <p className="mt-2 text-sm text-cobalt-800">
              Buyer payments are held first. If the buyer does not confirm or report an issue within one day, the order auto-releases and the net amount moves into your wallet.
            </p>
          </div>
        </aside>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.3fr,0.7fr]">
        <section className="surface-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-ink">Your Listings</h2>
            <Link to="/dashboard/upload" className="text-xs font-semibold uppercase tracking-wide text-cobalt-700 hover:text-cobalt-800">
              Upload another
            </Link>
          </div>

          {assetsQuery.isLoading ? <p className="mt-3 text-sm text-sand-600">Loading listings...</p> : null}
          {assetsQuery.isError ? <p className="mt-3 text-sm text-rose-700">Unable to load listings.</p> : null}

          {assetsQuery.data && assetList.length === 0 ? (
            <EmptyState title="No uploads yet" body="Publish your first asset listing from the upload page." />
          ) : null}

          {assetList.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {assetList.map((asset) => (
                <AssetPreviewCard key={asset.id} asset={asset} />
              ))}
            </div>
          ) : null}
        </section>

        <aside className="surface-card p-5">
          <h2 className="font-display text-xl font-semibold text-ink">Listing Pipeline</h2>
          <p className="mt-1 text-sm text-sand-600">Keep your catalog balanced between draft work and live listings.</p>

          <div className="mt-4 space-y-3">
            <PerformanceRow
              label="Published"
              count={assetBreakdown.published}
              total={assetList.length}
              barClass="bg-cobalt-600"
            />
            <PerformanceRow label="Draft" count={assetBreakdown.draft} total={assetList.length} barClass="bg-sunset-600" />
            <PerformanceRow label="Archived" count={assetBreakdown.archived} total={assetList.length} barClass="bg-sand-500" />
          </div>

          <div className="mt-5 rounded-xl border border-cobalt-100 bg-cobalt-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cobalt-700">Catalog Insight</p>
            <p className="mt-2 text-sm text-cobalt-800">
              {assetBreakdown.draft > assetBreakdown.published
                ? "You have more drafts than published listings. Shipping one draft today can improve discovery."
                : "Your published catalog is in good shape. Consider refreshing previews for older listings."}
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function statusChip(status: Order["status"]) {
  if (status === "paid") {
    return "rounded-full bg-forest-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-forest-700";
  }
  if (status === "pending") {
    return "rounded-full bg-sunset-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-sunset-700";
  }
  if (status === "failed") {
    return "rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700";
  }
  return "rounded-full bg-sand-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700";
}

function escrowStatusChip(order: Order) {
  if (order.escrow_status === "released") {
    return "rounded-full bg-forest-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-forest-700";
  }
  if (order.escrow_status === "scam_reported") {
    return "rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700";
  }
  return "rounded-full bg-cobalt-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-cobalt-700";
}

function escrowStatusLabel(order: Order) {
  if (order.escrow_status === "released") {
    return "Released";
  }
  if (order.escrow_status === "scam_reported") {
    return "Reported";
  }
  return "In Escrow";
}

function orderEscrowNote(order: Order) {
  if (order.status === "pending") {
    return "Waiting for payment confirmation before escrow starts.";
  }
  if (order.status === "failed") {
    return "Payment failed, so no payout is being held for this order.";
  }
  if (order.status === "refunded") {
    return order.seller_issue_note?.trim()
      ? `This order was refunded. Seller note: ${order.seller_issue_note}`
      : "This order was refunded.";
  }
  if (order.escrow_status === "scam_reported") {
    const resolutionCopy =
      order.scam_resolution_status === "genuine_released"
        ? "Admin reviewed the report and released payout."
        : order.scam_resolution_status === "buyer_refunded"
          ? "Admin reviewed the report and refunded the buyer."
          : "Payout stays on hold.";
    const sellerNote = order.seller_issue_note?.trim() ? ` Seller note: ${order.seller_issue_note}` : "";
    return `Buyer reported a file issue${order.buyer_reported_at ? ` on ${formatDate(order.buyer_reported_at)}` : ""}. ${resolutionCopy}${sellerNote}`;
  }
  if (order.escrow_status === "released") {
    return `Released to wallet${order.escrow_released_at ? ` on ${formatDate(order.escrow_released_at)}` : ""}.`;
  }
  return `Awaiting buyer confirmation${order.escrow_due_at ? ` until ${formatDate(order.escrow_due_at)}` : " for up to 24 hours"}.`;
}

function assetStatusChip(status: Asset["status"]) {
  if (status === "published") {
    return "rounded-full bg-cobalt-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-cobalt-700";
  }
  if (status === "draft") {
    return "rounded-full bg-sunset-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sunset-700";
  }
  return "rounded-full bg-sand-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700";
}

function MetricCard({
  label,
  value,
  helper,
  tone
}: {
  label: string;
  value: string;
  helper: string;
  tone: "cobalt" | "forest" | "lagoon" | "sunset";
}) {
  const toneClass =
    tone === "cobalt"
      ? "border-cobalt-100 bg-cobalt-50"
      : tone === "forest"
        ? "border-forest-300 bg-forest-100/70"
        : tone === "lagoon"
          ? "border-lagoon-200 bg-lagoon-100/60"
          : "border-sunset-200 bg-sunset-100";

  return (
    <article className={`surface-card p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sand-600">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-xs text-sand-600">{helper}</p>
    </article>
  );
}

function MiniInsight({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <article className={`rounded-xl border border-white/60 px-3 py-2 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </article>
  );
}

function FunnelStage({
  label,
  count,
  sublabel,
  tone
}: {
  label: string;
  count: number;
  sublabel: string;
  tone: "cobalt" | "lagoon" | "sunset" | "forest";
}) {
  const toneClass =
    tone === "cobalt"
      ? "border-cobalt-100 bg-cobalt-50"
      : tone === "lagoon"
        ? "border-lagoon-200 bg-lagoon-100/60"
        : tone === "sunset"
          ? "border-sunset-200 bg-sunset-100"
          : "border-forest-300 bg-forest-100/70";

  return (
    <article className={`rounded-xl border px-3 py-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-600">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{new Intl.NumberFormat("en-US").format(count)}</p>
      <p className="mt-1 text-xs text-sand-600">{sublabel}</p>
    </article>
  );
}

function PerformanceRow({
  label,
  count,
  total,
  barClass
}: {
  label: string;
  count: number;
  total: number;
  barClass: string;
}) {
  const width = total > 0 ? Math.max((count / total) * 100, count > 0 ? 6 : 0) : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-sand-600">
        <span>{label}</span>
        <span>{count}</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-sand-100">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function AssetPreviewCard({ asset }: { asset: Asset }) {
  const appLabel = getAssetAppLabel(asset);
  const formatLabel = getAssetFormatLabel(asset);

  return (
    <article className="rounded-xl border border-sand-200 bg-white p-3 transition hover:border-cobalt-200">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 font-semibold text-ink">{asset.title}</p>
        <span className={assetStatusChip(asset.status)}>{asset.status}</span>
      </div>
      <p className="mt-1 text-xs text-sand-600">
        {asset.category} - {formatDate(asset.created_at)}
      </p>
      <p className="mt-1 text-xs text-sand-500">
        {appLabel} - {formatLabel}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <PriceTag amountKobo={asset.price_kobo} currency={asset.currency} pricingModel={asset.pricing_model} minimumPriceKobo={asset.minimum_price_kobo} />
        <Link to={`/asset/${asset.id}`} className="text-xs font-semibold uppercase tracking-wide text-cobalt-700 hover:text-cobalt-800">
          View
        </Link>
      </div>
    </article>
  );
}

