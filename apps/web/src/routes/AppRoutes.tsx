import { Suspense, lazy, type ComponentType } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PageLoader } from "@/components/PageLoader";
import { AppLayout } from "@/routes/AppLayout";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { AdminProtectedRoute } from "@/routes/AdminProtectedRoute";

function lazyPage<TModule extends Record<string, unknown>, TExport extends keyof TModule>(
  importer: () => Promise<TModule>,
  exportName: TExport
) {
  return lazy(async () => {
    const module = await importer();
    return { default: module[exportName] as ComponentType<any> };
  });
}

const LandingPage = lazyPage(() => import("@/pages/LandingPage"), "LandingPage");
const MarketPage = lazyPage(() => import("@/pages/MarketPage"), "MarketPage");
const CreatorsPage = lazyPage(() => import("@/pages/CreatorsPage"), "CreatorsPage");
const EditorialPage = lazyPage(() => import("@/pages/EditorialPage"), "EditorialPage");
const EditorialPostPage = lazyPage(() => import("@/pages/EditorialPostPage"), "EditorialPostPage");
const AssetDetailPage = lazyPage(() => import("@/pages/AssetDetailPage"), "AssetDetailPage");
const AuthPage = lazyPage(() => import("@/pages/AuthPage"), "AuthPage");
const OrdersPage = lazyPage(() => import("@/pages/OrdersPage"), "OrdersPage");
const DashboardPage = lazyPage(() => import("@/pages/DashboardPage"), "DashboardPage");
const DashboardLayoutPage = lazyPage(() => import("@/pages/DashboardLayoutPage"), "DashboardLayoutPage");
const UploadPage = lazyPage(() => import("@/pages/UploadPage"), "UploadPage");
const WishlistPage = lazyPage(() => import("@/pages/WishlistPage"), "WishlistPage");
const NotificationsPage = lazyPage(() => import("@/pages/NotificationsPage"), "NotificationsPage");
const ProfilePage = lazyPage(() => import("@/pages/ProfilePage"), "ProfilePage");
const TermsOfUsePage = lazyPage(() => import("@/pages/FooterInfoPages"), "TermsOfUsePage");
const PrivacyPage = lazyPage(() => import("@/pages/FooterInfoPages"), "PrivacyPage");
const CommunityPage = lazyPage(() => import("@/pages/FooterInfoPages"), "CommunityPage");
const HelpPage = lazyPage(() => import("@/pages/FooterInfoPages"), "HelpPage");
const CookiePreferencesPage = lazyPage(() => import("@/pages/FooterInfoPages"), "CookiePreferencesPage");
const PrivacyChoicesPage = lazyPage(() => import("@/pages/FooterInfoPages"), "PrivacyChoicesPage");
const AdminPage = lazyPage(() => import("@/pages/AdminPage"), "AdminPage");
const AdminOverviewPage = lazyPage(() => import("@/pages/AdminPage"), "AdminOverviewPage");
const AdminListingsPage = lazyPage(() => import("@/pages/AdminPage"), "AdminListingsPage");
const AdminOrdersPage = lazyPage(() => import("@/pages/AdminPage"), "AdminOrdersPage");
const AdminCreatorsPage = lazyPage(() => import("@/pages/AdminPage"), "AdminCreatorsPage");
const AdminEditorsPage = lazyPage(() => import("@/pages/AdminPage"), "AdminEditorsPage");
const AdminSettingsPage = lazyPage(() => import("@/pages/AdminPage"), "AdminSettingsPage");
const EditorialAdminPage = lazyPage(() => import("@/pages/EditorialAdminPage"), "EditorialAdminPage");
const NotFoundPage = lazyPage(() => import("@/pages/NotFoundPage"), "NotFoundPage");

function RouteLoader() {
  return <PageLoader label="Loading page" fullHeight />;
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/market" element={<MarketPage />} />
            <Route path="/creators" element={<CreatorsPage />} />
            <Route path="/editorial" element={<EditorialPage />} />
            <Route path="/editorial/:slug" element={<EditorialPostPage />} />
            <Route path="/asset/:id" element={<AssetDetailPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/editorial-login" element={<AuthPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/terms-of-use" element={<TermsOfUsePage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/cookie-preferences" element={<CookiePreferencesPage />} />
            <Route path="/do-not-sell-or-share" element={<PrivacyChoicesPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/profile/:id" element={<ProfilePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/dashboard" element={<DashboardLayoutPage />}>
                <Route index element={<DashboardPage />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="upload" element={<UploadPage />} />
                <Route path="wishlist" element={<WishlistPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
              </Route>
              <Route path="/wishlist" element={<Navigate to="/dashboard/wishlist" replace />} />
              <Route path="/notifications" element={<Navigate to="/dashboard/notifications" replace />} />
              <Route path="/upload" element={<Navigate to="/dashboard/upload" replace />} />
            </Route>

            <Route element={<AdminProtectedRoute />}>
              <Route path="/admin" element={<AdminPage />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<AdminOverviewPage />} />
                <Route path="listings" element={<AdminListingsPage />} />
                <Route path="orders" element={<AdminOrdersPage />} />
                <Route path="creators" element={<AdminCreatorsPage />} />
                <Route path="editors" element={<AdminEditorsPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute signInPath="/editorial-login" />}>
              <Route path="/editorial-admin" element={<EditorialAdminPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
