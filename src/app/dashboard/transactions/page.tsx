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
import { useDisplayCurrency } from "@/components/dashboard/DisplayCurrencyProvider";

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

const TRANSACTION_SYMBOLS: Record<TransactionType, string> = {
  buy: "B",
  sell: "S",
  dividend: "D",
  deposit: "+",
  withdrawal: "−",
  fee: "F",
  split: "S",
  fx: "↔",
};

function transactionDirection(type: TransactionType) {
  if (["sell", "dividend", "deposit"].includes(type)) return 1;
  if (["buy", "withdrawal", "fee", "fx"].includes(type)) return -1;
  return 0;
}

function transactionDisplayAmount(transaction: PortfolioTransaction) {
  if (transaction.type === "sell") {
    return Math.max(
      0,
      (transaction.quantity || 0) * (transaction.price || 0) - (transaction.fees || 0)
    );
  }
  return getTransactionAmount(transaction);
}

function formatActivityGroupDate(date: string) {
  const activityDate = new Date(`${date}T00:00:00`);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  if (date === todayKey) return "Today";
  if (date === yesterdayKey) return "Yesterday";
  return activityDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function TransactionsPage() {
  const { displayCurrency, convertAed } = useDisplayCurrency();
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
  const [mobileActionMenuId, setMobileActionMenuId] = useState<string | null>(null);
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

  const groupedTransactions = useMemo(() => {
    const groups: Array<{ date: string; entries: PortfolioTransaction[] }> = [];
    for (const transaction of filteredTransactions) {
      const latest = groups[groups.length - 1];
      if (latest?.date === transaction.date) latest.entries.push(transaction);
      else groups.push({ date: transaction.date, entries: [transaction] });
    }
    return groups;
  }, [filteredTransactions]);

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
      <div className="sm:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Activity</h1>
            <p className="mt-1 text-xs text-text-muted">{transactions.length} ledger entr{transactions.length === 1 ? "y" : "ies"}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              tap();
              setEditing(null);
              setModalOpen(true);
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent-violet text-white"
            aria-label="Add transaction"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {purchaseImport.additions.length ? (
          <button
            type="button"
            onClick={() => {
              tap();
              setImportPreviewOpen(true);
            }}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border-default bg-bg-card px-4 py-2.5 text-sm font-semibold text-text-primary"
          >
            Import {purchaseImport.additions.length} existing purchase{purchaseImport.additions.length === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>

      <div className="hidden flex-col gap-4 sm:flex sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Activity ledger</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">Transactions</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Buys, sells, and splits automatically control Holdings quantities and average costs.
          </p>
        </div>
        <div className="flex gap-2">
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

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <SummaryCard label="Buy entries" value={String(totals.buys)} note="Recorded purchases" />
        <SummaryCard label="Sell entries" value={String(totals.sells)} note="Recorded disposals" />
        <SummaryCard label="Income entries" value={String(totals.income)} note="Dividends and distributions" />
        <SummaryCard
          label="Realized P/L"
          value={formatOrMask(convertAed(reconciliation.realizedGainAed), displayCurrency, isAmountsVisible)}
          note="Closed trades, after fees"
        />
      </div>

      <CashAccountsCard
        cash={cash}
        portfolioValueAed={summary.totalValue}
        isAmountsVisible={isAmountsVisible}
        showNetWorth={false}
        collapsibleOnMobile
      />

      <section className="overflow-visible rounded-2xl border border-border-default bg-white sm:overflow-hidden">
        <div className="sticky top-0 z-20 flex flex-col gap-3 rounded-t-2xl border-b border-border-default bg-bg-card px-4 py-4 sm:static sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold text-text-primary">Ledger entries</h2>
            <p className="mt-0.5 text-xs text-text-muted">{transactions.length} total</p>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setFilter(item.value);
                  setMobileActionMenuId(null);
                }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === item.value
                    ? "bg-text-primary text-bg-primary"
                    : "bg-bg-elevated text-text-secondary hover:text-text-primary"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {filteredTransactions.length ? (
          <>
          <div className="sm:hidden">
            {groupedTransactions.map((group) => (
              <div key={group.date}>
                <div className="border-b border-border-subtle bg-bg-elevated px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                  {formatActivityGroupDate(group.date)}
                </div>
                {group.entries.map((transaction, transactionIndex) => {
                  const direction = transactionDirection(transaction.type);
                  const displayAmount = transactionDisplayAmount(transaction);
                  const amountTone = direction > 0
                    ? "text-accent-gain"
                    : direction < 0
                      ? "text-accent-loss"
                      : "text-text-primary";

                  return (
                    <div
                      key={transaction.id}
                      className={`relative ${transactionIndex ? "border-t border-border-subtle" : ""}`}
                    >
                      <div className="flex items-center gap-2 px-3 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            tap();
                            setEditing(transaction);
                            setModalOpen(true);
                          }}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-elevated text-xs font-semibold text-text-secondary">
                            {TRANSACTION_SYMBOLS[transaction.type]}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-text-primary">{transactionTitle(transaction)}</span>
                            <span className="mt-1 block truncate text-[11px] text-text-muted">{TRANSACTION_TYPE_LABELS[transaction.type]} · {transactionDetail(transaction)}</span>
                          </span>
                          <span className="ml-auto shrink-0 text-right">
                            <span className={`block font-mono text-xs font-semibold tabular-nums ${amountTone}`}>
                              {transaction.type === "split"
                                ? "—"
                                : `${direction > 0 ? "+" : direction < 0 ? "−" : ""}${formatOrMask(displayAmount, transaction.currency, isAmountsVisible)}`}
                            </span>
                            <span className="mt-1 block max-w-24 truncate text-[10px] text-text-muted">{transaction.platform}</span>
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            tap();
                            setMobileActionMenuId((current) => current === transaction.id ? null : transaction.id);
                          }}
                          className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-text-muted hover:bg-bg-elevated"
                          aria-label={`Actions for ${transactionTitle(transaction)}`}
                          aria-expanded={mobileActionMenuId === transaction.id}
                        >
                          ···
                        </button>
                      </div>

                      {mobileActionMenuId === transaction.id ? (
                        <div className="absolute right-3 top-12 z-30 min-w-36 overflow-hidden rounded-xl border border-border-default bg-bg-card shadow-xl">
                          <button
                            type="button"
                            onClick={() => {
                              setMobileActionMenuId(null);
                              setEditing(transaction);
                              setModalOpen(true);
                            }}
                            className="block min-h-11 w-full px-4 py-2.5 text-left text-sm font-medium text-text-primary hover:bg-bg-elevated"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMobileActionMenuId(null);
                              handleDeleteTransaction(transaction);
                            }}
                            className="block min-h-11 w-full border-t border-border-subtle px-4 py-2.5 text-left text-sm font-medium text-accent-loss hover:bg-bg-elevated"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="hidden divide-y divide-border-default sm:block">
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
          </>
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
    <div className="min-w-0 rounded-xl border border-border-default bg-white p-3 sm:rounded-2xl sm:p-4">
      <div className="truncate text-[11px] font-medium text-text-muted sm:text-xs">{label}</div>
      <div className="mt-1.5 truncate font-mono text-base font-semibold text-text-primary sm:mt-2 sm:text-xl">{value}</div>
      <div className="mt-1 hidden text-[11px] text-text-muted sm:block">{note}</div>
    </div>
  );
}
