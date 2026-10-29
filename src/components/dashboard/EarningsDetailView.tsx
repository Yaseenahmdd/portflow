"use client";

import type { ReactNode } from "react";
import { ResultBreakdown, ResultTag } from "@/components/dashboard/EarningsResultSummary";
import { useDisplayCurrency } from "@/components/dashboard/DisplayCurrencyProvider";
import { useEarningsDetails } from "@/hooks/useHoldingsEarnings";
import type { AnalystView, EarningsDateStatus, EarningsResult, EpsEstimate } from "@/lib/api/nasdaq-earnings";
import {
  daysUntil,
  formatCompactAmount,
  formatDaysUntil,
  formatEarningsDate,
  formatEps,
  formatSignedPercent,
  getOutcome,
  surpriseToneClass,
  toneClass,
  type EarningsRow,
} from "@/lib/earnings";
import { buildEarningsInsights, getUpcomingEstimate, type InsightTone } from "@/lib/earnings-insights";
import { formatOrMask, timeAgo } from "@/lib/utils";

const TONE_DOT: Record<InsightTone, string> = {
  positive: "bg-accent-gain",
  negative: "bg-accent-loss",
  watch: "bg-accent-amber",
};

const STATUS_LABELS: Record<EarningsDateStatus, string> = {
  confirmed: "Confirmed",
  estimated: "Estimated",
  projected: "Projected",
};

const HEADLINES_SHOWN = 6;
const CHART_QUARTERS = 8;

function formatReportDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function EarningsDetailView({
  row,
  today,
  isAmountsVisible,
}: {
  row: EarningsRow;
  today: string;
  isAmountsVisible: boolean;
}) {
  const { displayCurrency, convertAed } = useDisplayCurrency();
  const { data, loading, error } = useEarningsDetails(row.symbol);
  const upcoming = row.summary?.upcoming ?? null;
  const history = row.summary?.history ?? [];
  const latest = history[0] ?? null;
  const names = [...new Set(row.holdings.map((holding) => holding.assetName))].join(" / ");
  const tickers = [...new Set(row.holdings.map((holding) => holding.ticker))];

  const estimate = data ? getUpcomingEstimate(row.summary, data.details) : null;
  const insights = data ? buildEarningsInsights(row.summary, data.details, data.price) : [];
  const nextEstimate =
    data?.details.quarterlyEstimates.find((item) => item.fiscalPeriod !== estimate?.fiscalPeriod) ?? null;
  const yearEstimate = data?.details.yearlyEstimates[0] ?? null;

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold tracking-[-0.03em] text-text-primary">{names}</h3>
          <div className="mt-0.5 font-mono text-[11px] text-text-muted">
            {tickers.join(" · ")}
            {tickers.length > 1 || tickers[0]?.toUpperCase() !== row.symbol ? ` → reports as ${row.symbol}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm text-text-primary">{formatOrMask(convertAed(row.valueAed), displayCurrency, isAmountsVisible)}</div>
          <div className="font-mono text-[11px] text-text-muted">{row.weightPercent.toFixed(1)}% of portfolio</div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Next report">
          {upcoming ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-base font-semibold text-text-primary">{formatEarningsDate(upcoming.date)}</span>
                <span className={`text-xs ${daysUntil(upcoming.date, today) <= 7 ? "font-semibold text-accent-violet" : "text-text-muted"}`}>
                  {formatDaysUntil(daysUntil(upcoming.date, today))}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                <ResultTag label={STATUS_LABELS[upcoming.status]} tone="neutral" />
                {upcoming.timing ? <span>{upcoming.timing === "pre-market" ? "Before open" : "After close"}</span> : null}
                {upcoming.fiscalQuarter ? <span>{upcoming.fiscalQuarter}</span> : null}
              </div>
              <dl className="grid grid-cols-2 gap-3 border-t border-border-subtle pt-3">
                <div>
                  <dt className="text-[11px] text-text-muted">EPS estimate</dt>
                  <dd className="font-mono text-sm text-text-primary">{formatEps(upcoming.consensusEps ?? estimate?.consensus)}</dd>
                  {upcoming.lastYearEps !== undefined ? (
                    <dd className="font-mono text-[11px] text-text-muted">yr ago {formatEps(upcoming.lastYearEps)}</dd>
                  ) : null}
                </div>
                <div>
                  <dt className="text-[11px] text-text-muted">Revenue estimate</dt>
                  <dd className="font-mono text-sm text-text-primary">{formatCompactAmount(upcoming.revenueEstimate)}</dd>
                  <dd className="text-[11px] text-text-muted">reporting currency</dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="text-sm text-text-muted">No report date yet.</p>
          )}
        </Panel>

        <Panel title={latest ? `Latest report · ${latest.fiscalQuarter} · ${formatReportDate(latest.reportedDate)}` : "Latest report"}>
          {latest ? (
            <div className="space-y-3">
              <ResultBreakdown result={latest} />
              {latest.priceReaction ? (
                <div className="flex items-baseline justify-between border-t border-border-subtle pt-3 text-xs">
                  <span className="text-text-secondary">Stock move after report</span>
                  <span className={`font-mono font-semibold ${toneClass(latest.priceReaction.changePercent)}`}>
                    {formatSignedPercent(latest.priceReaction.changePercent)}
                  </span>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-text-muted">No past reports on record.</p>
          )}
        </Panel>
      </div>

      <Section title="What to look for">
        {loading ? (
          <div className="skeleton h-24 rounded-lg" />
        ) : insights.length ? (
          <ul className="space-y-2.5">
            {insights.map((insight) => (
              <li key={insight.text} className="flex gap-2.5 text-sm leading-snug text-text-secondary">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[insight.tone]}`} aria-hidden="true" />
                <span>{insight.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">{error ? `Couldn't load details. ${error}` : "Not enough data for a checklist."}</p>
        )}
      </Section>

      {history.length ? (
        <Section title="Past quarters">
          <SurpriseChart history={history.slice(0, CHART_QUARTERS)} />
          <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[34rem] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.1em] text-text-muted">
                <tr className="border-b border-border-subtle">
                  <th className="py-2 pr-3 font-medium">Quarter</th>
                  <th className="py-2 pr-3 text-right font-medium">EPS / est.</th>
                  <th className="py-2 pr-3 text-right font-medium">EPS surprise</th>
                  <th className="py-2 pr-3 text-right font-medium">Rev surprise</th>
                  <th className="py-2 pr-3 font-medium">Guidance</th>
                  <th className="py-2 text-right font-medium">Stock</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {history.map((result) => (
                  <QuarterRow key={result.reportedDate} result={result} />
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {estimate || yearEstimate ? (
          <Section title="Estimates">
            <div className="divide-y divide-border-subtle">
              {estimate ? <EstimateLine label={`This quarter · ${estimate.fiscalPeriod}`} estimate={estimate} /> : null}
              {nextEstimate ? <EstimateLine label={`Next quarter · ${nextEstimate.fiscalPeriod}`} estimate={nextEstimate} /> : null}
              {yearEstimate ? <EstimateLine label={`Full year · ${yearEstimate.fiscalPeriod}`} estimate={yearEstimate} /> : null}
            </div>
          </Section>
        ) : null}

        {data?.details.analysts ? (
          <Section title="Analysts">
            <AnalystSummary view={data.details.analysts} price={data.price} />
          </Section>
        ) : null}
      </div>

      {data?.headlines.length ? (
        <Section title="Recent headlines">
          <ul className="space-y-2.5">
            {data.headlines.slice(0, HEADLINES_SHOWN).map((headline) => (
              <li key={headline.url}>
                <a
                  href={headline.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm leading-snug text-text-primary hover:text-accent-violet hover:underline"
                >
                  {headline.title}
                </a>
                {headline.publishedAt ? <span className="mt-0.5 block text-[11px] text-text-muted">{timeAgo(headline.publishedAt)}</span> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <p className="text-[11px] leading-relaxed text-text-muted">
        EPS and estimates from Nasdaq (Zacks); revenue estimates from Finnhub, in the company&apos;s reporting currency;
        guidance from headlines around each report and from how analysts moved full-year estimates. The checklist is
        generated from these numbers and isn&apos;t investment advice.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="ledger-kicker mb-3">{title}</h4>
      {children}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border-subtle bg-bg-secondary p-4">
      <h4 className="ledger-kicker mb-3">{title}</h4>
      {children}
    </section>
  );
}

function QuarterRow({ result }: { result: EarningsResult }) {
  const guidance = result.guidance?.direction;
  return (
    <tr className="border-b border-border-subtle last:border-0">
      <td className="py-2 pr-3 font-sans text-text-primary">
        {result.fiscalQuarter}
        <span className="ml-1.5 text-[10px] text-text-muted">{result.reportedDate.slice(5).replace("-", "/")}</span>
      </td>
      <td className="py-2 pr-3 text-right text-text-muted">
        <span className="text-text-primary">{formatEps(result.eps)}</span> / {formatEps(result.consensusEps)}
      </td>
      <td className={`py-2 pr-3 text-right ${surpriseToneClass(result.surprisePercent)}`}>{formatSignedPercent(result.surprisePercent)}</td>
      <td className={`py-2 pr-3 text-right ${surpriseToneClass(result.revenueSurprisePercent)}`}>
        {formatSignedPercent(result.revenueSurprisePercent)}
      </td>
      <td className={`py-2 pr-3 font-sans capitalize ${guidance === "raised" ? "text-accent-gain" : guidance === "lowered" ? "text-accent-loss" : "text-text-muted"}`}>
        {guidance ?? "—"}
        {result.spendingOutlook ? (
          <span className="ml-1.5 text-accent-amber" title={result.spendingOutlook.headline}>
            · spend {result.spendingOutlook.direction === "raised" ? "↑" : "↓"}
          </span>
        ) : null}
      </td>
      <td className={`py-2 text-right ${toneClass(result.priceReaction?.changePercent)}`}>
        {formatSignedPercent(result.priceReaction?.changePercent)}
      </td>
    </tr>
  );
}

/** EPS surprise per quarter as bars, oldest on the left; heights are capped so one outlier can't flatten the rest. */
function SurpriseChart({ history }: { history: EarningsResult[] }) {
  const quarters = [...history].reverse();
  const cap = 50;
  return (
    <div className="flex items-end gap-2" role="img" aria-label="EPS surprise by quarter">
      {quarters.map((result) => {
        const surprise = result.surprisePercent;
        const outcome = getOutcome(surprise);
        const height = surprise === null ? 4 : Math.max(4, (Math.min(Math.abs(surprise), cap) / cap) * 56);
        return (
          <div key={result.reportedDate} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${result.fiscalQuarter}: ${formatSignedPercent(surprise)}`}>
            <span className={`font-mono text-[10px] ${surpriseToneClass(surprise)}`}>{formatSignedPercent(surprise)}</span>
            <div className="flex h-14 w-full max-w-8 items-end">
              <div
                className={`w-full rounded-t-[3px] ${outcome === "beat" ? "bg-accent-gain" : outcome === "miss" ? "bg-accent-loss" : "bg-border-default"}`}
                style={{ height }}
              />
            </div>
            <span className="truncate text-[10px] text-text-muted">{result.fiscalQuarter.replace(" 20", " '")}</span>
          </div>
        );
      })}
    </div>
  );
}

function EstimateLine({ label, estimate }: { label: string; estimate: EpsEstimate }) {
  const up = estimate.revisionsUp ?? 0;
  const down = estimate.revisionsDown ?? 0;
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-xs text-text-secondary">{label}</div>
        <div className="mt-0.5 text-[11px] text-text-muted">
          {estimate.analysts ? `${estimate.analysts} analyst${estimate.analysts === 1 ? "" : "s"}` : "Analyst count n/a"}
          {up || down ? (
            <>
              {" · "}
              <span className={up > down ? "text-accent-gain" : down > up ? "text-accent-loss" : ""}>
                {up} up / {down} down
              </span>
              {" in 4 wks"}
            </>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 text-right font-mono">
        <div className="text-sm text-text-primary">{formatEps(estimate.consensus)}</div>
        {estimate.low !== null && estimate.high !== null && estimate.low !== estimate.high ? (
          <div className="mt-0.5 text-[11px] text-text-muted">
            {formatEps(estimate.low)} – {formatEps(estimate.high)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AnalystSummary({ view, price }: { view: AnalystView; price: number | null }) {
  const total = view.buy + view.hold + view.sell;
  const upside = price && view.targetMean !== null ? ((view.targetMean - price) / price) * 100 : null;
  return (
    <div className="space-y-3">
      {total > 0 ? (
        <div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-bg-elevated" aria-hidden="true">
            <span className="bg-accent-gain" style={{ width: `${(view.buy / total) * 100}%` }} />
            <span className="bg-text-muted/40" style={{ width: `${(view.hold / total) * 100}%` }} />
            <span className="bg-accent-loss" style={{ width: `${(view.sell / total) * 100}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-text-muted">
            <span>{view.buy} buy</span>
            <span>{view.hold} hold</span>
            <span>{view.sell} sell</span>
          </div>
        </div>
      ) : null}
      {view.targetMean !== null ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-text-secondary">Average price target</div>
            {view.targetLow !== null && view.targetHigh !== null ? (
              <div className="mt-0.5 font-mono text-[11px] text-text-muted">
                ${view.targetLow.toFixed(2)} – ${view.targetHigh.toFixed(2)}
              </div>
            ) : null}
          </div>
          <div className="text-right font-mono">
            <div className="text-sm text-text-primary">${view.targetMean.toFixed(2)}</div>
            {upside !== null ? (
              <div className={`mt-0.5 text-[11px] ${toneClass(upside)}`}>
                {formatSignedPercent(upside)} vs ${price!.toFixed(2)}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
