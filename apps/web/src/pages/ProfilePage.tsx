import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { AssetGrid } from "@/components/AssetGrid";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { getCreatorAssets, getProfile, updateProfile } from "@/lib/api";
import { profileSchema } from "@/lib/validators/asset";
import { useAuthStore } from "@/store/authStore";

function initialsFromName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "C";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function toSocialUrl(kind: "website" | "instagram" | "x", rawValue: string) {
  const value = rawValue.trim();
  if (!value) {
    return "";
  }

  if (kind === "website") {
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const handle = value.replace(/^@/, "");
  if (!handle) {
    return "";
  }

  return kind === "instagram" ? `https://instagram.com/${handle}` : `https://x.com/${handle}`;
}

function formatSalesCount(count: number) {
  const safeCount = Math.max(0, count);
  const formatted = new Intl.NumberFormat("en-US").format(safeCount);
  return `${formatted} sale${safeCount === 1 ? "" : "s"}`;
}

export function ProfilePage() {
  const { id: routeProfileId } = useParams();
  const user = useAuthStore((state) => state.user);
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const userId = user?.id ?? "";
  const profileId = routeProfileId ?? userId;
  const isOwnProfile = Boolean(userId) && (routeProfileId ? routeProfileId === userId : true);

  const profileQuery = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => getProfile(profileId),
    enabled: Boolean(profileId)
  });

  const assetsQuery = useQuery({
    queryKey: ["creator-assets", profileId],
    queryFn: () => getCreatorAssets(profileId),
    enabled: Boolean(profileId)
  });

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [creatorCategory, setCreatorCategory] = useState("General");
  const [niche, setNiche] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [xHandle, setXHandle] = useState("");

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }

    setDisplayName(profileQuery.data.display_name ?? "");
    setBio(profileQuery.data.bio ?? "");
    setCreatorCategory(profileQuery.data.creator_category ?? "General");
    setNiche(profileQuery.data.niche ?? "");
    setWebsite((profileQuery.data.socials?.website as string) ?? "");
    setInstagram((profileQuery.data.socials?.instagram as string) ?? "");
    setXHandle((profileQuery.data.socials?.x as string) ?? "");
  }, [profileQuery.data]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !isOwnProfile) {
        throw new Error("You can only edit your own profile.");
      }

      const parsed = profileSchema.safeParse({
        display_name: displayName.trim(),
        bio: bio.trim(),
        creator_category: creatorCategory.trim(),
        niche: niche.trim(),
        website: website.trim(),
        instagram: instagram.trim(),
        x: xHandle.trim()
      });

      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid profile details");
      }

      return updateProfile(user.id, parsed.data);
    },
    onSuccess: async () => {
      pushToast("Profile updated", "success");
      await queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Profile update failed", "error");
    }
  });

  const profileName = useMemo(() => {
    if (profileQuery.data?.display_name) {
      return profileQuery.data.display_name;
    }
    if (isOwnProfile && user?.email) {
      return user.email.split("@")[0] ?? "Creator";
    }
    return "Creator";
  }, [profileQuery.data?.display_name, isOwnProfile, user?.email]);

  const portfolioAssets = useMemo(() => {
    const assets = assetsQuery.data ?? [];
    return isOwnProfile ? assets : assets.filter((asset) => asset.status === "published");
  }, [assetsQuery.data, isOwnProfile]);

  if (!profileId) {
    return (
      <EmptyState
        title="Profile unavailable"
        body="Sign in to view your creator profile."
        action={
          <Link to="/auth" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">
            Sign in
          </Link>
        }
      />
    );
  }

  if (profileQuery.isError) {
    return (
      <div className="surface-card p-6">
        <h2 className="font-display text-xl font-semibold text-ink">Could not load profile</h2>
        <p className="mt-2 text-sm text-sand-700">{profileQuery.error instanceof Error ? profileQuery.error.message : "Try again shortly."}</p>
      </div>
    );
  }

  if (!profileQuery.isLoading && !profileQuery.data) {
    return <EmptyState title="Profile not found" body="This creator profile does not exist or is not available right now." />;
  }

  const websiteUrl = toSocialUrl("website", profileQuery.data?.socials?.website ?? "");
  const instagramUrl = toSocialUrl("instagram", profileQuery.data?.socials?.instagram ?? "");
  const xUrl = toSocialUrl("x", profileQuery.data?.socials?.x ?? "");
  const creatorCategoryLabel = profileQuery.data?.creator_category?.trim() || "General";
  const salesLabel = formatSalesCount(profileQuery.data?.sales_count ?? 0);
  const isVerified = Boolean(profileQuery.data?.is_verified);
  const listedWorksCount = portfolioAssets.length;
  const listedWorksLabel = `${listedWorksCount} listed work${listedWorksCount === 1 ? "" : "s"}`;

  return (
    <div className="profile-shell space-y-6">
      <header className="surface-card-vivid profile-hero-panel relative overflow-hidden p-5 md:p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cobalt-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-24 h-52 w-52 rounded-full bg-lagoon-100/50 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cobalt-600">{isOwnProfile ? "Your Public Profile" : "Creator Profile"}</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">{profileName}</h1>
            <p className="mt-2 max-w-3xl text-sm text-sand-700 md:text-base">
              {isOwnProfile
                ? "Build trust with a complete identity: category, bio, portfolio, and social proof."
                : "Discover the creator behind the work, then explore their portfolio."}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <ProfileStatChip label="Category" value={creatorCategoryLabel} />
            <ProfileStatChip label="Sales" value={salesLabel} />
            <ProfileStatChip label="Portfolio" value={String(listedWorksCount)} />
          </div>
        </div>
      </header>

      <section className={`grid items-start gap-5 ${isOwnProfile ? "lg:grid-cols-[0.82fr,1.18fr]" : ""}`}>
        <article className="surface-card profile-summary-panel relative overflow-hidden p-5 md:p-6">
          <div className="pointer-events-none absolute -right-16 top-6 h-36 w-36 rounded-full bg-cobalt-100/55 blur-3xl" />
          <div className="relative z-10 flex items-start gap-4">
            <div className="profile-avatar-frame grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cobalt-50 via-white to-lagoon-50">
              {profileQuery.data?.avatar_url ? (
                <img src={profileQuery.data.avatar_url} alt={profileName} className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <span className="font-display text-2xl font-bold text-cobalt-700">{initialsFromName(profileName)}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl font-bold text-ink">{profileName}</h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                    isVerified ? "bg-forest-100 text-forest-700" : "bg-sand-100 text-sand-600"
                  }`}
                >
                  {isVerified ? "Verified" : "Verification soon"}
                </span>
              </div>
              <p className="mt-1 text-sm text-sand-600">{profileQuery.data?.niche || "Creative entrepreneur"}</p>
              {isOwnProfile && user?.email ? <p className="mt-1 text-xs text-sand-500">{user.email}</p> : null}
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <ProfileStatTile label="Category" value={creatorCategoryLabel} />
            <ProfileStatTile label="Sales" value={salesLabel} />
            <ProfileStatTile label="Portfolio" value={listedWorksLabel} />
          </div>

          <div className="mt-5 rounded-xl border border-sand-200 bg-sand-50/80 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-500">About</p>
            <p className="mt-1 text-sm leading-relaxed text-sand-700">{profileQuery.data?.bio || "No bio added yet."}</p>
          </div>

          <div className="mt-5 space-y-2 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-500">Social links</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <SocialRow label="Website" url={websiteUrl} fallback={profileQuery.data?.socials?.website ?? ""} />
              <SocialRow label="Instagram" url={instagramUrl} fallback={profileQuery.data?.socials?.instagram ?? ""} />
              <SocialRow label="X / Twitter" url={xUrl} fallback={profileQuery.data?.socials?.x ?? ""} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {isOwnProfile ? (
              <>
                <Link
                  to="/dashboard"
                  className="rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink transition hover:bg-sand-100"
                >
                  Dashboard
                </Link>
                <Link
                  to="/dashboard/upload"
                  className="rounded-full bg-cobalt-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-cobalt-700"
                >
                  Upload Asset
                </Link>
              </>
            ) : (
              <Link
                to="/market"
                className="rounded-full border border-sand-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink transition hover:bg-sand-100"
              >
                Explore Marketplace
              </Link>
            )}
          </div>
        </article>

        {isOwnProfile ? (
          <article className="surface-card profile-edit-panel p-5 md:p-6">
            <h2 className="font-display text-xl font-semibold text-ink">Edit Profile</h2>
            <p className="mt-2 text-sm text-sand-600">
              Your public profile powers trust in marketplace listings. Bio and category are required.
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                updateProfileMutation.mutate();
              }}
            >
              <Field label="Display Name" value={displayName} onChange={setDisplayName} required />
              <Field label="Category" value={creatorCategory} onChange={setCreatorCategory} required />
              <Field label="Niche (optional)" value={niche} onChange={setNiche} />
              <Field label="Bio" value={bio} onChange={setBio} multiline required />
              <Field label="Website" value={website} onChange={setWebsite} />
              <Field label="Instagram" value={instagram} onChange={setInstagram} />
              <Field label="X / Twitter" value={xHandle} onChange={setXHandle} />
              <button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink/85 disabled:opacity-60"
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save profile"}
              </button>
            </form>
          </article>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-bold text-ink">{isOwnProfile ? "Your Portfolio" : "Portfolio"}</h2>
          <span className="rounded-full border border-sand-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700">
            {listedWorksLabel}
          </span>
        </div>

        {assetsQuery.isLoading ? <div className="surface-card p-5 text-sm text-sand-600">Loading assets...</div> : null}
        {assetsQuery.isError ? <div className="surface-card p-5 text-sm text-rose-700">Could not load assets.</div> : null}
        {assetsQuery.data && portfolioAssets.length === 0 ? (
          <EmptyState
            title="No assets yet"
            body={isOwnProfile ? "Publish your first listing to start selling." : "This creator has no published listings yet."}
          />
        ) : null}
        {assetsQuery.data && portfolioAssets.length > 0 ? <AssetGrid assets={portfolioAssets} /> : null}
      </section>
    </div>
  );
}

function ProfileStatChip({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-cobalt-100 bg-white/85 px-3 py-2 backdrop-blur-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cobalt-600">{label}</p>
      <p className="mt-1 line-clamp-1 text-sm font-semibold text-ink">{value}</p>
    </article>
  );
}

function ProfileStatTile({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-sand-200 bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sand-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </article>
  );
}

function SocialRow({ label, url, fallback }: { label: string; url: string; fallback: string }) {
  if (!url) {
    return (
      <div className="h-full rounded-xl border border-dashed border-sand-300 bg-sand-50 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sand-500">{label}</p>
        <p className="mt-1 text-sm text-sand-600">Not provided</p>
      </div>
    );
  }

  return (
    <div className="h-full rounded-xl border border-sand-200 bg-white px-3 py-2.5 transition hover:border-cobalt-200 hover:bg-cobalt-50/35">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sand-500">{label}</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-block max-w-full truncate text-sm font-medium text-cobalt-700 hover:text-cobalt-800"
      >
        {fallback.trim() || url}
      </a>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  multiline
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-sand-800">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          required={required}
          className="w-full rounded-xl border border-sand-300 px-3 py-2 outline-none focus:border-ember-500"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          className="w-full rounded-xl border border-sand-300 px-3 py-2 outline-none focus:border-ember-500"
        />
      )}
    </label>
  );
}
