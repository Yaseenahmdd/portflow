"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { DEFAULT_HOLDINGS, type Holding, type ComputedHolding, ASSET_CLASS_OPTIONS, GEOGRAPHY_OPTIONS, RISK_OPTIONS, PIE_COLORS, type Currency } from "@/lib/constants";
import { computeHolding, formatMoney, getAllocation, generateId, toNumber, timeAgo } from "@/lib/utils";
import { computeInrToAed } from "@/lib/api/frankfurter";
import { createClient } from "@/lib/supabase/client";
import AllocationCharts from "@/components/AllocationCharts";
import HoldingsTable from "@/components/HoldingsTable";
import HoldingModal from "@/components/HoldingModal";

function getStorageKey(userId: string) {
  return `assetviz-holdings-${userId}`;
}
function getRateStorageKey(userId: string) {
  return `assetviz-inr-aed-rate-${userId}`;
}

export default function DashboardPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [inrToAedRate, setInrToAedRate] = useState(0.044);
  const [isAmountsVisible, setIsAmountsVisible] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState<string>("default");

  // Get current user and load their data from localStorage
  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id || "default";
      setUserId(uid);

      const storageKey = getStorageKey(uid);
      const rateKey = getRateStorageKey(uid);

      const saved = localStorage.getItem(storageKey);
      const savedRate = localStorage.getItem(rateKey);
      if (saved) {
        try {
          setHoldings(JSON.parse(saved));
        } catch {
          setHoldings(DEFAULT_HOLDINGS);
        }
      } else {
        setHoldings(DEFAULT_HOLDINGS);
      }
      if (savedRate) setInrToAedRate(Number(savedRate));
      setMounted(true);
    }
    init();
  }, []);

  // Persist holdings (user-specific)
  useEffect(() => {
    if (mounted) localStorage.setItem(getStorageKey(userId), JSON.stringify(holdings));
  }, [holdings, mounted, userId]);

  // Persist rate (user-specific)
  useEffect(() => {
    if (mounted) localStorage.setItem(getRateStorageKey(userId), String(inrToAedRate));
  }, [inrToAedRate, mounted, userId]);

  const computedHoldings = useMemo(
    () => holdings.map((h) => computeHolding(h, inrToAedRate)),
    [holdings, inrToAedRate]
  );

  const summary = useMemo(() => {
    const totalInvested = computedHoldings.reduce((s, h) => s + h.investedAmountAed, 0);
    const totalValue = computedHoldings.reduce((s, h) => s + h.currentValueAed, 0);
    const totalGainLoss = computedHoldings.reduce((s, h) => s + h.gainLossAed, 0);
    const totalGainLossPct = totalInvested ? (totalGainLoss / totalInvested) * 100 : 0;
    return { totalInvested, totalValue, totalGainLoss, totalGainLossPct };
  }, [computedHoldings]);

  // ── Refresh all prices ──
  const refreshPrices = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/prices/refresh-all");
      const data = await res.json();
      if (!data.success) throw new Error("Refresh failed");

      const now = new Date().toISOString();
      setLastRefresh(now);

      setHoldings((prev) => {
        const updated = [...prev];

        for (const result of data.results) {
          if (!result.success || !result.data) continue;

          if (result.source === "currency") {
            const rates = result.data;
            if (rates?.rates?.INR) {
              const newRate = 1 / rates.rates.INR;
              setInrToAedRate(newRate);
            }
          }

          if (result.source === "indian-mf") {
            const navData = result.data as { schemeCode: string; nav: number }[];
            for (const nav of navData) {
              const idx = updated.findIndex((h) => h.schemeCode === nav.schemeCode);
              if (idx !== -1) {
                updated[idx] = { ...updated[idx], currentPrice: nav.nav, lastPriceUpdate: now };
              }
            }
          }

          if (result.source === "indian-stocks") {
            const quotes = result.data as Record<string, { price: number }>;
            for (const [ticker, quote] of Object.entries(quotes)) {
              const idx = updated.findIndex((h) => h.ticker === ticker);
              if (idx !== -1) {
                updated[idx] = { ...updated[idx], currentPrice: quote.price, lastPriceUpdate: now };
              }
            }
          }

          if (result.source === "us-etfs") {
            const quotes = result.data as Record<string, { close: string }>;
            for (const [symbol, quote] of Object.entries(quotes)) {
              const idx = updated.findIndex((h) => h.ticker === symbol);
              if (idx !== -1) {
                updated[idx] = { ...updated[idx], currentPrice: parseFloat(quote.close), lastPriceUpdate: now };
              }
            }
          }

          if (result.source === "uae-stocks") {
            const quotes = result.data as Record<string, { close: string }>;
            for (const [symbol, quote] of Object.entries(quotes)) {
              const idx = updated.findIndex((h) => h.ticker === symbol);
              if (idx !== -1) {
                updated[idx] = { ...updated[idx], currentPrice: parseFloat(quote.close), lastPriceUpdate: now };
              }
            }
          }

          if (result.source === "crypto") {
            const prices = result.data as Record<string, { usd: number; aed: number }>;
            if (prices.bitcoin) {
              const idx = updated.findIndex((h) => h.ticker === "BTC");
              if (idx !== -1) {
                const btcPrice = updated[idx].currency === "AED" ? prices.bitcoin.aed : prices.bitcoin.usd;
                updated[idx] = { ...updated[idx], currentPrice: btcPrice, lastPriceUpdate: now };
              }
            }
          }
        }

        return updated;
      });
    } catch (error) {
      console.error("Price refresh error:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // ── CRUD ──
  const handleSaveHolding = (holding: Holding) => {
    if (editingHolding) {
      setHoldings((prev) => prev.map((h) => (h.id === holding.id ? holding : h)));
    } else {
      setHoldings((prev) => [{ ...holding, id: generateId() }, ...prev]);
    }
    setModalOpen(false);
    setEditingHolding(null);
  };

  const handleEdit = (holding: Holding) => {
    setEditingHolding(holding);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  };

  const handlePriceUpdate = (id: string, price: number) => {
    setHoldings((prev) =>
      prev.map((h) => (h.id === id ? { ...h, currentPrice: price } : h))
    );
  };

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Portfolio</h1>
          <p className="mt-1 text-sm text-text-muted">
            {lastRefresh ? `Last updated ${timeAgo(lastRefresh)}` : "Prices not yet fetched"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAmountsVisible(!isAmountsVisible)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-default bg-bg-card text-text-secondary transition-colors hover:bg-bg-card-hover"
            title={isAmountsVisible ? "Hide amounts" : "Show amounts"}
          >
            {isAmountsVisible ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
            )}
          </button>
          <button
            onClick={refreshPrices}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #8B5CF6, #3B82F6)" }}
          >
            <svg className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
            </svg>
            {isRefreshing ? "Refreshing..." : "Refresh Prices"}
          </button>
          <button
            onClick={() => { setEditingHolding(null); setModalOpen(true); }}
            className="flex items-center gap-2 rounded-xl border border-border-default bg-bg-card px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-card-hover"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Holding
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Portfolio Value"
          value={isAmountsVisible ? formatMoney(summary.totalValue, "AED") : "••••••"}
          subValue="Base currency: AED"
          accent="violet"
        />
        <SummaryCard
          label="Total Invested"
          value={isAmountsVisible ? formatMoney(summary.totalInvested, "AED") : "••••••"}
          subValue={`${holdings.length} holdings`}
          accent="blue"
        />
        <SummaryCard
          label="Unrealised P/L"
          value={isAmountsVisible ? formatMoney(summary.totalGainLoss, "AED") : `${summary.totalGainLossPct.toFixed(2)}%`}
          subValue={`${summary.totalGainLossPct >= 0 ? "+" : ""}${summary.totalGainLossPct.toFixed(2)}% overall`}
          accent={summary.totalGainLoss >= 0 ? "gain" : "loss"}
        />
        <SummaryCard
          label="INR → AED Rate"
          value={inrToAedRate.toFixed(5)}
          subValue="Auto-fetched via Frankfurter"
          accent="amber"
        />
      </div>

      {/* Allocation Charts */}
      <AllocationCharts holdings={computedHoldings} totalValue={summary.totalValue} />

      {/* Holdings Table */}
      <HoldingsTable
        holdings={computedHoldings}
        isAmountsVisible={isAmountsVisible}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPriceUpdate={handlePriceUpdate}
      />

      {/* Modal */}
      {modalOpen && (
        <HoldingModal
          holding={editingHolding}
          inrToAedRate={inrToAedRate}
          onSave={handleSaveHolding}
          onClose={() => { setModalOpen(false); setEditingHolding(null); }}
        />
      )}
    </div>
  );
}

// ── Summary Card Component ──
function SummaryCard({
  label,
  value,
  subValue,
  accent,
}: {
  label: string;
  value: string;
  subValue: string;
  accent: "violet" | "blue" | "gain" | "loss" | "amber";
}) {
  const accentColors = {
    violet: { bg: "rgba(139, 92, 246, 0.1)", border: "rgba(139, 92, 246, 0.2)", dot: "#8B5CF6" },
    blue: { bg: "rgba(59, 130, 246, 0.1)", border: "rgba(59, 130, 246, 0.2)", dot: "#3B82F6" },
    gain: { bg: "rgba(16, 185, 129, 0.1)", border: "rgba(16, 185, 129, 0.2)", dot: "#10B981" },
    loss: { bg: "rgba(244, 63, 94, 0.1)", border: "rgba(244, 63, 94, 0.2)", dot: "#F43F5E" },
    amber: { bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.2)", dot: "#F59E0B" },
  };
  const c = accentColors[accent];

  return (
    <div
      className="glass-card p-5 transition-all hover:scale-[1.02]"
      style={{ borderColor: c.border }}
    >
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full pulse-dot" style={{ backgroundColor: c.dot }} />
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-bold text-text-primary">{value}</p>
      <p className="mt-1 text-xs text-text-muted">{subValue}</p>
    </div>
  );
}
