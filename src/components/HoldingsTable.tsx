"use client";

import { useMemo, useState } from "react";
import { ASSET_CLASS_OPTIONS, GEOGRAPHY_OPTIONS, RISK_OPTIONS, type ComputedHolding, type Holding } from "@/lib/constants";
import { formatMoney, formatOrMask, timeAgo } from "@/lib/utils";

interface Props {
  holdings: ComputedHolding[];
  isAmountsVisible: boolean;
  onView: (holding: Holding) => void;
  onEdit: (holding: Holding) => void;
  onDelete: (id: string) => void;
  onPriceUpdate: (id: string, price: number) => void;
  onAddHolding: () => void;
}

export default function HoldingsTable({ holdings, isAmountsVisible, onView, onEdit, onDelete, onPriceUpdate, onAddHolding }: Props) {
  const [filters, setFilters] = useState({
    platform: "All",
    assetClass: "All",
    geography: "All",
    risk: "All",
    search: "",
  });
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [mobileColumn3Mode, setMobileColumn3Mode] = useState<"value" | "return">("value");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  const sortedHoldings = useMemo(() => {
    if (!sortKey) return filteredHoldings;

    const getValue = (h: ComputedHolding): number | string => {
      switch (sortKey) {
        case "asset": return h.assetName.toLowerCase();
        case "platform": return h.platform.toLowerCase();
        case "qty": return h.quantity;
        case "value": return h.currentValue;
        case "currentAed": return h.currentValueAed;
        case "pl": return h.gainLossAed;
        case "plPct": return h.gainLossPct;
        default: return 0;
      }
    };

    return [...filteredHoldings].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredHoldings, sortKey, sortDir]);

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === "desc") {
        setSortDir("asc");
      } else {
        setSortKey(null);
        setSortDir("desc");
      }
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function handleDeleteClick(holding: ComputedHolding) {
    const shouldDelete = window.confirm(`Delete "${holding.assetName}" from your holdings?`);

    if (!shouldDelete) {
      return;
    }

    onDelete(holding.id);
    setActionMenuId(null);
  }

  function getMobileAssetName(assetName: string) {
    const trimmedName = assetName.trim();

    if (/^bandhan small cap fund/i.test(trimmedName)) {
      return "Bandhan Small Cap MF";
    }

    if (/^motilal( oswal)? midcap fund/i.test(trimmedName)) {
      return "Motilal Mid Cap MF";
    }

    if (/^mirae asset nifty midcap 150 etf/i.test(trimmedName)) {
      return "Nifty Mid Cap 150 ETF";
    }

    if (/^ishares bitcoin trust etf/i.test(trimmedName)) {
      return "iShare Bitcoin ETF";
    }

    return trimmedName;
  }

  return (
    <section className="dashboard-card rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="border-b border-slate-200 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Holdings</h2>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-xs text-slate-500 sm:text-sm">
              {filteredHoldings.length} of {holdings.length}
            </div>
            <button
              onClick={onAddHolding}
              className="rounded-xl bg-accent-violet px-3 py-2 text-sm font-medium text-bg-primary shadow-sm transition hover:brightness-105"
            >
              Add Holding
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <FilterInput label="Search" value={filters.search} onChange={(value) => setFilters({ ...filters, search: value })} placeholder="Asset, ticker, sector" />
          <FilterSelect label="Platform" value={filters.platform} options={platforms} onChange={(value) => setFilters({ ...filters, platform: value })} />
          <FilterSelect label="Class" value={filters.assetClass} options={["All", ...ASSET_CLASS_OPTIONS]} onChange={(value) => setFilters({ ...filters, assetClass: value })} />
          <FilterSelect label="Geography" value={filters.geography} options={["All", ...GEOGRAPHY_OPTIONS]} onChange={(value) => setFilters({ ...filters, geography: value })} />
          <FilterSelect label="Risk" value={filters.risk} options={["All", ...RISK_OPTIONS]} onChange={(value) => setFilters({ ...filters, risk: value })} />
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-2 sm:hidden">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Asset</span>
        <button
          onClick={() => setMobileColumn3Mode((mode) => (mode === "value" ? "return" : "value"))}
          className="flex items-center gap-1.5 rounded bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-600 active:bg-slate-200"
        >
          {mobileColumn3Mode === "value" ? "Current" : "Investor"}
          <svg className="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </button>
      </div>

      <div className="divide-y divide-slate-100 sm:hidden">
        {filteredHoldings.length ? (
          filteredHoldings.map((holding) => (
            <div key={holding.id} className="bg-white">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <button type="button" className="min-w-0 flex-1 pr-3 text-left" onClick={() => onView(holding)}>
                  <div className="truncate text-sm font-semibold text-slate-900">{getMobileAssetName(holding.assetName)}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{holding.ticker || "No ticker"}</div>
                </button>

                <div className="text-right">
                  {mobileColumn3Mode === "value" ? (
                    <>
                      <div className="font-mono text-xs font-medium text-slate-900">
                        {formatOrMask(holding.currentValueAed, "AED", isAmountsVisible)}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                        ({formatOrMask(holding.investedAmountAed, "AED", isAmountsVisible).replace("AED", "").trim()})
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`font-mono text-xs font-medium ${holding.gainLossAed >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatMoney(holding.gainLossAed, "AED")}
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-500">
                        {holding.gainLossPct >= 0 ? "+" : ""}
                        {holding.gainLossPct.toFixed(2)}%
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setActionMenuId((current) => (current === holding.id ? null : holding.id))}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600"
                  aria-label={`Actions for ${holding.assetName}`}
                >
                  ...
                </button>
              </div>

              {actionMenuId === holding.id && (
                <div className="border-t border-slate-50 bg-slate-50/50 px-4 py-3">
                  <div className="mb-3">
                    <label className="mb-1 block text-xs font-medium text-slate-500">Update Market Price ({holding.currency})</label>
                    <input
                      type="number"
                      step="any"
                      value={holding.currentPrice || ""}
                      onChange={(event) => onPriceUpdate(holding.id, Number(event.target.value))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        onEdit(holding);
                        setActionMenuId(null);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
                    >
                      Edit Holding
                    </button>
                    <button
                      onClick={() => {
                        handleDeleteClick(holding);
                      }}
                      className="rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="py-12 text-center text-sm text-slate-500">No holdings found</div>
        )}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-10 whitespace-nowrap px-3 py-3 text-center">#</th>
              <SortHeader label="Asset" sortKey="asset" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="px-5 py-3" />
              <SortHeader label="Platform" sortKey="platform" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader label="Qty" sortKey="qty" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="px-3 py-3">Market Price</th>
              <SortHeader label="Value" sortKey="value" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader sortKey="currentAed" currentKey={sortKey} dir={sortDir} onSort={handleSort}>
                <div>Current</div>
                <div>(Invested)</div>
              </SortHeader>
              <SortHeader label="P/L (AED)" sortKey="pl" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="px-3 py-3">Updated</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {sortedHoldings.length ? (
              sortedHoldings.map((holding, index) => (
                <tr key={holding.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => onView(holding)}>
                  <td className="w-10 whitespace-nowrap px-3 py-3.5 text-center text-sm font-semibold text-slate-400">
                    {index + 1}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-900">{holding.assetName}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      {holding.ticker ? (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">
                          {holding.ticker}
                        </span>
                      ) : null}
                      <span>{holding.assetClass}</span>
                      <span>&middot;</span>
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
                      onClick={(event) => event.stopPropagation()}
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-sm"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-3.5 font-mono text-slate-600">
                    {formatOrMask(holding.currentValue, holding.currency, isAmountsVisible)}
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="font-mono text-slate-900">
                      {formatOrMask(holding.currentValueAed, "AED", isAmountsVisible)}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-slate-500">
                      ({formatOrMask(holding.investedAmountAed, "AED", isAmountsVisible).replace("AED", "").trim()})
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className={`font-mono font-medium ${holding.gainLossAed >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatMoney(holding.gainLossAed, "AED")}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {holding.gainLossPct >= 0 ? "+" : ""}
                      {holding.gainLossPct.toFixed(2)}%
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-xs text-slate-500">{timeAgo(holding.lastPriceUpdate)}</td>
                  <td className="relative px-3 py-3.5">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setActionMenuId(actionMenuId === holding.id ? null : holding.id);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      ...
                    </button>
                    {actionMenuId === holding.id && (
                      <div className="absolute right-3 top-12 z-20 min-w-28 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onEdit(holding);
                            setActionMenuId(null);
                          }}
                          className="block w-full px-4 py-2.5 text-left text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteClick(holding);
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
                <td colSpan={10} className="py-12 text-center text-slate-500">
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

function SortHeader({
  label,
  sortKey,
  currentKey,
  dir,
  onSort,
  className,
  children,
}: {
  label?: string;
  sortKey: string;
  currentKey: string | null;
  dir: "asc" | "desc";
  onSort: (key: string) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const isActive = currentKey === sortKey;
  const [isHovered, setIsHovered] = useState(false);
  return (
    <th
      className={`${className || "px-3 py-3"} cursor-pointer select-none transition-colors`}
      onClick={() => onSort(sortKey)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="inline-flex items-center gap-1">
        <div
          className="leading-tight transition-colors"
          style={{
            color: isHovered ? "var(--color-text-primary)" : "var(--color-text-muted)",
          }}
        >
          {children || label}
        </div>
        <span
          className="text-[10px] transition-colors"
          style={{
            color: isActive
              ? "var(--color-text-primary)"
              : isHovered
                ? "var(--color-text-secondary)"
                : "var(--color-text-muted)",
          }}
        >
          {isActive ? (dir === "asc" ? "\u25B2" : "\u25BC") : "\u21C5"}
        </span>
      </div>
    </th>
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
