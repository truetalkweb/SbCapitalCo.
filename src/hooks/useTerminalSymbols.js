import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cryptoStocks,
  defaultStocks,
  forexStocks,
  marketRegions,
  popularSymbols,
} from "../config/terminalConfig";
import {
  applyLiveQuote,
  getMomentumScore,
  getRelativeVolumeScore,
  parseMarketVolume,
  parsePercent,
} from "../utils/marketUtils";
import { normalizeScannerRow, rankScannerRows } from "../utils/scannerNewsAdapters";
import { loadSetting, saveSetting } from "../utils/storage";

function normalizeTerminalSymbol(symbol) {
  const clean = String(symbol || "").trim().toUpperCase();

  return /^[A-Z0-9][A-Z0-9./:-]{0,13}$/.test(clean) ? clean : "";
}

export function useTerminalSymbols({
  activeWorkspace,
  fmpActive,
  fmpAiMovers,
  fmpGainers,
  fmpLosers,
  fmpMomentum,
  fmpRelativeVolume,
  liveQuotes,
  liveSmallCapMovers,
  marketRegion,
  scannerTab,
  setSelectedScannerStock,
  syncCharts,
  updateContextLiveQuote,
}) {
  const [selectedStock, setSelectedStock] = useState(() =>
    loadSetting("sb_selected_stock", "NVDA")
  );
  const [secondarySymbol, setSecondarySymbol] = useState(() =>
    loadSetting("sb_secondary_symbol", "TSLA")
  );
  const [searchSymbol, setSearchSymbol] = useState("");
  const [liveStocks, setLiveStocks] = useState(() =>
    loadSetting("sb_watchlist", defaultStocks)
  );

  const allSymbols = useMemo(
    () => [
      ...Object.values(liveQuotes),
      ...liveStocks.map((stock) => applyLiveQuote(stock, liveQuotes)),
      ...fmpGainers.map((stock) => applyLiveQuote(stock, liveQuotes)),
      ...fmpLosers.map((stock) => applyLiveQuote(stock, liveQuotes)),
      ...fmpActive.map((stock) => applyLiveQuote(stock, liveQuotes)),
      ...fmpMomentum.map((stock) => applyLiveQuote(stock, liveQuotes)),
      ...fmpRelativeVolume.map((stock) => applyLiveQuote(stock, liveQuotes)),
      ...fmpAiMovers.map((stock) => applyLiveQuote(stock, liveQuotes)),
      ...cryptoStocks,
      ...forexStocks,
      ...liveSmallCapMovers,
    ],
    [
      fmpActive,
      fmpAiMovers,
      fmpGainers,
      fmpLosers,
      fmpMomentum,
      fmpRelativeVolume,
      liveQuotes,
      liveSmallCapMovers,
      liveStocks,
    ]
  );

  const trackedSymbols = useMemo(
    () =>
      [
        selectedStock,
        secondarySymbol,
        ...liveStocks.map((stock) => stock.symbol),
        ...liveSmallCapMovers.map((stock) => stock.symbol),
      ]
        .filter(Boolean)
        .map((symbol) => symbol.trim().toUpperCase()),
    [selectedStock, secondarySymbol, liveStocks, liveSmallCapMovers]
  );

  const selectedStockData =
    allSymbols.find((stock) => stock.symbol === selectedStock) || liveStocks[0];
  const activeMarket = marketRegions[marketRegion] || marketRegions.us;
  const regionSymbols = new Set(activeMarket.symbols);
  const displaySymbols = marketRegion === "us"
    ? allSymbols
    : allSymbols.filter((stock) => regionSymbols.has(stock.symbol));
  const tickerTapeSymbols =
    activeWorkspace === "intelligence"
      ? displaySymbols.filter((stock) => {
          const symbol = String(stock.symbol || "");
          return !symbol.includes("-USD") && !symbol.includes("/");
        })
      : displaySymbols;

  const secondaryStockData =
    allSymbols.find((stock) => stock.symbol === secondarySymbol) ||
    allSymbols.find((stock) => stock.symbol === "TSLA") ||
    liveStocks[0];

  const scannerStocks = useMemo(() => {
    const normalizeRows = (rows, source = "Provider Data") =>
      rankScannerRows(
        rows
          .map((stock) => applyLiveQuote(stock, liveQuotes))
          .map((stock, index) => normalizeScannerRow(stock, { source, updatedAt: stock.lastUpdated }, index))
      );
    const fallbackStocks = normalizeRows(liveStocks, "Watchlist Context");
    const scannerUniverse = [
      ...fmpGainers,
      ...fmpLosers,
      ...fmpActive,
      ...fmpMomentum,
      ...fmpRelativeVolume,
      ...fmpAiMovers,
      ...liveSmallCapMovers,
      ...fallbackStocks,
    ];
    const normalizedUniverse = normalizeRows(scannerUniverse, "Scanner Context");

    if (scannerTab === "Gainers") {
      return (fmpGainers.length ? normalizeRows(fmpGainers, "FMP Scanner") : fallbackStocks)
        .sort((a, b) => parsePercent(b.change) - parsePercent(a.change));
    }

    if (scannerTab === "Losers") {
      return (fmpLosers.length ? normalizeRows(fmpLosers, "FMP Scanner") : fallbackStocks)
        .sort((a, b) => parsePercent(a.change) - parsePercent(b.change));
    }

    if (scannerTab === "Active") {
      return (fmpActive.length ? normalizeRows(fmpActive, "FMP Scanner") : normalizedUniverse)
        .sort((a, b) => parseMarketVolume(b.volume) - parseMarketVolume(a.volume));
    }

    if (scannerTab === "Momentum") {
      return (fmpMomentum.length ? normalizeRows(fmpMomentum, "FMP Scanner") : normalizedUniverse)
        .sort((a, b) => getMomentumScore(b) - getMomentumScore(a))
        .slice(0, 20);
    }

    if (scannerTab === "Relative Volume") {
      return (fmpRelativeVolume.length ? normalizeRows(fmpRelativeVolume, "FMP Scanner") : normalizedUniverse)
        .sort((a, b) => getRelativeVolumeScore(b) - getRelativeVolumeScore(a))
        .slice(0, 20);
    }

    if (scannerTab === "AI Movers") {
      return (fmpAiMovers.length ? normalizeRows(fmpAiMovers, "FMP Scanner") : normalizedUniverse)
        .filter((stock) => parsePercent(stock.change) > 0)
        .sort((a, b) => getMomentumScore(b) - getMomentumScore(a))
        .slice(0, 20);
    }

    return fallbackStocks;
  }, [
    fmpActive,
    fmpAiMovers,
    fmpGainers,
    fmpLosers,
    fmpMomentum,
    fmpRelativeVolume,
    liveQuotes,
    liveSmallCapMovers,
    liveStocks,
    scannerTab,
  ]);

  const symbolSuggestions = useMemo(() => {
    const query = searchSymbol.trim().toUpperCase();
    if (!query) return [];

    const candidates = [
      ...popularSymbols.map((symbol) => ({ symbol, price: null, change: "", volume: "" })),
      ...allSymbols,
      ...scannerStocks,
    ].filter((stock) => stock?.symbol);

    return candidates
      .filter((stock, index, stocks) =>
        stocks.findIndex((item) => item.symbol === stock.symbol) === index
      )
      .filter((stock) => stock.symbol.includes(query))
      .slice(0, 6);
  }, [allSymbols, scannerStocks, searchSymbol]);

  const addSymbolToWatchlist = useCallback(
    (symbol) => {
      const cleanSymbol = normalizeTerminalSymbol(symbol);
      if (!cleanSymbol) return;

      const exists = liveStocks.some((stock) => stock.symbol === cleanSymbol);

      if (!exists) {
        const liveQuote = liveQuotes[cleanSymbol];
        const knownStock = allSymbols.find((stock) => stock.symbol === cleanSymbol);

        setLiveStocks((prev) => [
          ...prev,
          {
            symbol: cleanSymbol,
            price: Number(liveQuote?.price || knownStock?.price || 0) || null,
            change: liveQuote?.change || knownStock?.change || null,
            volume: liveQuote?.volume || knownStock?.volume || null,
            source: liveQuote?.source || knownStock?.source || "Watchlist",
            pendingQuote: !liveQuote && !knownStock,
          },
        ]);
      }

      setSelectedStock(cleanSymbol);
      if (syncCharts) setSecondarySymbol(cleanSymbol);
      setSearchSymbol("");
    },
    [allSymbols, liveQuotes, liveStocks, syncCharts]
  );

  const addSymbol = useCallback(() => {
    addSymbolToWatchlist(searchSymbol);
  }, [addSymbolToWatchlist, searchSymbol]);

  const removeWatchlistSymbol = useCallback(
    (symbol) => {
      setLiveStocks((prev) =>
        prev.length <= 1 ? prev : prev.filter((stock) => stock.symbol !== symbol)
      );

      if (selectedStock === symbol) {
        const nextStock = liveStocks.find((stock) => stock.symbol !== symbol);
        if (nextStock) setSelectedStock(nextStock.symbol);
      }

      if (secondarySymbol === symbol) {
        const nextStock = liveStocks.find((stock) => stock.symbol !== symbol);
        if (nextStock) setSecondarySymbol(nextStock.symbol);
      }
    },
    [liveStocks, secondarySymbol, selectedStock]
  );

  const selectMainSymbol = useCallback(
    (symbol, stock = null) => {
      const cleanSymbol = normalizeTerminalSymbol(symbol);
      if (!cleanSymbol) return;

      setSelectedStock(cleanSymbol);
      if (stock) setSelectedScannerStock(stock);
      if (syncCharts) setSecondarySymbol(cleanSymbol);
    },
    [setSelectedScannerStock, syncCharts]
  );

  const updateLiveQuote = useCallback(
    (symbol, price, extra = {}) => {
      const cleanSymbol = symbol?.trim?.().toUpperCase?.();
      const numericPrice = Number(price);

      if (!cleanSymbol || !numericPrice || Number.isNaN(numericPrice)) return;

      updateContextLiveQuote(cleanSymbol, numericPrice, extra);

      setLiveStocks((prev) =>
        prev.map((stock) => {
          if (stock.symbol !== cleanSymbol) return stock;

          const oldPrice = Number(stock.price || 0);
          const changePercent =
            oldPrice > 0
              ? (((numericPrice - oldPrice) / oldPrice) * 100).toFixed(2)
              : null;

          return {
            ...stock,
            price: numericPrice.toFixed(2),
            change: extra.change || (changePercent ? `${Number(changePercent) >= 0 ? "+" : ""}${changePercent}%` : stock.change || null),
            volume: extra.volume || stock.volume,
            pendingQuote: false,
          };
        })
      );
    },
    [updateContextLiveQuote]
  );

  const applySymbolWorkspace = useCallback((data) => {
    if (!data) return;

    if (data.selectedStock) setSelectedStock(data.selectedStock);
    if (data.secondarySymbol) setSecondarySymbol(data.secondarySymbol);
    if (Array.isArray(data.liveStocks)) setLiveStocks(data.liveStocks);
  }, []);

  const resetTerminalSymbols = useCallback(() => {
    setSelectedStock("NVDA");
    setSecondarySymbol("TSLA");
    setSearchSymbol("");
    setLiveStocks(defaultStocks);
  }, []);

  useEffect(() => {
    saveSetting("sb_selected_stock", selectedStock);
    saveSetting("sb_secondary_symbol", secondarySymbol);
    saveSetting("sb_watchlist", liveStocks);
  }, [liveStocks, secondarySymbol, selectedStock]);

  return {
    activeMarket,
    addSymbol,
    addSymbolToWatchlist,
    allSymbols,
    applySymbolWorkspace,
    displaySymbols,
    liveStocks,
    removeWatchlistSymbol,
    resetTerminalSymbols,
    scannerStocks,
    searchSymbol,
    secondaryStockData,
    secondarySymbol,
    selectMainSymbol,
    selectedStock,
    selectedStockData,
    setLiveStocks,
    setSearchSymbol,
    setSecondarySymbol,
    setSelectedStock,
    symbolSuggestions,
    tickerTapeSymbols,
    trackedSymbols,
    updateLiveQuote,
  };
}
