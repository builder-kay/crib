import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { isCurrentUserAdmin } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export function AdminProtectedRoute() {
  const initialized = useAuthStore((state) => state.initialized);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  const adminQuery = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: () => isCurrentUserAdmin(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000
  });

  if (!initialized) {
    return <AdminAccessState title="Loading session" body="Checking your current sign-in before opening the admin workspace." />;
  }

  if (!user) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/auth?redirect=${redirect}`} replace />;
  }

  if (adminQuery.isLoading) {
    return <AdminAccessState title="Checking admin access" body="Verifying that this account can open the marketplace admin workspace." />;
  }

  if (adminQuery.error) {
    return <AdminAccessState title="Could not verify access" body={adminQuery.error instanceof Error ? adminQuery.error.message : "Something went wrong while checking admin access."} />;
  }

  if (adminQuery.data !== true) {
    return (
      <AdminAccessState
        title="Admin only"
        body="This account is signed in, but it does not have marketplace-admin access."
        action={
          <Link to="/dashboard" className="admin-action-button">
            Go to dashboard
          </Link>
        }
      />
    );
  }

  return <Outlet />;
}

function AdminAccessState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-10 md:px-6">
      <section className="surface-card-vivid admin-hero-panel w-full p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Marketplace Admin</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm text-sand-700 md:text-base">{body}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </section>
    </div>
  );
}
