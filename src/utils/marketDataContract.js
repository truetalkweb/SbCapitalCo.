import { parseNullableMarketNumber } from "./marketNumbers.js";

export const DATA_QUALITIES = Object.freeze(["live", "delayed", "historical", "cached", "simulated", "stale", "unavailable"]);
const cleanSymbol = value => String(value || "").trim().toUpperCase();
const providerIntervals = Object.freeze({ OneMinute: "1m", FiveMinutes: "5m", FifteenMinutes: "15m", OneHour: "1H", OneDay: "1D" });
const canonicalInterval = value => providerIntervals[value] || value;

export function marketTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value)) ? Number(value) : Date.parse(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return number > 1e11 ? Math.floor(number / 1000) : Math.floor(number);
}

function provenance(payload, request) {
  const source = typeof payload.source === "string" ? payload.source : null;
  return {
    schemaVersion: 1, symbol: cleanSymbol(payload.symbol || request.symbol), interval: canonicalInterval(payload.timeframe || payload.interval || request.interval) || null,
    providerInterval: payload.providerInterval || (providerIntervals[payload.interval] ? payload.interval : null),
    source, asOf: marketTimestamp(payload.asOf), receivedAt: payload.receivedAt || new Date(request.now ?? Date.now()).toISOString(),
    observedAt: new Date(request.now ?? Date.now()).toISOString(),
    session: payload.session || payload.marketSession || null,
    isSynthetic: Boolean(payload.isSynthetic || payload.synthetic || [payload.quality, payload.dataMode].some(value => ["simulated", "synthetic", "demo"].includes(value)) || /synthetic|simulation|\bdemo\b/i.test(source || "")),
    cached: Boolean(payload.cached || payload.isCached || [payload.quality, payload.dataMode].includes("cached")),
    delayed: Boolean(payload.delayed || payload.isDelayed || payload.realtime === false || [payload.quality, payload.dataMode].includes("delayed")),
    degraded: Boolean(payload.degraded), fallback: Boolean(payload.fallback || payload.isFallback),
  };
}

export function normalizeCandleDataset(payload, request) {
  const raw = payload && typeof payload === "object" ? payload : {};
  const meta = provenance(raw, request);
  const unavailable = reason => ({ ...meta, quality: meta.isSynthetic ? "simulated" : "unavailable", candles: [], reason });
  if (!raw.symbol || cleanSymbol(raw.symbol) !== cleanSymbol(request.symbol)) return unavailable("Chart response instrument does not match the request");
  if (!(raw.timeframe || raw.interval) || [raw.timeframe, raw.interval, raw.providerInterval].filter(Boolean).some(interval => canonicalInterval(interval) !== request.interval)) {
    return unavailable("Chart response interval is missing or does not match the request");
  }
  if (!meta.source) return unavailable("Chart source is missing");
  if (meta.isSynthetic || meta.fallback || meta.degraded || raw.quality === "unavailable") return unavailable("Verified historical candles are unavailable");
  if (!Array.isArray(raw.candles) || !raw.candles.length) return unavailable("No historical candles returned");
  const candles = [];
  const seen = new Map();
  for (const row of raw.candles) {
    const rowMeta = row && provenance(row, request);
    if (!row || (row.symbol && cleanSymbol(row.symbol) !== meta.symbol) || rowMeta.isSynthetic || rowMeta.fallback || rowMeta.degraded) return unavailable("Invalid candle provenance");
    const candle = { time: marketTimestamp(row.time), open: parseNullableMarketNumber(row.open), high: parseNullableMarketNumber(row.high),
      low: parseNullableMarketNumber(row.low), close: parseNullableMarketNumber(row.close), volume: parseNullableMarketNumber(row.volume) };
    if (candle.time === null || [candle.open, candle.high, candle.low, candle.close].some(value => value === null || value <= 0)
      || candle.high < Math.max(candle.open, candle.close, candle.low) || candle.low > Math.min(candle.open, candle.close)
      || (candle.volume !== null && candle.volume < 0)) return unavailable("Malformed historical candle");
    if (seen.has(candle.time)) {
      if (JSON.stringify(seen.get(candle.time)) !== JSON.stringify(candle)) return unavailable("Conflicting candles share a timestamp");
      continue;
    }
    seen.set(candle.time, candle);
    candles.push(candle);
  }
  candles.sort((a, b) => a.time - b.time);
  return { ...meta, asOf: candles.at(-1).time, quality: meta.cached ? "cached" : meta.delayed ? "delayed" : "historical", candles, reason: null };
}

export function normalizeMarketQuote(quote, { symbol = quote?.symbol, now = Date.now(), maxAgeMs = 30000 } = {}) {
  const raw = quote || {};
  const meta = provenance(raw, { symbol, now });
  const asOf = raw.timestampSource === "received" ? null : marketTimestamp(raw.asOf ?? raw.lastTradeTime ?? raw.timestamp ?? raw.t);
  const price = parseNullableMarketNumber(raw.price ?? raw.lastTradePrice ?? raw.last ?? raw.close);
  let quality = "unavailable";
  if (meta.isSynthetic) quality = "simulated";
  else if (meta.cached) quality = "cached";
  else if (meta.delayed) quality = "delayed";
  else if ([raw.quality, raw.dataMode].includes("historical")) quality = "historical";
  else if (asOf !== null && (now - asOf * 1000 > maxAgeMs || raw.stale || [raw.quality, raw.dataMode].includes("stale"))) quality = "stale";
  else if (asOf !== null && asOf * 1000 <= now + 5000 && meta.source && !meta.degraded && !meta.fallback && price !== null && price > 0) quality = "live";
  if (!raw.symbol || cleanSymbol(raw.symbol) !== cleanSymbol(symbol) || raw.quality === "unavailable" || raw.dataMode === "unavailable" || price === null || price <= 0) quality = "unavailable";
  return { ...meta, asOf, price, quality, change: parseNullableMarketNumber(raw.changePercent ?? raw.change), volume: parseNullableMarketNumber(raw.volume) };
}

export function isEligibleAlertQuote(quote, symbol, now = Date.now()) {
  const normalized = normalizeMarketQuote(quote, { symbol, now });
  return normalized.quality === "live" && normalized.price !== null && normalized.price > 0;
}

export function isProviderSampleRow(row) {
  const quote = normalizeMarketQuote(row);
  return Boolean(quote.source && !quote.isSynthetic && !quote.fallback && !quote.degraded
    && ["live", "cached", "delayed", "historical", "stale"].includes(quote.quality));
}

export function normalizeQuoteEvent(quote, payload = {}, now = Date.now()) {
  const normalized = normalizeMarketQuote({ ...payload, ...quote,
    symbol: quote.symbol || quote.s,
    price: quote.price ?? quote.p ?? quote.lastTradePrice ?? quote.lastTradePriceTrHrs,
    volume: quote.volume ?? quote.v,
    isSynthetic: Boolean(quote.isSynthetic || payload.isSynthetic),
    fallback: Boolean(quote.fallback || quote.isFallback || payload.fallback),
    cached: Boolean(quote.cached || quote.isCached || payload.cached),
    delayed: Boolean(quote.delayed || payload.delayed),
    degraded: Boolean(quote.degraded || payload.degraded),
  }, { now });
  return { ...normalized, s: normalized.symbol, p: normalized.price, v: normalized.volume,
    t: normalized.asOf, sourceTimestamp: normalized.asOf,
    timestampSource: normalized.asOf === null ? "unavailable" : "provider",
    realtime: quote.realtime ?? payload.realtime ?? null, transport: payload.stream?.transport || null,
    bidPrice: parseNullableMarketNumber(quote.bidPrice), askPrice: parseNullableMarketNumber(quote.askPrice),
    lastTradeSize: parseNullableMarketNumber(quote.lastTradeSize) };
}

export function mergeQuoteSnapshot(previous, incoming, now = Date.now()) {
  const quote = normalizeMarketQuote(incoming, { now });
  const sameSymbol = previous?.symbol === quote.symbol;
  const prior = sameSymbol ? normalizeMarketQuote(previous, { now }) : null;
  if (prior?.asOf !== null && prior?.asOf !== undefined && quote.asOf !== null && quote.asOf < prior.asOf) return previous;
  return { ...(sameSymbol ? previous : {}), ...incoming, ...quote,
    realtime: incoming.realtime ?? null, isDelayed: quote.delayed, isCached: quote.cached, isFallback: quote.fallback,
    synthetic: quote.isSynthetic, dataMode: quote.quality, stale: quote.quality === "stale",
    changePercent: quote.change, timestamp: quote.asOf, t: quote.asOf,
    lastTradeTime: incoming.lastTradeTime ?? null,
    timestampSource: quote.asOf === null ? "unavailable" : "provider",
    v: quote.volume, bidPrice: parseNullableMarketNumber(incoming.bidPrice), askPrice: parseNullableMarketNumber(incoming.askPrice),
    pendingQuote: quote.price === null, lastUpdated: now };
}

export function aggregateQuoteQuality(quotes, now = Date.now()) {
  const qualities = new Set(quotes.map(quote => normalizeMarketQuote(quote, { now }).quality));
  return qualities.size === 0 ? "unavailable" : qualities.size === 1 ? [...qualities][0] : "mixed";
}
