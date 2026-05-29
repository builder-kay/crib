import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AudioPreviewPlayer } from "@/components/AudioPreviewPlayer";
import { ImageGalleryModal } from "@/components/ImageGalleryModal";
import { Modal } from "@/components/Modal";
import { PriceTag } from "@/components/PriceTag";
import { SEO } from "@/components/SEO";
import { StarRating } from "@/components/StarRating";
import { useToast } from "@/components/Toast";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { getUserContactEmail } from "@/lib/auth";
import {
  addAssetToWishlist,
  createPayment,
  deleteAssetReview,
  followCreator,
  getAssetById,
  getCreatorFollowStats,
  getAssetReviews,
  getWishlistAssetIds,
  hasPaidOrderForAsset,
  removeAssetFromWishlist,
  trackAnalyticsEvent,
  unfollowCreator,
  upsertAssetReview
} from "@/lib/api";
import { getAssetAppLabel, getAssetDeliveryLabel, getAssetFormatLabel, getAssetPrimaryFilename, isAudioAsset } from "@/lib/assetCatalog";
import { formatDate, formatMajorCurrency } from "@/lib/format";
import { startPaystackCheckout } from "@/lib/paystack";
import { useAuthStore } from "@/store/authStore";

const AUDIO_LICENSE_COPY = {
  personal_use: {
    label: "Personal Use",
    terms: "For demos, practice sessions, and non-commercial personal projects."
  },
  commercial_use: {
    label: "Commercial Use",
    terms: "For monetized releases, client work, streaming, publishing, and performance."
  },
  exclusive_rights: {
    label: "Exclusive Rights",
    terms: "For buyers who want the beat removed from open licensing and reserved for their release."
  }
} as const;

export function AssetDetailPage() {
  const { id = "" } = useParams();
  const user = useAuthStore((state) => state.user);
  const userContactEmail = getUserContactEmail(user);
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [showPurchasedModal, setShowPurchasedModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const assetQuery = useQuery({
    queryKey: ["asset", id],
    queryFn: () => getAssetById(id),
    enabled: Boolean(id)
  });

  const previews = useMemo(() => assetQuery.data?.previews ?? [], [assetQuery.data]);
  const galleryImages = useMemo(() => {
    if (!assetQuery.data) {
      return [];
    }

    if (previews.length > 0) {
      return previews.map((preview, index) => ({
        src: preview.preview_url,
        alt: `${assetQuery.data!.title} preview ${index + 1}`
      }));
    }

    return [
      {
        src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
        alt: assetQuery.data.title
      }
    ];
  }, [assetQuery.data, previews]);

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
    queryKey: ["asset-paid-order", id, user?.id, userContactEmail],
    queryFn: () => hasPaidOrderForAsset(id, user!.id, userContactEmail),
    enabled: Boolean(id && user?.id)
  });

  const followStatsQuery = useQuery({
    queryKey: ["creator-follow-stats", assetQuery.data?.creator_id, user?.id],
    queryFn: () => getCreatorFollowStats(assetQuery.data!.creator_id, user?.id ?? null),
    enabled: Boolean(assetQuery.data?.creator_id)
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
    if (!assetQuery.data) {
      setCustomAmount("");
      return;
    }

    if (assetQuery.data.pricing_model === "free") {
      setCustomAmount("0");
      return;
    }

    const defaultAmount = Math.max(assetQuery.data.price_kobo, assetQuery.data.minimum_price_kobo) / 100;
    setCustomAmount(String(defaultAmount));
  }, [assetQuery.data]);

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
      actorEmail: userContactEmail,
      metadata: {
        page: "asset_detail"
      }
    });
  }, [assetQuery.data, user?.id, userContactEmail]);

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!assetQuery.data) {
        throw new Error("Listing is not loaded");
      }

      let amountKobo: number | undefined;
      if (assetQuery.data.pricing_model === "pay_what_you_want") {
        const parsedAmount = Number(customAmount);
        const minimumAmountMajor = assetQuery.data.minimum_price_kobo / 100;

        if (!Number.isFinite(parsedAmount)) {
          throw new Error(`Enter the amount you want to pay for this ${productLabel}.`);
        }

        if (parsedAmount < minimumAmountMajor) {
          throw new Error(`Amount must be at least ${formatMajorCurrency(minimumAmountMajor, assetQuery.data.currency)}.`);
        }

        amountKobo = Math.round(parsedAmount * 100);
      }

      return createPayment(assetQuery.data.id, {
        buyerEmailOverride: checkoutEmail.trim() || undefined,
        amountKobo
      });
    },
    onSuccess: async (payload) => {
      if (assetQuery.data) {
        void trackAnalyticsEvent({
          eventName: "checkout_start",
          assetId: assetQuery.data.id,
          creatorId: assetQuery.data.creator_id,
          orderId: payload.order_id,
          actorUserId: user?.id,
          actorEmail: userContactEmail ?? payload.email ?? (checkoutEmail.trim() || null),
          metadata: {
            page: "asset_detail"
          }
        });
      }

      if (payload.checkout_mode === "instant" || !payload.authorization_url) {
        pushToast("Template unlocked. Open Orders to access it and view your receipt.", "success");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["orders"] }),
          queryClient.invalidateQueries({ queryKey: ["asset-paid-order", id, user?.id, userContactEmail] })
        ]);
        navigate(ordersPath);
        return;
      }

      pushToast("Redirecting to secure payment...", "success");
      await startPaystackCheckout({
        authorizationUrl: payload.authorization_url,
        reference: payload.reference ?? "",
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
        setShowPurchasedModal(true);
        return;
      }

      if (paymentError.code === "own_asset") {
        pushToast("You cannot purchase your own listing.", "info");
        return;
      }

      if (paymentError.code === "creator_payout_unavailable") {
        pushToast("This creator has not configured payouts yet. Please try again later.", "info");
        return;
      }

      if (fallbackMessage.toLowerCase().includes("already purchased")) {
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
        throw new Error("Sign in to save listings.");
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

  const followMutation = useMutation({
    mutationFn: async (nextState: boolean) => {
      if (!user?.id || !assetQuery.data || user.id === assetQuery.data.creator_id) {
        throw new Error("You can only follow other creators.");
      }

      if (nextState) {
        await followCreator(user.id, assetQuery.data.creator_id);
      } else {
        await unfollowCreator(user.id, assetQuery.data.creator_id);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["creator-follow-stats", assetQuery.data?.creator_id] }),
        queryClient.invalidateQueries({ queryKey: ["creator-directory"] }),
        queryClient.invalidateQueries({ queryKey: ["market-assets"] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not update follow state.", "error");
    }
  });

  if (assetQuery.isLoading) {
    return <div className="surface-card p-6 text-sm text-sand-600">Loading listing...</div>;
  }

  if (assetQuery.isError || !assetQuery.data) {
    return (
      <div className="surface-card p-6">
        <h2 className="font-display text-xl font-semibold">Listing unavailable</h2>
        <p className="mt-2 text-sm text-sand-700">{assetQuery.error instanceof Error ? assetQuery.error.message : "Try another listing."}</p>
      </div>
    );
  }

  const asset = assetQuery.data;
  const audioListing = isAudioAsset(asset);
  const isOwnAsset = Boolean(user?.id) && user?.id === asset.creator_id;
  const alreadyPurchased = existingPurchaseQuery.data === true;
  const isFreeAsset = asset.pricing_model === "free";
  const isPayWhatYouWant = asset.pricing_model === "pay_what_you_want";
  const isExternalLinkDelivery = asset.delivery_mode === "external_link";
  const deliveryReviewLabel = isExternalLinkDelivery ? (audioListing ? "access link" : "template link") : "file";
  const deliveryPastAction = isExternalLinkDelivery ? "access it" : "download it";
  const purchaseAvailable = asset.status === "published" && !isOwnAsset && !alreadyPurchased;
  const canReview = Boolean(user?.id) && alreadyPurchased && !isOwnAsset;
  const minimumCheckoutAmountMajor = asset.minimum_price_kobo / 100;
  const suggestedCheckoutAmountMajor = Math.max(asset.price_kobo, asset.minimum_price_kobo) / 100;
  const typedCheckoutAmount = Number(customAmount);
  const normalizedCheckoutAmount = Number.isFinite(typedCheckoutAmount)
    ? Math.max(typedCheckoutAmount, minimumCheckoutAmountMajor)
    : suggestedCheckoutAmountMajor;
  const buyButtonLabel = paymentMutation.isPending
    ? "Processing..."
    : asset.status !== "published"
      ? "Not available"
      : isOwnAsset
        ? "Your listing"
        : alreadyPurchased
          ? "Purchased"
          : !user
            ? isFreeAsset
              ? "Sign in to claim"
              : "Sign in to buy"
            : isFreeAsset
              ? "Get free access"
              : isPayWhatYouWant
                ? "Continue to checkout"
                : "Buy now";
  const creatorName = asset.profile?.display_name ?? "Creator";
  const creatorSalesCount = Math.max(0, asset.profile?.sales_count ?? 0);
  const creatorSalesLabel = `${new Intl.NumberFormat("en-US").format(creatorSalesCount)} sales`;
  const creatorVerified = Boolean(asset.profile?.is_verified);
  const creatorCategory = asset.profile?.creator_category || asset.profile?.niche || "Creative Seller";
  const assetSoldCount = Math.max(0, asset.sold_count ?? 0);
  const assetSoldLabel = `${new Intl.NumberFormat("en-US").format(assetSoldCount)} sold`;
  const creatorFollowerCount = followStatsQuery.data?.followerCount ?? 0;
  const creatorFollowerLabel = `${new Intl.NumberFormat("en-US").format(creatorFollowerCount)} follower${creatorFollowerCount === 1 ? "" : "s"}`;
  const isFollowingCreator = followStatsQuery.data?.isFollowing ?? false;
  const checkoutContactEmail = userContactEmail ?? checkoutEmail.trim();
  const appLabel = getAssetAppLabel(asset);
  const formatLabel = getAssetFormatLabel(asset);
  const deliveryLabel = getAssetDeliveryLabel(asset);
  const primaryFileName = getAssetPrimaryFilename(asset);
  const ordersPath = user ? "/dashboard/orders" : `/auth?redirect=${encodeURIComponent("/dashboard/orders")}`;
  const creatorProfilePath = user
    ? `/profile/${asset.creator_id}`
    : `/auth?redirect=${encodeURIComponent(`/profile/${asset.creator_id}`)}`;
  const primaryPreview = galleryImages[0]?.src ?? "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80";
  const audioLicenses = asset.license_options ?? [];
  const productLabel = audioListing ? "audio pack" : "template";
  const productLabelPlural = audioListing ? "audio packs" : "templates";
  const unavailableReason =
    asset.status !== "published"
      ? "Only published listings can be purchased."
      : isOwnAsset
        ? "Creators cannot purchase their own listings."
        : `You already purchased this listing. Open Orders to ${deliveryPastAction}.`;
  const reviewCount = asset.review_count ?? 0;
  const averageRating = asset.average_rating ?? 0;
  const reviews = assetReviewsQuery.data ?? [];
  const isWishlisted = (wishlistQuery.data ?? []).includes(asset.id);
  const seoDescription =
    asset.description.trim() ||
    `${asset.title} is a ${asset.category} digital asset by ${creatorName} on Crib.`;
  const seoPrice = Math.max(asset.price_kobo, asset.minimum_price_kobo) / 100;

  return (
    <div className="space-y-4">
      <SEO
        title={`${asset.title} by ${creatorName} - Crib`}
        description={seoDescription.slice(0, 155)}
        path={`/asset/${asset.id}`}
        image={primaryPreview}
        type="product"
        noIndex={asset.status !== "published"}
        priority={1}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: asset.title,
          description: seoDescription,
          image: primaryPreview,
          category: asset.category,
          brand: {
            "@type": "Brand",
            name: "Crib"
          },
          offers: {
            "@type": "Offer",
            price: seoPrice.toFixed(2),
            priceCurrency: asset.currency,
            availability: asset.status === "published" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: `${window.location.origin}/asset/${asset.id}`
          },
          aggregateRating:
            reviewCount > 0
              ? {
                  "@type": "AggregateRating",
                  ratingValue: averageRating.toFixed(1),
                  reviewCount
                }
              : undefined
        }}
      />

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
            <button
              type="button"
              onClick={() => {
                setGalleryIndex(0);
                setGalleryOpen(true);
              }}
              className="group relative block w-full text-left"
            >
              <div className="aspect-[16/10] overflow-hidden bg-sand-100">
                <img src={primaryPreview} alt={asset.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
              </div>
              <div className="absolute bottom-4 right-4 rounded-full bg-cobalt-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white shadow-lg transition group-hover:bg-cobalt-700">
                Open gallery
              </div>
            </button>
          </div>

          {galleryImages.length > 1 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {galleryImages.slice(1).map((preview, index) => (
                <button
                  key={`${preview.src}-${index}`}
                  type="button"
                  onClick={() => {
                    setGalleryIndex(index + 1);
                    setGalleryOpen(true);
                  }}
                  className="group overflow-hidden rounded-xl border border-sand-200 bg-white text-left transition hover:border-cobalt-300 hover:shadow-md"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-sand-100">
                    <img src={preview.src} alt={preview.alt ?? asset.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {audioListing && asset.audio_preview_url ? <AudioPreviewPlayer src={asset.audio_preview_url} title={asset.title} /> : null}

          <article className="surface-card p-5 md:p-6">
            <h2 className="font-display text-xl font-semibold text-ink">About This Listing</h2>
            <p className="mt-3 text-sm leading-relaxed text-sand-700">{asset.description}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {(asset.tags ?? []).map((tag) => (
                <span key={tag} className="rounded-full border border-sand-200 bg-sand-100 px-3 py-1 text-xs font-medium text-sand-700">
                  #{tag}
                </span>
              ))}
            </div>

            {audioListing ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
                <section className="rounded-2xl border border-cobalt-100 bg-cobalt-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cobalt-700">Beat Metadata</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <MetaItem label="Genre" value={asset.audio_genre ?? "Not set"} preserveCase />
                    <MetaItem label="BPM" value={asset.audio_bpm ? `${asset.audio_bpm}` : "Not set"} preserveCase />
                    <MetaItem label="Key" value={asset.audio_key ?? "Not set"} preserveCase />
                  </div>
                </section>

                <section className="rounded-2xl border border-forest-100 bg-forest-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-forest-700">Buyer Delivery</p>
                  <p className="mt-3 text-sm leading-relaxed text-forest-900">
                    Buyers receive one ZIP bundle after purchase. Use the listing description above for the full breakdown of stems, project files, MIDI, and any extras packed inside.
                  </p>
                </section>
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 rounded-xl border border-sand-200 bg-sand-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-sand-500">Creator</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Link to={creatorProfilePath} className="inline-block text-sm font-semibold text-cobalt-700 hover:text-cobalt-800">
                    {creatorName}
                  </Link>
                  {creatorVerified ? <VerifiedBadge size="sm" /> : null}
                </div>
                <p className="mt-1 text-xs text-sand-600">
                  {creatorCategory} - {creatorSalesLabel} - {creatorFollowerLabel}
                </p>
              </div>
              <MetaItem label="Compatible App" value={appLabel} preserveCase />
              <MetaItem label="Primary Format" value={formatLabel} preserveCase />
              <MetaItem label="Delivery" value={deliveryLabel} preserveCase />
              <MetaItem label="Uploaded" value={formatDate(asset.created_at)} preserveCase />
              <MetaItem label="Sold" value={assetSoldLabel} preserveCase />
            </div>

            {primaryFileName ? (
              <div className="mt-3 rounded-xl border border-sand-200 bg-white px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-sand-500">Primary file</p>
                <p className="mt-1 break-all font-mono text-xs text-sand-700">{primaryFileName}</p>
              </div>
            ) : null}

            {audioListing && audioLicenses.length > 0 ? (
              <section className="mt-4 space-y-3 rounded-xl border border-sand-200 bg-white p-4">
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">Licensing Options</h3>
                  <p className="mt-1 text-sm text-sand-600">License terms are visible before purchase so buyers can choose the usage rights they need.</p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {audioLicenses.map((license) => {
                    const copy = AUDIO_LICENSE_COPY[license];
                    if (!copy) {
                      return null;
                    }

                    return (
                      <article key={license} className="rounded-xl border border-sand-200 bg-sand-50 p-3">
                        <p className="font-semibold text-ink">{copy.label}</p>
                        <p className="mt-2 text-sm text-sand-700">{copy.terms}</p>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

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
                    ? "Creators cannot review their own listing."
                    : user
                      ? "You can leave a review after purchasing this listing."
                      : "Sign in and purchase this listing to leave a review."}
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
            <span className="inline-flex items-center gap-1.5">
              <span>by</span>
              <Link to={creatorProfilePath} className="font-medium text-cobalt-700 hover:text-cobalt-800">
                {creatorName}
              </Link>
              {creatorVerified ? <VerifiedBadge size="sm" /> : null}
            </span>
          </p>
          <p className="mt-1 text-xs text-sand-600">
            {creatorCategory} - {creatorSalesLabel}
          </p>
          <p className="mt-2 text-xs text-sand-600">
            Compatible with {appLabel}. Delivered as {deliveryLabel.toLowerCase()}.
          </p>

          {audioListing ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {asset.audio_genre ? (
                <span className="rounded-full border border-cobalt-100 bg-cobalt-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cobalt-700">
                  {asset.audio_genre}
                </span>
              ) : null}
              {asset.audio_bpm ? (
                <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700">
                  {asset.audio_bpm} BPM
                </span>
              ) : null}
              {asset.audio_key ? (
                <span className="rounded-full border border-forest-100 bg-forest-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-700">
                  {asset.audio_key}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 flex items-center gap-2 text-sm text-sand-700">
            <StarRating value={averageRating} size="sm" />
            <span>{reviewCount > 0 ? `${averageRating.toFixed(1)}/5 (${reviewCount})` : "No reviews yet"}</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-cobalt-100 bg-cobalt-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cobalt-700">
              {assetSoldLabel}
            </span>
            <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700">
              {creatorFollowerLabel}
            </span>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <PriceTag amountKobo={asset.price_kobo} currency={asset.currency} pricingModel={asset.pricing_model} minimumPriceKobo={asset.minimum_price_kobo} className="text-base" />
            <span className="text-xs text-sand-500">Updated {formatDate(asset.created_at)}</span>
          </div>

          {isPayWhatYouWant ? (
            <div className="mt-3 rounded-2xl border border-sand-200 bg-sand-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sand-600">Choose your amount</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr),auto] sm:items-end">
                <label className="block">
                  <span className="block text-sm font-medium text-sand-800">Your checkout amount</span>
                  <input
                    value={customAmount}
                    onChange={(event) => setCustomAmount(event.target.value)}
                    type="number"
                    min={minimumCheckoutAmountMajor}
                    step="0.01"
                    className="mt-2 w-full rounded-xl border border-sand-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
                  />
                </label>
                <div className="rounded-xl border border-cobalt-100 bg-cobalt-50 px-3 py-2 text-sm font-semibold text-cobalt-700">
                  {formatMajorCurrency(normalizedCheckoutAmount, asset.currency)}
                </div>
              </div>
              <p className="mt-2 text-xs text-sand-600">
                Minimum {formatMajorCurrency(minimumCheckoutAmountMajor, asset.currency)}. Suggested {formatMajorCurrency(suggestedCheckoutAmountMajor, asset.currency)}.
              </p>
            </div>
          ) : isFreeAsset ? (
            <div className="mt-3 rounded-2xl border border-forest-100 bg-forest-50 p-4 text-sm text-forest-900">
              This {productLabel} is free to claim. We still create an order record and receipt so you can reopen it later from Orders.
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-cobalt-100 bg-cobalt-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cobalt-700">{isFreeAsset ? "Instant Access" : "Escrow Checkout"}</p>
            <p className="mt-2 text-sm text-cobalt-900">
              {isFreeAsset
                ? `Claiming this ${productLabel} adds it to your orders instantly so you can open the ${deliveryReviewLabel} and keep the receipt for later.`
                : `Payment unlocks your ${isExternalLinkDelivery ? "private access link" : "secure download"}, but the seller payout stays in escrow first. Open the ${deliveryReviewLabel}, make sure it matches the listing, then confirm it is genuine or report a scam from Orders.`}
            </p>
            {!isFreeAsset ? (
              <p className="mt-2 text-xs text-cobalt-900/80">
                If you do nothing for 24 hours after payment, we automatically treat the delivery as genuine and release the seller payout.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            disabled={paymentMutation.isPending || asset.status !== "published" || isOwnAsset || alreadyPurchased}
            onClick={() => {
              if (asset.status !== "published") {
                pushToast("This listing is not published yet.", "info");
                return;
              }
              if (isOwnAsset) {
                pushToast("You cannot purchase your own listing.", "info");
                return;
              }
              if (alreadyPurchased) {
                setShowPurchasedModal(true);
                return;
              }
              if (!user) {
                pushToast(
                  isFreeAsset ? `Sign in to claim ${productLabelPlural} and access your orders.` : `Sign in to buy ${productLabelPlural} and access your downloads.`,
                  "info"
                );
                navigate(`/auth?redirect=${encodeURIComponent(`/asset/${asset.id}`)}`);
                return;
              }
              if (!checkoutContactEmail) {
                pushToast("Add an email so we can issue your receipt and initialize checkout.", "info");
                return;
              }

              paymentMutation.mutate();
            }}
            className="mt-6 w-full rounded-full bg-cobalt-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {buyButtonLabel}
          </button>

          {user && !userContactEmail ? (
            <div className="mt-3 rounded-2xl border border-sand-200 bg-sand-50 p-3">
              <label htmlFor="checkoutEmail" className="block text-xs font-semibold uppercase tracking-[0.1em] text-sand-600">
                Checkout email
              </label>
              <input
                id="checkoutEmail"
                value={checkoutEmail}
                onChange={(event) => setCheckoutEmail(event.target.value)}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@example.com"
                className="mt-2 w-full rounded-xl border border-sand-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
              />
              <p className="mt-2 text-xs text-sand-500">Use a real email so we can issue receipts and complete any paid checkout. This does not change your sign-in method.</p>
            </div>
          ) : null}

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

          {!isOwnAsset ? (
            user ? (
              <button
                type="button"
                onClick={() => followMutation.mutate(!isFollowingCreator)}
                disabled={followMutation.isPending}
                className="mt-3 w-full rounded-full bg-cobalt-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {followMutation.isPending ? "Updating..." : isFollowingCreator ? "Following creator" : "Follow creator"}
              </button>
            ) : (
              <Link
                to={`/auth?redirect=${encodeURIComponent(`/asset/${asset.id}`)}`}
                className="mt-3 block w-full rounded-full bg-cobalt-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-cobalt-700"
              >
                Sign in to follow
              </Link>
            )
          ) : null}

          {purchaseAvailable && !user ? (
            <div className="mt-3 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5 text-xs text-sand-700">
              {isFreeAsset
                ? `Sign in to claim this ${productLabel} and keep it in your orders.`
                : `Sign in to buy this ${productLabel}, verify payment, and access creator profiles.`}
            </div>
          ) : null}

          {!purchaseAvailable ? (
            <div className="mt-3 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5 text-xs text-sand-700">{unavailableReason}</div>
          ) : null}

          <Link
            to={ordersPath}
            className="mt-4 block w-full rounded-full border border-sand-300 px-4 py-2.5 text-center text-sm font-semibold text-ink transition hover:bg-sand-100"
          >
            View Your Orders
          </Link>

          <p className="mt-3 text-center text-xs text-sand-500">
            {isFreeAsset ? `Free checkout still creates a receipt so you can reopen this ${deliveryReviewLabel} later.` : `Secure checkout via Paystack. ${isExternalLinkDelivery ? "Access link" : "Download"} unlocks after payment, and seller payout is released when you confirm the delivery or when the 24-hour review window closes with no scam report.`}
          </p>
        </aside>
      </div>

      <Modal open={showPurchasedModal} title="Already Purchased" onClose={() => setShowPurchasedModal(false)}>
        <div className="space-y-3">
          <p className="text-sm text-sand-700">
            You have already purchased <span className="font-semibold text-ink">{asset.title}</span>. Open your orders to
            {deliveryPastAction}.
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

      <ImageGalleryModal
        open={galleryOpen}
        title={asset.title}
        images={galleryImages}
        initialIndex={galleryIndex}
        onClose={() => setGalleryOpen(false)}
      />
    </div>
  );
}

function MetaItem({ label, value, preserveCase = false }: { label: string; value: string; preserveCase?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-sand-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold text-ink ${preserveCase ? "" : "capitalize"}`}>{value}</p>
    </div>
  );
}





