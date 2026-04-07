"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { DEFAULT_HOLDINGS, type Holding } from "@/lib/constants";
import { computeHolding, formatMoney, generateId, timeAgo } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { fetchRemoteHoldings, replaceRemoteHoldings } from "@/lib/holdings-store";
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

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const uid = user?.id || "default";
      setUserId(uid);

      const storageKey = getStorageKey(uid);
      const rateKey = getRateStorageKey(uid);

      const saved = localStorage.getItem(storageKey);
      const savedRate = localStorage.getItem(rateKey);

      try {
        const remoteHoldings = await fetchRemoteHoldings(supabase, uid);

        if (remoteHoldings && remoteHoldings.length > 0) {
          setHoldings(remoteHoldings);
          localStorage.setItem(storageKey, JSON.stringify(remoteHoldings));
        } else if (saved) {
          try {
            const parsed = JSON.parse(saved) as Holding[];
            setHoldings(parsed);
            await replaceRemoteHoldings(supabase, uid, parsed);
          } catch {
            setHoldings(DEFAULT_HOLDINGS);
          }
        } else {
          setHoldings(DEFAULT_HOLDINGS);
        }
      } catch (error) {
        console.error("Failed to load holdings from Supabase:", error);
        if (saved) {
          try {
            setHoldings(JSON.parse(saved));
          } catch {
            setHoldings(DEFAULT_HOLDINGS);
          }
        } else {
          setHoldings(DEFAULT_HOLDINGS);
        }
      }

      if (savedRate) {
        setInrToAedRate(Number(savedRate));
      }

      setMounted(true);
    }

    init();
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(getStorageKey(userId), JSON.stringify(holdings));

      const timeoutId = window.setTimeout(async () => {
        try {
          const supabase = createClient();
          await replaceRemoteHoldings(supabase, userId, holdings);
        } catch (error) {
          console.error("Failed to sync holdings to Supabase:", error);
        }
      }, 400);

      return () => window.clearTimeout(timeoutId);
    }
  }, [holdings, mounted, userId]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(getRateStorageKey(userId), String(inrToAedRate));
    }
  }, [inrToAedRate, mounted, userId]);

  const computedHoldings = useMemo(
    () => holdings.map((holding) => computeHolding(holding, inrToAedRate)),
    [holdings, inrToAedRate]
  );

  const summary = useMemo(() => {
    const totalInvested = computedHoldings.reduce((sum, holding) => sum + holding.investedAmountAed, 0);
    const totalValue = computedHoldings.reduce((sum, holding) => sum + holding.currentValueAed, 0);
    const totalGainLoss = computedHoldings.reduce((sum, holding) => sum + holding.gainLossAed, 0);
    const totalGainLossPct = totalInvested ? (totalGainLoss / totalInvested) * 100 : 0;

    return { totalInvested, totalValue, totalGainLoss, totalGainLossPct };
  }, [computedHoldings]);

  const refreshPrices = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const response = await fetch("/api/prices/refresh-all");
      const data = await response.json();
      if (!data.success) {
        throw new Error("Refresh failed");
      }

      const now = new Date().toISOString();
      setLastRefresh(now);

      setHoldings((previous) => {
        const updated = [...previous];

        for (const result of data.results) {
          if (!result.success || !result.data) {
            continue;
          }

          if (result.source === "currency") {
            const rates = result.data;
            if (rates?.rates?.INR) {
              setInrToAedRate(1 / rates.rates.INR);
            }
          }

          if (result.source === "indian-mf") {
            const navData = result.data as { schemeCode: string; nav: number }[];
            for (const nav of navData) {
              const index = updated.findIndex((holding) => holding.schemeCode === nav.schemeCode);
              if (index !== -1) {
                updated[index] = { ...updated[index], currentPrice: nav.nav, lastPriceUpdate: now };
              }
            }
          }

          if (result.source === "indian-stocks") {
            const quotes = result.data as Record<string, { price: number }>;
            for (const [ticker, quote] of Object.entries(quotes)) {
              const index = updated.findIndex((holding) => holding.ticker === ticker);
              if (index !== -1) {
                updated[index] = { ...updated[index], currentPrice: quote.price, lastPriceUpdate: now };
              }
            }
          }

          if (result.source === "us-etfs" || result.source === "uae-stocks") {
            const quotes = result.data as Record<string, { close: string }>;
            for (const [symbol, quote] of Object.entries(quotes)) {
              const index = updated.findIndex((holding) => holding.ticker === symbol);
              if (index !== -1) {
                updated[index] = { ...updated[index], currentPrice: parseFloat(quote.close), lastPriceUpdate: now };
              }
            }
          }

          if (result.source === "crypto") {
            const prices = result.data as Record<string, { usd: number; aed: number }>;
            if (prices.bitcoin) {
              const index = updated.findIndex((holding) => holding.ticker === "BTC");
              if (index !== -1) {
                const btcPrice = updated[index].currency === "AED" ? prices.bitcoin.aed : prices.bitcoin.usd;
                updated[index] = { ...updated[index], currentPrice: btcPrice, lastPriceUpdate: now };
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

  const handleSaveHolding = (holding: Holding) => {
    if (editingHolding) {
      setHoldings((previous) => previous.map((item) => (item.id === holding.id ? holding : item)));
    } else {
      setHoldings((previous) => [{ ...holding, id: generateId() }, ...previous]);
    }

    setModalOpen(false);
    setEditingHolding(null);
  };

  const handleEdit = (holding: Holding) => {
    setEditingHolding(holding);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setHoldings((previous) => previous.filter((holding) => holding.id !== id));
  };

  const handlePriceUpdate = (id: string, price: number) => {
    setHoldings((previous) =>
      previous.map((holding) => (holding.id === id ? { ...holding, currentPrice: price } : holding))
    );
  };

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-56" />
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="skeleton h-44 rounded-[1.75rem] lg:col-span-7" />
          <div className="skeleton h-44 rounded-[1.75rem] lg:col-span-5" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="skeleton h-36 rounded-[1.5rem]" />
          ))}
        </div>
        <div className="skeleton h-[28rem] rounded-[1.75rem]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="glass-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Portfolio</h1>
            <p className="mt-2 text-sm text-text-secondary">
              {lastRefresh ? `Last refresh ${timeAgo(lastRefresh)}` : "No market refresh yet"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={refreshPrices}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-full bg-accent-violet px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <svg className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
              </svg>
              {isRefreshing ? "Refreshing" : "Refresh"}
            </button>

            <button
              onClick={() => {
                setEditingHolding(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-5 py-3 text-sm font-medium text-text-primary transition hover:bg-[#fff1ef]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add holding
            </button>

            <button
              onClick={() => setIsAmountsVisible((current) => !current)}
              className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-5 py-3 text-sm font-medium text-text-secondary transition hover:bg-[#fff1ef] hover:text-text-primary"
              title={isAmountsVisible ? "Hide amounts" : "Show amounts"}
            >
              {isAmountsVisible ? "Hide amounts" : "Show amounts"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          eyebrow="Portfolio value"
          value={isAmountsVisible ? formatMoney(summary.totalValue, "AED") : "••••••"}
          subValue="AED"
          tone="accent"
        />
        <SummaryCard
          eyebrow="Invested capital"
          value={isAmountsVisible ? formatMoney(summary.totalInvested, "AED") : "••••••"}
          subValue={`${holdings.length} holdings`}
          tone="neutral"
        />
        <SummaryCard
          eyebrow="Unrealised return"
          value={isAmountsVisible ? formatMoney(summary.totalGainLoss, "AED") : `${summary.totalGainLossPct.toFixed(2)}%`}
          subValue={`${summary.totalGainLossPct >= 0 ? "+" : ""}${summary.totalGainLossPct.toFixed(2)}% overall`}
          tone={summary.totalGainLoss >= 0 ? "gain" : "loss"}
        />
        <SummaryCard
          eyebrow="INR to AED"
          value={inrToAedRate.toFixed(5)}
          subValue="FX"
          tone="amber"
        />
      </section>

      <AllocationCharts holdings={computedHoldings} totalValue={summary.totalValue} />

      <HoldingsTable
        holdings={computedHoldings}
        isAmountsVisible={isAmountsVisible}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPriceUpdate={handlePriceUpdate}
      />

      {modalOpen && (
        <HoldingModal
          holding={editingHolding}
          inrToAedRate={inrToAedRate}
          onSave={handleSaveHolding}
          onClose={() => {
            setModalOpen(false);
            setEditingHolding(null);
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({
  eyebrow,
  value,
  subValue,
  tone,
}: {
  eyebrow: string;
  value: string;
  subValue: string;
  tone: "accent" | "neutral" | "gain" | "loss" | "amber";
}) {
  const toneClasses = {
    accent: "border-black/8 bg-white",
    neutral: "border-black/8 bg-white",
    gain: "border-black/8 bg-white",
    loss: "border-black/8 bg-white",
    amber: "border-black/8 bg-white",
  }[tone];

  const valueTone = {
    accent: "text-text-primary",
    neutral: "text-text-primary",
    gain: "text-accent-gain",
    loss: "text-accent-loss",
    amber: "text-text-primary",
  }[tone];

  return (
    <div className={`glass-card border ${toneClasses} p-5`}>
      <div className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-text-muted">{eyebrow}</div>
      <div className={`mt-4 text-[1.9rem] font-semibold tracking-tight ${valueTone}`}>{value}</div>
      <div className="mt-2 text-sm text-text-secondary">{subValue}</div>
    </div>
  );
}
