import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { PriceTag } from "@/components/PriceTag";
import { getCreatorAssets, getCreatorDashboard, getCreatorFunnelSummary } from "@/lib/api";
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

  const orderBreakdown = useMemo(() => {
    const initial = { paid: 0, pending: 0, failed: 0, refunded: 0 };

    return recentOrders.reduce((acc, order) => {
      acc[order.status] += 1;
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

  const avgPaidOrderLabel = useMemo(() => {
    const paidCount = orderBreakdown.paid;
    if (!dashboardQuery.data || paidCount === 0) {
      return "GHS 0.00";
    }
    return formatCurrency(Math.round(dashboardQuery.data.totalRevenueKobo / paidCount), "GHS");
  }, [dashboardQuery.data, orderBreakdown.paid]);

  const conversionLabel = useMemo(() => {
    if (recentOrders.length === 0) {
      return "0%";
    }
    const rate = Math.round((orderBreakdown.paid / recentOrders.length) * 100);
    return `${rate}%`;
  }, [orderBreakdown.paid, recentOrders.length]);

  const latestAsset = assetList[0];
  const lastOrder = recentOrders[0];
  const clickThrough = funnel.asset_views > 0 ? Math.round((funnel.asset_clicks / funnel.asset_views) * 100) : 0;
  const checkoutRate = funnel.asset_clicks > 0 ? Math.round((funnel.checkout_starts / funnel.asset_clicks) * 100) : 0;
  const purchaseRate = funnel.checkout_starts > 0 ? Math.round((funnel.purchases / funnel.checkout_starts) * 100) : 0;

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <header className="surface-card-vivid subtle-pattern overflow-hidden p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt-600">Creator Cockpit</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">Dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm text-sand-700 md:text-base">
              Track your sales performance, keep listings healthy, and jump straight to the actions that move revenue.
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
            label="Latest Sale"
            value={lastOrder ? formatDate(lastOrder.created_at) : "No sales yet"}
            tone="bg-forest-100/80 text-forest-700"
          />
          <MiniInsight
            label="Latest Upload"
            value={latestAsset ? latestAsset.title : "No assets yet"}
            tone="bg-cobalt-100/70 text-cobalt-700"
          />
          <MiniInsight label="Paid Conversion" value={conversionLabel} tone="bg-sunset-100 text-sunset-700" />
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Revenue"
          value={formatCurrency(dashboardQuery.data?.totalRevenueKobo ?? 0, "GHS")}
          helper={`From ${orderBreakdown.paid} paid orders`}
          tone="cobalt"
        />
        <MetricCard
          label="Wallet Balance"
          value={formatCurrency(dashboardQuery.data?.walletBalanceKobo ?? 0, "GHS")}
          helper="Available for payout"
          tone="forest"
        />
        <MetricCard label="Asset Count" value={String(dashboardQuery.data?.assetCount ?? 0)} helper="Total listings created" tone="lagoon" />
        <MetricCard label="Avg Paid Order" value={avgPaidOrderLabel} helper="Average ticket size" tone="sunset" />
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
            <FunnelStage label="Views" count={funnel.asset_views} sublabel="Asset viewed" tone="cobalt" />
            <FunnelStage label="Clicks" count={funnel.asset_clicks} sublabel={`${clickThrough}% from views`} tone="lagoon" />
            <FunnelStage label="Checkout" count={funnel.checkout_starts} sublabel={`${checkoutRate}% from clicks`} tone="sunset" />
            <FunnelStage label="Purchases" count={funnel.purchases} sublabel={`${purchaseRate}% from checkout`} tone="forest" />
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr,0.8fr]">
        <section className="surface-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-ink">Recent Orders</h2>
            <Link to="/dashboard/orders" className="text-xs font-semibold uppercase tracking-wide text-cobalt-700 hover:text-cobalt-800">
              View all
            </Link>
          </div>

          {dashboardQuery.isLoading ? <p className="mt-3 text-sm text-sand-600">Loading orders...</p> : null}
          {dashboardQuery.isError ? <p className="mt-3 text-sm text-rose-700">Unable to load order data.</p> : null}

          {dashboardQuery.data && recentOrders.length === 0 ? (
            <EmptyState title="No sales yet" body="Share your assets and links to start collecting orders." />
          ) : null}

          {recentOrders.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-sand-200 bg-white">
              {recentOrders.map((order, index) => (
                <article
                  key={order.id}
                  className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                    index !== 0 ? "border-t border-sand-200" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{order.asset?.title ?? "Asset"}</p>
                    <p className="mt-0.5 text-xs text-sand-600">
                      #{order.id.slice(0, 8)} - {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriceTag amountKobo={order.amount_kobo} currency={order.currency} />
                    <span className={statusChip(order.status)}>{order.status}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <aside className="surface-card p-5">
          <h2 className="font-display text-xl font-semibold text-ink">Order Performance</h2>
          <p className="mt-1 text-sm text-sand-600">Based on your latest {recentOrders.length} order records.</p>

          <div className="mt-4 space-y-3">
            <PerformanceRow label="Paid" count={orderBreakdown.paid} total={recentOrders.length} barClass="bg-forest-500" />
            <PerformanceRow label="Pending" count={orderBreakdown.pending} total={recentOrders.length} barClass="bg-sunset-500" />
            <PerformanceRow label="Failed" count={orderBreakdown.failed} total={recentOrders.length} barClass="bg-rose-600" />
            <PerformanceRow label="Refunded" count={orderBreakdown.refunded} total={recentOrders.length} barClass="bg-sand-500" />
          </div>

          <div className="mt-5 grid gap-3 rounded-xl border border-sand-200 bg-sand-50 p-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-sand-500">Paid Conversion</p>
              <p className="mt-1 font-display text-2xl font-bold text-ink">{conversionLabel}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-sand-500">Avg Paid Order</p>
              <p className="mt-1 font-display text-2xl font-bold text-ink">{avgPaidOrderLabel}</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.3fr,0.7fr]">
        <section className="surface-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-ink">Your Assets</h2>
            <Link to="/dashboard/upload" className="text-xs font-semibold uppercase tracking-wide text-cobalt-700 hover:text-cobalt-800">
              Upload another
            </Link>
          </div>

          {assetsQuery.isLoading ? <p className="mt-3 text-sm text-sand-600">Loading assets...</p> : null}
          {assetsQuery.isError ? <p className="mt-3 text-sm text-rose-700">Unable to load assets.</p> : null}

          {assetsQuery.data && assetList.length === 0 ? (
            <EmptyState title="No uploads yet" body="Publish your first product from the upload page." />
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
          <h2 className="font-display text-xl font-semibold text-ink">Asset Pipeline</h2>
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
  return (
    <article className="rounded-xl border border-sand-200 bg-white p-3 transition hover:border-cobalt-200">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 font-semibold text-ink">{asset.title}</p>
        <span className={assetStatusChip(asset.status)}>{asset.status}</span>
      </div>
      <p className="mt-1 text-xs text-sand-600">
        {asset.category} - {formatDate(asset.created_at)}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <PriceTag amountKobo={asset.price_kobo} currency={asset.currency} />
        <Link to={`/asset/${asset.id}`} className="text-xs font-semibold uppercase tracking-wide text-cobalt-700 hover:text-cobalt-800">
          View
        </Link>
      </div>
    </article>
  );
}

