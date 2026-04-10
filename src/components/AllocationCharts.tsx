"use client";

import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { type ComputedHolding, DARK_PIE_COLORS, LIGHT_ASSET_CLASS_COLORS, LIGHT_GEOGRAPHY_COLORS, LIGHT_PLATFORM_COLORS } from "@/lib/constants";
import MeasuredChart from "@/components/MeasuredChart";
import { formatMoney, getAllocation } from "@/lib/utils";

interface Props {
  holdings: ComputedHolding[];
  totalValue: number;
}

export default function AllocationCharts({ holdings, totalValue }: Props) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const byPlatform = getAllocation(holdings, "platform", totalValue);
  const byAssetClass = getAllocation(holdings, "assetClass", totalValue);
  const byGeography = getAllocation(holdings, "geography", totalValue);

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setIsDarkMode(root.classList.contains("dark"));
    updateTheme();

    const handleThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ dark: boolean }>).detail;
      if (detail && typeof detail.dark === "boolean") {
        setIsDarkMode(detail.dark);
      }
    };

    window.addEventListener("portflow:theme-change", handleThemeChange as EventListener);

    return () => {
      window.removeEventListener("portflow:theme-change", handleThemeChange as EventListener);
    };
  }, []);

  const platformColorMap = useMemo(() => {
    if (isDarkMode) {
      const mapping = new Map<string, string>();
      byPlatform.forEach((item, index) => {
        mapping.set(item.label, DARK_PIE_COLORS[index % DARK_PIE_COLORS.length]);
      });
      return mapping;
    }
    return new Map(Object.entries(LIGHT_PLATFORM_COLORS));
  }, [byPlatform, isDarkMode]);

  const assetClassColorMap = useMemo(() => {
    if (isDarkMode) {
      const mapping = new Map<string, string>();
      byAssetClass.forEach((item, index) => {
        mapping.set(item.label, DARK_PIE_COLORS[index % DARK_PIE_COLORS.length]);
      });
      return mapping;
    }
    return new Map(Object.entries(LIGHT_ASSET_CLASS_COLORS));
  }, [byAssetClass, isDarkMode]);

  const geographyColorMap = useMemo(() => {
    if (isDarkMode) {
      const mapping = new Map<string, string>();
      byGeography.forEach((item, index) => {
        mapping.set(item.label, DARK_PIE_COLORS[index % DARK_PIE_COLORS.length]);
      });
      return mapping;
    }
    return new Map(Object.entries(LIGHT_GEOGRAPHY_COLORS));
  }, [byGeography, isDarkMode]);

  return (
    <section className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="grid auto-cols-[85%] grid-flow-col gap-3 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        <PieAllocationCard title="By platform" items={byPlatform} colorMap={platformColorMap} isDarkMode={isDarkMode} />
        <PieAllocationCard title="By asset class" items={byAssetClass} colorMap={assetClassColorMap} isDarkMode={isDarkMode} />
        <PieAllocationCard title="By geography" items={byGeography} colorMap={geographyColorMap} isDarkMode={isDarkMode} />
      </div>
    </section>
  );
}

function PieAllocationCard({
  title,
  items,
  colorMap,
  isDarkMode,
}: {
  title: string;
  items: { label: string; value: number; weight: number }[];
  colorMap: Map<string, string>;
  isDarkMode: boolean;
}) {
  return (
    <div
      className="dashboard-card overflow-hidden rounded-2xl border p-4 shadow-sm"
      style={{
        backgroundColor: isDarkMode ? "#02091f" : "#ffffff",
        borderColor: isDarkMode ? "#334155" : "#e2e8f0",
      }}
    >
      <h2 style={{ color: isDarkMode ? "#f8fafc" : "#0f172a" }} className="text-base font-semibold">
        {title}
      </h2>
      {items.length ? (
        <>
          <div className="mt-3 h-40 w-full min-h-0 min-w-0 sm:h-44">
            <MeasuredChart className="h-full w-full min-h-0 min-w-0">
              {({ width, height }) => (
              <PieChart width={width} height={height}>
                <Pie data={items} dataKey="value" nameKey="label" innerRadius={34} outerRadius={56} paddingAngle={2}>
                  {items.map((item) => (
                    <Cell key={item.label} fill={colorMap.get(item.label) ?? (isDarkMode ? "#7C8DA6" : "#0f172a")} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: isDarkMode ? "#02091f" : "#ffffff",
                    border: isDarkMode ? "1px solid #334155" : "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    color: isDarkMode ? "#f8fafc" : "#0f172a",
                    fontSize: "12px",
                    boxShadow: isDarkMode ? "0 8px 24px rgba(15,23,42,0.4)" : "0 8px 24px rgba(15,23,42,0.08)",
                  }}
                  formatter={(value) => formatMoney(Number(value), "AED")}
                />
              </PieChart>
              )}
            </MeasuredChart>
          </div>
          <div className="mt-2 space-y-1.5">
            {items.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs"
                style={{
                  backgroundColor: isDarkMode ? "#071329" : "#f8fafc",
                }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full border"
                    style={{
                      backgroundColor: colorMap.get(item.label) ?? (isDarkMode ? "#7C8DA6" : "#0f172a"),
                      borderColor: isDarkMode ? "#334155" : "#cbd5e1",
                    }}
                  />
                  <span style={{ color: isDarkMode ? "#f8fafc" : "#0f172a" }} className="truncate">
                    {item.label}
                  </span>
                </div>
                <span style={{ color: isDarkMode ? "#94a3b8" : "#64748b" }} className="shrink-0">
                  {item.weight.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div
          className="mt-4 rounded-xl p-4 text-center text-sm"
          style={{
            backgroundColor: isDarkMode ? "#071329" : "#f1f5f9",
            color: isDarkMode ? "#94a3b8" : "#64748b",
          }}
        >
          No data yet
        </div>
      )}
    </div>
  );
}
