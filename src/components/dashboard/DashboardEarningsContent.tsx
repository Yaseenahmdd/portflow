"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import EarningsDetailView from "@/components/dashboard/EarningsDetailView";
import { ResultChips } from "@/components/dashboard/EarningsResultSummary";
import { useEarningsRows } from "@/hooks/useHoldingsEarnings";
import type { ComputedHolding } from "@/lib/constants";
import {
  daysUntil,
  formatDaysUntil,
  formatEarningsDate,
  formatSignedPercent,
  getLatestReport,
  getReportedTimeline,
  localToday,
  summarizeReported,
  toneClass,
  type EarningsRow,
} from "@/lib/earnings";
import { tap } from "@/lib/haptics";
import { timeAgo } from "@/lib/utils";

type EarningsView = "upcoming" | "reported";

const GROUPS = [
  { label: "Next 7 days", maxDays: 7 },
  { label: "Next 30 days", maxDays: 30 },
  { label: "Later", maxDays: Infinity },
];

const STALE_SNAPSHOT_MS = 48 * 60 * 60 * 1000;

function isStaleSnapshot(updatedAt: string) {
  return Date.now() - Date.parse(updatedAt) > STALE_SNAPSHOT_MS;
}

function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface DashboardEarningsContentProps {
  holdings: ComputedHolding[];
  totalValue: number;
  isAmountsVisible: boolean;
}

export default function DashboardEarningsContent({ holdings, totalValue, isAmountsVisible }: DashboardEarningsContentProps) {
  const { rows, uncovered, loading, error, updatedAt } = useEarningsRows(holdings, totalValue);
  const [view, setView] = useState<EarningsView>("upcoming");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const today = localToday();

  const groups = useMemo(() => {
    if (view === "reported") {
      const reported = rows
        .filter((row) => getLatestReport(row.summary))
        .sort((a, b) => getLatestReport(b.summary)!.reportedDate.localeCompare(getLatestReport(a.summary)!.reportedDate));
      return [{ label: "Most recent first", rows: reported }];
    }
    const dated = rows.filter((row) => row.summary?.upcoming);
    const result = GROUPS.map((group, index) => ({
      label: group.label,
      rows: dated.filter((row) => {
        const days = daysUntil(row.summary!.upcoming!.date, today);
        return days <= group.maxDays && (index === 0 || days > GROUPS[index - 1].maxDays);
      }),
    }));
    result.push({ label: "No date available", rows: rows.filter((row) => !row.summary?.upcoming) });
    return result.filter((group) => group.rows.length);
  }, [rows, today, view]);

  const ordered = useMemo(() => groups.flatMap((group) => group.rows), [groups]);
  const selected = ordered.find((row) => row.symbol === selectedSymbol) ?? ordered[0] ?? null;
  const reportedSummary = useMemo(() => summarizeReported(getReportedTimeline(rows, today)), [rows, today]);
  const next = rows.find((row) => row.summary?.upcoming);

  const selectRow = (symbol: string) => {
    tap();
    setSelectedSymbol(symbol);
    setMobileDetailOpen(true);
    if (window.matchMedia?.("(max-width: 1023px)").matches) {
      sectionRef.current?.scrollIntoView({ block: "start" });
    }
  };

  if (!rows.length && !uncovered.length) {
    return (
      <section className="dashboard-card rounded-2xl border border-border-default bg-bg-card px-5 py-10 text-center">
        <h2 className="font-display text-base font-semibold tracking-[-0.03em] text-text-primary">No stocks to track</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">
          Earnings apply to individual company stocks. ETFs, funds, crypto and cash don&apos;t report earnings.
        </p>
        <Link
          href="/dashboard/holdings"
          className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-accent-violet px-4 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
        >
          Go to Holdings
        </Link>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="dashboard-card scroll-mt-4 overflow-hidden rounded-2xl border border-border-default bg-bg-card">
      <div className="flex flex-col gap-3 border-b border-border-default px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div className="flex flex-col gap-1">
          <div className="ledger-kicker">Earnings</div>
          <h2 className="font-display text-lg font-semibold tracking-[-0.03em] text-text-primary">
            {rows.length} stock{rows.length === 1 ? "" : "s"} you hold
          </h2>
          <p className="text-xs text-text-muted">
            {loading
              ? "Loading report dates…"
              : view === "reported"
                ? "Latest results per stock: EPS, revenue and guidance."
                : next?.summary?.upcoming
                  ? `Next up: ${next.symbol} on ${formatEarningsDate(next.summary.upcoming.date)} (${formatDaysUntil(daysUntil(next.summary.upcoming.date, today)).toLowerCase()})`
                  : "No upcoming report dates yet."}
          </p>
          {!loading && updatedAt ? (
            <p className={`text-[11px] ${isStaleSnapshot(updatedAt) ? "text-accent-amber" : "text-text-muted"}`}>
              {isStaleSnapshot(updatedAt)
                ? `Couldn't refresh recently. Showing data from ${formatShortDate(updatedAt.slice(0, 10))}.`
                : `Updated ${timeAgo(updatedAt).toLowerCase()}`}
            </p>
          ) : null}
        </div>
        <div className="inline-flex self-start rounded-lg border border-border-subtle bg-bg-elevated p-0.5 sm:self-auto" role="group" aria-label="Earnings view">
          {(["upcoming", "reported"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => {
                tap();
                setView(option);
                setSelectedSymbol(null);
                setMobileDetailOpen(false);
              }}
              className={`min-h-9 rounded-md px-3 text-xs font-semibold capitalize transition-colors ${
                view === option ? "bg-bg-card text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="border-b border-border-default bg-accent-loss-bg px-4 py-3 text-sm text-accent-loss sm:px-5">
          Couldn&apos;t load earnings data. {error}
        </div>
      ) : null}

      {view === "reported" && !loading ? (
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border-default px-4 py-3 text-xs text-text-muted sm:px-5">
          <span>
            Last 12 months: <span className="font-mono font-semibold text-accent-gain">{reportedSummary.beats}</span> EPS beats ·{" "}
            <span className="font-mono font-semibold text-accent-loss">{reportedSummary.misses}</span> misses
          </span>
          {reportedSummary.biggestMove?.result.priceReaction ? (
            <span>
              Biggest move{" "}
              <span className={`font-mono font-semibold ${toneClass(reportedSummary.biggestMove.result.priceReaction.changePercent)}`}>
                {reportedSummary.biggestMove.row.symbol} {formatSignedPercent(reportedSummary.biggestMove.result.priceReaction.changePercent)}
              </span>{" "}
              ({formatShortDate(reportedSummary.biggestMove.result.reportedDate)})
            </span>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <div className="skeleton h-64 rounded-xl" />
          <div className="skeleton hidden h-64 rounded-xl lg:block" />
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)]">
          <nav
            aria-label="Stocks"
            className={`${mobileDetailOpen ? "hidden lg:block" : ""} lg:sticky lg:top-0 lg:self-start lg:border-r lg:border-border-subtle`}
          >
            {groups.map((group) => (
              <div key={group.label}>
                <div className="px-4 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.13em] text-text-muted sm:px-5 lg:border-b lg:border-border-subtle lg:bg-bg-secondary lg:py-2">
                  {group.label}
                </div>
                <ul className="grid gap-3 px-4 pb-2 pt-2 sm:grid-cols-2 sm:px-5 lg:block lg:p-0">
                  {group.rows.map((row) => (
                    <li key={row.symbol}>
                      <StockItem
                        row={row}
                        view={view}
                        today={today}
                        selected={selected?.symbol === row.symbol}
                        onSelect={() => selectRow(row.symbol)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className={`${mobileDetailOpen ? "block" : "hidden"} min-w-0 px-4 py-4 sm:px-5 sm:py-5 lg:block`}>
            <button
              type="button"
              onClick={() => {
                tap();
                setMobileDetailOpen(false);
              }}
              className="mb-4 inline-flex min-h-9 items-center gap-1 rounded-lg border border-border-subtle px-3 text-xs font-semibold text-text-secondary lg:hidden"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.78 5.22a.75.75 0 010 1.06L9.06 10l3.72 3.72a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0z" clipRule="evenodd" />
              </svg>
              All stocks
            </button>
            {selected ? (
              <EarningsDetailView key={selected.symbol} row={selected} today={today} isAmountsVisible={isAmountsVisible} />
            ) : (
              <p className="text-sm text-text-muted">No reports to show yet.</p>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-border-default px-4 py-3 text-[11px] text-text-muted sm:px-5">
        {uncovered.length ? (
          <p>
            No earnings data for {uncovered.map((holding) => `${holding.assetName} (${holding.ticker})`).join(", ")}.
          </p>
        ) : (
          <p>Estimated dates follow past reporting patterns; projected dates are one quarter after the last report.</p>
        )}
      </div>
    </section>
  );
}

function StockItem({
  row,
  view,
  today,
  selected,
  onSelect,
}: {
  row: EarningsRow;
  view: EarningsView;
  today: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const upcoming = row.summary?.upcoming ?? null;
  const latest = getLatestReport(row.summary);
  const names = [...new Set(row.holdings.map((holding) => holding.assetName))].join(" / ");
  const days = upcoming ? daysUntil(upcoming.date, today) : null;
  const move = latest?.priceReaction?.changePercent;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={`block w-full rounded-xl border border-border-subtle p-4 text-left transition-colors hover:bg-bg-card-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-violet lg:rounded-none lg:border-0 lg:border-b lg:border-l-2 lg:px-5 lg:py-3 ${
        selected ? "lg:border-l-accent-violet lg:bg-bg-card-hover" : "lg:border-l-transparent"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-semibold text-text-primary">{names}</span>
        {view === "upcoming" && days !== null ? (
          <span className={`shrink-0 text-xs ${days <= 7 ? "font-semibold text-accent-violet" : "text-text-muted"}`}>{formatDaysUntil(days)}</span>
        ) : view === "reported" && move !== undefined && move !== null ? (
          <span className={`shrink-0 font-mono text-xs font-semibold ${toneClass(move)}`} title="Stock move after the report">
            {formatSignedPercent(move)}
          </span>
        ) : null}
      </div>
      <div className="mt-0.5 truncate font-mono text-[11px] text-text-muted">
        {row.symbol}
        {view === "upcoming"
          ? upcoming
            ? ` · ${formatEarningsDate(upcoming.date)}${upcoming.status === "confirmed" ? "" : ` · ${upcoming.status}`}`
            : " · no date yet"
          : latest
            ? ` · ${latest.fiscalQuarter} · ${formatShortDate(latest.reportedDate)}`
            : ""}
      </div>
      <div className="mt-2">
        {view === "upcoming" ? <span className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-text-muted">Last report</span> : null}
        <ResultChips result={latest} />
      </div>
    </button>
  );
}
