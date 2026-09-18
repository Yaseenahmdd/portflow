"use client";

import type { CashBalanceSummary } from "@/lib/cash-balances";
import { formatOrMask } from "@/lib/utils";

export default function CashAccountsCard({
  cash,
  portfolioValueAed,
  isAmountsVisible,
  showNetWorth = true,
}: {
  cash: CashBalanceSummary;
  portfolioValueAed: number;
  isAmountsVisible: boolean;
  showNetWorth?: boolean;
}) {
  const netWorthAed = portfolioValueAed + cash.totalCashAed;

  return (
    <section className="dashboard-card overflow-hidden rounded-2xl border border-border-default bg-bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border-default px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="font-display text-base font-semibold tracking-[-0.03em] text-text-primary">
            Cash accounts
          </h2>
          <p className="mt-1 text-xs text-text-muted">Calculated from Activity by platform and currency.</p>
        </div>
        <div className="flex gap-6">
          <CashTotal label="Available cash" value={cash.totalCashAed} isAmountsVisible={isAmountsVisible} />
          {showNetWorth ? (
            <CashTotal label="Net worth" value={netWorthAed} isAmountsVisible={isAmountsVisible} />
          ) : null}
        </div>
      </div>

      {cash.accounts.length ? (
        <div className="flex flex-wrap gap-px bg-border-default">
          {cash.accounts.map((account) => (
            <div
              key={account.key}
              className="min-w-0 flex-1 basis-[min(100%,20rem)] bg-bg-card px-4 py-4 sm:px-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-text-primary">{account.platform}</div>
                  <div className="mt-1 text-xs text-text-muted">
                    {account.currency} · {account.activityCount} entr{account.activityCount === 1 ? "y" : "ies"}
                  </div>
                </div>
                <div className={`shrink-0 text-right font-mono text-sm font-semibold ${account.isNegative ? "text-accent-loss" : "text-text-primary"}`}>
                  {formatOrMask(account.balance, account.currency, isAmountsVisible)}
                </div>
              </div>
              {!account.includedInNetWorth ? (
                <div className="mt-2 text-[11px] text-text-muted">Already represented by a Cash holding</div>
              ) : account.isNegative ? (
                <div className="mt-2 text-[11px] font-medium text-accent-loss">Add a deposit or correct the account activity</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-8 text-center text-sm text-text-muted">
          Add a deposit, dividend, withdrawal, trade, fee, or currency exchange to begin tracking cash.
        </div>
      )}

      {cash.excludedHistoricalBuys ? (
        <div className="border-t border-border-default px-4 py-3 text-[11px] text-text-muted sm:px-5">
          Imported historical purchases are treated as previously funded.
        </div>
      ) : null}
    </section>
  );
}

function CashTotal({
  label,
  value,
  isAmountsVisible,
}: {
  label: string;
  value: number;
  isAmountsVisible: boolean;
}) {
  return (
    <div className="text-right">
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className={`mt-1 font-mono text-sm font-semibold ${value < 0 ? "text-accent-loss" : "text-text-primary"}`}>
        {formatOrMask(value, "AED", isAmountsVisible)}
      </div>
    </div>
  );
}
