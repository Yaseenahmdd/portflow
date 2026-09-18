import assert from "node:assert/strict";
import test from "node:test";
import type { Holding } from "../src/lib/constants.ts";
import { getCashBalances } from "../src/lib/cash-balances.ts";
import type { PortfolioTransaction } from "../src/lib/transactions.ts";

function transaction(
  id: string,
  type: PortfolioTransaction["type"],
  overrides: Partial<PortfolioTransaction> = {}
): PortfolioTransaction {
  return {
    id,
    type,
    date: "2026-01-01",
    platform: "IBKR",
    assetName: "Example",
    ticker: "EX",
    currency: "USD",
    notes: "",
    ...overrides,
  };
}

test("cash ledger ignores imported historical purchase funding", () => {
  const result = getCashBalances(
    [
      transaction("holding-import-abc", "buy", { quantity: 2, price: 100 }),
      transaction("dividend-1", "dividend", { amount: 5 }),
    ],
    [],
    0.044
  );

  assert.equal(result.accounts[0].balance, 5);
  assert.equal(result.excludedHistoricalBuys, 1);
});

test("accounts containing only imported purchases stay hidden", () => {
  const result = getCashBalances(
    [transaction("holding-import-abc", "buy", { quantity: 2, price: 100 })],
    [],
    0.044
  );

  assert.deepEqual(result.accounts, []);
  assert.equal(result.excludedHistoricalBuys, 1);
});

test("cash ledger applies trades, income, deposits, withdrawals, and fees", () => {
  const result = getCashBalances(
    [
      transaction("deposit-1", "deposit", { amount: 1000 }),
      transaction("buy-1", "buy", { quantity: 2, price: 100, fees: 2 }),
      transaction("sell-1", "sell", { quantity: 1, price: 120, fees: 1 }),
      transaction("dividend-1", "dividend", { amount: 5 }),
      transaction("fee-1", "fee", { amount: 2 }),
      transaction("withdrawal-1", "withdrawal", { amount: 100 }),
    ],
    [],
    0.044
  );

  assert.equal(result.accounts[0].balance, 820);
});

test("currency exchanges debit and credit separate currency accounts", () => {
  const result = getCashBalances(
    [
      transaction("deposit-1", "deposit", { amount: 100, currency: "USD" }),
      transaction("fx-1", "fx", {
        amount: 50,
        currency: "USD",
        targetCurrency: "AED",
        targetAmount: 183.625,
      }),
    ],
    [],
    0.044
  );

  assert.equal(result.accounts.find((account) => account.currency === "USD")?.balance, 50);
  assert.equal(result.accounts.find((account) => account.currency === "AED")?.balance, 183.625);
  assert.equal(result.totalCashAed, 367.25);
});

test("matching Cash holdings prevent derived balance double-counting", () => {
  const cashHolding = {
    assetClass: "Cash",
    platform: "IBKR",
    currency: "USD",
  } as Holding;
  const result = getCashBalances(
    [transaction("deposit-1", "deposit", { amount: 100 })],
    [cashHolding],
    0.044
  );

  assert.equal(result.accounts[0].includedInNetWorth, false);
  assert.equal(result.totalCashAed, 0);
});

test("negative cash accounts are surfaced", () => {
  const result = getCashBalances(
    [transaction("buy-1", "buy", { currency: "AED", quantity: 1, price: 100 })],
    [],
    0.044
  );

  assert.equal(result.accounts[0].balance, -100);
  assert.equal(result.negativeAccounts.length, 1);
});
