"use client";

import { useMemo, useState } from "react";
import PortfolioTrendChart from "@/components/PortfolioTrendChart";
import type { ComputedHolding } from "@/lib/constants";
import {
  filterSnapshotsByRange,
  getHistorySummary,
  getTopHoldingContributors,
  HISTORY_RANGES,
  type HistoryRange,
} from "@/lib/portfolio-analytics";
import type { PortfolioSnapshot } from "@/lib/portfolio-snapshots";
import { formatMoney, formatOrMask } from "@/lib/utils";

interface DashboardHistoryContentProps {
  holdings: ComputedHolding[];
  snapshots: PortfolioSnapshot[];
  isAmountsVisible: boolean;
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

function MetricCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-accent-gain"
      : tone === "negative"
        ? "text-accent-loss"
        : "text-text-primary";

  return (
    <div className="dashboard-card rounded-2xl border border-border-default bg-bg-card p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">{label}</div>
      <div className={`mt-3 text-xl font-semibold leading-tight sm:text-2xl ${toneClass}`}>{value}</div>
      <div className="mt-2 text-sm text-text-secondary">{detail}</div>
    </div>
  );
}

export default function DashboardHistoryContent({
  holdings,
  snapshots,
  isAmountsVisible,
}: DashboardHistoryContentProps) {
  const [selectedRange, setSelectedRange] = useState<HistoryRange>("1M");

  const filteredSnapshots = useMemo(
    () => filterSnapshotsByRange(snapshots, selectedRange),
    [selectedRange, snapshots]
  );

  const historySummary = useMemo(() => getHistorySummary(filteredSnapshots), [filteredSnapshots]);
  const contributors = useMemo(() => getTopHoldingContributors(holdings), [holdings]);
  const trendChartData = useMemo(
    () =>
      filteredSnapshots.map((snapshot) => ({
        date: snapshot.snapshotDate,
        invested: snapshot.totalInvestedAed,
        value: snapshot.totalValueAed,
      })),
    [filteredSnapshots]
  );

  const rangeTone = historySummary.rangeChangeAed >= 0 ? "positive" : "negative";
  const bestMove = historySummary.bestDailyMove;
  const worstMove = historySummary.worstDailyMove;
  const bestContributor = contributors.best;
  const worstContributor = contributors.worst;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.04em] text-text-primary">
            Performance History
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Snapshot-based portfolio returns, drawdowns, and contribution signals.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 rounded-full border border-border-default bg-bg-card p-1">
          {HISTORY_RANGES.map((range) => (
            <button
              key={range.label}
              type="button"
              onClick={() => setSelectedRange(range.label)}
              title={range.name}
              className={`min-h-8 rounded-full px-3 text-xs font-semibold transition ${
                selectedRange === range.label
                  ? "bg-accent-violet text-bg-primary"
                  : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Range Return"
          value={formatSignedPercent(historySummary.rangeReturnPercent)}
          detail={formatSignedMoney(historySummary.rangeChangeAed, isAmountsVisible)}
          tone={rangeTone}
        />
        <MetricCard
          label="Max Drawdown"
          value={formatSignedPercent(historySummary.maxDrawdownPercent)}
          detail="Peak-to-trough portfolio value"
          tone={historySummary.maxDrawdownPercent < 0 ? "negative" : "default"}
        />
        <MetricCard
          label="Net Contributions"
          value={formatSignedMoney(historySummary.investedChangeAed, isAmountsVisible)}
          detail="Change in invested amount"
          tone={historySummary.investedChangeAed >= 0 ? "default" : "negative"}
        />
        <MetricCard
          label="Snapshots"
          value={String(filteredSnapshots.length)}
          detail={
            historySummary.first && historySummary.latest
              ? `${formatDate(historySummary.first.snapshotDate)} to ${formatDate(historySummary.latest.snapshotDate)}`
              : "No history yet"
          }
        />
      </div>

      <PortfolioTrendChart chartData={trendChartData} isAmountsVisible={isAmountsVisible} />

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="dashboard-card rounded-2xl border border-border-default bg-bg-card p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold tracking-[-0.03em] text-text-primary">Daily Movement</h2>
          <div className="mt-5 space-y-4">
            <MoveRow label="Best day" move={bestMove} isAmountsVisible={isAmountsVisible} positive />
            <MoveRow label="Worst day" move={worstMove} isAmountsVisible={isAmountsVisible} />
          </div>
        </section>

        <section className="dashboard-card rounded-2xl border border-border-default bg-bg-card p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold tracking-[-0.03em] text-text-primary">Current Contributors</h2>
          <div className="mt-5 space-y-4">
            <HoldingContributor label="Top contributor" holding={bestContributor} isAmountsVisible={isAmountsVisible} />
            <HoldingContributor label="Largest drag" holding={worstContributor} isAmountsVisible={isAmountsVisible} />
          </div>
        </section>

        <section className="dashboard-card rounded-2xl border border-border-default bg-bg-card p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold tracking-[-0.03em] text-text-primary">Latest Snapshot</h2>
          {historySummary.latest ? (
            <div className="mt-5 space-y-3 text-sm">
              <SnapshotFact label="Date" value={formatDate(historySummary.latest.snapshotDate)} />
              <SnapshotFact label="Portfolio value" value={formatOrMask(historySummary.latest.totalValueAed, "AED", isAmountsVisible)} />
              <SnapshotFact label="Invested amount" value={formatOrMask(historySummary.latest.totalInvestedAed, "AED", isAmountsVisible)} />
              <SnapshotFact label="Holdings" value={String(historySummary.latest.holdingsCount)} />
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-bg-elevated px-4 py-6 text-sm text-text-secondary">
              No snapshots have been recorded yet.
            </div>
          )}
        </section>
      </div>

      <section className="dashboard-card overflow-hidden rounded-2xl border border-border-default bg-bg-card shadow-sm">
        <div className="border-b border-border-default px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-[-0.03em] text-text-primary">Snapshot Ledger</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-bg-elevated text-xs uppercase tracking-[0.12em] text-text-muted">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Date</th>
                <th className="px-5 py-3 text-right font-semibold">Value</th>
                <th className="px-5 py-3 text-right font-semibold">Invested</th>
                <th className="px-5 py-3 text-right font-semibold">Gain / Loss</th>
                <th className="px-5 py-3 text-right font-semibold">Holdings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {[...filteredSnapshots].reverse().map((snapshot) => (
                <tr key={snapshot.snapshotDate} className="text-text-secondary">
                  <td className="whitespace-nowrap px-5 py-3 font-medium text-text-primary">{formatDate(snapshot.snapshotDate)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right font-mono">{formatOrMask(snapshot.totalValueAed, "AED", isAmountsVisible)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right font-mono">{formatOrMask(snapshot.totalInvestedAed, "AED", isAmountsVisible)}</td>
                  <td className={`whitespace-nowrap px-5 py-3 text-right font-mono ${snapshot.totalGainLossAed >= 0 ? "text-accent-gain" : "text-accent-loss"}`}>
                    {formatSignedMoney(snapshot.totalGainLossAed, isAmountsVisible)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">{snapshot.holdingsCount}</td>
                </tr>
              ))}
              {!filteredSnapshots.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-text-secondary" colSpan={5}>
                    No snapshots in this range.
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

function MoveRow({
  label,
  move,
  isAmountsVisible,
  positive = false,
}: {
  label: string;
  move: { snapshotDate: string; changeAed: number; changePercent: number } | null;
  isAmountsVisible: boolean;
  positive?: boolean;
}) {
  const toneClass = positive ? "text-accent-gain" : "text-accent-loss";

  return (
    <div className="rounded-xl border border-border-default bg-bg-elevated px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">{label}</div>
          <div className="mt-1 text-sm text-text-secondary">{move ? formatDate(move.snapshotDate) : "Not enough data"}</div>
        </div>
        <div className={`text-right font-mono text-sm font-semibold ${move ? toneClass : "text-text-muted"}`}>
          {move ? formatSignedPercent(move.changePercent) : "-"}
          <div className="mt-1 text-xs font-normal">{move ? formatSignedMoney(move.changeAed, isAmountsVisible) : ""}</div>
        </div>
      </div>
    </div>
  );
}

function HoldingContributor({
  label,
  holding,
  isAmountsVisible,
}: {
  label: string;
  holding: ComputedHolding | null;
  isAmountsVisible: boolean;
}) {
  const toneClass = holding && holding.gainLossAed >= 0 ? "text-accent-gain" : "text-accent-loss";

  return (
    <div className="rounded-xl border border-border-default bg-bg-elevated px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">{label}</div>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text-primary">{holding?.assetName ?? "No holdings"}</div>
          <div className="mt-1 text-xs text-text-secondary">{holding?.ticker || holding?.assetClass || ""}</div>
        </div>
        <div className={`shrink-0 text-right font-mono text-sm font-semibold ${holding ? toneClass : "text-text-muted"}`}>
          {holding ? formatSignedMoney(holding.gainLossAed, isAmountsVisible) : "-"}
          <div className="mt-1 text-xs font-normal">{holding ? formatSignedPercent(holding.gainLossPct) : ""}</div>
        </div>
      </div>
    </div>
  );
}

function SnapshotFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border-default bg-bg-elevated px-4 py-3">
      <span className="text-text-secondary">{label}</span>
      <span className="text-right font-mono font-semibold text-text-primary">{value}</span>
    </div>
  );
}
