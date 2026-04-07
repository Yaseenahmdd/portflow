"use client";

import { useMemo, useState } from "react";
import { ASSET_CLASS_OPTIONS, CURRENCY_OPTIONS, GEOGRAPHY_OPTIONS, PLATFORM_OPTIONS, RISK_OPTIONS, type Currency, type Holding } from "@/lib/constants";
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
  const [form, setForm] = useState<Holding>(holding || emptyForm);
  const preview = useMemo(() => computeHolding(form, inrToAedRate), [form, inrToAedRate]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.assetName.trim()) return;
    onSave(form);
  };

  const update = (patch: Partial<Holding>) => setForm((current) => ({ ...current, ...patch }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" />
      <div className="w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200" onClick={(event) => event.stopPropagation()}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{holding ? "Edit Holding" : "Add Holding"}</h2>
              <p className="mt-1 text-sm text-slate-500">
                Portfolio values are normalised to AED. USD uses the AED peg and INR uses the global INR to AED rate from the top of the page.
              </p>
            </div>

            <div className="grid min-w-[300px] gap-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <PreviewRow label="Invested" value={formatMoney(preview.investedAmount, form.currency || "AED")} />
              <PreviewRow label="Current Value" value={formatMoney(preview.currentValue, form.currency || "AED")} />
              <PreviewRow label="AED Rate Used" value={preview.rateToAed.toFixed(4)} />
              <PreviewRow label="Current Value in AED" value={formatMoney(preview.currentValueAed, "AED")} />
              <PreviewRow label="Unrealised P/L in AED" value={`${formatMoney(preview.gainLossAed, "AED")} (${preview.gainLossPct.toFixed(2)}%)`} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormSelect label="Platform" value={form.platform} options={PLATFORM_OPTIONS} onChange={(value) => update({ platform: value })} />
            <FormInput label="Asset Name" value={form.assetName} onChange={(value) => update({ assetName: value })} placeholder="Apple, Bitcoin, Nifty ETF" required />
            <FormInput label="Ticker" value={form.ticker} onChange={(value) => update({ ticker: value })} placeholder="AAPL, BTC" />
            <FormSelect label="Asset Class" value={form.assetClass} options={ASSET_CLASS_OPTIONS} onChange={(value) => update({ assetClass: value as Holding["assetClass"] })} />
            <FormInput label="Sector / Theme" value={form.sector} onChange={(value) => update({ sector: value })} placeholder="Technology, Banking" />
            <FormSelect label="Geography" value={form.geography} options={GEOGRAPHY_OPTIONS} onChange={(value) => update({ geography: value as Holding["geography"] })} />
            <FormSelect label="Risk" value={form.risk} options={RISK_OPTIONS} onChange={(value) => update({ risk: value as Holding["risk"] })} />
            <FormNumber label="Quantity" value={form.quantity} onChange={(value) => update({ quantity: value })} />
            <FormNumber label="Average Buy Price" value={form.avgBuyPrice} onChange={(value) => update({ avgBuyPrice: value })} />
            <FormNumber label="Current Market Price" value={form.currentPrice} onChange={(value) => update({ currentPrice: value })} />
            <FormSelect label="Currency" value={form.currency} options={CURRENCY_OPTIONS} onChange={(value) => update({ currency: value as Currency })} />
            <FormInput label="Scheme Code" value={form.schemeCode || ""} onChange={(value) => update({ schemeCode: value })} placeholder="AMFI code" />
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Notes</span>
            <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2" rows={3} value={form.notes} onChange={(event) => update({ notes: event.target.value })} placeholder="Optional notes" />
          </label>

          <div className="grid gap-3 md:grid-cols-3">
            <AutoStat title="Auto Invested Amount" value={formatMoney(preview.investedAmount, form.currency || "AED")} sub={formatMoney(preview.investedAmountAed, "AED")} />
            <AutoStat title="Auto Current Value" value={formatMoney(preview.currentValue, form.currency || "AED")} sub={formatMoney(preview.currentValueAed, "AED")} />
            <AutoStat title="Auto Gain / Loss" value={`${formatMoney(preview.gainLoss, form.currency || "AED")} (${preview.gainLossPct.toFixed(2)}%)`} sub={formatMoney(preview.gainLossAed, "AED")} />
          </div>

          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
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

function AutoStat({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-slate-200">
      <div className="text-slate-500">{title}</div>
      <div className="mt-1 font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
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
