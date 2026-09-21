import assert from "node:assert/strict";
import test from "node:test";
import { CRYPTO_IDS } from "../src/lib/constants.ts";
import { selectPreviousUtcClose } from "../src/lib/api/coingecko.ts";

test("common crypto tickers have CoinGecko price identifiers", () => {
  assert.equal(CRYPTO_IDS.BTC, "bitcoin");
  assert.equal(CRYPTO_IDS.ETH, "ethereum");
  assert.equal(CRYPTO_IDS.SOL, "solana");
  assert.equal(CRYPTO_IDS.XRP, "ripple");
});

test("crypto price identifiers are unique", () => {
  const ids = Object.values(CRYPTO_IDS);
  assert.equal(new Set(ids).size, ids.length);
});

test("crypto day gain uses the price nearest to the fixed UTC day boundary", () => {
  const now = new Date("2026-09-20T12:00:00.000Z");

  assert.equal(
    selectPreviousUtcClose(
      [
        [Date.parse("2026-09-19T23:00:00.000Z"), 98],
        [Date.parse("2026-09-20T00:05:00.000Z"), 100],
        [Date.parse("2026-09-20T11:55:00.000Z"), 110],
      ],
      now
    ),
    100
  );
});

test("crypto day gain rejects stale historical baselines", () => {
  assert.equal(
    selectPreviousUtcClose(
      [[Date.parse("2026-09-19T12:00:00.000Z"), 100]],
      new Date("2026-09-20T12:00:00.000Z")
    ),
    undefined
  );
});
