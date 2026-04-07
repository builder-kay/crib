import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { getOrderReceipt } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Order, OrderReceipt } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

type ViewerRole = "buyer" | "seller" | "admin";

export function ReceiptPage() {
  const { orderId = "" } = useParams();
  const user = useAuthStore((state) => state.user);

  const receiptQuery = useQuery({
    queryKey: ["order-receipt", orderId],
    queryFn: () => getOrderReceipt(orderId),
    enabled: Boolean(orderId && user?.id)
  });

  const receipt = receiptQuery.data;
  const viewerRole: ViewerRole = useMemo(() => {
    if (!user || !receipt) {
      return "buyer";
    }

    if (user.id === receipt.seller_id) {
      return "seller";
    }

    if (user.id === receipt.buyer_id) {
      return "buyer";
    }

    return "admin";
  }, [receipt, user]);

  const backPath = viewerRole === "seller" ? "/dashboard" : viewerRole === "admin" ? "/admin/orders" : "/orders";
  const heroCopy =
    viewerRole === "seller"
      ? "Your seller copy captures the sale value, the platform commission, and the current payout state tied to this order."
      : viewerRole === "admin"
        ? "This archive copy keeps the payment trail, payout share, and review status in one place for future references."
        : "Your buyer copy confirms the purchase, payment trail, and the current escrow state protecting the delivery.";

  if (!user) {
    return (
      <EmptyState
        title="Receipt access requires sign-in"
        body="Sign in to open your purchase and seller receipts."
        action={
          <Link to={`/auth?redirect=${encodeURIComponent(`/receipts/${orderId}`)}`} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">
            Sign in
          </Link>
        }
      />
    );
  }

  if (receiptQuery.isLoading) {
    return <div className="surface-card p-5 text-sm text-sand-600">Loading receipt...</div>;
  }

  if (receiptQuery.isError || !receipt) {
    return (
      <EmptyState
        title="Receipt unavailable"
        body={receiptQuery.error instanceof Error ? receiptQuery.error.message : "We could not load this receipt."}
        action={
          <Link to={backPath} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">
            Back
          </Link>
        }
      />
    );
  }

  return (
    <div className="receipt-page space-y-6">
      <section className="surface-card-vivid subtle-pattern relative overflow-hidden rounded-[2rem] p-5 md:p-8">
        <div
          className="absolute inset-x-0 top-0 h-4 opacity-95"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, #1f46ef 0 64px, #f4c542 64px 92px, #e33910 92px 156px, #159391 156px 184px, #101324 184px 248px)"
          }}
        />
        <div className="pointer-events-none absolute -left-14 top-12 h-40 w-40 rounded-full bg-sunset-200/60 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-8 h-52 w-52 rounded-full bg-lagoon-200/55 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-44 w-44 rounded-full bg-cobalt-100/70 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cobalt-200 bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cobalt-700">
                  {viewerRoleLabel(viewerRole)}
                </span>
                <span className={receiptStatusChip(receipt.order_status)}>{receipt.order_status}</span>
                <span className={escrowStatusChip(receipt.escrow_status)}>{escrowStatusLabel(receipt.escrow_status)}</span>
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-cobalt-700">Crib receipt archive</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-5xl">Payment Receipt</h1>
              <p className="mt-3 max-w-3xl text-sm text-sand-700 md:text-base">{heroCopy}</p>
            </div>

            <div className="receipt-print-hide flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-full border border-sand-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-cobalt-200 hover:bg-cobalt-50"
              >
                Print
              </button>
              <Link
                to={backPath}
                className="rounded-full border border-sand-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-cobalt-200 hover:bg-cobalt-50"
              >
                Back
              </Link>
              <Link
                to={`/asset/${receipt.asset_id}`}
                className="rounded-full bg-cobalt-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-700"
              >
                View listing
              </Link>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <MetaCard label="Receipt Number" value={receipt.receipt_number} tone="cobalt" />
            <MetaCard label="Paid On" value={formatDate(receipt.paid_at)} tone="sunset" />
            <MetaCard label="Payment Trail" value={`${receipt.payment_provider.toUpperCase()} • ${receipt.payment_reference}`} tone="lagoon" />
            <MetaCard label="Gross Total" value={formatCurrency(receipt.amount_kobo, receipt.currency)} tone="forest" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr,0.75fr]">
        <section className="space-y-6">
          <section className="surface-card overflow-hidden rounded-[1.8rem]">
            <div className="grid gap-0 lg:grid-cols-[0.95fr,1.05fr]">
              <div className="relative min-h-[320px] overflow-hidden bg-sand-100">
                {receipt.asset_preview_url ? (
                  <img src={receipt.asset_preview_url} alt={receipt.asset_title} className="h-full w-full object-cover" />
                ) : (
                  <div
                    className="grid h-full w-full place-items-center px-8 text-center"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle at 20% 20%, rgba(31,70,239,0.2), transparent 40%), radial-gradient(circle at 80% 28%, rgba(227,57,16,0.18), transparent 42%), radial-gradient(circle at 50% 80%, rgba(21,147,145,0.18), transparent 46%), linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(241,243,247,0.95) 100%)"
                    }}
                  >
                    <div>
                      <div
                        className="mx-auto h-20 w-20 rounded-[1.6rem] border border-white/70 bg-white/70 shadow-lg"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(45deg, rgba(31,70,239,0.12) 0 12px, rgba(21,147,145,0.14) 12px 24px, rgba(227,57,16,0.14) 24px 36px, rgba(244,197,66,0.2) 36px 48px)"
                        }}
                      />
                      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-sand-600">Creative delivery</p>
                      <p className="mt-2 font-display text-2xl font-bold text-ink">{receipt.asset_title}</p>
                    </div>
                  </div>
                )}
                <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink">
                  {receipt.asset_category ?? "Creative asset"}
                </div>
              </div>

              <div className="p-5 md:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Purchased Creative</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-ink md:text-3xl">{receipt.asset_title}</h2>
                <p className="mt-3 text-sm text-sand-700">
                  This receipt preserves the purchase snapshot as it existed when payment cleared, while the status panel reflects the current escrow or refund state.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <InfoBlock label="Buyer" value={receipt.buyer_display_name || receipt.buyer_email} detail={receipt.buyer_email} />
                  <InfoBlock label="Seller" value={receipt.seller_display_name} detail={receipt.seller_email ?? "Seller email unavailable"} />
                  <InfoBlock label="Order Created" value={formatDate(receipt.order_created_at)} />
                  <InfoBlock label="Payment Reference" value={receipt.payment_reference} />
                </div>

                <div className="mt-5 rounded-[1.4rem] border border-cobalt-100 bg-cobalt-50/80 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cobalt-700">Escrow Protection</p>
                  <p className="mt-2 text-sm text-cobalt-900">
                    {escrowDescription(receipt, viewerRole)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="surface-card rounded-[1.8rem] p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Settlement Breakdown</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-ink">How the payment was split</h2>
              </div>
              <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-sand-700">
                {receipt.currency}
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <AmountCard
                label={viewerRole === "buyer" ? "You Paid" : "Gross Sale"}
                value={formatCurrency(receipt.amount_kobo, receipt.currency)}
                note="Marketplace checkout total"
                tone="cobalt"
              />
              <AmountCard
                label="Platform Commission"
                value={formatCurrency(receipt.commission_kobo, receipt.currency)}
                note="Held by Crib"
                tone="sunset"
              />
              <AmountCard
                label="Seller Net"
                value={formatCurrency(receipt.seller_net_amount_kobo, receipt.currency)}
                note="Released after escrow clears"
                tone="forest"
              />
            </div>
          </section>
        </section>

        <aside className="space-y-6">
          <section className="surface-card rounded-[1.8rem] p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Status Trail</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink">Order Timeline</h2>

            <div className="mt-5 space-y-4">
              <TimelineRow title="Payment confirmed" detail={formatDate(receipt.paid_at)} tone="cobalt" active />
              <TimelineRow
                title="Escrow review window"
                detail={receipt.escrow_due_at ? `Due ${formatDate(receipt.escrow_due_at)}` : "No escrow deadline recorded"}
                tone="sunset"
                active={Boolean(receipt.escrow_due_at)}
              />
              <TimelineRow
                title="Buyer confirmation"
                detail={receipt.buyer_confirmed_at ? formatDate(receipt.buyer_confirmed_at) : "Waiting for buyer action"}
                tone="lagoon"
                active={Boolean(receipt.buyer_confirmed_at)}
              />
              <TimelineRow
                title="Release or refund state"
                detail={finalStateLabel(receipt)}
                tone={receipt.order_status === "refunded" || receipt.buyer_reported_at ? "rose" : "forest"}
                active
              />
            </div>
          </section>

          <section className="surface-card rounded-[1.8rem] p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Reference Notes</p>
            <div className="mt-4 space-y-3">
              <StatusNote label="Escrow state" value={escrowStatusLabel(receipt.escrow_status)} />
              <StatusNote label="Refund reference" value={receipt.refund_reference ?? "Not refunded"} />
              <StatusNote label="Refund provider status" value={receipt.refund_provider_status ?? "No refund event"} />
              <StatusNote label="Scam report" value={receipt.scam_report_reason?.trim() || "No buyer report recorded"} />
            </div>

            <div
              className="mt-5 rounded-[1.4rem] border border-sand-200 px-4 py-4"
              style={{
                backgroundImage:
                  "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(244,248,255,0.96) 52%, rgba(255,244,238,0.95) 100%)"
              }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sand-600">Receipt custody</p>
              <p className="mt-2 text-sm text-sand-700">
                Buyer, seller, and admin copies all point to the same archived receipt record so future disputes, payout checks, and reconciliation work from one source.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function viewerRoleLabel(viewerRole: ViewerRole) {
  if (viewerRole === "seller") {
    return "Seller Copy";
  }
  if (viewerRole === "admin") {
    return "Admin Archive";
  }
  return "Buyer Copy";
}

function receiptStatusChip(status: Order["status"]) {
  if (status === "paid") {
    return "rounded-full bg-forest-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-forest-700";
  }
  if (status === "refunded") {
    return "rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700";
  }
  if (status === "failed") {
    return "rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700";
  }
  return "rounded-full bg-sunset-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sunset-700";
}

function escrowStatusChip(status: OrderReceipt["escrow_status"]) {
  if (status === "released") {
    return "rounded-full bg-cobalt-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cobalt-700";
  }
  if (status === "scam_reported") {
    return "rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700";
  }
  if (status === "awaiting_review") {
    return "rounded-full bg-sunset-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sunset-700";
  }
  return "rounded-full bg-sand-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sand-700";
}

function escrowStatusLabel(status: OrderReceipt["escrow_status"]) {
  if (status === "released") {
    return "Payout released";
  }
  if (status === "scam_reported") {
    return "Issue reported";
  }
  if (status === "awaiting_review") {
    return "Awaiting review";
  }
  return "No escrow";
}

function escrowDescription(receipt: OrderReceipt, viewerRole: ViewerRole) {
  if (receipt.order_status === "refunded") {
    return `This order was refunded${receipt.refund_reference ? ` under reference ${receipt.refund_reference}` : ""}.`;
  }

  if (receipt.escrow_status === "released") {
    return viewerRole === "seller"
      ? `The buyer cleared the file or the review window ended, so the seller net amount is now released.`
      : `The order passed its escrow checks and the seller payout has been released.`;
  }

  if (receipt.escrow_status === "scam_reported") {
    return `A file issue was reported${receipt.buyer_reported_at ? ` on ${formatDate(receipt.buyer_reported_at)}` : ""}. Admin review keeps the payout on hold.`;
  }

  if (receipt.escrow_due_at) {
    return `The file is still within its protected review window until ${formatDate(receipt.escrow_due_at)}.`;
  }

  return "The receipt is archived and ready for future reconciliation.";
}

function finalStateLabel(receipt: OrderReceipt) {
  if (receipt.order_status === "refunded") {
    return receipt.refund_reference ? `Refunded under ${receipt.refund_reference}` : "Order refunded";
  }
  if (receipt.escrow_status === "released") {
    return receipt.escrow_released_at ? `Released ${formatDate(receipt.escrow_released_at)}` : "Payout released";
  }
  if (receipt.escrow_status === "scam_reported") {
    return receipt.scam_resolution_status === "buyer_refunded"
      ? "Reported and refunded"
      : receipt.scam_resolution_status === "genuine_released"
        ? "Reported but later released"
        : "Reported and awaiting admin review";
  }
  return "Still in escrow";
}

function MetaCard({ label, value, tone }: { label: string; value: string; tone: "cobalt" | "sunset" | "lagoon" | "forest" }) {
  const toneClass =
    tone === "cobalt"
      ? "border-cobalt-100 bg-cobalt-50/90"
      : tone === "sunset"
        ? "border-sunset-200 bg-sunset-50/90"
        : tone === "lagoon"
          ? "border-lagoon-200 bg-lagoon-50/90"
          : "border-forest-200 bg-forest-100/80";

  return (
    <article className={`rounded-[1.2rem] border px-4 py-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sand-600">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-ink">{value}</p>
    </article>
  );
}

function InfoBlock({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="rounded-[1.2rem] border border-sand-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sand-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-ink">{value}</p>
      {detail ? <p className="mt-1 text-xs text-sand-600">{detail}</p> : null}
    </article>
  );
}

function AmountCard({
  label,
  value,
  note,
  tone
}: {
  label: string;
  value: string;
  note: string;
  tone: "cobalt" | "sunset" | "forest";
}) {
  const toneClass =
    tone === "cobalt"
      ? "border-cobalt-100 bg-cobalt-50"
      : tone === "sunset"
        ? "border-sunset-200 bg-sunset-50"
        : "border-forest-200 bg-forest-100/80";

  return (
    <article className={`rounded-[1.4rem] border px-4 py-4 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sand-600">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-ink">{value}</p>
      <p className="mt-2 text-sm text-sand-600">{note}</p>
    </article>
  );
}

function TimelineRow({
  title,
  detail,
  tone,
  active
}: {
  title: string;
  detail: string;
  tone: "cobalt" | "sunset" | "lagoon" | "forest" | "rose";
  active: boolean;
}) {
  const dotClass =
    tone === "cobalt"
      ? "bg-cobalt-500"
      : tone === "sunset"
        ? "bg-sunset-500"
        : tone === "lagoon"
          ? "bg-lagoon-500"
          : tone === "forest"
            ? "bg-forest-500"
            : "bg-rose-500";

  return (
    <div className="grid grid-cols-[auto,1fr] gap-3">
      <div className="flex flex-col items-center">
        <span className={`mt-1 h-3.5 w-3.5 rounded-full ${dotClass} ${active ? "" : "opacity-45"}`} />
        <span className="mt-2 h-full w-px bg-sand-200 last:hidden" />
      </div>
      <div className="pb-4">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 text-sm text-sand-600">{detail}</p>
      </div>
    </div>
  );
}

function StatusNote({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-sand-200 bg-sand-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sand-500">{label}</p>
      <p className="mt-2 text-sm text-ink">{value}</p>
    </div>
  );
}
