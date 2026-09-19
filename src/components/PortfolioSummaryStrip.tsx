"use client";

import Link from "next/link";
import { useState } from "react";
import { formatOrMask } from "@/lib/utils";
import { tap, toggle } from "@/lib/haptics";

type GainView = "today" | "overall";

interface Props {
  holdingsCount: number;
  portfolioValue: number;
  portfolioHistory: { value: number }[];
  investedAmount: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  todayChange: number | null;
  todayChangePercent: number | null;
  periodLabel: string;
  periodChange: number | null;
  periodReturnPercent: number | null;
  isAmountsVisible: boolean;
}

function formatSignedMoney(value: number, isVisible: boolean) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatOrMask(Math.abs(value), "AED", isVisible)}`;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatAmountWithoutCurrency(value: number, isVisible: boolean) {
  return formatOrMask(value, "AED", isVisible).replace(/^AED\s*/, "");
}

function DirhamSymbol({ className }: { className: string }) {
  return (
    <span className={`inline-flex items-center justify-center leading-none ${className}`} dir="rtl" lang="ar" aria-hidden="true">
      د.إ
    </span>
  );
}

function MobileReturnValue({
  value,
  percent,
  isVisible,
}: {
  value: number;
  percent: number | null;
  isVisible: boolean;
}) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-1 whitespace-nowrap">
      <span>{sign}</span>
      <DirhamSymbol className="shrink-0 text-[11px] font-medium" />
      <span>{formatAmountWithoutCurrency(Math.abs(value), isVisible)}</span>
      {percent === null ? null : <span>({formatSignedPercent(percent)})</span>}
    </span>
  );
}

function valueTone(value: number | null) {
  if (value === null || value === 0) return "text-text-primary";
  return value > 0 ? "portfolio-summary-gain" : "text-accent-loss";
}

function PortfolioValueSparkline({ points }: { points: { value: number }[] }) {
  const values = points.map((point) => point.value).filter(Number.isFinite);
  if (values.length < 2) return null;

  const minimum = Math.min(...values);
  const range = Math.max(...values) - minimum || 1;
  const coordinates = values.map((value, index) => ({
    x: 8 + (index / (values.length - 1)) * 120,
    y: 42 - ((value - minimum) / range) * 30,
  }));
  const path = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const last = coordinates[coordinates.length - 1];

  return (
    <svg className="portfolio-summary-sparkline" viewBox="0 0 144 54" aria-hidden="true">
      <path d={path} fill="none" stroke="var(--color-accent-violet)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="portfolio-summary-live-pulse" cx={last.x} cy={last.y} r="7" fill="rgba(255, 138, 0, 0.28)" />
      <circle className="portfolio-summary-live-dot" cx={last.x} cy={last.y} r="3.5" fill="var(--color-accent-violet)" />
      <circle cx={last.x} cy={last.y} r="1.2" fill="#fff" />
    </svg>
  );
}

export default function PortfolioSummaryStrip({
  holdingsCount,
  portfolioValue,
  portfolioHistory,
  investedAmount,
  totalGainLoss,
  totalGainLossPercent,
  todayChange,
  todayChangePercent,
  periodLabel,
  periodChange,
  periodReturnPercent,
  isAmountsVisible,
}: Props) {
  const [gainView, setGainView] = useState<GainView>("today");
  const gainChange = gainView === "today" ? todayChange : totalGainLoss;
  const gainPercent = gainView === "today" ? todayChangePercent : totalGainLossPercent;
  const portfolioAmount = formatOrMask(portfolioValue, "AED", isAmountsVisible).replace(/^AED\s*/, "");

  return (
    <>
      <section aria-label="Portfolio summary" className="rounded-3xl border border-border-subtle bg-bg-card p-5 text-text-primary sm:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/dashboard/holdings"
              onClick={tap}
              className="inline-flex min-h-8 items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-text-muted"
            >
              Holdings ({holdingsCount})
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z" clipRule="evenodd" />
              </svg>
            </Link>
            <div className="mt-2 flex min-w-0 items-baseline gap-2 whitespace-nowrap font-semibold tracking-[-0.035em]">
              <DirhamSymbol className="shrink-0 text-base font-medium text-text-muted" />
              <span className="truncate text-[2rem] leading-tight tabular-nums">{portfolioAmount}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => {
                toggle();
                window.dispatchEvent(new CustomEvent("portflow:toggle-visibility", {
                  detail: { visible: !isAmountsVisible },
                }));
              }}
              className="group inline-flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-colors hover:text-text-primary"
              aria-label={isAmountsVisible ? "Hide values" : "Show values"}
            >
              <span className="inline-flex h-7 w-7 translate-x-1.5 items-center justify-center rounded-full border border-border-default transition-colors group-hover:bg-bg-elevated">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  {!isAmountsVisible ? <path strokeLinecap="round" d="m3 3 18 18" /> : null}
                </svg>
              </span>
            </button>
            <Link
              href="/dashboard/history"
              onClick={tap}
              className="group inline-flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-colors hover:text-text-primary"
              aria-label="View portfolio history"
            >
              <span className="inline-flex h-7 w-7 -translate-x-1.5 items-center justify-center rounded-full border border-border-default transition-colors group-hover:bg-bg-elevated">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5l5-5 4 3 7-8" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 6.5h3.5V10" />
                </svg>
              </span>
            </Link>
          </div>
        </div>

        <div className="mt-5 space-y-4 border-t border-dashed border-border-default pt-5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-text-muted">Today returns</span>
            <span className={`text-right text-sm font-semibold tabular-nums ${valueTone(todayChange)}`}>
              {todayChange === null ? "—" : (
                <MobileReturnValue value={todayChange} percent={todayChangePercent} isVisible={isAmountsVisible} />
              )}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-text-muted">Total returns</span>
            <span className={`text-right text-sm font-semibold tabular-nums ${valueTone(totalGainLoss)}`}>
              <MobileReturnValue value={totalGainLoss} percent={totalGainLossPercent} isVisible={isAmountsVisible} />
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-text-muted">Invested</span>
            <span className="text-right text-sm font-semibold tabular-nums text-text-primary">
              <span className="inline-flex items-center justify-end gap-x-1 whitespace-nowrap">
                <DirhamSymbol className="shrink-0 text-[11px] font-medium" />
                <span>{formatAmountWithoutCurrency(investedAmount, isAmountsVisible)}</span>
              </span>
            </span>
          </div>
        </div>
      </section>

      <section aria-label="Portfolio summary" tabIndex={0} className="portfolio-summary-scroll hidden rounded-xl border border-border-subtle bg-bg-card text-text-primary sm:block">
        <div className="portfolio-summary-grid">
        <div className="min-w-0 p-4 sm:p-6">
          <div className="relative flex min-h-8 flex-wrap items-center gap-x-2 pr-10 lg:pr-0">
            <h1 className="text-sm font-medium text-text-secondary">Portfolio value</h1>
            <span aria-hidden="true" className="text-text-muted">·</span>
            <span className="text-[13px] text-text-muted">{holdingsCount} holdings</span>
            <button
              type="button"
              onClick={() => {
                toggle();
                window.dispatchEvent(new CustomEvent("portflow:toggle-visibility", {
                  detail: { visible: !isAmountsVisible },
                }));
              }}
              className="absolute -right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary lg:hidden"
              aria-label={isAmountsVisible ? "Hide values" : "Show values"}
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                {!isAmountsVisible ? <path strokeLinecap="round" d="m3 3 18 18" /> : null}
              </svg>
            </button>
          </div>
          <div className="portfolio-summary-value-row mt-2 font-semibold tracking-[-0.03em]">
            <div className="flex items-baseline gap-x-2 whitespace-nowrap">
            <span className="text-sm font-normal tracking-normal text-text-muted sm:text-base">AED</span>
            <span className="text-[1.75rem] leading-10 tabular-nums sm:text-[2rem]">{portfolioAmount}</span>
            </div>
            <PortfolioValueSparkline points={portfolioHistory} />
          </div>
          <p className="mt-2 text-[13px] leading-5 text-text-muted">
            Invested <span className="ml-1 tabular-nums text-text-secondary">{formatOrMask(investedAmount, "AED", isAmountsVisible)}</span>
          </p>
        </div>

          <div className="min-w-0 border-t border-border-subtle p-4 sm:border-l sm:border-t-0 sm:p-6">
            <div className="flex min-h-8 items-center gap-3" role="group" aria-label="Gain period">
              {(["today", "overall"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={gainView === option}
                  onClick={() => { toggle(); setGainView(option); }}
                  className={`relative min-h-8 text-[13px] font-medium transition-colors before:absolute before:-inset-y-1.5 before:inset-x-0 ${gainView === option ? "text-text-primary after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-text-secondary" : "text-text-muted hover:text-text-primary"}`}
                >
                  {option === "today" ? "Today" : "Overall"}
                </button>
              ))}
            </div>
            <div className={`mt-2 min-h-10 break-words text-lg font-semibold leading-10 tabular-nums sm:text-2xl ${valueTone(gainChange)}`}>
              {gainChange === null ? "—" : formatSignedMoney(gainChange, isAmountsVisible)}
            </div>
            <p className="mt-2 text-[13px] leading-5 text-text-muted">
              {gainChange === null ? "Price data unavailable" : gainPercent === null ? "—" : formatSignedPercent(gainPercent)}
            </p>
          </div>
          <div className="min-w-0 border-t border-border-subtle px-4 py-3 sm:border-l sm:border-t-0 sm:p-6">
            <div className="flex items-center justify-between gap-4 sm:block">
              <div className="flex min-h-8 items-center text-[13px] text-text-secondary">{periodLabel} performance</div>
              <div className="min-w-0 text-right sm:text-left">
                <div className={`break-words text-base font-semibold leading-6 tabular-nums sm:mt-2 sm:min-h-10 sm:text-2xl sm:leading-10 ${valueTone(periodChange)}`}>
                  {periodChange === null ? "—" : formatSignedMoney(periodChange, isAmountsVisible)}
                </div>
                <p className="mt-0.5 text-[12px] leading-4 text-text-muted sm:mt-2 sm:text-[13px] sm:leading-5">
                  {periodChange === null || periodReturnPercent === null ? "Not enough history" : formatSignedPercent(periodReturnPercent)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
