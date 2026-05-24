"use client";

import { useMemo, useState } from "react";
import { useIsCompactViewport } from "@/hooks/useIsCompactViewport";
import { ASSET_CLASS_OPTIONS, GEOGRAPHY_OPTIONS, RISK_OPTIONS, type ComputedHolding, type Holding } from "@/lib/constants";
import { formatOrMask, timeAgo } from "@/lib/utils";

interface Props {
  holdings: ComputedHolding[];
  isAmountsVisible: boolean;
  onView: (holding: Holding) => void;
  onEdit: (holding: Holding) => void;
  onDelete: (id: string) => void;
  onPriceUpdate: (id: string, price: number) => void;
  onAddHolding: () => void;
}

type MobileSortKey = "currentValue" | "returnPct" | "dayChangePct" | "stockName";
type FilterState = {
  platform: string;
  assetClass: string;
  geography: string;
  risk: string;
  search: string;
};
type MobileFilterState = Omit<FilterState, "search">;

const DEFAULT_MOBILE_FILTERS: MobileFilterState = {
  platform: "All",
  assetClass: "All",
  geography: "All",
  risk: "All",
};

export default function HoldingsTable({ holdings, isAmountsVisible, onView, onEdit, onDelete, onPriceUpdate, onAddHolding }: Props) {
  const isCompactViewport = useIsCompactViewport();
  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_MOBILE_FILTERS,
    search: "",
  });
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileColumn3Mode, setMobileColumn3Mode] = useState<"value" | "price" | "return">("value");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [mobileSortMenuOpen, setMobileSortMenuOpen] = useState(false);
  const [mobileSortKey, setMobileSortKey] = useState<MobileSortKey | null>(null);
  const [mobileSortDir, setMobileSortDir] = useState<"asc" | "desc" | null>(null);
  const [mobileDraftSortKey, setMobileDraftSortKey] = useState<MobileSortKey>("currentValue");
  const [mobileDraftSortDir, setMobileDraftSortDir] = useState<"asc" | "desc">("desc");
  const [mobileDraftFilters, setMobileDraftFilters] = useState<MobileFilterState>(DEFAULT_MOBILE_FILTERS);

  const platforms = useMemo(() => ["All", ...new Set(holdings.map((holding) => holding.platform))], [holdings]);
  const activeFilterCount = [
    filters.platform !== "All",
    filters.assetClass !== "All",
    filters.geography !== "All",
    filters.risk !== "All",
  ].filter(Boolean).length;
  const activeFilterChips = [
    filters.platform !== "All" ? { key: "platform", label: filters.platform } : null,
    filters.assetClass !== "All" ? { key: "assetClass", label: filters.assetClass } : null,
    filters.geography !== "All" ? { key: "geography", label: filters.geography } : null,
    filters.risk !== "All" ? { key: "risk", label: filters.risk } : null,
  ].filter((chip): chip is { key: "platform" | "assetClass" | "geography" | "risk"; label: string } => chip !== null);

  const filteredHoldings = useMemo(() => {
    return holdings.filter((holding) => {
      const matchesPlatform = filters.platform === "All" || holding.platform === filters.platform;
      const matchesAssetClass = filters.assetClass === "All" || holding.assetClass === filters.assetClass;
      const matchesGeography = filters.geography === "All" || holding.geography === filters.geography;
      const matchesRisk = filters.risk === "All" || holding.risk === filters.risk;
      const query = isCompactViewport ? "" : filters.search.trim().toLowerCase();

      const matchesSearch =
        !query ||
        holding.assetName.toLowerCase().includes(query) ||
        holding.ticker.toLowerCase().includes(query) ||
        holding.sector.toLowerCase().includes(query);

      return matchesPlatform && matchesAssetClass && matchesGeography && matchesRisk && matchesSearch;
    });
  }, [filters, holdings, isCompactViewport]);

  const sortedHoldings = useMemo(() => {
    if (!sortKey) return filteredHoldings;

    const getValue = (h: ComputedHolding): number | string => {
      switch (sortKey) {
        case "asset": return h.assetName.toLowerCase();
        case "value": return h.currentValue;
        case "allocation": return h.investedAmountAed;
        case "currentAed": return h.currentValueAed;
        case "dayGain": return h.dayGainAed;
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

  const totalInvestedAed = useMemo(
    () => filteredHoldings.reduce((sum, holding) => sum + holding.investedAmountAed, 0),
    [filteredHoldings]
  );

  const mobileSortedHoldings = useMemo(() => {
    if (!mobileSortKey || !mobileSortDir) {
      return filteredHoldings;
    }

    const getMobileSortValue = (holding: ComputedHolding) => {
      switch (mobileSortKey) {
        case "stockName":
          return holding.assetName.toLowerCase();
        case "returnPct":
          return holding.gainLossPct;
        case "dayChangePct":
          return holding.dayGainPct;
        case "currentValue":
        default:
          return holding.currentValueAed;
      }
    };

    return [...filteredHoldings].sort((a, b) => {
      const left = getMobileSortValue(a);
      const right = getMobileSortValue(b);

      if (typeof left === "string" && typeof right === "string") {
        return mobileSortDir === "asc" ? left.localeCompare(right) : right.localeCompare(left);
      }

      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;

      const difference = Number(left) - Number(right);
      return mobileSortDir === "asc" ? difference : -difference;
    });
  }, [filteredHoldings, mobileSortDir, mobileSortKey]);

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

  function getDefaultMobileSortDir(key: MobileSortKey) {
    return key === "stockName" ? "asc" : "desc";
  }

  function openMobileSortMenu() {
    setMobileFiltersOpen(false);
    const activeKey = mobileSortKey ?? "currentValue";
    const activeDir = mobileSortDir ?? getDefaultMobileSortDir(activeKey);

    setMobileDraftSortKey(activeKey);
    setMobileDraftSortDir(activeDir);
    setMobileSortMenuOpen(true);
  }

  function closeMobileSortMenu() {
    setMobileSortMenuOpen(false);
  }

  function openMobileFiltersMenu() {
    closeMobileSortMenu();
    setMobileDraftFilters({
      platform: filters.platform,
      assetClass: filters.assetClass,
      geography: filters.geography,
      risk: filters.risk,
    });
    setMobileFiltersOpen(true);
  }

  function closeMobileFiltersMenu() {
    setMobileFiltersOpen(false);
  }

  function updateMobileDraftFilter(key: keyof MobileFilterState, value: string) {
    setMobileDraftFilters((current) => ({ ...current, [key]: value }));
  }

  function applyMobileFilters() {
    setFilters((current) => ({
      ...current,
      ...mobileDraftFilters,
    }));
    closeMobileFiltersMenu();
  }

  function clearMobileDraftFilters() {
    setMobileDraftFilters(DEFAULT_MOBILE_FILTERS);
  }

  function handleMobileSortOptionChange(key: MobileSortKey) {
    setMobileDraftSortKey(key);
    setMobileDraftSortDir((current) => {
      if (mobileDraftSortKey === key) {
        return current;
      }

      return getDefaultMobileSortDir(key);
    });
  }

  function applyMobileSortSelection() {
    setMobileSortKey(mobileDraftSortKey);
    setMobileSortDir(mobileDraftSortDir);
    closeMobileSortMenu();
  }

  function cycleMobileMode() {
    setMobileColumn3Mode((current) => {
      if (current === "value") return "price";
      if (current === "price") return "return";
      return "value";
    });
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

  function formatQuantity(quantity: number) {
    if (quantity < 1) {
      return quantity.toFixed(7).replace(/0+$/, "").replace(/\.$/, "");
    }

    return quantity.toLocaleString();
  }

  function getAssetMetaLine(holding: ComputedHolding) {
    const formattedQuantity = formatQuantity(holding.quantity);
    return {
      ticker: holding.ticker,
      quantity: formattedQuantity,
    };
  }

  function formatSignedPercent(value: number) {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  }

  function getMobileModeLabel(mode: "value" | "price" | "return") {
    switch (mode) {
      case "price":
        return "Market Price (1D%)";
      case "return":
        return "Return (%)";
      default:
        return "Current (Invested)";
    }
  }

  function getMobileValueTone(value: number) {
    if (value > 0) return "text-green-600";
    if (value < 0) return "text-red-600";
    return "text-slate-900";
  }

  function getMobileSortOptionLabel(key: MobileSortKey) {
    switch (key) {
      case "returnPct":
        return "Return%";
      case "dayChangePct":
        return "Day Change %";
      case "stockName":
        return "Stock Name";
      case "currentValue":
      default:
        return "Current Value";
    }
  }

  function clearSingleFilter(key: "platform" | "assetClass" | "geography" | "risk") {
    setFilters((current) => ({ ...current, [key]: "All" }));
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
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent-violet text-bg-primary shadow-sm transition hover:brightness-105"
              aria-label="Add holding"
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3 sm:hidden">
          {activeFilterChips.length ? (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => clearSingleFilter(chip.key)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  <span>{chip.label}</span>
                  <span className="text-slate-400">x</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-4 hidden gap-3 md:grid-cols-2 xl:grid-cols-5 sm:grid">
          <FilterInput label="Search" value={filters.search} onChange={(value) => setFilters({ ...filters, search: value })} placeholder="Asset, ticker, sector" />
          <FilterSelect label="Platform" value={filters.platform} options={platforms} onChange={(value) => setFilters({ ...filters, platform: value })} />
          <FilterSelect label="Class" value={filters.assetClass} options={["All", ...ASSET_CLASS_OPTIONS]} onChange={(value) => setFilters({ ...filters, assetClass: value })} />
          <FilterSelect label="Geography" value={filters.geography} options={["All", ...GEOGRAPHY_OPTIONS]} onChange={(value) => setFilters({ ...filters, geography: value })} />
          <FilterSelect label="Risk" value={filters.risk} options={["All", ...RISK_OPTIONS]} onChange={(value) => setFilters({ ...filters, risk: value })} />
        </div>
      </div>

      <div className="mt-3 mb-2 sm:hidden">
        <div className="flex min-h-[25px] items-center justify-between gap-4 border-b border-slate-100/80 px-4 py-[2px]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (mobileSortMenuOpen) {
                  closeMobileSortMenu();
                  return;
                }

                openMobileSortMenu();
              }}
              className="inline-flex h-[20px] shrink-0 scale-[0.65] origin-left items-center gap-1 rounded-[4px] px-0 text-left text-[11px] font-normal leading-[1] tracking-[0.02em] text-slate-500 transition-colors hover:text-slate-700"
              aria-expanded={mobileSortMenuOpen}
              aria-label="Open mobile sort options"
            >
              <span>Sort</span>
              <svg className="h-[17px] w-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h12M3 18h6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => {
                if (mobileFiltersOpen) {
                  closeMobileFiltersMenu();
                  return;
                }

                openMobileFiltersMenu();
              }}
              className="inline-flex h-[20px] shrink-0 scale-[0.65] origin-left items-center gap-1 rounded-[4px] px-0 text-left text-[11px] font-normal leading-[1] tracking-[0.02em] text-slate-500 transition-colors hover:text-slate-700"
              aria-expanded={mobileFiltersOpen}
              aria-label="Open mobile filter options"
            >
              <span>Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}</span>
              <svg className="h-[17px] w-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
              </svg>
            </button>
          </div>
          <div className="flex min-w-0 justify-end">
            <button
              type="button"
              onClick={cycleMobileMode}
              className="inline-flex h-[20px] min-w-[110px] max-w-[130px] scale-[0.65] origin-right items-center justify-end gap-1 rounded-[4px] px-0 text-[11px] font-normal leading-[1] tracking-[0.02em] text-slate-500 transition-colors hover:text-slate-700 active:text-slate-700"
              aria-label={`Change holding display mode. Current mode: ${getMobileModeLabel(mobileColumn3Mode)}`}
            >
              <svg className="h-[17px] w-[17px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m0 0l-3-3m3 3l-3 3m3 7H8m0 0l3-3m-3 3l3 3" />
              </svg>
              <span className="whitespace-nowrap text-right">{getMobileModeLabel(mobileColumn3Mode)}</span>
            </button>
          </div>
        </div>

        {mobileSortMenuOpen ? (
          <div className="fixed inset-0 z-50 overflow-hidden sm:hidden" aria-hidden={!mobileSortMenuOpen}>
            <button
              type="button"
              onClick={closeMobileSortMenu}
              className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm animate-[portflow-sheet-fade-in_180ms_ease-out_forwards]"
              aria-label="Close sort sheet"
            />

            <div className="absolute inset-x-0 bottom-0 animate-[portflow-sheet-slide-in_280ms_cubic-bezier(0.22,1,0.36,1)_forwards]">
            <div
              className="rounded-t-[2rem] border border-border-default bg-bg-card px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_48px_rgba(15,23,42,0.24)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" aria-hidden="true" />
              <div className="mt-4 text-[13px] font-semibold tracking-[0.01em] text-text-primary">Sort by</div>

              <div className="mt-3 divide-y divide-border-default overflow-hidden rounded-2xl border border-border-default bg-bg-elevated">
                {(["currentValue", "returnPct", "dayChangePct", "stockName"] as MobileSortKey[]).map((key) => {
                  const isActive = mobileDraftSortKey === key;

                  return (
                    <div key={key} className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleMobileSortOptionChange(key)}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                            isActive ? "border-accent-violet" : "border-slate-300"
                          }`}
                          aria-hidden="true"
                        >
                          {isActive ? <span className="h-2 w-2 rounded-full bg-accent-violet" /> : null}
                        </span>
                        <span className="text-[12px] font-medium leading-none text-text-primary">{getMobileSortOptionLabel(key)}</span>
                      </button>

                      {isActive ? (
                        <div className="mt-3 flex flex-wrap gap-2 pl-7">
                          <button
                            type="button"
                            onClick={() => setMobileDraftSortDir("desc")}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-medium transition ${
                              mobileDraftSortDir === "desc"
                                ? "border-accent-violet bg-accent-violet-bg text-text-primary"
                                : "border-border-default bg-bg-card text-text-secondary hover:bg-bg-card-hover"
                            }`}
                          >
                            <svg className="h-[11px] w-[11px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m0 0l-5-5m5 5l5-5" />
                            </svg>
                            <span>{key === "stockName" ? "Z-A" : "High to low"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setMobileDraftSortDir("asc")}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-medium transition ${
                              mobileDraftSortDir === "asc"
                                ? "border-accent-violet bg-accent-violet-bg text-text-primary"
                                : "border-border-default bg-bg-card text-text-secondary hover:bg-bg-card-hover"
                            }`}
                          >
                            <svg className="h-[11px] w-[11px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-5 5m5-5l5 5" />
                            </svg>
                            <span>{key === "stockName" ? "A-Z" : "Low to high"}</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={applyMobileSortSelection}
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-accent-violet px-4 py-3 text-[13px] font-semibold text-bg-primary transition hover:brightness-105"
              >
                Apply
              </button>
            </div>
          </div>
          </div>
        ) : null}

        {mobileFiltersOpen ? (
          <div className="fixed inset-0 z-50 overflow-hidden sm:hidden" aria-hidden={!mobileFiltersOpen}>
            <button
              type="button"
              onClick={closeMobileFiltersMenu}
              className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm animate-[portflow-sheet-fade-in_180ms_ease-out_forwards]"
              aria-label="Close filter sheet"
            />

            <div className="absolute inset-x-0 bottom-0 animate-[portflow-sheet-slide-in_280ms_cubic-bezier(0.22,1,0.36,1)_forwards]">
            <div
              className="rounded-t-[2rem] border border-border-default bg-bg-card px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_48px_rgba(15,23,42,0.24)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" aria-hidden="true" />
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-[13px] font-semibold tracking-[0.01em] text-text-primary">Filter holdings</div>
                <button
                  type="button"
                  onClick={clearMobileDraftFilters}
                  className="text-[11px] font-medium text-text-secondary transition hover:text-text-primary"
                >
                  Clear all
                </button>
              </div>

              <div className="mt-3 space-y-3">
                <MobileFilterSection
                  label="Platform"
                  value={mobileDraftFilters.platform}
                  options={platforms}
                  onChange={(value) => updateMobileDraftFilter("platform", value)}
                />
                <MobileFilterSection
                  label="Class"
                  value={mobileDraftFilters.assetClass}
                  options={["All", ...ASSET_CLASS_OPTIONS]}
                  onChange={(value) => updateMobileDraftFilter("assetClass", value)}
                />
                <MobileFilterSection
                  label="Geography"
                  value={mobileDraftFilters.geography}
                  options={["All", ...GEOGRAPHY_OPTIONS]}
                  onChange={(value) => updateMobileDraftFilter("geography", value)}
                />
                <MobileFilterSection
                  label="Risk"
                  value={mobileDraftFilters.risk}
                  options={["All", ...RISK_OPTIONS]}
                  onChange={(value) => updateMobileDraftFilter("risk", value)}
                />
              </div>

              <button
                type="button"
                onClick={applyMobileFilters}
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-accent-violet px-4 py-3 text-[13px] font-semibold text-bg-primary transition hover:brightness-105"
              >
                Apply
              </button>
            </div>
          </div>
          </div>
        ) : null}
      </div>

      <div className="divide-y divide-slate-100 sm:hidden">
        {mobileSortedHoldings.length ? (
          mobileSortedHoldings.map((holding) => (
            <div key={holding.id} className="bg-white">
              <div className="flex items-center justify-between gap-3 px-4 py-[14px]">
                <button type="button" className="min-w-0 flex-1 pr-3 text-left" onClick={() => onView(holding)}>
                  <div className="truncate text-[12px] font-semibold leading-[1.2] text-slate-900">{getMobileAssetName(holding.assetName)}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[9px] font-normal leading-[1.2] text-slate-500">
                    {getAssetMetaLine(holding).ticker ? (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] text-slate-700">
                        {getAssetMetaLine(holding).ticker}
                      </span>
                    ) : null}
                    {getAssetMetaLine(holding).ticker ? <span>&bull;</span> : null}
                    <span>{getAssetMetaLine(holding).quantity}</span>
                  </div>
                </button>

                <div className="text-right">
                  {mobileColumn3Mode === "value" ? (
                    <>
                      <div className="font-mono text-[12px] font-semibold leading-[1.15] text-slate-900">
                        {formatOrMask(holding.currentValueAed, "AED", isAmountsVisible)}
                      </div>
                      <div className="mt-[3px] font-mono text-[9px] font-normal leading-[1.15] text-slate-400">
                        ({formatOrMask(holding.investedAmountAed, "AED", isAmountsVisible).replace("AED", "").trim()})
                      </div>
                    </>
                  ) : mobileColumn3Mode === "price" ? (
                    <>
                      <div className="font-mono text-[12px] font-semibold leading-[1.15] text-slate-900">
                        {formatOrMask(holding.currentPrice, holding.currency, isAmountsVisible)}
                      </div>
                      <div className={`mt-[3px] text-[9px] font-normal leading-[1.15] ${holding.dayGainPct === null ? "text-slate-400" : getMobileValueTone(holding.dayGainPct)}`}>
                        {holding.dayGainPct === null ? "No 1D data" : formatSignedPercent(holding.dayGainPct)}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`font-mono text-[12px] font-semibold leading-[1.15] ${getMobileValueTone(holding.gainLossAed)}`}>
                        {formatOrMask(holding.gainLossAed, "AED", isAmountsVisible)}
                      </div>
                      <div className="mt-[3px] text-[9px] font-normal leading-[1.15] text-slate-500">
                        {formatSignedPercent(holding.gainLossPct)}
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
              <th className="px-3 py-3">Market Price</th>
              <SortHeader label="Value" sortKey="value" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="px-3 py-3 text-center" />
              <SortHeader label="Allocation" sortKey="allocation" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader sortKey="currentAed" currentKey={sortKey} dir={sortDir} onSort={handleSort}>
                <div>Current</div>
                <div>(Invested)</div>
              </SortHeader>
              <SortHeader label="Day Gain" sortKey="dayGain" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
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
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{holding.assetName}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      {getAssetMetaLine(holding).ticker ? (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                          {getAssetMetaLine(holding).ticker}
                        </span>
                      ) : null}
                      {getAssetMetaLine(holding).ticker ? <span>&bull;</span> : null}
                      <span>{getAssetMetaLine(holding).quantity}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
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
                  <td className="px-3 py-3 text-center font-mono text-slate-600">
                    {formatOrMask(holding.currentValue, holding.currency, isAmountsVisible)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="font-mono text-slate-900">
                      {totalInvestedAed ? `${((holding.investedAmountAed / totalInvestedAed) * 100).toFixed(2)}%` : "0.00%"}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-mono text-slate-900">
                      {formatOrMask(holding.currentValueAed, "AED", isAmountsVisible)}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-slate-500">
                      ({formatOrMask(holding.investedAmountAed, "AED", isAmountsVisible).replace("AED", "").trim()})
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {holding.hasDayGain ? (
                      <>
                        <div className={`font-mono font-medium ${holding.dayGainAed >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatOrMask(holding.dayGainAed, "AED", isAmountsVisible)}
                        </div>
                        <div className={`mt-0.5 text-xs ${holding.dayGainAed >= 0 ? "text-green-600/80" : "text-red-600/80"}`}>
                          {holding.dayGainPct === null ? "—" : formatSignedPercent(holding.dayGainPct)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-mono font-medium text-slate-400">—</div>
                        <div className="mt-0.5 text-xs text-slate-400">—</div>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className={`font-mono font-medium ${holding.gainLossAed >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatOrMask(holding.gainLossAed, "AED", isAmountsVisible)}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {formatSignedPercent(holding.gainLossPct)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">{timeAgo(holding.lastPriceUpdate)}</td>
                  <td className="relative px-3 py-3">
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

function MobileFilterSection({
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
    <section className="rounded-2xl border border-border-default bg-bg-elevated p-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-secondary">{label}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = value === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                isActive
                  ? "border-accent-violet bg-accent-violet-bg text-text-primary"
                  : "border-border-default bg-bg-card text-text-secondary hover:bg-bg-card-hover"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </section>
  );
}
