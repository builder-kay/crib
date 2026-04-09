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
type ReceiptTone = "cobalt" | "sunset" | "lagoon" | "forest" | "rose";
type ReceiptRow = [label: string, value: string];
type ReceiptPageProps = {
  displayMode?: ReceiptDisplayMode;
};

type ReceiptSectionData = {
  eyebrow: string;
  title: string;
  tone: ReceiptTone;
  rows: ReceiptRow[];
};

type ReceiptAmountCardData = {
  label: string;
  value: string;
  note: string;
  tone: ReceiptTone;
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

  const heroCopy = receiptHeroCopy(viewerRole);
  const snapshotSection = buildReceiptSnapshotSection(receipt, viewerRole);
  const peopleSection = buildReceiptPeopleSection(receipt);
  const amountCards = buildReceiptAmountCards(receipt, viewerRole);
  const summaryHeader = buildReceiptSummaryHeader(viewerRole);
  const statusSection = showOperationalPanels ? buildReceiptStatusSection(receipt) : null;
  const notesSection = isBuyerReceipt ? buildBuyerNotesSection(receipt) : buildOperationalNotesSection(receipt, viewerRole);

  return renderInDisplayFrame(
    <div className="receipt-page mx-auto max-w-[1100px] space-y-5">
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

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-1 items-start gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[1.45rem] border border-white/70 bg-white/85 shadow-lg shadow-cobalt-200/50">
                <img src="/crib-logo.png" alt="Crib logo" className="h-11 w-11 rounded-full object-cover" decoding="async" />
              </div>

              <div className="min-w-0">
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
                <p className="mt-3 max-w-3xl text-sm leading-6 text-sand-700 md:text-base">{heroCopy}</p>

                <div className="mt-5 inline-flex max-w-2xl items-start gap-3 rounded-[1.35rem] border border-white/80 bg-white/88 px-4 py-3 shadow-sm shadow-sand-300/35">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[1rem] border border-cobalt-100 bg-cobalt-50 text-cobalt-700">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 19h14" />
                      <path d="M7 16V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8" />
                      <path d="M9 10h6" />
                      <path d="M9 13h4" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cobalt-700">Listing purchased</p>
                    <p className="mt-1 break-words text-sm font-semibold text-ink md:text-base">{receipt.asset_title}</p>
                    <p className="mt-1 text-xs text-sand-600">{receipt.asset_category ?? "Creative asset"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="min-w-[260px] rounded-[1.6rem] border border-white/75 bg-white/88 p-4 shadow-lg shadow-sand-300/30 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sand-500">Support & assistance</p>
              <a href="mailto:cribafrica@gmail.com" className="mt-3 block break-all text-base font-semibold text-ink hover:text-cobalt-700">
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
        </div>
      </section>

      <ReceiptListSection section={snapshotSection} />
      <ReceiptListSection section={peopleSection} />
      <ReceiptSummarySection eyebrow={summaryHeader.eyebrow} title={summaryHeader.title} currency={receipt.currency} cards={amountCards} />
      {statusSection ? <ReceiptListSection section={statusSection} /> : null}
      <ReceiptListSection section={notesSection} />
      <ReceiptSupportFooter receiptNumber={receipt.receipt_number} />
    </div>,
    `${receipt.receipt_number} receipt`
  );
}

async function renderReceiptCanvas(receipt: OrderReceipt, viewerRole: ViewerRole) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;

  const measureContext = canvas.getContext("2d");
  if (!measureContext) {
    throw new Error("Receipt export is unavailable right now.");
  }

  const snapshotSection = buildReceiptSnapshotSection(receipt, viewerRole);
  const peopleSection = buildReceiptPeopleSection(receipt);
  const amountCards = buildReceiptAmountCards(receipt, viewerRole);
  const summaryHeader = buildReceiptSummaryHeader(viewerRole);
  const statusSection = viewerRole === "buyer" ? null : buildReceiptStatusSection(receipt);
  const notesSection = viewerRole === "buyer" ? buildBuyerNotesSection(receipt) : buildOperationalNotesSection(receipt, viewerRole);

  const measureCtx = measureContext;
  const width = canvas.width;
  const margin = 88;
  const cardWidth = width - margin * 2;
  const topY = 72;
  const sectionGap = 26;
  const heroHeight = 420;
  const footerHeight = 164;

  let totalHeight = topY + heroHeight + sectionGap;
  totalHeight += measureReceiptSectionHeight(measureCtx, snapshotSection, cardWidth) + sectionGap;
  totalHeight += measureReceiptSectionHeight(measureCtx, peopleSection, cardWidth) + sectionGap;
  totalHeight += measureReceiptSummaryHeight(amountCards.length) + sectionGap;

  if (statusSection) {
    totalHeight += measureReceiptSectionHeight(measureCtx, statusSection, cardWidth) + sectionGap;
  }

  totalHeight += measureReceiptSectionHeight(measureCtx, notesSection, cardWidth) + sectionGap;
  totalHeight += footerHeight + 72;

  canvas.height = Math.max(1880, totalHeight);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Receipt export is unavailable right now.");
  }

  const ctx = context;
  const height = canvas.height;
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

  drawRoundedRect(ctx, margin, topY, cardWidth, heroHeight, 42);
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
  ctx.arc(210, 318, 110, 0, Math.PI * 2);
  ctx.fill();

  if (logo) {
    drawRoundedRect(ctx, margin + 30, topY + 34, 92, 92, 28);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.drawImage(logo, margin + 40, topY + 44, 72, 72);
  }

  const heroTextX = margin + 144;
  const pillsY = topY + 40;

  drawPill(ctx, heroTextX, pillsY, viewerRoleLabel(viewerRole), "#e7efff", "#1f46ef");
  drawPill(ctx, heroTextX + 214, pillsY, receipt.receipt_number.toUpperCase(), "#ffffff", "#434c62");

  if (viewerRole !== "buyer") {
    drawPill(
      ctx,
      heroTextX + 486,
      pillsY,
      receipt.order_status.toUpperCase(),
      receipt.order_status === "refunded" || receipt.order_status === "failed" ? "#fde8e8" : "#e6f7ef",
      receipt.order_status === "refunded" || receipt.order_status === "failed" ? "#b42318" : "#0f7a47"
    );
    drawPill(ctx, heroTextX + 712, pillsY, escrowStatusLabel(receipt.escrow_status).toUpperCase(), "#eef5ff", "#0f3c8c");
  }

  ctx.fillStyle = "#1f46ef";
  ctx.font = "700 24px Georgia, serif";
  ctx.fillText("Crib official receipt", heroTextX, topY + 120);

  ctx.fillStyle = "#101324";
  ctx.font = "700 62px Georgia, serif";
  ctx.fillText("Payment Receipt", heroTextX, topY + 192);

  ctx.fillStyle = "#4f5a64";
  ctx.font = "400 28px Arial";
  drawWrappedText(ctx, receiptHeroCopy(viewerRole), heroTextX, topY + 244, 640, 40);

  drawRoundedRect(ctx, heroTextX, topY + 284, 650, 108, 26);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#d9d3c8";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  drawRoundedRect(ctx, heroTextX + 22, topY + 306, 48, 48, 16);
  ctx.fillStyle = "#eef3ff";
  ctx.fill();
  ctx.strokeStyle = "#cdddff";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#1f46ef";
  ctx.beginPath();
  ctx.arc(heroTextX + 46, topY + 330, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1f46ef";
  ctx.font = "700 18px Arial";
  ctx.fillText("LISTING PURCHASED", heroTextX + 92, topY + 322);
  ctx.fillStyle = "#101324";
  ctx.font = "700 28px Arial";
  drawWrappedText(ctx, receipt.asset_title, heroTextX + 92, topY + 354, 520, 34);

  const supportX = width - margin - 408;
  drawRoundedRect(ctx, supportX, topY + 36, 378, 144, 30);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fill();
  ctx.strokeStyle = "#d9d3c8";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#6a726d";
  ctx.font = "700 18px Arial";
  ctx.fillText("SUPPORT & ASSISTANCE", supportX + 26, topY + 74);
  ctx.fillStyle = "#101324";
  ctx.font = "700 28px Arial";
  ctx.fillText("cribafrica@gmail.com", supportX + 26, topY + 114);
  ctx.fillStyle = "#5b6570";
  ctx.font = "400 20px Arial";
  drawWrappedText(ctx, `Share receipt number ${receipt.receipt_number} if you need help with this order.`, supportX + 26, topY + 146, 324, 28);

  let currentY = topY + heroHeight + sectionGap;
  currentY = drawReceiptSection(ctx, snapshotSection, margin, currentY, cardWidth) + sectionGap;
  currentY = drawReceiptSection(ctx, peopleSection, margin, currentY, cardWidth) + sectionGap;
  currentY = drawReceiptSummarySection(ctx, summaryHeader.eyebrow, summaryHeader.title, receipt.currency, amountCards, margin, currentY, cardWidth) + sectionGap;

  if (statusSection) {
    currentY = drawReceiptSection(ctx, statusSection, margin, currentY, cardWidth) + sectionGap;
  }

  currentY = drawReceiptSection(ctx, notesSection, margin, currentY, cardWidth) + sectionGap;
  drawReceiptFooter(ctx, margin, currentY, cardWidth, footerHeight, logo, receipt.receipt_number);

  return canvas;
}

function ReceiptListSection({ section }: { section: ReceiptSectionData }) {
  return (
    <section className="surface-card overflow-hidden rounded-[1.8rem]">
      <div className="flex items-start gap-4 border-b border-sand-200 bg-white/72 px-5 py-5 md:px-6">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-[1rem] border ${receiptToneIconClass(section.tone)}`}>
          <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: receiptToneAccent(section.tone) }} />
        </div>

        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${receiptToneEyebrowClass(section.tone)}`}>{section.eyebrow}</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink md:text-[2rem]">{section.title}</h2>
        </div>
      </div>

      <div className="px-5 py-2 md:px-6">
        {section.rows.map(([label, value], index) => (
          <div key={`${label}-${index}`} className={`grid gap-2 py-3 md:grid-cols-[220px,1fr] md:gap-5 ${index > 0 ? "border-t border-sand-200" : ""}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sand-500">{label}</p>
            <p className="break-words text-sm font-semibold leading-6 text-ink">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReceiptSummarySection({
  eyebrow,
  title,
  currency,
  cards
}: {
  eyebrow: string;
  title: string;
  currency: string;
  cards: ReceiptAmountCardData[];
}) {
  return (
    <section className="surface-card overflow-hidden rounded-[1.8rem]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sand-200 bg-white/72 px-5 py-5 md:px-6">
        <div className="flex items-start gap-4">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-[1rem] border ${receiptToneIconClass("cobalt")}`}>
            <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: receiptToneAccent("cobalt") }} />
          </div>

          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${receiptToneEyebrowClass("cobalt")}`}>{eyebrow}</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink md:text-[2rem]">{title}</h2>
          </div>
        </div>

        <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-sand-700">
          {currency}
        </span>
      </div>

      <div className={`grid gap-3 px-5 py-5 md:px-6 ${cards.length === 1 ? "md:grid-cols-1" : "md:grid-cols-3"}`}>
        {cards.map((card) => (
          <ReceiptAmountCard key={card.label} card={card} />
        ))}
      </div>
    </section>
  );
}

function ReceiptAmountCard({ card }: { card: ReceiptAmountCardData }) {
  return (
    <article className={`rounded-[1.4rem] border px-4 py-4 ${receiptAmountToneClass(card.tone)}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sand-600">{card.label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-ink">{card.value}</p>
      <p className="mt-2 text-sm text-sand-600">{card.note}</p>
    </article>
  );
}

function ReceiptSupportFooter({ receiptNumber }: { receiptNumber: string }) {
  return (
    <section className="surface-card-vivid subtle-pattern relative overflow-hidden rounded-[1.8rem] p-5 md:p-6">
      <div className="pointer-events-none absolute -right-10 bottom-0 h-28 w-28 rounded-full bg-cobalt-100/70 blur-2xl" />
      <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-[1rem] border border-sand-200 bg-white shadow-sm">
            <img src="/crib-logo.png" alt="Crib logo" className="h-9 w-9 rounded-full object-cover" decoding="async" />
          </div>
          <div>
            <p className="font-display text-xl font-bold text-ink">Crib</p>
            <p className="text-sm text-sand-600">Professional receipt archive for digital marketplace purchases and support follow-ups.</p>
          </div>
        </div>

        <div className="rounded-[1.3rem] border border-cobalt-100 bg-white/90 px-4 py-3 text-sm text-cobalt-900">
          Need help or assistance? <a href="mailto:cribafrica@gmail.com" className="font-semibold underline underline-offset-2">cribafrica@gmail.com</a>
          <span className="block pt-1 text-xs text-sand-600">Quote receipt number {receiptNumber} when contacting support.</span>
        </div>
      </div>
    </section>
  );
}

function buildReceiptSnapshotSection(receipt: OrderReceipt, viewerRole: ViewerRole): ReceiptSectionData {
  return {
    eyebrow: "Receipt snapshot",
    title: "Payment and archive details",
    tone: "cobalt",
    rows: [
      ["Receipt number", receipt.receipt_number],
      ["Receipt type", viewerRoleLabel(viewerRole)],
      ["Paid on", formatDate(receipt.paid_at)],
      ["Payment trail", paymentTrailLabel(receipt)],
      ...(viewerRole === "buyer" ? [] : [["Order state", finalStateLabel(receipt)] as ReceiptRow])
    ]
  };
}

function buildReceiptPeopleSection(receipt: OrderReceipt): ReceiptSectionData {
  return {
    eyebrow: "People and listing",
    title: "Who was involved in this order",
    tone: "lagoon",
    rows: [
      ["Buyer", buyerLabel(receipt)],
      ["Buyer email", receipt.buyer_email],
      ["Seller", sellerLabel(receipt)],
      ["Seller email", receipt.seller_email ?? "Seller email unavailable"],
      ["Listing", receipt.asset_title],
      ["Category", receipt.asset_category ?? "Creative asset"],
      ["Order created", formatDate(receipt.order_created_at)]
    ]
  };
}

function buildBuyerNotesSection(receipt: OrderReceipt): ReceiptSectionData {
  return {
    eyebrow: "Support and archive notes",
    title: "Help, assistance, and proof of payment",
    tone: "sunset",
    rows: [
      ["Support email", "cribafrica@gmail.com"],
      ["Receipt note", "Keep this buyer copy as proof of payment and share the receipt number in any support request."],
      ["Purchased from", sellerLabel(receipt)],
      ["Listing", receipt.asset_title]
    ]
  };
}

function buildReceiptStatusSection(receipt: OrderReceipt): ReceiptSectionData {
  return {
    eyebrow: "Status trail",
    title: "Order timeline and settlement trail",
    tone: "forest",
    rows: [
      ["Payment confirmed", formatDate(receipt.paid_at)],
      ["Escrow review window", receipt.escrow_due_at ? `Due ${formatDate(receipt.escrow_due_at)}` : "No escrow deadline recorded"],
      ["Buyer confirmation", receipt.buyer_confirmed_at ? formatDate(receipt.buyer_confirmed_at) : "Waiting for buyer action"],
      ["Release or refund state", finalStateLabel(receipt)]
    ]
  };
}

function buildOperationalNotesSection(receipt: OrderReceipt, viewerRole: ViewerRole): ReceiptSectionData {
  return {
    eyebrow: "Escrow and reference notes",
    title: "Escrow, refunds, and support details",
    tone: "sunset",
    rows: [
      ["Escrow state", escrowStatusLabel(receipt.escrow_status)],
      ["Escrow note", escrowDescription(receipt, viewerRole)],
      ["Refund reference", receipt.refund_reference ?? "Not refunded"],
      ["Refund provider status", receipt.refund_provider_status ?? "No refund event"],
      ["Scam report", receipt.scam_report_reason?.trim() || "No buyer report recorded"],
      ["Support email", "cribafrica@gmail.com"]
    ]
  };
}

function buildReceiptAmountCards(receipt: OrderReceipt, viewerRole: ViewerRole): ReceiptAmountCardData[] {
  if (viewerRole === "buyer") {
    return [
      {
        label: "Amount paid",
        value: formatCurrency(receipt.amount_kobo, receipt.currency),
        note: "Total charged at checkout",
        tone: "cobalt"
      }
    ];
  }

  return [
    {
      label: "Gross sale",
      value: formatCurrency(receipt.amount_kobo, receipt.currency),
      note: "Marketplace checkout total",
      tone: "cobalt"
    },
    {
      label: "Platform commission",
      value: formatCurrency(receipt.commission_kobo, receipt.currency),
      note: "Held by Crib",
      tone: "sunset"
    },
    {
      label: "Seller net",
      value: formatCurrency(receipt.seller_net_amount_kobo, receipt.currency),
      note: "Released after escrow clears",
      tone: "forest"
    }
  ];
}

function buildReceiptSummaryHeader(viewerRole: ViewerRole) {
  if (viewerRole === "buyer") {
    return {
      eyebrow: "Payment summary",
      title: "What you paid"
    };
  }

  return {
    eyebrow: "Settlement breakdown",
    title: "How the payment was split"
  };
}

function receiptHeroCopy(viewerRole: ViewerRole) {
  if (viewerRole === "seller") {
    return "Your seller copy captures the sale value, platform commission, payout timing, and archive details tied to this order.";
  }

  if (viewerRole === "admin") {
    return "This archive copy keeps the payment trail, payout share, refund context, and review status together for future reference.";
  }

  return "Your buyer receipt confirms the purchase details, amount paid, and payment reference for your records and future support requests.";
}

function buyerLabel(receipt: OrderReceipt) {
  return receipt.buyer_display_name || receipt.buyer_email;
}

function sellerLabel(receipt: OrderReceipt) {
  return receipt.seller_display_name || "Seller";
}

function paymentTrailLabel(receipt: OrderReceipt) {
  return `${receipt.payment_provider.toUpperCase()} - ${receipt.payment_reference}`;
}

function receiptToneAccent(tone: ReceiptTone) {
  if (tone === "sunset") {
    return "#e33910";
  }
  if (tone === "lagoon") {
    return "#159391";
  }
  if (tone === "forest") {
    return "#0f7a47";
  }
  if (tone === "rose") {
    return "#b42318";
  }
  return "#1f46ef";
}

function receiptToneFill(tone: ReceiptTone) {
  if (tone === "sunset") {
    return "#fff0e8";
  }
  if (tone === "lagoon") {
    return "#eef8f7";
  }
  if (tone === "forest") {
    return "#eefaf2";
  }
  if (tone === "rose") {
    return "#fde8e8";
  }
  return "#eef3ff";
}

function receiptToneEyebrowClass(tone: ReceiptTone) {
  if (tone === "sunset") {
    return "text-sunset-700";
  }
  if (tone === "lagoon") {
    return "text-lagoon-700";
  }
  if (tone === "forest") {
    return "text-forest-700";
  }
  if (tone === "rose") {
    return "text-rose-700";
  }
  return "text-cobalt-700";
}

function receiptToneIconClass(tone: ReceiptTone) {
  if (tone === "sunset") {
    return "border-sunset-200 bg-sunset-50";
  }
  if (tone === "lagoon") {
    return "border-lagoon-200 bg-lagoon-50";
  }
  if (tone === "forest") {
    return "border-forest-200 bg-forest-50";
  }
  if (tone === "rose") {
    return "border-rose-200 bg-rose-50";
  }
  return "border-cobalt-100 bg-cobalt-50";
}

function receiptAmountToneClass(tone: ReceiptTone) {
  if (tone === "sunset") {
    return "border-sunset-200 bg-sunset-50";
  }
  if (tone === "forest") {
    return "border-forest-200 bg-forest-100/80";
  }
  if (tone === "lagoon") {
    return "border-lagoon-200 bg-lagoon-50";
  }
  if (tone === "rose") {
    return "border-rose-200 bg-rose-50";
  }
  return "border-cobalt-100 bg-cobalt-50";
}

function measureReceiptSectionHeight(ctx: CanvasRenderingContext2D, section: ReceiptSectionData, width: number) {
  ctx.font = "700 34px Georgia, serif";
  const titleHeight = measureWrappedTextHeight(ctx, section.title, width - 64, 40);
  ctx.font = "600 27px Arial";
  const rowHeights = section.rows.map(([, value]) => Math.max(86, 38 + measureWrappedTextHeight(ctx, value, width - 64, 34)));
  return 110 + titleHeight + rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0);
}

function drawReceiptSection(
  ctx: CanvasRenderingContext2D,
  section: ReceiptSectionData,
  x: number,
  y: number,
  width: number
) {
  const height = measureReceiptSectionHeight(ctx, section, width);

  drawRoundedRect(ctx, x, y, width, height, 34);
  ctx.fillStyle = "#fffdf9";
  ctx.fill();
  ctx.strokeStyle = "#d9d3c8";
  ctx.lineWidth = 2;
  ctx.stroke();

  drawRoundedRect(ctx, x + 30, y + 30, 44, 44, 14);
  ctx.fillStyle = receiptToneFill(section.tone);
  ctx.fill();
  ctx.strokeStyle = "#d9d3c8";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = receiptToneAccent(section.tone);
  ctx.beginPath();
  ctx.arc(x + 52, y + 52, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = receiptToneAccent(section.tone);
  ctx.font = "700 18px Arial";
  ctx.fillText(section.eyebrow.toUpperCase(), x + 94, y + 50);

  ctx.fillStyle = "#101324";
  ctx.font = "700 34px Georgia, serif";
  drawWrappedText(ctx, section.title, x + 94, y + 88, width - 126, 40);

  let currentY = y + 134;
  section.rows.forEach(([label, value], index) => {
    if (index > 0) {
      ctx.strokeStyle = "#ebe6dd";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 28, currentY - 24);
      ctx.lineTo(x + width - 28, currentY - 24);
      ctx.stroke();
    }

    ctx.fillStyle = "#6a726d";
    ctx.font = "700 18px Arial";
    ctx.fillText(label.toUpperCase(), x + 32, currentY);

    ctx.fillStyle = "#101324";
    ctx.font = "600 27px Arial";
    const lastTextY = drawWrappedText(ctx, value, x + 32, currentY + 34, width - 64, 34);
    currentY = lastTextY + 52;
  });

  return y + height;
}

function measureReceiptSummaryHeight(cardCount: number) {
  return cardCount === 1 ? 280 : 352;
}

function drawReceiptSummarySection(
  ctx: CanvasRenderingContext2D,
  eyebrow: string,
  title: string,
  currency: string,
  cards: ReceiptAmountCardData[],
  x: number,
  y: number,
  width: number
) {
  const height = measureReceiptSummaryHeight(cards.length);

  drawRoundedRect(ctx, x, y, width, height, 34);
  ctx.fillStyle = "#fffdf9";
  ctx.fill();
  ctx.strokeStyle = "#d9d3c8";
  ctx.lineWidth = 2;
  ctx.stroke();

  drawRoundedRect(ctx, x + 30, y + 30, 44, 44, 14);
  ctx.fillStyle = receiptToneFill("cobalt");
  ctx.fill();
  ctx.strokeStyle = "#d9d3c8";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = receiptToneAccent("cobalt");
  ctx.beginPath();
  ctx.arc(x + 52, y + 52, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = receiptToneAccent("cobalt");
  ctx.font = "700 18px Arial";
  ctx.fillText(eyebrow.toUpperCase(), x + 94, y + 50);

  ctx.fillStyle = "#101324";
  ctx.font = "700 34px Georgia, serif";
  ctx.fillText(title, x + 94, y + 88);

  drawPill(ctx, x + width - 178, y + 38, currency.toUpperCase(), "#f8f3ec", "#5b6570");

  const cardGap = 18;
  const cardY = y + 124;
  const cardWidth = cards.length === 1 ? width - 40 : (width - 40 - (cards.length - 1) * cardGap) / cards.length;

  cards.forEach((card, index) => {
    const cardX = x + 20 + index * (cardWidth + cardGap);

    drawRoundedRect(ctx, cardX, cardY, cardWidth, cards.length === 1 ? 132 : 172, 26);
    ctx.fillStyle = receiptToneFill(card.tone);
    ctx.fill();
    ctx.strokeStyle = "#d9d3c8";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#6a726d";
    ctx.font = "700 18px Arial";
    ctx.fillText(card.label.toUpperCase(), cardX + 22, cardY + 34);

    ctx.fillStyle = "#101324";
    ctx.font = "700 40px Georgia, serif";
    ctx.fillText(card.value, cardX + 22, cardY + 86);

    ctx.fillStyle = "#5b6570";
    ctx.font = "400 20px Arial";
    drawWrappedText(ctx, card.note, cardX + 22, cardY + 118, cardWidth - 44, 26);
  });

  return y + height;
}

function drawReceiptFooter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  logo: HTMLImageElement | null,
  receiptNumber: string
) {
  drawRoundedRect(ctx, x, y, width, height, 34);
  ctx.fillStyle = "#fffdf9";
  ctx.fill();
  ctx.strokeStyle = "#d9d3c8";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (logo) {
    drawRoundedRect(ctx, x + 28, y + 34, 74, 74, 24);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.drawImage(logo, x + 38, y + 44, 54, 54);
  }

  ctx.fillStyle = "#101324";
  ctx.font = "700 34px Georgia, serif";
  ctx.fillText("Crib", x + 126, y + 58);
  ctx.fillStyle = "#5b6570";
  ctx.font = "400 22px Arial";
  drawWrappedText(
    ctx,
    "Professional receipt archive for digital marketplace purchases and support follow-ups.",
    x + 126,
    y + 90,
    720,
    28
  );

  drawRoundedRect(ctx, x + width - 446, y + 28, 418, 108, 26);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#d9d3c8";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#1f46ef";
  ctx.font = "700 22px Arial";
  ctx.fillText("Need help or assistance?", x + width - 418, y + 64);
  ctx.font = "700 24px Arial";
  ctx.fillText("cribafrica@gmail.com", x + width - 418, y + 98);
  ctx.fillStyle = "#5b6570";
  ctx.font = "400 18px Arial";
  ctx.fillText(`Quote receipt number ${receiptNumber}.`, x + width - 418, y + 124);
}

function drawPill(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, fill: string, textColor: string) {
  const width = Math.max(150, Math.min(340, label.length * 12 + 40));
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
  if (status === "refunded" || status === "failed") {
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
      ? "The buyer cleared the file or the review window ended, so the seller net amount is now released."
      : "The order passed its escrow checks and the seller payout has been released.";
  }

  if (receipt.escrow_status === "scam_reported") {
    return `A file issue was reported${receipt.buyer_reported_at ? ` on ${formatDate(receipt.buyer_reported_at)}` : ""}. Admin review keeps the payout on hold.`;
  }

  if (receipt.escrow_due_at) {
    return `The file is still within its review window until ${formatDate(receipt.escrow_due_at)}.`;
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
