import { createContext, useContext, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { ActionConfirmationModal } from "@/components/ActionConfirmationModal";
import { useToast } from "@/components/Toast";
import { getUserContactEmail, getUserIdentityLabel, getUserMobileNumber, maskPhoneNumber } from "@/lib/auth";
import { getAdminAssets, getAdminCreators, getAdminOrders, getAdminOverview, updateAssetStatus } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { AdminCreatorRecord, AdminOrderRecord, AdminOverview, Asset, Order } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

type AdminTone = "cobalt" | "lagoon" | "sunset" | "forest" | "rose";

type AdminNavItem = {
  id: "overview" | "listings" | "orders" | "creators" | "editors" | "settings";
  to: string;
  label: string;
  caption: string;
  tone: AdminTone;
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
    tone: "cobalt"
  },
  {
    id: "listings",
    to: "/admin/listings",
    label: "Listings",
    caption: "Moderate uploads and publishing states.",
    tone: "lagoon"
  },
  {
    id: "orders",
    to: "/admin/orders",
    label: "Orders",
    caption: "Track checkout flow and payment outcomes.",
    tone: "sunset"
  },
  {
    id: "creators",
    to: "/admin/creators",
    label: "Creators",
    caption: "Review seller readiness, sales, and payouts.",
    tone: "forest"
  },
  {
    id: "editors",
    to: "/admin/editors",
    label: "Editors",
    caption: "Provision separate editorial logins.",
    tone: "rose"
  },
  {
    id: "settings",
    to: "/admin/settings",
    label: "Settings",
    caption: "Manage public footer social handles.",
    tone: "cobalt"
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
  const { pushToast } = useToast();
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);

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
    queryFn: () => getAdminCreators(18),
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

  const navBadges = useMemo<Record<AdminNavItem["id"], string | null>>(
    () => ({
      overview: overviewQuery.isLoading ? "..." : `${overviewQuery.data?.total_profiles ?? 0}`,
      listings: overviewQuery.isLoading ? "..." : `${overviewQuery.data?.total_assets ?? assetsQuery.data?.length ?? 0}`,
      orders: overviewQuery.isLoading ? "..." : `${overviewQuery.data?.total_orders ?? ordersQuery.data?.length ?? 0}`,
      creators: overviewQuery.isLoading ? "..." : `${overviewQuery.data?.active_creators ?? creatorsQuery.data?.length ?? 0}`,
      editors: "Access",
      settings: "Footer"
    }),
    [
      assetsQuery.data?.length,
      creatorsQuery.data?.length,
      ordersQuery.data?.length,
      overviewQuery.data?.active_creators,
      overviewQuery.data?.total_assets,
      overviewQuery.data?.total_orders,
      overviewQuery.data?.total_profiles,
      overviewQuery.isLoading
    ]
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
        <aside className="surface-card-vivid admin-sidebar-shell">
          <div className="admin-sidebar-top">
            <Link to="/" className="admin-sidebar-brand">
              <img src="/crib-logo.png" alt="CRIB logo" className="h-11 w-11 rounded-2xl object-cover shadow-[0_14px_28px_-18px_rgba(20,63,207,0.65)]" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cobalt-700">CRIB Back Office</p>
                <h1 className="mt-1 font-display text-2xl font-bold text-ink">Marketplace Admin</h1>
              </div>
            </Link>

            <div className="admin-sidebar-account">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cobalt-100 text-sm font-bold text-cobalt-700">{accountInitial}</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{accountLabel}</p>
                <p className="mt-1 truncate text-xs text-sand-600">{accountSecondary}</p>
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 opacity-80">{item.caption}</p>
                  </div>
                  {navBadges[item.id] ? <span className="admin-sidebar-badge">{navBadges[item.id]}</span> : null}
                </div>
              </NavLink>
            ))}
          </nav>

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
          <Outlet />
        </section>
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

export function CreatorCard({ creator }: { creator: AdminCreatorRecord }) {
  const initial = creator.display_name.charAt(0).toUpperCase() || "C";

  return (
    <article className="admin-record-card">
      <div className="flex items-start gap-3">
        {creator.avatar_url ? <img src={creator.avatar_url} alt={creator.display_name} className="h-14 w-14 rounded-2xl object-cover" /> : <div className="grid h-14 w-14 place-items-center rounded-2xl bg-cobalt-100 text-lg font-bold text-cobalt-700">{initial}</div>}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/profile/${creator.id}`} className="truncate font-display text-xl font-semibold text-ink hover:text-cobalt-700">
              {creator.display_name}
            </Link>
            {creator.is_verified ? <span className="admin-chip admin-chip-cobalt">Verified</span> : null}
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

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
    </article>
  );
}

export function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-sand-200 bg-white/85 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sand-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
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
