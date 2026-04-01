import { NavLink, Outlet } from "react-router-dom";

const dashboardTabs = [
  { to: "/dashboard", label: "Overview", end: true, tone: "cobalt" },
  { to: "/dashboard/orders", label: "Orders", end: false, tone: "lagoon" },
  { to: "/dashboard/upload", label: "Upload", end: false, tone: "sunset" },
  { to: "/dashboard/wishlist", label: "Wishlist", end: false, tone: "forest" },
  { to: "/dashboard/notifications", label: "Alerts", end: false, tone: "rose" }
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
                `dashboard-tab-button tab-tone-${tab.tone} ${isActive ? "dashboard-tab-button-active" : ""}`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </section>

      <Outlet />
    </div>
  );
}
