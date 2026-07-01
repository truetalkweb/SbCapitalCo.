import { useMemo } from "react";
import { dashboardMockMarketIndexes } from "../mocks/dashboardMockData";
import {
  asNumber,
  formatCompactNumber,
  formatCurrency,
  formatMultiple,
  formatNewsClock,
  formatPercent,
  formatPrice,
  formatSignedCurrency,
} from "../utils/dashboardFormatters";

function cleanSymbol(value, fallback = "AAPL") {
  const symbol = String(value || "").trim().toUpperCase();
  return symbol || fallback;
}

function nullableNumber(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = asNumber(value, NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePercent(value, fallback = null) {
  return nullableNumber(value) ?? nullableNumber(fallback);
}

function derivedScore(changePercent, relativeVolume, fallback = null) {
  const raw = nullableNumber(fallback);
  if (raw === null && (changePercent === null || relativeVolume === null)) return null;
  if (raw > 5) return Math.max(1, Math.min(99, Math.round(raw)));
  const score = 42 + Math.abs(changePercent) * 2.2 + relativeVolume * 7;
  return Math.max(35, Math.min(92, Math.round(score)));
}

function positiveNumberOrNull(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = asNumber(value, NaN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeQuote(source = {}, fallback = {}) {
  const symbol = cleanSymbol(source.symbol || fallback.symbol);
  const fallbackMatchesSymbol = cleanSymbol(fallback.symbol, "") === symbol;
  const safeFallback = fallbackMatchesSymbol ? fallback : {};
  const price = nullableNumber(source.price ?? source.last ?? source.currentPrice ?? safeFallback.price);
  const changePercent = normalizePercent(
    source.changePercent ?? source.change ?? source.changesPercentage ?? source.percentChange ?? safeFallback.changePercent,
    safeFallback.changePercent
  );
  const relativeVolume = nullableNumber(source.relativeVolume ?? source.rvol ?? safeFallback.relativeVolume);
  const explicitChange = nullableNumber(source.changeAmount ?? source.absoluteChange ?? source.changeValue ?? safeFallback.change);
  return {
    ...safeFallback,
    ...source,
    symbol,
    name: source.name || source.company || safeFallback.name || symbol,
    price,
    changePercent,
    change: explicitChange ?? (price !== null && changePercent !== null ? (price * changePercent) / 100 : null),
    volume: nullableNumber(source.volume ?? safeFallback.volume ?? safeFallback.avgVolume),
    relativeVolume,
    floatShares: source.floatShares ?? source.float ?? safeFallback.floatShares,
    sector: source.sector || safeFallback.sector || "Not reported",
    catalyst: source.catalyst || source.setup || safeFallback.catalyst || "No confirmed catalyst",
    score: derivedScore(changePercent, relativeVolume, source.score ?? source.score10 ?? safeFallback.score),
    risk: source.risk || source.riskLabel || safeFallback.risk || "Context",
  };
}

function normalizeScannerRow(row = {}, fallback = {}) {
  const quote = normalizeQuote(row, fallback);
  const gapPercent = normalizePercent(row.gapPercent ?? row.gap ?? fallback.gapPercent);
  const changePercent = quote.changePercent;
  return {
    ...quote,
    changePercent,
    gapPercent,
    volumeLabel: quote.volume === null ? "Unavailable" : formatCompactNumber(quote.volume, 1),
    rvolLabel: quote.relativeVolume === null ? "Unavailable" : formatMultiple(quote.relativeVolume, 1),
    floatLabel: quote.floatShares == null ? "Unavailable" : typeof quote.floatShares === "string" ? quote.floatShares : formatCompactNumber(quote.floatShares, 2),
  };
}

function normalizeSymbolDetails(selectedSymbol, selectedStockData, allRows) {
  const selectedFromRows = allRows.find((row) => row.symbol === selectedSymbol);
  const selectedSource = selectedStockData || selectedFromRows;
  const detailFallback = {
    symbol: selectedSymbol,
    name: selectedFromRows?.name || selectedSymbol,
    exchange: selectedFromRows?.exchange || "Not reported",
    price: selectedFromRows?.price ?? null,
    changePercent: selectedFromRows?.changePercent ?? null,
    volume: selectedFromRows?.volume ?? null,
    averageVolume: selectedFromRows?.averageVolume || null,
    marketCap: selectedFromRows?.marketCap || null,
    floatShares: selectedFromRows?.floatShares || null,
    peRatio: selectedFromRows?.peRatio || null,
    eps: selectedFromRows?.eps || null,
    beta: selectedFromRows?.beta || null,
    dividend: selectedFromRows?.dividend || null,
  };
  const quote = normalizeQuote(selectedStockData || selectedFromRows, {
    ...detailFallback,
    ...(selectedFromRows || {}),
    symbol: selectedSymbol,
  });
  return {
    ...detailFallback,
    ...quote,
    exchange: selectedStockData?.exchange || selectedStockData?.market || detailFallback.exchange,
    dayHigh: positiveNumberOrNull(selectedStockData?.dayHigh ?? selectedStockData?.high ?? quote.dayHigh),
    dayLow: positiveNumberOrNull(selectedStockData?.dayLow ?? selectedStockData?.low ?? quote.dayLow),
    open: positiveNumberOrNull(selectedStockData?.open ?? quote.open),
    previousClose: positiveNumberOrNull(selectedStockData?.previousClose ?? selectedStockData?.prevClose ?? quote.previousClose),
    averageVolume: positiveNumberOrNull(selectedStockData?.averageVolume ?? selectedStockData?.avgVolume ?? detailFallback.averageVolume),
    marketCap: positiveNumberOrNull(selectedStockData?.marketCap ?? quote.marketCap ?? detailFallback.marketCap),
    peRatio: positiveNumberOrNull(selectedStockData?.peRatio ?? selectedStockData?.pe ?? detailFallback.peRatio),
    eps: positiveNumberOrNull(selectedStockData?.eps ?? detailFallback.eps),
    beta: positiveNumberOrNull(selectedStockData?.beta ?? detailFallback.beta),
    dividend: selectedStockData?.dividend ?? detailFallback.dividend,
    yearRangeLow: positiveNumberOrNull(selectedStockData?.yearRangeLow),
    yearRangeHigh: positiveNumberOrNull(selectedStockData?.yearRangeHigh),
    dataMode: selectedSource?.dataMode || (!selectedSource
      ? "unavailable"
      : selectedSource.fallback
        ? "fallback"
        : selectedSource.cached
          ? "cached"
          : selectedSource.degraded
            ? "degraded"
            : "provider"),
  };
}

function normalizeNews(news = [], selectedSymbol) {
  const realRows = news.map((item, index) => ({
    id: item.id || item.url || `news-${index}`,
    time: formatNewsClock(item.timestamp || item.datetime || item.publishedAt || item.time),
    timestamp: item.timestamp || item.datetime || item.publishedAt,
    source: item.source || item.publisher || "Market News",
    headline: item.headline || item.title || item.summary || "Market headline update",
    relatedTicker: cleanSymbol(item.relatedTicker || item.symbol || selectedSymbol),
    sentiment: item.sentiment || "Not classified",
    impact: item.impact || "Not classified",
    summary: item.summary || item.description || "",
    url: item.url || item.link,
  }));
  return realRows.slice(0, 12);
}

function normalizePositions(positions, allRows) {
  const quoteBySymbol = new Map(allRows.map((row) => [row.symbol, row]));
  const objectRows = Object.keys(positions || {}).length
    ? Object.entries(positions).map(([symbol, pos]) => {
        const quote = quoteBySymbol.get(cleanSymbol(symbol)) || {};
        const quantity = Math.abs(asNumber(pos.quantity ?? pos.qty, 0));
        const averagePrice = asNumber(pos.average ?? pos.avgPrice ?? pos.averagePrice, quote.price || 0);
        const lastPrice = asNumber(quote.price ?? pos.lastPrice, averagePrice);
        const direction = asNumber(pos.quantity ?? pos.qty, 0) >= 0 ? "LONG" : "SHORT";
        const pnl = asNumber(pos.pnl ?? pos.unrealizedPnl, (lastPrice - averagePrice) * quantity);
        return {
          symbol: cleanSymbol(symbol),
          side: direction,
          quantity,
          averagePrice,
          lastPrice,
          pnl,
          pnlPercent: averagePrice ? ((lastPrice - averagePrice) / averagePrice) * 100 : 0,
          dayPnl: asNumber(pos.dayPnl, pnl),
        };
      })
    : [];

  return objectRows;
}

function parseAccountSummary(accountSummary, realizedPnL, totalUnrealizedPnL) {
  const rowMap = new Map((accountSummary?.rows || []).map((row) => [row.label, row.value]));
  const dailyPnl = asNumber(realizedPnL, 0) + asNumber(totalUnrealizedPnL, 0);
  const buyingPower = positiveNumberOrNull(rowMap.get("Buying Power"));
  const netLiquidation = positiveNumberOrNull(rowMap.get("Net Liquidation"));
  return {
    buyingPower,
    dailyPnl: dailyPnl || null,
    dailyPnlPercent: null,
    netLiquidation,
    marginUsed: positiveNumberOrNull(rowMap.get("Margin Used")),
    connected: Boolean(accountSummary && (buyingPower || netLiquidation)),
  };
}

export function useDashboardData({
  selectedStock,
  selectedStockData,
  liveStocks = [],
  scannerStocks = [],
  news = [],
  positions = {},
  orders = [],
  alerts = [],
  allSymbols = [],
  realizedPnL = 0,
  totalUnrealizedPnL = 0,
  accountSummary = null,
}) {
  return useMemo(() => {
    const selectedSymbol = cleanSymbol(selectedStock, "AAPL");
    const watchlistBySymbol = new Map();

    liveStocks.filter(Boolean).forEach((row) => {
      const symbol = cleanSymbol(row.symbol, "");
      if (!symbol) return;
      watchlistBySymbol.set(symbol, normalizeQuote(row, watchlistBySymbol.get(symbol)));
    });

    const watchlistRows = Array.from(watchlistBySymbol.values()).map((row) => normalizeScannerRow(row));
    const scannerRows = (scannerStocks || []).map((row) => normalizeScannerRow(row));
    const selected = normalizeSymbolDetails(selectedSymbol, selectedStockData, [...watchlistRows, ...scannerRows]);
    const marketIndexes = dashboardMockMarketIndexes.map((fallback) => {
      const real = allSymbols.find((stock) => cleanSymbol(stock.symbol, "") === fallback.symbol);
      return real
        ? { ...normalizeQuote(real, { symbol: fallback.symbol, name: fallback.name }), dataMode: real.fallback ? "fallback" : real.cached ? "cached" : real.degraded ? "degraded" : "provider" }
        : { symbol: fallback.symbol, name: fallback.name, price: null, changePercent: null, sparkline: [], dataMode: "unavailable" };
    });
    const newsRows = normalizeNews(news, selectedSymbol);
    const positionRows = normalizePositions(positions, [...watchlistRows, ...scannerRows]);
    const summary = parseAccountSummary(accountSummary, realizedPnL, totalUnrealizedPnL);

    return {
      selected,
      marketIndexes,
      watchlistRows,
      scannerRows,
      newsRows,
      positionRows,
      orders,
      alerts,
      accountSummary: {
        ...summary,
        buyingPowerLabel: summary.buyingPower ? formatCurrency(summary.buyingPower) : "Not connected",
        dailyPnlLabel: summary.dailyPnl !== null ? formatSignedCurrency(summary.dailyPnl) : "Not connected",
        netLiquidationLabel: summary.netLiquidation ? formatCurrency(summary.netLiquidation) : "Not connected",
        marginUsedLabel: summary.marginUsed ? formatCurrency(summary.marginUsed) : "Not connected",
      },
      riskOverview: [],
      status: {
        hasLiveQuotes: allSymbols.length > 0 || liveStocks.length > 0,
        hasScannerRows: scannerRows.length > 0,
        hasNews: newsRows.length > 0,
        hasAccountData: summary.connected,
        quoteMode: selected.dataMode,
        scannerMode: scannerRows.length ? "provider" : "unavailable",
        newsMode: newsRows.length ? "provider" : "unavailable",
      },
      display: {
        selectedPrice: selected.price === null ? "Unavailable" : formatPrice(selected.price),
        selectedMove: selected.change === null || selected.changePercent === null
          ? "Unavailable"
          : `${formatSignedCurrency(selected.change)} (${formatPercent(selected.changePercent)})`,
      },
    };
  }, [
    accountSummary,
    alerts,
    allSymbols,
    liveStocks,
    news,
    orders,
    positions,
    realizedPnL,
    scannerStocks,
    selectedStock,
    selectedStockData,
    totalUnrealizedPnL,
  ]);
}
