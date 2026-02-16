import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Modal } from "@/components/Modal";
import { getProfile, getUnreadReleaseNotificationsCount, getWishlistCount } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

const baseNavItems = [
  { to: "/market", label: "Discover" },
  { to: "/creators", label: "Creators" },
  { to: "/editorial", label: "Editorial" }
];

export function Navbar() {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const location = useLocation();
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: Boolean(user?.id)
  });

  const unreadNotificationsQuery = useQuery({
    queryKey: ["release-notifications-unread", user?.id],
    queryFn: () => getUnreadReleaseNotificationsCount(user!.id),
    enabled: Boolean(user?.id)
  });

  const wishlistCountQuery = useQuery({
    queryKey: ["wishlist-count", user?.id],
    queryFn: () => getWishlistCount(user!.id),
    enabled: Boolean(user?.id)
  });

  const navItems = useMemo(() => {
    const items = [...baseNavItems];
    if (user) {
      items.push({ to: "/dashboard", label: "Dashboard" });
    }
    return items;
  }, [user]);

  const accountLabel = useMemo(() => {
    const profileName = profileQuery.data?.display_name?.trim();
    if (profileName) {
      return profileName;
    }
    if (!user?.email) {
      return "Account";
    }
    return user.email.split("@")[0] ?? "Account";
  }, [profileQuery.data?.display_name, user?.email]);

  const accountInitial = useMemo(() => accountLabel.charAt(0).toUpperCase() || "A", [accountLabel]);

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
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== "/market") {
      setGlobalSearch("");
      return;
    }

    const params = new URLSearchParams(location.search);
    setGlobalSearch(params.get("q") ?? "");
  }, [location.pathname, location.search]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-sand-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-5">
            <Link to="/" className="flex items-center gap-2">
              <img src="/crib-logo.png" alt="CRIB logo" className="h-10 w-10 rounded-full object-cover" />
              <p className="font-display text-xl font-bold leading-none text-ink">CRIB</p>
            </Link>

            <div className="hidden items-center gap-1 lg:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
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
                const trimmed = globalSearch.trim();
                navigate(trimmed ? `/market?q=${encodeURIComponent(trimmed)}` : "/market");
              }}
              className="flex w-full max-w-xl items-center gap-2 rounded-full border border-sand-200 bg-sand-100/80 px-4 py-2 text-sm text-sand-600 transition hover:border-cobalt-200 hover:bg-white focus-within:border-cobalt-300 focus-within:bg-white"
            >
              <svg className="h-4 w-4 text-sand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                placeholder="Search projects, templates, beats, UI kits"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-sand-500"
              />
              <button type="submit" className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white">
                Search
              </button>
            </form>
          </div>

          <div className="ml-auto flex items-center gap-2">
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

            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-sand-300 text-sand-700 transition hover:bg-sand-100 lg:hidden"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </nav>

        {mobileNavOpen ? (
          <div className="border-t border-sand-200 bg-white lg:hidden">
            <div className="mx-auto w-full max-w-[1400px] space-y-1 px-4 py-3 md:px-6">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      isActive ? "bg-sand-100 text-ink" : "text-sand-700 hover:bg-sand-100 hover:text-ink"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ) : null}
      </header>

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
