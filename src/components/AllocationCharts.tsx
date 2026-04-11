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
  const [mobileChartIndex, setMobileChartIndex] = useState(0);
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

  const chartCards = [
    { title: "By platform", items: byPlatform, colorMap: platformColorMap },
    { title: "By asset class", items: byAssetClass, colorMap: assetClassColorMap },
    { title: "By geography", items: byGeography, colorMap: geographyColorMap },
  ];

  const mobileChart = chartCards[mobileChartIndex] ?? chartCards[0];

  return (
    <section>
      <div className="sm:hidden">
        <div className="relative">
          <PieAllocationCard title={mobileChart.title} items={mobileChart.items} colorMap={mobileChart.colorMap} isDarkMode={isDarkMode} />

          <button
            type="button"
            onClick={() => setMobileChartIndex((current) => (current === 0 ? chartCards.length - 1 : current - 1))}
            className="absolute left-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-sm active:bg-slate-50"
            aria-label="Show previous chart"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setMobileChartIndex((current) => (current === chartCards.length - 1 ? 0 : current + 1))}
            className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-sm active:bg-slate-50"
            aria-label="Show next chart"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="mt-3 flex justify-center">
          <div className="flex items-center gap-1.5">
            {chartCards.map((chart, index) => (
              <button
                key={chart.title}
                type="button"
                onClick={() => setMobileChartIndex(index)}
                className={`h-2 rounded-full transition-all ${index === mobileChartIndex ? "w-5 bg-slate-700" : "w-2 bg-slate-300"}`}
                aria-label={`Show ${chart.title} chart`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-3">
        {chartCards.map((chart) => (
          <PieAllocationCard
            key={chart.title}
            title={chart.title}
            items={chart.items}
            colorMap={chart.colorMap}
            isDarkMode={isDarkMode}
          />
        ))}
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
