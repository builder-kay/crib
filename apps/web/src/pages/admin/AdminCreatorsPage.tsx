import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { CreatorCard, SectionHeader, useAdminWorkspace } from "@/pages/admin/AdminWorkspace";

export function AdminCreatorsPage() {
  const { creators, creatorsLoading } = useAdminWorkspace();
  const [creatorSearch, setCreatorSearch] = useState("");

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
        <SectionHeader eyebrow="Seller health" title="Creators" body="Review who is active, who is earning, and which sellers are already connected for payout." />
      </header>

      <section className="surface-card admin-panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <label className="admin-input-group lg:w-[340px]">
            <span>Search creators</span>
            <input value={creatorSearch} onChange={(event) => setCreatorSearch(event.target.value)} placeholder="Name, category, niche, or bio" className="admin-input" />
          </label>
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
