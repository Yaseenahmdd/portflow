"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { USD_TO_AED } from "@/lib/constants";

export type DisplayCurrency = "AED" | "USD";

interface DisplayCurrencyValue {
  displayCurrency: DisplayCurrency;
  displayRate: number;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  convertAed: (value: number) => number;
}

const STORAGE_KEY = "portflow-display-currency";
const DisplayCurrencyContext = createContext<DisplayCurrencyValue | null>(null);

export function DisplayCurrencyProvider({ children }: { children: ReactNode }) {
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("AED");
  const displayRate = displayCurrency === "USD" ? 1 / USD_TO_AED : 1;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const storedCurrency = window.localStorage.getItem(STORAGE_KEY);
    if (storedCurrency === "AED" || storedCurrency === "USD") {
      setDisplayCurrency(storedCurrency);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, displayCurrency);
  }, [displayCurrency]);

  return (
    <DisplayCurrencyContext.Provider
      value={{
        displayCurrency,
        displayRate,
        setDisplayCurrency,
        convertAed: (value) => value * displayRate,
      }}
    >
      {children}
    </DisplayCurrencyContext.Provider>
  );
}

export function useDisplayCurrency() {
  const context = useContext(DisplayCurrencyContext);

  if (!context) {
    throw new Error("useDisplayCurrency must be used within DisplayCurrencyProvider.");
  }

  return context;
}
