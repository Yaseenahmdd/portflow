"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getBenchmarkPerformance,
  type BenchmarkPoint,
} from "@/lib/benchmark-performance";
import type { ComputedHolding } from "@/lib/constants";
import { tap } from "@/lib/haptics";
import {
  filterSnapshotsByRange,
  getBestAndWorstMarketMoves,
  getContributionAdjustedPerformance,
  getPortfolioActivity,
  HISTORY_RANGES,
  type HistoryRange,
  type PortfolioActivityPoint,
} from "@/lib/portfolio-analytics";
import type { PortfolioSnapshot } from "@/lib/portfolio-snapshots";
import { getTransactionPerformance } from "@/lib/transaction-performance";
import type { PortfolioTransaction } from "@/lib/transactions";
import { formatMoney, formatOrMask } from "@/lib/utils";

interface DashboardHistoryContentProps {
  holdings: ComputedHolding[];
  snapshots: PortfolioSnapshot[];
  transactions: PortfolioTransaction[];
  inrToAedRate: number;
  isAmountsVisible: boolean;
}

interface BenchmarkApiResponse {
  success?: boolean;
  data?: {
    points?: BenchmarkPoint[];
  };
  error?: string;
}

interface BenchmarkLoadState {
  rangeKey: string;
  points: BenchmarkPoint[];
  error: string | null;
}

function formatSignedMoney(value: number, isVisible: boolean) {
  if (!isVisible) {
    const sign = value > 0 ? "+" : value < 0 ? "-" : "";
    return `${sign}${formatOrMask(Math.abs(value), "AED", false)}`;
  }

  const formatted = formatMoney(Math.abs(value), "AED");
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatDate(snapshotDate: string) {
  return new Date(`${snapshotDate}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function valueTone(value: number | null) {
  if (value === null || value === 0) return "text-text-primary";
  return value > 0 ? "text-accent-gain" : "text-accent-loss";
}

function PeriodSelector({
  selectedRange,
  onChange,
}: {
  selectedRange: HistoryRange;
  onChange: (range: HistoryRange) => void;
}) {
  return (
    <div
      className="flex w-full items-center gap-1 sm:w-auto"
      role="group"
      aria-label="Select history period"
    >
      {HISTORY_RANGES.map((range) => {
        const active = selectedRange === range.label;

        return (
          <button
            key={range.label}
            type="button"
            onClick={() => {
              tap();
              onChange(range.label);
            }}
            aria-pressed={active}
            title={range.name}
            className={`relative h-11 min-w-0 flex-1 px-1 text-[13px] font-medium transition sm:w-10 sm:flex-none ${
              active
                ? "text-text-primary after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:w-3 after:-translate-x-1/2 after:rounded-full after:bg-accent-violet"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {range.label === "ALL" ? "All" : range.label}
          </button>
        );
      })}
    </div>
  );
}

function BreakdownValue({
  label,
  value,
  detail,
  tone = "text-text-primary",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="text-[13px] font-medium text-text-muted">
        {label}
      </div>
      <div className={`mt-1.5 truncate font-mono text-lg font-semibold ${tone}`}>{value}</div>
      {detail ? <div className={`mt-1 text-xs ${tone}`}>{detail}</div> : null}
    </div>
  );
}

export default function DashboardHistoryContent({
  holdings,
  snapshots,
  transactions,
  inrToAedRate,
  isAmountsVisible,
}: DashboardHistoryContentProps) {
  const [selectedRange, setSelectedRange] = useState<HistoryRange>("1M");
  const [benchmarkState, setBenchmarkState] = useState<BenchmarkLoadState>({
    rangeKey: "",
    points: [],
    error: null,
  });
  const benchmarkDateRange = useMemo(() => {
    const dates = snapshots
      .map((snapshot) => snapshot.snapshotDate)
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
      .sort((a, b) => a.localeCompare(b));

    if (!dates.length) return null;
    return { startDate: dates[0], endDate: dates[dates.length - 1] };
  }, [snapshots]);
  const benchmarkRangeKey = benchmarkDateRange
    ? `${benchmarkDateRange.startDate}:${benchmarkDateRange.endDate}`
    : "";
  const benchmarkStateIsCurrent = benchmarkState.rangeKey === benchmarkRangeKey;
  const benchmarkError = benchmarkStateIsCurrent ? benchmarkState.error : null;
  const benchmarkLoading = Boolean(benchmarkRangeKey && !benchmarkStateIsCurrent);

  useEffect(() => {
    if (!benchmarkDateRange) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      start: benchmarkDateRange.startDate,
      end: benchmarkDateRange.endDate,
    });

    fetch(`/api/prices/benchmark?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as BenchmarkApiResponse;
        if (!response.ok || !result.success || !Array.isArray(result.data?.points)) {
          throw new Error(result.error || "S&P 500 data is unavailable");
        }
        return result.data.points;
      })
      .then((points) => setBenchmarkState({ rangeKey: benchmarkRangeKey, points, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setBenchmarkState({
          rangeKey: benchmarkRangeKey,
          points: [],
          error: error instanceof Error ? error.message : "S&P 500 data is unavailable",
        });
      });

    return () => controller.abort();
  }, [benchmarkDateRange, benchmarkRangeKey]);

  const filteredSnapshots = useMemo(
    () => filterSnapshotsByRange(snapshots, selectedRange),
    [selectedRange, snapshots]
  );
  const performance = useMemo(
    () => getContributionAdjustedPerformance(filteredSnapshots, selectedRange === "ALL"),
    [filteredSnapshots, selectedRange]
  );
  const activity = useMemo(
    () => getPortfolioActivity(filteredSnapshots),
    [filteredSnapshots]
  );
  const marketMoves = useMemo(
    () => getBestAndWorstMarketMoves(activity),
    [activity]
  );
  const contributors = useMemo(() => {
    const positive = holdings
      .filter((holding) => holding.gainLossAed > 0)
      .sort((a, b) => b.gainLossAed - a.gainLossAed)
      .slice(0, 3);
    const negative = holdings
      .filter((holding) => holding.gainLossAed < 0)
      .sort((a, b) => a.gainLossAed - b.gainLossAed)
      .slice(0, 3);

    return { positive, negative };
  }, [holdings]);

  const firstSnapshot = filteredSnapshots[0] ?? null;
  const latestSnapshot = filteredSnapshots[filteredSnapshots.length - 1] ?? null;
  const transactionPerformance = useMemo(
    () =>
      getTransactionPerformance(transactions, {
        startDate: selectedRange === "ALL" ? null : firstSnapshot?.snapshotDate,
        endDate: latestSnapshot?.snapshotDate,
        inrToAedRate,
      }),
    [firstSnapshot?.snapshotDate, inrToAedRate, latestSnapshot?.snapshotDate, selectedRange, transactions]
  );
  const activityAdjustedReturn =
    (performance.adjustedChangeAed || 0) +
    transactionPerformance.realizedGainAed +
    transactionPerformance.dividendIncomeAed -
    transactionPerformance.standaloneFeesAed;
  const activityReturnBase =
    (latestSnapshot?.totalInvestedAed || 0) + transactionPerformance.soldCostBasisAed;
  const activityReturnPercent = activityReturnBase > 0
    ? (activityAdjustedReturn / activityReturnBase) * 100
    : null;
  const benchmarkPerformance = useMemo(
    () =>
      getBenchmarkPerformance(
        benchmarkStateIsCurrent ? benchmarkState.points : [],
        firstSnapshot?.snapshotDate,
        latestSnapshot?.snapshotDate
      ),
    [
      benchmarkState.points,
      benchmarkStateIsCurrent,
      firstSnapshot?.snapshotDate,
      latestSnapshot?.snapshotDate,
    ]
  );
  const relativePerformance =
    activityReturnPercent !== null && benchmarkPerformance
      ? activityReturnPercent - benchmarkPerformance.returnPercent
      : null;
  const dateSpan =
    firstSnapshot && latestSnapshot
      ? firstSnapshot.snapshotDate === latestSnapshot.snapshotDate
        ? formatDate(firstSnapshot.snapshotDate)
        : `${formatDate(firstSnapshot.snapshotDate)} – ${formatDate(latestSnapshot.snapshotDate)}`
      : "No history yet";
  const marketTone = valueTone(performance.adjustedChangeAed);

  return (
    <div className="space-y-4 sm:space-y-5">
      <header>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.04em] text-text-primary">
            History
          </h1>
          <div className="mt-1 text-xs text-text-muted">{dateSpan}</div>
        </div>
      </header>

      <section className="dashboard-card overflow-hidden rounded-2xl border border-border-default bg-bg-card shadow-sm">
        <div className="flex flex-col gap-2 border-b border-border-default px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <h2 className="font-display text-base font-semibold tracking-[-0.03em] text-text-primary">
            Period Breakdown
          </h2>
          <div className="max-w-full overflow-x-auto">
            <PeriodSelector selectedRange={selectedRange} onChange={setSelectedRange} />
          </div>
        </div>
        <div className="grid divide-y divide-border-default sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <BreakdownValue
            label="Opening value"
            value={
              firstSnapshot
                ? formatOrMask(firstSnapshot.totalValueAed, "AED", isAmountsVisible)
                : "—"
            }
          />
          <BreakdownValue
            label="Net invested"
            value={
              performance.adjustedChangeAed !== null
                ? formatSignedMoney(performance.estimatedContributionsAed, isAmountsVisible)
                : "—"
            }
          />
          <BreakdownValue
            label="Market gain / loss"
            value={
              performance.adjustedChangeAed !== null
                ? formatSignedMoney(performance.adjustedChangeAed, isAmountsVisible)
                : "—"
            }
            detail={
              performance.returnPercent !== null
                ? formatSignedPercent(performance.returnPercent)
                : "Not enough history"
            }
            tone={marketTone}
          />
          <BreakdownValue
            label="Closing value"
            value={
              latestSnapshot
                ? formatOrMask(latestSnapshot.totalValueAed, "AED", isAmountsVisible)
                : "—"
            }
          />
        </div>
      </section>

      <section className="dashboard-card overflow-hidden rounded-2xl border border-border-default bg-bg-card shadow-sm">
        <div className="border-b border-border-default px-4 py-3 sm:px-5">
          <h2 className="font-display text-base font-semibold tracking-[-0.03em] text-text-primary">
            Activity-adjusted Performance
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Includes recorded sales, dividends, fees, deposits, and withdrawals in this period.
          </p>
        </div>
        <div className="grid divide-y divide-border-default sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
          <BreakdownValue
            label="Total return"
            value={formatSignedMoney(activityAdjustedReturn, isAmountsVisible)}
            detail={activityReturnPercent === null ? "No invested capital" : formatSignedPercent(activityReturnPercent)}
            tone={valueTone(activityAdjustedReturn)}
          />
          <BreakdownValue
            label="Realized P/L"
            value={formatSignedMoney(transactionPerformance.realizedGainAed, isAmountsVisible)}
            detail="Closed trades"
            tone={valueTone(transactionPerformance.realizedGainAed)}
          />
          <BreakdownValue
            label="Dividends"
            value={formatSignedMoney(transactionPerformance.dividendIncomeAed, isAmountsVisible)}
            detail={`${transactionPerformance.incomeSources.reduce((sum, source) => sum + source.count, 0)} payment${transactionPerformance.incomeSources.reduce((sum, source) => sum + source.count, 0) === 1 ? "" : "s"}`}
            tone={valueTone(transactionPerformance.dividendIncomeAed)}
          />
          <BreakdownValue
            label="Fees"
            value={
              transactionPerformance.totalFeesAed
                ? `-${formatOrMask(transactionPerformance.totalFeesAed, "AED", isAmountsVisible)}`
                : formatOrMask(0, "AED", isAmountsVisible)
            }
            detail="Trade and account fees"
            tone={transactionPerformance.totalFeesAed ? "text-accent-loss" : "text-text-primary"}
          />
          <BreakdownValue
            label="Net cash flow"
            value={
              transactionPerformance.depositsAed || transactionPerformance.withdrawalsAed
                ? formatSignedMoney(transactionPerformance.netCashFlowAed, isAmountsVisible)
                : "—"
            }
            detail={
              transactionPerformance.depositsAed || transactionPerformance.withdrawalsAed
                ? "Deposits less withdrawals"
                : "No cash entries"
            }
          />
        </div>

        {transactionPerformance.incomeSources.length ? (
          <div className="border-t border-border-default px-4 py-4 sm:px-5">
            <div className="text-xs font-medium text-text-muted">Dividend income by asset</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {transactionPerformance.incomeSources.map((source) => (
                <div key={source.key} className="flex items-center justify-between gap-3 rounded-xl bg-bg-elevated px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-text-primary">{source.name}</div>
                    <div className="mt-0.5 text-[11px] text-text-muted">
                      {source.count} payment{source.count === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="shrink-0 font-mono text-sm font-semibold text-accent-gain">
                    {formatSignedMoney(source.amountAed, isAmountsVisible)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {transactionPerformance.issues.length ? (
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 sm:px-5">
            {transactionPerformance.issues.length} Activity entr{transactionPerformance.issues.length === 1 ? "y needs" : "ies need"} review before all realized gains can be calculated.
          </div>
        ) : null}
      </section>

      <section className="dashboard-card overflow-hidden rounded-2xl border border-border-default bg-bg-card shadow-sm">
        <div className="border-b border-border-default px-4 py-3 sm:px-5">
          <h2 className="font-display text-base font-semibold tracking-[-0.03em] text-text-primary">
            S&amp;P 500 Benchmark
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            {benchmarkPerformance
              ? `${formatDate(benchmarkPerformance.startDate)} – ${formatDate(benchmarkPerformance.endDate)} · Price return, excluding dividends.`
              : benchmarkLoading
                ? "Loading market comparison…"
                : benchmarkError || "Not enough overlapping market history for this period."}
          </p>
        </div>
        <div className="grid divide-y divide-border-default sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <BreakdownValue
            label="Your portfolio"
            value={activityReturnPercent === null ? "—" : formatSignedPercent(activityReturnPercent)}
            detail="Activity-adjusted return"
            tone={valueTone(activityReturnPercent)}
          />
          <BreakdownValue
            label="S&P 500"
            value={
              benchmarkLoading
                ? "Loading…"
                : benchmarkPerformance
                  ? formatSignedPercent(benchmarkPerformance.returnPercent)
                  : "—"
            }
            detail="Index price return"
            tone={valueTone(benchmarkPerformance?.returnPercent ?? null)}
          />
          <BreakdownValue
            label="Ahead / behind"
            value={relativePerformance === null ? "—" : formatSignedPercent(relativePerformance)}
            detail={
              relativePerformance === null
                ? "Waiting for comparable data"
                : relativePerformance >= 0
                  ? "Ahead of the S&P 500"
                  : "Behind the S&P 500"
            }
            tone={valueTone(relativePerformance)}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="dashboard-card rounded-2xl border border-border-default bg-bg-card p-5 shadow-sm">
          <h2 className="font-display text-base font-semibold tracking-[-0.03em] text-text-primary">
            Market Movement
          </h2>
          <div className="mt-3 divide-y divide-border-default">
            <MarketMoveRow label="Best day" move={marketMoves.best} isAmountsVisible={isAmountsVisible} />
            <MarketMoveRow label="Worst day" move={marketMoves.worst} isAmountsVisible={isAmountsVisible} />
          </div>
        </section>

        <section className="dashboard-card rounded-2xl border border-border-default bg-bg-card p-5 shadow-sm">
          <h2 className="font-display text-base font-semibold tracking-[-0.03em] text-text-primary">
            Current Contributors
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-border-default">
            <ContributorList
              label="Top contributors"
              holdings={contributors.positive}
              isAmountsVisible={isAmountsVisible}
              className="sm:pr-5"
            />
            <ContributorList
              label="Largest drags"
              holdings={contributors.negative}
              isAmountsVisible={isAmountsVisible}
              className="sm:pl-5"
            />
          </div>
        </section>
      </div>

      <section className="dashboard-card overflow-hidden rounded-2xl border border-border-default bg-bg-card shadow-sm">
        <div className="border-b border-border-default px-5 py-4">
          <h2 className="font-display text-base font-semibold tracking-[-0.03em] text-text-primary">
            Activity
          </h2>
        </div>

        <div className="divide-y divide-border-default sm:hidden">
          {[...activity].reverse().map((point) => (
            <MobileActivityRow
              key={point.snapshot.snapshotDate}
              point={point}
              isAmountsVisible={isAmountsVisible}
            />
          ))}
          {!activity.length ? (
            <div className="px-5 py-8 text-center text-sm text-text-secondary">
              No activity in this period.
            </div>
          ) : null}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="min-w-full text-sm">
            <thead className="bg-bg-elevated text-[11px] text-text-muted">
              <tr>
                <th className="px-5 py-2.5 text-left font-semibold">Date</th>
                <th className="px-5 py-2.5 text-right font-semibold">Value</th>
                <th className="px-5 py-2.5 text-right font-semibold">Invested</th>
                <th className="px-5 py-2.5 text-right font-semibold">Capital flow</th>
                <th className="px-5 py-2.5 text-right font-semibold">Market move</th>
                <th className="px-5 py-2.5 text-right font-semibold">Total P/L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {[...activity].reverse().map((point) => (
                <ActivityTableRow
                  key={point.snapshot.snapshotDate}
                  point={point}
                  isAmountsVisible={isAmountsVisible}
                />
              ))}
              {!activity.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-text-secondary" colSpan={6}>
                    No activity in this period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MarketMoveRow({
  label,
  move,
  isAmountsVisible,
}: {
  label: string;
  move: PortfolioActivityPoint | null;
  isAmountsVisible: boolean;
}) {
  const change = move?.marketChangeAed ?? null;
  const returnPercent = move?.marketReturnPercent ?? null;

  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div>
        <div className="text-sm font-medium text-text-primary">{label}</div>
        <div className="mt-1 text-xs text-text-muted">
          {move ? formatDate(move.snapshot.snapshotDate) : "Not enough history"}
        </div>
      </div>
      <div className={`text-right font-mono text-sm font-semibold ${valueTone(change)}`}>
        {returnPercent !== null ? formatSignedPercent(returnPercent) : "—"}
        <div className="mt-1 text-xs font-normal">
          {change !== null ? formatSignedMoney(change, isAmountsVisible) : ""}
        </div>
      </div>
    </div>
  );
}

function ContributorList({
  label,
  holdings,
  isAmountsVisible,
  className = "",
}: {
  label: string;
  holdings: ComputedHolding[];
  isAmountsVisible: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs font-medium text-text-muted">{label}</div>
      <div className="mt-2 divide-y divide-border-default">
        {holdings.map((holding) => (
          <div key={holding.id} className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-text-primary">{holding.assetName}</div>
              <div className="mt-0.5 text-[11px] text-text-muted">{holding.ticker || holding.assetClass}</div>
            </div>
            <div className={`shrink-0 text-right font-mono text-xs font-semibold ${valueTone(holding.gainLossAed)}`}>
              {formatSignedMoney(holding.gainLossAed, isAmountsVisible)}
              <div className="mt-0.5 font-normal">{formatSignedPercent(holding.gainLossPct)}</div>
            </div>
          </div>
        ))}
        {!holdings.length ? (
          <div className="py-3 text-sm text-text-muted">None</div>
        ) : null}
      </div>
    </div>
  );
}

function ActivityTableRow({
  point,
  isAmountsVisible,
}: {
  point: PortfolioActivityPoint;
  isAmountsVisible: boolean;
}) {
  const { snapshot, investedChangeAed, marketChangeAed } = point;

  return (
    <tr className="text-text-secondary">
      <td className="whitespace-nowrap px-5 py-2.5 font-medium text-text-primary">
        {formatDate(snapshot.snapshotDate)}
      </td>
      <td className="whitespace-nowrap px-5 py-2.5 text-right font-mono">
        {formatOrMask(snapshot.totalValueAed, "AED", isAmountsVisible)}
      </td>
      <td className="whitespace-nowrap px-5 py-2.5 text-right font-mono">
        {formatOrMask(snapshot.totalInvestedAed, "AED", isAmountsVisible)}
      </td>
      <td className="whitespace-nowrap px-5 py-2.5 text-right font-mono text-text-primary">
        {investedChangeAed === null || investedChangeAed === 0
          ? "—"
          : formatSignedMoney(investedChangeAed, isAmountsVisible)}
      </td>
      <td className={`whitespace-nowrap px-5 py-2.5 text-right font-mono ${valueTone(marketChangeAed)}`}>
        {marketChangeAed === null ? "—" : formatSignedMoney(marketChangeAed, isAmountsVisible)}
      </td>
      <td className={`whitespace-nowrap px-5 py-2.5 text-right font-mono ${valueTone(snapshot.totalGainLossAed)}`}>
        {formatSignedMoney(snapshot.totalGainLossAed, isAmountsVisible)}
      </td>
    </tr>
  );
}

function MobileActivityRow({
  point,
  isAmountsVisible,
}: {
  point: PortfolioActivityPoint;
  isAmountsVisible: boolean;
}) {
  const { snapshot, investedChangeAed, marketChangeAed } = point;

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="text-sm font-semibold text-text-primary">{formatDate(snapshot.snapshotDate)}</div>
        <div className={`text-right font-mono text-sm font-semibold ${valueTone(snapshot.totalGainLossAed)}`}>
          {formatSignedMoney(snapshot.totalGainLossAed, isAmountsVisible)}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <ActivityValue label="Value" value={formatOrMask(snapshot.totalValueAed, "AED", isAmountsVisible)} />
        <ActivityValue label="Invested" value={formatOrMask(snapshot.totalInvestedAed, "AED", isAmountsVisible)} />
        <ActivityValue
          label="Capital flow"
          value={
            investedChangeAed === null || investedChangeAed === 0
              ? "—"
              : formatSignedMoney(investedChangeAed, isAmountsVisible)
          }
        />
        <ActivityValue
          label="Market move"
          value={marketChangeAed === null ? "—" : formatSignedMoney(marketChangeAed, isAmountsVisible)}
          tone={valueTone(marketChangeAed)}
        />
      </div>
    </div>
  );
}

function ActivityValue({
  label,
  value,
  tone = "text-text-primary",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <div className="text-text-muted">{label}</div>
      <div className={`mt-1 font-mono font-semibold ${tone}`}>{value}</div>
    </div>
  );
}
