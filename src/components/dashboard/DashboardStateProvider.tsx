"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useDashboardState } from "@/hooks/useDashboardState";

type DashboardStateValue = ReturnType<typeof useDashboardState>;

const DashboardStateContext = createContext<DashboardStateValue | null>(null);

export function DashboardStateProvider({
  children,
  initialUserId,
}: {
  children: ReactNode;
  initialUserId: string;
}) {
  const dashboardState = useDashboardState(initialUserId);

  return (
    <DashboardStateContext.Provider value={dashboardState}>
      {children}
    </DashboardStateContext.Provider>
  );
}

export function useDashboardStateContext() {
  const context = useContext(DashboardStateContext);

  if (!context) {
    throw new Error("useDashboardStateContext must be used within a DashboardStateProvider.");
  }

  return context;
}
