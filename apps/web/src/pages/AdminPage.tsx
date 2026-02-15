import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/components/EmptyState";
import { PriceTag } from "@/components/PriceTag";
import { useToast } from "@/components/Toast";
import { getAdminAssets, isCurrentUserAdmin, updateAssetStatus } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export function AdminPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const adminQuery = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: () => isCurrentUserAdmin(user!.id),
    enabled: Boolean(user?.id)
  });

  const assetsQuery = useQuery({
    queryKey: ["admin-assets"],
    queryFn: getAdminAssets,
    enabled: adminQuery.data === true
  });

  const statusMutation = useMutation({
    mutationFn: ({ assetId, status }: { assetId: string; status: "draft" | "published" | "archived" }) =>
      updateAssetStatus(assetId, status),
    onSuccess: async () => {
      pushToast("Asset status updated", "success");
      await queryClient.invalidateQueries({ queryKey: ["admin-assets"] });
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Update failed", "error");
    }
  });

  if (adminQuery.isLoading) {
    return <div className="surface-card p-5 text-sm text-sand-600">Checking admin permissions...</div>;
  }

  if (adminQuery.data !== true) {
    return <EmptyState title="Admin only" body="Your account is not currently assigned for moderation access." />;
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-3xl font-bold">Moderation</h1>
        <p className="mt-1 text-sm text-sand-700">Review listings and update publish status.</p>
      </header>

      {assetsQuery.isLoading ? <div className="surface-card p-5 text-sm text-sand-600">Loading assets...</div> : null}
      {assetsQuery.isError ? <div className="surface-card p-5 text-sm text-rose-700">Unable to load assets.</div> : null}

      {assetsQuery.data && assetsQuery.data.length === 0 ? (
        <EmptyState title="No assets yet" body="Assets will appear here when creators upload listings." />
      ) : null}

      <section className="space-y-3">
        {assetsQuery.data?.map((asset) => (
          <article key={asset.id} className="surface-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-ink">{asset.title}</h3>
                <p className="text-sm text-sand-600">{asset.profile?.display_name ?? "Creator"}</p>
              </div>

              <PriceTag amountKobo={asset.price_kobo} currency={asset.currency} />
            </div>

            <div className="mt-4 flex items-center gap-2">
              <select
                defaultValue={asset.status}
                onChange={(event) =>
                  statusMutation.mutate({
                    assetId: asset.id,
                    status: event.target.value as "draft" | "published" | "archived"
                  })
                }
                className="rounded-lg border border-sand-300 px-3 py-2 text-sm outline-none"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>

              <span className="rounded-full bg-sand-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-sand-700">
                {asset.category}
              </span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
