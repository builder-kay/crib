import { createContext, useContext, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ActionConfirmationModal } from "@/components/ActionConfirmationModal";
import { useToast } from "@/components/Toast";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { getUserContactEmail, getUserIdentityLabel, getUserMobileNumber, maskPhoneNumber } from "@/lib/auth";
import { getAdminAssets, getAdminCreators, getAdminOrders, getAdminOverview, updateAssetStatus } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { describeProfileVerificationField, getVerificationStatusLabel } from "@/lib/profileVerification";
import type { AdminCreatorRecord, AdminOrderRecord, AdminOverview, Asset, Order } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

type AdminTone = "cobalt" | "lagoon" | "sunset" | "forest" | "rose";

type AdminNavItem = {
  id: "overview" | "listings" | "orders" | "creators" | "editors" | "settings";
  to: string;
  label: string;
  caption: string;
  tone: AdminTone;
  marker: string;
};

type AdminWorkspaceContextValue = {
  overview: AdminOverview | undefined;
  overviewLoading: boolean;
  assets: Asset[];
  assetsLoading: boolean;
  orders: AdminOrderRecord[];
  ordersLoading: boolean;
  creators: AdminCreatorRecord[];
  creatorsLoading: boolean;
  pendingAssetStatusId: string | null;
  setAssetStatus: (assetId: string, status: Asset["status"]) => void;
};

const adminNavItems: AdminNavItem[] = [
  {
    id: "overview",
    to: "/admin/overview",
    label: "Overview",
    caption: "Marketplace pulse and activity snapshots.",
    tone: "cobalt",
    marker: "OV"
  },
  {
    id: "listings",
    to: "/admin/listings",
    label: "Listings",
    caption: "Moderate uploads and publishing states.",
    tone: "lagoon",
    marker: "LS"
  },
  {
    id: "orders",
    to: "/admin/orders",
    label: "Orders",
    caption: "Track checkout flow and payment outcomes.",
    tone: "sunset",
    marker: "OD"
  },
  {
    id: "creators",
    to: "/admin/creators",
    label: "Creators",
    caption: "Review seller readiness, sales, and payouts.",
    tone: "forest",
    marker: "CR"
  },
  {
    id: "editors",
    to: "/admin/editors",
    label: "Editors",
    caption: "Provision separate blog logins.",
    tone: "rose",
    marker: "ED"
  },
  {
    id: "settings",
    to: "/admin/settings",
    label: "Settings",
    caption: "Manage footer socials and support.",
    tone: "cobalt",
    marker: "ST"
  }
];

const AdminWorkspaceContext = createContext<AdminWorkspaceContextValue | null>(null);

export function useAdminWorkspace() {
  const context = useContext(AdminWorkspaceContext);

  if (!context) {
    throw new Error("Admin workspace context is unavailable.");
  }

  return context;
}

export function AdminPage() {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { pushToast } = useToast();
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);
  const [adminSearch, setAdminSearch] = useState("");

  const overviewQuery = useQuery({
    queryKey: ["admin-overview"],
    queryFn: getAdminOverview,
    enabled: Boolean(user?.id)
  });

  const assetsQuery = useQuery({
    queryKey: ["admin-assets"],
    queryFn: getAdminAssets,
    enabled: Boolean(user?.id)
  });

  const ordersQuery = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => getAdminOrders(18),
    enabled: Boolean(user?.id)
  });

  const creatorsQuery = useQuery({
    queryKey: ["admin-creators"],
    queryFn: () => getAdminCreators(),
    enabled: Boolean(user?.id)
  });

  const statusMutation = useMutation({
    mutationFn: ({ assetId, status }: { assetId: string; status: Asset["status"] }) => updateAssetStatus(assetId, status),
    onSuccess: async () => {
      pushToast("Listing status updated", "success");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-assets"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-creators"] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Update failed", "error");
    }
  });

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      pushToast("Signed out of admin workspace", "success");
      navigate("/auth", { replace: true });
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not sign out", "error");
    }
  });

  const accountLabel = useMemo(() => getUserIdentityLabel(user, "Marketplace Admin"), [user]);
  const accountSecondary = useMemo(() => {
    const email = getUserContactEmail(user);
    if (email) {
      return email;
    }

    const phone = getUserMobileNumber(user);
    return phone ? maskPhoneNumber(phone) : "Back-office access";
  }, [user]);
  const accountInitial = useMemo(() => accountLabel.charAt(0).toUpperCase() || "A", [accountLabel]);
  const pendingVerificationCount = useMemo(
    () => (creatorsQuery.data ?? []).filter((creator) => creator.verification_request?.status === "pending").length,
    [creatorsQuery.data]
  );

  const navBadges = useMemo<Record<AdminNavItem["id"], string | null>>(
    () => ({
      overview: overviewQuery.isLoading ? "..." : `${overviewQuery.data?.total_profiles ?? 0}`,
      listings: overviewQuery.isLoading ? "..." : `${overviewQuery.data?.total_assets ?? assetsQuery.data?.length ?? 0}`,
      orders: overviewQuery.isLoading ? "..." : `${overviewQuery.data?.total_orders ?? ordersQuery.data?.length ?? 0}`,
      creators: creatorsQuery.isLoading ? "..." : pendingVerificationCount > 0 ? `${pendingVerificationCount} pending` : `${creatorsQuery.data?.length ?? 0}`,
      editors: "Access",
      settings: "Footer"
    }),
    [
      assetsQuery.data?.length,
      creatorsQuery.data?.length,
      creatorsQuery.isLoading,
      ordersQuery.data?.length,
      pendingVerificationCount,
      overviewQuery.data?.total_assets,
      overviewQuery.data?.total_orders,
      overviewQuery.data?.total_profiles,
      overviewQuery.isLoading
    ]
  );

  const sidebarGlance = useMemo(
    () => [
      {
        label: "Held in escrow",
        value: overviewQuery.isLoading ? "..." : `${overviewQuery.data?.escrow_pending_orders ?? 0}`,
        tone: "sunset" as const
      },
      {
        label: "Reported cases",
        value: overviewQuery.isLoading ? "..." : `${overviewQuery.data?.scam_reported_orders ?? 0}`,
        tone: "rose" as const
      },
      {
        label: "Pending verification",
        value: creatorsQuery.isLoading ? "..." : `${pendingVerificationCount}`,
        tone: "lagoon" as const
      }
    ],
    [creatorsQuery.isLoading, overviewQuery.data?.escrow_pending_orders, overviewQuery.data?.scam_reported_orders, overviewQuery.isLoading, pendingVerificationCount]
  );

  const activeNavItem = useMemo(
    () =>
      adminNavItems.find((item) =>
        location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
      ) ?? adminNavItems[0],
    [location.pathname]
  );

  const contextValue = useMemo<AdminWorkspaceContextValue>(
    () => ({
      overview: overviewQuery.data,
      overviewLoading: overviewQuery.isLoading,
      assets: assetsQuery.data ?? [],
      assetsLoading: assetsQuery.isLoading,
      orders: ordersQuery.data ?? [],
      ordersLoading: ordersQuery.isLoading,
      creators: creatorsQuery.data ?? [],
      creatorsLoading: creatorsQuery.isLoading,
      pendingAssetStatusId: statusMutation.isPending ? statusMutation.variables?.assetId ?? null : null,
      setAssetStatus: (assetId, status) => statusMutation.mutate({ assetId, status })
    }),
    [
      assetsQuery.data,
      assetsQuery.isLoading,
      creatorsQuery.data,
      creatorsQuery.isLoading,
      ordersQuery.data,
      ordersQuery.isLoading,
      overviewQuery.data,
      overviewQuery.isLoading,
      statusMutation
    ]
  );

  return (
    <AdminWorkspaceContext.Provider value={contextValue}>
      <div className="admin-workspace-frame">
        <div className="admin-console-shell">
          <aside className="admin-sidebar-shell">
            <div className="admin-sidebar-top">
              <Link to="/" className="admin-sidebar-brand">
                <img src="/crib-logo.png" alt="Crib logo" className="h-11 w-11 rounded-2xl object-cover shadow-[0_14px_28px_-18px_rgba(20,63,207,0.65)]" />
                <div>
                  <p className="admin-sidebar-brand-label">Crib Control</p>
                  <h1 className="admin-sidebar-brand-title">Marketplace Admin</h1>
                </div>
              </Link>

              <div className="admin-sidebar-account">
                <div className="admin-sidebar-avatar">{accountInitial}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{accountLabel}</p>
                  <p className="mt-1 truncate text-xs text-slate-300">{accountSecondary}</p>
                </div>
              </div>
            </div>

            <nav className="admin-sidebar-nav">
              {adminNavItems.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.to}
                  className={({ isActive }) => `admin-sidebar-link admin-sidebar-link-${item.tone} ${isActive ? "admin-sidebar-link-active" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`admin-sidebar-icon admin-sidebar-icon-${item.tone}`}>
                      <AdminNavIcon id={item.id} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 opacity-80">{item.caption}</p>
                    </div>
                    {navBadges[item.id] ? <span className="admin-sidebar-badge">{navBadges[item.id]}</span> : null}
                  </div>
                </NavLink>
              ))}
            </nav>

            <section className="admin-sidebar-glance">
              <div className="flex items-center justify-between gap-3">
                <p className="admin-sidebar-section-label">Ops Snapshot</p>
                <span className="admin-sidebar-section-badge">Live</span>
              </div>

              <div className="mt-3 grid gap-2">
                {sidebarGlance.map((item) => (
                  <div key={item.label} className={`admin-sidebar-glance-card admin-sidebar-glance-card-${item.tone}`}>
                    <p className="admin-sidebar-glance-label">{item.label}</p>
                    <p className="admin-sidebar-glance-value">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="admin-sidebar-actions">
              <Link to="/market" className="admin-action-button admin-action-button-secondary admin-action-button-full">
                View storefront
              </Link>
              <button
                type="button"
                onClick={() => setConfirmSignOutOpen(true)}
                className="admin-action-button admin-action-button-rose admin-action-button-full"
              >
                Sign out
              </button>
            </div>
          </aside>

          <section className="admin-workspace-content">
            <header className="admin-topbar">
              <label className="admin-topbar-search">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  value={adminSearch}
                  onChange={(event) => setAdminSearch(event.target.value)}
                  placeholder={`Search inside ${activeNavItem.label.toLowerCase()}...`}
                />
              </label>

              <div className="admin-topbar-actions">
                <span className="admin-topbar-icon-button" aria-hidden="true">
                  <AdminNavIcon id={activeNavItem.id} />
                </span>
                <Link to="/market" className="admin-topbar-icon-button" aria-label="Marketplace storefront">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 10h18" />
                    <path d="M5 6h14l1 4H4l1-4Z" />
                    <path d="M6 10v8h12v-8" />
                  </svg>
                </Link>
                <div className={`admin-topbar-pill admin-topbar-pill-${activeNavItem.tone}`}>
                  <span>{activeNavItem.label}</span>
                  <strong>{navBadges[activeNavItem.id] ?? activeNavItem.marker}</strong>
                </div>
              </div>
            </header>

            <div className="admin-page-frame">
              <div className={`admin-page-ribbon admin-page-ribbon-${activeNavItem.tone}`}>
                <div>
                  <p className="admin-page-ribbon-eyebrow">Workspace Lane</p>
                  <h2 className="admin-page-ribbon-title">{activeNavItem.label}</h2>
                </div>
                <div className="admin-page-ribbon-meta">
                  <span>{activeNavItem.caption}</span>
                  <strong>{navBadges[activeNavItem.id] ?? activeNavItem.marker}</strong>
                </div>
              </div>

              <div className="admin-page-body">
                <Outlet />
              </div>
            </div>
          </section>
        </div>
      </div>

      <ActionConfirmationModal
        open={confirmSignOutOpen}
        tone="rose"
        eyebrow="End Admin Session"
        title="Sign out of marketplace admin?"
        description="You are about to leave the admin workspace. You can sign back in any time with your marketplace-admin account."
        confirmLabel="Sign out"
        isPending={signOutMutation.isPending}
        onClose={() => {
          if (!signOutMutation.isPending) {
            setConfirmSignOutOpen(false);
          }
        }}
        onConfirm={() => {
          setConfirmSignOutOpen(false);
          signOutMutation.mutate();
        }}
        details={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="action-confirm-stat">
              <p className="action-confirm-stat-label">Workspace</p>
              <p className="action-confirm-stat-value">Marketplace Admin</p>
            </div>
            <div className="action-confirm-stat">
              <p className="action-confirm-stat-label">Account</p>
              <p className="action-confirm-stat-value">{accountSecondary}</p>
            </div>
          </div>
        }
      />
    </AdminWorkspaceContext.Provider>
  );
}

function AdminNavIcon({ id }: { id: AdminNavItem["id"] }) {
  if (id === "overview") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 13h6V4H4v9Z" />
        <path d="M14 20h6v-6h-6v6Z" />
        <path d="M14 10h6V4h-6v6Z" />
        <path d="M4 20h6v-3H4v3Z" />
      </svg>
    );
  }

  if (id === "listings") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h10" />
        <circle cx="18" cy="18" r="2" />
      </svg>
    );
  }

  if (id === "orders") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 7h12" />
        <path d="M6 12h12" />
        <path d="M6 17h8" />
        <path d="M4 4h16v16H4z" />
      </svg>
    );
  }

  if (id === "creators") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="8" r="3" />
        <path d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5" />
        <path d="M17 11c1.7 0 3 1.3 3 3" />
        <path d="M16 19c0-1.9 1.4-3.5 3.2-3.9" />
      </svg>
    );
  }

  if (id === "editors") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m4 19 4.5-1 8.8-8.8a1.7 1.7 0 0 0 0-2.4l-.9-.9a1.7 1.7 0 0 0-2.4 0L5.2 14.7 4 19Z" />
        <path d="M13.5 6.5 17.5 10.5" />
      </svg>
    );
  }

  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1 1 0 0 1 0 1.4l-1.1 1.1a1 1 0 0 1-1.4 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V21a1 1 0 0 1-1 1h-1.6a1 1 0 0 1-1-1v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1 1 0 0 1-1.4 0l-1.1-1.1a1 1 0 0 1 0-1.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H3a1 1 0 0 1-1-1v-1.6a1 1 0 0 1 1-1h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1 1 0 0 1 0-1.4l1.1-1.1a1 1 0 0 1 1.4 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V3a1 1 0 0 1 1-1h1.6a1 1 0 0 1 1 1v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1 1 0 0 1 1.4 0l1.1 1.1a1 1 0 0 1 0 1.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H21a1 1 0 0 1 1 1v1.6a1 1 0 0 1-1 1h-.2a1 1 0 0 0-.9.6Z" />
    </svg>
  );
}

export function SectionHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cobalt-700">{eyebrow}</p>
      <h2 className="mt-1 font-display text-2xl font-bold text-ink">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm text-sand-700">{body}</p>
    </div>
  );
}

export function MetricCard({ label, value, helper, tone }: { label: string; value: string; helper: string; tone: "cobalt" | "lagoon" | "sunset" | "forest" }) {
  return (
    <article className={`surface-card admin-metric-card admin-metric-card-${tone} p-4`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sand-600">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-sm text-sand-600">{helper}</p>
    </article>
  );
}

export function InsightCard({ label, value, helper, tone }: { label: string; value: string; helper: string; tone: "cobalt" | "forest" | "sunset" }) {
  return (
    <article className={`admin-mini-insight admin-mini-insight-${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm opacity-90">{helper}</p>
    </article>
  );
}

export function SignalRow({ label, value, tone }: { label: string; value: string; tone: "forest" | "lagoon" | "rose" | "sunset" }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-sand-200 bg-white/85 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className={`admin-signal-dot admin-signal-dot-${tone}`} />
        <p className="text-sm font-medium text-ink">{label}</p>
      </div>
      <p className="text-sm font-semibold text-sand-700">{value}</p>
    </div>
  );
}

export function SummaryPill({ label, value, tone }: { label: string; value: string; tone: "cobalt" | "forest" | "sunset" | "rose" | "lagoon" }) {
  return (
    <article className={`admin-summary-pill admin-summary-pill-${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </article>
  );
}

export function CreatorCard({
  creator,
  onReviewVerification,
  pendingVerificationAction
}: {
  creator: AdminCreatorRecord;
  onReviewVerification?: (decision: "approve" | "reject") => void;
  pendingVerificationAction?: "approve" | "reject" | null;
}) {
  const initial = creator.display_name.charAt(0).toUpperCase() || "C";
  const verification = creator.verification_request;
  const verificationStatus = verification?.status ?? (creator.is_verified ? "approved" : "incomplete");
  const missingFields = (verification?.missing_fields ?? []).map((field) => describeProfileVerificationField(field));
  const canReviewVerification = verificationStatus === "pending" && Boolean(onReviewVerification);

  return (
    <article className="admin-record-card">
      <div className="flex items-start gap-3">
        {creator.avatar_url ? <img src={creator.avatar_url} alt={creator.display_name} className="h-14 w-14 rounded-2xl object-cover" /> : <div className="grid h-14 w-14 place-items-center rounded-2xl bg-cobalt-100 text-lg font-bold text-cobalt-700">{initial}</div>}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/profile/${creator.id}`} className="truncate font-display text-xl font-semibold text-ink hover:text-cobalt-700">
              {creator.display_name}
            </Link>
            {creator.is_verified ? <VerifiedBadge size="sm" /> : null}
            <span className="admin-chip admin-chip-sand">{creator.creator_category}</span>
            {creator.seller_account_status === "warned" ? <span className="admin-chip admin-chip-sunset">Warned</span> : null}
            {creator.seller_account_status === "suspended" ? <span className="admin-chip admin-chip-rose">Suspended</span> : null}
          </div>
          <p className="mt-2 text-sm text-sand-700">{creator.bio?.trim() || "No bio added yet."}</p>
          {creator.seller_account_note?.trim() ? (
            <p className="mt-3 rounded-2xl border border-sunset-200 bg-sunset-50 px-4 py-3 text-sm text-sunset-800">
              Seller note: {creator.seller_account_note}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 admin-detail-grid">
        <StatMini label="Listings" value={`${creator.asset_count}`} />
        <StatMini label="Live" value={`${creator.published_assets}`} />
        <StatMini label="Sales" value={`${creator.sales_count}`} />
        <StatMini label="Followers" value={`${creator.follower_count}`} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="admin-chip admin-chip-forest">Wallet {formatCurrency(creator.wallet_balance_kobo, "GHS")}</span>
        <span className={`admin-chip ${creator.payout_account ? "admin-chip-cobalt" : "admin-chip-sand"}`}>
          {creator.payout_account ? `${creator.payout_account.payout_type === "mobile_money" ? "Mobile money" : "Bank"} payout - ${creator.payout_account.status}` : "No payout setup yet"}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-sand-200 bg-sand-50/80 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sand-500">Verification</p>
            <p className="mt-1 text-sm font-semibold text-ink">{getVerificationStatusLabel(verificationStatus)}</p>
          </div>
          {creator.is_verified ? (
            <VerifiedBadge size="sm" />
          ) : (
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                verificationStatus === "pending"
                  ? "bg-cobalt-100 text-cobalt-700"
                  : verificationStatus === "rejected"
                    ? "bg-rose-100 text-rose-700"
                    : "bg-sand-200 text-sand-700"
              }`}
            >
              {verificationStatus}
            </span>
          )}
        </div>

        {verification?.is_profile_complete ? (
          <p className="mt-2 text-sm text-sand-700">This creator has completed the required profile details and is ready for admin review.</p>
        ) : (
          <p className="mt-2 text-sm text-sand-700">
            Missing details: {missingFields.length > 0 ? missingFields.join(", ") : "Profile details still need more work."}
          </p>
        )}

        {verification?.review_note ? (
          <p className="mt-3 rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-700">{verification.review_note}</p>
        ) : null}

        {canReviewVerification ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onReviewVerification?.("approve")}
              disabled={pendingVerificationAction !== null}
              className="rounded-full bg-cobalt-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingVerificationAction === "approve" ? "Approving..." : "Approve verification"}
            </button>
            <button
              type="button"
              onClick={() => onReviewVerification?.("reject")}
              disabled={pendingVerificationAction !== null}
              className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingVerificationAction === "reject" ? "Rejecting..." : "Reject"}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <article className="admin-stat-mini">
      <p className="admin-stat-mini-label">{label}</p>
      <p className="admin-stat-mini-value">{value}</p>
    </article>
  );
}

export function assetStatusChip(status: Asset["status"]) {
  if (status === "published") {
    return "rounded-full bg-cobalt-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-cobalt-700";
  }
  if (status === "draft") {
    return "rounded-full bg-sunset-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-sunset-700";
  }
  return "rounded-full bg-sand-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700";
}

export function orderStatusChip(status: Order["status"]) {
  if (status === "paid") {
    return "rounded-full bg-forest-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-forest-700";
  }
  if (status === "pending") {
    return "rounded-full bg-sunset-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-sunset-700";
  }
  if (status === "failed") {
    return "rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700";
  }
  return "rounded-full bg-lagoon-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-lagoon-700";
}
