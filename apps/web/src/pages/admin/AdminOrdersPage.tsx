import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import type { Order } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { PriceTag } from "@/components/PriceTag";
import { SectionHeader, StatMini, SummaryPill, orderStatusChip, useAdminWorkspace } from "@/pages/admin/AdminWorkspace";

export function AdminOrdersPage() {
  const { overview, orders, ordersLoading } = useAdminWorkspace();
  const [orderStatusFilter, setOrderStatusFilter] = useState<Order["status"] | "all">("all");

  const filteredOrders = useMemo(
    () => orders.filter((order) => (orderStatusFilter === "all" ? true : order.status === orderStatusFilter)),
    [orderStatusFilter, orders]
  );

  return (
    <section className="admin-platform-shell space-y-5">
      <header className="surface-card-vivid admin-hero-panel p-5 md:p-6">
        <SectionHeader eyebrow="Revenue flow" title="Orders" body="Watch checkout movement, payment outcomes, and which creators every order is tied to." />
      </header>

      <section className="surface-card admin-panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <label className="admin-input-group lg:w-[240px]">
            <span>Filter status</span>
            <select value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value as Order["status"] | "all")} className="admin-input">
              <option value="all">All order states</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <SummaryPill label="Paid" value={overview ? `${overview.paid_orders}` : "..."} tone="forest" />
          <SummaryPill label="Pending" value={overview ? `${overview.pending_orders}` : "..."} tone="sunset" />
          <SummaryPill label="Failed" value={overview ? `${overview.failed_orders}` : "..."} tone="rose" />
          <SummaryPill label="Refunded" value={overview ? `${overview.refunded_orders}` : "..."} tone="lagoon" />
        </div>

        <div className="mt-5 space-y-4">
          {!ordersLoading && filteredOrders.length === 0 ? <EmptyState title="No orders match this view" body="Try switching the status filter to all orders." /> : null}
          {filteredOrders.map((order) => (
            <article key={order.id} className="admin-record-card">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-xl font-semibold text-ink">{order.asset?.title ?? "Order record"}</p>
                    <span className={orderStatusChip(order.status)}>{order.status}</span>
                    {order.payment ? <span className="admin-chip admin-chip-cobalt">{order.payment.status} payment</span> : null}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <StatMini label="Buyer" value={order.email} />
                    <StatMini label="Creator" value={order.asset?.creator?.display_name ?? "Unknown creator"} />
                    <StatMini label="Created" value={formatDate(order.created_at)} />
                    <StatMini label="Paid at" value={order.paid_at ? formatDate(order.paid_at) : "Not paid yet"} />
                  </div>
                </div>

                <div className="admin-record-actions">
                  <PriceTag amountKobo={order.amount_kobo} currency={order.currency} />
                  <p className="text-xs text-sand-500">
                    {order.payment ? `${order.payment.provider.toUpperCase()} updated ${formatDate(order.payment.updated_at ?? order.created_at)}` : "Payment record not linked yet"}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
