import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { mergeQuoteSnapshot, normalizeMarketQuote } from "../utils/marketDataContract.js";
import { createVisibilityAwarePoller } from "../utils/visibilityScheduler.js";
import { marketDataService } from "../services/marketDataService";
import { MarketDataContext } from "./marketDataContextValue";

export function MarketDataProvider({ children }) {
  const [liveQuotes, setLiveQuotes] = useState({});
  const [wsStatus, setWsStatus] = useState("DISCONNECTED");

  useEffect(() => createVisibilityAwarePoller(() => {
    setLiveQuotes(previous => {
      let next = previous;
      const now = Date.now();
      for (const [symbol, quote] of Object.entries(previous)) {
        if (quote.quality !== "live") continue;
        const quality = normalizeMarketQuote(quote, { symbol, now }).quality;
        if (quality === quote.quality) continue;
        if (next === previous) next = { ...previous };
        next[symbol] = { ...quote, quality, dataMode: quality, stale: quality === "stale" };
      }
      return next;
    });
  }, 1000), []);

  const updateLiveQuote = useCallback((symbol, price, extra = {}) => {
    const cleanSymbol = symbol?.trim?.().toUpperCase?.();
    if (!cleanSymbol) return;
    setLiveQuotes(previous => ({
      ...previous,
      [cleanSymbol]: mergeQuoteSnapshot(previous[cleanSymbol], { ...extra, symbol: cleanSymbol, price }),
    }));
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
                trade
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
