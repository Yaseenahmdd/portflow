"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

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

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const userInitial = user.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <header className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <a href="/dashboard" className="text-2xl font-bold tracking-tight text-slate-900">
              Portflow
            </a>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("portflow:refresh-prices"))}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Refresh
              </button>

              <button
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("portflow:toggle-visibility", {
                      detail: { visible: !isAmountsVisible },
                    })
                  )
                }
                className="rounded-full border border-slate-200 bg-slate-50 p-2.5 text-slate-700 hover:bg-slate-100"
                title={isAmountsVisible ? "Hide values" : "Show values"}
                aria-label={isAmountsVisible ? "Hide values" : "Show values"}
              >
                {isAmountsVisible ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.25c2.1-1.85 4.6-2.75 7.5-2.75s5.4.9 7.5 2.75" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 9.75l1.75 1.5" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75l-1.75 1.5" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.75v1.75" />
                  </svg>
                )}
              </button>

              <div ref={profileMenuRef} className="relative">
                <button
                  onClick={() => setProfileMenuOpen((current) => !current)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700"
                  aria-label="Open profile menu"
                >
                  {userInitial}
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 top-12 z-50 min-w-56 overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
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
