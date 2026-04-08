import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";

const dashboardTabs = [
  { to: "/dashboard", label: "Overview", end: true, tone: "cobalt", icon: <OverviewIcon /> },
  { to: "/dashboard/orders", label: "Orders", end: false, tone: "lagoon", icon: <OrdersIcon /> },
  { to: "/dashboard/upload", label: "Upload", end: false, tone: "sunset", icon: <UploadIcon /> },
  { to: "/dashboard/wishlist", label: "Wishlist", end: false, tone: "forest", icon: <WishlistIcon /> },
  { to: "/dashboard/notifications", label: "Alerts", end: false, tone: "rose", icon: <AlertsIcon /> }
] as const;

export function DashboardLayoutPage() {
  return (
    <div className="dashboard-shell space-y-4">
      <section className="surface-card dashboard-tab-strip p-2">
        <div className="flex flex-wrap gap-2">
          {dashboardTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `dashboard-tab-button tab-tone-${tab.tone} inline-flex items-center gap-2 ${isActive ? "dashboard-tab-button-active" : ""}`
              }
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-current shadow-sm">
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </section>

      <Outlet />
    </div>
  );
}

function TabIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function OverviewIcon() {
  return (
    <TabIcon>
      <path d="M4 13.5 12 5l8 8.5" />
      <path d="M6.5 11.5V20h11v-8.5" />
    </TabIcon>
  );
}

function OrdersIcon() {
  return (
    <TabIcon>
      <rect x="5" y="4.5" width="14" height="15" rx="2.5" />
      <path d="M8.5 9.5h7" />
      <path d="M8.5 13h7" />
      <path d="M8.5 16.5h4.5" />
    </TabIcon>
  );
}

function UploadIcon() {
  return (
    <TabIcon>
      <path d="M12 16.5V6" />
      <path d="m8.5 9.5 3.5-3.5 3.5 3.5" />
      <path d="M5 18.5h14" />
    </TabIcon>
  );
}

function WishlistIcon() {
  return (
    <TabIcon>
      <path d="M12 20s-6.5-3.9-8.2-7.7C2.7 9.7 4.3 6.5 7.6 6.5c1.7 0 3 1 4.4 2.5 1.4-1.5 2.7-2.5 4.4-2.5 3.3 0 4.9 3.2 3.8 5.8C18.5 16.1 12 20 12 20Z" />
    </TabIcon>
  );
}

function AlertsIcon() {
  return (
    <TabIcon>
      <path d="M12 4.5a4 4 0 0 0-4 4v2.2c0 .6-.2 1.3-.6 1.8L6 14.5h12l-1.4-2c-.4-.5-.6-1.2-.6-1.8V8.5a4 4 0 0 0-4-4Z" />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
    </TabIcon>
  );
}
