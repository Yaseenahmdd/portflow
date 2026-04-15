"use client";
import { formatMoney, formatOrMask } from "@/lib/utils";

interface SparklinePoint {
  value: number;
}

interface Props {
  holdingsCount: number;
  portfolioValue: number;
  investedAmount: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dailyChange: number;
  dailyChangePercent: number;
  isAmountsVisible: boolean;
  portfolioHistory?: SparklinePoint[];
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

function splitPortfolioValue(value: number, isVisible: boolean) {
  if (!isVisible) {
    return { currency: null, amount: formatOrMask(value, "AED", false) };
  }

  const [currency, ...amountParts] = formatMoney(value, "AED").split(/\s+/);
  return {
    currency: currency === "AED" ? "د.إ" : (currency ?? "د.إ"),
    amount: amountParts.join(" ") || formatMoney(value, "AED"),
  };
}

function PortfolioValueSparkline({
  points,
  isAmountsVisible,
}: {
  points: SparklinePoint[];
  isAmountsVisible: boolean;
}) {
  if (!isAmountsVisible || points.length < 2) {
    return null;
  }

  const width = 132;
  const height = 48;
  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || Math.max(maxValue * 0.03, 1);

  const coordinates = points.map((point, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * width;
    const normalized = (point.value - minValue) / range;
    const y = height - normalized * (height - 12) - 6;
    return { x, y };
  });

  const path = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const lastPoint = coordinates[coordinates.length - 1];

  return (
    <div className="pointer-events-none absolute inset-y-0 right-9 hidden items-center sm:flex">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-12 w-32 overflow-visible"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <filter id="portfolio-summary-spark-shadow" x="-20%" y="-40%" width="160%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(148, 163, 184, 0.28)" />
          </filter>
        </defs>
        <path
          d={path}
          fill="none"
          stroke="rgba(148, 163, 184, 0.72)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#portfolio-summary-spark-shadow)"
        />
        <circle cx={lastPoint.x} cy={lastPoint.y} r="5.5" fill="rgba(148, 163, 184, 0.12)" filter="url(#portfolio-summary-spark-shadow)" />
        <circle cx={lastPoint.x} cy={lastPoint.y} r="3" fill="rgba(100, 116, 139, 0.9)" />
      </svg>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subtext,
  tone = "default",
  isPrimary = false,
  portfolioHistory = [],
  isAmountsVisible = true,
}: {
  label: string;
  value: string;
  subtext: string;
  tone?: "default" | "positive" | "negative";
  isPrimary?: boolean;
  portfolioHistory?: SparklinePoint[];
  isAmountsVisible?: boolean;
}) {
  const toneClass =
    tone === "positive"
      ? "text-accent-gain"
      : tone === "negative"
        ? "text-accent-loss"
        : "text-text-primary";

  return (
    <div className={`dashboard-card relative overflow-hidden rounded-xl border border-border-default bg-bg-card shadow-sm ${isPrimary ? "p-6 sm:p-7" : "p-5 sm:p-6"}`}>
      <div className={`text-sm ${isPrimary ? "pl-1 font-medium text-text-secondary" : "text-text-secondary"}`}>{label}</div>
      <div className={`relative z-10 ${isPrimary ? "mt-1" : "mt-3"} font-semibold leading-tight ${isPrimary ? `text-3xl sm:text-[2.15rem] ${toneClass}` : `text-2xl sm:text-[2rem] ${toneClass}`}`}>
        {value}
      </div>
      <div className={`relative z-10 ${isPrimary ? "mt-2 text-sm text-text-muted" : "mt-1.5 text-sm text-text-muted"}`}>{subtext}</div>
      {isPrimary ? <PortfolioValueSparkline points={portfolioHistory} isAmountsVisible={isAmountsVisible} /> : null}
    </div>
  );
}

export default function PortfolioSummaryStrip({
  holdingsCount,
  portfolioValue,
  investedAmount,
  totalGainLoss,
  totalGainLossPercent,
  dailyChange,
  dailyChangePercent,
  isAmountsVisible,
  portfolioHistory = [],
}: Props) {
  const mobilePortfolioValue = splitPortfolioValue(portfolioValue, isAmountsVisible);
  const desktopInvested = formatOrMask(investedAmount, "AED", isAmountsVisible);
  const desktopPortfolioValue = formatOrMask(portfolioValue, "AED", isAmountsVisible);
  const desktopDailyChange = formatSignedMoney(dailyChange, "AED", isAmountsVisible);
  const desktopTotalGainLoss = formatSignedMoney(totalGainLoss, "AED", isAmountsVisible);

  return (
    <>
      <section className="sm:hidden">
        <div className="overflow-hidden rounded-[1.4rem] border border-border-default bg-bg-card px-4 py-4 text-text-primary shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-text-muted">
            Holdings ({holdingsCount})
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-1 font-mono font-semibold leading-none tracking-[-0.06em] text-text-primary">
              {mobilePortfolioValue.currency ? <span className="text-[1.32rem]">{mobilePortfolioValue.currency}</span> : null}
              <span className="text-[1.5rem]">{mobilePortfolioValue.amount}</span>
            </div>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("portflow:toggle-visibility", {
                    detail: { visible: !isAmountsVisible },
                  })
                )
              }
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border-default bg-bg-card text-text-secondary"
              aria-label={isAmountsVisible ? "Hide values" : "Show values"}
            >
              {isAmountsVisible ? (
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ) : (
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.25c2.1-1.85 4.6-2.75 7.5-2.75s5.4.9 7.5 2.75" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 9.75l1.75 1.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75l-1.75 1.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.75v1.75" />
                </svg>
              )}
            </button>
          </div>

          <div className="mt-4 border-t border-dashed border-border-default pt-3">
            <div className="flex items-start justify-between gap-3 py-2">
              <div className="text-sm text-text-secondary">1D returns</div>
              <div className={`text-right text-base font-semibold ${dailyChange >= 0 ? "text-accent-gain" : "text-accent-loss"}`}>
                {formatSignedMoney(dailyChange, "AED", isAmountsVisible)}
                <span className="ml-1 whitespace-nowrap text-xs font-medium">
                  ({formatSignedPercent(dailyChangePercent)})
                </span>
              </div>
            </div>

            <div className="flex items-start justify-between gap-3 py-2">
              <div className="text-sm text-text-secondary">Total returns</div>
              <div className={`text-right text-base font-semibold ${totalGainLoss >= 0 ? "text-accent-gain" : "text-accent-loss"}`}>
                {formatSignedMoney(totalGainLoss, "AED", isAmountsVisible)}
                <span className="ml-1 whitespace-nowrap text-xs font-medium">
                  ({formatSignedPercent(totalGainLossPercent)})
                </span>
              </div>
            </div>

            <div className="flex items-start justify-between gap-3 py-2">
              <div className="text-sm text-text-secondary">Invested</div>
              <div className="text-right text-base font-semibold text-text-primary">
                {formatOrMask(investedAmount, "AED", isAmountsVisible)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="hidden gap-3 sm:grid sm:grid-cols-2 sm:gap-4 xl:grid-cols-[1.3fr_1fr_1fr]">
        <SummaryCard
          label={`Holdings (${holdingsCount})`}
          value={desktopPortfolioValue}
          subtext={`Invested ${desktopInvested}`}
          isPrimary
          portfolioHistory={portfolioHistory}
          isAmountsVisible={isAmountsVisible}
        />
        <SummaryCard
          label="Today's P/L"
          value={desktopDailyChange}
          subtext={`${formatSignedPercent(dailyChangePercent)} daily change`}
          tone={dailyChange >= 0 ? "positive" : "negative"}
        />
        <SummaryCard
          label="Overall P/L"
          value={desktopTotalGainLoss}
          subtext={`${formatSignedPercent(totalGainLossPercent)} since inception`}
          tone={totalGainLoss >= 0 ? "positive" : "negative"}
        />
      </section>
    </>
  );
}
