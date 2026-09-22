"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { tap, toggle, destructive as hapticDestructive } from "@/lib/haptics";
import { requestDashboardRefresh } from "@/lib/dashboard/refresh-controller";
import { useIsCompactViewport } from "@/hooks/useIsCompactViewport";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { useDisplayCurrency } from "@/components/dashboard/DisplayCurrencyProvider";

const THEME_STORAGE_KEY = "portflow-theme";
const DASHBOARD_NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/holdings", label: "Holdings" },
  { href: "/dashboard/transactions", label: "Activity" },
  { href: "/dashboard/history", label: "History" },
];

export default function DashboardShell({
  children,
  user,
}: {
  children: ReactNode;
  user: User;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isCompactViewport = useIsCompactViewport();
  const { displayCurrency, setDisplayCurrency } = useDisplayCurrency();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isAmountsVisible, setIsAmountsVisible] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [statusMeta, setStatusMeta] = useState<{ lastRefresh: string; fxRate: string; fxUpdatedAt: string } | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const swipeLockedRef = useRef(false);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "dark") setIsDarkMode(true);
    else if (storedTheme === "light") setIsDarkMode(false);
    else setIsDarkMode(window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    function handleVisibility(event: Event) {
      const detail = (event as CustomEvent<{ visible: boolean }>).detail;
      if (detail && typeof detail.visible === "boolean") {
        setIsAmountsVisible(detail.visible);
      }
    }

    window.addEventListener("portflow:visibility-state", handleVisibility as EventListener);
    return () => window.removeEventListener("portflow:visibility-state", handleVisibility as EventListener);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    window.localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? "dark" : "light");

    window.dispatchEvent(
      new CustomEvent("portflow:theme-change", {
        detail: { dark: isDarkMode },
      })
    );
  }, [isDarkMode]);

  useEffect(() => {
    function handleRefreshState(event: Event) {
      const detail = (event as CustomEvent<{ refreshing: boolean }>).detail;
      if (detail && typeof detail.refreshing === "boolean") {
        setIsRefreshing(detail.refreshing);
      }
    }

    window.addEventListener("portflow:refresh-state", handleRefreshState as EventListener);
    return () => window.removeEventListener("portflow:refresh-state", handleRefreshState as EventListener);
  }, []);

  useEffect(() => {
    function handleStatusMeta(event: Event) {
      const detail = (event as CustomEvent<{ lastRefresh: string; fxRate: string; fxUpdatedAt: string } | null>).detail;
      if (
        detail &&
        typeof detail.lastRefresh === "string" &&
        typeof detail.fxRate === "string" &&
        typeof detail.fxUpdatedAt === "string"
      ) {
        setStatusMeta(detail);
        return;
      }

      setStatusMeta(null);
    }

    window.addEventListener("portflow:status-meta", handleStatusMeta as EventListener);
    return () => window.removeEventListener("portflow:status-meta", handleStatusMeta as EventListener);
  }, []);

  const dashboardNavIndex = DASHBOARD_NAV_ITEMS.findIndex((item) => item.href === pathname);
  const showDashboardNav = dashboardNavIndex !== -1;
  const showMobileDashboardNav = isCompactViewport && showDashboardNav;
  const mobileDashboardTarget =
    showMobileDashboardNav && dashboardNavIndex < DASHBOARD_NAV_ITEMS.length - 1
      ? DASHBOARD_NAV_ITEMS[dashboardNavIndex + 1]?.href
      : null;
  const mobilePreviousDashboardTarget =
    showMobileDashboardNav && dashboardNavIndex > 0
      ? DASHBOARD_NAV_ITEMS[dashboardNavIndex - 1]?.href
      : null;

  useEffect(() => {
    if (!showMobileDashboardNav) {
      return;
    }

    DASHBOARD_NAV_ITEMS.forEach((item) => router.prefetch(item.href));
  }, [router, showMobileDashboardNav]);

  const handleSignOut = async () => {
    hapticDestructive();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const userInitial = user.email?.[0]?.toUpperCase() || "U";
  const iconButtonClass =
    "h-11 w-11 items-center justify-center rounded-lg text-text-muted transition-[background-color,color,transform] hover:bg-bg-elevated hover:text-text-primary active:scale-[0.97]";

  function handleMainTouchStart(event: TouchEvent<HTMLElement>) {
    if (!showMobileDashboardNav || !mobileDashboardTarget) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        'button, a, input, select, textarea, [role="button"], [role="dialog"], [data-dashboard-swipe-lock="true"]'
      )
    ) {
      swipeLockedRef.current = true;
      return;
    }

    const touch = event.touches[0];
    swipeStartXRef.current = touch.clientX;
    swipeStartYRef.current = touch.clientY;
    swipeLockedRef.current = false;
  }

  function handleMainTouchEnd(event: TouchEvent<HTMLElement>) {
    if (
      !showMobileDashboardNav ||
      (!mobileDashboardTarget && !mobilePreviousDashboardTarget) ||
      swipeLockedRef.current
    ) {
      swipeStartXRef.current = null;
      swipeStartYRef.current = null;
      swipeLockedRef.current = false;
      return;
    }

    const startX = swipeStartXRef.current;
    const startY = swipeStartYRef.current;
    const touch = event.changedTouches[0];

    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    swipeLockedRef.current = false;

    if (startX === null || startY === null) {
      return;
    }

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const isHorizontalSwipe = Math.abs(deltaX) > 70 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5;

    if (!isHorizontalSwipe) {
      return;
    }

    if (deltaX < 0 && mobileDashboardTarget) {
      router.push(mobileDashboardTarget);
      return;
    }

    if (deltaX > 0 && mobilePreviousDashboardTarget) {
      router.push(mobilePreviousDashboardTarget);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary px-4 pb-8 pt-3 sm:px-6 sm:pb-10 sm:pt-4">
      <div className="mx-auto max-w-[1440px] space-y-4 sm:space-y-5">
        <header className="bg-transparent px-0">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/dashboard"
                className="group inline-flex min-h-11 items-center gap-2.5 text-text-primary"
              >
                <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border-default bg-bg-card" aria-hidden="true">
                  <span className="absolute left-2 top-[9px] h-px w-3 bg-text-muted" />
                  <span className="absolute left-2 top-[15px] h-px w-4 bg-accent-violet" />
                  <span className="absolute left-2 top-[21px] h-px w-2 bg-text-muted" />
                  <span className="absolute left-[21px] top-[12px] h-1.5 w-1.5 rounded-full bg-accent-violet transition-transform group-hover:scale-125" />
                </span>
                <span>
                  <span className="block font-display text-[1.35rem] font-semibold leading-5 tracking-[-0.035em] sm:text-[1.45rem]">Portflow</span>
                  <span className="ledger-kicker mt-1 hidden sm:block">Personal capital ledger</span>
                </span>
              </Link>
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div
                  className="inline-flex rounded-lg border border-border-subtle bg-bg-elevated p-0.5"
                  role="group"
                  aria-label="Display currency"
                >
                  {(["AED", "USD"] as const).map((currency) => (
                    <button
                      key={currency}
                      type="button"
                      aria-pressed={displayCurrency === currency}
                      onClick={() => {
                        tap();
                        setDisplayCurrency(currency);
                      }}
                      className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition sm:px-2.5 ${
                        displayCurrency === currency
                          ? "bg-bg-card text-text-primary shadow-sm"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                    >
                      {currency}
                    </button>
                  ))}
                </div>

                {statusMeta ? (
                  <div className="ledger-kicker hidden items-center xl:flex">
                    <span>{statusMeta.lastRefresh}</span>
                    <span className="mx-3 h-3.5 w-px bg-border-default" aria-hidden="true" />
                    <span>
                      AED/INR <span className="font-mono font-medium text-text-secondary">{statusMeta.fxRate}</span>
                    </span>
                    <span className="mx-3 h-3.5 w-px bg-border-default" aria-hidden="true" />
                    <span>{statusMeta.fxUpdatedAt}</span>
                  </div>
                ) : null}

                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => {
                      tap();
                      requestDashboardRefresh();
                    }}
                    className={`inline-flex ${iconButtonClass}`}
                    aria-label={isRefreshing ? "Refreshing prices" : "Refresh prices"}
                  >
                    <svg
                      className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
                    </svg>
                  </button>

                  <button
                    onClick={() => {
                      toggle();
                      window.dispatchEvent(
                        new CustomEvent("portflow:toggle-visibility", {
                          detail: { visible: !isAmountsVisible },
                        })
                      );
                    }}
                    className={`hidden ${iconButtonClass} lg:inline-flex`}
                    title={isAmountsVisible ? "Hide values" : "Show values"}
                    aria-label={isAmountsVisible ? "Hide values" : "Show values"}
                  >
                    {isAmountsVisible ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.25c2.1-1.85 4.6-2.75 7.5-2.75s5.4.9 7.5 2.75" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 9.75l1.75 1.5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75l-1.75 1.5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.75v1.75" />
                      </svg>
                    )}
                  </button>

                  <button
                    onClick={() => { toggle(); setIsDarkMode((current) => !current); }}
                    className={`inline-flex ${iconButtonClass}`}
                    title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                    aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                  >
                    {isDarkMode ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="5" />
                        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                      </svg>
                    )}
                  </button>
                </div>

                <div ref={profileMenuRef} className="relative">
                  <button
                    onClick={() => { tap(); setProfileMenuOpen((current) => !current); }}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-border-subtle bg-bg-card font-mono text-xs font-semibold text-text-secondary transition-[background-color,transform] hover:bg-bg-elevated active:scale-[0.97]"
                    aria-label="Open profile menu"
                  >
                    {userInitial}
                  </button>

                  {profileMenuOpen && (
                    <div className="absolute right-0 top-12 z-50 min-w-56 overflow-hidden rounded-xl border border-border-default bg-bg-card shadow-[0_16px_44px_rgba(20,32,45,0.14)]">
                      <div className="border-b border-border-default px-4 py-3">
                        <div className="truncate text-sm font-semibold text-text-primary">{user.email}</div>
                      </div>
                      <a
                        href="/dashboard/settings"
                        className="block w-full px-4 py-3 text-left text-sm font-medium text-text-secondary hover:bg-bg-elevated"
                      >
                        Settings
                      </a>
                      <button
                        onClick={handleSignOut}
                        className="block w-full px-4 py-3 text-left text-sm font-medium text-text-secondary hover:bg-bg-elevated"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {showDashboardNav ? (
              <nav aria-label="Dashboard">
                <div className="grid grid-cols-4 border-y border-border-subtle sm:flex sm:gap-7">
                  {DASHBOARD_NAV_ITEMS.map((item) => {
                    const active = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`relative inline-flex min-h-11 items-center justify-center px-2 py-3 text-center text-[13px] font-medium transition-colors sm:px-0 ${
                          active
                            ? "text-text-primary"
                            : "text-text-muted hover:text-text-primary"
                        }`}
                      >
                        {item.label}
                        <span
                          className={`absolute bottom-[-1px] left-1/2 h-0.5 w-[48%] -translate-x-1/2 transition-opacity sm:w-full ${
                            active ? "bg-accent-violet opacity-100" : "bg-transparent opacity-0"
                          }`}
                          aria-hidden="true"
                        />
                      </Link>
                    );
                  })}
                </div>
              </nav>
            ) : null}
          </div>
        </header>

        <main onTouchStart={handleMainTouchStart} onTouchEnd={handleMainTouchEnd}>
          {children}
        </main>
      </div>
    </div>
  );
}
