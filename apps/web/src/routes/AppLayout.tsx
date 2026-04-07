import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppFooter } from "@/components/AppFooter";
import { Navbar } from "@/components/Navbar";
import { routePreloaders } from "@/routes/pageLoaders";

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
  const isReceiptPage = location.pathname.startsWith("/receipts/");
  const hasPreloadedRoutes = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("theme-dark", theme === "dark");
    root.style.colorScheme = theme;
    window.localStorage.setItem("crib-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (hasPreloadedRoutes.current || isAdminWorkspace) {
      return;
    }

    hasPreloadedRoutes.current = true;

    const preloadCommonRoutes = () => {
      void Promise.all([routePreloaders.market(), routePreloaders.creators(), routePreloaders.blog(), routePreloaders.auth()]);
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleCallbackId = window.requestIdleCallback(preloadCommonRoutes, { timeout: 1500 });
      return () => window.cancelIdleCallback(idleCallbackId);
    }

    const timeoutId = window.setTimeout(preloadCommonRoutes, 800);
    return () => window.clearTimeout(timeoutId);
  }, [isAdminWorkspace]);

  return (
    <div className={`min-h-screen text-ink transition-colors duration-300 ${isAdminWorkspace ? "admin-app-surface" : isReceiptPage ? "receipt-app-surface bg-sand-50" : "bg-sand-50"}`}>
      {!isAdminWorkspace ? <Navbar theme={theme} onToggleTheme={() => setTheme((current) => (current === "light" ? "dark" : "light"))} /> : null}
      <main
        className={
          isAdminWorkspace
            ? "w-full px-0 py-0"
            : isReceiptPage
              ? "mx-auto w-full max-w-[1240px] px-4 py-6 md:px-6 md:py-8"
              : "mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8"
        }
      >
        <Outlet />
      </main>
      {!isAdminWorkspace && !isReceiptPage ? <AppFooter /> : null}
    </div>
  );
}
