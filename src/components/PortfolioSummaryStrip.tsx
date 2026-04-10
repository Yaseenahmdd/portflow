"use client";

import { useState } from "react";
import { formatMoney, formatOrMask } from "@/lib/utils";

interface Props {
  portfolioValue: number;
  investedAmount: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dailyChange: number;
  dailyChangePercent: number;
  fxRate: number;
  isAmountsVisible: boolean;
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

function SummaryCard({
  label,
  value,
  subtext,
  tone = "default",
}: {
  label: string;
  value: string;
  subtext: string;
  tone?: "default" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-accent-gain"
      : tone === "negative"
        ? "text-accent-loss"
        : "text-text-primary";

  return (
    <div className="dashboard-card rounded-xl border border-border-default bg-bg-card p-5 shadow-sm sm:p-6">
      <div className="text-sm text-text-secondary">{label}</div>
      <div className={`mt-3 text-xl font-semibold leading-tight sm:text-2xl ${toneClass}`}>{value}</div>
      <div className="mt-1.5 text-sm text-text-muted">{subtext}</div>
    </div>
  );
}

function PerformanceToggleCard({
  totalGainLoss,
  totalGainLossPercent,
  dailyChange,
  dailyChangePercent,
  isAmountsVisible,
}: {
  totalGainLoss: number;
  totalGainLossPercent: number;
  dailyChange: number;
  dailyChangePercent: number;
  isAmountsVisible: boolean;
}) {
  const [mode, setMode] = useState<"overall" | "today">("overall");
  const isOverall = mode === "overall";
  const value = isOverall ? totalGainLoss : dailyChange;
  const percent = isOverall ? totalGainLossPercent : dailyChangePercent;
  const toneClass = value >= 0 ? "text-accent-gain" : "text-accent-loss";

  return (
    <div className="dashboard-card rounded-xl border border-border-default bg-bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-text-secondary">
          {isOverall ? "Total Gain / Loss" : "Today"}
        </div>
        <button
          type="button"
          onClick={() => setMode((current) => (current === "overall" ? "today" : "overall"))}
          className="inline-flex items-center gap-1.5 px-1 py-0.5 text-[11px] font-medium text-text-muted transition hover:text-text-secondary"
          aria-label={isOverall ? "Show today's change" : "Show total gain or loss"}
        >
          <span aria-hidden="true">&lt;</span>
          <span>{isOverall ? "Overall" : "Today"}</span>
          <span aria-hidden="true">&gt;</span>
        </button>
      </div>
      <div className={`mt-3 text-xl font-semibold leading-tight sm:text-2xl ${toneClass}`}>
        {formatSignedMoney(value, "AED", isAmountsVisible)}
      </div>
      <div className="mt-1.5 text-sm text-text-muted">
        {isOverall ? `${formatSignedPercent(percent)} overall` : `${formatSignedPercent(percent)} vs previous day`}
      </div>
    </div>
  );
}

export default function PortfolioSummaryStrip({
  portfolioValue,
  investedAmount,
  totalGainLoss,
  totalGainLossPercent,
  dailyChange,
  dailyChangePercent,
  fxRate,
  isAmountsVisible,
}: Props) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        label="Portfolio Value"
        value={formatOrMask(portfolioValue, "AED", isAmountsVisible)}
        subtext="Current market value"
      />
      <SummaryCard
        label="Invested"
        value={formatOrMask(investedAmount, "AED", isAmountsVisible)}
        subtext="Total capital invested"
      />
      <PerformanceToggleCard
        totalGainLoss={totalGainLoss}
        totalGainLossPercent={totalGainLossPercent}
        dailyChange={dailyChange}
        dailyChangePercent={dailyChangePercent}
        isAmountsVisible={isAmountsVisible}
      />
      <SummaryCard
        label="FX Rate"
        value={fxRate.toFixed(2)}
        subtext="AED/INR"
      />
    </section>
  );
}
