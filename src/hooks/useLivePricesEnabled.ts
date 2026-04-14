"use client";

import { useEffect, useState } from "react";

export const LIVE_PRICES_STORAGE_KEY = "portflow-enable-live-prices";

function readLivePricesOverride() {
  try {
    return window.localStorage.getItem(LIVE_PRICES_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function useLivePricesEnabled() {
  const [enabled, setEnabled] = useState(() => {
    const envEnabled = process.env.NEXT_PUBLIC_ENABLE_LIVE_PRICES === "true";

    if (typeof window === "undefined") {
      return envEnabled;
    }

    return envEnabled || readLivePricesOverride();
  });

  useEffect(() => {
    const envEnabled = process.env.NEXT_PUBLIC_ENABLE_LIVE_PRICES === "true";

    function handleStorage(event: StorageEvent) {
      if (event.key === LIVE_PRICES_STORAGE_KEY) {
        setEnabled(envEnabled || event.newValue === "true");
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return enabled;
}
