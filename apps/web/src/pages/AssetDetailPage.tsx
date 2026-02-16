import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Modal } from "@/components/Modal";
import { PriceTag } from "@/components/PriceTag";
import { StarRating } from "@/components/StarRating";
import { useToast } from "@/components/Toast";
import {
  addAssetToWishlist,
  createPayment,
  deleteAssetReview,
  getAssetById,
  getAssetReviews,
  getWishlistAssetIds,
  hasPaidOrderForAsset,
  removeAssetFromWishlist,
  trackAnalyticsEvent,
  upsertAssetReview
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import { startPaystackCheckout } from "@/lib/paystack";
import { useAuthStore } from "@/store/authStore";

export function AssetDetailPage() {
  const { id = "" } = useParams();
  const user = useAuthStore((state) => state.user);
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [guestEmail, setGuestEmail] = useState("");
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showPurchasedModal, setShowPurchasedModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");

  const assetQuery = useQuery({
    queryKey: ["asset", id],
    queryFn: () => getAssetById(id),
    enabled: Boolean(id)
  });

  const previews = useMemo(() => assetQuery.data?.previews ?? [], [assetQuery.data]);

  const assetReviewsQuery = useQuery({
    queryKey: ["asset-reviews", id],
    queryFn: () => getAssetReviews(id),
    enabled: Boolean(id)
  });

  const wishlistQuery = useQuery({
    queryKey: ["wishlist-ids", user?.id],
    queryFn: () => getWishlistAssetIds(user!.id),
    enabled: Boolean(user?.id)
  });

  const existingPurchaseQuery = useQuery({
    queryKey: ["asset-paid-order", id, user?.id, user?.email],
    queryFn: () => hasPaidOrderForAsset(id, user!.id, user?.email),
    enabled: Boolean(id && user?.id)
  });

  const existingUserReview = useMemo(() => {
    if (!user?.id) {
      return null;
    }
    return (assetReviewsQuery.data ?? []).find((review) => review.reviewer_id === user.id) ?? null;
  }, [assetReviewsQuery.data, user?.id]);

  useEffect(() => {
    if (existingUserReview) {
      setReviewRating(existingUserReview.rating);
      setReviewText(existingUserReview.review_text);
      return;
    }

    setReviewRating(5);
    setReviewText("");
  }, [existingUserReview, user?.id]);

  useEffect(() => {
    if (!assetQuery.data || typeof window === "undefined") {
      return;
    }

    const storageKey = "crib.analytics.asset_detail_views";
    const entryKey = `${assetQuery.data.id}:detail-view`;
    const existing = window.sessionStorage.getItem(storageKey);
    let parsed: string[] = [];
    if (existing) {
      try {
        const value = JSON.parse(existing) as unknown;
        if (Array.isArray(value)) {
          parsed = value.filter((entry): entry is string => typeof entry === "string");
        }
      } catch {
        parsed = [];
      }
    }

    const seen = new Set(parsed);

    if (seen.has(entryKey)) {
      return;
    }

    seen.add(entryKey);
    window.sessionStorage.setItem(storageKey, JSON.stringify(Array.from(seen)));

    void trackAnalyticsEvent({
      eventName: "asset_view",
      assetId: assetQuery.data.id,
      creatorId: assetQuery.data.creator_id,
      actorUserId: user?.id,
      actorEmail: user?.email,
      metadata: {
        page: "asset_detail"
      }
    });
  }, [assetQuery.data, user?.email, user?.id]);

  const paymentMutation = useMutation({
    mutationFn: async (email?: string) => {
      if (!assetQuery.data) {
        throw new Error("Asset is not loaded");
      }

      return createPayment(assetQuery.data.id, email);
    },
    onSuccess: (payload) => {
      if (assetQuery.data) {
        void trackAnalyticsEvent({
          eventName: "checkout_start",
          assetId: assetQuery.data.id,
          creatorId: assetQuery.data.creator_id,
          orderId: payload.order_id,
          actorUserId: user?.id,
          actorEmail: user?.email ?? payload.email ?? null,
          metadata: {
            page: "asset_detail"
          }
        });
      }

      pushToast("Redirecting to secure payment...", "success");
      void startPaystackCheckout({
        authorizationUrl: payload.authorization_url,
        reference: payload.reference,
        email: payload.email,
        amountKobo: payload.amount_kobo,
        currency: payload.currency,
        publicKey: payload.public_key
      });
    },
    onError: (error) => {
      const paymentError = error as Error & { code?: string };
      const fallbackMessage = error instanceof Error ? error.message : "Payment failed";

      if (paymentError.code === "already_purchased") {
        setShowGuestModal(false);
        setShowPurchasedModal(true);
        return;
      }

      if (paymentError.code === "own_asset") {
        pushToast("You cannot purchase your own asset.", "info");
        return;
      }

      if (paymentError.code === "creator_payout_unavailable") {
        pushToast("This creator has not configured payouts yet. Please try again later.", "info");
        return;
      }

      if (fallbackMessage.toLowerCase().includes("already purchased")) {
        setShowGuestModal(false);
        setShowPurchasedModal(true);
        return;
      }

      pushToast(error instanceof Error ? error.message : "Payment failed", "error");
    }
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !assetQuery.data) {
        throw new Error("Sign in to leave a review.");
      }

      if (!Number.isFinite(reviewRating) || reviewRating < 1 || reviewRating > 5) {
        throw new Error("Choose a rating from 1 to 5 stars.");
      }

      return upsertAssetReview({
        userId: user.id,
        assetId: assetQuery.data.id,
        rating: reviewRating,
        reviewText
      });
    },
    onSuccess: async () => {
      pushToast(existingUserReview ? "Review updated." : "Review submitted.", "success");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["asset", id] }),
        queryClient.invalidateQueries({ queryKey: ["asset-reviews", id] }),
        queryClient.invalidateQueries({ queryKey: ["market-assets"] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not save review.", "error");
    }
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !existingUserReview) {
        throw new Error("No review to delete.");
      }

      await deleteAssetReview(existingUserReview.id, user.id);
    },
    onSuccess: async () => {
      setReviewRating(5);
      setReviewText("");
      pushToast("Review removed.", "success");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["asset", id] }),
        queryClient.invalidateQueries({ queryKey: ["asset-reviews", id] }),
        queryClient.invalidateQueries({ queryKey: ["market-assets"] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not remove review.", "error");
    }
  });

  const wishlistMutation = useMutation({
    mutationFn: async (nextState: boolean) => {
      if (!user?.id || !assetQuery.data) {
        throw new Error("Sign in to save assets.");
      }

      if (nextState) {
        await addAssetToWishlist(user.id, assetQuery.data.id);
      } else {
        await removeAssetFromWishlist(user.id, assetQuery.data.id);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["wishlist-ids", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["wishlist-assets", user?.id] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not update wishlist.", "error");
    }
  });

  if (assetQuery.isLoading) {
    return <div className="surface-card p-6 text-sm text-sand-600">Loading asset...</div>;
  }

  if (assetQuery.isError || !assetQuery.data) {
    return (
      <div className="surface-card p-6">
        <h2 className="font-display text-xl font-semibold">Asset unavailable</h2>
        <p className="mt-2 text-sm text-sand-700">{assetQuery.error instanceof Error ? assetQuery.error.message : "Try another asset."}</p>
      </div>
    );
  }

  const asset = assetQuery.data;
  const isOwnAsset = Boolean(user?.id) && user?.id === asset.creator_id;
  const alreadyPurchased = existingPurchaseQuery.data === true;
  const canPurchase = asset.status === "published" && !isOwnAsset && !alreadyPurchased;
  const canReview = Boolean(user?.id) && alreadyPurchased && !isOwnAsset;
  const buyButtonLabel = paymentMutation.isPending
    ? "Processing..."
    : asset.status !== "published"
      ? "Not available"
      : isOwnAsset
        ? "Your asset"
        : alreadyPurchased
          ? "Purchased"
          : "Buy now";
  const creatorName = asset.profile?.display_name ?? "Creator";
  const creatorSalesCount = Math.max(0, asset.profile?.sales_count ?? 0);
  const creatorSalesLabel = `${new Intl.NumberFormat("en-US").format(creatorSalesCount)} sales`;
  const creatorVerified = Boolean(asset.profile?.is_verified);
  const creatorCategory = asset.profile?.creator_category || asset.profile?.niche || "Creative";
  const ordersPath = user ? "/dashboard/orders" : "/orders";
  const primaryPreview =
    previews[0]?.preview_url ?? "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80";
  const unavailableReason =
    asset.status !== "published"
      ? "Only published assets can be purchased."
      : isOwnAsset
        ? "Creators cannot purchase their own assets."
        : "You already purchased this asset. Open Orders to download it.";
  const reviewCount = asset.review_count ?? 0;
  const averageRating = asset.average_rating ?? 0;
  const reviews = assetReviewsQuery.data ?? [];
  const isWishlisted = (wishlistQuery.data ?? []).includes(asset.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-sand-600">
        <Link to="/market" className="hover:text-cobalt-700">
          Discover
        </Link>
        <span>/</span>
        <span className="text-cobalt-700">{asset.category}</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),360px]">
        <section className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white">
            <div className="aspect-[16/10] overflow-hidden bg-sand-100">
              <img src={primaryPreview} alt={asset.title} className="h-full w-full object-cover" />
            </div>
          </div>

          {previews.length > 1 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {previews.slice(1, 7).map((preview) => (
                <div key={preview.id} className="overflow-hidden rounded-xl border border-sand-200 bg-white">
                  <div className="aspect-[4/3] overflow-hidden bg-sand-100">
                    <img src={preview.preview_url} alt={asset.title} className="h-full w-full object-cover" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <article className="surface-card p-5 md:p-6">
            <h2 className="font-display text-xl font-semibold text-ink">About This Project</h2>
            <p className="mt-3 text-sm leading-relaxed text-sand-700">{asset.description}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {(asset.tags ?? []).map((tag) => (
                <span key={tag} className="rounded-full border border-sand-200 bg-sand-100 px-3 py-1 text-xs font-medium text-sand-700">
                  #{tag}
                </span>
              ))}
            </div>

            <div className="mt-5 grid gap-3 rounded-xl border border-sand-200 bg-sand-50 p-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-sand-500">Creator</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Link to={`/profile/${asset.creator_id}`} className="inline-block text-sm font-semibold text-cobalt-700 hover:text-cobalt-800">
                    {creatorName}
                  </Link>
                  {creatorVerified ? (
                    <span className="rounded-full bg-forest-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-forest-700">
                      Verified
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-sand-600">
                  {creatorCategory} - {creatorSalesLabel}
                </p>
              </div>
              <MetaItem label="Uploaded" value={formatDate(asset.created_at)} />
              <MetaItem label="Status" value={asset.status} />
            </div>

            <section className="mt-6 space-y-4 rounded-xl border border-sand-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">Ratings and Reviews</h3>
                  <div className="mt-1 flex items-center gap-2 text-sm text-sand-700">
                    <StarRating value={averageRating} />
                    <span>
                      {reviewCount > 0
                        ? `${averageRating.toFixed(1)}/5 from ${reviewCount} review${reviewCount === 1 ? "" : "s"}`
                        : "No reviews yet"}
                    </span>
                  </div>
                </div>
              </div>

              {canReview ? (
                <form
                  className="space-y-3 rounded-xl border border-sand-200 bg-sand-50 p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    reviewMutation.mutate();
                  }}
                >
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-sand-600">Your rating</label>
                  <StarRating value={reviewRating} onChange={setReviewRating} />

                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-sand-600">Your review</label>
                  <textarea
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                    rows={3}
                    placeholder="Share what you liked, how you used it, and who it is good for."
                    className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={reviewMutation.isPending}
                      className="rounded-full bg-cobalt-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {reviewMutation.isPending ? "Saving..." : existingUserReview ? "Update review" : "Submit review"}
                    </button>

                    {existingUserReview ? (
                      <button
                        type="button"
                        onClick={() => deleteReviewMutation.mutate()}
                        disabled={deleteReviewMutation.isPending}
                        className="rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deleteReviewMutation.isPending ? "Removing..." : "Delete review"}
                      </button>
                    ) : null}
                  </div>
                </form>
              ) : (
                <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs text-sand-700">
                  {isOwnAsset
                    ? "Creators cannot review their own asset."
                    : user
                      ? "You can leave a review after purchasing this asset."
                      : "Sign in and purchase this asset to leave a review."}
                </div>
              )}

              {assetReviewsQuery.isLoading ? <p className="text-sm text-sand-600">Loading reviews...</p> : null}
              {!assetReviewsQuery.isLoading && reviews.length === 0 ? <p className="text-sm text-sand-600">No reviews yet.</p> : null}

              <div className="space-y-3">
                {reviews.slice(0, 8).map((review) => (
                  <article key={review.id} className="rounded-xl border border-sand-200 bg-white px-3 py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink">{review.reviewer?.display_name ?? "Buyer"}</p>
                        <p className="text-xs text-sand-500">{formatDate(review.created_at)}</p>
                      </div>
                      <StarRating value={review.rating} size="sm" />
                    </div>
                    {review.review_text ? <p className="mt-2 text-sm text-sand-700">{review.review_text}</p> : null}
                  </article>
                ))}
              </div>
            </section>
          </article>
        </section>

        <aside className="surface-card h-fit p-5 xl:sticky xl:top-24">
          <span className="inline-flex rounded-full bg-cobalt-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cobalt-700">
            {asset.category}
          </span>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-ink">{asset.title}</h1>
          <p className="mt-2 text-sm text-sand-700">
            by{" "}
            <Link to={`/profile/${asset.creator_id}`} className="font-medium text-cobalt-700 hover:text-cobalt-800">
              {creatorName}
            </Link>
            {creatorVerified ? <span className="ml-1 text-xs font-semibold uppercase tracking-wide text-forest-700">Verified</span> : null}
          </p>
          <p className="mt-1 text-xs text-sand-600">
            {creatorCategory} - {creatorSalesLabel}
          </p>

          <div className="mt-3 flex items-center gap-2 text-sm text-sand-700">
            <StarRating value={averageRating} size="sm" />
            <span>{reviewCount > 0 ? `${averageRating.toFixed(1)}/5 (${reviewCount})` : "No reviews yet"}</span>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <PriceTag amountKobo={asset.price_kobo} currency={asset.currency} className="text-base" />
            <span className="text-xs text-sand-500">Updated {formatDate(asset.created_at)}</span>
          </div>

          <button
            type="button"
            disabled={paymentMutation.isPending || !canPurchase}
            onClick={() => {
              if (!canPurchase) {
                if (asset.status !== "published") {
                  pushToast("This asset is not published yet.", "info");
                  return;
                }
                if (isOwnAsset) {
                  pushToast("You cannot purchase your own asset.", "info");
                  return;
                }
                if (alreadyPurchased) {
                  setShowPurchasedModal(true);
                  return;
                }
              }

              if (user?.email) {
                paymentMutation.mutate(user.email);
                return;
              }
              setShowGuestModal(true);
            }}
            className="mt-6 w-full rounded-full bg-cobalt-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {buyButtonLabel}
          </button>

          {user ? (
            <button
              type="button"
              onClick={() => wishlistMutation.mutate(!isWishlisted)}
              disabled={wishlistMutation.isPending}
              className="mt-3 w-full rounded-full border border-sand-300 px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {wishlistMutation.isPending ? "Saving..." : isWishlisted ? "Saved to wishlist" : "Save for later"}
            </button>
          ) : (
            <Link
              to="/auth"
              className="mt-3 block w-full rounded-full border border-sand-300 px-4 py-2.5 text-center text-sm font-semibold text-ink transition hover:bg-sand-100"
            >
              Sign in to save
            </Link>
          )}

          {!canPurchase ? (
            <div className="mt-3 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5 text-xs text-sand-700">{unavailableReason}</div>
          ) : null}

          <Link
            to={ordersPath}
            className="mt-4 block w-full rounded-full border border-sand-300 px-4 py-2.5 text-center text-sm font-semibold text-ink transition hover:bg-sand-100"
          >
            View Your Orders
          </Link>

          <p className="mt-3 text-center text-xs text-sand-500">
            Secure checkout via Paystack. Download unlocks after successful payment.
          </p>
        </aside>
      </div>

      <Modal open={showGuestModal} title="Continue as guest" onClose={() => setShowGuestModal(false)}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            paymentMutation.mutate(guestEmail);
          }}
        >
          <label className="block text-sm font-medium text-sand-800">Email</label>
          <input
            value={guestEmail}
            onChange={(event) => setGuestEmail(event.target.value)}
            type="email"
            required
            className="w-full rounded-xl border border-sand-300 px-3 py-2.5 outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
          />
          <button
            type="submit"
            className="w-full rounded-full bg-cobalt-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cobalt-700"
            disabled={paymentMutation.isPending}
          >
            {paymentMutation.isPending ? "Starting checkout..." : "Proceed to Paystack"}
          </button>
        </form>
      </Modal>

      <Modal open={showPurchasedModal} title="Already Purchased" onClose={() => setShowPurchasedModal(false)}>
        <div className="space-y-3">
          <p className="text-sm text-sand-700">
            You have already purchased <span className="font-semibold text-ink">{asset.title}</span>. Open your orders to
            download it.
          </p>
          <Link
            to={ordersPath}
            className="block w-full rounded-full bg-cobalt-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-cobalt-700"
            onClick={() => setShowPurchasedModal(false)}
          >
            Go to Orders
          </Link>
        </div>
      </Modal>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-sand-500">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize text-ink">{value}</p>
    </div>
  );
}
