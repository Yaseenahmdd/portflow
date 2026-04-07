"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";

const navItems = [
  { label: "Portfolio", href: "/dashboard" },
  { label: "Settings", href: "/dashboard/settings" },
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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const userInitial = user.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-40 bg-[#fffaf8]/80 px-4 py-4 backdrop-blur sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1180px]">
          <div className="flex items-center gap-2 overflow-visible rounded-[1.7rem] border border-black/8 bg-white px-3 py-2.5 shadow-[0_10px_30px_rgba(150,80,66,0.08)] sm:gap-3 sm:px-4 sm:py-3">
            <a href="/dashboard" className="shrink-0 text-xl font-extrabold tracking-tight text-accent-violet sm:text-2xl">
              asset<span className="text-text-primary">viz</span>
            </a>

            <nav className="ml-1 flex items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:ml-2 sm:gap-2 [&::-webkit-scrollbar]:hidden">
              {navItems.map((item) => {
                const active = pathname === item.href;

                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition sm:px-4 sm:py-2 ${
                      active ? "bg-[#fff1ef] text-accent-violet" : "text-text-primary hover:bg-[#faf3f1]"
                    }`}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>

            <div ref={profileMenuRef} className="relative ml-auto shrink-0">
              <button
                onClick={() => setProfileMenuOpen((current) => !current)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-black/8 bg-[#fff1ef] text-xs font-semibold text-accent-violet transition hover:bg-[#ffe7e2] sm:h-9 sm:w-9"
                aria-label="Open profile menu"
              >
                {userInitial}
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 top-12 z-50 min-w-52 overflow-hidden rounded-[1.2rem] border border-black/8 bg-white shadow-xl">
                  <div className="border-b border-black/8 px-4 py-3">
                    <div className="truncate text-sm font-semibold text-text-primary">{user.email}</div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="block w-full px-4 py-3 text-left text-sm font-medium text-text-secondary transition hover:bg-[#fff1ef] hover:text-text-primary"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="min-w-0">
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-10 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
