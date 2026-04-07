import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/Toast";
import { reviewCreatorVerificationRequest } from "@/lib/api";
import { describeProfileVerificationField } from "@/lib/profileVerification";
import { EmptyState } from "@/components/EmptyState";
import { CreatorCard, SectionHeader, useAdminWorkspace } from "@/pages/admin/AdminWorkspace";

export function AdminCreatorsPage() {
  const { creators, creatorsLoading } = useAdminWorkspace();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [creatorSearch, setCreatorSearch] = useState("");

  const creatorSummary = useMemo(
    () =>
      creators.reduce(
        (summary, creator) => {
          summary.total += 1;
          if (creator.is_verified) {
            summary.verified += 1;
          }

          if (creator.verification_request?.status === "pending") {
            summary.pendingVerification += 1;
          }

          if (creator.seller_account_status === "warned") {
            summary.warned += 1;
          } else if (creator.seller_account_status === "suspended") {
            summary.suspended += 1;
          } else {
            summary.active += 1;
          }

          if (creator.payout_account) {
            summary.payoutReady += 1;
          }

          return summary;
        },
        { total: 0, active: 0, warned: 0, suspended: 0, payoutReady: 0, pendingVerification: 0, verified: 0 }
      ),
    [creators]
  );

  const reviewVerificationMutation = useMutation({
    mutationFn: ({ creatorId, decision }: { creatorId: string; decision: "approve" | "reject" }) =>
      reviewCreatorVerificationRequest(creatorId, decision),
    onSuccess: async (_, variables) => {
      pushToast(variables.decision === "approve" ? "Creator verified." : "Verification request rejected.", "success");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-creators"] }),
        queryClient.invalidateQueries({ queryKey: ["creator-directory"] }),
        queryClient.invalidateQueries({ queryKey: ["market-assets"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-assets"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not review verification.", "error");
    }
  });

  const filteredCreators = useMemo(() => {
    const query = creatorSearch.trim().toLowerCase();
    const next = creators.filter((creator) => {
      if (!query) {
        return true;
      }

      const missingFields = (creator.verification_request?.missing_fields ?? [])
        .map((field) => describeProfileVerificationField(field))
        .join(" ");

      return [creator.display_name, creator.creator_category, creator.niche ?? "", creator.bio ?? "", missingFields]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    return [...next].sort((left, right) => {
      const leftPending = left.verification_request?.status === "pending" ? 1 : 0;
      const rightPending = right.verification_request?.status === "pending" ? 1 : 0;

      if (leftPending !== rightPending) {
        return rightPending - leftPending;
      }

      return Date.parse(right.created_at) - Date.parse(left.created_at);
    });
  }, [creatorSearch, creators]);

  return (
    <section className="admin-platform-shell space-y-5">
      <header className="surface-card-vivid admin-hero-panel p-5 md:p-6">
        <div className="admin-page-hero-grid">
          <SectionHeader eyebrow="Seller health" title="Creators" body="Review who is active, who is earning, and which sellers are already connected for payout or flagged for moderation." />
          <aside className="admin-page-hero-rail">
            <div className="admin-hero-glance-card">
              <p className="admin-hero-glance-eyebrow">Creator Health</p>
              <div className="mt-3 admin-glance-grid">
                <div className="admin-hero-glance-item admin-hero-glance-item-forest">
                  <span>Active</span>
                  <strong>{creatorSummary.active}</strong>
                </div>
                <div className="admin-hero-glance-item admin-hero-glance-item-sunset">
                  <span>Warned</span>
                  <strong>{creatorSummary.warned}</strong>
                </div>
                <div className="admin-hero-glance-item admin-hero-glance-item-rose">
                  <span>Suspended</span>
                  <strong>{creatorSummary.suspended}</strong>
                </div>
                <div className="admin-hero-glance-item admin-hero-glance-item-cobalt">
                  <span>Pending verification</span>
                  <strong>{creatorSummary.pendingVerification}</strong>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </header>

      <section className="surface-card admin-panel p-5">
        <div className="admin-toolbar">
          <div className="admin-toolbar-layout">
            <div className="admin-toolbar-fields">
              <label className="admin-input-group">
                <span>Search creators</span>
                <input value={creatorSearch} onChange={(event) => setCreatorSearch(event.target.value)} placeholder="Name, category, niche, or bio" className="admin-input" />
              </label>
            </div>

            <div className="admin-toolbar-copy">
              <p className="admin-toolbar-label">Visible creators</p>
              <p className="admin-toolbar-value">{filteredCreators.length}</p>
              <p className="admin-toolbar-note">
                Verification-ready profiles rise to the top here so admins can approve or reject them without leaving this lane.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 admin-summary-grid">
          <div className="admin-mini-insight admin-mini-insight-cobalt">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Total</p>
            <p className="mt-2 font-display text-2xl font-bold">{creatorSummary.total}</p>
            <p className="mt-1 text-sm opacity-90">Visible creator profiles</p>
          </div>
          <div className="admin-mini-insight admin-summary-pill-forest">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Verified</p>
            <p className="mt-2 font-display text-2xl font-bold">{creatorSummary.verified}</p>
            <p className="mt-1 text-sm opacity-90">Approved creator identities</p>
          </div>
          <div className="admin-mini-insight admin-summary-pill-sunset">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Pending review</p>
            <p className="mt-2 font-display text-2xl font-bold">{creatorSummary.pendingVerification}</p>
            <p className="mt-1 text-sm opacity-90">Complete profiles waiting for admin</p>
          </div>
          <div className="admin-mini-insight admin-summary-pill-rose">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Payout ready</p>
            <p className="mt-2 font-display text-2xl font-bold">{creatorSummary.payoutReady}</p>
            <p className="mt-1 text-sm opacity-90">Connected for withdrawals</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {!creatorsLoading && filteredCreators.length === 0 ? (
            <div>
              <EmptyState title="No creators match this search" body="Try a shorter search term or clear the filter to see everyone." />
            </div>
          ) : null}
          {filteredCreators.map((creator) => {
            const pendingVerificationAction =
              reviewVerificationMutation.isPending &&
              reviewVerificationMutation.variables &&
              reviewVerificationMutation.variables.creatorId === creator.id
                ? reviewVerificationMutation.variables.decision
                : null;

            return (
              <CreatorCard
                key={creator.id}
                creator={creator}
                onReviewVerification={(decision) => reviewVerificationMutation.mutate({ creatorId: creator.id, decision })}
                pendingVerificationAction={pendingVerificationAction}
              />
            );
          })}
        </div>
      </section>
    </section>
  );
}
