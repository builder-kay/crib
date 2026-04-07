import { Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PageLoader } from "@/components/PageLoader";
import { AppLayout } from "@/routes/AppLayout";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { AdminProtectedRoute } from "@/routes/AdminProtectedRoute";
import {
  AdminCreatorsPage,
  AdminEditorsPage,
  AdminListingsPage,
  AdminOrdersPage,
  AdminOverviewPage,
  AdminPage,
  AdminSettingsPage,
  AssetDetailPage,
  AuthPage,
  CommunityPage,
  CookiePreferencesPage,
  CreatorsPage,
  DashboardLayoutPage,
  DashboardPage,
  EditorialAdminPage,
  EditorialPage,
  EditorialPostPage,
  HelpPage,
  LandingPage,
  MarketPage,
  NotFoundPage,
  NotificationsPage,
  OrdersPage,
  PrivacyChoicesPage,
  PrivacyPage,
  ProfilePage,
  TermsOfUsePage,
  UploadPage,
  WishlistPage
} from "@/routes/pageLoaders";

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
