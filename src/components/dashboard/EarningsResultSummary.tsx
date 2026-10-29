"use client";

import type { EarningsResult, GuidanceDirection } from "@/lib/api/nasdaq-earnings";
import {
  formatCompactAmount,
  formatEps,
  formatSignedPercent,
  getOutcome,
  surpriseToneClass,
  toneClass,
  type ResultOutcome,
} from "@/lib/earnings";

const OUTCOME_LABEL: Record<ResultOutcome, string> = { beat: "Beat", miss: "Miss", inline: "In line" };
const GUIDANCE_LABEL: Record<GuidanceDirection, string> = { raised: "Raised", lowered: "Lowered", reaffirmed: "Reaffirmed" };

type TagTone = "positive" | "negative" | "neutral" | "warning";

function tagTone(kind: TagTone) {
  if (kind === "positive") return "border-accent-gain/40 text-accent-gain";
  if (kind === "negative") return "border-accent-loss/40 text-accent-loss";
  if (kind === "warning") return "border-accent-amber/40 text-accent-amber";
  return "border-border-default text-text-secondary";
}

function outcomeTone(outcome: ResultOutcome) {
  return outcome === "beat" ? "positive" : outcome === "miss" ? "negative" : "neutral";
}

function guidanceTone(direction: GuidanceDirection) {
  return direction === "raised" ? "positive" : direction === "lowered" ? "negative" : "neutral";
}

export function ResultTag({ label, tone }: { label: string; tone: TagTone }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.08em] ${tagTone(tone)}`}>
      {label}
    </span>
  );
}

/** The guidance outcome, falling back to how analysts moved full-year estimates after the report. */
function guidanceSummary(result: EarningsResult) {
  if (result.guidance) {
    return { label: GUIDANCE_LABEL[result.guidance.direction], tone: guidanceTone(result.guidance.direction) } as const;
  }
  const change = result.estimateChangePercent;
  if (change != null && Math.abs(change) >= 1) {
    return { label: change > 0 ? "Est. raised" : "Est. cut", tone: change > 0 ? "positive" : "negative" } as const;
  }
  return null;
}

/** EPS, revenue and guidance outcomes for one report, one line each. */
export function ResultBreakdown({ result }: { result: EarningsResult }) {
  const epsOutcome = getOutcome(result.surprisePercent);
  const revenueOutcome = getOutcome(result.revenueSurprisePercent);
  const guidance = guidanceSummary(result);
  const change = result.estimateChangePercent;

  return (
    <dl className="divide-y divide-border-subtle text-sm">
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3 py-2.5 first:pt-0">
        <dt className="text-xs text-text-secondary">EPS</dt>
        <dd className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {epsOutcome ? <ResultTag label={OUTCOME_LABEL[epsOutcome]} tone={outcomeTone(epsOutcome)} /> : null}
          <span className={`font-mono font-semibold ${surpriseToneClass(result.surprisePercent)}`}>{formatSignedPercent(result.surprisePercent)}</span>
          <span className="font-mono text-xs text-text-muted">
            {formatEps(result.eps)} vs {formatEps(result.consensusEps)} est
          </span>
        </dd>
      </div>
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3 py-2.5">
        <dt className="text-xs text-text-secondary">Revenue</dt>
        <dd className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {revenueOutcome ? (
            <>
              <ResultTag label={OUTCOME_LABEL[revenueOutcome]} tone={outcomeTone(revenueOutcome)} />
              <span className={`font-mono font-semibold ${surpriseToneClass(result.revenueSurprisePercent)}`}>
                {formatSignedPercent(result.revenueSurprisePercent)}
              </span>
              <span className="font-mono text-xs text-text-muted">
                {formatCompactAmount(result.revenueActual)} vs {formatCompactAmount(result.revenueEstimate)} est
              </span>
            </>
          ) : (
            <span className="text-xs text-text-muted">No revenue estimate for this report</span>
          )}
        </dd>
      </div>
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3 py-2.5 last:pb-0">
        <dt className="text-xs text-text-secondary">Guidance</dt>
        <dd className="min-w-0">
          {guidance ? (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <ResultTag label={guidance.label} tone={guidance.tone} />
              {change != null && Math.abs(change) >= 0.1 ? (
                <span className={`font-mono text-xs ${toneClass(change)}`}>FY EPS est. {formatSignedPercent(change)} since report</span>
              ) : null}
            </div>
          ) : (
            <span className="text-xs text-text-muted">No guidance change found</span>
          )}
          {result.guidance ? (
            <a
              href={result.guidance.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="mt-1 block truncate text-xs text-text-secondary hover:text-accent-violet hover:underline"
              title={result.guidance.headline}
            >
              “{result.guidance.headline}” ↗
            </a>
          ) : null}
        </dd>
      </div>
      {result.spendingOutlook ? (
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3 py-2.5 last:pb-0">
          <dt className="text-xs text-text-secondary">Spending</dt>
          <dd className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <ResultTag label={GUIDANCE_LABEL[result.spendingOutlook.direction]} tone="warning" />
              <span className="text-xs text-text-muted">Capex or cost outlook</span>
            </div>
            <a
              href={result.spendingOutlook.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="mt-1 block truncate text-xs text-text-secondary hover:text-accent-violet hover:underline"
              title={result.spendingOutlook.headline}
            >
              “{result.spendingOutlook.headline}” ↗
            </a>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

/** Compact EPS / Rev / Guide chips for list rows and cards. */
export function ResultChips({ result }: { result: EarningsResult | null }) {
  if (!result) return <span className="text-[11px] text-text-muted">No past reports</span>;
  const guidance = guidanceSummary(result);
  const chip = (label: string, value: string, tone: string) => (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <span className="text-text-muted">{label}</span>
      <span className={`font-mono font-semibold ${tone}`}>{value}</span>
    </span>
  );
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
      {chip("EPS", formatSignedPercent(result.surprisePercent), surpriseToneClass(result.surprisePercent))}
      {chip("Rev", formatSignedPercent(result.revenueSurprisePercent), surpriseToneClass(result.revenueSurprisePercent))}
      {chip(
        "Guide",
        guidance?.label ?? "—",
        guidance?.tone === "positive" ? "text-accent-gain" : guidance?.tone === "negative" ? "text-accent-loss" : "text-text-muted"
      )}
    </span>
  );
}
