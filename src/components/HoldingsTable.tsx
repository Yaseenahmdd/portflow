"use client";

import { useMemo, useState } from "react";
import { ASSET_CLASS_OPTIONS, GEOGRAPHY_OPTIONS, RISK_OPTIONS, type ComputedHolding, type Holding } from "@/lib/constants";
import { formatMoney, timeAgo } from "@/lib/utils";

interface Props {
  holdings: ComputedHolding[];
  isAmountsVisible: boolean;
  onEdit: (holding: Holding) => void;
  onDelete: (id: string) => void;
  onPriceUpdate: (id: string, price: number) => void;
  onAddHolding: () => void;
}

export default function HoldingsTable({ holdings, isAmountsVisible, onEdit, onDelete, onPriceUpdate, onAddHolding }: Props) {
  const [filters, setFilters] = useState({
    platform: "All",
    assetClass: "All",
    geography: "All",
    risk: "All",
    search: "",
  });
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const platforms = useMemo(() => ["All", ...new Set(holdings.map((holding) => holding.platform))], [holdings]);

  const filteredHoldings = useMemo(() => {
    return holdings.filter((holding) => {
      const matchesPlatform = filters.platform === "All" || holding.platform === filters.platform;
      const matchesAssetClass = filters.assetClass === "All" || holding.assetClass === filters.assetClass;
      const matchesGeography = filters.geography === "All" || holding.geography === filters.geography;
      const matchesRisk = filters.risk === "All" || holding.risk === filters.risk;
      const query = filters.search.trim().toLowerCase();

      const matchesSearch =
        !query ||
        holding.assetName.toLowerCase().includes(query) ||
        holding.ticker.toLowerCase().includes(query) ||
        holding.sector.toLowerCase().includes(query);

      return matchesPlatform && matchesAssetClass && matchesGeography && matchesRisk && matchesSearch;
    });
  }, [filters, holdings]);

  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Holdings</h2>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-500">
              {filteredHoldings.length} of {holdings.length}
            </div>
            <button
              onClick={onAddHolding}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm"
            >
              Add Holding
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <FilterInput label="Search" value={filters.search} onChange={(value) => setFilters({ ...filters, search: value })} placeholder="Asset, ticker, sector" />
          <FilterSelect label="Platform" value={filters.platform} options={platforms} onChange={(value) => setFilters({ ...filters, platform: value })} />
          <FilterSelect label="Class" value={filters.assetClass} options={["All", ...ASSET_CLASS_OPTIONS]} onChange={(value) => setFilters({ ...filters, assetClass: value })} />
          <FilterSelect label="Geography" value={filters.geography} options={["All", ...GEOGRAPHY_OPTIONS]} onChange={(value) => setFilters({ ...filters, geography: value })} />
          <FilterSelect label="Risk" value={filters.risk} options={["All", ...RISK_OPTIONS]} onChange={(value) => setFilters({ ...filters, risk: value })} />
        </div>
      </div>

      <div className="space-y-3 p-4 sm:hidden">
        {filteredHoldings.length ? (
          filteredHoldings.map((holding) => (
            <article key={holding.id} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{holding.assetName}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {holding.ticker || "No ticker"} · {holding.platform}
                  </div>
                </div>
                <button
                  onClick={() => setActionMenuId((current) => (current === holding.id ? null : holding.id))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                >
                  Actions
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <MobileStat label="Qty" value={holding.quantity < 1 ? holding.quantity.toFixed(7) : holding.quantity.toLocaleString()} />
                <MobileStat label="Value" value={isAmountsVisible ? formatMoney(holding.currentValueAed, "AED") : "••••"} />
                <MobileStat label="P/L" value={isAmountsVisible ? formatMoney(holding.gainLossAed, "AED") : `${holding.gainLossPct.toFixed(2)}%`} />
                <MobileStat label="Updated" value={timeAgo(holding.lastPriceUpdate)} />
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm text-slate-600">Market Price</label>
                <input
                  type="number"
                  step="any"
                  value={holding.currentPrice || ""}
                  onChange={(event) => onPriceUpdate(holding.id, Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="0"
                />
              </div>

              {actionMenuId === holding.id && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      onEdit(holding);
                      setActionMenuId(null);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      onDelete(holding.id);
                      setActionMenuId(null);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-red-600"
                  >
                    Delete
                  </button>
                </div>
              )}
            </article>
          ))
        ) : (
          <div className="py-12 text-center text-sm text-slate-500">No holdings</div>
        )}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3">Asset</th>
              <th className="px-3 py-3">Platform</th>
              <th className="px-3 py-3">Qty</th>
              <th className="px-3 py-3">Market Price</th>
              <th className="px-3 py-3">Value</th>
              <th className="px-3 py-3">Value (AED)</th>
              <th className="px-3 py-3">P/L (AED)</th>
              <th className="px-3 py-3">Updated</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {filteredHoldings.length ? (
              filteredHoldings.map((holding) => (
                <tr key={holding.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-900">{holding.assetName}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      {holding.ticker ? (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">
                          {holding.ticker}
                        </span>
                      ) : null}
                      <span>{holding.assetClass}</span>
                      <span>·</span>
                      <span>{holding.geography}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-slate-600">{holding.platform}</td>
                  <td className="px-3 py-3.5 font-mono text-slate-600">
                    {holding.quantity < 1 ? holding.quantity.toFixed(7) : holding.quantity.toLocaleString()}
                  </td>
                  <td className="px-3 py-3.5">
                    <input
                      type="number"
                      step="any"
                      value={holding.currentPrice || ""}
                      onChange={(event) => onPriceUpdate(holding.id, Number(event.target.value))}
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-sm"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-3.5 font-mono text-slate-600">
                    {isAmountsVisible ? formatMoney(holding.currentValue, holding.currency) : "••••"}
                  </td>
                  <td className="px-3 py-3.5 font-mono text-slate-600">
                    {isAmountsVisible ? formatMoney(holding.currentValueAed, "AED") : "••••"}
                  </td>
                  <td className="px-3 py-3.5">
                    <div className={`font-mono font-medium ${holding.gainLossAed >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {isAmountsVisible ? formatMoney(holding.gainLossAed, "AED") : `${holding.gainLossPct.toFixed(2)}%`}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {holding.gainLossPct >= 0 ? "+" : ""}
                      {holding.gainLossPct.toFixed(2)}%
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-xs text-slate-500">{timeAgo(holding.lastPriceUpdate)}</td>
                  <td className="relative px-3 py-3.5">
                    <button
                      onClick={() => setActionMenuId(actionMenuId === holding.id ? null : holding.id)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      ⋮
                    </button>
                    {actionMenuId === holding.id && (
                      <div className="absolute right-3 top-12 z-20 min-w-28 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                        <button
                          onClick={() => {
                            onEdit(holding);
                            setActionMenuId(null);
                          }}
                          className="block w-full px-4 py-2.5 text-left text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            onDelete(holding.id);
                            setActionMenuId(null);
                          }}
                          className="block w-full px-4 py-2.5 text-left text-xs text-red-600 hover:bg-slate-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500">
                  No holdings
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MobileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-3 ring-1 ring-slate-200">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-slate-900">{value}</div>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-3 py-2"
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
