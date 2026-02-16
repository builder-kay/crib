import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { AssetGrid } from "@/components/AssetGrid";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { getCreatorAssets, getPayoutAccountSetup, getProfile, updateProfile, uploadProfileAvatar, upsertPayoutAccount } from "@/lib/api";
import { formatFileSize, MAX_PROFILE_AVATAR_SIZE_BYTES } from "@/lib/uploadLimits";
import { payoutAccountSchema, profileSchema } from "@/lib/validators/asset";
import { useAuthStore } from "@/store/authStore";

const PAYOUT_COUNTRY_OPTIONS = [
  { value: "ghana", label: "Ghana" },
  { value: "nigeria", label: "Nigeria" },
  { value: "kenya", label: "Kenya" },
  { value: "south africa", label: "South Africa" }
] as const;

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

  const [payoutCountry, setPayoutCountry] = useState<string>("ghana");
  const [payoutType, setPayoutType] = useState<"bank" | "mobile_money">("bank");
  const [payoutBusinessName, setPayoutBusinessName] = useState("");
  const [payoutBankCode, setPayoutBankCode] = useState("");
  const [payoutAccountNumber, setPayoutAccountNumber] = useState("");
  const [hasHydratedPayoutForm, setHasHydratedPayoutForm] = useState(false);
  const [isEditingPayout, setIsEditingPayout] = useState(false);

  const payoutSetupQuery = useQuery({
    queryKey: ["payout-setup", userId, payoutCountry],
    queryFn: () => getPayoutAccountSetup(payoutCountry),
    enabled: isOwnProfile && Boolean(userId)
  });

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [creatorCategory, setCreatorCategory] = useState("General");
  const [niche, setNiche] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

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

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [avatarFile]);

  useEffect(() => {
    setHasHydratedPayoutForm(false);
    setIsEditingPayout(false);
    setPayoutCountry("ghana");
    setPayoutType("bank");
    setPayoutBusinessName("");
    setPayoutBankCode("");
    setPayoutAccountNumber("");
  }, [profileId]);

  useEffect(() => {
    if (!isOwnProfile || hasHydratedPayoutForm || !payoutSetupQuery.data) {
      return;
    }

    const account = payoutSetupQuery.data.account;
    const nextCountry = account?.country || payoutSetupQuery.data.country || "ghana";
    const nextPayoutType = account?.payout_type === "mobile_money" ? "mobile_money" : "bank";
    setPayoutCountry(nextCountry);
    setPayoutType(nextPayoutType);
    setPayoutBusinessName(account?.business_name || profileQuery.data?.display_name || "");
    setPayoutBankCode(account?.settlement_bank_code || "");
    setIsEditingPayout(!account);
    setHasHydratedPayoutForm(true);
  }, [hasHydratedPayoutForm, isOwnProfile, payoutSetupQuery.data, profileQuery.data?.display_name]);

  useEffect(() => {
    if (!isOwnProfile) {
      return;
    }

    if (!payoutBusinessName.trim() && displayName.trim()) {
      setPayoutBusinessName(displayName.trim());
    }
  }, [displayName, isOwnProfile, payoutBusinessName]);

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

  const uploadAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !isOwnProfile) {
        throw new Error("You can only edit your own profile.");
      }

      if (!avatarFile) {
        throw new Error("Select a profile photo first.");
      }

      return uploadProfileAvatar(user.id, avatarFile);
    },
    onSuccess: async () => {
      pushToast("Profile photo updated", "success");
      setAvatarFile(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["creator-directory"] }),
        queryClient.invalidateQueries({ queryKey: ["market-assets"] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Profile photo upload failed", "error");
    }
  });

  const upsertPayoutAccountMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !isOwnProfile) {
        throw new Error("You can only edit your own payout account.");
      }

      const normalizedAccountNumber = payoutAccountNumber.replace(/\D+/g, "");
      if (payoutType === "mobile_money" && normalizedAccountNumber.length < 8) {
        throw new Error("Mobile money number must be at least 8 digits.");
      }

      const providerOptions =
        payoutType === "mobile_money" ? payoutSetupQuery.data?.mobile_money_providers : payoutSetupQuery.data?.banks;
      const selectedBank = providerOptions?.find((bank) => bank.code === payoutBankCode);

      const parsed = payoutAccountSchema.safeParse({
        payout_type: payoutType,
        country: payoutCountry.trim().toLowerCase(),
        business_name: payoutBusinessName.trim(),
        settlement_bank_code: payoutBankCode.trim(),
        settlement_bank_name: selectedBank?.name ?? "",
        account_number: normalizedAccountNumber
      });

      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid payout account details");
      }

      return upsertPayoutAccount(parsed.data);
    },
    onSuccess: async (account) => {
      pushToast("Payout account updated", "success");
      setPayoutCountry(account.country);
      setPayoutType(account.payout_type === "mobile_money" ? "mobile_money" : "bank");
      setPayoutBusinessName(account.business_name);
      setPayoutBankCode(account.settlement_bank_code);
      setPayoutAccountNumber("");
      setIsEditingPayout(false);
      await queryClient.invalidateQueries({ queryKey: ["payout-setup", userId] });
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Payout account update failed", "error");
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
  const isVerified = Boolean(profileQuery.data?.is_verified);
  const listedWorksCount = portfolioAssets.length;
  const listedWorksLabel = `${listedWorksCount} listed work${listedWorksCount === 1 ? "" : "s"}`;
  const activeAvatarUrl = avatarPreviewUrl || profileQuery.data?.avatar_url || "";
  const payoutAccount = payoutSetupQuery.data?.account ?? null;
  const payoutBanks = payoutSetupQuery.data?.banks ?? [];
  const payoutMobileProviders = payoutSetupQuery.data?.mobile_money_providers ?? [];
  const payoutProviderOptions = payoutType === "mobile_money" ? payoutMobileProviders : payoutBanks;
  const payoutLastUpdated = payoutAccount?.updated_at ? new Date(payoutAccount.updated_at).toLocaleDateString("en-US") : null;
  const hasPayoutAccount = Boolean(payoutAccount);

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

          <div className="grid gap-2 sm:grid-cols-2">
            <ProfileStatChip label="Category" value={creatorCategoryLabel} />
            <ProfileStatChip label="Portfolio" value={String(listedWorksCount)} />
          </div>
        </div>
      </header>

      <section className={`grid items-start gap-5 ${isOwnProfile ? "xl:grid-cols-[0.82fr,1.18fr]" : ""}`}>
        <div className="space-y-5">
          <article className="surface-card profile-summary-panel profile-summary-panel-enhanced relative overflow-hidden p-5 md:p-6">
          <div className="pointer-events-none absolute -right-16 top-6 h-36 w-36 rounded-full bg-cobalt-100/55 blur-3xl" />
          <div className="relative z-10 flex items-start gap-4">
            <div className="profile-avatar-frame grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cobalt-50 via-white to-lagoon-50">
              {activeAvatarUrl ? (
                <img src={activeAvatarUrl} alt={profileName} className="h-16 w-16 rounded-full object-cover" />
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

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <ProfileStatTile label="Category" value={creatorCategoryLabel} />
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
            <article className="surface-card relative overflow-hidden border-2 border-sunset-200 bg-gradient-to-br from-sunset-50 via-white to-ember-50 p-5 shadow-glow md:p-6">
              <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sunset-200/70 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 left-8 h-36 w-36 rounded-full bg-cobalt-100/70 blur-3xl" />
              <div className="relative z-10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sunset-700">Critical setup</p>
                    <h3 className="mt-1 font-display text-2xl font-bold text-ink">Payout account</h3>
                    <p className="mt-1 text-sm text-sand-700">
                      This controls where creator earnings go after every sale.
                    </p>
                  </div>
                  <span className="rounded-full bg-sunset-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sunset-700">
                    Required to get paid
                  </span>
                </div>

                {payoutSetupQuery.isError ? (
                  <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {payoutSetupQuery.error instanceof Error ? payoutSetupQuery.error.message : "Could not load payout options right now."}
                  </p>
                ) : null}

                {payoutAccount && !isEditingPayout ? (
                  <div className="mt-4 space-y-3 rounded-xl border border-forest-300 bg-forest-100 p-3 text-xs text-forest-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold uppercase tracking-[0.08em]">Payout connected</p>
                      <button
                        type="button"
                        onClick={() => {
                          if (!payoutAccount) {
                            return;
                          }

                          setPayoutCountry(payoutAccount.country);
                          setPayoutType(payoutAccount.payout_type === "mobile_money" ? "mobile_money" : "bank");
                          setPayoutBusinessName(payoutAccount.business_name);
                          setPayoutBankCode(payoutAccount.settlement_bank_code);
                          setPayoutAccountNumber("");
                          setIsEditingPayout(true);
                        }}
                        className="rounded-full border border-forest-400 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-forest-700 transition hover:bg-forest-50"
                      >
                        Edit payout
                      </button>
                    </div>

                    <p>
                      Method: {payoutAccount.payout_type === "mobile_money" ? "Mobile money" : "Bank account"} | Provider:{" "}
                      {payoutAccount.settlement_bank_name || payoutAccount.settlement_bank_code}
                    </p>
                    <p>
                      Verified name: {payoutAccount.account_name || payoutAccount.business_name} | Destination: ****
                      {payoutAccount.account_number_last4}
                    </p>
                    {payoutLastUpdated ? <p>Last updated: {payoutLastUpdated}</p> : null}
                  </div>
                ) : (
                  <>
                    {!hasPayoutAccount ? (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                        No payout account connected yet.
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-sand-800">Country</span>
                        <select
                          value={payoutCountry}
                          onChange={(event) => {
                            setPayoutCountry(event.target.value);
                            setPayoutBankCode("");
                          }}
                          className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
                        >
                          {PAYOUT_COUNTRY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-sand-800">Payout method</span>
                        <select
                          value={payoutType}
                          onChange={(event) => {
                            const nextType = event.target.value === "mobile_money" ? "mobile_money" : "bank";
                            setPayoutType(nextType);
                            setPayoutBankCode("");
                          }}
                          className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
                        >
                          <option value="bank">Bank account</option>
                          <option value="mobile_money">Mobile money</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-sand-800">
                          {payoutType === "mobile_money" ? "Mobile network" : "Settlement bank"}
                        </span>
                        <select
                          value={payoutBankCode}
                          onChange={(event) => setPayoutBankCode(event.target.value)}
                          className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
                        >
                          <option value="">
                            {payoutSetupQuery.isLoading
                              ? "Loading options..."
                              : payoutType === "mobile_money"
                                ? "Select mobile network"
                                : "Select bank"}
                          </option>
                          {payoutBankCode && !payoutProviderOptions.some((bank) => bank.code === payoutBankCode) ? (
                            <option value={payoutBankCode}>{`Current option (${payoutBankCode})`}</option>
                          ) : null}
                          {payoutProviderOptions.map((bank) => (
                            <option key={bank.code} value={bank.code}>
                              {bank.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <Field label="Business Name" value={payoutBusinessName} onChange={setPayoutBusinessName} />

                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-sand-800">
                          {payoutType === "mobile_money" ? "Mobile number" : "Account number"}
                        </span>
                        <input
                          value={payoutAccountNumber}
                          onChange={(event) => setPayoutAccountNumber(event.target.value.replace(/\D+/g, ""))}
                          inputMode="numeric"
                          maxLength={20}
                          placeholder={payoutType === "mobile_money" ? "Enter mobile money number" : "Enter full account number"}
                          className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
                        />
                      </label>
                    </div>

                    <p className="mt-2 text-xs text-sand-500">
                      {payoutType === "mobile_money"
                        ? "Mobile money recipient name is verified before your payout setup is saved."
                        : "Bank account name is verified before your payout setup is saved."}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => upsertPayoutAccountMutation.mutate()}
                        disabled={upsertPayoutAccountMutation.isPending || payoutSetupQuery.isLoading}
                        className="rounded-full bg-forest-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {upsertPayoutAccountMutation.isPending ? "Saving payout..." : "Save payout account"}
                      </button>

                      {hasPayoutAccount ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (!payoutAccount) {
                              return;
                            }

                            setPayoutCountry(payoutAccount.country);
                            setPayoutType(payoutAccount.payout_type === "mobile_money" ? "mobile_money" : "bank");
                            setPayoutBusinessName(payoutAccount.business_name);
                            setPayoutBankCode(payoutAccount.settlement_bank_code);
                            setPayoutAccountNumber("");
                            setIsEditingPayout(false);
                          }}
                          className="rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-sand-700 transition hover:bg-sand-50"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </>
                )}

                <p className="mt-2 text-xs text-sand-500">
                  Platform commission is automatically deducted at checkout before payout.
                </p>
              </div>
            </article>
          ) : null}
        </div>

        {isOwnProfile ? (
          <article className="surface-card profile-edit-panel profile-edit-panel-enhanced p-5 md:p-6 xl:sticky xl:top-24">
            <div className="rounded-xl border border-cobalt-100 bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cobalt-700">Profile Editor</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink">Edit Profile</h2>
              <p className="mt-1 text-sm text-sand-600">
                Keep your profile complete and consistent for better buyer trust and discovery.
              </p>
            </div>
            <p className="mt-3 text-sm text-sand-600">
              Your public profile powers trust in marketplace listings. Bio and category are required.
            </p>
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                updateProfileMutation.mutate();
              }}
            >
              <div className="rounded-xl border border-sand-200 bg-white p-4">
                <p className="text-sm font-semibold text-sand-800">Profile photo</p>
                <p className="mt-1 text-xs text-sand-500">Add a clear headshot or brand avatar for trust and discoverability.</p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="profile-avatar-frame grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cobalt-50 via-white to-lagoon-50">
                    {activeAvatarUrl ? (
                      <img src={activeAvatarUrl} alt={profileName} className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <span className="font-display text-lg font-bold text-cobalt-700">{initialsFromName(profileName)}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink transition hover:bg-sand-100">
                      Choose image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) {
                            setAvatarFile(null);
                            return;
                          }

                          if (!file.type.startsWith("image/")) {
                            pushToast("Profile photo must be an image file.", "error");
                            event.target.value = "";
                            return;
                          }

                          if (file.size > MAX_PROFILE_AVATAR_SIZE_BYTES) {
                            pushToast(`Profile photo must be ${formatFileSize(MAX_PROFILE_AVATAR_SIZE_BYTES)} or smaller.`, "error");
                            event.target.value = "";
                            return;
                          }

                          setAvatarFile(file);
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => uploadAvatarMutation.mutate()}
                      disabled={!avatarFile || uploadAvatarMutation.isPending}
                      className="rounded-full bg-cobalt-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploadAvatarMutation.isPending ? "Uploading..." : "Upload photo"}
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-xs text-sand-500">
                  {avatarFile ? `Selected: ${avatarFile.name}` : `Supported: image files up to ${formatFileSize(MAX_PROFILE_AVATAR_SIZE_BYTES)}.`}
                </p>
              </div>

              <div className="rounded-xl border border-sand-200 bg-white p-4">
                <p className="text-sm font-semibold text-sand-800">Identity</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Field label="Display Name" value={displayName} onChange={setDisplayName} required />
                  <Field label="Category" value={creatorCategory} onChange={setCreatorCategory} required />
                </div>
                <div className="mt-3">
                  <Field label="Niche (optional)" value={niche} onChange={setNiche} />
                </div>
              </div>

              <div className="rounded-xl border border-sand-200 bg-white p-4">
                <p className="text-sm font-semibold text-sand-800">Bio</p>
                <div className="mt-3">
                  <Field label="Tell people about your work" value={bio} onChange={setBio} multiline required />
                </div>
              </div>

              <div className="rounded-xl border border-sand-200 bg-white p-4">
                <p className="text-sm font-semibold text-sand-800">Social links</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Field label="Website" value={website} onChange={setWebsite} />
                  <Field label="Instagram" value={instagram} onChange={setInstagram} />
                  <Field label="X / Twitter" value={xHandle} onChange={setXHandle} />
                </div>
              </div>

              <button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="w-full rounded-xl bg-cobalt-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cobalt-700 disabled:opacity-60"
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
          className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
        />
      )}
    </label>
  );
}

