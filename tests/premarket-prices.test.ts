import assert from "node:assert/strict";
import test from "node:test";
import { selectYahooQuote } from "../src/lib/api/alphavantage.ts";

const preStart = Date.parse("2026-09-24T08:00:00Z") / 1000;
const preEnd = Date.parse("2026-09-24T13:30:00Z") / 1000;
const barTime = Date.parse("2026-09-24T12:05:00Z") / 1000;
const chart = {
  meta: {
    regularMarketPrice: 100,
    regularMarketTime: Date.parse("2026-09-23T20:00:00Z") / 1000,
    chartPreviousClose: 100,
    currentTradingPeriod: { pre: { start: preStart, end: preEnd } },
  },
  timestamp: [preStart - 60, barTime],
  indicators: { quote: [{ close: [99, 104] }] },
};

test("US premarket bar drives the quote and its change from the prior close", () => {
  const quote = selectYahooQuote(chart, "IBIT", barTime + 60);
  assert.equal(quote?.price, 104);
  assert.equal(quote?.previousClose, 100);
  assert.equal(quote?.changePercent, "4.00%");
  assert.equal(quote?.priceSession, "pre-market");
  assert.equal(quote?.priceAsOf, "2026-09-24T12:05:00.000Z");
});

test("premarket bars are ignored after the regular session begins", () => {
  const quote = selectYahooQuote(chart, "IBIT", preEnd);
  assert.equal(quote?.price, 100);
  assert.equal(quote?.priceSession, undefined);
});

test("without a premarket trade, the regular quote remains in use", () => {
  const quote = selectYahooQuote({ ...chart, timestamp: [preStart - 60], indicators: { quote: [{ close: [99] }] } }, "IBIT", barTime + 60);
  assert.equal(quote?.price, 100);
  assert.equal(quote?.priceSession, undefined);
});

test("Indian listings never use the US premarket window", () => {
  const quote = selectYahooQuote(chart, "NSE:HDFCAMC", barTime + 60);
  assert.equal(quote?.price, 100);
  assert.equal(quote?.priceSession, undefined);
});
