import assert from "node:assert/strict";
import test from "node:test";
import { CRYPTO_IDS } from "../src/lib/constants.ts";

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
