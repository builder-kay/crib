import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { CreatorCard, SectionHeader, useAdminWorkspace } from "@/pages/admin/AdminWorkspace";

export function AdminCreatorsPage() {
  const { creators, creatorsLoading } = useAdminWorkspace();
  const [creatorSearch, setCreatorSearch] = useState("");

  const creatorSummary = useMemo(
    () =>
      creators.reduce(
        (summary, creator) => {
          summary.total += 1;
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
        { total: 0, active: 0, warned: 0, suspended: 0, payoutReady: 0 }
      ),
    [creators]
  );

  const filteredCreators = useMemo(() => {
    const query = creatorSearch.trim().toLowerCase();
    return creators.filter((creator) => {
      if (!query) {
        return true;
      }

      return [creator.display_name, creator.creator_category, creator.niche ?? "", creator.bio ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
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
                  <span>Payout ready</span>
                  <strong>{creatorSummary.payoutReady}</strong>
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
                This lane is your quickest view of seller readiness, account warnings, payout setup, and who may need intervention.
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Active</p>
            <p className="mt-2 font-display text-2xl font-bold">{creatorSummary.active}</p>
            <p className="mt-1 text-sm opacity-90">No current moderation flags</p>
          </div>
          <div className="admin-mini-insight admin-summary-pill-sunset">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Warned</p>
            <p className="mt-2 font-display text-2xl font-bold">{creatorSummary.warned}</p>
            <p className="mt-1 text-sm opacity-90">Needs closer follow-up</p>
          </div>
          <div className="admin-mini-insight admin-summary-pill-rose">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Suspended</p>
            <p className="mt-2 font-display text-2xl font-bold">{creatorSummary.suspended}</p>
            <p className="mt-1 text-sm opacity-90">Blocked from selling</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {!creatorsLoading && filteredCreators.length === 0 ? (
            <div className="xl:col-span-2">
              <EmptyState title="No creators match this search" body="Try a shorter search term or clear the filter to see everyone." />
            </div>
          ) : null}
          {filteredCreators.map((creator) => (
            <CreatorCard key={creator.id} creator={creator} />
          ))}
        </div>
      </section>
    </section>
  );
}
