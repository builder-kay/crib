import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { reviewCreatorVerificationRequest } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { describeProfileVerificationField, getVerificationStatusLabel } from "@/lib/profileVerification";
import { SectionHeader, useAdminWorkspace } from "@/pages/admin/AdminWorkspace";

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
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
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
                Verification-ready profiles stay at the top, and the main seller roster now uses a table so moderation data is easier to scan.
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

        <div className="mt-5">
          {!creatorsLoading && filteredCreators.length === 0 ? (
            <div>
              <EmptyState title="No creators match this search" body="Try a shorter search term or clear the filter to see everyone." />
            </div>
          ) : null}

          {filteredCreators.length > 0 ? (
            <div className="admin-data-table-shell">
              <table className="admin-data-table admin-data-table-wide">
                <thead>
                  <tr>
                    <th>Creator</th>
                    <th>Category</th>
                    <th>Verification</th>
                    <th>Payout</th>
                    <th>Wallet</th>
                    <th>Metrics</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCreators.map((creator) => {
                    const missingFields = (creator.verification_request?.missing_fields ?? []).map((field) => describeProfileVerificationField(field));
                    const verificationStatus = creator.verification_request?.status ?? (creator.is_verified ? "approved" : "incomplete");
                    const pendingVerificationAction =
                      reviewVerificationMutation.isPending &&
                      reviewVerificationMutation.variables &&
                      reviewVerificationMutation.variables.creatorId === creator.id
                        ? reviewVerificationMutation.variables.decision
                        : null;

                    return (
                      <tr key={creator.id}>
                        <td>
                          <div className="admin-data-table-cell">
                            <div className="flex min-w-0 items-start gap-3">
                              {creator.avatar_url ? (
                                <img src={creator.avatar_url} alt={creator.display_name} className="h-12 w-12 rounded-2xl object-cover" />
                              ) : (
                                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cobalt-100 text-sm font-bold text-cobalt-700">
                                  {creator.display_name.charAt(0).toUpperCase() || "C"}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Link to={`/profile/${creator.id}`} className="admin-data-table-main admin-data-table-main-link">
                                    {creator.display_name}
                                  </Link>
                                  {creator.is_verified ? <VerifiedBadge size="sm" /> : null}
                                </div>
                                <span className="admin-data-table-meta">{creator.bio?.trim() || "No bio added yet."}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="admin-data-table-cell">
                            <div className="admin-table-chip-row">
                              <span className="admin-chip admin-chip-sand">{creator.creator_category}</span>
                              <span className={`admin-chip ${sellerStatusChipClass(creator.seller_account_status)}`}>{creator.seller_account_status}</span>
                            </div>
                            <span className="admin-data-table-meta">{creator.niche?.trim() || "No niche set"}</span>
                          </div>
                        </td>
                        <td>
                          <div className="admin-data-table-cell">
                            <span className="admin-data-table-main">{getVerificationStatusLabel(verificationStatus)}</span>
                            <span className="admin-data-table-meta">
                              {missingFields.length > 0 ? `Missing: ${missingFields.join(", ")}` : "Profile and payout details are complete."}
                            </span>
                            {creator.verification_request?.review_note ? <span className="admin-data-table-meta">Note: {creator.verification_request.review_note}</span> : null}
                          </div>
                        </td>
                        <td>
                          <div className="admin-data-table-cell">
                            <span className="admin-data-table-main">
                              {creator.payout_account
                                ? `${creator.payout_account.payout_type === "mobile_money" ? "Mobile money" : "Bank"} ${creator.payout_account.status}`
                                : "No payout setup"}
                            </span>
                            <span className="admin-data-table-meta">
                              {creator.payout_account ? creator.payout_account.settlement_bank_name || creator.payout_account.country : "Creator still needs a payout account"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="admin-data-table-cell">
                            <span className="admin-data-table-main">{formatCurrency(creator.wallet_balance_kobo, "GHS")}</span>
                            <span className="admin-data-table-meta">{creator.payout_account ? "Ready for withdrawal routing" : "Not withdrawal-ready yet"}</span>
                          </div>
                        </td>
                        <td>
                          <div className="admin-data-table-cell">
                            <span className="admin-data-table-meta">{creator.asset_count} listings</span>
                            <span className="admin-data-table-meta">{creator.published_assets} published / {creator.draft_assets} draft</span>
                            <span className="admin-data-table-meta">{creator.sales_count} sales / {creator.follower_count} followers</span>
                          </div>
                        </td>
                        <td>
                          <div className="admin-data-table-cell">
                            <span className="admin-data-table-main">{formatDate(creator.created_at)}</span>
                            <span className="admin-data-table-meta">
                              {creator.latest_asset_at ? `Latest listing ${formatDate(creator.latest_asset_at)}` : "No listings yet"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="admin-data-table-actions">
                            <Link to={`/profile/${creator.id}`} className="admin-action-button admin-action-button-secondary">
                              Profile
                            </Link>
                            {verificationStatus === "pending" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => reviewVerificationMutation.mutate({ creatorId: creator.id, decision: "approve" })}
                                  disabled={pendingVerificationAction !== null}
                                  className="admin-action-button"
                                >
                                  {pendingVerificationAction === "approve" ? "Approving..." : "Approve"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => reviewVerificationMutation.mutate({ creatorId: creator.id, decision: "reject" })}
                                  disabled={pendingVerificationAction !== null}
                                  className="admin-action-button admin-action-button-rose"
                                >
                                  {pendingVerificationAction === "reject" ? "Rejecting..." : "Reject"}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function sellerStatusChipClass(status: "active" | "warned" | "suspended") {
  if (status === "warned") {
    return "admin-chip-sunset";
  }
  if (status === "suspended") {
    return "admin-chip-rose";
  }
  return "admin-chip-forest";
}
