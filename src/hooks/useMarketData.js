import { useContext } from "react";
import { MarketDataContext } from "../context/marketDataContextValue";

export function useMarketData() {
  const context = useContext(MarketDataContext);

  if (!context) {
    throw new Error("useMarketData must be used inside MarketDataProvider");
  }

  return context;
}
