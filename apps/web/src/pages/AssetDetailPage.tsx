import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Modal } from "@/components/Modal";
import { PriceTag } from "@/components/PriceTag";
import { useToast } from "@/components/Toast";
import { createPayment, getAssetById, hasPaidOrderForAsset } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { startPaystackCheckout } from "@/lib/paystack";
import { useAuthStore } from "@/store/authStore";

export function AssetDetailPage() {
  const { id = "" } = useParams();
  const user = useAuthStore((state) => state.user);
  const { pushToast } = useToast();

  const [guestEmail, setGuestEmail] = useState("");
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showPurchasedModal, setShowPurchasedModal] = useState(false);

  const assetQuery = useQuery({
    queryKey: ["asset", id],
    queryFn: () => getAssetById(id),
    enabled: Boolean(id)
  });

  const previews = useMemo(() => assetQuery.data?.previews ?? [], [assetQuery.data]);

  const existingPurchaseQuery = useQuery({
    queryKey: ["asset-paid-order", id, user?.id, user?.email],
    queryFn: () => hasPaidOrderForAsset(id, user!.id, user?.email),
    enabled: Boolean(id && user?.id)
  });

  const paymentMutation = useMutation({
    mutationFn: async (email?: string) => {
      if (!assetQuery.data) {
        throw new Error("Asset is not loaded");
      }

      return createPayment(assetQuery.data.id, email);
    },
    onSuccess: (payload) => {
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

      if (fallbackMessage.toLowerCase().includes("already purchased")) {
        setShowGuestModal(false);
        setShowPurchasedModal(true);
        return;
      }

      pushToast(error instanceof Error ? error.message : "Payment failed", "error");
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
