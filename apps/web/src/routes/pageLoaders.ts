import { lazy, type ComponentType } from "react";

function createLazyPage<TModule extends Record<string, unknown>, TExport extends keyof TModule>(
  importer: () => Promise<TModule>,
  exportName: TExport
) {
  let importPromise: Promise<TModule> | null = null;

  const loadModule = () => {
    importPromise ??= importer();
    return importPromise;
  };

  const Component = lazy(async () => {
    const module = await loadModule();
    return { default: module[exportName] as ComponentType<any> };
  });

  return {
    Component,
    preload: async () => {
      await loadModule();
    }
  };
}

const landingPage = createLazyPage(() => import("@/pages/LandingPage"), "LandingPage");
const marketPage = createLazyPage(() => import("@/pages/MarketPage"), "MarketPage");
const hirePage = createLazyPage(() => import("@/pages/HirePage"), "HirePage");
const editorialPage = createLazyPage(() => import("@/pages/EditorialPage"), "EditorialPage");
const editorialPostPage = createLazyPage(() => import("@/pages/EditorialPostPage"), "EditorialPostPage");
const assetDetailPage = createLazyPage(() => import("@/pages/AssetDetailPage"), "AssetDetailPage");
const authPage = createLazyPage(() => import("@/pages/AuthPage"), "AuthPage");
const ordersPage = createLazyPage(() => import("@/pages/OrdersPage"), "OrdersPage");
const receiptPage = createLazyPage(() => import("@/pages/ReceiptPage"), "ReceiptPage");
const dashboardPage = createLazyPage(() => import("@/pages/DashboardPage"), "DashboardPage");
const dashboardLayoutPage = createLazyPage(() => import("@/pages/DashboardLayoutPage"), "DashboardLayoutPage");
const uploadPage = createLazyPage(() => import("@/pages/UploadPage"), "UploadPage");
const wishlistPage = createLazyPage(() => import("@/pages/WishlistPage"), "WishlistPage");
const notificationsPage = createLazyPage(() => import("@/pages/NotificationsPage"), "NotificationsPage");
const profilePage = createLazyPage(() => import("@/pages/ProfilePage"), "ProfilePage");
const termsOfUsePage = createLazyPage(() => import("@/pages/FooterInfoPages"), "TermsOfUsePage");
const privacyPage = createLazyPage(() => import("@/pages/FooterInfoPages"), "PrivacyPage");
const communityPage = createLazyPage(() => import("@/pages/FooterInfoPages"), "CommunityPage");
const helpPage = createLazyPage(() => import("@/pages/FooterInfoPages"), "HelpPage");
const cookiePreferencesPage = createLazyPage(() => import("@/pages/FooterInfoPages"), "CookiePreferencesPage");
const privacyChoicesPage = createLazyPage(() => import("@/pages/FooterInfoPages"), "PrivacyChoicesPage");
const adminPage = createLazyPage(() => import("@/pages/AdminPage"), "AdminPage");
const adminOverviewPage = createLazyPage(() => import("@/pages/AdminPage"), "AdminOverviewPage");
const adminListingsPage = createLazyPage(() => import("@/pages/AdminPage"), "AdminListingsPage");
const adminOrdersPage = createLazyPage(() => import("@/pages/AdminPage"), "AdminOrdersPage");
const adminCreatorsPage = createLazyPage(() => import("@/pages/AdminPage"), "AdminCreatorsPage");
const adminEditorsPage = createLazyPage(() => import("@/pages/AdminPage"), "AdminEditorsPage");
const adminSettingsPage = createLazyPage(() => import("@/pages/AdminPage"), "AdminSettingsPage");
const editorialAdminPage = createLazyPage(() => import("@/pages/EditorialAdminPage"), "EditorialAdminPage");
const notFoundPage = createLazyPage(() => import("@/pages/NotFoundPage"), "NotFoundPage");

export const LandingPage = landingPage.Component;
export const MarketPage = marketPage.Component;
export const HirePage = hirePage.Component;
export const EditorialPage = editorialPage.Component;
export const EditorialPostPage = editorialPostPage.Component;
export const AssetDetailPage = assetDetailPage.Component;
export const AuthPage = authPage.Component;
export const OrdersPage = ordersPage.Component;
export const ReceiptPage = receiptPage.Component;
export const DashboardPage = dashboardPage.Component;
export const DashboardLayoutPage = dashboardLayoutPage.Component;
export const UploadPage = uploadPage.Component;
export const WishlistPage = wishlistPage.Component;
export const NotificationsPage = notificationsPage.Component;
export const ProfilePage = profilePage.Component;
export const TermsOfUsePage = termsOfUsePage.Component;
export const PrivacyPage = privacyPage.Component;
export const CommunityPage = communityPage.Component;
export const HelpPage = helpPage.Component;
export const CookiePreferencesPage = cookiePreferencesPage.Component;
export const PrivacyChoicesPage = privacyChoicesPage.Component;
export const AdminPage = adminPage.Component;
export const AdminOverviewPage = adminOverviewPage.Component;
export const AdminListingsPage = adminListingsPage.Component;
export const AdminOrdersPage = adminOrdersPage.Component;
export const AdminCreatorsPage = adminCreatorsPage.Component;
export const AdminEditorsPage = adminEditorsPage.Component;
export const AdminSettingsPage = adminSettingsPage.Component;
export const EditorialAdminPage = editorialAdminPage.Component;
export const NotFoundPage = notFoundPage.Component;

export const routePreloaders = {
  landing: () => landingPage.preload(),
  market: () => marketPage.preload(),
  hire: () => hirePage.preload(),
  creators: () => hirePage.preload(),
  sell: () => uploadPage.preload(),
  blog: () => editorialPage.preload(),
  blogPost: () => editorialPostPage.preload(),
  assetDetail: () => assetDetailPage.preload(),
  auth: () => authPage.preload(),
  receipt: () => receiptPage.preload(),
  dashboard: async () => {
    await Promise.all([dashboardLayoutPage.preload(), dashboardPage.preload()]);
  },
  upload: async () => {
    await Promise.all([dashboardLayoutPage.preload(), uploadPage.preload()]);
  },
  wishlist: async () => {
    await Promise.all([dashboardLayoutPage.preload(), wishlistPage.preload()]);
  },
  notifications: async () => {
    await Promise.all([dashboardLayoutPage.preload(), notificationsPage.preload()]);
  },
  profile: () => profilePage.preload(),
  blogAdmin: () => editorialAdminPage.preload()
};
