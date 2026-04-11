"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import MeasuredChart from "@/components/MeasuredChart";
import { compactNumber, formatMoney, formatOrMask } from "@/lib/utils";

interface ChartPoint {
  date: string;
  invested: number | null;
  value: number | null;
}

interface Props {
  chartData: ChartPoint[];
  isAmountsVisible: boolean;
}

function formatSnapshotLabel(snapshotDate: string) {
  return new Date(`${snapshotDate}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatSnapshotTooltipLabel(snapshotDate: string) {
  return new Date(`${snapshotDate}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getChartDomain(points: ChartPoint[]): [number, number] {
  if (!points.length) {
    return [0, 100];
  }

  const values = points.flatMap((point) => [point.invested, point.value]).filter((value): value is number => value !== null);

  if (!values.length) {
    return [0, 100];
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;
  const padding =
    range === 0
      ? Math.max(maxValue * 0.08, 150)
      : Math.max(range * 0.18, maxValue * 0.015, 100);

  return [Math.max(0, minValue - padding), maxValue + padding];
}

function formatSignedMoney(value: number, currency: string, isVisible: boolean) {
  if (!isVisible) {
    return formatOrMask(Math.abs(value), currency, false);
  }

  const formatted = formatMoney(Math.abs(value), currency);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function CustomTooltip({
  active,
  payload,
  isAmountsVisible,
  isDarkMode,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; dataKey?: string; payload?: { date?: string } }>;
  isAmountsVisible: boolean;
  isDarkMode: boolean;
}) {
  const pointDate = payload?.[0]?.payload?.date;

  if (!active || !payload?.length || !pointDate) {
    return null;
  }

  const invested = Number(payload.find((item) => item.dataKey === "invested")?.value ?? 0);
  const value = Number(payload.find((item) => item.dataKey === "value")?.value ?? 0);
  const gainLoss = value - invested;
  const gainLossPercent = invested ? (gainLoss / invested) * 100 : 0;
  const gainLossPositive = gainLoss >= 0;

  return (
    <div
      className="min-w-44 rounded-xl px-3 py-2.5 text-xs shadow-lg"
      style={{
        background: isDarkMode ? "var(--color-bg-elevated)" : "#ffffff",
        border: isDarkMode ? "1px solid var(--color-border-default)" : "1px solid #e2e8f0",
        color: isDarkMode ? "var(--color-text-primary)" : "#0f172a",
      }}
    >
      <div className="font-semibold">{formatSnapshotTooltipLabel(pointDate)}</div>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-text-secondary">Portfolio</span>
          <span>{isAmountsVisible ? formatMoney(value, "AED") : "-----"}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-text-secondary">Invested</span>
          <span>{isAmountsVisible ? formatMoney(invested, "AED") : "-----"}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-text-secondary">Gain / Loss</span>
          <span className={gainLossPositive ? "text-accent-gain" : "text-accent-loss"}>
            {isAmountsVisible ? formatSignedMoney(gainLoss, "AED", true) : "-----"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-text-secondary">Return</span>
          <span className={gainLossPositive ? "text-accent-gain" : "text-accent-loss"}>
            {formatSignedPercent(gainLossPercent)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioTrendChart({ chartData, isAmountsVisible }: Props) {
  const [isDarkMode, setIsDarkMode] = useState(false);

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

  const formattedChartData = useMemo(() => {
    if (!chartData.length) {
      return [];
    }

    return chartData.map((point) => ({
      ...point,
      label: formatSnapshotLabel(point.date),
    }));
  }, [chartData]);

  const xTicks = useMemo(() => {
    if (!chartData.length) {
      return undefined;
    }

    if (chartData.length <= 2) {
      return chartData.map((point) => formatSnapshotLabel(point.date));
    }

    const leftLabel = formatSnapshotLabel(chartData[0].date);
    const middleLabel = formatSnapshotLabel(chartData[Math.floor((chartData.length - 1) / 2)].date);
    const rightLabel = formatSnapshotLabel(chartData[chartData.length - 1].date);

    return [leftLabel, middleLabel, rightLabel];
  }, [chartData]);

  const yAxisDomain = useMemo<[number, number]>(() => getChartDomain(chartData), [chartData]);
  const investedLineColor = "rgba(115,114,108,0.35)";
  const valueLineColor = isDarkMode ? "var(--color-accent-violet)" : "#3266ad";
  const chartGridColor = isDarkMode ? "rgba(203, 213, 225, 0.08)" : "rgba(15, 23, 42, 0.05)";

  return (
    <section className="dashboard-card rounded-2xl border border-border-default bg-bg-card p-5 shadow-sm sm:p-6">
      <div>
        <div>
          <h2 className="font-display text-[1.05rem] font-semibold tracking-[-0.04em] text-text-primary sm:text-xl">
            Portfolio Balance
          </h2>
        </div>
      </div>

      <div className="mt-5 h-[230px] w-full min-h-0 min-w-0">
        {formattedChartData.length ? (
          <MeasuredChart className="h-full w-full min-h-0 min-w-0">
            {({ width, height }) => (
            <ComposedChart
              width={width}
              height={height}
              data={formattedChartData}
              accessibilityLayer={false}
              margin={{ top: 8, right: 6, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="portfolio-value-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={valueLineColor} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={valueLineColor} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartGridColor} vertical={false} />
              <XAxis
                dataKey="label"
                ticks={xTicks}
                tick={{ fill: isDarkMode ? "var(--color-text-muted)" : "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                interval={0}
              />
              <YAxis
                domain={yAxisDomain}
                tickFormatter={(value) => compactNumber(Number(value))}
                tick={{ fill: isDarkMode ? "var(--color-text-muted)" : "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={60}
                tickCount={4}
              />
              <Tooltip
                trigger="hover"
                cursor={{ stroke: "transparent", fill: "transparent" }}
                content={<CustomTooltip isAmountsVisible={isAmountsVisible} isDarkMode={isDarkMode} />}
              />
              <Area
                type="monotone"
                dataKey="value"
                fill="url(#portfolio-value-fill)"
                stroke="none"
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="invested"
                name="Invested Amount"
                stroke={investedLineColor}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="value"
                name="Portfolio Value"
                stroke={valueLineColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </ComposedChart>
            )}
          </MeasuredChart>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl bg-bg-elevated text-sm text-text-secondary">
            No portfolio history yet.
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-text-secondary">
        <div className="inline-flex items-center gap-2">
          <span className="h-0 w-5 border-t-[1.5px] border-dashed" style={{ borderColor: investedLineColor }} />
          <span>Invested Amount</span>
        </div>
        <div className="inline-flex items-center gap-2">
          <span className="h-0 w-5 border-t-2" style={{ borderColor: valueLineColor }} />
          <span>Portfolio Value</span>
        </div>
      </div>
    </section>
  );
}
