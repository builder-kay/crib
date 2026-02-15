import { NavLink, Outlet } from "react-router-dom";

const dashboardTabs = [
  { to: "/dashboard", label: "Overview", end: true },
  { to: "/dashboard/orders", label: "Orders", end: false },
  { to: "/dashboard/upload", label: "Upload", end: false }
] as const;

export function DashboardLayoutPage() {
  return (
    <div className="space-y-4">
      <section className="surface-card p-2">
        <div className="flex flex-wrap gap-2">
          {dashboardTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  isActive ? "bg-cobalt-600 text-white" : "border border-sand-200 bg-white text-sand-700 hover:bg-sand-100"
                }`
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
