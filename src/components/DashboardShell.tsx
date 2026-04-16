"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { tap, toggle, destructive as hapticDestructive } from "@/lib/haptics";
import { requestDashboardRefresh } from "@/lib/dashboard/refresh-controller";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

const THEME_STORAGE_KEY = "portflow-theme";

export default function DashboardShell({
  children,
  user,
}: {
  children: ReactNode;
  user: User;
}) {
  const router = useRouter();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isAmountsVisible, setIsAmountsVisible] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [statusMeta, setStatusMeta] = useState<{ lastRefresh: string; fxRate: string; fxUpdatedAt: string } | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

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

  const handleSignOut = async () => {
    hapticDestructive();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const userInitial = user.email?.[0]?.toUpperCase() || "U";
  const iconButtonClass =
    "h-8 w-8 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 sm:h-9 sm:w-9";

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <header className="bg-transparent px-0 py-1 sm:py-1.5">
          <div className="flex items-center justify-between gap-3">
            <a href="/dashboard" className="font-display text-[1.65rem] font-semibold tracking-[-0.04em] text-slate-900 sm:text-[1.8rem]">
              Portflow
            </a>
            <div className="flex items-center gap-2 sm:gap-2.5">
              {statusMeta ? (
                <div className="hidden items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500 md:flex">
                  <span>{statusMeta.lastRefresh}</span>
                  <span className="mx-2 h-3.5 w-px bg-slate-200" aria-hidden="true" />
                  <span>
                    AED/INR <span className="font-mono text-slate-600">{statusMeta.fxRate}</span>
                  </span>
                  <span className="mx-2 h-3.5 w-px bg-slate-200" aria-hidden="true" />
                  <span>{statusMeta.fxUpdatedAt}</span>
                </div>
              ) : null}

              <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
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
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700"
                  aria-label="Open profile menu"
                >
                  {userInitial}
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 top-11 z-50 min-w-56 overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
                    <div className="border-b border-slate-200 px-4 py-3">
                      <div className="truncate text-sm font-semibold text-slate-900">{user.email}</div>
                    </div>
                    <a
                      href="/dashboard/settings"
                      className="block w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Settings
                    </a>
                    <button
                      onClick={handleSignOut}
                      className="block w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
