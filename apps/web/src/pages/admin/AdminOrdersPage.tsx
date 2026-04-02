import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PriceTag } from "@/components/PriceTag";
import { formatDate, formatCurrency } from "@/lib/format";
import type { Order } from "@/lib/types";
import { SectionHeader, StatMini, SummaryPill, orderStatusChip, useAdminWorkspace } from "@/pages/admin/AdminWorkspace";

export function AdminOrdersPage() {
  const { overview, orders, ordersLoading } = useAdminWorkspace();
  const [orderStatusFilter, setOrderStatusFilter] = useState<Order["status"] | "all">("all");
  const [escrowStatusFilter, setEscrowStatusFilter] = useState<NonNullable<Order["escrow_status"]> | "all">("all");

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const paymentMatch = orderStatusFilter === "all" ? true : order.status === orderStatusFilter;
        const escrowMatch =
          escrowStatusFilter === "all"
            ? true
            : order.status === "paid" && (order.escrow_status ?? "released") === escrowStatusFilter;

        return paymentMatch && escrowMatch;
      }),
    [escrowStatusFilter, orderStatusFilter, orders]
  );

  return (
    <section className="admin-platform-shell space-y-5">
      <header className="surface-card-vivid admin-hero-panel p-5 md:p-6">
        <SectionHeader eyebrow="Revenue flow" title="Orders" body="Watch checkout movement, payment outcomes, escrow holds, and which creators every order is tied to." />
      </header>

      <section className="surface-card admin-panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="admin-input-group lg:w-[240px]">
              <span>Filter payment status</span>
              <select value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value as Order["status"] | "all")} className="admin-input">
                <option value="all">All payment states</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </label>

            <label className="admin-input-group lg:w-[240px]">
              <span>Filter escrow state</span>
              <select value={escrowStatusFilter} onChange={(event) => setEscrowStatusFilter(event.target.value as NonNullable<Order["escrow_status"]> | "all")} className="admin-input">
                <option value="all">All escrow states</option>
                <option value="awaiting_review">In escrow</option>
                <option value="released">Released</option>
                <option value="scam_reported">Reported</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <SummaryPill label="In Escrow" value={overview ? `${overview.escrow_pending_orders}` : "..."} tone="sunset" />
          <SummaryPill label="Released" value={overview ? `${overview.released_orders}` : "..."} tone="forest" />
          <SummaryPill label="Reported" value={overview ? `${overview.scam_reported_orders}` : "..."} tone="rose" />
          <SummaryPill label="Pending Payment" value={overview ? `${overview.pending_orders}` : "..."} tone="lagoon" />
        </div>

        <div className="mt-5 space-y-4">
          {!ordersLoading && filteredOrders.length === 0 ? <EmptyState title="No orders match this view" body="Try switching the payment or escrow filters." /> : null}
          {filteredOrders.map((order) => (
            <article key={order.id} className="admin-record-card">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-xl font-semibold text-ink">{order.asset?.title ?? "Order record"}</p>
                    <span className={orderStatusChip(order.status)}>{order.status}</span>
                    {order.status === "paid" ? <span className={escrowChip(order.escrow_status)}>{escrowLabel(order.escrow_status)}</span> : null}
                    {order.payment ? <span className="admin-chip admin-chip-cobalt">{order.payment.status} payment</span> : null}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <StatMini label="Buyer" value={order.email} />
                    <StatMini label="Creator" value={order.asset?.creator?.display_name ?? "Unknown creator"} />
                    <StatMini label="Created" value={formatDate(order.created_at)} />
                    <StatMini label="Paid at" value={order.paid_at ? formatDate(order.paid_at) : "Not paid yet"} />
                    <StatMini label="Escrow due" value={order.escrow_due_at ? formatDate(order.escrow_due_at) : "Not started"} />
                    <StatMini label="Opened" value={order.buyer_opened_at ? formatDate(order.buyer_opened_at) : "Not opened"} />
                    <StatMini label="Released" value={order.escrow_released_at ? formatDate(order.escrow_released_at) : "Still held"} />
                    <StatMini label="Reported" value={order.buyer_reported_at ? formatDate(order.buyer_reported_at) : "Not reported"} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="admin-chip admin-chip-sand">Commission {formatCurrency(order.commission_kobo, order.currency)}</span>
                    <span className="admin-chip admin-chip-forest">Seller keeps {formatCurrency(order.seller_net_amount_kobo, order.currency)}</span>
                    {order.escrow_release_reason ? <span className="admin-chip admin-chip-cobalt">Release reason: {order.escrow_release_reason.replace(/_/g, " ")}</span> : null}
                  </div>

                  {order.scam_report_reason ? (
                    <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      Report note: {order.scam_report_reason}
                    </p>
                  ) : null}
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