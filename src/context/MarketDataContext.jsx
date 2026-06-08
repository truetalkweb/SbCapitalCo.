import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { marketDataService } from "../services/marketDataService";
import { MarketDataContext } from "./marketDataContextValue";

export function MarketDataProvider({ children }) {
  const [liveQuotes, setLiveQuotes] = useState({});
  const [wsStatus, setWsStatus] = useState("DISCONNECTED");

  const updateLiveQuote = useCallback((symbol, price, extra = {}) => {
    const cleanSymbol = symbol?.trim?.().toUpperCase?.();
    const numericPrice = Number(price);

    if (!cleanSymbol || !numericPrice || Number.isNaN(numericPrice)) {
      return;
    }

    setLiveQuotes((prev) => {
      const previous = prev[cleanSymbol];

      const oldPrice = Number(previous?.price || numericPrice);

      const changePercent =
        oldPrice > 0
          ? (
              ((numericPrice - oldPrice) / oldPrice) *
              100
            ).toFixed(2)
          : "0.00";

      return {
        ...prev,

        [cleanSymbol]: {
          symbol: cleanSymbol,

          price: numericPrice.toFixed(2),

          change: `${
            Number(changePercent) >= 0 ? "+" : ""
          }${changePercent}%`,

          volume:
            extra.volume ||
            previous?.volume ||
            "LIVE",

          lastUpdated: Date.now(),

          source:
            extra.source ||
            previous?.source ||
            "WS",

          delayed:
            typeof extra.delayed === "boolean"
              ? extra.delayed
              : previous?.delayed || false,

          realtime:
            typeof extra.realtime === "boolean"
              ? extra.realtime
              : typeof extra.delayed === "boolean"
                ? !extra.delayed
                : previous?.realtime ?? true,

          bidPrice:
            extra.bidPrice ?? previous?.bidPrice ?? null,

          askPrice:
            extra.askPrice ?? previous?.askPrice ?? null,

          lastTradeTime:
            extra.lastTradeTime || previous?.lastTradeTime || null,
        },
      };
    });
  }, []);

  const subscribeToSymbols = useCallback(
    (symbols = []) => {
      const cleanSymbols = [
        ...new Set(
          symbols
            .filter(Boolean)
            .map((s) =>
              s.trim().toUpperCase()
            )
        ),
      ];

      const unsubscribers = cleanSymbols.map(
        (symbol) =>
          marketDataService.subscribe(
            symbol,
            (trade) => {
              updateLiveQuote(
                trade.s,
                trade.p,
                {
                  volume:
                    trade.v || "LIVE",

                  source: trade.source || "QTRD STREAM",

                  delayed: Boolean(trade.delayed),

                  realtime: trade.realtime !== false,

                  bidPrice: trade.bidPrice,

                  askPrice: trade.askPrice,

                  lastTradeTime: trade.lastTradeTime,
                }
              );
            }
          )
      );

      return () => {
        unsubscribers.forEach((unsub) =>
          unsub()
        );
      };
    },
    [updateLiveQuote]
  );

  useEffect(() => {
    const removeStatusListener =
      marketDataService.onStatus(
        (status) => {
          setWsStatus(status);
        }
      );

    return () => {
      removeStatusListener();
    };
  }, []);

  const value = useMemo(
    () => ({
      liveQuotes,
      wsStatus,
      updateLiveQuote,
      subscribeToSymbols,
    }),

    [
      liveQuotes,
      wsStatus,
      updateLiveQuote,
      subscribeToSymbols,
    ]
  );

  return (
    <MarketDataContext.Provider
      value={value}
    >
      {children}
    </MarketDataContext.Provider>
  );
}
