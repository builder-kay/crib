import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Modal } from "@/components/Modal";
import { getUserIdentityLabel } from "@/lib/auth";
import { getProfile, getUnreadNotificationsCount, getWishlistCount, isCurrentUserAdmin, isCurrentUserEditorialAdmin } from "@/lib/api";
import { routePreloaders } from "@/routes/pageLoaders";
import { useAuthStore } from "@/store/authStore";

const baseNavItems = [
{ to: "/market", label: "Ghetto" },
  { to: "/sell", label: "Sell" },
  { to: "/creators", label: "Creators" },
  { to: "/editorial", label: "Blog" }
];

type MobilePrimaryNavId = "discover" | "sell" | "creators" | "editorial" | "dashboard";

type NavItem = {
  to: string;
  label: string;
  preload?: () => Promise<void>;
};

type MobilePrimaryNavItem = {
  id: MobilePrimaryNavId;
  to: string;
  label: string;
  preload?: () => Promise<void>;
};

function prefetchRoute(preload?: () => Promise<void>) {
  if (!preload) {
    return;
  }

  void preload();
}

function isMobilePrimaryNavActive(pathname: string, itemId: MobilePrimaryNavId) {
  switch (itemId) {
    case "discover":
      return pathname === "/market";
    case "creators":
      return pathname === "/creators";
    case "sell":
      return pathname === "/sell";
    case "editorial":
      return pathname === "/editorial" || pathname.startsWith("/editorial/");
    case "dashboard":
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
    default:
      return false;
  }
}

function MobilePrimaryNavIcon({ id }: { id: MobilePrimaryNavId }) {
  const sharedProps = {
    className: "h-5 w-5 text-current transition",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  } as const;

  switch (id) {
    case "discover":
      return (
        <svg {...sharedProps}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "creators":
      return (
        <svg {...sharedProps}>
          <path d="M16 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" />
          <circle cx="10" cy="7" r="3" />
          <path d="M20 20v-1a4 4 0 0 0-3-3.87" />
          <path d="M16 4.13a3 3 0 0 1 0 5.74" />
        </svg>
      );
    case "sell":
      return (
        <svg {...sharedProps}>
          <path d="M12 17V6" />
          <path d="m7.5 10.5 4.5-4.5 4.5 4.5" />
          <path d="M5 19h14" />
        </svg>
      );
    case "editorial":
      return (
        <svg {...sharedProps}>
          <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21V5.5Z" />
          <path d="M5 6h11" />
          <path d="M8 8.5h7" />
          <path d="M8 12h7" />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...sharedProps}>
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="5" rx="2" />
          <rect x="13" y="10" width="8" height="11" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
        </svg>
      );
    default:
      return null;
  }
}

export function Navbar({ theme, onToggleTheme }: { theme: "light" | "dark"; onToggleTheme: () => void }) {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const location = useLocation();
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const mobileNavScrollRef = useRef<HTMLDivElement | null>(null);
  const [mobileNavCanScrollLeft, setMobileNavCanScrollLeft] = useState(false);
  const [mobileNavCanScrollRight, setMobileNavCanScrollRight] = useState(false);
  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: Boolean(user?.id)
  });

  const unreadNotificationsQuery = useQuery({
    queryKey: ["notifications-unread", user?.id],
    queryFn: () => getUnreadNotificationsCount(user!.id),
    enabled: Boolean(user?.id)
  });

  const wishlistCountQuery = useQuery({
    queryKey: ["wishlist-count", user?.id],
    queryFn: () => getWishlistCount(user!.id),
    enabled: Boolean(user?.id)
  });

  const adminQuery = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: () => isCurrentUserAdmin(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000
  });

  const editorialAdminQuery = useQuery({
    queryKey: ["is-editorial-admin", user?.id],
    queryFn: () => isCurrentUserEditorialAdmin(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000
  });

  const navItems = useMemo(() => {
    const items: NavItem[] = [
      { ...baseNavItems[0], preload: routePreloaders.market },
      { ...baseNavItems[1], preload: routePreloaders.sell },
      { ...baseNavItems[2], preload: routePreloaders.creators },
      { ...baseNavItems[3], preload: routePreloaders.blog }
    ];
    if (user) {
      items.push({ to: "/dashboard", label: "Dashboard", preload: routePreloaders.dashboard });
      if (adminQuery.data === true) {
        items.push({ to: "/admin/overview", label: "Admin" });
      }
      if (editorialAdminQuery.data === true) {
        items.push({ to: "/editorial-admin", label: "Blog Desk", preload: routePreloaders.blogAdmin });
      }
    }
    return items;
  }, [adminQuery.data, editorialAdminQuery.data, user]);

  const mobilePrimaryNavItems = useMemo<MobilePrimaryNavItem[]>(
    () => [
{ id: "discover", to: "/market", label: "Ghetto", preload: routePreloaders.market },
      { id: "sell", to: "/sell", label: "Sell", preload: routePreloaders.sell },
      { id: "creators", to: "/creators", label: "Creators", preload: routePreloaders.creators },
      { id: "editorial", to: "/editorial", label: "Blog", preload: routePreloaders.blog },
      ...(user ? [{ id: "dashboard", to: "/dashboard", label: "Dashboard", preload: routePreloaders.dashboard } satisfies MobilePrimaryNavItem] : [])
    ],
    [user]
  );

  const accountLabel = useMemo(() => {
    const profileName = profileQuery.data?.display_name?.trim();
    if (profileName) {
      return profileName;
    }
    return getUserIdentityLabel(user, "Account");
  }, [profileQuery.data?.display_name, user]);

  const accountInitial = useMemo(() => accountLabel.charAt(0).toUpperCase() || "A", [accountLabel]);
  const isDarkTheme = theme === "dark";
  const mobileNavTrayClassName = isDarkTheme
    ? "border-[#263a5f] bg-[#0d1627]/96 shadow-[0_26px_48px_-20px_rgba(0,0,0,0.72)]"
    : "border-white/80 bg-white/95 shadow-[0_22px_40px_-18px_rgba(16,19,36,0.35)]";
  const mobileNavFadeLeftClassName = isDarkTheme
    ? "bg-gradient-to-r from-[#0d1627] via-[#0d1627]/92 to-[#0d1627]/0"
    : "bg-gradient-to-r from-white via-white/90 to-white/0";
  const mobileNavFadeRightClassName = isDarkTheme
    ? "bg-gradient-to-l from-[#0d1627] via-[#0d1627]/92 to-[#0d1627]/0"
    : "bg-gradient-to-l from-white via-white/90 to-white/0";
  const mobileNavArrowClassName = isDarkTheme
    ? "border-[#31466f] bg-[#142135]/96 text-[#d7e6ff] shadow-[0_12px_24px_-16px_rgba(0,0,0,0.82)] hover:border-[#486ca8] hover:bg-[#1b2d47] hover:text-white"
    : "border-cobalt-100 bg-white/96 text-cobalt-600 shadow-[0_10px_20px_-14px_rgba(16,19,36,0.45)] hover:bg-cobalt-50";
  const mobileNavActiveClassName = isDarkTheme
    ? "border border-[#6f93ff] bg-cobalt-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_18px_32px_-22px_rgba(20,81,255,0.82)]"
    : "bg-cobalt-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_14px_28px_-20px_rgba(31,70,239,1)]";
  const mobileNavInactiveClassName = isDarkTheme
    ? "border border-[#2e4265] bg-[#152237] text-[#dce8ff] hover:border-[#486ca8] hover:bg-[#1b2d47] hover:text-white"
    : "bg-cobalt-50 text-sand-700 hover:bg-cobalt-100 hover:text-cobalt-700";
  const mobileNavIndicatorClassName = isDarkTheme ? "bg-white opacity-100" : "bg-white/90 opacity-100";

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }

      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (location.pathname !== "/market") {
      return;
    }

    const params = new URLSearchParams(location.search);
    setGlobalSearch(params.get("q") ?? "");
  }, [location.pathname, location.search]);

  useEffect(() => {
    const scroller = mobileNavScrollRef.current;
    if (!scroller) {
      return;
    }

    const syncMobileNavScrollState = () => {
      const maxScrollLeft = Math.max(scroller.scrollWidth - scroller.clientWidth, 0);
      setMobileNavCanScrollLeft(scroller.scrollLeft > 10);
      setMobileNavCanScrollRight(scroller.scrollLeft < maxScrollLeft - 10);
    };

    const rafId = window.requestAnimationFrame(() => {
      const activeItem = scroller.querySelector<HTMLElement>('[aria-current="page"]');
      activeItem?.scrollIntoView({ inline: "center", block: "nearest" });
      syncMobileNavScrollState();
    });

    scroller.addEventListener("scroll", syncMobileNavScrollState, { passive: true });
    window.addEventListener("resize", syncMobileNavScrollState);

    return () => {
      window.cancelAnimationFrame(rafId);
      scroller.removeEventListener("scroll", syncMobileNavScrollState);
      window.removeEventListener("resize", syncMobileNavScrollState);
    };
  }, [location.pathname, mobilePrimaryNavItems.length]);

  function scrollMobileNav(direction: "left" | "right") {
    mobileNavScrollRef.current?.scrollBy({
      left: direction === "left" ? -220 : 220,
      behavior: "smooth"
    });
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-sand-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-5">
            <Link to="/" className="flex items-center gap-2">
<img src="/crib-logo.png" alt="Crib logo" className="h-10 w-10 rounded-full object-cover" decoding="async" />
              <p className="font-display text-xl font-bold leading-none text-ink">Crib</p>
            </Link>

            <div className="hidden items-center gap-1 lg:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onMouseEnter={() => prefetchRoute(item.preload)}
                  onFocus={() => prefetchRoute(item.preload)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      isActive ? "bg-sand-100 text-ink" : "text-sand-700 hover:bg-sand-100 hover:text-ink"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="hidden flex-1 justify-center md:flex">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = globalSearch.trim().replace(/\s+/g, " ");
                const nextParams = new URLSearchParams();
                if (trimmed) {
                  nextParams.set("q", trimmed);
                }
                nextParams.set("reset", "1");
                navigate(`/market?${nextParams.toString()}`);
              }}
              onFocus={() => prefetchRoute(routePreloaders.market)}
              className="flex w-full max-w-xl items-center gap-2 rounded-full border border-sand-200 bg-sand-100/80 px-4 py-2 text-sm text-sand-600 transition hover:border-cobalt-200 hover:bg-white focus-within:border-cobalt-300 focus-within:bg-white"
            >
              <svg className="h-4 w-4 text-sand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                placeholder="Search assets, creators, Canva, Figma, Photoshop..."
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-sand-500"
              />
              <button type="submit" className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white">
                Search
              </button>
            </form>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              className="theme-toggle-btn inline-flex h-10 w-10 items-center justify-center rounded-full border border-sand-300 bg-white text-sand-700 transition hover:bg-sand-100"
              aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              {theme === "light" ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Z" />
                  <path d="M12 18a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Z" />
                  <path d="M4.93 4.93a1 1 0 0 1 1.41 0l.7.7A1 1 0 0 1 5.63 7.04l-.7-.7a1 1 0 0 1 0-1.41Z" />
                  <path d="M17.66 17.66a1 1 0 0 1 1.41 0l.7.7a1 1 0 0 1-1.41 1.41l-.7-.7a1 1 0 0 1 0-1.41Z" />
                  <path d="M3 12a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Z" />
                  <path d="M18 12a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1Z" />
                  <path d="M4.93 19.07a1 1 0 0 1 0-1.41l.7-.7a1 1 0 1 1 1.41 1.41l-.7.7a1 1 0 0 1-1.41 0Z" />
                  <path d="M17.66 6.34a1 1 0 0 1 0-1.41l.7-.7a1 1 0 1 1 1.41 1.41l-.7.7a1 1 0 0 1-1.41 0Z" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
                </svg>
              )}
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/dashboard/notifications"
                  className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border text-sand-700 transition hover:bg-sand-100 ${
                    location.pathname.startsWith("/dashboard/notifications")
                      ? "border-cobalt-400 bg-cobalt-50 text-cobalt-700"
                      : "border-sand-300"
                  }`}
                  aria-label="Open alerts"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                    <path d="M10 17a2 2 0 1 0 4 0" />
                  </svg>

                  {(unreadNotificationsQuery.data ?? 0) > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-cobalt-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {(unreadNotificationsQuery.data ?? 0) > 99 ? "99+" : unreadNotificationsQuery.data}
                    </span>
                  ) : null}
                </Link>

                <Link
                  to="/dashboard/wishlist"
                  className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border text-sand-700 transition hover:bg-sand-100 ${
                    location.pathname.startsWith("/dashboard/wishlist")
                      ? "border-cobalt-400 bg-cobalt-50 text-cobalt-700"
                      : "border-sand-300"
                  }`}
                  aria-label="Open wishlist"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" />
                  </svg>

                  {(wishlistCountQuery.data ?? 0) > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-cobalt-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {(wishlistCountQuery.data ?? 0) > 99 ? "99+" : wishlistCountQuery.data}
                    </span>
                  ) : null}
                </Link>

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-sand-300 px-2.5 py-1.5 text-sm font-semibold text-ink transition hover:bg-sand-100"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-cobalt-100 text-xs font-bold text-cobalt-700">
                      {accountInitial}
                    </span>
                    <span className="hidden max-w-[180px] truncate text-sand-700 md:inline">{accountLabel}</span>
                    <svg className="h-4 w-4 text-sand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {menuOpen ? (
                    <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-sand-200 bg-white shadow-xl">
                      <Link
                        to="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-sand-100"
                      >
                        Profile
                      </Link>
                      {adminQuery.data === true ? (
                        <Link
                          to="/admin/overview"
                          onClick={() => setMenuOpen(false)}
                          className="block px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-sand-100"
                        >
                          Admin platform
                        </Link>
                      ) : null}
                      {editorialAdminQuery.data === true ? (
                        <Link
                          to="/editorial-admin"
                          onClick={() => setMenuOpen(false)}
                          className="block px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-sand-100"
                        >
                          Blog desk
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setConfirmSignOutOpen(true);
                        }}
                        className="block w-full px-4 py-2.5 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                      >
                        Sign out
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <Link
                to="/auth"
                className="rounded-full bg-cobalt-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cobalt-700"
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 bg-transparent lg:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
        aria-label="Primary navigation"
      >
        <div className="mx-auto max-w-[30rem] px-4 pt-2">
          <div className={`relative rounded-[2rem] border p-2 backdrop-blur-xl ${mobileNavTrayClassName}`}>
            {mobileNavCanScrollLeft ? (
              <>
                <div className={`pointer-events-none absolute inset-y-2 left-2 z-10 w-8 rounded-l-[1.6rem] ${mobileNavFadeLeftClassName}`} />
                <button
                  type="button"
                  onClick={() => scrollMobileNav("left")}
                  className={`absolute left-3 top-1/2 z-20 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border transition ${mobileNavArrowClassName}`}
                  aria-label="Scroll navigation left"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="m15 6-6 6 6 6" />
                  </svg>
                </button>
              </>
            ) : null}

            {mobileNavCanScrollRight ? (
              <>
                <div className={`pointer-events-none absolute inset-y-2 right-2 z-10 w-8 rounded-r-[1.6rem] ${mobileNavFadeRightClassName}`} />
                <button
                  type="button"
                  onClick={() => scrollMobileNav("right")}
                  className={`absolute right-3 top-1/2 z-20 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border transition ${mobileNavArrowClassName}`}
                  aria-label="Scroll navigation right"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              </>
            ) : null}

            <div
              ref={mobileNavScrollRef}
              className="grid grid-flow-col auto-cols-[calc((100%-1.5rem)/4)] gap-2 overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {mobilePrimaryNavItems.map((item) => {
                const isActive = isMobilePrimaryNavActive(location.pathname, item.id);

                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    aria-current={isActive ? "page" : undefined}
                    onMouseEnter={() => prefetchRoute(item.preload)}
                    onFocus={() => prefetchRoute(item.preload)}
                    className={`flex min-h-[72px] snap-start flex-col items-center justify-center gap-1 rounded-[1.2rem] px-1.5 py-2 text-center transition duration-200 ${
                      isActive ? mobileNavActiveClassName : mobileNavInactiveClassName
                    }`}
                  >
                    <MobilePrimaryNavIcon id={item.id} />
                    <span className={`text-[11px] leading-tight ${isActive ? "font-semibold" : "font-medium"}`}>{item.label}</span>
                    <span className={`mt-0.5 h-0.5 w-6 rounded-full transition ${isActive ? mobileNavIndicatorClassName : "bg-transparent opacity-0"}`} />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      <Modal open={confirmSignOutOpen} title="Confirm Sign Out" onClose={() => setConfirmSignOutOpen(false)}>
        <div className="space-y-3">
          <p className="text-sm text-sand-700">You are about to sign out of your account.</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmSignOutOpen(false)}
              className="w-full rounded-lg border border-sand-300 px-4 py-2 text-sm font-semibold text-ink hover:bg-sand-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                setConfirmSignOutOpen(false);
                await signOut();
                navigate("/");
              }}
              className="w-full rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
