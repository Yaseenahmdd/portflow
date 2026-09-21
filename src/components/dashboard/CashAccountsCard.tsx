"use client";

import { useState } from "react";
import type { CashBalanceSummary } from "@/lib/cash-balances";
import { formatOrMask } from "@/lib/utils";
import { tap } from "@/lib/haptics";
import { useDisplayCurrency } from "@/components/dashboard/DisplayCurrencyProvider";

export default function CashAccountsCard({
  cash,
  portfolioValueAed,
  isAmountsVisible,
  showNetWorth = true,
  collapsibleOnMobile = false,
}: {
  cash: CashBalanceSummary;
  portfolioValueAed: number;
  isAmountsVisible: boolean;
  showNetWorth?: boolean;
  collapsibleOnMobile?: boolean;
}) {
  const { displayCurrency, convertAed } = useDisplayCurrency();
  const [mobileOpen, setMobileOpen] = useState(false);
  const netWorthAed = portfolioValueAed + cash.totalCashAed;

  return (
    <section className="dashboard-card overflow-hidden rounded-2xl border border-border-default bg-bg-card shadow-sm">
      {collapsibleOnMobile ? (
        <button
          type="button"
          onClick={() => {
            tap();
            setMobileOpen((current) => !current);
          }}
          className={`flex min-h-16 w-full items-center justify-between gap-4 px-4 py-3 text-left sm:hidden ${mobileOpen ? "border-b border-border-default" : ""}`}
          aria-expanded={mobileOpen}
        >
          <span>
            <span className="block text-sm font-semibold text-text-primary">Cash accounts</span>
            <span className="mt-0.5 block text-[11px] text-text-muted">{cash.accounts.length} active account{cash.accounts.length === 1 ? "" : "s"}</span>
          </span>
          <span className="flex items-center gap-3">
            <span className="text-right">
              <span className="block text-[11px] text-text-muted">Available</span>
              <span className={`mt-1 block font-mono text-sm font-semibold ${cash.totalCashAed < 0 ? "text-accent-loss" : "text-text-primary"}`}>
                {formatOrMask(convertAed(cash.totalCashAed), displayCurrency, isAmountsVisible)}
              </span>
            </span>
            <svg className={`h-4 w-4 text-text-muted transition-transform ${mobileOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z" clipRule="evenodd" />
            </svg>
          </span>
        </button>
      ) : null}

      <div className={`${collapsibleOnMobile ? "hidden sm:flex" : "flex"} flex-col gap-3 border-b border-border-default px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5`}>
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

      <div className={collapsibleOnMobile && !mobileOpen ? "hidden sm:block" : "block"}>
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
      </div>
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
  const { displayCurrency, convertAed } = useDisplayCurrency();

  return (
    <div className="text-right">
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className={`mt-1 font-mono text-sm font-semibold ${value < 0 ? "text-accent-loss" : "text-text-primary"}`}>
        {formatOrMask(convertAed(value), displayCurrency, isAmountsVisible)}
      </div>
    </div>
  );
}
