"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import MeasuredChart from "@/components/MeasuredChart";
import { tap } from "@/lib/haptics";
import { compactNumber, formatMoney, formatOrMask } from "@/lib/utils";

interface ChartPoint {
  date: string;
  invested: number | null;
  value: number | null;
}

interface DisplayChartPoint extends ChartPoint {
  performance: number | null;
  performanceGain: number | null;
}

type ChartView = "performance" | "value";
type DisplayCurrency = "AED" | "USD";

interface Props {
  chartData: ChartPoint[];
  isAmountsVisible: boolean;
  subtitle?: string;
  minimumDataPoints?: number;
  emptyMessage?: string;
  headerAction?: ReactNode;
  includeOpeningGain?: boolean;
  displayCurrency: DisplayCurrency;
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

function getPerformanceDomain(points: DisplayChartPoint[]): [number, number] {
  const values = points
    .map((point) => point.performance)
    .filter((value): value is number => value !== null);

  if (!values.length) {
    return [-1, 1];
  }

  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue - minValue;
  const padding = range === 0 ? 1 : Math.max(range * 0.16, 0.5);

  return [minValue - padding, maxValue + padding];
}

function formatSignedMoney(value: number, currency: string, isVisible: boolean) {
  if (!isVisible) {
    const sign = value > 0 ? "+" : value < 0 ? "-" : "";
    return `${sign}${formatOrMask(Math.abs(value), currency, false)}`;
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
  view,
  displayCurrency,
}: {
  active?: boolean;
  payload?: Array<{
    value?: number;
    dataKey?: string;
    payload?: DisplayChartPoint;
  }>;
  isAmountsVisible: boolean;
  isDarkMode: boolean;
  view: ChartView;
  displayCurrency: DisplayCurrency;
}) {
  const pointDate = payload?.[0]?.payload?.date;

  if (!active || !payload?.length || !pointDate) {
    return null;
  }

  const point = payload[0]?.payload;
  const invested = Number(point?.invested ?? 0);
  const value = Number(point?.value ?? 0);
  const gainLoss = value - invested;
  const gainLossPercent = invested ? (gainLoss / invested) * 100 : 0;
  const gainLossPositive = gainLoss >= 0;
  const performance = point?.performance ?? 0;
  const performanceGain = point?.performanceGain ?? 0;
  const performancePositive = performanceGain >= 0;

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
        {view === "performance" ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="text-text-secondary">Performance</span>
              <span className={performancePositive ? "text-accent-gain" : "text-accent-loss"}>
                {formatSignedPercent(performance)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-text-secondary">Investment gain</span>
              <span className={performancePositive ? "text-accent-gain" : "text-accent-loss"}>
                {formatSignedMoney(performanceGain, displayCurrency, isAmountsVisible)}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="text-text-secondary">Portfolio</span>
              <span>{formatOrMask(value, displayCurrency, isAmountsVisible)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-text-secondary">Invested</span>
              <span>{formatOrMask(invested, displayCurrency, isAmountsVisible)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-text-secondary">Gain / Loss</span>
              <span className={gainLossPositive ? "text-accent-gain" : "text-accent-loss"}>
                {formatSignedMoney(gainLoss, displayCurrency, isAmountsVisible)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-text-secondary">Return</span>
              <span className={gainLossPositive ? "text-accent-gain" : "text-accent-loss"}>
                {formatSignedPercent(gainLossPercent)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PortfolioTrendChart({
  chartData,
  isAmountsVisible,
  subtitle,
  minimumDataPoints = 1,
  emptyMessage = "No portfolio history yet.",
  headerAction,
  includeOpeningGain = false,
  displayCurrency,
}: Props) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [view, setView] = useState<ChartView>("performance");

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

  const displayData = useMemo<DisplayChartPoint[]>(() => {
    const first = chartData[0];
    const openingGain =
      !includeOpeningGain && first && first.value !== null && first.invested !== null
        ? first.value - first.invested
        : 0;

    return chartData.map((point) => {
      if (point.value === null || point.invested === null || point.invested <= 0) {
        return { ...point, performance: null, performanceGain: null };
      }

      const performanceGain = point.value - point.invested - openingGain;

      return {
        ...point,
        performance: (performanceGain / point.invested) * 100,
        performanceGain,
      };
    });
  }, [chartData, includeOpeningGain]);

  const xTicks = useMemo(() => {
    if (!chartData.length) {
      return undefined;
    }

    if (chartData.length <= 2) {
      return chartData.map((point) => point.date);
    }

    const leftLabel = chartData[0].date;
    const middleLabel = chartData[Math.floor((chartData.length - 1) / 2)].date;
    const rightLabel = chartData[chartData.length - 1].date;

    return [leftLabel, middleLabel, rightLabel];
  }, [chartData]);

  const yAxisDomain = useMemo<[number, number]>(
    () => (view === "performance" ? getPerformanceDomain(displayData) : getChartDomain(chartData)),
    [chartData, displayData, view]
  );
  const investedLineColor = isDarkMode ? "rgba(170,181,192,0.32)" : "rgba(67,81,99,0.32)";
  const valueLineColor = "var(--color-accent-violet)";
  const chartGridColor = isDarkMode ? "rgba(203, 213, 225, 0.08)" : "rgba(15, 23, 42, 0.05)";
  const hasEnoughData =
    chartData.length >= minimumDataPoints &&
    chartData.some((point) => (point.value ?? 0) > 0 || (point.invested ?? 0) > 0);

  return (
    <section className="dashboard-card rounded-xl border border-border-default bg-bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="ledger-kicker">Capital trajectory</div>
          <h2 className="mt-1 font-display text-lg font-semibold tracking-[-0.025em] text-text-primary">Portfolio performance</h2>
          {subtitle ? <p className="mt-1 text-xs text-text-muted sm:text-[13px]">{subtitle}</p> : null}
          <div
            className="mt-4 inline-flex rounded-lg border border-border-subtle bg-bg-elevated p-0.5"
            role="tablist"
            aria-label="Select portfolio chart view"
          >
            {([
              ["performance", "Performance"],
              ["value", "Portfolio value"],
            ] as const).map(([option, label]) => {
              const active = view === option;

              return (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    tap();
                    setView(option);
                  }}
                  className={`rounded-md px-3 py-2 text-[13px] font-medium transition-[background-color,color,transform] active:scale-[0.97] sm:px-4 ${
                    active
                      ? "bg-bg-card text-text-primary ring-1 ring-border-default"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {headerAction ? <div className="max-w-full overflow-x-auto">{headerAction}</div> : null}
      </div>

      <div className="mt-5 h-[250px] w-full min-h-0 min-w-0 sm:h-[280px]">
        {hasEnoughData ? (
          <MeasuredChart className="h-full w-full min-h-0 min-w-0">
            {({ width, height }) => (
            <ComposedChart
              width={width}
              height={height}
              data={displayData}
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
                dataKey="date"
                ticks={xTicks}
                tickFormatter={formatSnapshotLabel}
                tick={{ fill: isDarkMode ? "var(--color-text-muted)" : "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                interval={0}
              />
              <YAxis
                domain={yAxisDomain}
                tickFormatter={(value) =>
                  view === "performance"
                    ? `${Number(value).toFixed(Math.abs(Number(value)) < 10 ? 1 : 0)}%`
                    : isAmountsVisible
                      ? compactNumber(Number(value))
                      : "\u2022\u2022\u2022\u2022\u2022"
                }
                tick={{ fill: isDarkMode ? "var(--color-text-muted)" : "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={60}
                tickCount={4}
              />
              <Tooltip
                trigger="hover"
                cursor={{ stroke: "transparent", fill: "transparent" }}
                content={
                  <CustomTooltip
                    isAmountsVisible={isAmountsVisible}
                    isDarkMode={isDarkMode}
                    view={view}
                    displayCurrency={displayCurrency}
                  />
                }
              />
              {view === "performance" ? (
                <>
                  <ReferenceLine y={0} stroke={investedLineColor} strokeDasharray="4 4" />
                  <Area
                    type="linear"
                    dataKey="performance"
                    fill="url(#portfolio-value-fill)"
                    stroke="none"
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="performance"
                    name="Performance"
                    stroke={valueLineColor}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </>
              ) : (
                <>
                  <Area
                    type="linear"
                    dataKey="value"
                    fill="url(#portfolio-value-fill)"
                    stroke="none"
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="stepAfter"
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
                    type="linear"
                    dataKey="value"
                    name="Portfolio Value"
                    stroke={valueLineColor}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </>
              )}
            </ComposedChart>
            )}
          </MeasuredChart>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border-default bg-bg-elevated/60 px-6 text-center">
            <div className="w-full max-w-sm">
              <div className="flow-rail" style={{ "--flow-progress": "34%" } as React.CSSProperties} />
              <div className="mt-5 text-sm font-semibold text-text-primary">A useful trend needs another checkpoint</div>
              <p className="mt-1.5 text-xs leading-5 text-text-muted">{emptyMessage} Record activity or refresh prices later to extend the capital-flow history.</p>
              <Link href="/dashboard/transactions" className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-border-default bg-bg-card px-4 text-xs font-semibold text-text-secondary hover:text-text-primary">
                Open activity ledger
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-text-secondary">
        {view === "performance" ? (
          <div className="inline-flex items-center gap-2">
            <span className="h-0 w-5 border-t-2" style={{ borderColor: valueLineColor }} />
            <span>Contribution-adjusted return</span>
          </div>
        ) : (
          <>
            <div className="inline-flex items-center gap-2">
              <span className="h-0 w-5 border-t-[1.5px] border-dashed" style={{ borderColor: investedLineColor }} />
              <span>Invested Amount</span>
            </div>
            <div className="inline-flex items-center gap-2">
              <span className="h-0 w-5 border-t-2" style={{ borderColor: valueLineColor }} />
              <span>Portfolio Value</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
