const defaults = Object.freeze({ third: { symbol: "SPY", interval: "15m" }, fourth: { symbol: "QQQ", interval: "1H" } });
const intervals = new Set(["1m", "5m", "15m", "1H", "1D"]);

export function normalizeAdditionalCharts(value) {
  return Object.fromEntries(Object.entries(defaults).map(([id, fallback]) => {
    const symbol = String(value?.[id]?.symbol || "").trim().toUpperCase();
    return [id, { symbol: /^[A-Z0-9][A-Z0-9./:-]{0,13}$/.test(symbol) ? symbol : fallback.symbol,
      interval: intervals.has(value?.[id]?.interval) ? value[id].interval : fallback.interval }];
  }));
}

export function resolveChartQuote(symbol, rows = [], fallback = null) {
  const key = String(symbol || "").trim().toUpperCase();
  const match = row => String(row?.symbol || "").trim().toUpperCase() === key;
  return rows.find(match) || (match(fallback) ? fallback : null) || { symbol: key, price: null, change: null, quality: "unavailable" };
}
