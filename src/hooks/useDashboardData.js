import { useMemo } from "react";
import {
  dashboardMockAccountSummary,
  dashboardMockMarketIndexes,
  dashboardMockNews,
  dashboardMockPositions,
  dashboardMockScannerRows,
  dashboardMockSymbolDetails,
  dashboardMockWatchlist,
  dashboardMockRiskOverview,
} from "../mocks/dashboardMockData";
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

function normalizePercent(value, fallback = 0.24) {
  return asNumber(value, fallback);
}

function derivedScore(changePercent, relativeVolume, fallback = 61) {
  const raw = asNumber(fallback, 61);
  if (raw > 5) return Math.max(1, Math.min(99, Math.round(raw)));
  const score = 42 + Math.abs(asNumber(changePercent, 0)) * 2.2 + asNumber(relativeVolume, 1) * 7;
  return Math.max(35, Math.min(92, Math.round(score)));
}

function positiveNumber(value, fallback) {
  const parsed = asNumber(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function normalizeQuote(source = {}, fallback = {}) {
  const symbol = cleanSymbol(source.symbol || fallback.symbol);
  const fallbackMatchesSymbol = cleanSymbol(fallback.symbol, "") === symbol;
  const safeFallback = fallbackMatchesSymbol ? fallback : {};
  const price = asNumber(source.price ?? source.last ?? source.currentPrice ?? safeFallback.price, safeFallback.price || 0);
  const changePercent = normalizePercent(
    source.changePercent ?? source.change ?? source.changesPercentage ?? source.percentChange ?? safeFallback.changePercent,
    safeFallback.changePercent || 0.24
  );
  const relativeVolume = asNumber(source.relativeVolume ?? source.rvol ?? safeFallback.relativeVolume, safeFallback.relativeVolume || 1.4);
  return {
    ...safeFallback,
    ...source,
    symbol,
    name: source.name || source.company || safeFallback.name || `${symbol} Equity`,
    price,
    changePercent,
    change: asNumber(source.changeAmount ?? source.absoluteChange ?? source.changeValue ?? safeFallback.change, (price * changePercent) / 100),
    volume: source.volume ?? safeFallback.volume ?? safeFallback.avgVolume ?? 0,
    relativeVolume,
    floatShares: source.floatShares ?? source.float ?? safeFallback.floatShares,
    sector: source.sector || safeFallback.sector || "Market Context",
    catalyst: source.catalyst || source.setup || safeFallback.catalyst || "Market Context",
    score: derivedScore(changePercent, relativeVolume, source.score ?? source.score10 ?? safeFallback.score),
    risk: source.risk || source.riskLabel || safeFallback.risk || "Context",
  };
}

function normalizeScannerRow(row = {}, fallback = {}) {
  const quote = normalizeQuote(row, fallback);
  const gapPercent = normalizePercent(row.gapPercent ?? row.gap ?? fallback.gapPercent, quote.changePercent);
  const changePercent = Math.abs(quote.changePercent) < 0.01 && Math.abs(gapPercent) >= 0.01 ? gapPercent : quote.changePercent;
  return {
    ...quote,
    changePercent,
    gapPercent,
    volumeLabel: typeof quote.volume === "string" ? quote.volume : formatCompactNumber(quote.volume, 1),
    rvolLabel: formatMultiple(quote.relativeVolume, 1),
    floatLabel: typeof quote.floatShares === "string" ? quote.floatShares : formatCompactNumber(quote.floatShares, 2),
  };
}

function normalizeSymbolDetails(selectedSymbol, selectedStockData, allRows) {
  const selectedFromRows = allRows.find((row) => row.symbol === selectedSymbol);
  const mockMatchesSelected = dashboardMockSymbolDetails.symbol === selectedSymbol;
  const detailFallback = mockMatchesSelected
    ? dashboardMockSymbolDetails
    : {
        symbol: selectedSymbol,
        name: selectedFromRows?.name || `${selectedSymbol} Equity`,
        exchange: selectedFromRows?.exchange || "NASDAQ",
        price: selectedFromRows?.price || dashboardMockSymbolDetails.price,
        changePercent: selectedFromRows?.changePercent || 0.24,
        volume: selectedFromRows?.volume || dashboardMockSymbolDetails.volume,
        averageVolume: selectedFromRows?.averageVolume || dashboardMockSymbolDetails.averageVolume,
        marketCap: selectedFromRows?.marketCap,
        floatShares: selectedFromRows?.floatShares,
        peRatio: selectedFromRows?.peRatio,
        eps: selectedFromRows?.eps,
        beta: selectedFromRows?.beta,
        dividend: selectedFromRows?.dividend,
      };
  const quote = normalizeQuote(selectedStockData || selectedFromRows, {
    ...detailFallback,
    ...(selectedFromRows || {}),
    symbol: selectedSymbol || dashboardMockSymbolDetails.symbol,
  });
  const fallbackPrice = quote.price || dashboardMockSymbolDetails.price;
  return {
    ...detailFallback,
    ...quote,
    exchange: selectedStockData?.exchange || selectedStockData?.market || detailFallback.exchange || "NASDAQ",
    dayHigh: positiveNumber(selectedStockData?.dayHigh ?? selectedStockData?.high ?? quote.dayHigh, fallbackPrice * 1.012),
    dayLow: positiveNumber(selectedStockData?.dayLow ?? selectedStockData?.low ?? quote.dayLow, fallbackPrice * 0.986),
    open: positiveNumber(selectedStockData?.open ?? quote.open, fallbackPrice * 0.989),
    previousClose: positiveNumber(selectedStockData?.previousClose ?? selectedStockData?.prevClose ?? quote.previousClose, fallbackPrice * 0.982),
    averageVolume: positiveNumber(selectedStockData?.averageVolume ?? selectedStockData?.avgVolume ?? detailFallback.averageVolume ?? quote.volume, quote.volume),
    marketCap: positiveNumber(selectedStockData?.marketCap ?? quote.marketCap ?? detailFallback.marketCap, fallbackPrice * 1_000_000_000),
    peRatio: positiveNumber(selectedStockData?.peRatio ?? selectedStockData?.pe ?? detailFallback.peRatio, 28.41),
    eps: positiveNumber(selectedStockData?.eps ?? detailFallback.eps, 10.49),
    beta: positiveNumber(selectedStockData?.beta ?? detailFallback.beta, 1.23),
    dividend: selectedStockData?.dividend ?? detailFallback.dividend,
    yearRangeLow: selectedStockData?.yearRangeLow ?? fallbackPrice * 0.72,
    yearRangeHigh: selectedStockData?.yearRangeHigh ?? fallbackPrice * 1.08,
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
    sentiment: item.sentiment || (index % 4 === 0 ? "Neutral" : "Bullish"),
    impact: item.impact || (index % 3 === 0 ? "High" : "Medium"),
    summary: item.summary || item.description || "",
    url: item.url || item.link,
  }));
  const fallbackRows = dashboardMockNews.map((item) => ({
    ...item,
    time: formatNewsClock(item.timestamp),
    relatedTicker: item.relatedTicker || selectedSymbol,
  }));
  return (realRows.length ? realRows : fallbackRows).slice(0, 12);
}

function normalizePositions(positions, allRows, selectedSymbol) {
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

  if (objectRows.length) return objectRows;
  const selected = quoteBySymbol.get(selectedSymbol);
  return dashboardMockPositions.map((row) => ({
    ...row,
    symbol: selected?.symbol || row.symbol,
    averagePrice: selected?.price ? selected.price * 0.982 : row.averagePrice,
    lastPrice: selected?.price || row.lastPrice,
    pnl: selected?.price ? (selected.price - selected.price * 0.982) * row.quantity : row.pnl,
    pnlPercent: selected?.price ? 1.83 : row.pnlPercent,
    dayPnl: selected?.price ? (selected.price - selected.price * 0.982) * row.quantity : row.dayPnl,
  }));
}

function parseAccountSummary(accountSummary, realizedPnL, totalUnrealizedPnL) {
  const fallback = dashboardMockAccountSummary;
  const rowMap = new Map((accountSummary?.rows || []).map((row) => [row.label, row.value]));
  const dailyPnl = asNumber(realizedPnL, 0) + asNumber(totalUnrealizedPnL, 0);
  return {
    buyingPower: asNumber(rowMap.get("Buying Power"), fallback.buyingPower),
    dailyPnl: dailyPnl || asNumber(rowMap.get("Daily P&L"), fallback.dailyPnl),
    dailyPnlPercent: fallback.dailyPnlPercent,
    netLiquidation: asNumber(rowMap.get("Net Liquidation"), fallback.netLiquidation),
    marginUsed: fallback.marginUsed,
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
    const selectedSymbol = cleanSymbol(selectedStock, dashboardMockSymbolDetails.symbol);
    const watchlistBySymbol = new Map(dashboardMockWatchlist.map((row) => [row.symbol, row]));

    [...allSymbols, ...liveStocks, selectedStockData].filter(Boolean).forEach((row) => {
      const symbol = cleanSymbol(row.symbol, "");
      if (!symbol) return;
      watchlistBySymbol.set(symbol, normalizeQuote(row, watchlistBySymbol.get(symbol)));
    });

    const watchlistRows = Array.from(watchlistBySymbol.values()).map((row) => normalizeScannerRow(row));
    const scannerRows = (scannerStocks?.length ? scannerStocks : dashboardMockScannerRows).map((row, index) =>
      normalizeScannerRow(row, dashboardMockScannerRows[index] || dashboardMockScannerRows[0])
    );
    const selected = normalizeSymbolDetails(selectedSymbol, selectedStockData, [...watchlistRows, ...scannerRows]);
    const marketIndexes = dashboardMockMarketIndexes.map((fallback) => {
      const real = allSymbols.find((stock) => cleanSymbol(stock.symbol, "") === fallback.symbol);
      return normalizeQuote(real, fallback);
    });
    const newsRows = normalizeNews(news, selectedSymbol);
    const positionRows = normalizePositions(positions, [...watchlistRows, ...scannerRows], selectedSymbol);
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
        buyingPowerLabel: formatCurrency(summary.buyingPower),
        dailyPnlLabel: `${formatSignedCurrency(summary.dailyPnl)} (${formatPercent(summary.dailyPnlPercent)})`,
        netLiquidationLabel: formatCurrency(summary.netLiquidation),
        marginUsedLabel: formatCurrency(summary.marginUsed),
      },
      riskOverview: dashboardMockRiskOverview.map((row) => ({
        ...row,
        value: row.label === "Buying Power" ? formatCurrency(summary.buyingPower) : row.value,
      })),
      status: {
        hasLiveQuotes: allSymbols.length > 0 || liveStocks.length > 0,
        hasScannerRows: scannerRows.length > 0,
        hasNews: newsRows.length > 0,
      },
      display: {
        selectedPrice: formatPrice(selected.price),
        selectedMove: `${formatSignedCurrency(selected.change)} (${formatPercent(selected.changePercent)})`,
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
