import assert from "node:assert/strict";
import test from "node:test";
import { parseHoldingPurchases } from "../src/lib/safe-json.ts";

test("parseHoldingPurchases returns purchases for valid arrays", () => {
  const purchases = parseHoldingPurchases('[{"quantity":2,"price":10,"date":"2026-05-24","fxRate":0.044}]');

  assert.deepEqual(purchases, [
    {
      quantity: 2,
      price: 10,
      date: "2026-05-24",
      fxRate: 0.044,
    },
  ]);
});

test("parseHoldingPurchases ignores malformed purchase payloads", () => {
  assert.equal(parseHoldingPurchases("{not-json"), undefined);
  assert.equal(parseHoldingPurchases('{"quantity":2}'), undefined);
  assert.equal(parseHoldingPurchases(null), undefined);
});
