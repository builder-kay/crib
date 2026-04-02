import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppFooter } from "@/components/AppFooter";
import { Navbar } from "@/components/Navbar";

type AppTheme = "light" | "dark";

function readInitialTheme(): AppTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.localStorage.getItem("crib-theme") === "dark" ? "dark" : "light";
}

export function AppLayout() {
  const location = useLocation();
  const [theme, setTheme] = useState<AppTheme>(() => readInitialTheme());
  const isAdminWorkspace = location.pathname === "/admin" || location.pathname.startsWith("/admin/");

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("theme-dark", theme === "dark");
    root.style.colorScheme = theme;
    window.localStorage.setItem("crib-theme", theme);
  }, [theme]);

  return (
    <div className={`min-h-screen text-ink transition-colors duration-300 ${isAdminWorkspace ? "admin-app-surface" : "bg-sand-50"}`}>
      {!isAdminWorkspace ? <Navbar theme={theme} onToggleTheme={() => setTheme((current) => (current === "light" ? "dark" : "light"))} /> : null}
      <main className={isAdminWorkspace ? "w-full px-0 py-0" : "mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8"}>
        <Outlet />
      </main>
      {!isAdminWorkspace ? <AppFooter /> : null}
    </div>
  );
}
