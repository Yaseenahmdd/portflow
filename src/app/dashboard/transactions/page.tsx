"use client";

import { useMemo, useState } from "react";
import TransactionModal from "@/components/TransactionModal";
import CashAccountsCard from "@/components/dashboard/CashAccountsCard";
import { useDashboardStateContext } from "@/components/dashboard/DashboardStateProvider";
import { PLATFORM_OPTIONS } from "@/lib/constants";
import { destructive as hapticDestructive, tap } from "@/lib/haptics";
import { reconcileHoldingsFromLedger } from "@/lib/ledger-holdings";
import {
  getTransactionAmount,
  TRANSACTION_TYPE_LABELS,
  transactionsFromHoldingPurchases,
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
  const {
    holdings,
    setHoldings,
    inrToAedRate,
    isAmountsVisible,
    transactions,
    transactionsMounted,
    transactionSyncWarning,
    saveTransaction,
    deleteTransaction,
    importTransactions,
    activityEngineReady,
    activityManagedHoldingIds,
    activityReconciliation: reconciliation,
    cash,
    summary,
  } = useDashboardStateContext();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PortfolioTransaction | null>(null);
  const [filter, setFilter] = useState<"all" | TransactionType>("all");
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const purchaseImport = useMemo(() => {
    const existingIds = new Set(transactions.map((transaction) => transaction.id));
    const all = transactionsFromHoldingPurchases(holdings);
    return {
      additions: all.filter((transaction) => !existingIds.has(transaction.id)),
      alreadyImported: all.filter((transaction) => existingIds.has(transaction.id)).length,
      total: all.length,
    };
  }, [holdings, transactions]);

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

  const accountOptions = useMemo(
    () => [
      ...PLATFORM_OPTIONS,
      ...holdings.map((holding) => holding.platform),
      ...transactions.map((transaction) => transaction.platform),
    ],
    [holdings, transactions]
  );

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function prepareTransaction(transaction: PortfolioTransaction) {
    const now = new Date().toISOString();
    return {
      ...transaction,
      id: transaction.id || crypto.randomUUID(),
      createdAt: transaction.createdAt || now,
      updatedAt: now,
      fxRateToAed:
        transaction.currency === "INR"
          ? transaction.fxRateToAed || inrToAedRate
          : transaction.fxRateToAed,
    };
  }

  function handleSaveTransaction(transaction: PortfolioTransaction) {
    const prepared = prepareTransaction(transaction);
    const nextTransactions = transactions.some((item) => item.id === prepared.id)
      ? transactions.map((item) => (item.id === prepared.id ? prepared : item))
      : [...transactions, prepared];
    const nextManagedIds = new Set(activityManagedHoldingIds);
    const previous = transactions.find((item) => item.id === prepared.id);
    if (prepared.holdingId) nextManagedIds.add(prepared.holdingId);
    if (previous?.holdingId) nextManagedIds.add(previous.holdingId);
    const nextReconciliation = reconcileHoldingsFromLedger(
      holdings,
      nextTransactions,
      inrToAedRate,
      nextManagedIds
    );

    if (nextReconciliation.issues.length) {
      return nextReconciliation.issues[0].message;
    }

    saveTransaction(prepared);
    setHoldings(nextReconciliation.nextHoldings);
    closeModal();
    return null;
  }

  function handleDeleteTransaction(transaction: PortfolioTransaction) {
    if (!window.confirm("Delete this transaction?")) return;

    const nextManagedIds = new Set(activityManagedHoldingIds);
    if (transaction.holdingId) nextManagedIds.add(transaction.holdingId);
    const nextReconciliation = reconcileHoldingsFromLedger(
      holdings,
      transactions.filter((item) => item.id !== transaction.id),
      inrToAedRate,
      nextManagedIds
    );
    if (nextReconciliation.issues.length) {
      window.alert(nextReconciliation.issues[0].message);
      return;
    }
    setHoldings(nextReconciliation.nextHoldings);

    hapticDestructive();
    deleteTransaction(transaction.id);
  }

  if (!transactionsMounted || !activityEngineReady) {
    return <div className="skeleton h-[30rem] rounded-2xl" />;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Activity ledger</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">Transactions</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Buys, sells, and splits automatically control Holdings quantities and average costs.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {purchaseImport.additions.length ? (
            <button
              type="button"
              onClick={() => {
                tap();
                setImportPreviewOpen(true);
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border-default bg-white px-5 py-3 text-sm font-semibold text-text-primary hover:bg-bg-elevated"
            >
              Import existing purchases
            </button>
          ) : null}
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
      </div>

      {transactionSyncWarning ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {transactionSyncWarning}
        </div>
      ) : null}

      {importMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {importMessage}
        </div>
      ) : null}

      {activityEngineReady && reconciliation.issues.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
          <div className="text-sm font-semibold text-amber-900">Holdings need attention</div>
          <p className="mt-1 text-xs text-amber-700">Some Activity entries could not be synchronized.</p>
          <ul className="mt-3 space-y-1.5 text-xs text-amber-800">
            {reconciliation.issues.map((issue) => (
              <li key={`${issue.transactionId}-${issue.message}`}>• {issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Buy entries" value={String(totals.buys)} note="Recorded purchases" />
        <SummaryCard label="Sell entries" value={String(totals.sells)} note="Recorded disposals" />
        <SummaryCard label="Income entries" value={String(totals.income)} note="Dividends and distributions" />
        <SummaryCard
          label="Realized P/L"
          value={formatOrMask(reconciliation.realizedGainAed, "AED", isAmountsVisible)}
          note="Closed trades, after fees"
        />
      </div>

      <CashAccountsCard
        cash={cash}
        portfolioValueAed={summary.totalValue}
        isAmountsVisible={isAmountsVisible}
        showNetWorth={false}
      />

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
                    onClick={() => handleDeleteTransaction(transaction)}
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
              {purchaseImport.total
                ? "Import your existing purchase history or add your first entry manually."
                : "Add your first entry to begin building an auditable portfolio history."}
            </p>
            {purchaseImport.total ? (
              <button
                type="button"
                onClick={() => setImportPreviewOpen(true)}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-accent-violet px-5 py-3 text-sm font-semibold text-white hover:brightness-105"
              >
                Preview {purchaseImport.additions.length} purchase{purchaseImport.additions.length === 1 ? "" : "s"}
              </button>
            ) : null}
          </div>
        )}
      </section>

      {importPreviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="purchase-import-title"
            className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6"
          >
            <h2 id="purchase-import-title" className="text-xl font-semibold text-text-primary">
              Import existing purchases?
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              This will add {purchaseImport.additions.length} new Buy entr{purchaseImport.additions.length === 1 ? "y" : "ies"}
              {purchaseImport.alreadyImported
                ? ` and skip ${purchaseImport.alreadyImported} already imported.`
                : "."}
            </p>
            <div className="mt-4 rounded-2xl bg-bg-elevated p-4 text-sm text-text-secondary">
              Your holdings and quantities will not change. Running this import again is safe.
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setImportPreviewOpen(false)}
                className="min-h-11 rounded-full border border-border-default px-5 py-2.5 text-sm font-semibold text-text-secondary hover:bg-bg-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!purchaseImport.additions.length}
                onClick={() => {
                  const count = purchaseImport.additions.length;
                  importTransactions(purchaseImport.additions);
                  setImportPreviewOpen(false);
                  setImportMessage(
                    count
                      ? `Imported ${count} purchase${count === 1 ? "" : "s"} into Activity.`
                      : "All existing purchases are already imported."
                  );
                }}
                className="min-h-11 rounded-full bg-accent-violet px-5 py-2.5 text-sm font-semibold text-white hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {purchaseImport.additions.length
                  ? `Import ${purchaseImport.additions.length}`
                  : "Already imported"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <TransactionModal
          transaction={editing}
          holdings={holdings}
          accountOptions={accountOptions}
          holdingsConnected
          onSave={handleSaveTransaction}
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
