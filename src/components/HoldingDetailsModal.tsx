"use client";

import { useMemo } from "react";
import type { Holding } from "@/lib/constants";
import { computeHolding, formatMoney, timeAgo, toNumber } from "@/lib/utils";

interface Props {
  holding: Holding | null;
  inrToAedRate: number;
  onClose: () => void;
}

export default function HoldingDetailsModal({ holding, inrToAedRate, onClose }: Props) {
  const computed = useMemo(() => (holding ? computeHolding(holding, inrToAedRate) : null), [holding, inrToAedRate]);

  if (!holding || !computed) {
    return null;
  }

  const purchases = [...(holding.purchases || [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-sm" />
      <div
        className="relative my-6 w-full max-w-5xl rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200 sm:max-h-[90vh] sm:overflow-y-auto sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Holding Details</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{holding.assetName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {holding.ticker ? <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-slate-700">{holding.ticker}</span> : null}
              <span>{holding.assetClass}</span>
              <span>{holding.geography}</span>
              <span>{holding.platform}</span>
              <span>Risk {holding.risk}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px,minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="grid gap-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <PreviewRow label="Invested" value={formatMoney(computed.investedAmount, holding.currency)} />
              <PreviewRow label="Current Value" value={formatMoney(computed.currentValue, holding.currency)} />
              <PreviewRow label="AED Rate Used" value={computed.rateToAed.toFixed(4)} />
              <PreviewRow label="Current Value in AED" value={formatMoney(computed.currentValueAed, "AED")} />
              <PreviewRow label="Local Return" value={`${formatMoney(computed.gainLoss, holding.currency)} (${computed.localGainLossPct.toFixed(2)}%)`} />
              <PreviewRow label="Investor Return (AED)" value={`${formatMoney(computed.gainLossAed, "AED")} (${computed.gainLossPct.toFixed(2)}%)`} />
            </div>
          </div>

          <div className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Quantity" value={holding.quantity < 1 ? holding.quantity.toFixed(7) : holding.quantity.toLocaleString()} />
              <StatCard title="Avg Buy Price" value={formatMoney(holding.avgBuyPrice, holding.currency)} />
              <StatCard title="Current Price" value={formatMoney(holding.currentPrice, holding.currency)} />
              <StatCard title="Last Price Update" value={timeAgo(holding.lastPriceUpdate)} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Asset Info</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoRow label="Platform" value={holding.platform} />
                <InfoRow label="Currency" value={holding.currency} />
                <InfoRow label="Asset Class" value={holding.assetClass} />
                <InfoRow label="Geography" value={holding.geography} />
                <InfoRow label="Sector / Theme" value={holding.sector || "Not added"} />
                <InfoRow label="Price Source" value={holding.priceSource} />
                <InfoRow label="Scheme Code" value={holding.schemeCode || "Not added"} />
                <InfoRow label="Ticker" value={holding.ticker || "Not added"} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Notes</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {holding.notes.trim() || "No notes added for this holding."}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">Purchase History</h3>
                <span className="text-xs text-slate-500">{purchases.length} entries</span>
              </div>

              {purchases.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Qty</th>
                        <th className="px-3 py-2">Price</th>
                        {holding.currency === "INR" ? <th className="px-3 py-2">FX Rate</th> : null}
                        <th className="px-3 py-2 text-right">Invested</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.map((purchase, index) => {
                        const quantity = toNumber(purchase.quantity);
                        const price = toNumber(purchase.price);
                        return (
                          <tr key={`${purchase.date}-${index}`} className="border-b border-slate-100 last:border-b-0">
                            <td className="px-3 py-3 text-slate-700">{purchase.date}</td>
                            <td className="px-3 py-3 font-mono text-slate-700">
                              {quantity < 1 ? quantity.toFixed(7) : quantity.toLocaleString()}
                            </td>
                            <td className="px-3 py-3 font-mono text-slate-700">{formatMoney(price, holding.currency)}</td>
                            {holding.currency === "INR" ? (
                              <td className="px-3 py-3 font-mono text-slate-500">
                                {purchase.fxRate ? toNumber(purchase.fxRate).toFixed(4) : "-"}
                              </td>
                            ) : null}
                            <td className="px-3 py-3 text-right font-mono text-slate-900">
                              {formatMoney(quantity * price, holding.currency)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No purchase history recorded for this holding.</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
      <div className="text-xs uppercase tracking-wider text-slate-500">{title}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}
