"use client";

import { useEffect, useState } from "react";
import { type Holding } from "@/lib/constants";
import { DEFAULT_INR_TO_AED_RATE, getRateStorageKey } from "@/lib/dashboard/persistence";
import { buildBackfilledSnapshots } from "@/lib/history-backfill";
import { normalizeHoldings } from "@/lib/holdings-normalize";
import { replaceRemoteHoldings } from "@/lib/holdings-store";
import { fetchPortfolioSnapshots, replacePortfolioSnapshots } from "@/lib/portfolio-snapshots";
import { createClient } from "@/lib/supabase/client";

interface ApiStatus {
  name: string;
  description: string;
  status: "ok" | "missing" | "unknown";
  keyRequired: boolean;
  envVar?: string;
}

const apiStatuses: ApiStatus[] = [
  { name: "MFAPI.in", description: "Indian mutual fund NAV data", status: "ok", keyRequired: false },
  { name: "CoinGecko", description: "Cryptocurrency prices", status: "ok", keyRequired: false },
  { name: "Frankfurter", description: "Currency exchange rates", status: "ok", keyRequired: false },
  { name: "Binance WebSocket", description: "Real-time BTC price stream", status: "ok", keyRequired: false },
  { name: "Yahoo Finance (India)", description: "Indian stocks and ETFs on NSE", status: "ok", keyRequired: false },
  { name: "Yahoo Finance (US ETFs)", description: "US stocks and ETFs", status: "ok", keyRequired: false },
  { name: "Twelve Data", description: "Optional fallback for UAE stocks on DFM", status: "unknown", keyRequired: true, envVar: "TWELVE_DATA_API_KEY" },
];

export default function SettingsPage() {
  const [userId, setUserId] = useState<string>("default");
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [rebuildingHistory, setRebuildingHistory] = useState(false);

  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id || "default");
    }

    getUser();
  }, []);

  const storageKey = `portflow-holdings-${userId}`;
  const rateStorageKey = getRateStorageKey(userId);

  const testEndpoint = async (path: string) => {
    try {
      const response = await fetch(path);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        return "Unexpected response";
      }

      const data = await response.json();
      return data.success ? "Healthy" : data.error || "Error";
    } catch {
      return "Connection failed";
    }
  };

  const runTests = async () => {
    setTesting(true);

    const endpoints = [
      { name: "MFAPI.in", path: "/api/prices/indian-mf" },
      { name: "Yahoo Finance (India)", path: "/api/prices/indian-stocks" },
      { name: "Yahoo Finance (US ETFs)", path: "/api/prices/us-etfs" },
      { name: "CoinGecko", path: "/api/prices/crypto" },
      { name: "Frankfurter", path: "/api/prices/currency" },
    ];

    const results: Record<string, string> = {};

    for (const endpoint of endpoints) {
      results[endpoint.name] = "Checking";
      setTestResults({ ...results });
      results[endpoint.name] = await testEndpoint(endpoint.path);
      setTestResults({ ...results });
    }

    setTesting(false);
  };

  const rebuildHistory = async () => {
    setRebuildingHistory(true);

    try {
      const rawHoldings = localStorage.getItem(storageKey);
      const parsed = rawHoldings ? (JSON.parse(rawHoldings) as Holding[]) : [];
      const { normalized } = normalizeHoldings(parsed);
      const storedRate = Number(localStorage.getItem(rateStorageKey));
      const inrToAedRate =
        Number.isFinite(storedRate) && storedRate > 0 ? storedRate : DEFAULT_INR_TO_AED_RATE;

      const existingSnapshots = await fetchPortfolioSnapshots(userId);
      const rebuiltSnapshots = buildBackfilledSnapshots(normalized, existingSnapshots, inrToAedRate);

      await replacePortfolioSnapshots(userId, rebuiltSnapshots);
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to rebuild history";
      alert(message);
    } finally {
      setRebuildingHistory(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="glass-card p-6 sm:p-7">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.04em] text-text-primary">Settings</h1>
      </section>

      <section className="glass-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border-default px-6 py-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-[-0.03em] text-text-primary">Service health</h2>
          </div>
          <button
            onClick={runTests}
            disabled={testing}
            className="rounded-full bg-accent-violet px-5 py-3 text-sm font-semibold text-bg-primary transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {testing ? "Running checks" : "Run API checks"}
          </button>
        </div>

        <div className="divide-y divide-border-default/60">
          {apiStatuses.map((api) => (
            <div key={api.name} className="grid gap-4 px-6 py-5 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-text-primary">{api.name}</h3>
                  <StatusPill>{api.keyRequired ? "Key required" : "Keyless"}</StatusPill>
                </div>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{api.description}</p>
                {api.envVar && <p className="mt-2 text-xs font-mono text-text-muted">{api.envVar}</p>}
              </div>
              <div className="rounded-[1.2rem] border border-border-default bg-bg-elevated px-4 py-3 text-sm text-text-secondary">
                {testResults[api.name] || (api.status === "ok" ? "Ready" : "Not checked")}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="glass-card p-6">
          <h2 className="font-display text-xl font-semibold tracking-[-0.03em] text-text-primary">Data management</h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <ActionButton
              label="Export holdings"
              onClick={() => {
                const data = localStorage.getItem(storageKey);
                if (!data) return;

                const blob = new Blob([data], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `portflow-holdings-${new Date().toISOString().slice(0, 10)}.json`;
                anchor.click();
                URL.revokeObjectURL(url);
              }}
            />

            <ActionButton
              label="Import holdings"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".json";
                input.onchange = async (event) => {
                  const file = (event.target as HTMLInputElement).files?.[0];
                  if (!file) return;

                  const text = await file.text();
                  try {
                    const parsed = JSON.parse(text);
                    if (!Array.isArray(parsed)) {
                      throw new Error("Expected an array of holdings");
                    }

                    const { normalized } = normalizeHoldings(parsed as Holding[]);
                    const supabase = createClient();
                    await replaceRemoteHoldings(supabase, userId, normalized);
                    localStorage.setItem(storageKey, JSON.stringify(normalized));
                    window.location.reload();
                  } catch (error) {
                    if (error instanceof SyntaxError) {
                      alert("Invalid JSON file");
                      return;
                    }

                    const message = error instanceof Error ? error.message : "Failed to import holdings";
                    alert(message);
                  }
                };
                input.click();
              }}
            />

            <ActionButton
              label="Reset storage"
              destructive
              onClick={async () => {
                if (confirm("Reset all holdings to defaults? This cannot be undone.")) {
                  const supabase = createClient();
                  await replaceRemoteHoldings(supabase, userId, []);
                  localStorage.removeItem(storageKey);
                  window.location.reload();
                }
              }}
            />
          </div>

          <div className="mt-5 rounded-[1.2rem] border border-border-default bg-bg-elevated p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Historical snapshots</h3>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  Rebuild missing history from purchase dates. Backfilled dates assume portfolio value matched invested cost on those earlier entries.
                </p>
              </div>
              <button
                onClick={rebuildHistory}
                disabled={rebuildingHistory}
                className="rounded-full border border-border-default bg-bg-card px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-bg-card-hover disabled:cursor-not-allowed disabled:opacity-55"
              >
                {rebuildingHistory ? "Rebuilding history" : "Rebuild history"}
              </button>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="font-display text-xl font-semibold tracking-[-0.03em] text-text-primary">Setup</h2>
          <div className="mt-5 space-y-5 text-sm leading-6 text-slate-600">
            <SetupStep
              title="Supabase"
              body="Add the project URL and anon key to .env.local, then run the holdings migration."
            />
            <SetupStep
              title="Twelve Data"
              body="Add TWELVE_DATA_API_KEY for US ETFs and UAE equities."
            />
            <SetupStep
              title="Deploy"
              body="Mirror the same environment variables in Vercel."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusPill({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-border-default bg-bg-card px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-text-secondary">
      {children}
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  destructive,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[1.2rem] border px-4 py-4 text-left text-sm font-medium transition ${
        destructive
          ? "border-accent-loss/20 bg-accent-loss-bg text-accent-loss hover:brightness-105"
          : "border-border-default bg-bg-card text-text-primary hover:bg-bg-elevated"
      }`}
    >
      {label}
    </button>
  );
}

function SetupStep({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.2rem] border border-border-default bg-bg-elevated p-4">
      <h3 className="font-semibold text-text-primary">{title}</h3>
      <p className="mt-1.5 text-text-secondary">{body}</p>
    </div>
  );
}
