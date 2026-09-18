"use client";

import { useEffect, useMemo, useState } from "react";
import TransactionModal from "@/components/TransactionModal";
import CashAccountsCard from "@/components/dashboard/CashAccountsCard";
import { useDashboardStateContext } from "@/components/dashboard/DashboardStateProvider";
import { destructive as hapticDestructive, tap } from "@/lib/haptics";
import {
  loadLedgerConnectionState,
  persistLedgerConnectionState,
  reconcileHoldingsFromLedger,
  type LedgerHoldingsReconciliation,
} from "@/lib/ledger-holdings";
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
    userId,
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
    cash,
    summary,
  } = useDashboardStateContext();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PortfolioTransaction | null>(null);
  const [filter, setFilter] = useState<"all" | TransactionType>("all");
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [connectionPreviewOpen, setConnectionPreviewOpen] = useState(false);
  const [connectionLoaded, setConnectionLoaded] = useState(false);
  const [ledgerConnected, setLedgerConnected] = useState(false);
  const [managedHoldingIds, setManagedHoldingIds] = useState<string[]>([]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const connection = loadLedgerConnectionState(userId);
      setLedgerConnected(connection.enabled);
      setManagedHoldingIds(connection.managedHoldingIds);
      setConnectionLoaded(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [userId]);

  const purchaseImport = useMemo(() => {
    const existingIds = new Set(transactions.map((transaction) => transaction.id));
    const all = transactionsFromHoldingPurchases(holdings);
    return {
      additions: all.filter((transaction) => !existingIds.has(transaction.id)),
      alreadyImported: all.filter((transaction) => existingIds.has(transaction.id)).length,
      total: all.length,
    };
  }, [holdings, transactions]);

  const reconciliation = useMemo(
    () =>
      reconcileHoldingsFromLedger(
        holdings,
        transactions,
        inrToAedRate,
        ledgerConnected ? managedHoldingIds : []
      ),
    [holdings, inrToAedRate, ledgerConnected, managedHoldingIds, transactions]
  );

  useEffect(() => {
    if (!connectionLoaded || !ledgerConnected || reconciliation.issues.length) return;

    const currentIds = [...managedHoldingIds].sort().join("|");
    const nextIds = [...reconciliation.managedHoldingIds].sort().join("|");
    if (!reconciliation.changes.length && currentIds === nextIds) return;

    const timeoutId = window.setTimeout(() => {
      if (reconciliation.changes.length) {
        setHoldings(reconciliation.nextHoldings);
      }
      if (currentIds !== nextIds) {
        setManagedHoldingIds(reconciliation.managedHoldingIds);
        persistLedgerConnectionState(userId, {
          enabled: true,
          managedHoldingIds: reconciliation.managedHoldingIds,
        });
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    connectionLoaded,
    ledgerConnected,
    managedHoldingIds,
    reconciliation,
    setHoldings,
    userId,
  ]);

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

  function persistConnection(result: LedgerHoldingsReconciliation) {
    setLedgerConnected(true);
    setManagedHoldingIds(result.managedHoldingIds);
    persistLedgerConnectionState(userId, {
      enabled: true,
      managedHoldingIds: result.managedHoldingIds,
    });
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
    const nextManagedIds = new Set(managedHoldingIds);
    const previous = transactions.find((item) => item.id === prepared.id);
    if (prepared.holdingId) nextManagedIds.add(prepared.holdingId);
    if (previous?.holdingId) nextManagedIds.add(previous.holdingId);
    const nextReconciliation = reconcileHoldingsFromLedger(
      holdings,
      nextTransactions,
      inrToAedRate,
      ledgerConnected ? nextManagedIds : []
    );

    if (ledgerConnected && nextReconciliation.issues.length) {
      return nextReconciliation.issues[0].message;
    }

    saveTransaction(prepared);
    if (ledgerConnected) {
      setHoldings(nextReconciliation.nextHoldings);
      persistConnection(nextReconciliation);
    }
    closeModal();
    return null;
  }

  function handleDeleteTransaction(transaction: PortfolioTransaction) {
    if (!window.confirm("Delete this transaction?")) return;

    if (ledgerConnected) {
      const nextManagedIds = new Set(managedHoldingIds);
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
      persistConnection(nextReconciliation);
    }

    hapticDestructive();
    deleteTransaction(transaction.id);
  }

  if (!transactionsMounted) {
    return <div className="skeleton h-[30rem] rounded-2xl" />;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Activity ledger</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">Transactions</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Buys, sells, and splits can now keep your Holdings quantities and average costs up to date.
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

      {connectionLoaded && transactions.length ? (
        ledgerConnected ? (
          reconciliation.issues.length ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-amber-900">Holdings need attention</div>
                <p className="mt-1 text-xs text-amber-700">Some Activity entries could not be synchronized.</p>
              </div>
              <button
                type="button"
                onClick={() => setConnectionPreviewOpen(true)}
                className="min-h-10 rounded-full border border-amber-300 bg-white px-4 text-xs font-semibold text-amber-800"
              >
                Review {reconciliation.issues.length} issue{reconciliation.issues.length === 1 ? "" : "s"}
              </button>
            </div>
          ) : null
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-violet-950">Ready to connect Activity to Holdings</div>
              <p className="mt-1 text-xs text-violet-700">Preview every change before anything is applied.</p>
            </div>
            <button
              type="button"
              onClick={() => setConnectionPreviewOpen(true)}
              className="min-h-10 rounded-full bg-accent-violet px-4 text-xs font-semibold text-white"
            >
              Review connection
            </button>
          </div>
        )
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

      {connectionPreviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ledger-connection-title"
            className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-6"
          >
            <h2 id="ledger-connection-title" className="text-xl font-semibold text-text-primary">
              {ledgerConnected ? "Holdings connection" : "Connect Activity to Holdings?"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {reconciliation.changes.length
                ? `${reconciliation.changes.length} holding${reconciliation.changes.length === 1 ? "" : "s"} will be updated.`
                : `${reconciliation.managedHoldingIds.length} linked holding${reconciliation.managedHoldingIds.length === 1 ? "" : "s"} verified with no value changes.`}
            </p>

            {reconciliation.issues.length ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-semibold text-amber-900">Fix these before connecting</div>
                <ul className="mt-2 space-y-2 text-sm text-amber-800">
                  {reconciliation.issues.map((issue) => (
                    <li key={`${issue.transactionId}-${issue.message}`}>• {issue.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {reconciliation.changes.length ? (
              <div className="mt-4 divide-y divide-border-default overflow-hidden rounded-2xl border border-border-default">
                {reconciliation.changes.map((change) => (
                  <div key={change.holdingId} className="p-4">
                    <div className="text-sm font-semibold text-text-primary">{change.assetName}</div>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-text-secondary">
                      <div>
                        <div className="text-text-muted">Quantity</div>
                        <div className="mt-1 font-mono">{change.currentQuantity} → {change.nextQuantity}</div>
                      </div>
                      <div>
                        <div className="text-text-muted">Average price</div>
                        <div className="mt-1 font-mono">
                          {formatOrMask(change.currentAveragePrice, change.currency, isAmountsVisible)} → {formatOrMask(change.nextAveragePrice, change.currency, isAmountsVisible)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl bg-bg-elevated p-4 text-sm text-text-secondary">
              Market prices and asset details stay unchanged. You can still review every transaction in Activity.
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConnectionPreviewOpen(false)}
                className="min-h-11 rounded-full border border-border-default px-5 py-2.5 text-sm font-semibold text-text-secondary hover:bg-bg-elevated"
              >
                Close
              </button>
              {!ledgerConnected ? (
                <button
                  type="button"
                  disabled={Boolean(reconciliation.issues.length) || !reconciliation.managedHoldingIds.length}
                  onClick={() => {
                    setHoldings(reconciliation.nextHoldings);
                    persistConnection(reconciliation);
                    setConnectionPreviewOpen(false);
                    setImportMessage("Activity is now connected to Holdings.");
                  }}
                  className="min-h-11 rounded-full bg-accent-violet px-5 py-2.5 text-sm font-semibold text-white hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Connect holdings
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

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
          holdingsConnected={ledgerConnected}
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
