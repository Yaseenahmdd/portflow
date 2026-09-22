"use client";

import { memo, useCallback, useMemo, useState, type CSSProperties } from "react";
import { useIsCompactViewport } from "@/hooks/useIsCompactViewport";
import { ASSET_CLASS_OPTIONS, GEOGRAPHY_OPTIONS, RISK_OPTIONS, type ComputedHolding, type Holding } from "@/lib/constants";
import { tap, toggle, medium, destructive as hapticDestructive } from "@/lib/haptics";
import { formatOrMask, timeAgo } from "@/lib/utils";
import { useDisplayCurrency } from "@/components/dashboard/DisplayCurrencyProvider";

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
  const { displayCurrency, convertAed } = useDisplayCurrency();
  const formatPortfolioAmount = (value: number) =>
    formatOrMask(convertAed(value), displayCurrency, isAmountsVisible);
  const formatPortfolioAmountWithoutCurrency = (value: number) =>
    formatPortfolioAmount(value).replace(displayCurrency === "AED" ? /^AED\s*/ : /^\$\s*/, "");
  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_MOBILE_FILTERS,
    search: "",
  });
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
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
  const hasActiveFilters = activeFilterCount > 0 || Boolean(filters.search.trim());
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

  const handleSort = useCallback((key: string) => {
    tap();

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
  }, [sortKey, sortDir]);

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
    toggle();
    setMobileColumn3Mode((current) => {
      if (current === "value") return "price";
      if (current === "price") return "return";
      return "value";
    });
  }

  function handleDeleteClick(holding: ComputedHolding) {
    medium();
    setPendingDeleteId(holding.id);
  }

  function confirmDelete(id: string) {
    hapticDestructive();
    onDelete(id);
    setPendingDeleteId(null);
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

  function getMobileModeShortLabel(mode: "value" | "price" | "return") {
    if (mode === "price") return "Price";
    if (mode === "return") return "Return";
    return "Value";
  }

  function getMobileValueTone(value: number) {
    if (value > 0) return "text-accent-gain";
    if (value < 0) return "text-accent-loss";
    return "text-text-primary";
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

  function clearAllFilters() {
    tap();
    setFilters({ ...DEFAULT_MOBILE_FILTERS, search: "" });
  }

  return (
    <section className="dashboard-card overflow-hidden rounded-xl border border-border-default bg-bg-card">
      <div className="border-b border-border-default p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-2.5">
            <div>
              <div className="ledger-kicker hidden sm:block">Portfolio ledger</div>
              <h2 className="mt-0.5 text-xl font-semibold tracking-[-0.025em] text-text-primary">Holdings</h2>
            </div>
            <span className="hidden text-sm text-text-muted sm:inline">{holdings.length} holdings</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="font-mono text-xs text-text-muted sm:hidden">
              {filteredHoldings.length} of {holdings.length}
            </div>
            {hasActiveFilters ? (
              <>
                <div className="hidden text-sm text-text-muted sm:block">
                  {filteredHoldings.length} of {holdings.length}
                </div>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="hidden min-h-10 items-center px-1 text-sm font-medium text-text-secondary hover:text-text-primary sm:inline-flex"
                >
                  Clear filters
                </button>
              </>
            ) : null}
            <button
              onClick={() => { tap(); onAddHolding(); }}
              className="inline-flex h-10 w-10 items-center justify-center gap-2 rounded-lg bg-accent-violet text-white transition-[filter,transform] hover:brightness-105 active:scale-[0.97] sm:w-auto sm:px-4"
              aria-label="Add holding"
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
              <span className="hidden text-sm font-semibold sm:inline">Add holding</span>
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
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-secondary"
                >
                  <span>{chip.label}</span>
                  <span className="text-text-muted">×</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-3 hidden gap-2.5 sm:grid sm:grid-cols-2 lg:grid-cols-[minmax(240px,1.5fr)_repeat(4,minmax(130px,1fr))]">
          <FilterInput label="Search" value={filters.search} onChange={(value) => setFilters({ ...filters, search: value })} placeholder="Asset, ticker, sector" />
          <FilterSelect label="Platform" value={filters.platform} options={platforms} onChange={(value) => setFilters({ ...filters, platform: value })} />
          <FilterSelect label="Class" value={filters.assetClass} options={["All", ...ASSET_CLASS_OPTIONS]} onChange={(value) => setFilters({ ...filters, assetClass: value })} />
          <FilterSelect label="Geography" value={filters.geography} options={["All", ...GEOGRAPHY_OPTIONS]} onChange={(value) => setFilters({ ...filters, geography: value })} />
          <FilterSelect label="Risk" value={filters.risk} options={["All", ...RISK_OPTIONS]} onChange={(value) => setFilters({ ...filters, risk: value })} />
        </div>
      </div>

      <div className="mb-2 mt-3 px-3 sm:hidden">
        <div className="grid grid-cols-3 gap-0.5 rounded-lg border border-border-subtle bg-bg-elevated p-0.5">
            <button
              type="button"
              onClick={() => {
                tap();
                if (mobileSortMenuOpen) {
                  closeMobileSortMenu();
                  return;
                }

                openMobileSortMenu();
              }}
              className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-medium transition-colors ${mobileSortMenuOpen ? "bg-bg-card text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
              aria-expanded={mobileSortMenuOpen}
              aria-label="Open mobile sort options"
            >
              <span>Sort</span>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h12M3 18h6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => {
                tap();
                if (mobileFiltersOpen) {
                  closeMobileFiltersMenu();
                  return;
                }

                openMobileFiltersMenu();
              }}
              className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-medium transition-colors ${mobileFiltersOpen || activeFilterCount ? "bg-bg-card text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
              aria-expanded={mobileFiltersOpen}
              aria-label="Open mobile filter options"
            >
              <span>Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}</span>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
              </svg>
            </button>

            <button
              type="button"
              onClick={cycleMobileMode}
              className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md bg-bg-card px-1.5 text-[11px] font-medium text-text-primary shadow-sm transition-colors hover:bg-bg-card-hover"
              aria-label={`Change holding display mode. Current mode: ${getMobileModeLabel(mobileColumn3Mode)}`}
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m0 0l-3-3m3 3l-3 3m3 7H8m0 0l3-3m-3 3l3 3" />
              </svg>
              <span className="whitespace-nowrap">{getMobileModeShortLabel(mobileColumn3Mode)}</span>
            </button>
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

      <div className="sm:hidden">
        {mobileSortedHoldings.length ? (
          mobileSortedHoldings.map((holding, holdingIndex) => (
            <div
              key={holding.id}
              className="bg-bg-card"
              style={holdingIndex === 0 ? undefined : {
                borderTop: "0.5px solid color-mix(in srgb, var(--color-text-muted) 18%, transparent)",
              }}
            >
              <div className="flex items-center justify-between gap-3 px-4 py-[14px]">
                <button type="button" className="min-w-0 flex-1 pr-3 text-left" onClick={() => { tap(); onView(holding); }}>
                  <div className="truncate text-[12px] font-semibold leading-[1.2] text-text-primary">{getMobileAssetName(holding.assetName)}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[9px] font-normal leading-[1.2] text-text-muted">
                    {getAssetMetaLine(holding).ticker ? (
                      <span className="rounded-md bg-bg-elevated px-1.5 py-0.5 font-mono text-[9px] text-text-secondary">
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
                      <div className="font-mono text-[12px] font-semibold leading-[1.15] text-text-primary">
                        {formatPortfolioAmount(holding.currentValueAed)}
                      </div>
                      <div className="mt-[3px] font-mono text-[9px] font-normal leading-[1.15] text-text-muted">
                        ({formatPortfolioAmountWithoutCurrency(holding.investedAmountAed)})
                      </div>
                    </>
                  ) : mobileColumn3Mode === "price" ? (
                    <>
                      <div className="font-mono text-[12px] font-semibold leading-[1.15] text-text-primary">
                        {formatOrMask(holding.currentPrice, holding.currency, isAmountsVisible)}
                      </div>
                      <div className={`mt-[3px] text-[9px] font-normal leading-[1.15] ${holding.dayGainPct === null ? "text-text-muted" : getMobileValueTone(holding.dayGainPct)}`}>
                        {holding.dayGainPct === null ? "No 1D data" : formatSignedPercent(holding.dayGainPct)}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`font-mono text-[12px] font-semibold leading-[1.15] ${getMobileValueTone(holding.gainLossAed)}`}>
                        {formatPortfolioAmount(holding.gainLossAed)}
                      </div>
                      <div className="mt-[3px] text-[9px] font-normal leading-[1.15] text-text-muted">
                        {formatSignedPercent(holding.gainLossPct)}
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => { tap(); setActionMenuId((current) => (current === holding.id ? null : holding.id)); }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600"
                  aria-label={`Actions for ${holding.assetName}`}
                >
                  ...
                </button>
              </div>

              {actionMenuId === holding.id && (
                <div className="border-t border-slate-50 bg-slate-50/50 px-4 py-3">
                  {pendingDeleteId === holding.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600">Delete {holding.assetName}?</span>
                      <button
                        onClick={() => confirmDelete(holding.id)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setPendingDeleteId(null)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
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
                        onClick={() => handleDeleteClick(holding)}
                        className="rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto max-w-xs">
              <div className="flow-rail" style={{ "--flow-progress": "18%" } as CSSProperties} />
              <div className="mt-5 text-sm font-semibold text-text-primary">Your portfolio ledger is empty</div>
              <p className="mt-1.5 text-xs leading-5 text-text-muted">Add a holding to start tracking capital, allocation, and market movement.</p>
              <button type="button" onClick={onAddHolding} className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-accent-violet px-4 text-xs font-semibold text-white">Add first holding</button>
            </div>
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border-default bg-bg-elevated/50 text-[11px] uppercase tracking-[0.1em] text-text-muted">
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
              <SortHeader label={`P/L (${displayCurrency})`} sortKey="pl" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="px-3 py-3">Updated</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {sortedHoldings.length ? (
              sortedHoldings.map((holding, index) => (
                <tr key={holding.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => onView(holding)}>
                  <td className="w-10 whitespace-nowrap px-3 py-3.5 text-center font-mono text-xs font-semibold text-text-muted">
                    {index + 1}
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-medium text-text-primary">{holding.assetName}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                      {getAssetMetaLine(holding).ticker ? (
                        <span className="rounded-md bg-bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
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
                  <td className="px-3 py-3 text-center font-mono text-text-secondary">
                    {formatOrMask(holding.currentValue, holding.currency, isAmountsVisible)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="font-mono text-text-primary">
                      {totalInvestedAed ? `${((holding.investedAmountAed / totalInvestedAed) * 100).toFixed(2)}%` : "0.00%"}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-mono text-text-primary">
                      {formatPortfolioAmount(holding.currentValueAed)}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-text-muted">
                      ({formatPortfolioAmountWithoutCurrency(holding.investedAmountAed)})
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {holding.hasDayGain ? (
                      <>
                        <div className={`font-mono font-medium ${holding.dayGainAed >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatPortfolioAmount(holding.dayGainAed)}
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
                      {formatPortfolioAmount(holding.gainLossAed)}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {formatSignedPercent(holding.gainLossPct)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-text-muted">{timeAgo(holding.lastPriceUpdate)}</td>
                  <td className="relative px-3 py-3">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        tap();
                        setActionMenuId(actionMenuId === holding.id ? null : holding.id);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      ...
                    </button>
                    {actionMenuId === holding.id && (
                      <div className="absolute right-3 top-12 z-20 min-w-28 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                        {pendingDeleteId === holding.id ? (
                          <>
                            <div className="px-4 py-2.5 text-xs font-medium text-red-600">Delete {holding.assetName}?</div>
                            <button
                              onClick={(event) => { event.stopPropagation(); confirmDelete(holding.id); }}
                              className="block w-full px-4 py-2.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Confirm delete
                            </button>
                            <button
                              onClick={(event) => { event.stopPropagation(); setPendingDeleteId(null); }}
                              className="block w-full px-4 py-2.5 text-left text-xs text-slate-600 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="py-12 text-center text-text-muted">
                  Add a holding to begin your portfolio ledger.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const SortHeader = memo(function SortHeader({
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
  return (
    <th
      className={`${className || "px-3 py-3"} group cursor-pointer select-none transition-colors`}
      onClick={() => onSort(sortKey)}
    >
      <div className="inline-flex items-center gap-1">
        <div className="leading-tight transition-colors text-text-muted group-hover:text-text-primary">
          {children || label}
        </div>
        <span
          className={`text-[10px] transition-colors group-hover:text-text-secondary ${isActive ? "text-text-primary" : "text-text-muted"}`}
        >
          {isActive ? (dir === "asc" ? "\u25B2" : "\u25BC") : "\u21C5"}
        </span>
      </div>
    </th>
  );
});

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
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
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
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm">
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
