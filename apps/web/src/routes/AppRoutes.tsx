import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/routes/AppLayout";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { LandingPage } from "@/pages/LandingPage";
import { MarketPage } from "@/pages/MarketPage";
import { AssetDetailPage } from "@/pages/AssetDetailPage";
import { AuthPage } from "@/pages/AuthPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DashboardLayoutPage } from "@/pages/DashboardLayoutPage";
import { UploadPage } from "@/pages/UploadPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { AdminPage } from "@/pages/AdminPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { CreatorsPage } from "@/pages/CreatorsPage";
import { EditorialPage } from "@/pages/EditorialPage";
import { EditorialPostPage } from "@/pages/EditorialPostPage";
import { EditorialAdminPage } from "@/pages/EditorialAdminPage";
import { WishlistPage } from "@/pages/WishlistPage";
import { NotificationsPage } from "@/pages/NotificationsPage";

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/creators" element={<CreatorsPage />} />
          <Route path="/editorial" element={<EditorialPage />} />
          <Route path="/editorial/:slug" element={<EditorialPostPage />} />
          <Route path="/asset/:id" element={<AssetDetailPage />} />
          <Route path="/profile/:id" element={<ProfilePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/orders" element={<OrdersPage />} />

          <Route element={<ProtectedRoute />}>
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
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/editorial-admin" element={<EditorialAdminPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
