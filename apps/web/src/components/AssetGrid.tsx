import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AssetCard } from "@/components/AssetCard";
import { useToast } from "@/components/Toast";
import { addAssetToWishlist, getWishlistAssetIds, removeAssetFromWishlist } from "@/lib/api";
import type { Asset } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

type AssetGridProps = {
  assets: Asset[];
};

export function AssetGrid({ assets }: AssetGridProps) {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const wishlistQuery = useQuery({
    queryKey: ["wishlist-ids", user?.id],
    queryFn: () => getWishlistAssetIds(user!.id),
    enabled: Boolean(user?.id)
  });

  const wishlistedIds = useMemo(() => new Set(wishlistQuery.data ?? []), [wishlistQuery.data]);

  const wishlistMutation = useMutation({
    mutationFn: async ({ assetId, nextState }: { assetId: string; nextState: boolean }) => {
      if (!user?.id) {
        throw new Error("Sign in to use wishlist.");
      }

      if (nextState) {
        await addAssetToWishlist(user.id, assetId);
      } else {
        await removeAssetFromWishlist(user.id, assetId);
      }
    },
    onMutate: async ({ assetId, nextState }) => {
      if (!user?.id) {
        return;
      }

      await queryClient.cancelQueries({ queryKey: ["wishlist-ids", user.id] });
      const previous = queryClient.getQueryData<string[]>(["wishlist-ids", user.id]) ?? [];

      const next = nextState ? Array.from(new Set([...previous, assetId])) : previous.filter((id) => id !== assetId);
      queryClient.setQueryData(["wishlist-ids", user.id], next);

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (user?.id && context?.previous) {
        queryClient.setQueryData(["wishlist-ids", user.id], context.previous);
      }

      pushToast(error instanceof Error ? error.message : "Could not update wishlist.", "error");
    },
    onSettled: async () => {
      if (!user?.id) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["wishlist-ids", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["wishlist-assets", user.id] })
      ]);
    }
  });

  function handleToggleWishlist(assetId: string, nextState: boolean) {
    if (!user?.id) {
      pushToast("Sign in to save assets.", "info");
      navigate("/auth");
      return;
    }

    wishlistMutation.mutate({ assetId, nextState });
  }

  return (
    <section className="grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          isWishlisted={wishlistedIds.has(asset.id)}
          onToggleWishlist={handleToggleWishlist}
        />
      ))}
    </section>
  );
}
