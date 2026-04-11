"use client";

import { useState } from "react";
import { formatMoney, formatOrMask } from "@/lib/utils";

interface Props {
  holdingsCount: number;
  portfolioValue: number;
  investedAmount: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dailyChange: number;
  dailyChangePercent: number;
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
        <div className="whitespace-nowrap text-xs text-text-secondary sm:text-sm">
          {isOverall ? "Total G/L" : "Today"}
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
  holdingsCount,
  portfolioValue,
  investedAmount,
  totalGainLoss,
  totalGainLossPercent,
  dailyChange,
  dailyChangePercent,
  isAmountsVisible,
}: Props) {
  const mobilePortfolioValue = splitPortfolioValue(portfolioValue, isAmountsVisible);

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

      <section className="hidden grid-cols-2 gap-3 sm:grid sm:gap-4 xl:grid-cols-3">
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
      </section>
    </>
  );
}
