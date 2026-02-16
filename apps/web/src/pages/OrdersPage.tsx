import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { PriceTag } from "@/components/PriceTag";
import { StarRating } from "@/components/StarRating";
import { useToast } from "@/components/Toast";
import { generateDownload, getBuyerOrders, getReviewedAssetIdsForUser, upsertAssetReview, verifyPayment } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useAuthStore } from "@/store/authStore";

export function OrdersPage() {
  const initialized = useAuthStore((state) => state.initialized);
  const user = useAuthStore((state) => state.user);
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const verifiedReferenceRef = useRef<string | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [suppressedPromptOrderIds, setSuppressedPromptOrderIds] = useState<string[]>([]);

  const token = params.get("token") ?? "";
  const reference = params.get("reference") ?? "";

  const ordersQuery = useQuery({
    queryKey: ["orders", user?.id, user?.email, token],
    queryFn: () =>
      getBuyerOrders({
        userId: user?.id,
        emailToken: token || undefined
      }),
    enabled: initialized && Boolean(user?.id || token)
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyPayment(reference, token || undefined),
    onSuccess: async (payload) => {
      if (payload.order_status === "paid") {
        pushToast("Payment verified and order marked as paid", "success");
      } else if (payload.order_status === "pending") {
        pushToast("Payment received, verification still pending", "info");
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
    if (!reference || !initialized) {
      return;
    }

    if (verifiedReferenceRef.current === reference) {
      return;
    }

    verifiedReferenceRef.current = reference;
    verifyMutation.mutate();
  }, [reference, initialized, verifyMutation]);

  const headline = useMemo(() => {
    if (reference) {
      return "Payment received. If verification is complete, your order appears below.";
    }
    return "Your purchases and secure download links.";
  }, [reference]);

  const orders = ordersQuery.data ?? [];
  const paidOrdersWithAssets = useMemo(
    () => orders.filter((order) => order.status === "paid" && Boolean(order.asset?.id)),
    [orders]
  );
  const paidAssetIds = useMemo(
    () => Array.from(new Set(paidOrdersWithAssets.map((order) => order.asset!.id))),
    [paidOrdersWithAssets]
  );

  const reviewedAssetIdsQuery = useQuery({
    queryKey: ["reviewed-asset-ids", user?.id, paidAssetIds],
    queryFn: () => getReviewedAssetIdsForUser(user!.id, paidAssetIds),
    enabled: Boolean(user?.id && paidAssetIds.length > 0)
  });

  const reviewedAssetIdsSet = useMemo(() => new Set(reviewedAssetIdsQuery.data ?? []), [reviewedAssetIdsQuery.data]);

  const reviewPromptOrder = useMemo(() => {
    if (!user?.id || paidOrdersWithAssets.length === 0 || reviewedAssetIdsQuery.isLoading) {
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
      paidOrdersWithAssets.find(
        (order) =>
          !reviewedAssetIdsSet.has(order.asset!.id) &&
          !dismissedOrderIds.has(order.id) &&
          !suppressedPromptOrderIds.includes(order.id)
      ) ?? null
    );
  }, [paidOrdersWithAssets, reviewedAssetIdsQuery.isLoading, reviewedAssetIdsSet, suppressedPromptOrderIds, user?.id]);

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
        throw new Error("No asset selected for review.");
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

  const selectedReviewOrder = useMemo(
    () => orders.find((order) => order.id === reviewOrderId) ?? null,
    [orders, reviewOrderId]
  );

  function dismissReviewPrompt() {
    if (!user?.id || !reviewOrderId) {
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

    setReviewModalOpen(false);
  }

  const orderSummary = useMemo(() => {
    const summary = { total: 0, paid: 0, pending: 0, failed: 0, refunded: 0 };

    for (const order of orders) {
      summary.total += 1;
      summary[order.status] += 1;
    }

    return summary;
  }, [orders]);

  if (!initialized) {
    return <div className="surface-card p-5 text-sm text-sand-600">Loading orders...</div>;
  }

  if (!user && !token) {
    return (
      <EmptyState
        title="No order access yet"
        body="Sign in to view your orders, or open your email-link order token URL."
        action={<Link to="/auth" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">Sign in</Link>}
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
            <OrderStatCard label="Paid" value={String(orderSummary.paid)} tone="forest" />
            <OrderStatCard label="Pending" value={String(orderSummary.pending)} tone="sunset" />
            <OrderStatCard label="Failed/Refunded" value={String(orderSummary.failed + orderSummary.refunded)} tone="sand" />
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
                ? "Verification complete. Your order status was updated."
                : "We received your payment callback. If your order is still pending, refresh shortly."}
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
          body="After your first purchase, paid downloads show up here."
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

          return (
            <article key={order.id} className="surface-card overflow-hidden">
              <div className="grid gap-0 md:grid-cols-[220px,1fr]">
                <div className="relative min-h-36 overflow-hidden bg-sand-100">
                  {previewUrl ? (
                    <img src={previewUrl} alt={order.asset?.title ?? "Asset preview"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-sm font-semibold uppercase tracking-wide text-sand-500">
                      No preview
                    </div>
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink">
                    {order.asset?.category ?? "Asset"}
                  </span>
                </div>

                <div className="p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-ink">{order.asset?.title ?? "Asset"}</h3>
                      <p className="mt-1 text-xs text-sand-600">
                        Order #{order.id.slice(0, 8)} - {formatDate(order.created_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <PriceTag amountKobo={order.amount_kobo} currency={order.currency} />
                      <span className={statusChipClass(order.status)}>{order.status}</span>
                    </div>
                  </div>

                  <p className="mt-2 text-sm text-sand-700">{statusDescription(order.status)}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={!canDownload}
                      onClick={async () => {
                        try {
                          const payload = await generateDownload(order.id, token || undefined);
                          const link = document.createElement("a");
                          link.href = payload.url;
                          link.download = payload.filename || "asset";
                          link.rel = "noopener noreferrer";
                          document.body.appendChild(link);
                          link.click();
                          link.remove();
                          pushToast("Download link generated", "success");
                        } catch (error) {
                          pushToast(error instanceof Error ? error.message : "Download failed", "error");
                        }
                      }}
                      className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:bg-sand-300"
                    >
                      {canDownload ? "Download" : "Locked"}
                    </button>

                    {!canDownload ? <p className="text-xs text-sand-600">Download unlocks after payment confirmation.</p> : null}
                  </div>
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
            How was <span className="font-semibold text-ink">{selectedReviewOrder?.asset?.title ?? "this asset"}</span>?
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
    </div>
  );
}

function statusChipClass(status: "pending" | "paid" | "failed" | "refunded") {
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

function statusDescription(status: "pending" | "paid" | "failed" | "refunded") {
  if (status === "paid") {
    return "Payment confirmed. Your download is available.";
  }
  if (status === "pending") {
    return "Payment initiated. We are waiting for confirmation from the payment provider.";
  }
  if (status === "failed") {
    return "Payment failed. Try purchasing again if you still want this asset.";
  }
  return "This order was refunded. Download access may be restricted.";
}

function OrderStatCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "cobalt" | "forest" | "sunset" | "sand";
}) {
  const toneClass =
    tone === "cobalt"
      ? "border-cobalt-100 bg-cobalt-50"
      : tone === "forest"
        ? "border-forest-200 bg-forest-100/70"
        : tone === "sunset"
          ? "border-sunset-200 bg-sunset-100"
          : "border-sand-200 bg-sand-100";

  return (
    <article className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-600">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-ink">{value}</p>
    </article>
  );
}
