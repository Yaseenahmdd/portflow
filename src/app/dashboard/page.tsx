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
  return `portflow-holdings-${userId}`;
}

function getRateStorageKey(userId: string) {
  return `portflow-inr-aed-rate-${userId}`;
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
      } catch {
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
          if (!result.success || !result.data) continue;

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

  useEffect(() => {
    function handleRefresh() {
      refreshPrices();
    }

    window.addEventListener("portflow:refresh-prices", handleRefresh);
    return () => window.removeEventListener("portflow:refresh-prices", handleRefresh);
  }, [refreshPrices]);

  const handleSaveHolding = (holding: Holding) => {
    if (editingHolding) {
      setHoldings((current) => current.map((item) => (item.id === holding.id ? holding : item)));
    } else {
      setHoldings((current) => [{ ...holding, id: generateId() }, ...current]);
    }

    setModalOpen(false);
    setEditingHolding(null);
  };

  const handleEdit = (holding: Holding) => {
    setEditingHolding(holding);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setHoldings((current) => current.filter((holding) => holding.id !== id));
  };

  const handlePriceUpdate = (id: string, price: number) => {
    setHoldings((current) =>
      current.map((holding) => (holding.id === id ? { ...holding, currentPrice: price } : holding))
    );
  };

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-56" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="skeleton h-72 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-[28rem] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Portfolio Value"
          value={isAmountsVisible ? formatMoney(summary.totalValue, "AED") : `${summary.totalGainLossPct.toFixed(2)}%`}
          subValue={isAmountsVisible ? "Base currency: AED" : "Overall portfolio return"}
        />
        <SummaryCard
          label="Total Invested"
          value={isAmountsVisible ? formatMoney(summary.totalInvested, "AED") : `${summary.totalGainLossPct.toFixed(2)}%`}
          subValue={isAmountsVisible ? `${holdings.length} holdings` : "Overall return"}
        />
        <SummaryCard
          label="Total Gain / Loss"
          value={isAmountsVisible ? formatMoney(summary.totalGainLoss, "AED") : `${summary.totalGainLossPct.toFixed(2)}%`}
          subValue={`${summary.totalGainLossPct.toFixed(2)}% overall`}
          positive={summary.totalGainLoss >= 0}
        />
        <SummaryCard
          label="INR to AED"
          value={inrToAedRate.toFixed(5)}
          subValue="FX rate in use"
        />
      </section>

      <AllocationCharts holdings={computedHoldings} totalValue={summary.totalValue} />

      <HoldingsTable
        holdings={computedHoldings}
        isAmountsVisible={isAmountsVisible}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPriceUpdate={handlePriceUpdate}
        onAddHolding={() => {
          setEditingHolding(null);
          setModalOpen(true);
        }}
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
  label,
  value,
  subValue,
  positive,
}: {
  label: string;
  value: string;
  subValue?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${positive === undefined ? "text-slate-900" : positive ? "text-green-600" : "text-red-600"}`}>
        {value}
      </p>
      {subValue ? <p className="mt-1 text-sm text-slate-500">{subValue}</p> : null}
    </div>
  );
}
