"use client";

import { useMemo, useState } from "react";
import { ALLOCATION_CLASS_OPTIONS, ASSET_CLASS_OPTIONS, CURRENCY_OPTIONS, GEOGRAPHY_OPTIONS, PLATFORM_OPTIONS, RISK_OPTIONS, type Currency, type Holding } from "@/lib/constants";
import { tap, success as hapticSuccess } from "@/lib/haptics";
import { computeHolding, formatMoney, toNumber } from "@/lib/utils";

interface Props {
  holding: Holding | null;
  inrToAedRate: number;
  onSave: (holding: Holding) => void;
  onClose: () => void;
}

const emptyForm: Holding = {
  id: "",
  platform: "Groww",
  assetName: "",
  ticker: "",
  assetClass: "Stocks",
  allocationClass: "Stocks",
  sector: "",
  geography: "India",
  risk: "Medium",
  quantity: 0,
  avgBuyPrice: 0,
  currentPrice: 0,
  currency: "INR",
  notes: "",
  priceSource: "manual",
};

export default function HoldingModal({ holding, inrToAedRate, onSave, onClose }: Props) {
  const [form, setForm] = useState<Holding>(() => {
    if (holding) {
      if (!holding.purchases && holding.quantity > 0) {
        return {
          ...holding,
          purchases: [{ quantity: holding.quantity, price: holding.avgBuyPrice, date: new Date().toISOString().split("T")[0] }],
        };
      }
      return { ...holding, purchases: holding.purchases || [] };
    }
    return { ...emptyForm, purchases: [] };
  });
  const [expandedPurchaseIndex, setExpandedPurchaseIndex] = useState<number | null>(0);
  const [showAllocationGroup, setShowAllocationGroup] = useState(
    () => Boolean(holding?.allocationClass && holding.allocationClass !== holding.assetClass)
  );
  const preview = useMemo(() => computeHolding(form, inrToAedRate), [form, inrToAedRate]);

  const showsTickerField = form.assetClass !== "Mutual Funds" && form.assetClass !== "Cash";
  const showsSchemeCodeField = form.assetClass === "Mutual Funds";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.assetName.trim()) return;
    hapticSuccess();
    onSave(form);
  };

  const update = (patch: Partial<Holding>) => setForm((current) => ({ ...current, ...patch }));

  const updatePurchases = (newPurchases: NonNullable<Holding["purchases"]>) => {
    let newQty = 0;
    let totalInvested = 0;
    for (const p of newPurchases) {
      const q = toNumber(p.quantity) || 0;
      const pr = toNumber(p.price) || 0;
      newQty += q;
      totalInvested += q * pr;
    }
    const newAvgPrice = newQty > 0 ? totalInvested / newQty : 0;
    update({ purchases: newPurchases, quantity: newQty, avgBuyPrice: newAvgPrice });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" />
      <div
        className="relative my-6 w-full max-w-5xl rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200 sm:max-h-[90vh] sm:overflow-y-auto sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{holding ? "Edit Holding" : "Add Holding"}</h2>
              <p className="mt-1 text-sm text-slate-500">
                Portfolio values are normalised to AED. USD uses the AED peg and INR uses the global INR to AED rate from the top of the page.
              </p>
            </div>

            <div className="grid gap-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 xl:min-w-[300px]">
              <PreviewRow label="Invested" value={formatMoney(preview.investedAmount, form.currency || "AED")} />
              <PreviewRow label="Current Value" value={formatMoney(preview.currentValue, form.currency || "AED")} />
              <PreviewRow label="AED Rate Used" value={preview.rateToAed.toFixed(4)} />
              <PreviewRow label="Current Value in AED" value={formatMoney(preview.currentValueAed, "AED")} />
              <PreviewRow label="Local Return" value={`${formatMoney(preview.gainLoss, form.currency || "AED")} (${preview.localGainLossPct.toFixed(2)}%)`} />
              <PreviewRow label="Investor Return (AED)" value={`${formatMoney(preview.gainLossAed, "AED")} (${preview.gainLossPct.toFixed(2)}%)`} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormSelect label="Platform" value={form.platform} options={PLATFORM_OPTIONS} onChange={(value) => update({ platform: value })} />
            <FormInput label="Asset Name" value={form.assetName} onChange={(value) => update({ assetName: value })} placeholder="Apple, Bitcoin, Nifty ETF" required />
            {showsTickerField ? (
              <FormInput label="Ticker" value={form.ticker} onChange={(value) => update({ ticker: value })} placeholder="AAPL, BTC" />
            ) : null}
            <FormSelect
              label="Instrument Type"
              value={form.assetClass}
              options={ASSET_CLASS_OPTIONS}
              onChange={(value) =>
                setForm((current) => {
                  const nextAssetClass = value as Holding["assetClass"];
                  const shouldSyncAllocationClass = !current.allocationClass || current.allocationClass === current.assetClass;
                  const nextShowsTickerField = nextAssetClass !== "Mutual Funds" && nextAssetClass !== "Cash";
                  const nextShowsSchemeCodeField = nextAssetClass === "Mutual Funds";

                  return {
                    ...current,
                    assetClass: nextAssetClass,
                    allocationClass: shouldSyncAllocationClass ? nextAssetClass : current.allocationClass,
                    ticker: nextShowsTickerField ? current.ticker : "",
                    schemeCode: nextShowsSchemeCodeField ? current.schemeCode : undefined,
                  };
                })
              }
            />
            <div className="text-sm">
              {!showAllocationGroup ? (
                <button
                  type="button"
                  onClick={() => setShowAllocationGroup(true)}
                  className="mt-1 text-sm font-medium text-slate-600 underline-offset-2 transition hover:text-slate-900 hover:underline"
                >
                  Customize allocation group
                </button>
              ) : (
                <FormSelect
                  label="Allocation Group"
                  value={form.allocationClass || form.assetClass}
                  options={ALLOCATION_CLASS_OPTIONS}
                  onChange={(value) => update({ allocationClass: value as Holding["allocationClass"] })}
                />
              )}
            </div>
            <FormInput label="Sector / Theme" value={form.sector} onChange={(value) => update({ sector: value })} placeholder="Technology, Banking" />
            <FormSelect label="Geography" value={form.geography} options={GEOGRAPHY_OPTIONS} onChange={(value) => update({ geography: value as Holding["geography"] })} />
            <FormSelect label="Risk" value={form.risk} options={RISK_OPTIONS} onChange={(value) => update({ risk: value as Holding["risk"] })} />
            <FormNumber label="Current Market Price" value={form.currentPrice} onChange={(value) => update({ currentPrice: value })} />
            <FormSelect label="Currency" value={form.currency} options={CURRENCY_OPTIONS} onChange={(value) => update({ currency: value as Currency })} />
            {showsSchemeCodeField ? (
              <FormInput label="Scheme Code" value={form.schemeCode || ""} onChange={(value) => update({ schemeCode: value })} placeholder="AMFI code" />
            ) : null}
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Notes</span>
            <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2" rows={3} value={form.notes} onChange={(event) => update({ notes: event.target.value })} placeholder="Optional notes" />
          </label>

          {/* Purchase History Editor */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Purchase History</h3>
              <button
                type="button"
                onClick={() => {
                  updatePurchases([...(form.purchases || []), {
                    quantity: 0,
                    price: 0,
                    date: new Date().toISOString().split("T")[0],
                    ...(form.currency === "INR" ? { fxRate: Number(inrToAedRate.toFixed(4)) } : {}),
                  }]);
                  setExpandedPurchaseIndex((form.purchases || []).length);
                }}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                + Add Purchase
              </button>
            </div>

            <div className="space-y-3 sm:hidden">
              {(form.purchases || []).map((purchase, index) => {
                const quantity = toNumber(purchase.quantity);
                const price = toNumber(purchase.price);
                const invested = quantity * price;

                return (
                  <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <button
                      type="button"
                      onClick={() => setExpandedPurchaseIndex((current) => (current === index ? null : index))}
                      className="flex w-full items-center justify-between gap-3 text-left"
                      aria-expanded={expandedPurchaseIndex === index}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Purchase {index + 1}
                        </div>
                        <div className="mt-1 text-sm font-medium text-slate-900">{purchase.date || "No date"}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Qty {quantity < 1 ? quantity.toFixed(7) : quantity.toLocaleString()} • {formatMoney(price, form.currency)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Invested</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">{formatMoney(invested, form.currency)}</div>
                        </div>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                          <svg className={`h-4 w-4 transition-transform ${expandedPurchaseIndex === index ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </button>

                    {expandedPurchaseIndex === index ? (
                      <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const newPurchases = [...(form.purchases || [])];
                              newPurchases.splice(index, 1);
                              updatePurchases(newPurchases);
                              setExpandedPurchaseIndex((current) => {
                                if (current === index) return null;
                                if (current !== null && current > index) return current - 1;
                                return current;
                              });
                            }}
                            className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500 hover:text-red-500"
                            title="Remove purchase"
                            aria-label={`Remove purchase ${index + 1}`}
                          >
                            Remove
                          </button>
                        </div>

                        <label className="text-sm">
                          <span className="mb-1 block text-slate-600">Date</span>
                          <input
                            type="date"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                            value={purchase.date}
                            onChange={(e) => {
                              const newPurchases = [...(form.purchases || [])];
                              newPurchases[index] = { ...purchase, date: e.target.value };
                              updatePurchases(newPurchases);
                            }}
                            required
                          />
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-sm">
                            <span className="mb-1 block text-slate-600">Qty</span>
                            <input
                              type="number"
                              step="any"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                              placeholder="Qty"
                              value={purchase.quantity || ""}
                              onChange={(e) => {
                                const newPurchases = [...(form.purchases || [])];
                                newPurchases[index] = { ...purchase, quantity: toNumber(e.target.value) };
                                updatePurchases(newPurchases);
                              }}
                              required
                            />
                          </label>

                          <label className="text-sm">
                            <span className="mb-1 block text-slate-600">Price</span>
                            <input
                              type="number"
                              step="any"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                              placeholder="Price"
                              value={purchase.price || ""}
                              onChange={(e) => {
                                const newPurchases = [...(form.purchases || [])];
                                newPurchases[index] = { ...purchase, price: toNumber(e.target.value) };
                                updatePurchases(newPurchases);
                              }}
                              required
                            />
                          </label>
                        </div>

                        {form.currency === "INR" ? (
                          <label className="text-sm">
                            <span className="mb-1 block text-slate-600">FX Rate</span>
                            <input
                              type="number"
                              step="any"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                              placeholder="FX Rate"
                              value={purchase.fxRate || ""}
                              onChange={(e) => {
                                const newPurchases = [...(form.purchases || [])];
                                newPurchases[index] = { ...purchase, fxRate: toNumber(e.target.value) };
                                updatePurchases(newPurchases);
                              }}
                              title="INR to AED rate at time of purchase"
                            />
                          </label>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {(!form.purchases || form.purchases.length === 0) && (
                <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500">
                  No purchases recorded. Tap `+ Add Purchase` to start tracking.
                </p>
              )}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="min-w-full border-collapse border border-slate-200 text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="border-b border-slate-200 px-3 py-2 text-left">Date</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-left">Qty</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-left">Price</th>
                    {form.currency === "INR" && <th className="border-b border-slate-200 px-3 py-2 text-left">FX Rate</th>}
                    <th className="border-b border-slate-200 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(form.purchases || []).map((purchase, index) => (
                    <tr key={index} className="bg-white">
                      <td className="border-b border-slate-200 px-3 py-2">
                        <input
                          type="date"
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                          value={purchase.date}
                          onChange={(e) => {
                            const newPurchases = [...(form.purchases || [])];
                            newPurchases[index] = { ...purchase, date: e.target.value };
                            updatePurchases(newPurchases);
                          }}
                          required
                        />
                      </td>
                      <td className="border-b border-slate-200 px-3 py-2">
                        <input
                          type="number"
                          step="any"
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                          placeholder="Qty"
                          value={purchase.quantity || ""}
                          onChange={(e) => {
                            const newPurchases = [...(form.purchases || [])];
                            newPurchases[index] = { ...purchase, quantity: toNumber(e.target.value) };
                            updatePurchases(newPurchases);
                          }}
                          required
                        />
                      </td>
                      <td className="border-b border-slate-200 px-3 py-2">
                        <input
                          type="number"
                          step="any"
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                          placeholder="Price"
                          value={purchase.price || ""}
                          onChange={(e) => {
                            const newPurchases = [...(form.purchases || [])];
                            newPurchases[index] = { ...purchase, price: toNumber(e.target.value) };
                            updatePurchases(newPurchases);
                          }}
                          required
                        />
                      </td>
                      {form.currency === "INR" && (
                        <td className="border-b border-slate-200 px-3 py-2">
                          <input
                            type="number"
                            step="any"
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                            placeholder="FX Rate"
                            value={purchase.fxRate || ""}
                            onChange={(e) => {
                              const newPurchases = [...(form.purchases || [])];
                              newPurchases[index] = { ...purchase, fxRate: toNumber(e.target.value) };
                              updatePurchases(newPurchases);
                            }}
                            title="INR to AED rate at time of purchase"
                          />
                        </td>
                      )}
                      <td className="border-b border-slate-200 px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            const newPurchases = [...(form.purchases || [])];
                            newPurchases.splice(index, 1);
                            updatePurchases(newPurchases);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-red-500"
                          title="Remove purchase"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!form.purchases || form.purchases.length === 0) && (
                <p className="mt-3 text-xs text-slate-500 text-center">No purchases recorded. Click &apos;+ Add Purchase&apos; to start tracking.</p>
              )}
            </div>
            
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-center ring-1 ring-slate-200">
                <div className="text-xs text-slate-500">Total Qty</div>
                <div className="font-semibold text-slate-900">{form.quantity < 1 ? form.quantity.toFixed(7) : form.quantity.toLocaleString()}</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-center ring-1 ring-slate-200">
                <div className="text-xs text-slate-500">Avg Price</div>
                <div className="font-semibold text-slate-900">{formatMoney(form.avgBuyPrice, form.currency)}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => { tap(); onClose(); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
              Cancel
            </button>
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              {holding ? "Update Holding" : "Add Holding"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <input className="w-full rounded-xl border border-slate-200 px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} />
    </label>
  );
}

function FormSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <select className="w-full rounded-xl border border-slate-200 px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <input type="number" step="any" className="w-full rounded-xl border border-slate-200 px-3 py-2" value={value || ""} onChange={(event) => onChange(toNumber(event.target.value))} placeholder="0" />
    </label>
  );
}
