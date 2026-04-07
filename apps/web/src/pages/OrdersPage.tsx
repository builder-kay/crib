import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { PriceTag } from "@/components/PriceTag";
import { StarRating } from "@/components/StarRating";
import { useToast } from "@/components/Toast";
import { getUserContactEmail } from "@/lib/auth";
import {
  confirmOrderEscrow,
  generateDownload,
  getBuyerOrders,
  getReviewedAssetIdsForUser,
  reportOrderFileScam,
  upsertAssetReview,
  verifyPayment
} from "@/lib/api";
import { getAssetAppLabel, getAssetFormatLabel } from "@/lib/assetCatalog";
import { formatDate } from "@/lib/format";
import type { Order } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

export function OrdersPage() {
  const initialized = useAuthStore((state) => state.initialized);
  const user = useAuthStore((state) => state.user);
  const userContactEmail = getUserContactEmail(user);
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const verifiedReferenceRef = useRef<string | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [suppressedPromptOrderIds, setSuppressedPromptOrderIds] = useState<string[]>([]);
  const [reportOrderId, setReportOrderId] = useState<string | null>(null);
  const [scamReason, setScamReason] = useState("");

  const reference = params.get("reference") ?? "";
  const sanitizedSearch = useMemo(() => {
    const next = new URLSearchParams(params);
    next.delete("token");
    const search = next.toString();
    return search ? `?${search}` : "";
  }, [params]);

  useEffect(() => {
    if (!params.get("token")) {
      return;
    }

    navigate(
      {
        pathname: location.pathname,
        search: sanitizedSearch
      },
      { replace: true }
    );
  }, [location.pathname, navigate, params, sanitizedSearch]);

  const ordersQuery = useQuery({
    queryKey: ["orders", user?.id, userContactEmail],
    queryFn: () => getBuyerOrders({ userId: user?.id }),
    enabled: initialized && Boolean(user?.id)
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyPayment(reference),
    onSuccess: async (payload) => {
      if (payload.order_status === "paid") {
        if (payload.escrow_status === "awaiting_review") {
          pushToast("Payment verified. Download unlocked and escrow is now waiting for your file check.", "success");
        } else {
          pushToast("Payment verified and order marked as paid.", "success");
        }
      } else if (payload.order_status === "pending") {
        pushToast("Payment received, verification is still pending.", "info");
      } else {
        pushToast(`Payment status: ${payload.order_status}`, "info");
      }

      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not verify payment", "error");
    }
  });

  useEffect(() => {
    if (!reference || !initialized || !user) {
      return;
    }

    if (verifiedReferenceRef.current === reference) {
      return;
    }

    verifiedReferenceRef.current = reference;
    verifyMutation.mutate();
  }, [reference, initialized, user, verifyMutation]);

  const headline = useMemo(() => {
    if (reference) {
      return "Download the file you just bought, inspect it, then confirm if it is genuine or report a scam within 24 hours.";
    }
    return "Your purchases, secure downloads, and escrow confirmations live here.";
  }, [reference]);

  const signInRedirect = `/auth?redirect=${encodeURIComponent(`${location.pathname}${sanitizedSearch}`)}`;
  const orders = ordersQuery.data ?? [];

  const releasedOrdersWithAssets = useMemo(
    () => orders.filter((order) => order.status === "paid" && order.escrow_status === "released" && Boolean(order.asset?.id)),
    [orders]
  );

  const releasedAssetIds = useMemo(
    () => Array.from(new Set(releasedOrdersWithAssets.map((order) => order.asset!.id))),
    [releasedOrdersWithAssets]
  );

  const reviewedAssetIdsQuery = useQuery({
    queryKey: ["reviewed-asset-ids", user?.id, releasedAssetIds],
    queryFn: () => getReviewedAssetIdsForUser(user!.id, releasedAssetIds),
    enabled: Boolean(user?.id && releasedAssetIds.length > 0)
  });

  const reviewedAssetIdsSet = useMemo(() => new Set(reviewedAssetIdsQuery.data ?? []), [reviewedAssetIdsQuery.data]);

  const reviewPromptOrder = useMemo(() => {
    if (!user?.id || releasedOrdersWithAssets.length === 0 || reviewedAssetIdsQuery.isLoading) {
      return null;
    }

    const storageKey = `crib.review_prompt.dismissed.${user.id}`;
    let dismissedOrderIds = new Set<string>();
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            dismissedOrderIds = new Set(parsed.filter((value): value is string => typeof value === "string"));
          }
        } catch {
          dismissedOrderIds = new Set();
        }
      }
    }

    return (
      releasedOrdersWithAssets.find(
        (order) =>
          !reviewedAssetIdsSet.has(order.asset!.id) &&
          !dismissedOrderIds.has(order.id) &&
          !suppressedPromptOrderIds.includes(order.id)
      ) ?? null
    );
  }, [releasedOrdersWithAssets, reviewedAssetIdsQuery.isLoading, reviewedAssetIdsSet, suppressedPromptOrderIds, user?.id]);

  useEffect(() => {
    if (!reviewPromptOrder) {
      return;
    }

    if (reviewModalOpen && reviewOrderId === reviewPromptOrder.id) {
      return;
    }

    setReviewOrderId(reviewPromptOrder.id);
    setReviewRating(0);
    setReviewComment("");
    setReviewModalOpen(true);
  }, [reviewModalOpen, reviewOrderId, reviewPromptOrder]);

  const reviewSubmitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error("Sign in required to leave a review.");
      }

      const selectedOrder = orders.find((order) => order.id === reviewOrderId);
      if (!selectedOrder?.asset?.id) {
        throw new Error("No listing selected for review.");
      }

      if (reviewRating < 1 || reviewRating > 5) {
        throw new Error("Please select a rating between 1 and 5.");
      }

      await upsertAssetReview({
        userId: user.id,
        assetId: selectedOrder.asset.id,
        rating: reviewRating,
        reviewText: reviewComment
      });

      return { orderId: selectedOrder.id };
    },
    onSuccess: async (result) => {
      pushToast("Thanks for your review.", "success");
      setSuppressedPromptOrderIds((previous) =>
        previous.includes(result.orderId) ? previous : [...previous, result.orderId]
      );
      setReviewModalOpen(false);
      setReviewOrderId(null);
      setReviewRating(0);
      setReviewComment("");

      if (user?.id && result.orderId && typeof window !== "undefined") {
        const storageKey = `crib.review_prompt.dismissed.${user.id}`;
        const raw = window.localStorage.getItem(storageKey);
        let dismissedOrderIds: string[] = [];
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as unknown;
            if (Array.isArray(parsed)) {
              dismissedOrderIds = parsed.filter((value): value is string => typeof value === "string");
            }
          } catch {
            dismissedOrderIds = [];
          }
        }
        window.localStorage.setItem(storageKey, JSON.stringify(dismissedOrderIds.filter((id) => id !== result.orderId)));
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reviewed-asset-ids", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["asset-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["asset"] }),
        queryClient.invalidateQueries({ queryKey: ["market-assets"] }),
        queryClient.invalidateQueries({ queryKey: ["creator-rating-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["creator-reviews"] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not submit review", "error");
    }
  });

  const confirmEscrowMutation = useMutation({
    mutationFn: (orderId: string) => confirmOrderEscrow(orderId),
    onSuccess: async () => {
      pushToast("Thanks for confirming the file. The seller payout has been released.", "success");
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not confirm this order", "error");
    }
  });

  const reportScamMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) => reportOrderFileScam(orderId, reason),
    onSuccess: async () => {
      pushToast("File scam reported. The seller payout will stay on hold while this is reviewed.", "success");
      setReportOrderId(null);
      setScamReason("");
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not report this order", "error");
    }
  });

  const selectedReviewOrder = useMemo(
    () => orders.find((order) => order.id === reviewOrderId) ?? null,
    [orders, reviewOrderId]
  );

  const selectedReportOrder = useMemo(
    () => orders.find((order) => order.id === reportOrderId) ?? null,
    [orders, reportOrderId]
  );

  function dismissReviewPrompt() {
    if (!user?.id || !reviewOrderId) {
      setReviewOrderId(null);
      setReviewRating(0);
      setReviewComment("");
      setReviewModalOpen(false);
      return;
    }

    const storageKey = `crib.review_prompt.dismissed.${user.id}`;
    let dismissedOrderIds: string[] = [];
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            dismissedOrderIds = parsed.filter((value): value is string => typeof value === "string");
          }
        } catch {
          dismissedOrderIds = [];
        }
      }

      if (!dismissedOrderIds.includes(reviewOrderId)) {
        dismissedOrderIds.push(reviewOrderId);
        window.localStorage.setItem(storageKey, JSON.stringify(dismissedOrderIds));
      }
    }

    setSuppressedPromptOrderIds((previous) =>
      previous.includes(reviewOrderId) ? previous : [...previous, reviewOrderId]
    );
    setReviewOrderId(null);
    setReviewRating(0);
    setReviewComment("");
    setReviewModalOpen(false);
  }

  const orderSummary = useMemo(() => {
    const summary = {
      total: 0,
      pending: 0,
      failed: 0,
      refunded: 0,
      awaitingReview: 0,
      released: 0,
      reported: 0
    };

    for (const order of orders) {
      summary.total += 1;

      if (order.status === "pending") {
        summary.pending += 1;
        continue;
      }

      if (order.status === "failed") {
        summary.failed += 1;
        continue;
      }

      if (order.status === "refunded") {
        summary.refunded += 1;
        continue;
      }

      if (order.escrow_status === "awaiting_review") {
        summary.awaitingReview += 1;
      } else if (order.escrow_status === "scam_reported") {
        summary.reported += 1;
      } else {
        summary.released += 1;
      }
    }

    return summary;
  }, [orders]);

  if (!initialized) {
    return <div className="surface-card p-5 text-sm text-sand-600">Loading orders...</div>;
  }

  if (!user) {
    return (
      <EmptyState
        title="No order access yet"
        body="Sign in to view your orders, verify payment, unlock downloads, and confirm whether a file is genuine."
        action={<Link to={signInRedirect} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">Sign in</Link>}
      />
    );
  }

  return (
    <div className="space-y-5">
      <header className="surface-card-vivid subtle-pattern p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-600">Buyer Vault</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">Orders</h1>
            <p className="mt-2 text-sm text-sand-700 md:text-base">{headline}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            <OrderStatCard label="Total" value={String(orderSummary.total)} tone="cobalt" />
            <OrderStatCard label="Awaiting Review" value={String(orderSummary.awaitingReview)} tone="sunset" />
            <OrderStatCard label="Released" value={String(orderSummary.released)} tone="forest" />
            <OrderStatCard label="Reported" value={String(orderSummary.reported)} tone="rose" />
          </div>
        </div>
      </header>

      {reference ? (
        <section className="surface-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cobalt-600">Payment Verification</p>
          <p className="mt-1 text-sm text-sand-700">
            {verifyMutation.isPending
              ? "Verifying your payment reference now..."
              : verifyMutation.isSuccess
                ? "Verification complete. Your order has been refreshed with the current escrow state."
                : "We received your payment callback. If your order is still pending, refresh again shortly."}
          </p>
        </section>
      ) : null}

      {ordersQuery.isLoading ? <div className="surface-card p-5 text-sm text-sand-600">Loading your orders...</div> : null}
      {ordersQuery.isError ? (
        <div className="surface-card p-5 text-sm text-rose-700">
          {ordersQuery.error instanceof Error ? ordersQuery.error.message : "Unable to load orders."}
        </div>
      ) : null}

      {!ordersQuery.isLoading && orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          body="After your first purchase, your secure download and escrow confirmation steps show up here."
          action={
            <Link to="/market" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">
              Browse marketplace
            </Link>
          }
        />
      ) : null}

      <section className="space-y-3">
        {orders.map((order) => {
          const previewUrl = order.asset?.previews?.[0]?.preview_url;
          const canDownload = order.status === "paid";
          const canViewReceipt = order.status === "paid" || order.status === "refunded";
          const appLabel = order.asset ? getAssetAppLabel(order.asset) : "Creative App";
          const formatLabel = order.asset ? getAssetFormatLabel(order.asset) : "Source files";
          const awaitingReview = order.status === "paid" && order.escrow_status === "awaiting_review";
          const released = order.status === "paid" && order.escrow_status === "released";
          const reported = order.status === "paid" && order.escrow_status === "scam_reported";
          const escrowButtonsEnabled = awaitingReview && Boolean(order.buyer_opened_at);

          return (
            <article key={order.id} className="surface-card overflow-hidden">
              <div className="grid gap-0 md:grid-cols-[220px,1fr]">
                <div className="relative min-h-36 overflow-hidden bg-sand-100">
                  {previewUrl ? (
                    <img src={previewUrl} alt={order.asset?.title ?? "Listing preview"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-sm font-semibold uppercase tracking-wide text-sand-500">
                      No preview
                    </div>
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink">
                    {order.asset?.category ?? "Listing"}
                  </span>
                </div>

                <div className="p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-ink">{order.asset?.title ?? "Listing"}</h3>
                      <p className="mt-1 text-xs text-sand-600">
                        Order #{order.id.slice(0, 8)} - {formatDate(order.created_at)}
                      </p>
                      <p className="mt-1 text-xs text-sand-500">
                        {appLabel} - {formatLabel}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <PriceTag amountKobo={order.amount_kobo} currency={order.currency} />
                      <span className={statusChipClass(order.status)}>{order.status}</span>
                      {order.status === "paid" ? (
                        <span className={escrowChipClass(order.escrow_status)}>{escrowChipLabel(order.escrow_status)}</span>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-2 text-sm text-sand-700">{statusDescription(order)}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={!canDownload}
                      onClick={async () => {
                        try {
                          const payload = await generateDownload(order.id);
                          const link = document.createElement("a");
                          link.href = payload.url;
                          link.download = payload.filename || "creative-cloud-download";
                          link.rel = "noopener noreferrer";
                          document.body.appendChild(link);
                          link.click();
                          link.remove();
                          pushToast(
                            awaitingReview
                              ? "Download opened. Inspect the file, then confirm it is genuine or report a scam."
                              : "Download link generated.",
                            "success"
                          );
                          await queryClient.invalidateQueries({ queryKey: ["orders"] });
                        } catch (error) {
                          pushToast(error instanceof Error ? error.message : "Download failed", "error");
                        }
                      }}
                      className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:bg-sand-300"
                    >
                      {canDownload ? "Download" : "Locked"}
                    </button>

                    {canViewReceipt ? (
                      <Link
                        to={`/receipts/${order.id}`}
                        className="rounded-lg border border-cobalt-200 bg-cobalt-50 px-3 py-2 text-sm font-semibold text-cobalt-700 transition hover:border-cobalt-300 hover:bg-cobalt-100"
                      >
                        Receipt
                      </Link>
                    ) : null}

                    {!canDownload ? <p className="text-xs text-sand-600">Download unlocks after payment confirmation.</p> : null}
                  </div>

                  {order.status === "paid" ? (
                    <div className="mt-4 rounded-2xl border border-cobalt-100 bg-cobalt-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cobalt-700">Escrow Review</p>
                          <p className="mt-1 text-sm text-cobalt-900">
                            Open the file and check that it matches the listing. If you do not confirm or report an issue by{" "}
                            <span className="font-semibold">{formatDateTime(order.escrow_due_at) ?? "the end of the 24-hour review window"}</span>,
                            we treat it as genuine and release the seller payout automatically.
                          </p>
                        </div>
                        <span className={escrowChipClass(order.escrow_status)}>{escrowChipLabel(order.escrow_status)}</span>
                      </div>

                      {awaitingReview ? (
                        <div className="mt-3 space-y-3">
                          <p className="text-xs text-cobalt-900/80">
                            {order.buyer_opened_at
                              ? "You can confirm the file now or report a scam if the delivery is wrong."
                              : "Download the file once to unlock the confirm and report buttons."}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={!escrowButtonsEnabled || confirmEscrowMutation.isPending}
                              onClick={() => confirmEscrowMutation.mutate(order.id)}
                              className="rounded-full bg-forest-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {confirmEscrowMutation.isPending ? "Confirming..." : "Confirm Genuine File"}
                            </button>
                            <button
                              type="button"
                              disabled={!escrowButtonsEnabled || reportScamMutation.isPending}
                              onClick={() => {
                                setReportOrderId(order.id);
                                setScamReason(order.scam_report_reason ?? "");
                              }}
                              className="rounded-full border border-rose-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Report File Scam
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {released ? (
                        <p className="mt-3 text-xs text-cobalt-900/80">
                          Seller payout released{order.escrow_release_reason === "auto_timeout" ? " automatically after the 24-hour review window." : " after your confirmation."}
                        </p>
                      ) : null}

                      {reported ? (
                        <p className="mt-3 text-xs text-rose-700">
                          Scam reported{order.buyer_reported_at ? ` on ${formatDateTime(order.buyer_reported_at)}` : ""}. The payout stays on hold while the issue is reviewed.
                          {order.scam_report_reason ? ` Reason: ${order.scam_report_reason}` : ""}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <Modal
        open={reviewModalOpen && Boolean(selectedReviewOrder?.asset?.id)}
        title="Rate your purchase"
        onClose={dismissReviewPrompt}
      >
        <div className="space-y-3">
          <p className="text-sm text-sand-700">
            How was <span className="font-semibold text-ink">{selectedReviewOrder?.asset?.title ?? "this listing"}</span>?
          </p>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-sand-600">Rating (required)</p>
            <StarRating value={reviewRating} onChange={setReviewRating} />
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-sand-600">Comment (optional)</span>
            <textarea
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              rows={3}
              placeholder="What did you like? How did you use it?"
              className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={dismissReviewPrompt}
              className="w-full rounded-lg border border-sand-300 px-4 py-2 text-sm font-semibold text-ink hover:bg-sand-100"
            >
              Maybe later
            </button>
            <button
              type="button"
              onClick={() => reviewSubmitMutation.mutate()}
              disabled={reviewSubmitMutation.isPending || reviewRating < 1}
              className="w-full rounded-lg bg-cobalt-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reviewSubmitMutation.isPending ? "Submitting..." : "Submit review"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(selectedReportOrder)}
        title="Report File Scam"
        onClose={() => {
          setReportOrderId(null);
          setScamReason("");
        }}
      >
        <div className="space-y-3">
          <p className="text-sm text-sand-700">
            Tell us what was wrong with <span className="font-semibold text-ink">{selectedReportOrder?.asset?.title ?? "this order"}</span>. The seller payout stays in escrow while this gets reviewed.
          </p>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-sand-600">Reason</span>
            <textarea
              value={scamReason}
              onChange={(event) => setScamReason(event.target.value)}
              rows={4}
              placeholder="Example: file format is wrong, asset is corrupt, preview does not match the download, or key layers are missing."
              className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setReportOrderId(null);
                setScamReason("");
              }}
              className="w-full rounded-lg border border-sand-300 px-4 py-2 text-sm font-semibold text-ink hover:bg-sand-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selectedReportOrder) {
                  return;
                }
                reportScamMutation.mutate({
                  orderId: selectedReportOrder.id,
                  reason: scamReason
                });
              }}
              disabled={reportScamMutation.isPending}
              className="w-full rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reportScamMutation.isPending ? "Submitting..." : "Submit report"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function statusChipClass(status: Order["status"]) {
  if (status === "paid") {
    return "rounded-full bg-forest-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-700";
  }
  if (status === "pending") {
    return "rounded-full bg-sunset-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sunset-700";
  }
  if (status === "failed") {
    return "rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700";
  }
  return "rounded-full bg-sand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700";
}

function escrowChipClass(status: Order["escrow_status"]) {
  if (status === "released") {
    return "rounded-full bg-forest-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-700";
  }
  if (status === "scam_reported") {
    return "rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700";
  }
  return "rounded-full bg-cobalt-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cobalt-700";
}

function escrowChipLabel(status: Order["escrow_status"]) {
  if (status === "released") {
    return "Released";
  }
  if (status === "scam_reported") {
    return "Reported";
  }
  return "In Escrow";
}

function statusDescription(order: Order) {
  if (order.status === "pending") {
    return "Payment initiated. We are waiting for confirmation from the payment provider.";
  }
  if (order.status === "failed") {
    return "Payment failed. Try purchasing again if you still want this listing.";
  }
  if (order.status === "refunded") {
    return "This order was refunded. Download access may be restricted.";
  }
  if (order.escrow_status === "scam_reported") {
    return "Payment cleared, but you flagged the file for review. The seller payout is still on hold.";
  }
  if (order.escrow_status === "released") {
    return "Payment cleared, the file was accepted, and the seller payout has been released.";
  }
  return "Payment cleared. Download the file, inspect it, then confirm it is genuine or report a scam within 24 hours.";
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsed);
}

function OrderStatCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "cobalt" | "forest" | "sunset" | "rose";
}) {
  const toneClass =
    tone === "cobalt"
      ? "border-cobalt-100 bg-cobalt-50"
      : tone === "forest"
        ? "border-forest-200 bg-forest-100/70"
        : tone === "sunset"
          ? "border-sunset-200 bg-sunset-100"
          : "border-rose-200 bg-rose-100/80";

  return (
    <article className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-600">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-ink">{value}</p>
    </article>
  );
}
