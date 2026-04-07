"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface ApiStatus {
  name: string;
  description: string;
  status: "ok" | "missing" | "unknown";
  keyRequired: boolean;
  envVar?: string;
}

export default function SettingsPage() {
  const [userId, setUserId] = useState<string>("default");

  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || "default");
    }
    getUser();
  }, []);

  const storageKey = `assetviz-holdings-${userId}`;

  const [apiStatuses, setApiStatuses] = useState<ApiStatus[]>([
    { name: "MFAPI.in", description: "Indian mutual fund NAV data", status: "ok", keyRequired: false },
    { name: "CoinGecko", description: "Cryptocurrency prices", status: "ok", keyRequired: false },
    { name: "Frankfurter", description: "Currency exchange rates", status: "ok", keyRequired: false },
    { name: "Binance WebSocket", description: "Real-time BTC price stream", status: "ok", keyRequired: false },
    { name: "Yahoo Finance", description: "Indian stocks/ETFs (NSE)", status: "ok", keyRequired: false },
    { name: "Twelve Data", description: "US ETFs + UAE stocks (DFM)", status: "unknown", keyRequired: true, envVar: "TWELVE_DATA_API_KEY" },
  ]);

  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);

  const testEndpoint = async (name: string, path: string) => {
    try {
      const res = await fetch(path);
      const data = await res.json();
      return data.success ? "✅ Working" : `❌ Error: ${data.error || "Unknown"}`;
    } catch {
      return "❌ Failed to connect";
    }
  };

  const runTests = async () => {
    setTesting(true);
    const endpoints = [
      { name: "MFAPI.in", path: "/api/prices/indian-mf" },
      { name: "Yahoo Finance", path: "/api/prices/indian-stocks" },
      { name: "Twelve Data", path: "/api/prices/us-etfs" },
      { name: "CoinGecko", path: "/api/prices/crypto" },
      { name: "Frankfurter", path: "/api/prices/currency" },
    ];

    const results: Record<string, string> = {};
    for (const ep of endpoints) {
      results[ep.name] = "⏳ Testing...";
      setTestResults({ ...results });
      results[ep.name] = await testEndpoint(ep.name, ep.path);
      setTestResults({ ...results });
    }
    setTesting(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-muted">
          API status, configuration, and data management.
        </p>
      </div>

      {/* API Status */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border-subtle p-5">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">API Status</h2>
            <p className="mt-1 text-sm text-text-muted">
              Check which price data sources are configured and working.
            </p>
          </div>
          <button
            onClick={runTests}
            disabled={testing}
            className="rounded-xl px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #8B5CF6, #3B82F6)" }}
          >
            {testing ? "Testing..." : "Test All APIs"}
          </button>
        </div>
        <div className="divide-y divide-border-subtle">
          {apiStatuses.map((api) => (
            <div key={api.name} className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{api.name}</span>
                  {!api.keyRequired && (
                    <span className="rounded-md bg-accent-gain-bg px-2 py-0.5 text-xs font-medium text-accent-gain">
                      No Key
                    </span>
                  )}
                  {api.keyRequired && (
                    <span className="rounded-md bg-accent-amber px-2 py-0.5 text-xs font-medium text-bg-primary" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#F59E0B" }}>
                      Key Required
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-text-muted">{api.description}</p>
                {api.envVar && (
                  <p className="mt-0.5 font-mono text-xs text-text-muted">
                    Env: <code className="text-accent-violet">{api.envVar}</code>
                  </p>
                )}
              </div>
              <div className="text-sm">
                {testResults[api.name] || (api.keyRequired ? "Not tested" : "Ready")}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Management */}
      <div className="glass-card p-5">
        <h2 className="text-lg font-semibold text-text-primary">Data Management</h2>
        <p className="mt-1 text-sm text-text-muted">
          Your holdings are stored in your browser&apos;s localStorage, scoped to your account. Use these tools to manage your data.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => {
              const data = localStorage.getItem(storageKey);
              if (data) {
                const blob = new Blob([data], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `assetviz-holdings-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }
            }}
            className="rounded-xl border border-border-default bg-bg-card px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-card-hover"
          >
            Export Holdings (JSON)
          </button>
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json";
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  const text = await file.text();
                  try {
                    JSON.parse(text); // validate
                    localStorage.setItem(storageKey, text);
                    window.location.reload();
                  } catch {
                    alert("Invalid JSON file");
                  }
                }
              };
              input.click();
            }}
            className="rounded-xl border border-border-default bg-bg-card px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-card-hover"
          >
            Import Holdings (JSON)
          </button>
          <button
            onClick={() => {
              if (confirm("Reset all holdings to defaults? This cannot be undone.")) {
                localStorage.removeItem(storageKey);
                window.location.reload();
              }
            }}
            className="rounded-xl border border-accent-loss/30 px-4 py-2.5 text-sm font-medium text-accent-loss transition-colors hover:bg-accent-loss-bg"
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Setup Guide */}
      <div className="glass-card p-5">
        <h2 className="text-lg font-semibold text-text-primary">Setup Guide</h2>
        <div className="mt-4 space-y-4 text-sm text-text-secondary">
          <div>
            <h3 className="font-medium text-text-primary">1. Create a Supabase project</h3>
            <p>Sign up at <a href="https://supabase.com" target="_blank" className="text-accent-violet hover:underline">supabase.com</a> and create a new project. Copy your project URL and anon key into <code className="text-accent-violet">.env.local</code>.</p>
          </div>
          <div>
            <h3 className="font-medium text-text-primary">2. Get a Twelve Data API key (free)</h3>
            <p>Sign up at <a href="https://twelvedata.com/pricing" target="_blank" className="text-accent-violet hover:underline">twelvedata.com</a> — the free tier gives you 800 requests/day. Add the key to <code className="text-accent-violet">.env.local</code>.</p>
          </div>
          <div>
            <h3 className="font-medium text-text-primary">3. Get an Alpha Vantage API key (free)</h3>
            <p>Sign up at <a href="https://www.alphavantage.co/support/#api-key" target="_blank" className="text-accent-violet hover:underline">alphavantage.co</a> — the free tier gives 25 requests/day. Add the key to <code className="text-accent-violet">.env.local</code>.</p>
          </div>
          <div>
            <h3 className="font-medium text-text-primary">4. Deploy to Vercel</h3>
            <p>Push to GitHub and import the repo at <a href="https://vercel.com/new" target="_blank" className="text-accent-violet hover:underline">vercel.com/new</a>. Add your environment variables in the Vercel dashboard.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
