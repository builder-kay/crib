import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { AssetGrid } from "@/components/AssetGrid";
import { EmptyState } from "@/components/EmptyState";
import { HireCreatorModal } from "@/components/HireCreatorModal";
import { StarRating } from "@/components/StarRating";
import { useToast } from "@/components/Toast";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { getUserContactEmail, getUserIdentityLabel } from "@/lib/auth";
import {
  deleteCreatorReview,
  followCreator,
  getCreatorAssets,
  getCreatorFollowStats,
  getCreatorRatingSummary,
  getCreatorReviews,
  getPayoutAccountSetup,
  getProfile,
  hasPaidOrderWithCreator,
  unfollowCreator,
  updateProfile,
  uploadProfileAvatar,
  upsertCreatorReview,
  upsertPayoutAccount
} from "@/lib/api";
import { DEFAULT_HIRE_TERMS } from "@/lib/hire";
import {
  getProfileVerificationChecklist,
  getVerificationStatusLabel
} from "@/lib/profileVerification";
import { formatMajorCurrency } from "@/lib/format";
import { formatFileSize, MAX_PROFILE_AVATAR_SIZE_BYTES } from "@/lib/uploadLimits";
import { HIRE_PRICING_MODE_OPTIONS, payoutAccountSchema, profileSchema } from "@/lib/validators/asset";
import { useAuthStore } from "@/store/authStore";

const PAYOUT_COUNTRY_OPTIONS = [
  { value: "ghana", label: "Ghana" },
  { value: "nigeria", label: "Nigeria" },
  { value: "kenya", label: "Kenya" },
  { value: "south africa", label: "South Africa" }
] as const;

const HIRE_PRICING_OPTIONS: Array<{
  value: (typeof HIRE_PRICING_MODE_OPTIONS)[number];
  eyebrow: string;
  label: string;
  description: string;
}> = [
  {
    value: "hourly",
    eyebrow: "Rate",
    label: "By hour",
    description: "Show a public hourly rate before clients send their brief."
  },
  {
    value: "custom_list",
    eyebrow: "Packages",
    label: "Custom list",
    description: "Share starter packages, retainers, or example pricing lines."
  },
  {
    value: "dm_to_know",
    eyebrow: "Quote",
    label: "DM to know",
    description: "Keep pricing private and quote after reviewing the project."
  }
] as const;

type ProfileTabId = "overview" | "portfolio" | "reviews" | "payout" | "edit";

type ProfileTabOption = {
  id: ProfileTabId;
  label: string;
  badge?: string;
};

const PROFILE_TAB_TONE_CLASS: Record<ProfileTabId, string> = {
  overview: "tab-tone-cobalt",
  portfolio: "tab-tone-lagoon",
  reviews: "tab-tone-sunset",
  payout: "tab-tone-forest",
  edit: "tab-tone-rose"
};

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
  const userContactEmail = getUserContactEmail(user);
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

  const followStatsQuery = useQuery({
    queryKey: ["creator-follow-stats", profileId, userId],
    queryFn: () => getCreatorFollowStats(profileId, userId || null),
    enabled: Boolean(profileId)
  });

  const creatorRatingSummaryQuery = useQuery({
    queryKey: ["creator-rating-summary", profileId],
    queryFn: () => getCreatorRatingSummary(profileId),
    enabled: Boolean(profileId)
  });

  const creatorReviewsQuery = useQuery({
    queryKey: ["creator-reviews", profileId],
    queryFn: () => getCreatorReviews(profileId),
    enabled: Boolean(profileId)
  });

  const purchaseEligibilityQuery = useQuery({
    queryKey: ["creator-review-eligibility", profileId, user?.id, userContactEmail],
    queryFn: () => hasPaidOrderWithCreator(profileId, user!.id, userContactEmail),
    enabled: Boolean(user?.id && profileId && !isOwnProfile)
  });

  const [creatorReviewRating, setCreatorReviewRating] = useState(5);
  const [creatorReviewText, setCreatorReviewText] = useState("");

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
  const [hireEnabled, setHireEnabled] = useState(true);
  const [hireTerms, setHireTerms] = useState(DEFAULT_HIRE_TERMS);
  const [hirePricingMode, setHirePricingMode] = useState<(typeof HIRE_PRICING_MODE_OPTIONS)[number]>("dm_to_know");
  const [hireHourlyRate, setHireHourlyRate] = useState("");
  const [hirePricingCurrency, setHirePricingCurrency] = useState("GHS");
  const [hirePricingGuide, setHirePricingGuide] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTabId>("overview");
  const [hireModalOpen, setHireModalOpen] = useState(false);

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
    setHireEnabled(profileQuery.data.hire_enabled ?? true);
    setHireTerms(profileQuery.data.hire_terms?.trim() || DEFAULT_HIRE_TERMS);
    setHirePricingMode(profileQuery.data.hire_pricing_mode ?? (profileQuery.data.hire_pricing_guide?.trim() ? "custom_list" : "dm_to_know"));
    setHireHourlyRate(majorInputFromKobo(profileQuery.data.hire_hourly_rate_kobo));
    setHirePricingCurrency(profileQuery.data.hire_pricing_currency?.trim() || "GHS");
    setHirePricingGuide(profileQuery.data.hire_pricing_guide?.trim() || "");
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
    setActiveTab("overview");
    setHireModalOpen(false);
  }, [isOwnProfile, profileId]);

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

  const hourlyRatePreview = useMemo(() => {
    const amount = Number(hireHourlyRate);
    const currency = hirePricingCurrency.trim().toUpperCase() || "GHS";

    if (!Number.isFinite(amount) || amount < 0.5) {
      return null;
    }

    return formatMajorCurrency(amount, currency);
  }, [hireHourlyRate, hirePricingCurrency]);

  const existingCreatorReview = useMemo(() => {
    if (!user?.id) {
      return null;
    }
    return (creatorReviewsQuery.data ?? []).find((review) => review.reviewer_id === user.id) ?? null;
  }, [creatorReviewsQuery.data, user?.id]);

  useEffect(() => {
    if (existingCreatorReview) {
      setCreatorReviewRating(existingCreatorReview.rating);
      setCreatorReviewText(existingCreatorReview.review_text);
      return;
    }

    setCreatorReviewRating(5);
    setCreatorReviewText("");
  }, [existingCreatorReview, user?.id, profileId]);

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
        x: xHandle.trim(),
        hire_enabled: hireEnabled,
        hire_terms: hireTerms.trim(),
        hire_pricing_mode: hirePricingMode,
        hire_hourly_rate: hireHourlyRate,
        hire_pricing_currency: hirePricingCurrency.trim().toUpperCase(),
        hire_pricing_guide: hirePricingGuide.trim()
      });

      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid profile details");
      }

      return updateProfile(user.id, parsed.data);
    },
    onSuccess: async (profile) => {
      const verificationStatus = profile.verification?.status;
      pushToast(
        verificationStatus === "pending"
          ? "Profile updated. Verification is now pending admin review."
          : verificationStatus === "approved"
            ? "Profile updated."
            : "Profile updated. Finish the verification checklist, including payout details, to submit for review.",
        "success"
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["creator-directory"] }),
        queryClient.invalidateQueries({ queryKey: ["hire-creator-profile", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["market-assets"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-creators"] })
      ]);
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
        queryClient.invalidateQueries({ queryKey: ["hire-creator-profile", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["market-assets"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-creators"] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Profile photo upload failed", "error");
    }
  });

  const followMutation = useMutation({
    mutationFn: async (nextState: boolean) => {
      if (!user?.id || !profileId || isOwnProfile) {
        throw new Error("You can only follow other creators.");
      }

      if (nextState) {
        await followCreator(user.id, profileId);
      } else {
        await unfollowCreator(user.id, profileId);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["creator-follow-stats", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["creator-directory"] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not update follow state.", "error");
    }
  });

  const creatorReviewMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !profileId || isOwnProfile) {
        throw new Error("You can only review other creators.");
      }

      if (!Number.isFinite(creatorReviewRating) || creatorReviewRating < 1 || creatorReviewRating > 5) {
        throw new Error("Choose a rating from 1 to 5 stars.");
      }

      return upsertCreatorReview({
        userId: user.id,
        creatorId: profileId,
        rating: creatorReviewRating,
        reviewText: creatorReviewText
      });
    },
    onSuccess: async () => {
      pushToast(existingCreatorReview ? "Review updated." : "Review submitted.", "success");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["creator-rating-summary", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["creator-reviews", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["creator-directory"] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not save review.", "error");
    }
  });

  const deleteCreatorReviewMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !existingCreatorReview) {
        throw new Error("No review to delete.");
      }

      await deleteCreatorReview(existingCreatorReview.id, user.id);
    },
    onSuccess: async () => {
      setCreatorReviewRating(5);
      setCreatorReviewText("");
      pushToast("Review removed.", "success");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["creator-rating-summary", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["creator-reviews", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["creator-directory"] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not remove review.", "error");
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payout-setup", userId] }),
        queryClient.invalidateQueries({ queryKey: ["profile", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["creator-directory"] }),
        queryClient.invalidateQueries({ queryKey: ["hire-creator-profile", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["market-assets"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-creators"] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Payout account update failed", "error");
    }
  });

  const profileName = useMemo(() => {
    if (profileQuery.data?.display_name) {
      return profileQuery.data.display_name;
    }
    if (isOwnProfile) {
      return getUserIdentityLabel(user, "Creator");
    }
    return "Creator";
  }, [profileQuery.data?.display_name, isOwnProfile, user]);

  const portfolioAssets = useMemo(() => {
    const assets = assetsQuery.data ?? [];
    return isOwnProfile ? assets : assets.filter((asset) => asset.status === "published");
  }, [assetsQuery.data, isOwnProfile]);

  const payoutAccount = payoutSetupQuery.data?.account ?? null;
  const hasPayoutAccount = Boolean(payoutAccount);
  const hasActivePayoutAccount = payoutAccount?.status === "active";

  const verificationChecklist = useMemo(
    () =>
      getProfileVerificationChecklist({
        avatar_url: profileQuery.data?.avatar_url || "",
        display_name: displayName,
        creator_category: creatorCategory,
        niche,
        bio,
        website,
        instagram,
        x: xHandle,
        has_active_payout_account: hasActivePayoutAccount
      }),
    [bio, creatorCategory, displayName, hasActivePayoutAccount, instagram, niche, profileQuery.data?.avatar_url, website, xHandle]
  );

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
  const verificationRequest = profileQuery.data?.verification ?? null;
  const verificationStatus = verificationRequest?.status ?? (isVerified ? "approved" : "incomplete");
  const verificationStatusLabel = getVerificationStatusLabel(verificationStatus);
  const verificationReadyCount = verificationChecklist.filter((item) => item.complete).length;
  const payoutBanks = payoutSetupQuery.data?.banks ?? [];
  const payoutMobileProviders = payoutSetupQuery.data?.mobile_money_providers ?? [];
  const payoutProviderOptions = payoutType === "mobile_money" ? payoutMobileProviders : payoutBanks;
  const payoutLastUpdated = payoutAccount?.updated_at ? new Date(payoutAccount.updated_at).toLocaleDateString("en-US") : null;
  const followerCount = followStatsQuery.data?.followerCount ?? 0;
  const isFollowing = followStatsQuery.data?.isFollowing ?? false;
  const canAcceptHireRequests = profileQuery.data?.hire_enabled ?? true;
  const creatorRatingSummary = creatorRatingSummaryQuery.data ?? { average_rating: 0, review_count: 0 };
  const creatorReviews = creatorReviewsQuery.data ?? [];
  const canLeaveCreatorReview = Boolean(user?.id) && !isOwnProfile && purchaseEligibilityQuery.data === true;
  const profileTabs = useMemo<ProfileTabOption[]>(() => {
    const baseTabs: ProfileTabOption[] = [
      { id: "overview", label: "Overview" },
      { id: "portfolio", label: "Portfolio", badge: new Intl.NumberFormat("en-US").format(listedWorksCount) },
      { id: "reviews", label: "Reviews", badge: new Intl.NumberFormat("en-US").format(creatorRatingSummary.review_count) }
    ];

    if (isOwnProfile) {
      baseTabs.push({
        id: "payout",
        label: hasPayoutAccount ? "Payout" : "Payout setup"
      });
      baseTabs.push({ id: "edit", label: "Edit profile" });
    }

    return baseTabs;
  }, [creatorRatingSummary.review_count, hasPayoutAccount, isOwnProfile, listedWorksCount]);

  useEffect(() => {
    if (!profileTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(profileTabs[0]?.id ?? "overview");
    }
  }, [activeTab, profileTabs]);

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
            <ProfileStatChip label="Portfolio" value={String(listedWorksCount)} />
            <ProfileStatChip label="Followers" value={new Intl.NumberFormat("en-US").format(followerCount)} />
          </div>
        </div>
      </header>

      <section className="surface-card profile-tab-strip p-2">
        <div
          className="flex gap-2 overflow-x-auto pb-1 sm:pb-0"
          role="tablist"
          aria-label={isOwnProfile ? "Your profile sections" : "Creator profile sections"}
        >
          {profileTabs.map((tab) => (
            <ProfileTabButton
              key={tab.id}
              tab={tab}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>
      </section>

      {activeTab === "overview" ? (
        <section
          id="profile-tab-panel-overview"
          role="tabpanel"
          aria-labelledby="profile-tab-overview"
          className="mx-auto w-full max-w-5xl"
        >
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
                {isVerified ? (
                  <VerifiedBadge size="sm" />
                ) : isOwnProfile ? (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      verificationStatus === "pending"
                        ? "bg-cobalt-100 text-cobalt-700"
                        : verificationStatus === "rejected"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-sand-100 text-sand-600"
                    }`}
                  >
                    {verificationStatusLabel}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-sand-600">{profileQuery.data?.niche || "Creative entrepreneur"}</p>
              {isOwnProfile && userContactEmail ? <p className="mt-1 text-xs text-sand-500">{userContactEmail}</p> : null}
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <ProfileStatTile label="Category" value={creatorCategoryLabel} />
            <ProfileStatTile label="Portfolio" value={listedWorksLabel} />
            <ProfileStatTile label="Followers" value={new Intl.NumberFormat("en-US").format(followerCount)} />
          </div>

          <div className="mt-5 rounded-xl border border-sand-200 bg-sand-50/80 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-500">About</p>
            <p className="mt-1 text-sm leading-relaxed text-sand-700">{profileQuery.data?.bio || "No bio added yet."}</p>
          </div>

          <div className="mt-5 rounded-xl border border-sand-200 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-500">Creator rating</p>
            <div className="mt-1 flex items-center gap-2 text-sm text-sand-700">
              <StarRating value={creatorRatingSummary.average_rating} />
              <span>
                {creatorRatingSummary.review_count > 0
                  ? `${creatorRatingSummary.average_rating.toFixed(1)}/5 from ${creatorRatingSummary.review_count} review${
                      creatorRatingSummary.review_count === 1 ? "" : "s"
                    }`
                  : "No reviews yet"}
              </span>
            </div>
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
                <button
                  type="button"
                  onClick={() => setActiveTab("edit")}
                  className="rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink transition hover:bg-sand-100"
                >
                  Edit profile
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("payout")}
                  className="rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink transition hover:bg-sand-100"
                >
                  {hasPayoutAccount ? "Manage payout" : "Set up payout"}
                </button>
                <Link
                  to="/dashboard/upload"
                  className="rounded-full bg-cobalt-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-cobalt-700"
                >
                  Upload Asset
                </Link>
              </>
            ) : (
              <>
                {user ? (
                  <button
                    type="button"
                    onClick={() => followMutation.mutate(!isFollowing)}
                    disabled={followMutation.isPending}
                    className="rounded-full bg-cobalt-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {followMutation.isPending ? "Updating..." : isFollowing ? "Following" : "Follow creator"}
                  </button>
                ) : (
                  <Link
                    to="/auth"
                    className="rounded-full bg-cobalt-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-cobalt-700"
                  >
                    Sign in to follow
                  </Link>
                )}

                <Link
                  to="/market"
                  className="rounded-full border border-sand-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink transition hover:bg-sand-100"
                >
                  Explore Marketplace
                </Link>

                {canAcceptHireRequests ? (
                  <button
                    type="button"
                    onClick={() => setHireModalOpen(true)}
                    className="rounded-full border border-cobalt-300 bg-cobalt-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cobalt-700 transition hover:bg-cobalt-100"
                  >
                    Hire creator
                  </button>
                ) : null}
              </>
            )}
          </div>
          </article>
        </section>
      ) : null}

      {activeTab === "reviews" ? (
        <section
          id="profile-tab-panel-reviews"
          role="tabpanel"
          aria-labelledby="profile-tab-reviews"
          className="mx-auto w-full max-w-5xl"
        >
          <article className="surface-card p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cobalt-600">Trust signals</p>
                <h3 className="mt-1 font-display text-2xl font-bold text-ink">Creator Reviews</h3>
              </div>
              <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-sand-700">
                {creatorRatingSummary.review_count} total
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2 text-sm text-sand-700">
              <StarRating value={creatorRatingSummary.average_rating} />
              <span>
                {creatorRatingSummary.review_count > 0
                  ? `${creatorRatingSummary.average_rating.toFixed(1)}/5 average`
                  : "No creator reviews yet"}
              </span>
            </div>

            {!isOwnProfile ? (
              <div className="mt-4">
                {canLeaveCreatorReview ? (
                  <form
                    className="space-y-3 rounded-xl border border-sand-200 bg-sand-50 p-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      creatorReviewMutation.mutate();
                    }}
                  >
                    <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-sand-600">Your rating</label>
                    <StarRating value={creatorReviewRating} onChange={setCreatorReviewRating} />

                    <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-sand-600">Your review</label>
                    <textarea
                      rows={3}
                      value={creatorReviewText}
                      onChange={(event) => setCreatorReviewText(event.target.value)}
                      className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
                      placeholder="Share your experience buying from this creator."
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={creatorReviewMutation.isPending}
                        className="rounded-full bg-cobalt-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {creatorReviewMutation.isPending ? "Saving..." : existingCreatorReview ? "Update review" : "Submit review"}
                      </button>

                      {existingCreatorReview ? (
                        <button
                          type="button"
                          onClick={() => deleteCreatorReviewMutation.mutate()}
                          disabled={deleteCreatorReviewMutation.isPending}
                          className="rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-sand-700 transition hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deleteCreatorReviewMutation.isPending ? "Removing..." : "Delete review"}
                        </button>
                      ) : null}
                    </div>
                  </form>
                ) : (
                  <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5 text-xs text-sand-700">
                    {user
                      ? "You can review this creator after completing at least one paid order from their catalog."
                      : "Sign in to follow this creator and leave reviews after purchase."}
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {creatorReviewsQuery.isLoading ? <p className="text-sm text-sand-600">Loading creator reviews...</p> : null}
              {!creatorReviewsQuery.isLoading && creatorReviews.length === 0 ? <p className="text-sm text-sand-600">No reviews yet.</p> : null}
              {creatorReviews.slice(0, 8).map((review) => (
                <article key={review.id} className="rounded-xl border border-sand-200 bg-white px-3 py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">{review.reviewer?.display_name ?? "Buyer"}</p>
                      <p className="text-xs text-sand-500">{new Date(review.created_at).toLocaleDateString("en-US")}</p>
                    </div>
                    <StarRating value={review.rating} size="sm" />
                  </div>
                  {review.review_text ? <p className="mt-2 text-sm text-sand-700">{review.review_text}</p> : null}
                </article>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {isOwnProfile && activeTab === "payout" ? (
        <section
          id="profile-tab-panel-payout"
          role="tabpanel"
          aria-labelledby="profile-tab-payout"
          className="mx-auto w-full max-w-4xl"
        >
          <article className="surface-card profile-payout-panel relative overflow-hidden border-2 border-sunset-200 bg-gradient-to-br from-sunset-50 via-white to-ember-50 p-5 shadow-glow md:p-6">
              <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sunset-200/70 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 left-8 h-36 w-36 rounded-full bg-cobalt-100/70 blur-3xl" />
              <div className="relative z-10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sunset-700">Critical setup</p>
                    <h3 className="mt-1 font-display text-2xl font-bold text-ink">Payout account</h3>
                    <p className="mt-1 text-sm text-sand-700">
                      This controls where creator earnings go after every sale and must be active before verification can be approved.
                    </p>
                  </div>
                  <span className="rounded-full bg-sunset-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sunset-700">
                    Required for verification
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
                      <p className="font-semibold uppercase tracking-[0.08em]">
                        {hasActivePayoutAccount ? "Payout connected" : "Payout needs attention"}
                      </p>
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
                    <p>Status: {hasActivePayoutAccount ? "Active and eligible for verification" : "Inactive"}</p>
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
        </section>
      ) : null}

      {isOwnProfile && activeTab === "edit" ? (
        <section
          id="profile-tab-panel-edit"
          role="tabpanel"
          aria-labelledby="profile-tab-edit"
          className="mx-auto w-full max-w-5xl"
        >
          <article className="surface-card profile-edit-panel profile-edit-panel-enhanced p-5 md:p-6">
            <div className="rounded-xl border border-cobalt-100 bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cobalt-700">Profile Editor</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink">Edit Profile</h2>
              <p className="mt-1 text-sm text-sand-600">
                Keep your profile complete and consistent for better buyer trust and discovery.
              </p>
            </div>
            <p className="mt-3 text-sm text-sand-600">
              Your public profile powers trust in marketplace listings, creator discovery, and verification review.
            </p>
            <div className="mt-4 rounded-2xl border border-sand-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cobalt-700">Verification</p>
                  <h3 className="mt-1 text-lg font-semibold text-ink">{verificationStatusLabel}</h3>
                  <p className="mt-1 text-sm text-sand-600">
                    Saving a complete profile and active payout setup automatically sends it to the admin review queue for verification.
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-full border border-sand-200 bg-sand-50 px-3 py-2">
                  {isVerified ? <VerifiedBadge size="sm" /> : null}
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-sand-700">
                    {verificationReadyCount}/{verificationChecklist.length} complete
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {verificationChecklist.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border px-3 py-3 ${
                      item.complete ? "border-forest-200 bg-forest-50/70" : "border-sand-200 bg-sand-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          item.complete ? "bg-forest-600 text-white" : "bg-sand-200 text-sand-600"
                        }`}
                      >
                        {item.complete ? "OK" : "."}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-ink">{item.label}</p>
                        <p className="mt-1 text-xs text-sand-600">{item.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {verificationRequest?.review_note ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {verificationRequest.review_note}
                </div>
              ) : null}
            </div>
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
                      {uploadAvatarMutation.isPending ? "Saving..." : "Save Photo"}
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
                  <Field label="Niche" value={niche} onChange={setNiche} required />
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

              <div className="rounded-xl border border-sand-200 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-sand-800">Hire settings</p>
                    <p className="mt-1 text-xs text-sand-500">
                      Turn your hire button on or off and set the terms clients must review before sending a hire request.
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-sand-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-sand-700">
                    <input
                      type="checkbox"
                      checked={hireEnabled}
                      onChange={(event) => setHireEnabled(event.target.checked)}
                      className="h-4 w-4 rounded border-sand-300 text-cobalt-600 focus:ring-cobalt-400"
                    />
                    Hire button {hireEnabled ? "On" : "Off"}
                  </label>
                </div>

                <div className="mt-4">
                  <Field label="Terms of hire" value={hireTerms} onChange={setHireTerms} multiline required />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-sand-800">Pricing visibility</p>
                  <p className="mt-1 text-xs text-sand-500">
                    Choose whether clients see an hourly rate, a package list, or a `DM to know` note before they reach out.
                  </p>

                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {HIRE_PRICING_OPTIONS.map((option) => {
                      const active = hirePricingMode === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setHirePricingMode(option.value)}
                          className={`rounded-2xl border px-4 py-4 text-left transition ${
                            active
                              ? "border-cobalt-300 bg-cobalt-50 shadow-[0_18px_30px_-26px_rgba(31,70,239,0.45)]"
                              : "border-sand-200 bg-white hover:border-cobalt-200 hover:bg-cobalt-50/40"
                          }`}
                        >
                          <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${active ? "text-cobalt-700" : "text-sand-500"}`}>
                            {option.eyebrow}
                          </p>
                          <p className={`mt-2 text-sm font-semibold ${active ? "text-cobalt-900" : "text-ink"}`}>{option.label}</p>
                          <p className={`mt-2 text-sm leading-6 ${active ? "text-cobalt-800" : "text-sand-600"}`}>{option.description}</p>
                        </button>
                      );
                    })}
                  </div>

                  {hirePricingMode === "hourly" ? (
                    <div className="mt-4 rounded-2xl border border-cobalt-100 bg-cobalt-50/70 p-4">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_8.5rem]">
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-sand-800">Hourly rate</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={hireHourlyRate}
                            onChange={(event) => setHireHourlyRate(event.target.value)}
                            className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-sand-800">Currency</span>
                          <input
                            value={hirePricingCurrency}
                            onChange={(event) => setHirePricingCurrency(event.target.value.toUpperCase())}
                            maxLength={6}
                            className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 uppercase outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100"
                          />
                        </label>
                      </div>
                      <p className="mt-2 text-xs text-cobalt-800">
                        {hourlyRatePreview ? `Clients will see ${hourlyRatePreview}/hr in the hire modal.` : "Clients will see your hourly rate in the hire modal."}
                      </p>
                    </div>
                  ) : null}

                  {hirePricingMode === "custom_list" ? (
                    <div className="mt-4 rounded-2xl border border-sand-200 bg-sand-50/70 p-4">
                      <Field label="Custom pricing list" value={hirePricingGuide} onChange={setHirePricingGuide} multiline />
                      <p className="mt-2 text-xs text-sand-500">
                        Use one line per offer, for example: `Brand package - from GHS 450` or `Monthly retainer - GHS 2,000`.
                      </p>
                    </div>
                  ) : null}

                  {hirePricingMode === "dm_to_know" ? (
                    <div className="mt-4 rounded-2xl border border-sand-200 bg-sand-50 px-4 py-4 text-sm leading-6 text-sand-700">
                      Clients will see `DM to know` and will need to describe their project before you share a quote.
                    </div>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-sand-500">
                  Clients will see these terms and your chosen pricing format in a modal before they can send a hire request to your account.
                </p>
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
        </section>
      ) : null}

      {activeTab === "portfolio" ? (
        <section
          id="profile-tab-panel-portfolio"
          role="tabpanel"
          aria-labelledby="profile-tab-portfolio"
          className="space-y-3"
        >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-bold text-ink">{isOwnProfile ? "Your Portfolio" : "Portfolio"}</h2>
          <span className="rounded-full border border-sand-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700">
            {listedWorksLabel}
          </span>
        </div>

        {assetsQuery.isLoading ? <div className="surface-card p-5 text-sm text-sand-600">Loading listings...</div> : null}
        {assetsQuery.isError ? <div className="surface-card p-5 text-sm text-rose-700">Could not load listings.</div> : null}
        {assetsQuery.data && portfolioAssets.length === 0 ? (
          <EmptyState
            title="No listings yet"
            body={isOwnProfile ? "Publish your first listing to start selling." : "This creator has no published listings yet."}
          />
        ) : null}
        {assetsQuery.data && portfolioAssets.length > 0 ? <AssetGrid assets={portfolioAssets} /> : null}
        </section>
      ) : null}

      {!isOwnProfile ? (
        <HireCreatorModal
          open={hireModalOpen}
          creatorId={profileId}
          creatorName={profileName}
          onClose={() => setHireModalOpen(false)}
        />
      ) : null}
    </div>
  );
}

function majorInputFromKobo(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "";
  }

  const majorValue = value / 100;
  return Number.isInteger(majorValue) ? String(majorValue) : majorValue.toFixed(2).replace(/\.?0+$/, "");
}

function ProfileTabButton({
  tab,
  active,
  onClick
}: {
  tab: ProfileTabOption;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      id={`profile-tab-${tab.id}`}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={`profile-tab-panel-${tab.id}`}
      onClick={onClick}
      className={`profile-tab-button ${PROFILE_TAB_TONE_CLASS[tab.id]} ${active ? "profile-tab-button-active" : ""}`}
    >
      <span>{tab.label}</span>
      {tab.badge ? <span className="profile-tab-badge">{tab.badge}</span> : null}
    </button>
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

