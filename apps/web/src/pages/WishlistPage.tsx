import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AssetGrid } from "@/components/AssetGrid";
import { EmptyState } from "@/components/EmptyState";
import { getWishlistAssets } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export function WishlistPage() {
  const user = useAuthStore((state) => state.user);

  const wishlistQuery = useQuery({
    queryKey: ["wishlist-assets", user?.id],
    queryFn: () => getWishlistAssets(user!.id),
    enabled: Boolean(user?.id)
  });

  if (!user) {
    return (
      <EmptyState
        title="Sign in to use wishlist"
        body="Save interesting assets and come back when you are ready to purchase."
        action={
          <Link to="/auth" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">
            Sign in
          </Link>
        }
      />
    );
  }

  const assets = wishlistQuery.data ?? [];

  return (
    <div className="space-y-5">
      <header className="surface-card-vivid subtle-pattern p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-600">Saved Collection</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">Wishlist</h1>
        <p className="mt-2 text-sm text-sand-700 md:text-base">Keep a shortlist of assets and revisit them anytime.</p>
      </header>

      {wishlistQuery.isLoading ? <div className="surface-card p-5 text-sm text-sand-600">Loading wishlist...</div> : null}
      {wishlistQuery.isError ? (
        <div className="surface-card p-5 text-sm text-rose-700">
          {wishlistQuery.error instanceof Error ? wishlistQuery.error.message : "Could not load wishlist."}
        </div>
      ) : null}

      {!wishlistQuery.isLoading && assets.length === 0 ? (
        <EmptyState
          title="Wishlist is empty"
          body="Save assets from the marketplace to build your shortlist."
          action={
            <Link to="/market" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">
              Browse marketplace
            </Link>
          }
        />
      ) : null}

      {assets.length > 0 ? <AssetGrid assets={assets} /> : null}
    </div>
  );
}
