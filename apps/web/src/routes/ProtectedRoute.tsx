import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { PageLoader } from "@/components/PageLoader";
import { useAuthStore } from "@/store/authStore";

type ProtectedRouteProps = {
  children?: ReactNode;
  signInPath?: string;
};

export function ProtectedRoute({ children, signInPath = "/auth" }: ProtectedRouteProps) {
  const initialized = useAuthStore((state) => state.initialized);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!initialized) {
    return <PageLoader label="Loading session" fullHeight />;
  }

  if (!user) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`${signInPath}?redirect=${redirect}`} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
