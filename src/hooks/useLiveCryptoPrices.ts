"use client";

import { useEffect, useMemo, useState } from "react";
import { LIVE_CRYPTO_STREAMS, type Holding } from "@/lib/constants";
import { convertPriceBetweenCurrencies } from "@/lib/utils";

const BINANCE_STREAM_BASE_URL = "wss://stream.binance.com:9443/stream";
const RECONNECT_DELAY_MS = 3000;

interface LivePriceOverride {
  currentPrice: number;
  lastPriceUpdate: string;
}

interface UseLiveCryptoPricesOptions {
  holdings: Holding[];
  inrToAedRate: number;
  applyLivePrices: (updates: Record<string, LivePriceOverride>) => void;
  clearLivePrices: (ids?: string[]) => void;
}

interface BinanceTickerMessage {
  stream?: string;
  data?: {
    c?: string;
  };
}

interface LiveCryptoStatus {
  state: "inactive" | "connecting" | "connected" | "error";
  message: string | null;
}

export function useLiveCryptoPrices({
  holdings,
  inrToAedRate,
  applyLivePrices,
  clearLivePrices,
}: UseLiveCryptoPricesOptions) {
  const liveCryptoHoldings = useMemo(
    () =>
      holdings.filter(
        (holding) => holding.priceSource === "coingecko" && LIVE_CRYPTO_STREAMS[holding.ticker.trim().toUpperCase()]
      ),
    [holdings]
  );
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "error">("connecting");

  useEffect(() => {
    const liveCryptoIds = liveCryptoHoldings.map((holding) => holding.id);
    clearLivePrices(liveCryptoIds);

    if (!liveCryptoHoldings.length) {
      return;
    }

    const holdingIdsByStream = new Map<string, string[]>();
    const holdingById = new Map<string, Holding>();

    for (const holding of liveCryptoHoldings) {
      const ticker = holding.ticker.trim().toUpperCase();
      const stream = LIVE_CRYPTO_STREAMS[ticker];
      const ids = holdingIdsByStream.get(stream) || [];
      ids.push(holding.id);
      holdingIdsByStream.set(stream, ids);
      holdingById.set(holding.id, holding);
    }

    const streams = [...holdingIdsByStream.keys()];
    const socketUrl = `${BINANCE_STREAM_BASE_URL}?streams=${streams.join("/")}`;
    let socket: WebSocket | null = null;
    let reconnectTimeoutId: number | null = null;
    let isDisposed = false;

    function connect() {
      if (isDisposed) {
        return;
      }

      setConnectionState("connecting");

      socket = new WebSocket(socketUrl);

      socket.onopen = () => {
        setConnectionState("connected");
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as BinanceTickerMessage;
          const stream = payload.stream;
          const priceUsd = Number(payload.data?.c);

          if (!stream || !Number.isFinite(priceUsd)) {
            return;
          }

          const ids = holdingIdsByStream.get(stream);
          if (!ids?.length) {
            return;
          }

          const lastPriceUpdate = new Date().toISOString();
          const updates = ids.reduce<Record<string, LivePriceOverride>>((accumulator, id) => {
            const holding = holdingById.get(id);
            if (!holding) {
              return accumulator;
            }

            accumulator[id] = {
              currentPrice: convertPriceBetweenCurrencies(priceUsd, "USD", holding.currency, inrToAedRate),
              lastPriceUpdate,
            };
            return accumulator;
          }, {});

          applyLivePrices(updates);
        } catch (error) {
          console.error("Failed to parse live crypto price update:", error);
        }
      };

      socket.onclose = () => {
        socket = null;

        if (isDisposed) {
          return;
        }

        setConnectionState("error");

        reconnectTimeoutId = window.setTimeout(() => {
          connect();
        }, RECONNECT_DELAY_MS);
      };

      socket.onerror = () => {
        setConnectionState("error");
        socket?.close();
      };
    }

    connect();

    return () => {
      isDisposed = true;
      clearLivePrices(liveCryptoIds);

      if (reconnectTimeoutId) {
        window.clearTimeout(reconnectTimeoutId);
      }

      socket?.close();
    };
  }, [applyLivePrices, clearLivePrices, inrToAedRate, liveCryptoHoldings]);

  return useMemo<LiveCryptoStatus>(() => {
    if (!liveCryptoHoldings.length) {
      return {
        state: "inactive",
        message: "No BTC or ETH crypto holdings are eligible for live prices yet.",
      };
    }

    if (connectionState === "connected") {
      return {
        state: "connected",
        message: `Live crypto feed connected for ${liveCryptoHoldings.length} holding${liveCryptoHoldings.length === 1 ? "" : "s"}.`,
      };
    }

    if (connectionState === "error") {
      return {
        state: "error",
        message: "Live crypto feed disconnected. Retrying...",
      };
    }

    return {
      state: "connecting",
      message: `Connecting live crypto feed for ${liveCryptoHoldings.length} holding${liveCryptoHoldings.length === 1 ? "" : "s"}.`,
    };
  }, [connectionState, liveCryptoHoldings.length]);
}
