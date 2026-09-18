"use client";

import { useMemo, useState } from "react";
import TransactionModal from "@/components/TransactionModal";
import { useDashboardStateContext } from "@/components/dashboard/DashboardStateProvider";
import { useTransactions } from "@/hooks/useTransactions";
import { destructive as hapticDestructive, tap } from "@/lib/haptics";
import {
  getTransactionAmount,
  TRANSACTION_TYPE_LABELS,
  type PortfolioTransaction,
  type TransactionType,
} from "@/lib/transactions";
import { formatOrMask } from "@/lib/utils";

const FILTERS: Array<{ label: string; value: "all" | TransactionType }> = [
  { label: "All", value: "all" },
  { label: "Buys", value: "buy" },
  { label: "Sells", value: "sell" },
  { label: "Income", value: "dividend" },
  { label: "Cash", value: "deposit" },
];

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function transactionTitle(transaction: PortfolioTransaction) {
  if (transaction.type === "fx") {
    return `${transaction.currency} → ${transaction.targetCurrency || "—"}`;
  }
  return transaction.assetName || transaction.ticker || TRANSACTION_TYPE_LABELS[transaction.type];
}

function transactionDetail(transaction: PortfolioTransaction) {
  if (transaction.type === "buy" || transaction.type === "sell") {
    return `${transaction.quantity || 0} × ${transaction.price || 0} ${transaction.currency}`;
  }
  if (transaction.type === "split") return `${transaction.splitRatio || 0}-for-1`;
  if (transaction.type === "fx") {
    return `${transaction.amount || 0} ${transaction.currency} → ${transaction.targetAmount || 0} ${transaction.targetCurrency || ""}`;
  }
  return transaction.platform;
}

export default function TransactionsPage() {
  const { userId, holdings, isAmountsVisible } = useDashboardStateContext();
  const { transactions, mounted, syncWarning, saveTransaction, deleteTransaction } = useTransactions(userId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PortfolioTransaction | null>(null);
  const [filter, setFilter] = useState<"all" | TransactionType>("all");

  const filteredTransactions = useMemo(() => {
    if (filter === "all") return transactions;
    if (filter === "deposit") {
      return transactions.filter((transaction) =>
        ["deposit", "withdrawal", "fee", "fx"].includes(transaction.type)
      );
    }
    return transactions.filter((transaction) => transaction.type === filter);
  }, [filter, transactions]);

  const totals = useMemo(() => {
    let buys = 0;
    let sells = 0;
    let income = 0;
    for (const transaction of transactions) {
      if (transaction.type === "buy") buys += 1;
      if (transaction.type === "sell") sells += 1;
      if (transaction.type === "dividend") income += 1;
    }
    return { buys, sells, income };
  }, [transactions]);

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  if (!mounted) {
    return <div className="skeleton h-[30rem] rounded-2xl" />;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Activity ledger</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">Transactions</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Record portfolio activity now. Holdings will be derived from this ledger in the next phase.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            tap();
            setEditing(null);
            setModalOpen(true);
          }}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent-violet px-5 py-3 text-sm font-semibold text-white hover:brightness-105"
        >
          Add transaction
        </button>
      </div>

      {syncWarning ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {syncWarning}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Buy entries" value={String(totals.buys)} note="Recorded purchases" />
        <SummaryCard label="Sell entries" value={String(totals.sells)} note="Recorded disposals" />
        <SummaryCard label="Income entries" value={String(totals.income)} note="Dividends and distributions" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-border-default bg-white">
        <div className="flex flex-col gap-3 border-b border-border-default px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold text-text-primary">Ledger entries</h2>
            <p className="mt-0.5 text-xs text-text-muted">{transactions.length} total</p>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === item.value
                    ? "bg-slate-900 text-white"
                    : "bg-bg-elevated text-text-secondary hover:text-text-primary"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {filteredTransactions.length ? (
          <div className="divide-y divide-border-default">
            {filteredTransactions.map((transaction) => (
              <div key={transaction.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 rounded-full bg-bg-elevated px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    {TRANSACTION_TYPE_LABELS[transaction.type]}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-text-primary">{transactionTitle(transaction)}</div>
                    <div className="mt-1 text-xs text-text-muted">
                      {formatDate(transaction.date)} · {transactionDetail(transaction)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold text-text-primary">
                      {transaction.type === "split"
                        ? "—"
                        : formatOrMask(getTransactionAmount(transaction), transaction.currency, isAmountsVisible)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-text-muted">{transaction.platform}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(transaction);
                      setModalOpen(true);
                    }}
                    className="rounded-full border border-border-default px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-bg-elevated"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Delete this transaction?")) {
                        hapticDestructive();
                        deleteTransaction(transaction.id);
                      }
                    }}
                    className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-16 text-center">
            <div className="text-sm font-semibold text-text-primary">No transactions yet</div>
            <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
              Add your first entry to begin building an auditable portfolio history.
            </p>
          </div>
        )}
      </section>

      {modalOpen ? (
        <TransactionModal
          transaction={editing}
          holdings={holdings}
          onSave={(transaction) => {
            saveTransaction(transaction);
            closeModal();
          }}
          onClose={closeModal}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-white p-4">
      <div className="text-xs font-medium text-text-muted">{label}</div>
      <div className="mt-2 font-mono text-xl font-semibold text-text-primary">{value}</div>
      <div className="mt-1 text-[11px] text-text-muted">{note}</div>
    </div>
  );
}
