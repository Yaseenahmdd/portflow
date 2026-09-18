"use client";

import { useEffect, useState } from "react";
import { CURRENCY_OPTIONS, type Currency, type Holding } from "@/lib/constants";
import { success as hapticSuccess } from "@/lib/haptics";
import {
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABELS,
  transactionFromHolding,
  validateTransaction,
  type PortfolioTransaction,
  type TransactionType,
} from "@/lib/transactions";

interface TransactionModalProps {
  transaction: PortfolioTransaction | null;
  holdings: Holding[];
  holdingsConnected?: boolean;
  onSave: (transaction: PortfolioTransaction) => string | null | undefined;
  onClose: () => void;
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function emptyTransaction(): PortfolioTransaction {
  return {
    id: "",
    type: "buy",
    date: todayDateKey(),
    platform: "",
    assetName: "",
    ticker: "",
    currency: "AED",
    quantity: undefined,
    price: undefined,
    amount: undefined,
    fees: undefined,
    notes: "",
  };
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function TransactionModal({
  transaction,
  holdings,
  holdingsConnected = false,
  onSave,
  onClose,
}: TransactionModalProps) {
  const [form, setForm] = useState<PortfolioTransaction>(() => transaction || emptyTransaction());
  const [error, setError] = useState<string | null>(null);
  const isAssetTransaction = ["buy", "sell", "dividend", "split"].includes(form.type);
  const isTrade = form.type === "buy" || form.type === "sell";
  const isCashAmount = ["dividend", "deposit", "withdrawal", "fee"].includes(form.type);
  const requiresLinkedHolding = holdingsConnected && ["buy", "sell", "split"].includes(form.type);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function update(patch: Partial<PortfolioTransaction>) {
    setForm((current) => ({ ...current, ...patch }));
    setError(null);
  }

  function selectHolding(holdingId: string) {
    const holding = holdings.find((item) => item.id === holdingId);
    if (!holding) {
      update({ holdingId: undefined, assetName: "", ticker: "" });
      return;
    }
    setForm((current) => transactionFromHolding(current, holding));
    setError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validationError = validateTransaction(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    const saveError = onSave(form);
    if (saveError) {
      setError(saveError);
      return;
    }
    hapticSuccess();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/20 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="my-6 max-h-[calc(100dvh-3rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl ring-1 ring-slate-200 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Ledger</div>
              <h2 className="mt-2 text-xl font-semibold text-text-primary">
                {transaction ? "Edit transaction" : "Add transaction"}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {holdingsConnected
                  ? "Linked buys, sells, and splits automatically update Holdings."
                  : "This records activity without changing your holdings yet."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border-default text-text-muted hover:bg-bg-elevated"
              aria-label="Close transaction form"
            >
              ×
            </button>
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <select
                value={form.type}
                onChange={(event) => update({ type: event.target.value as TransactionType })}
                className={inputClass}
              >
                {TRANSACTION_TYPES.map((type) => (
                  <option key={type} value={type}>{TRANSACTION_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={form.date}
                onChange={(event) => update({ date: event.target.value })}
                className={inputClass}
                required
              />
            </Field>

            {isAssetTransaction ? (
              <Field label="Linked holding">
                <select
                  value={form.holdingId || ""}
                  onChange={(event) => selectHolding(event.target.value)}
                  className={inputClass}
                >
                  <option value="" disabled={requiresLinkedHolding}>
                    {requiresLinkedHolding ? "Choose a holding" : "Manual asset"}
                  </option>
                  {holdings.map((holding) => (
                    <option key={holding.id} value={holding.id}>
                      {holding.assetName}{holding.ticker ? ` (${holding.ticker})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <Field label="Platform / account">
              <input
                value={form.platform}
                onChange={(event) => update({ platform: event.target.value })}
                className={inputClass}
                placeholder="IBKR, Groww, bank account"
                required
              />
            </Field>

            {isAssetTransaction && !form.holdingId ? (
              <>
                <Field label="Asset name">
                  <input
                    value={form.assetName}
                    onChange={(event) => update({ assetName: event.target.value })}
                    className={inputClass}
                    placeholder="Apple"
                  />
                </Field>
                <Field label="Ticker">
                  <input
                    value={form.ticker}
                    onChange={(event) => update({ ticker: event.target.value })}
                    className={inputClass}
                    placeholder="AAPL"
                  />
                </Field>
              </>
            ) : null}

            <Field label={form.type === "fx" ? "From currency" : "Currency"}>
              <select
                value={form.currency}
                onChange={(event) => update({ currency: event.target.value as Currency })}
                className={inputClass}
              >
                {CURRENCY_OPTIONS.map((currency) => <option key={currency}>{currency}</option>)}
              </select>
            </Field>

            {isTrade ? (
              <>
                <NumberField
                  label="Quantity"
                  value={form.quantity}
                  onChange={(quantity) => update({ quantity })}
                />
                <NumberField
                  label="Unit price"
                  value={form.price}
                  onChange={(price) => update({ price })}
                />
                <NumberField
                  label="Fees"
                  value={form.fees}
                  onChange={(fees) => update({ fees })}
                />
              </>
            ) : null}

            {isCashAmount || form.type === "fx" ? (
              <NumberField
                label={form.type === "fx" ? "Amount exchanged" : "Amount"}
                value={form.amount}
                onChange={(amount) => update({ amount })}
              />
            ) : null}

            {form.type === "split" ? (
              <NumberField
                label="New shares per old share"
                value={form.splitRatio}
                onChange={(splitRatio) => update({ splitRatio })}
                placeholder="e.g. 4 for a 4-for-1 split"
              />
            ) : null}

            {form.type === "fx" ? (
              <>
                <Field label="To currency">
                  <select
                    value={form.targetCurrency || ""}
                    onChange={(event) => update({ targetCurrency: event.target.value as Currency })}
                    className={inputClass}
                  >
                    <option value="">Choose currency</option>
                    {CURRENCY_OPTIONS.map((currency) => <option key={currency}>{currency}</option>)}
                  </select>
                </Field>
                <NumberField
                  label="Amount received"
                  value={form.targetAmount}
                  onChange={(targetAmount) => update({ targetAmount })}
                />
              </>
            ) : null}
          </div>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(event) => update({ notes: event.target.value })}
              className={`${inputClass} min-h-24 resize-y`}
              placeholder="Optional reference or context"
            />
          </Field>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border-default px-5 py-3 text-sm font-semibold text-text-secondary hover:bg-bg-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-accent-violet px-5 py-3 text-sm font-semibold text-white hover:brightness-105"
            >
              Save transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass = "w-full rounded-xl border border-border-default bg-white px-3 py-2.5 text-sm text-text-primary outline-none transition focus:border-accent-violet";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value?: number;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min="0"
        step="any"
        inputMode="decimal"
        value={value ?? ""}
        onChange={(event) => onChange(parseOptionalNumber(event.target.value))}
        className={inputClass}
        placeholder={placeholder}
      />
    </Field>
  );
}
