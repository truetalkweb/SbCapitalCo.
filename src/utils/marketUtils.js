import { createNormalizedNewsFallback } from "./scannerNewsAdapters";

export async function fetchWithTimeout(url, timeoutMs = 5000, options = {}) {
  const controller = new AbortController();
  const externalSignal = options.signal;
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (externalSignal?.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
    }
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}

export function formatNewsTime(value) {
  const timestamp = typeof value === "number" ? value * 1000 : value;
  const date = new Date(timestamp || Date.now());

  return (Number.isNaN(date.getTime()) ? new Date() : date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function normalizePanelNewsItem(item, index, selectedSymbol) {
  const headline = String(item?.headline || item?.text || item?.summary || "").trim();

  if (!headline) return null;

  const rawSource = String(item.source || "Market News");
  const source = rawSource.replace(/\s+Fallback$/i, "").trim();
  const fallback = Boolean(item.fallback || item.degraded) ||
    rawSource.toLowerCase().includes("fallback") ||
    rawSource.toLowerCase().includes("scanner");
  const sourceType = item.sourceType || item.relevance || getNewsSourceType({ source: rawSource, fallback, url: item.url });

  return {
    id: item.id || `${selectedSymbol || "MARKET"}-${index}-${headline.slice(0, 32)}`,
    time: formatNewsTime(item.timestamp || item.publishedDate || item.datetime || item.time),
    source: fallback && source.toLowerCase().includes("scanner") ? "Scanner Catalyst" : source,
    text: headline,
    url: item.url || null,
    relatedTicker: item.relatedTicker || (sourceType === "Ticker Catalyst" ? selectedSymbol : null),
    summary: item.summary || "",
    fallback,
    sourceType,
  };
}

export function getNewsSourceType({ source = "", fallback = false, url = null } = {}) {
  const value = String(source || "").toLowerCase();

  if (fallback || value.includes("scanner")) return "Scanner Catalyst";
  if (value.includes("fallback") || value.includes("local")) return "Fallback";
  if (url && (value.includes("yahoo") || value.includes("finnhub") || value.includes("fmp"))) return "Real Article";
  if (url) return "Article";

  return "Market Context";
}

export function getScannerSourceType(stock = {}) {
  const source = String(stock.source || stock.provider || stock.catalystType || "").toLowerCase();

  if (stock.fallback || stock.degraded || source.includes("fallback") || source.includes("local")) {
    return { type: "Scanner Context", confidence: "Limited" };
  }
  if (source.includes("yahoo") || stock.latestNews?.url || stock.newsUrl) {
    return { type: "News Linked", confidence: "High" };
  }
  if (source.includes("fmp") || source.includes("questrade")) {
    return { type: "Provider Data", confidence: "Medium" };
  }
  if (source.includes("scanner")) {
    return { type: "Ranked Scan", confidence: "Medium" };
  }

  return { type: "Market Context", confidence: "Limited" };
}

export function formatSourceFreshness(value) {
  const parsed = value ? new Date(value).getTime() : 0;

  if (!parsed || Number.isNaN(parsed)) return "Pending";

  const ageMs = Math.max(0, Date.now() - parsed);

  if (ageMs < 60_000) return "Live";
  if (ageMs < 3_600_000) return `${Math.round(ageMs / 60_000)}m ago`;
  if (ageMs < 86_400_000) return `${Math.round(ageMs / 3_600_000)}h ago`;

  return `${Math.round(ageMs / 86_400_000)}d ago`;
}

function getConfidenceRank(value) {
  if (value === "High") return 3;
  if (value === "Medium") return 2;
  return 1;
}

function lowestConfidence(...values) {
  return values.filter(Boolean).reduce((lowest, value) => (
    getConfidenceRank(value) < getConfidenceRank(lowest) ? value : lowest
  ), "High");
}

export function buildDataConfidence({
  selectedStock = "",
  selectedStockData = null,
  qtrdHealth = null,
  newsMeta = {},
  scannerMeta = {},
} = {}) {
  const quoteSource = String(selectedStockData?.source || qtrdHealth?.label || "Quote Pending");
  const quoteLabel = selectedStockData?.delayed || /DELAYED|PENDING|SIM|DEGRADED/i.test(quoteSource)
    ? quoteSource
    : /QTRD|QUESTRADE|LIVE/i.test(quoteSource)
      ? "Questrade Quote"
      : quoteSource;
  const quoteConfidence = /LIVE|QTRD|QUESTRADE/i.test(quoteLabel) && !/DELAYED|PENDING|DEGRADED/i.test(quoteLabel)
    ? "High"
    : /DELAYED|REST|BACKEND|SIM/i.test(quoteLabel)
      ? "Medium"
      : "Limited";
  const quoteMode = !selectedStockData
    ? "unavailable"
    : /SIM/i.test(quoteLabel)
      ? "simulated"
      : selectedStockData?.delayed || /DELAYED/i.test(quoteLabel)
        ? "delayed"
        : /LIVE|QTRD|QUESTRADE/i.test(quoteLabel)
          ? "live"
          : "cached";
  const newsLabel = newsMeta?.source || newsMeta?.providerStatus?.source || "News Pending";
  const newsConfidence = newsMeta?.degraded || (newsMeta?.fallbackRows > 0 && newsMeta?.fallbackRows === newsMeta?.rowCount)
    ? "Limited"
    : newsMeta?.providerStatus?.providerLimited
      ? "Medium"
      : newsMeta?.source
        ? "High"
        : "Limited";
  const newsMode = !newsMeta?.rowCount && !newsMeta?.source
    ? "unavailable"
    : newsMeta?.fallbackRows > 0 && newsMeta?.fallbackRows === newsMeta?.rowCount
      ? "fallback"
      : newsMeta?.cached
        ? "cached"
        : newsMeta?.providerStatus?.providerLimited || newsMeta?.degraded
          ? "delayed"
          : "live";
  const scannerLabel = scannerMeta?.source || scannerMeta?.provider || "Scanner Pending";
  const scannerConfidence = scannerMeta?.fallback || scannerMeta?.degraded
    ? "Limited"
    : scannerMeta?.cached
      ? "Medium"
      : scannerMeta?.source
        ? "High"
        : "Limited";
  const scannerMode = !scannerMeta?.source
    ? "unavailable"
    : scannerMeta?.fallback
      ? "fallback"
      : scannerMeta?.cached
        ? "cached"
        : scannerMeta?.degraded
          ? "delayed"
          : "live";
  const updatedCandidates = [
    selectedStockData?.lastUpdated,
    newsMeta?.updatedAt,
    newsMeta?.backendTime,
    scannerMeta?.updatedAt,
    scannerMeta?.lastSuccessAt,
  ]
    .map((value) => (value ? new Date(value).getTime() : 0))
    .filter((value) => value && !Number.isNaN(value));
  const lastUpdated = updatedCandidates.length ? new Date(Math.max(...updatedCandidates)).toISOString() : null;
  const confidence = lowestConfidence(quoteConfidence, newsConfidence, scannerConfidence);
  const modes = [quoteMode, newsMode, scannerMode];
  const mode = modes.includes("unavailable")
    ? "degraded"
    : modes.includes("simulated") || modes.includes("fallback")
      ? "fallback"
      : modes.includes("delayed") || modes.includes("cached")
        ? "delayed"
        : "live";

  return {
    symbol: String(selectedStock || selectedStockData?.symbol || "").toUpperCase() || "MARKET",
    confidence,
    mode,
    disclosure: mode === "live"
      ? "Provider data"
      : mode === "delayed"
        ? "Delayed or cached data"
        : mode === "fallback"
          ? "Fallback or simulated context"
          : "Some data is unavailable",
    lastUpdated,
    lastUpdatedLabel: formatSourceFreshness(lastUpdated),
    quote: { label: quoteLabel, confidence: quoteConfidence, mode: quoteMode },
    news: { label: newsLabel, confidence: newsConfidence, mode: newsMode },
    scanner: { label: scannerLabel, confidence: scannerConfidence, mode: scannerMode },
  };
}

export function createMarketNewsFallback(selectedSymbol) {
  return createNormalizedNewsFallback(selectedSymbol);
}

export function parsePercent(value) {
  return Number(String(value || "0").replace("%", "")) || 0;
}

export function parseMarketVolume(value) {
  const cleanValue = String(value || "0").replace(/,/g, "").trim();
  const numericValue = parseFloat(cleanValue) || 0;

  if (cleanValue.includes("B")) return numericValue * 1_000_000_000;
  if (cleanValue.includes("M")) return numericValue * 1_000_000;
  if (cleanValue.includes("K")) return numericValue * 1_000;

  return numericValue;
}

export function formatChartSourceStatus(status) {
  if (status === "QTRD") return "HIST QTRD";
  if (status === "SIM") return "CHART SIM";
  if (status === "LIVE") return "QUOTE LIVE";
  if (status === "DELAYED") return "QUOTE DELAYED";
  if (status === "UPDATING") return "CHART UPDATING";
  if (status === "LOADING") return "CHART LOADING";
  if (status === "STALE") return "QUOTE STALE";

  return `CHART ${String(status || "PENDING").toUpperCase()}`;
}

export function formatQuoteSourceStatus(quote) {
  if (quote?.delayed) return "QUOTE DELAYED";
  if (String(quote?.source || "").includes("QTRD")) return "QUOTE LIVE";
  if (String(quote?.source || "").includes("WS")) return "QUOTE STREAM";
  if (String(quote?.source || "").includes("REST")) return "QUOTE REST";

  return "QUOTE PENDING";
}

export function formatScannerSourceStatus(scannerMeta = {}) {
  if (scannerMeta.statusLabel) return scannerMeta.statusLabel;
  if (scannerMeta.providerStatus?.label) {
    const label = String(scannerMeta.providerStatus.label).toUpperCase();
    return label === "LIVE" ? "SCANNER LIVE" : `SCANNER ${label}`;
  }

  const source = String(scannerMeta.provider || scannerMeta.source || "").toUpperCase();
  const warnings = [
    scannerMeta.lastWarning,
    ...(Array.isArray(scannerMeta.warnings) ? scannerMeta.warnings : []),
  ].filter(Boolean);
  const providerLimited = scannerMeta.degraded &&
    warnings.some((warning) => /429|rate|limit|fmp|restricted|subscription/i.test(String(warning)));

  if (providerLimited) return "SCANNER PROVIDER LIMITED";
  if (scannerMeta.cached) return "SCANNER CACHED";
  if (source.includes("LOCAL")) return "SCANNER FALLBACK";
  if (scannerMeta.fallback) return "SCANNER FALLBACK";
  if (source.includes("FALLBACK")) return "SCANNER FALLBACK";
  if (source.includes("FMP")) return "SCANNER LIVE";

  return scannerMeta.degraded ? "SCANNER FALLBACK" : "SCANNER PENDING";
}

export function formatNewsSourceStatus(newsMeta = {}) {
  if (newsMeta.statusLabel) return newsMeta.statusLabel;
  if (newsMeta.providerStatus?.label) {
    const label = String(newsMeta.providerStatus.label).toUpperCase();
    return label === "LIVE" ? "NEWS LIVE" : `NEWS ${label}`;
  }

  if (newsMeta.degraded) return "NEWS FALLBACK";
  if ((newsMeta.providerWarnings || []).length || newsMeta.warning) return "NEWS PROVIDER LIMITED";
  if (newsMeta.cached) return "NEWS CACHED";
  if (newsMeta.source) return "NEWS LIVE";

  return "NEWS PENDING";
}

export function getStatusColor(label, theme) {
  const value = String(label || "").toUpperCase();

  if (value.includes("DISCONNECTED") || value.includes("ERROR") || value.includes("UNAVAILABLE")) return theme.red;
  if (value.includes("DELAYED") || value.includes("FALLBACK") || value.includes("SIM") || value.includes("PENDING") || value.includes("LIMITED") || value.includes("DEGRADED") || value.includes("TIMEOUT") || value.includes("UPDATING")) {
    return theme.amber;
  }
  if (value.includes("LIVE") || value.includes("QTRD") || value.includes("CONNECTED") || value.includes("FMP") || value.includes("NEWS")) {
    return theme.green;
  }

  return theme.muted;
}

export function formatTerminalStatusLabel(label) {
  const value = String(label || "").trim();
  const upper = value.toUpperCase();

  if (!value) return "Pending";
  if (upper.includes("LOCAL SCANNER FALLBACK")) return "Fallback Context";
  if (upper.includes("SCANNER UNAVAILABLE")) return "Fallback Context";
  if (upper.includes("SCANNER CONTEXT")) return "Fallback Context";
  if (upper.includes("SCANNER CATALYST")) return "Fallback Context";
  if (upper.includes("PROVIDER LIMITED")) return "Provider Limited";
  if (upper.includes("CACHED")) return "Cached";
  if (upper.includes("FALLBACK")) return "Fallback Context";
  if (upper.includes("BACKEND LIVE")) return "Backend Live";
  if (upper.includes("BACKEND PENDING")) return "Backend Pending";
  if (upper.includes("BROKER CONNECTED")) return "Broker Connected";
  if (upper.includes("BROKER DISCONNECTED")) return "Broker Disconnected";
  if (upper.includes("TOKEN STORED")) return "Token Stored";
  if (upper.includes("LIVE LOCKED")) return "Broker Locked";
  if (upper.includes("PAPER MODE")) return "Paper Mode";
  if (upper.includes("HIST QTRD")) return "Hist QTRD";
  if (upper.includes("CHART SIM")) return "Chart Sim";
  if (upper.includes("CHART UPDATING")) return "Chart Updating";
  if (upper.includes("CHART LOADING")) return "Chart Loading";
  if (upper.includes("QUOTE DELAYED")) return "Quote Delayed";
  if (upper.includes("QUOTE LIVE")) return "Quote Live";
  if (upper.includes("QUESTRADE QUOTE")) return "Live Quote";
  if (upper.includes("QUESTRADE")) return "Live Quote";
  if (upper.includes("QTRD LIVE")) return "QTRD Live";
  if (upper.includes("QTRD PENDING")) return "QTRD Pending";
  if (upper.includes("AI PENDING")) return "AI Pending";
  if (upper.includes("GEMINI LIVE")) return "Gemini Live";
  if (upper.includes("NEWS LIVE")) return "News Live";
  if (upper.includes("YAHOO")) return "Market News";
  if (upper.includes("FINNHUB")) return "Market News";
  if (upper.includes("FMP")) return "Provider Data";
  if (upper.includes("SCANNER LIVE")) return "Scanner Live";

  return value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function buildTerminalSourceLabels({
  liveQuotes = {},
  platformHealth = null,
  mainChartStatus = "LOADING",
  scannerMeta = {},
  newsMeta = {},
  brokerConnected = false,
}) {
  const quoteMetaRows = Object.values(liveQuotes || {});
  const hasQuestradeQuote =
    quoteMetaRows.some((quote) => String(quote?.source || "").includes("QTRD")) ||
    platformHealth?.marketData?.source === "Questrade";
  const quoteIsDelayed =
    quoteMetaRows.some((quote) => quote?.delayed) ||
    platformHealth?.marketData?.delayed === true;

  return {
    marketDataStatusLabel: quoteIsDelayed
      ? "QTRD DELAYED"
      : hasQuestradeQuote || platformHealth?.marketData?.httpStatus === 200
        ? "QTRD LIVE"
        : "QTRD PENDING",
    mainChartSourceLabel: formatChartSourceStatus(mainChartStatus),
    scannerSourceLabel: formatScannerSourceStatus(scannerMeta),
    newsSourceLabel: formatNewsSourceStatus(newsMeta),
    brokerSourceLabel: brokerConnected ? "BROKER CONNECTED" : "BROKER DISCONNECTED",
    modeSourceLabel: "PAPER MODE",
  };
}

export function applyLiveQuote(stock, liveQuotes) {
  const quote = liveQuotes[stock.symbol];

  if (!quote) return stock;

  return {
    ...stock,
    price: quote.price,
    change: quote.change,
    volume: quote.volume || stock.volume,
    source: quote.source || stock.source,
    delayed: quote.delayed ?? stock.delayed,
    realtime: quote.realtime ?? stock.realtime,
    bidPrice: quote.bidPrice ?? stock.bidPrice,
    askPrice: quote.askPrice ?? stock.askPrice,
    lastTradeTime: quote.lastTradeTime || stock.lastTradeTime,
    lastUpdated: quote.lastUpdated || stock.lastUpdated,
  };
}

export function getMomentumScore(stock) {
  return Math.abs(parsePercent(stock.change)) * 10 + parseMarketVolume(stock.volume) / 1_000_000;
}

export function getRelativeVolumeScore(stock) {
  return parseMarketVolume(stock.volume);
}
