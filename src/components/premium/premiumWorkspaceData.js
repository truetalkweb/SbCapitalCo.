import {
  formatCompactNumber,
  formatPrice,
} from "../../utils/dashboardFormatters.js";
import {
  createNormalizedNewsFallback,
  normalizeNewsRow,
  normalizeScannerRow,
  rankScannerRows,
} from "../../utils/scannerNewsAdapters.js";
import { formatPacificDateTime } from "../../utils/timeFormatters.js";

export function num(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/[$,%+,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function money(value, digits = 2) {
  return `$${num(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function pct(value, digits = 2) {
  const parsed = num(value);
  return `${parsed >= 0 ? "+" : ""}${parsed.toFixed(digits)}%`;
}

export function moveOf(row) {
  return num(row?.changePercent ?? row?.change ?? row?.changesPercentage ?? row?.percentChange);
}

export function hasNumericValue(value) {
  if (value === null || typeof value === "undefined" || value === "") return false;
  return Number.isFinite(Number(String(value).replace(/[$,%+,x]/g, "").trim()));
}

export function nullableMoveOf(row) {
  const value = row?.changePercent ?? row?.change ?? row?.changesPercentage ?? row?.percentChange;
  return hasNumericValue(value) ? num(value) : null;
}

export function toneColor(theme, value) {
  return num(value) >= 0 ? theme.green : theme.red;
}

export function formatDetailValue(label, value) {
  if (value === null || typeof value === "undefined" || value === "") return "Unavailable";
  if (label === "Volume" || label === "Avg Vol") {
    return typeof value === "string" ? value : formatCompactNumber(value, 2);
  }
  if (label === "Market Cap" || label === "Float") {
    return typeof value === "string" ? value : formatCompactNumber(value, 2);
  }
  if (label === "P/E" || label === "Beta" || label === "EPS") {
    return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : String(value);
  }
  return Number.isFinite(Number(value)) ? formatPrice(value) : String(value);
}

export function buildStocks(liveStocks, scannerStocks, selectedStockData, selectedStock) {
  const bySymbol = new Map();
  const cleanScannerRows = rankScannerRows(
    [...(scannerStocks || []), ...(liveStocks || []), selectedStockData]
      .filter(Boolean)
      .map((stock, index) => normalizeScannerRow(
        stock,
        { source: stock.source || "Terminal Data", updatedAt: stock.lastUpdated },
        index,
      )),
  );

  cleanScannerRows.forEach((stock) => {
    const symbol = String(stock.symbol || "").toUpperCase();
    if (!symbol) return;
    bySymbol.set(symbol, {
      ...(bySymbol.get(symbol) || {}),
      ...stock,
      symbol,
      name: stock.name || stock.company || bySymbol.get(symbol)?.name || symbol,
      price: hasNumericValue(stock.price)
        ? num(stock.price)
        : bySymbol.get(symbol)?.price ?? null,
      change: hasNumericValue(stock.changePercent ?? stock.change)
        ? num(stock.changePercent ?? stock.change)
        : bySymbol.get(symbol)?.change ?? null,
      volume: stock.volume ?? bySymbol.get(symbol)?.volume ?? null,
      rvol: stock.rvol ?? stock.relativeVolume ?? bySymbol.get(symbol)?.rvol ?? null,
      float: stock.float ?? bySymbol.get(symbol)?.float ?? null,
      sector: stock.sector || bySymbol.get(symbol)?.sector || "Not reported",
      setup: stock.catalyst || stock.setup || bySymbol.get(symbol)?.setup || "No confirmed catalyst",
      score: stock.scannerScore ?? stock.score ?? stock.score10 ?? bySymbol.get(symbol)?.score ?? null,
      risk: stock.risk || stock.riskLabel || bySymbol.get(symbol)?.risk || "Context",
      gapPercent: stock.gapPercent,
      catalyst: stock.catalyst,
      whyMoving: stock.whyMoving,
      dataMode: stock.isSynthetic
        ? "synthetic"
        : stock.isFallback || stock.fallback
          ? "fallback"
          : stock.isCached
            ? "cached"
            : stock.degraded
              ? "degraded"
              : "provider",
    });
  });

  const requestedSymbol = String(selectedStock || selectedStockData?.symbol || "AAPL").toUpperCase();
  if (!bySymbol.has(requestedSymbol)) {
    const rawPrice = selectedStockData?.price ?? selectedStockData?.last ?? selectedStockData?.currentPrice;
    const rawChange = selectedStockData?.changePercent ?? selectedStockData?.change ?? selectedStockData?.percentChange;
    bySymbol.set(requestedSymbol, {
      ...(selectedStockData || {}),
      symbol: requestedSymbol,
      name: selectedStockData?.name || selectedStockData?.company || requestedSymbol,
      price: hasNumericValue(rawPrice) ? num(rawPrice) : null,
      change: hasNumericValue(rawChange) ? num(rawChange) : null,
      changePercent: hasNumericValue(rawChange) ? num(rawChange) : null,
      volume: selectedStockData?.volume ?? null,
      rvol: selectedStockData?.rvol ?? selectedStockData?.relativeVolume ?? null,
      float: selectedStockData?.float ?? selectedStockData?.floatShares ?? null,
      sector: selectedStockData?.sector || "Not reported",
      setup: selectedStockData?.catalyst || "Data unavailable",
      score: selectedStockData?.score ?? null,
      risk: selectedStockData?.risk || "Context",
      dataMode: selectedStockData?.dataMode || (selectedStockData?.fallback
        ? "fallback"
        : selectedStockData?.cached
          ? "cached"
          : selectedStockData?.degraded
            ? "degraded"
            : selectedStockData
              ? "provider"
              : "unavailable"),
    });
  }

  return Array.from(bySymbol.values()).slice(0, 16);
}

export function makeNews(news, selectedSymbol) {
  const real = (news || [])
    .map((item, index) => normalizeNewsRow(item, index, selectedSymbol))
    .filter((item) => item?.headline);
  const fallback = createNormalizedNewsFallback(selectedSymbol);
  return (real.length ? real : fallback).slice(0, 12);
}

export function makeJournalTrades(entries) {
  return (entries || []).map((entry) => {
    const pnl = num(entry.pnl ?? entry.netPnl ?? entry.resultAmount, 0);
    return {
      id: entry.id,
      date: entry.createdAt
        ? formatPacificDateTime(entry.createdAt, { fallback: "Not recorded" })
        : entry.date || "Not recorded",
      symbol: entry.symbol || "Unspecified",
      setup: entry.setup || entry.tags || "Review",
      side: entry.bias || entry.side || "Long",
      qty: entry.quantity || entry.qty || 0,
      entry: entry.entryPrice || entry.entry || "Not recorded",
      exit: entry.exitPrice || entry.exit || "Not recorded",
      pnl,
      pnlPct: entry.pnlPct || "Not recorded",
      r: entry.rMultiple || entry.r || "Not recorded",
      hold: entry.holdTime || "Not recorded",
      outcome: entry.result || entry.outcome || "Review",
      tag: entry.tags || entry.setup || "Review",
      notes: entry.notes || entry.review || "No notes",
    };
  }).slice(0, 12);
}

export function makeReplayTrades(replayTrades, selectedSymbol) {
  return (replayTrades || []).map((trade, index) => ({
    time: trade.time || trade.timestamp?.slice(11, 19) || `Step ${index + 1}`,
    symbol: trade.symbol || selectedSymbol,
    side: trade.type || trade.side || "Buy",
    qty: trade.quantity || trade.qty || 0,
    price: trade.price || trade.fillPrice || "Pending",
    pnl: trade.pnl ? money(trade.pnl) : "Pending",
  })).slice(0, 10);
}
