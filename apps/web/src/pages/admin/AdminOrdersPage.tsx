import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { PriceTag } from "@/components/PriceTag";
import { useToast } from "@/components/Toast";
import { formatDate, formatCurrency } from "@/lib/format";
import { generateDownload, resolveAdminOrderScam } from "@/lib/api";
import type { AdminOrderRecord, Order } from "@/lib/types";
import { SectionHeader, StatMini, SummaryPill, orderStatusChip, useAdminWorkspace } from "@/pages/admin/AdminWorkspace";

export function AdminOrdersPage() {
  const { overview, orders, ordersLoading } = useAdminWorkspace();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [orderStatusFilter, setOrderStatusFilter] = useState<Order["status"] | "all">("all");
  const [escrowStatusFilter, setEscrowStatusFilter] = useState<NonNullable<Order["escrow_status"]> | "all">("all");
  const [reviewingOrderId, setReviewingOrderId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [sellerNote, setSellerNote] = useState("");
  const [sellerAction, setSellerAction] = useState<"none" | "warn" | "suspend">("warn");

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

  const selectedOrder = useMemo(
    () => filteredOrders.find((order) => order.id === reviewingOrderId) ?? orders.find((order) => order.id === reviewingOrderId) ?? null,
    [filteredOrders, orders, reviewingOrderId]
  );

  const reportedOrders = useMemo(
    () => orders.filter((order) => order.status === "paid" && order.escrow_status === "scam_reported"),
    [orders]
  );
  const unresolvedReports = useMemo(
    () => reportedOrders.filter((order) => order.scam_resolution_status !== "genuine_released" && order.scam_resolution_status !== "buyer_refunded"),
    [reportedOrders]
  );

  const inspectMutation = useMutation({
    mutationFn: async (orderId: string) => generateDownload(orderId),
    onSuccess: (payload) => {
      const link = document.createElement("a");
      link.href = payload.url;
      link.download = payload.filename || "crib-asset-file";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
      pushToast("Download opened for admin inspection.", "success");
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not open the file for inspection.", "error");
    }
  });

  const resolveMutation = useMutation({
    mutationFn: ({
      orderId,
      resolution,
      sellerAction: nextSellerAction,
      adminNote: nextAdminNote,
      sellerNote: nextSellerNote
    }: {
      orderId: string;
      resolution: "genuine" | "refund";
      sellerAction: "none" | "warn" | "suspend";
      adminNote: string;
      sellerNote: string;
    }) =>
      resolveAdminOrderScam({
        orderId,
        resolution,
        sellerAction: nextSellerAction,
        adminNote: nextAdminNote,
        sellerNote: nextSellerNote
      }),
    onSuccess: async (payload) => {
      if (payload.scam_resolution_status === "genuine_released") {
        pushToast("Report marked as genuine. Seller payout was released.", "success");
      } else {
        pushToast(
          payload.seller_moderation_action === "suspended"
            ? "Buyer refund initiated and seller account suspended."
            : payload.seller_moderation_action === "warned"
              ? "Buyer refund initiated and seller warning saved."
              : "Buyer refund initiated.",
          "success"
        );
      }

      closeReviewModal();

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-creators"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-assets"] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not resolve the report.", "error");
    }
  });

  function openReviewModal(order: AdminOrderRecord) {
    setReviewingOrderId(order.id);
    setAdminNote(order.scam_resolution_note ?? "");
    setSellerNote(order.seller_issue_note ?? "");
    setSellerAction(
      order.seller_moderation_action === "suspended"
        ? "suspend"
        : order.seller_moderation_action === "warned"
          ? "warn"
          : "warn"
    );
  }

  function closeReviewModal() {
    if (resolveMutation.isPending) {
      return;
    }

    setReviewingOrderId(null);
    setAdminNote("");
    setSellerNote("");
    setSellerAction("warn");
  }

  return (
    <section className="admin-platform-shell space-y-5">
      <header className="surface-card-vivid admin-hero-panel p-5 md:p-6">
        <div className="admin-page-hero-grid">
          <SectionHeader
            eyebrow="Revenue flow"
            title="Orders"
            body="Watch checkout movement, inspect reported file deliveries, and decide whether each seller gets paid, warned, or suspended."
          />
          <aside className="admin-page-hero-rail">
            <div className="admin-hero-glance-card">
              <p className="admin-hero-glance-eyebrow">Case Queue</p>
              <div className="mt-3 admin-glance-grid">
                <div className="admin-hero-glance-item admin-hero-glance-item-rose">
                  <span>Unresolved</span>
                  <strong>{unresolvedReports.length}</strong>
                </div>
                <div className="admin-hero-glance-item admin-hero-glance-item-sunset">
                  <span>Held in escrow</span>
                  <strong>{overview ? `${overview.escrow_pending_orders}` : "..."}</strong>
                </div>
                <div className="admin-hero-glance-item admin-hero-glance-item-forest">
                  <span>Released</span>
                  <strong>{overview ? `${overview.released_orders}` : "..."}</strong>
                </div>
                <div className="admin-hero-glance-item admin-hero-glance-item-lagoon">
                  <span>Refunded</span>
                  <strong>{orders.filter((order) => order.status === "refunded").length}</strong>
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
                <span>Filter payment status</span>
                <select value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value as Order["status"] | "all")} className="admin-input">
                  <option value="all">All payment states</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </label>

              <label className="admin-input-group">
                <span>Filter escrow state</span>
                <select value={escrowStatusFilter} onChange={(event) => setEscrowStatusFilter(event.target.value as NonNullable<Order["escrow_status"]> | "all")} className="admin-input">
                  <option value="all">All escrow states</option>
                  <option value="awaiting_review">In escrow</option>
                  <option value="released">Released</option>
                  <option value="scam_reported">Reported</option>
                </select>
              </label>
            </div>

            <div className="admin-toolbar-copy">
              <p className="admin-toolbar-label">Filtered orders</p>
              <p className="admin-toolbar-value">{filteredOrders.length}</p>
              <p className="admin-toolbar-note">
                Reported orders can be opened, inspected, and resolved here without leaving the moderation lane.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 admin-summary-grid">
          <SummaryPill label="In Escrow" value={overview ? `${overview.escrow_pending_orders}` : "..."} tone="sunset" />
          <SummaryPill label="Released" value={overview ? `${overview.released_orders}` : "..."} tone="forest" />
          <SummaryPill label="Reported" value={overview ? `${overview.scam_reported_orders}` : "..."} tone="rose" />
          <SummaryPill label="Pending Payment" value={overview ? `${overview.pending_orders}` : "..."} tone="lagoon" />
        </div>

        <div className="mt-5 space-y-4">
          {!ordersLoading && filteredOrders.length === 0 ? <EmptyState title="No orders match this view" body="Try switching the payment or escrow filters." /> : null}
          {filteredOrders.map((order) => {
            const hasScamCase = order.escrow_status === "scam_reported";
            const caseResolved = order.scam_resolution_status === "genuine_released" || order.scam_resolution_status === "buyer_refunded";
            const creatorStatus = order.asset?.creator?.seller_account_status ?? "active";

            return (
              <article key={order.id} className="admin-record-card">
                <div className="admin-record-layout">
                  <div className="admin-record-primary">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-xl font-semibold text-ink">{order.asset?.title ?? "Order record"}</p>
                      <span className={orderStatusChip(order.status)}>{order.status}</span>
                      {order.status === "paid" ? <span className={escrowChip(order.escrow_status)}>{escrowLabel(order.escrow_status)}</span> : null}
                      {order.payment ? <span className="admin-chip admin-chip-cobalt">{order.payment.status} payment</span> : null}
                      {hasScamCase ? <span className={`admin-chip ${caseResolved ? "admin-chip-lagoon" : "admin-chip-rose"}`}>{caseResolved ? resolutionLabel(order) : "Needs admin review"}</span> : null}
                    </div>

                    <div className="mt-4 admin-detail-grid">
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
                      {order.asset?.creator ? <span className={`admin-chip ${creatorAccountChipClass(creatorStatus)}`}>Seller account: {creatorStatus}</span> : null}
                      {order.refund_provider_status ? <span className="admin-chip admin-chip-lagoon">Refund status: {order.refund_provider_status}</span> : null}
                    </div>

                    {order.scam_report_reason ? (
                      <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        Buyer report: {order.scam_report_reason}
                      </p>
                    ) : null}

                    {order.scam_resolution_note ? (
                      <p className="mt-3 rounded-2xl border border-cobalt-200 bg-cobalt-50 px-4 py-3 text-sm text-cobalt-800">
                        Admin note: {order.scam_resolution_note}
                      </p>
                    ) : null}

                    {order.seller_issue_note ? (
                      <p className="mt-3 rounded-2xl border border-sunset-200 bg-sunset-50 px-4 py-3 text-sm text-sunset-800">
                        Seller note: {order.seller_issue_note}
                      </p>
                    ) : null}

                    {order.asset?.creator?.seller_account_note && creatorStatus !== "active" ? (
                      <p className="mt-3 rounded-2xl border border-lagoon-200 bg-lagoon-50 px-4 py-3 text-sm text-lagoon-800">
                        Current seller account note: {order.asset.creator.seller_account_note}
                      </p>
                    ) : null}
                  </div>

                  <div className="admin-record-actions">
                    <PriceTag amountKobo={order.amount_kobo} currency={order.currency} />
                    <p className="text-xs text-sand-500">
                      {order.payment ? `${order.payment.provider.toUpperCase()} updated ${formatDate(order.payment.updated_at ?? order.created_at)}` : "Payment record not linked yet"}
                    </p>
                    {hasScamCase ? (
                      <div className="mt-3 flex w-full flex-col gap-2">
                        {(order.status === "paid" || order.status === "refunded") ? (
                          <Link to={`/receipts/${order.id}`} className="admin-action-button admin-action-button-secondary">
                            View receipt
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => inspectMutation.mutate(order.id)}
                          disabled={inspectMutation.isPending}
                          className="admin-action-button admin-action-button-secondary"
                        >
                          {inspectMutation.isPending && inspectMutation.variables === order.id ? "Opening file..." : "Inspect file"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openReviewModal(order)}
                          className={`admin-action-button ${caseResolved ? "admin-action-button-secondary" : ""}`}
                        >
                          {caseResolved ? "View resolution" : "Resolve report"}
                        </button>
                      </div>
                    ) : order.status === "paid" || order.status === "refunded" ? (
                      <div className="mt-3 flex w-full flex-col gap-2">
                        <Link to={`/receipts/${order.id}`} className="admin-action-button admin-action-button-secondary">
                          View receipt
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <Modal
        open={Boolean(selectedOrder)}
        title={selectedOrder?.scam_resolution_status === "pending_review" || !selectedOrder?.scam_resolution_status ? "Resolve Reported Order" : "Reported Order Decision"}
        onClose={closeReviewModal}
        maxWidthClassName="max-w-3xl"
      >
        {selectedOrder ? (
          <div className="space-y-5">
            <div className="admin-detail-grid">
              <StatMini label="Listing" value={selectedOrder.asset?.title ?? "Unknown listing"} />
              <StatMini label="Buyer" value={selectedOrder.email} />
              <StatMini label="Creator" value={selectedOrder.asset?.creator?.display_name ?? "Unknown creator"} />
              <StatMini label="Reported" value={selectedOrder.buyer_reported_at ? formatDate(selectedOrder.buyer_reported_at) : "Waiting"} />
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700">Buyer report</p>
              <p className="mt-2 text-sm text-rose-800">{selectedOrder.scam_report_reason?.trim() || "No buyer reason was recorded."}</p>
            </div>

            <div className="space-y-4">
              <label className="admin-input-group">
                <span>Admin note</span>
                <textarea
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  rows={4}
                  className="admin-input"
                  placeholder="Internal resolution note for this reported order."
                />
              </label>

              <label className="admin-input-group">
                <span>Seller note</span>
                <textarea
                  value={sellerNote}
                  onChange={(event) => setSellerNote(event.target.value)}
                  rows={4}
                  className="admin-input"
                  placeholder="Explain to the seller if the file was empty, corrupted, mismatched, or otherwise needed work."
                />
              </label>
            </div>

            <label className="admin-input-group">
              <span>Refund action for seller account</span>
              <select value={sellerAction} onChange={(event) => setSellerAction(event.target.value as "none" | "warn" | "suspend")} className="admin-input">
                <option value="none">Refund only</option>
                <option value="warn">Refund and warn seller</option>
                <option value="suspend">Refund and suspend seller</option>
              </select>
            </label>

            <div className="rounded-2xl border border-sand-200 bg-sand-50 px-4 py-4 text-sm text-sand-700">
              <p>
                Inspect the uploaded file first. If the buyer was wrong, mark the order as genuine and release the payout. If the file really is corrupted, empty, or misleading, refund the buyer and optionally warn or suspend the seller account.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => inspectMutation.mutate(selectedOrder.id)}
                disabled={inspectMutation.isPending || resolveMutation.isPending}
                className="admin-action-button admin-action-button-secondary"
              >
                {inspectMutation.isPending && inspectMutation.variables === selectedOrder.id ? "Opening file..." : "Inspect file"}
              </button>
              <button
                type="button"
                onClick={() =>
                  resolveMutation.mutate({
                    orderId: selectedOrder.id,
                    resolution: "genuine",
                    sellerAction: "none",
                    adminNote,
                    sellerNote
                  })
                }
                disabled={resolveMutation.isPending || selectedOrder.scam_resolution_status === "genuine_released"}
                className="admin-action-button"
              >
                {resolveMutation.isPending ? "Saving..." : "Mark File Genuine"}
              </button>
              <button
                type="button"
                onClick={() =>
                  resolveMutation.mutate({
                    orderId: selectedOrder.id,
                    resolution: "refund",
                    sellerAction,
                    adminNote,
                    sellerNote
                  })
                }
                disabled={resolveMutation.isPending || selectedOrder.scam_resolution_status === "buyer_refunded"}
                className="admin-action-button admin-action-button-rose"
              >
                {resolveMutation.isPending ? "Saving..." : sellerAction === "suspend" ? "Refund and Suspend Seller" : sellerAction === "warn" ? "Refund and Warn Seller" : "Refund Buyer"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
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

function resolutionLabel(order: AdminOrderRecord) {
  if (order.scam_resolution_status === "genuine_released") {
    return "Report ignored";
  }
  if (order.scam_resolution_status === "buyer_refunded") {
    return "Buyer refunded";
  }
  return "Needs admin review";
}

function creatorAccountChipClass(status: "active" | "warned" | "suspended") {
  if (status === "warned") {
    return "admin-chip-sunset";
  }
  if (status === "suspended") {
    return "admin-chip-rose";
  }
  return "admin-chip-forest";
}
