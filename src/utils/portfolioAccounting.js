import { parseNullableMarketNumber as number } from "./marketNumbers.js";

const round = value => Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : null;
export function sumKnown(values) {
  return values.every(value => typeof value === "number" && Number.isFinite(value))
    ? round(values.reduce((sum, value) => sum + value, 0)) : null;
}

// A position keeps signed quantity. Gross exposure is a separate measurement.
export function buildPositionRows(positions = {}, quotes = []) {
  return Object.entries(positions).map(([symbol, position]) => {
    const qty = number(position.quantity ?? position.qty);
    const avg = number(position.average ?? position.avgPrice);
    const quote = quotes.find(row => row.symbol === symbol);
    const rawMark = number(quote?.price);
    const excluded = quote?.isSynthetic || quote?.synthetic || quote?.isFallback || quote?.fallback
      || [quote?.quality, quote?.dataMode].some(value => ["synthetic", "simulated", "unavailable"].includes(value));
    const last = !excluded && rawMark > 0 ? rawMark : null;
    const marketValue = last !== null && qty !== null ? round(last * qty) : null;
    const unrealizedPnl = last !== null && avg !== null && qty !== null ? round((last - avg) * qty) : null;
    return { symbol, qty, avg, last, marketValue, unrealizedPnl,
      grossExposure: marketValue === null ? null : Math.abs(marketValue),
      side: qty === null ? "UNKNOWN" : qty < 0 ? "SHORT" : "LONG",
      source: position.source || "Workspace / paper", accountId: position.accountId || "Local workspace",
      currency: String(position.currency || "USD").toUpperCase(),
      markQuality: last === null ? "unavailable" : quote?.quality || quote?.dataMode || "reported",
      asOf: quote?.asOf ?? quote?.lastUpdated ?? null,
      dayPnl: number(position.dayPnl), totalPnl: unrealizedPnl,
      beta: number(position.beta), var1d: number(position.var1d), risk: position.riskScore || "Context",
    };
  }).filter(row => row.qty !== 0);
}

export function summarizePositions(rows = []) {
  const currencies = [...new Set(rows.map(row => row.currency || "USD"))];
  const comparable = currencies.length <= 1;
  const grossExposure = comparable ? sumKnown(rows.map(row => row.grossExposure)) : null;
  return { currency: currencies.length === 1 ? currencies[0] : currencies.length ? "Mixed currencies" : "USD",
    missingMarks: rows.filter(row => row.last === null).length,
    grossExposure, netExposure: comparable ? sumKnown(rows.map(row => row.marketValue)) : null,
    unrealizedPnl: comparable ? sumKnown(rows.map(row => row.unrealizedPnl)) : null,
    largestWeight: grossExposure > 0 ? Math.max(...rows.map(row => row.grossExposure), 0) / grossExposure * 100 : null,
  };
}
