import { newsFallbackRows, scannerFallbackRows } from "../mocks/scannerNewsMockData.js";

const BAD_TEXT = /^(unknown|n\/a|null|undefined|-|--|\$100\+|placeholder)$/i;
const PROVIDER_LIMITED_RE = /429|rate|quota|limit|limited|restricted|subscription|plan/i;

function text(value, fallback = "") {
  const clean = String(value ?? "").trim();

  if (!clean || BAD_TEXT.test(clean)) return fallback;
  return clean.replace(/\s+/g, " ");
}

function symbolOf(value) {
  const clean = text(value).toUpperCase();
  return /^[A-Z0-9][A-Z0-9./:-]{0,13}$/.test(clean) ? clean : "";
}

export function numeric(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;

  const clean = String(value ?? "")
    .replace(/[$,%+,x]/gi, "")
    .replace(/,/g, "")
    .trim()
    .toUpperCase();
  const parsed = parseFloat(clean);

  if (!Number.isFinite(parsed)) return fallback;
  if (clean.includes("T")) return parsed * 1_000_000_000_000;
  if (clean.includes("B")) return parsed * 1_000_000_000;
  if (clean.includes("M")) return parsed * 1_000_000;
  if (clean.includes("K")) return parsed * 1_000;

  return parsed;
}

function numericOrNull(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = numeric(value, NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function compact(value, digits = 1) {
  const parsed = Math.abs(Number(value || 0));
  const sign = Number(value || 0) < 0 ? "-" : "";

  if (parsed >= 1_000_000_000_000) return `${sign}${(parsed / 1_000_000_000_000).toFixed(digits)}T`;
  if (parsed >= 1_000_000_000) return `${sign}${(parsed / 1_000_000_000).toFixed(digits)}B`;
  if (parsed >= 1_000_000) return `${sign}${(parsed / 1_000_000).toFixed(digits)}M`;
  if (parsed >= 1_000) return `${sign}${(parsed / 1_000).toFixed(digits)}K`;

  return `${sign}${Math.max(1, Math.round(parsed))}`;
}

function signedPercent(value, digits = 2) {
  const parsed = Number(value || 0);
  return `${parsed >= 0 ? "+" : ""}${parsed.toFixed(digits)}%`;
}

function normalizeTimestamp(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const candidate = typeof value === "number" && value < 10_000_000_000 ? value * 1000 : value;
  const parsed = new Date(candidate);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function freshnessOf(timestamp, meta = {}) {
  if (meta.cached) return "Cached";
  if (meta.fallback || meta.degraded) return "Fallback Context";

  const age = Date.now() - new Date(timestamp).getTime();
  if (age <= 10 * 60_000) return "Live";
  if (age <= 60 * 60_000) return "Cached";

  return "Provider Limited";
}

export function cleanConfidenceLabel(meta = {}) {
  const raw = [
    meta.statusLabel,
    meta.providerStatus?.label,
    meta.source,
    meta.provider,
    meta.warning,
    meta.lastWarning,
    ...(Array.isArray(meta.warnings) ? meta.warnings : []),
    ...(Array.isArray(meta.providerWarnings) ? meta.providerWarnings : []),
  ].filter(Boolean).join(" ");

  if (meta.fallback || meta.degraded && /fallback|unavailable/i.test(raw)) return "Fallback Context";
  if (meta.cached) return "Cached";
  if (PROVIDER_LIMITED_RE.test(raw) || meta.providerStatus?.providerLimited) return "Provider Limited";
  if (/live|fmp|finnhub|yahoo|questrade|qtrd|backend/i.test(raw)) return "Live";

  return meta.degraded ? "Fallback Context" : "Live";
}

function catalystText(row, symbol, changePercent, rvol, gapPercent) {
  const supplied = text(row.catalyst || row.news || row.reason || row.headline || row.whyMoving || row.description);

  if (supplied && !/watch for confirmation|unknown|placeholder/i.test(supplied)) return supplied;
  if (Math.abs(changePercent) >= 5 && rvol >= 2) return `${symbol} is moving on strong intraday momentum and elevated relative volume.`;
  if (Math.abs(gapPercent) >= 1.5) return `${symbol} is active after a notable session gap with confirmed participation.`;
  if (rvol >= 1.8) return `${symbol} is drawing above-average volume versus its normal tape.`;

  return `${symbol} is ranked from available scanner context; verify the move against live market data.`;
}

function riskOf({ changePercent, relativeVolume, price, floatValue }) {
  const absMove = Math.abs(changePercent);
  if ((absMove >= 10 && relativeVolume >= 3) || (price < 5 && absMove >= 5) || (floatValue > 0 && floatValue < 25_000_000 && absMove >= 6)) {
    return "High";
  }
  if (absMove >= 4 || relativeVolume >= 2 || (floatValue > 0 && floatValue < 75_000_000)) return "Elevated";
  return "Controlled";
}

function scoreRow({ changePercent, gapPercent, relativeVolume, volume, catalyst, timestamp, risk }) {
  const ageMinutes = Math.max(0, (Date.now() - new Date(timestamp).getTime()) / 60_000);
  const catalystBoost = catalyst && !/fallback|context only/i.test(catalyst) ? 10 : 4;
  const freshnessBoost = ageMinutes <= 10 ? 10 : ageMinutes <= 60 ? 5 : 1;
  const riskPenalty = risk === "High" ? 5 : 0;
  const score =
    Math.abs(changePercent) * 4.8 +
    Math.min(relativeVolume, 8) * 6.2 +
    Math.abs(gapPercent) * 2.2 +
    Math.min(volume / 1_000_000, 30) * 0.75 +
    catalystBoost +
    freshnessBoost -
    riskPenalty;

  return Math.round(Math.max(1, Math.min(99, score)));
}

export function normalizeScannerRow(row, meta = {}) {
  const symbol = symbolOf(row?.symbol || row?.ticker);
  if (!symbol) return null;
  const fallbackMode = Boolean(row.isFallback || row.fallback || meta.fallback);
  const syntheticMode = Boolean(row.isSynthetic || row.synthetic);

  const price = numericOrNull(row.price ?? row.currentPrice ?? row.last ?? row.close);
  if (price === null || price <= 0) return null;

  const changePercent = numericOrNull(row.changePercent ?? row.changesPercentage ?? row.percentChange ?? row.change);
  const gapPercent = numericOrNull(row.gapPercent ?? row.gap ?? row.openGap);

  const volume = numericOrNull(row.volume ?? row.vol ?? row.dayVolume);
  if (volume === null || volume <= 0) return null;

  let relativeVolume = numericOrNull(row.relativeVolume ?? row.rvol ?? row.volumeRatio ?? row.volumePercentOfAvg);
  if (relativeVolume > 25) relativeVolume /= 100;

  const floatValue = numericOrNull(row.float ?? row.floatShares ?? row.sharesFloat ?? row.freeFloat);
  const timestamp = normalizeTimestamp(
    row.providerTimestamp || row.timestamp || row.updatedAt || row.lastUpdated || meta.updatedAt
  );
  const catalyst = catalystText(row, symbol, changePercent || 0, relativeVolume || 0, gapPercent || 0);
  const risk = text(row.risk || row.riskLabel, "") || riskOf({ changePercent: changePercent || 0, relativeVolume: relativeVolume || 0, price, floatValue: floatValue || 0 });
  const scannerScore = numeric(row.score ?? row.scannerScore, 0);
  const score = scannerScore > 0
    ? Number(Math.min(99, scannerScore).toFixed(1))
    : scoreRow({ changePercent: changePercent || 0, gapPercent: gapPercent || 0, relativeVolume: relativeVolume || 0, volume, catalyst, timestamp, risk });
  const freshness = text(row.freshness, "") || freshnessOf(timestamp, meta);
  const dataStatus = cleanConfidenceLabel({
    ...meta,
    source: row.source || meta.source,
    provider: row.provider || meta.provider,
    fallback: row.fallback || meta.fallback,
    degraded: row.degraded || meta.degraded,
  });
  const trustTier = numericOrNull(row.trustTier) ?? (row.verified ? 3 : syntheticMode ? 1 : 2);
  const source = text(row.source || meta.source, "Scanner Engine");

  return {
    ...row,
    id: row.id || `${symbol}-${timestamp}`,
    symbol,
    name: text(row.name || row.company || row.companyName, `${symbol} Equity`),
    price,
    currentPrice: price,
    changePercent,
    change: changePercent === null ? "Unavailable" : signedPercent(changePercent),
    gapPercent,
    relativeVolume,
    rvol: relativeVolume === null ? "Unavailable" : `${relativeVolume.toFixed(1)}x`,
    volume,
    volumeLabel: compact(volume, 1),
    float: floatValue,
    floatShares: floatValue,
    floatLabel: floatValue === null ? "Unavailable" : compact(floatValue, 1),
    catalyst,
    setup: catalyst,
    whyMoving: row.whyMoving || catalyst,
    score,
    scannerScore: score,
    score10: Math.max(1, Math.min(10, Math.round(score / 10))),
    risk,
    riskLabel: risk,
    source,
    sourceType: text(row.sourceType, syntheticMode ? "synthetic-context" : fallbackMode ? "calculated-context" : "provider-data"),
    dataStatus,
    freshness,
    timestamp,
    providerTimestamp: normalizeTimestamp(row.providerTimestamp),
    receivedTimestamp: normalizeTimestamp(row.receivedTimestamp || meta.updatedAt),
    cacheAgeMs: numericOrNull(row.cacheAgeMs ?? meta.cacheAgeMs),
    marketSession: text(row.marketSession || meta.marketSession, ""),
    confidence: text(row.confidence, trustTier === 3 ? "High" : trustTier === 2 ? "Medium" : "Limited"),
    verified: Boolean(row.verified),
    trustTier,
    isCached: Boolean(row.isCached || meta.cached),
    isFallback: fallbackMode,
    isSynthetic: syntheticMode,
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    scoreBreakdown: row.scoreBreakdown || null,
    scoreWeights: row.scoreWeights || null,
    whyRanked: text(row.whyRanked, row.whyMoving || catalyst),
    fallback: fallbackMode,
    degraded: Boolean(row.degraded || meta.degraded),
    rankScore: score,
  };
}

export function rankScannerRows(rows = []) {
  const seen = new Set();

  return rows
    .filter(Boolean)
    .filter((row) => {
      if (!row.symbol || seen.has(row.symbol)) return false;
      seen.add(row.symbol);
      if (!Number.isFinite(Number(row.price)) || Number(row.price) <= 0) return false;
      if (!Number.isFinite(Number(row.volume)) || Number(row.volume) < 1_000) return false;
      if (!Number.isFinite(Number(row.changePercent)) || Math.abs(Number(row.changePercent)) < 0.05) return false;
      return true;
    })
    .sort((a, b) => {
      const trustDifference = Number(b.trustTier || 0) - Number(a.trustTier || 0);
      if (trustDifference) return trustDifference;
      return Number(b.rankScore || b.score || 0) - Number(a.rankScore || a.score || 0);
    });
}

export function normalizeScannerGroups(groups = {}, meta = {}) {
  const normalizeList = (rows = [], groupMeta = meta) =>
    rankScannerRows(rows.map((row, index) => normalizeScannerRow(row, groupMeta, index))).slice(0, 40);

  const normalized = {
    gainers: normalizeList(groups.gainers, meta),
    losers: normalizeList(groups.losers, meta),
    active: normalizeList(groups.active, meta),
    momentum: normalizeList(groups.momentum, meta),
    relativeVolume: normalizeList(groups.relativeVolume, meta),
    unusualVolume: normalizeList(groups.unusualVolume, meta),
    newsMovers: normalizeList(groups.newsMovers, meta),
    newHighs: normalizeList(groups.newHighs, meta),
    newLows: normalizeList(groups.newLows, meta),
    premarket: normalizeList(groups.premarket, meta),
    aiMovers: normalizeList(groups.aiMovers, meta),
    smallCaps: normalizeList(groups.smallCaps, meta),
    verifiedMovers: normalizeList(groups.verifiedMovers, meta),
    contextMovers: normalizeList(groups.contextMovers, meta),
  };
  const hasRows = Object.values(normalized).some((rows) => rows.length);

  if (hasRows) return normalized;

  const fallbackMeta = { ...meta, fallback: true, degraded: true, source: "Local Scanner Context" };
  const fallbackRows = normalizeList(
    scannerFallbackRows.map((row) => ({
      ...row,
      synthetic: true,
      fallback: true,
      source: "Local Scanner Context",
      sourceType: "synthetic-context",
      confidence: "Limited",
      trustTier: 1,
    })),
    fallbackMeta
  );

  return {
    gainers: fallbackRows.filter((row) => row.changePercent > 0),
    losers: fallbackRows.filter((row) => row.changePercent < 0),
    active: fallbackRows,
    momentum: fallbackRows.filter((row) => row.changePercent > 0),
    relativeVolume: [...fallbackRows].sort((a, b) => Number(b.relativeVolume || 0) - Number(a.relativeVolume || 0)),
    unusualVolume: fallbackRows.filter((row) => Number(row.relativeVolume || 0) >= 1.5),
    newsMovers: [],
    newHighs: [],
    newLows: [],
    premarket: [],
    aiMovers: fallbackRows.filter((row) => row.catalyst),
    smallCaps: fallbackRows,
    verifiedMovers: [],
    contextMovers: fallbackRows,
  };
}

export function normalizeNewsRow(item, _index = 0, selectedSymbol = "MARKET") {
  void _index;
  const headline = text(item?.headline || item?.title || item?.text || item?.summary);
  if (!headline) return null;

  const relatedTicker = symbolOf(item.relatedTicker || item.symbol || item.ticker || selectedSymbol) || "MARKET";
  const url = /^https?:\/\//i.test(String(item.url || item.link || "")) ? String(item.url || item.link) : null;
  const fallback = Boolean(item.fallback || item.degraded) || /fallback|scanner/i.test(String(item.source || ""));
  const cached = Boolean(item.cached || item.persisted);
  const timestamp = normalizeTimestamp(item.timestamp || item.publishedDate || item.datetime || item.time);
  const source = fallback
    ? String(item.source || "").toLowerCase().includes("scanner") ? "Scanner Catalyst" : "Fallback Context"
    : text(item.source || item.publisher || item.site, "Market News");

  return {
    ...item,
    id: item.id || `${relatedTicker}-${timestamp}-${headline.slice(0, 36)}`,
    headline,
    text: headline,
    source,
    timestamp,
    time: timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Unavailable",
    relatedTicker,
    symbol: relatedTicker,
    url,
    summary: text(item.summary || item.description, ""),
    sentiment: text(item.sentiment, "Not classified"),
    impact: text(item.impact, "Not classified"),
    fallback,
    cached,
    sourceType: fallback
      ? (source === "Scanner Catalyst" ? "Scanner Catalyst" : "Fallback")
      : cached
        ? "Cached Article"
        : url
          ? "Real Article"
          : "Market Context",
    isClickable: Boolean(url),
  };
}

export function mergeNewsRows(primaryRows = [], secondaryRows = []) {
  const seen = new Set();

  return [...primaryRows, ...secondaryRows].filter((item) => {
    const key = item?.url || item?.id || item?.headline || item?.text;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function createNormalizedNewsFallback(selectedSymbol = "MARKET", scannerRows = []) {
  const scannerFallback = scannerRows
    .slice(0, 3)
    .map((row, index) => normalizeNewsRow({
      id: `${row.symbol}-scanner-catalyst`,
      headline: row.catalyst || row.whyMoving,
      source: "Scanner Catalyst",
      timestamp: row.timestamp || null,
      relatedTicker: row.symbol,
      summary: row.whyMoving || row.catalyst,
      fallback: true,
      sentiment: "Not classified",
      impact: "Not classified",
    }, index, selectedSymbol))
    .filter(Boolean);
  const baseFallback = newsFallbackRows.map((row, index) => normalizeNewsRow(row, index, selectedSymbol)).filter(Boolean);

  return mergeNewsRows(scannerFallback, baseFallback).slice(0, 6);
}
