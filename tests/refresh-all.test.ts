import assert from "node:assert/strict";
import test from "node:test";
import type { Holding } from "../src/lib/constants.ts";
import { applyRefreshResults } from "../src/lib/dashboard/refresh.ts";
import { fetchAllPriceResults } from "../src/lib/prices/refresh-all.ts";

function createHolding(overrides: Partial<Holding>): Holding {
  return {
    id: crypto.randomUUID(),
    platform: "IG",
    assetName: "Test holding",
    ticker: "",
    assetClass: "ETFs",
    sector: "",
    geography: "Others",
    risk: "Medium",
    quantity: 1,
    avgBuyPrice: 1,
    currentPrice: 1,
    currency: "USD",
    notes: "",
    priceSource: "alphavantage",
    ...overrides,
  };
}

function mockYahoo(t: test.TestContext, prices: Record<string, number>) {
  const requested: string[] = [];

  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const symbol = decodeURIComponent(new URL(String(input)).pathname.split("/").pop() ?? "");
    requested.push(symbol);

    return new Response(
      JSON.stringify({
        chart: {
          result: [
            {
              meta: {
                currency: "USD",
                regularMarketPrice: prices[symbol] ?? 1,
                chartPreviousClose: prices[symbol] ?? 1,
              },
            },
          ],
        },
      })
    );
  });

  return requested;
}

test("Yahoo-priced funds outside the US are fetched and priced", async (t) => {
  const requested = mockYahoo(t, { IBIT: 43.03, IAU: 77, ACWI: 130 });
  const holdings = [
    createHolding({ ticker: "IBIT", assetClass: "Crypto", currentPrice: 46.06 }),
    createHolding({ ticker: "IAU", assetClass: "Gold", currentPrice: 75.66 }),
    createHolding({ ticker: "ACWI", geography: "Global", currentPrice: 120 }),
  ];

  const results = await fetchAllPriceResults(holdings, "live");
  const refreshed = applyRefreshResults(holdings, results);

  assert.deepEqual([...requested].sort(), ["ACWI", "IAU", "IBIT"]);
  assert.deepEqual(refreshed.holdings.map((holding) => holding.currentPrice), [43.03, 77, 130]);
});

test("manually priced holdings are left alone", async (t) => {
  const requested = mockYahoo(t, {});
  const holdings = [createHolding({ ticker: "PRIVATE", priceSource: "manual", currentPrice: 50 })];

  const results = await fetchAllPriceResults(holdings, "live");
  const refreshed = applyRefreshResults(holdings, results);

  assert.deepEqual(requested, []);
  assert.equal(refreshed.holdings[0].currentPrice, 50);
});

test("Indian tickers are only fetched with their NSE symbol", async (t) => {
  const requested = mockYahoo(t, { "HDFCAMC.NS": 5000 });
  const holdings = [createHolding({ ticker: "HDFCAMC", geography: "India", currency: "INR" })];

  const results = await fetchAllPriceResults(holdings, "live");
  const refreshed = applyRefreshResults(holdings, results);

  assert.deepEqual(requested, ["HDFCAMC.NS"]);
  assert.equal(refreshed.holdings[0].currentPrice, 5000);
});
