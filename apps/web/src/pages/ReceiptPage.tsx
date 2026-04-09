import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { getOrderReceipt } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Order, OrderReceipt } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

type ViewerRole = "buyer" | "seller" | "admin";
type ReceiptDisplayMode = "page" | "modal";
type ReceiptPageProps = {
  displayMode?: ReceiptDisplayMode;
};

let receiptLogoPromise: Promise<HTMLImageElement | null> | null = null;

function loadReceiptLogo() {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  if (!receiptLogoPromise) {
    receiptLogoPromise = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = "/crib-logo.png";
    });
  }

  return receiptLogoPromise;
}

export function ReceiptPage({ displayMode = "page" }: ReceiptPageProps) {
  const { orderId = "" } = useParams();
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const { pushToast } = useToast();

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

  const isBuyerReceipt = viewerRole === "buyer";
  const showOperationalPanels = viewerRole !== "buyer";
  const backPath = viewerRole === "seller" ? "/dashboard" : viewerRole === "admin" ? "/admin/orders" : "/orders";
  const heroCopy =
    viewerRole === "seller"
      ? "Your seller copy captures the sale value, the platform commission, and the current payout state tied to this order."
      : viewerRole === "admin"
        ? "This archive copy keeps the payment trail, payout share, and review status in one place for future references."
        : "Your buyer receipt confirms the purchase details, amount paid, and payment reference for your records.";
  const assetSectionCopy = isBuyerReceipt
    ? "Keep this copy as proof of payment for the listing you purchased. If you need help with access or assistance after checkout, share this receipt number with Crib support."
    : "This receipt preserves the purchase snapshot as it existed when payment cleared, while the status panels reflect the latest settlement and review activity.";

  function renderInDisplayFrame(content: ReactNode, title = "Receipt") {
    if (displayMode !== "modal") {
      return <>{content}</>;
    }

    return (
      <Modal
        open
        title={title}
        onClose={() => navigate(-1)}
        hideHeader
        maxWidthClassName="max-w-6xl"
        panelClassName="!max-h-none !overflow-visible !bg-transparent !p-0 !shadow-none"
      >
        <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain pr-1 sm:pr-2">{content}</div>
      </Modal>
    );
  }

  async function handleDownloadPng() {
    if (!receipt) {
      return;
    }

    try {
      const canvas = await renderReceiptCanvas(receipt, viewerRole);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${receipt.receipt_number.toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      pushToast("Receipt PNG downloaded.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not export this receipt.", "error");
    }
  }

  if (!user) {
    return renderInDisplayFrame(
      <EmptyState
        title="Receipt access requires sign-in"
        body="Sign in to open your purchase and seller receipts."
        action={
          <Link to={`/auth?redirect=${encodeURIComponent(`/receipts/${orderId}`)}`} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">
            Sign in
          </Link>
        }
      />,
      "Receipt access"
    );
  }

  if (receiptQuery.isLoading) {
    return renderInDisplayFrame(<div className="surface-card p-5 text-sm text-sand-600">Loading receipt...</div>, "Loading receipt");
  }

  if (receiptQuery.isError || !receipt) {
    return renderInDisplayFrame(
      <EmptyState
        title="Receipt unavailable"
        body={receiptQuery.error instanceof Error ? receiptQuery.error.message : "We could not load this receipt."}
        action={
          <Link to={backPath} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">
            Back
          </Link>
        }
      />,
      "Receipt unavailable"
    );
  }

  return renderInDisplayFrame(
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
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-1 items-start gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[1.45rem] border border-white/70 bg-white/85 shadow-lg shadow-cobalt-200/50">
                <img src="/crib-logo.png" alt="Crib logo" className="h-11 w-11 rounded-full object-cover" decoding="async" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cobalt-200 bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cobalt-700">
                    {viewerRoleLabel(viewerRole)}
                  </span>
                  <span className="rounded-full border border-white/80 bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sand-700">
                    {receipt.receipt_number}
                  </span>
                  {showOperationalPanels ? (
                    <>
                      <span className={receiptStatusChip(receipt.order_status)}>{receipt.order_status}</span>
                      <span className={escrowStatusChip(receipt.escrow_status)}>{escrowStatusLabel(receipt.escrow_status)}</span>
                    </>
                  ) : null}
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-cobalt-700">Crib official receipt</p>
                <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-5xl">Payment Receipt</h1>
                <p className="mt-3 max-w-3xl text-sm text-sand-700 md:text-base">{heroCopy}</p>
              </div>
            </div>

            <div className="min-w-[250px] rounded-[1.6rem] border border-white/75 bg-white/88 p-4 shadow-lg shadow-sand-300/30 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sand-500">Support & assistance</p>
              <a href="mailto:cribafrica@gmail.com" className="mt-3 block text-base font-semibold text-ink hover:text-cobalt-700">
                cribafrica@gmail.com
              </a>
              <p className="mt-2 text-sm text-sand-600">
                Share receipt number <span className="font-semibold text-ink">{receipt.receipt_number}</span> if you need help with this order.
              </p>
            </div>
          </div>

          <div className="receipt-print-hide flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleDownloadPng()}
              className="rounded-full bg-cobalt-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-700"
            >
              Download PNG
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full border border-sand-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-cobalt-200 hover:bg-cobalt-50"
            >
              Print
            </button>
            {displayMode === "modal" ? (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="rounded-full border border-sand-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-cobalt-200 hover:bg-cobalt-50"
              >
                Close
              </button>
            ) : (
              <Link
                to={backPath}
                className="rounded-full border border-sand-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-cobalt-200 hover:bg-cobalt-50"
              >
                Back
              </Link>
            )}
            <Link
              to={`/asset/${receipt.asset_id}`}
              className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/90"
            >
              View listing
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <MetaCard label="Receipt Number" value={receipt.receipt_number} tone="cobalt" />
            <MetaCard label="Paid On" value={formatDate(receipt.paid_at)} tone="sunset" />
            <MetaCard label="Payment Trail" value={`${receipt.payment_provider.toUpperCase()} - ${receipt.payment_reference}`} tone="lagoon" />
            <MetaCard label={isBuyerReceipt ? "Amount Paid" : "Gross Total"} value={formatCurrency(receipt.amount_kobo, receipt.currency)} tone="forest" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
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
                <p className="mt-3 text-sm text-sand-700">{assetSectionCopy}</p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <InfoBlock label="Buyer" value={receipt.buyer_display_name || receipt.buyer_email} detail={receipt.buyer_email} />
                  <InfoBlock label="Seller" value={receipt.seller_display_name} detail={receipt.seller_email ?? "Seller email unavailable"} />
                  <InfoBlock label="Order Created" value={formatDate(receipt.order_created_at)} />
                  <InfoBlock label="Payment Reference" value={receipt.payment_reference} />
                </div>

                <div className="mt-5 rounded-[1.4rem] border border-cobalt-100 bg-cobalt-50/80 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cobalt-700">
                    {isBuyerReceipt ? "Need help with this order?" : "Settlement note"}
                  </p>
                  <p className="mt-2 text-sm text-cobalt-900">
                    {isBuyerReceipt ? (
                      <>
                        For help or assistance, email <span className="font-semibold">cribafrica@gmail.com</span> and include this receipt number.
                      </>
                    ) : (
                      escrowDescription(receipt, viewerRole)
                    )}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="surface-card rounded-[1.8rem] p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">
                  {isBuyerReceipt ? "Payment Summary" : "Settlement Breakdown"}
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold text-ink">
                  {isBuyerReceipt ? "What you paid" : "How the payment was split"}
                </h2>
              </div>
              <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-sand-700">
                {receipt.currency}
              </span>
            </div>

            <div className={`mt-5 grid gap-3 ${showOperationalPanels ? "md:grid-cols-3" : "md:grid-cols-1"}`}>
              <AmountCard
                label={viewerRole === "buyer" ? "You Paid" : "Gross Sale"}
                value={formatCurrency(receipt.amount_kobo, receipt.currency)}
                note={viewerRole === "buyer" ? "Total charged at checkout" : "Marketplace checkout total"}
                tone="cobalt"
              />
              {showOperationalPanels ? (
                <>
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
                </>
              ) : null}
            </div>
          </section>
        </section>

        <aside className="space-y-6">
          {isBuyerReceipt ? (
            <>
              <section className="surface-card rounded-[1.8rem] p-5 md:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Receipt Notes</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-ink">Reference details</h2>

                <div className="mt-5 space-y-3">
                  <StatusNote label="Receipt number" value={receipt.receipt_number} />
                  <StatusNote label="Payment trail" value={`${receipt.payment_provider.toUpperCase()} - ${receipt.payment_reference}`} />
                  <StatusNote label="Purchased from" value={receipt.seller_display_name} />
                  <StatusNote label="Support email" value="cribafrica@gmail.com" />
                </div>
              </section>

              <section className="surface-card rounded-[1.8rem] p-5 md:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Archive Note</p>
                <div
                  className="mt-4 rounded-[1.5rem] border border-sand-200 px-4 py-4"
                  style={{
                    backgroundImage:
                      "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(244,248,255,0.96) 52%, rgba(255,244,238,0.95) 100%)"
                  }}
                >
                  <div className="flex items-center gap-3">
                    <img src="/crib-logo.png" alt="Crib logo" className="h-11 w-11 rounded-full border border-white bg-white object-cover shadow-sm" decoding="async" />
                    <div>
                      <p className="font-display text-xl font-bold text-ink">Crib</p>
                      <p className="text-sm text-sand-600">Professional receipt record</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-sand-700">
                    This buyer copy serves as your proof of payment. Keep it for reimbursements, record keeping, or any future support request related to this purchase.
                  </p>
                </div>
              </section>
            </>
          ) : (
            <>
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
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Reference & Support</p>
                <div className="mt-4 space-y-3">
                  <StatusNote label="Escrow state" value={escrowStatusLabel(receipt.escrow_status)} />
                  <StatusNote label="Refund reference" value={receipt.refund_reference ?? "Not refunded"} />
                  <StatusNote label="Refund provider status" value={receipt.refund_provider_status ?? "No refund event"} />
                  <StatusNote label="Scam report" value={receipt.scam_report_reason?.trim() || "No buyer report recorded"} />
                  <StatusNote label="Support email" value="cribafrica@gmail.com" />
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
                    Buyer, seller, and admin copies all point to the same archived receipt record so reconciliation and support requests work from one source of truth.
                  </p>
                </div>
              </section>
            </>
          )}
        </aside>
      </div>

      <section className="surface-card overflow-hidden rounded-[1.8rem] p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-[1rem] border border-sand-200 bg-white shadow-sm">
              <img src="/crib-logo.png" alt="Crib logo" className="h-9 w-9 rounded-full object-cover" decoding="async" />
            </div>
            <div>
              <p className="font-display text-xl font-bold text-ink">Crib</p>
              <p className="text-sm text-sand-600">Professional receipt archive for digital marketplace purchases.</p>
            </div>
          </div>

          <div className="rounded-[1.3rem] border border-cobalt-100 bg-cobalt-50/80 px-4 py-3 text-sm text-cobalt-900">
            Need help or assistance? <a href="mailto:cribafrica@gmail.com" className="font-semibold underline underline-offset-2">cribafrica@gmail.com</a>
          </div>
        </div>
      </section>
    </div>,
    `${receipt.receipt_number} receipt`
  );
}

async function renderReceiptCanvas(receipt: OrderReceipt, viewerRole: ViewerRole) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1900;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Receipt export is unavailable right now.");
  }

  const ctx = context;
  const width = canvas.width;
  const height = canvas.height;
  const margin = 88;
  const cardWidth = width - margin * 2;
  const isBuyerReceipt = viewerRole === "buyer";
  const logo = await loadReceiptLogo();

  ctx.fillStyle = "#f6efe5";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#1f46ef";
  ctx.fillRect(0, 0, width, 34);
  ctx.fillStyle = "#f4c542";
  ctx.fillRect(240, 0, 120, 34);
  ctx.fillStyle = "#159391";
  ctx.fillRect(620, 0, 160, 34);
  ctx.fillStyle = "#e33910";
  ctx.fillRect(1100, 0, 220, 34);

  drawRoundedRect(ctx, margin, 72, cardWidth, 330, 42);
  ctx.fillStyle = "#fffdf9";
  ctx.fill();
  ctx.strokeStyle = "#d9d3c8";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(31,70,239,0.08)";
  ctx.beginPath();
  ctx.arc(width - 170, 180, 150, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(21,147,145,0.12)";
  ctx.beginPath();
  ctx.arc(210, 300, 110, 0, Math.PI * 2);
  ctx.fill();

  const motifY = 118;
  const motifX = width - 388;
  const motifColors = ["#1f46ef", "#f4c542", "#e33910", "#159391"];
  motifColors.forEach((color, index) => {
    ctx.fillStyle = color;
    drawRoundedRect(ctx, motifX + index * 46, motifY + (index % 2 === 0 ? 0 : 22), 30, 110, 14);
    ctx.fill();
  });

  if (logo) {
    drawRoundedRect(ctx, margin + 30, 106, 92, 92, 28);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.drawImage(logo, margin + 40, 116, 72, 72);
  }

  ctx.fillStyle = "#1f46ef";
  ctx.font = "700 24px Georgia, serif";
  ctx.fillText("Crib official receipt", margin + 144, 136);

  ctx.fillStyle = "#101324";
  ctx.font = "700 64px Georgia, serif";
  ctx.fillText("Payment Receipt", margin + 144, 208);

  ctx.fillStyle = "#4f5a64";
  ctx.font = "400 28px Arial";
  drawWrappedText(ctx, heroCopyForCanvas(viewerRole), margin + 144, 258, 660, 40);

  drawPill(ctx, margin + 144, 312, viewerRoleLabel(viewerRole), "#e7efff", "#1f46ef");
  drawPill(ctx, margin + 360, 312, receipt.receipt_number.toUpperCase(), "#ffffff", "#434c62");

  if (!isBuyerReceipt) {
    drawPill(
      ctx,
      margin + 650,
      312,
      receipt.order_status.toUpperCase(),
      receipt.order_status === "refunded" ? "#fde8e8" : "#e6f7ef",
      receipt.order_status === "refunded" ? "#b42318" : "#0f7a47"
    );
    drawPill(ctx, margin + 888, 312, escrowStatusLabel(receipt.escrow_status).toUpperCase(), "#eef5ff", "#0f3c8c");
  }

  ctx.fillStyle = "#6a726d";
  ctx.font = "600 22px Arial";
  ctx.fillText("Support: cribafrica@gmail.com", width - 500, 136);
  ctx.font = "400 20px Arial";
  ctx.fillText("Use this email for help or assistance with the receipt.", width - 500, 170);

  let currentY = 446;
  currentY = drawInfoSection(
    ctx,
    {
      title: "Receipt snapshot",
      tone: "#1f46ef",
      rows: [
        ["Receipt number", receipt.receipt_number],
        ["Paid on", formatDate(receipt.paid_at)],
        ["Payment trail", `${receipt.payment_provider.toUpperCase()} - ${receipt.payment_reference}`],
        ...(isBuyerReceipt ? [] : [["Order state", finalStateLabel(receipt)] as [string, string]])
      ]
    },
    margin,
    currentY,
    cardWidth
  );

  currentY += 26;
  currentY = drawInfoSection(
    ctx,
    {
      title: "People and listing",
      tone: "#159391",
      rows: [
        ["Buyer", receipt.buyer_display_name || receipt.buyer_email],
        ["Buyer email", receipt.buyer_email],
        ["Seller", receipt.seller_display_name],
        ["Listing", receipt.asset_title],
        ["Category", receipt.asset_category ?? "Creative asset"]
      ]
    },
    margin,
    currentY,
    cardWidth
  );

  currentY += 26;
  const settlementCardHeight = isBuyerReceipt ? 248 : 320;
  drawRoundedRect(ctx, margin, currentY, cardWidth, settlementCardHeight, 34);
  ctx.fillStyle = "#fffdf9";
  ctx.fill();
  ctx.strokeStyle = "#d9d3c8";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#e33910";
  ctx.font = "700 24px Arial";
  ctx.fillText(isBuyerReceipt ? "Payment summary" : "Settlement breakdown", margin + 32, currentY + 50);

  const boxY = currentY + 86;
  const amountCards = isBuyerReceipt
    ? [
        {
          label: "You paid",
          value: formatCurrency(receipt.amount_kobo, receipt.currency),
          tone: "#1f46ef",
          fill: "#eef3ff"
        }
      ]
    : [
        {
          label: "Gross sale",
          value: formatCurrency(receipt.amount_kobo, receipt.currency),
          tone: "#1f46ef",
          fill: "#eef3ff"
        },
        {
          label: "Commission",
          value: formatCurrency(receipt.commission_kobo, receipt.currency),
          tone: "#e33910",
          fill: "#fff0e8"
        },
        {
          label: "Seller net",
          value: formatCurrency(receipt.seller_net_amount_kobo, receipt.currency),
          tone: "#0f7a47",
          fill: "#eefaf2"
        }
      ];
  const boxWidth = (cardWidth - 64 - (amountCards.length - 1) * 12) / amountCards.length;

  amountCards.forEach((card, index) => {
    const x = margin + 20 + index * (boxWidth + 12);
    drawRoundedRect(ctx, x, boxY, boxWidth, 182, 26);
    ctx.fillStyle = card.fill;
    ctx.fill();
    ctx.strokeStyle = "#d9d3c8";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = card.tone;
    ctx.font = "700 22px Arial";
    ctx.fillText(card.label.toUpperCase(), x + 22, boxY + 42);
    ctx.fillStyle = "#101324";
    ctx.font = "700 40px Georgia, serif";
    ctx.fillText(card.value, x + 22, boxY + 104);
  });

  currentY += settlementCardHeight + 36;
  currentY = drawInfoSection(
    ctx,
    {
      title: isBuyerReceipt ? "Support and archive notes" : "Escrow and reference notes",
      tone: "#f4c542",
      rows: isBuyerReceipt
        ? [
            ["Support email", "cribafrica@gmail.com"],
            ["Receipt note", "Keep this buyer copy as proof of payment and include the receipt number in any support request."],
            ["Seller", receipt.seller_display_name]
          ]
        : [
            ["Escrow state", escrowStatusLabel(receipt.escrow_status)],
            ["Escrow note", escrowDescription(receipt, viewerRole)],
            ["Refund reference", receipt.refund_reference ?? "Not refunded"],
            ["Scam report", receipt.scam_report_reason?.trim() || "No buyer report recorded"]
          ]
    },
    margin,
    currentY,
    cardWidth
  );

  const footerY = height - 148;
  ctx.fillStyle = "#101324";
  ctx.fillRect(0, footerY, width, height - footerY);
  ["#1f46ef", "#f4c542", "#e33910", "#159391"].forEach((color, index) => {
    ctx.fillStyle = color;
    drawRoundedRect(ctx, margin + index * 92, footerY - 34 - (index % 2 === 0 ? 0 : 16), 62, 62, 18);
    ctx.fill();
  });

  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 24px Arial";
  ctx.fillText("Need help or assistance? Contact cribafrica@gmail.com.", margin, footerY + 64);
  ctx.font = "400 22px Arial";
  ctx.fillText("Generated from Crib's receipt archive for future reference and reconciliation.", margin, footerY + 104);

  return canvas;
}

function heroCopyForCanvas(viewerRole: ViewerRole) {
  if (viewerRole === "seller") {
    return "Seller copy showing gross sale, platform commission, and current payout state.";
  }

  if (viewerRole === "admin") {
    return "Admin archive copy preserving payment trail, payout share, and review status.";
  }

  return "Buyer receipt confirming the purchase details, amount paid, and payment reference for your records.";
}

function drawInfoSection(
  ctx: CanvasRenderingContext2D,
  section: {
    title: string;
    tone: string;
    rows: Array<[string, string]>;
  },
  x: number,
  y: number,
  width: number
) {
  ctx.font = "600 27px Arial";
  const rowHeights = section.rows.map(([, value]) => Math.max(78, 40 + measureWrappedTextHeight(ctx, value, width - 64, 34)));
  const baseHeight = 110;
  const height = baseHeight + rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0);

  drawRoundedRect(ctx, x, y, width, height, 34);
  ctx.fillStyle = "#fffdf9";
  ctx.fill();
  ctx.strokeStyle = "#d9d3c8";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = section.tone;
  ctx.font = "700 24px Arial";
  ctx.fillText(section.title, x + 32, y + 52);

  let rowY = y + 98;
  section.rows.forEach(([label, value], index) => {
    const rowHeight = rowHeights[index];

    if (index > 0) {
      ctx.strokeStyle = "#ebe6dd";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 28, rowY - 22);
      ctx.lineTo(x + width - 28, rowY - 22);
      ctx.stroke();
    }

    ctx.fillStyle = "#6a726d";
    ctx.font = "700 19px Arial";
    ctx.fillText(label.toUpperCase(), x + 32, rowY);
    ctx.fillStyle = "#101324";
    ctx.font = "600 27px Arial";
    drawWrappedText(ctx, value, x + 32, rowY + 34, width - 64, 34);
    rowY += rowHeight;
  });

  return y + height;
}

function drawPill(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, fill: string, textColor: string) {
  const width = Math.max(150, Math.min(320, label.length * 12 + 40));
  drawRoundedRect(ctx, x, y, width, 44, 22);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.font = "700 18px Arial";
  ctx.fillText(label, x + 18, y + 28);
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let currentY = y;

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
      return;
    }

    line = testLine;
  });

  if (line) {
    ctx.fillText(line, x, currentY);
  }

  return currentY;
}

function measureWrappedTextHeight(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let lines = 1;

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines += 1;
      line = word;
      return;
    }

    line = testLine;
  });

  return lines * lineHeight;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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
