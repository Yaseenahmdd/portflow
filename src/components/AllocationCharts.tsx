"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { type ComputedHolding, DARK_PIE_COLORS, LIGHT_ASSET_CLASS_COLORS, LIGHT_GEOGRAPHY_COLORS, LIGHT_PLATFORM_COLORS } from "@/lib/constants";
import { tap } from "@/lib/haptics";
import MeasuredChart from "@/components/MeasuredChart";
import { formatMoney, getAllocation } from "@/lib/utils";

interface Props {
  holdings: ComputedHolding[];
  totalValue: number;
  totalInvested: number;
}

export default function AllocationCharts({ holdings, totalValue, totalInvested }: Props) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mobileChartIndex, setMobileChartIndex] = useState(0);
  const [categoryMetric, setCategoryMetric] = useState<"current" | "invested">("current");
  const mobileTrackRef = useRef<HTMLDivElement | null>(null);
  const mobileCardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const byPlatform = getAllocation(holdings, "platform", totalValue);
  const byAssetClass = getAllocation(holdings, "allocationClass", totalValue);
  const byAssetClassInvested = getAllocation(holdings, "allocationClass", totalInvested, "investedAmountAed");
  const byGeography = getAllocation(holdings, "geography", totalValue);
  const activeByAssetClass = categoryMetric === "invested" ? byAssetClassInvested : byAssetClass;

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
      activeByAssetClass.forEach((item, index) => {
        mapping.set(item.label, DARK_PIE_COLORS[index % DARK_PIE_COLORS.length]);
      });
      return mapping;
    }
    return new Map(Object.entries(LIGHT_ASSET_CLASS_COLORS));
  }, [activeByAssetClass, isDarkMode]);

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
    {
      title: "By category",
      items: activeByAssetClass,
      colorMap: assetClassColorMap,
      metric: categoryMetric,
      onMetricChange: setCategoryMetric,
    },
    { title: "By geography", items: byGeography, colorMap: geographyColorMap },
  ];

  const activeMobileChart = chartCards[mobileChartIndex] ?? chartCards[0];

  function scrollToMobileChart(index: number) {
    const nextIndex = (index + chartCards.length) % chartCards.length;
    const nextCard = mobileCardRefs.current[nextIndex];

    if (!nextCard) {
      setMobileChartIndex(nextIndex);
      return;
    }

    nextCard.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
    setMobileChartIndex(nextIndex);
  }

  useEffect(() => {
    const track = mobileTrackRef.current;

    if (!track) {
      return;
    }

    let frameId = 0;

    const syncChartIndex = () => {
      frameId = 0;

      const nearestIndex = mobileCardRefs.current.reduce((bestIndex, card, index) => {
        if (!card) {
          return bestIndex;
        }

        const distance = Math.abs(card.offsetLeft - track.scrollLeft);
        const bestCard = mobileCardRefs.current[bestIndex];
        const bestDistance = bestCard ? Math.abs(bestCard.offsetLeft - track.scrollLeft) : Number.POSITIVE_INFINITY;

        return distance < bestDistance ? index : bestIndex;
      }, 0);

      setMobileChartIndex((current) => (current === nearestIndex ? current : nearestIndex));
    };

    const handleScroll = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(syncChartIndex);
    };

    track.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      track.removeEventListener("scroll", handleScroll);
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [chartCards.length]);

  return (
    <section>
      <div className="sm:hidden">
        <div className="relative">
          <div
            ref={mobileTrackRef}
            className="flex items-stretch snap-x snap-mandatory overflow-x-auto scroll-smooth"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            aria-label={`${activeMobileChart.title} chart`}
          >
            {chartCards.map((chart, index) => (
              <div
                key={chart.title}
                ref={(node) => {
                  mobileCardRefs.current[index] = node;
                }}
                className="w-full shrink-0 snap-center"
              >
                <div className="h-full px-1">
                  <PieAllocationCard
                    title={chart.title}
                    items={chart.items}
                    colorMap={chart.colorMap}
                    isDarkMode={isDarkMode}
                    metric={chart.metric}
                    onMetricChange={chart.onMetricChange}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { tap(); scrollToMobileChart(mobileChartIndex - 1); }}
            className="absolute left-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm"
            style={{
              borderColor: isDarkMode ? "var(--color-border-default)" : "#e2e8f0",
              backgroundColor: isDarkMode ? "rgba(15, 17, 23, 0.95)" : "rgba(255, 255, 255, 0.95)",
              color: isDarkMode ? "var(--color-text-secondary)" : "#475569",
            }}
            aria-label="Show previous chart"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => { tap(); scrollToMobileChart(mobileChartIndex + 1); }}
            className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm"
            style={{
              borderColor: isDarkMode ? "var(--color-border-default)" : "#e2e8f0",
              backgroundColor: isDarkMode ? "rgba(15, 17, 23, 0.95)" : "rgba(255, 255, 255, 0.95)",
              color: isDarkMode ? "var(--color-text-secondary)" : "#475569",
            }}
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
                onClick={() => { tap(); scrollToMobileChart(index); }}
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
            metric={chart.metric}
            onMetricChange={chart.onMetricChange}
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
  metric,
  onMetricChange,
}: {
  title: string;
  items: { label: string; value: number; weight: number }[];
  colorMap: Map<string, string>;
  isDarkMode: boolean;
  metric?: "current" | "invested";
  onMetricChange?: (metric: "current" | "invested") => void;
}) {
  const showMetricToggle = title === "By category" && metric && onMetricChange;

  return (
    <div
      className="dashboard-card flex h-full flex-col overflow-hidden rounded-2xl border p-4 shadow-sm"
      style={{
        backgroundColor: isDarkMode ? "var(--color-bg-card)" : "#ffffff",
        borderColor: isDarkMode ? "var(--color-border-default)" : "#e2e8f0",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 style={{ color: isDarkMode ? "var(--color-text-primary)" : "#0f172a" }} className="font-display text-base font-semibold tracking-[-0.02em]">
          {title}
        </h2>
        {showMetricToggle ? (
          <button
            type="button"
            onClick={() => onMetricChange(metric === "current" ? "invested" : "current")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors"
            aria-label={
              metric === "current"
                ? "Switch category allocation to invested value"
                : "Switch category allocation to current value"
            }
            title={
              metric === "current"
                ? "Show invested allocation"
                : "Show current allocation"
            }
            style={{
              borderColor: isDarkMode ? "rgba(148, 163, 184, 0.14)" : "rgba(148, 163, 184, 0.18)",
              backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.02)" : "rgba(248, 250, 252, 0.7)",
              color: isDarkMode ? "rgba(226, 232, 240, 0.7)" : "rgba(71, 85, 105, 0.72)",
            }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 3l4 4-4 4" />
              <path d="M3 7h18" />
              <path d="M7 21l-4-4 4-4" />
              <path d="M21 17H3" />
            </svg>
          </button>
        ) : null}
      </div>
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
                    background: isDarkMode ? "var(--color-bg-elevated)" : "#ffffff",
                    border: isDarkMode ? "1px solid var(--color-border-default)" : "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    color: isDarkMode ? "var(--color-text-primary)" : "#0f172a",
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
                  backgroundColor: isDarkMode ? "var(--color-bg-elevated)" : "#f8fafc",
                }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full border"
                    style={{
                      backgroundColor: colorMap.get(item.label) ?? (isDarkMode ? "#7C8DA6" : "#0f172a"),
                      borderColor: isDarkMode ? "var(--color-border-default)" : "#cbd5e1",
                    }}
                  />
                  <span style={{ color: isDarkMode ? "var(--color-text-primary)" : "#0f172a" }} className="truncate">
                    {item.label}
                  </span>
                </div>
                <span style={{ color: isDarkMode ? "var(--color-text-muted)" : "#64748b" }} className="shrink-0">
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
            backgroundColor: isDarkMode ? "var(--color-bg-elevated)" : "#f1f5f9",
            color: isDarkMode ? "var(--color-text-muted)" : "#64748b",
          }}
        >
          No data yet
        </div>
      )}
    </div>
  );
}
