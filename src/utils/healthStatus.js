export function formatHealthTime(value) {
  if (!value) return "Pending";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "Pending";

  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function getCleanProviderMessage(message, fallback = "Provider limited by API plan or rate limit. Showing cached or fallback context.") {
  const value = String(message || "").trim();

  if (!value) return fallback;
  if (/showing available provider/i.test(value)) return "Provider limited by API plan or rate limit. Showing cached or fallback context.";
  if (/showing available headlines/i.test(value)) return value.length > 90 ? "Provider limited. Showing available headlines." : value;
  if (/timeout|ECONNABORTED/i.test(value)) return "Market data pending. Provider response timed out; retry shortly.";
  if (/429|rate|quota|cooling down/i.test(value)) return "Provider limited by API plan or rate limit. Showing cached or fallback context.";
  if (/restricted|subscription|plan/i.test(value)) return "Provider limited by API plan or rate limit. Showing cached or fallback context.";
  if (/news/i.test(value) && /limited|fallback|unavailable/i.test(value)) return "News provider limited. Showing available headlines or fallback context.";
  if (/bad request/i.test(value)) return "Provider request unavailable. Showing cached or fallback context.";

  return value.length > 90 ? fallback : value;
}

export function getQuestradeHealth({
  brokerDetails = null,
  brokerError = "",
  platformHealth = null,
  liveQuotes = {},
} = {}) {
  const tokenStatus = brokerDetails?.tokenStatus || brokerDetails?.token || platformHealth?.broker?.token || {};
  const tokenStore = brokerDetails?.tokenStore || platformHealth?.broker?.tokenStore || {};
  const deepQuestrade = platformHealth?.deepHealth?.questrade || null;
  const deepMarketData = platformHealth?.deepHealth?.marketData || null;
  const warnings = [
    brokerError,
    brokerDetails?.error,
    tokenStatus.lastError,
    ...(Array.isArray(brokerDetails?.warnings) ? brokerDetails.warnings : []),
    ...(Array.isArray(platformHealth?.broker?.warnings) ? platformHealth.broker.warnings : []),
  ].filter(Boolean);
  const rawMessage = warnings[0] || "";
  const quoteRows = Object.values(liveQuotes || {});
  const tokenPersisted = Boolean(
    tokenStore.firestore ||
    tokenStore.envRefreshToken ||
    tokenStatus.refreshTokenPersisted ||
    brokerDetails?.token?.refreshTokenPersisted
  );
  const hasApiServer = Boolean(tokenStatus.apiServer || brokerDetails?.apiServer);
  const platformReportsLive = Boolean(
    deepQuestrade?.live ||
      deepMarketData?.live ||
      (
        platformHealth?.marketData?.httpStatus === 200 &&
        platformHealth?.marketData?.lastSuccessAt
      )
  );
  const hasQuestradeQuote = quoteRows.some((quote) =>
    /QTRD|QUESTRADE/i.test(String(quote?.source || "")) &&
    Number.isFinite(Number(quote?.price)) &&
    Number(quote.price) > 0
  );
  const delayed = platformHealth?.marketData?.delayed === true ||
    deepMarketData?.providerLabel === "DELAYED" ||
    deepQuestrade?.providerLabel === "DELAYED" ||
    quoteRows.some((quote) => quote?.delayed);
  const timeout = /timeout|ECONNABORTED/i.test(rawMessage);

  if (hasQuestradeQuote || platformReportsLive) {
    return {
      label: delayed ? "QTRD DELAYED" : "QTRD LIVE",
      status: delayed ? "warn" : "ok",
      message: delayed ? "Questrade data is delayed." : "Questrade data is live.",
      rawMessage,
      tokenPersisted,
    };
  }

  if (timeout) {
    return {
      label: "QTRD TIMEOUT",
      status: "warn",
      message: tokenPersisted
        ? "Questrade timeout. Token is persisted; retry shortly."
        : "Questrade timeout. Refresh token persistence is not confirmed.",
      rawMessage,
      tokenPersisted,
    };
  }

  if (tokenPersisted || hasApiServer) {
    return {
      label: "QTRD DEGRADED",
      status: "warn",
      message: getCleanProviderMessage(rawMessage, "Questrade degraded. Token is persisted; retry shortly."),
      rawMessage,
      tokenPersisted,
    };
  }

  return {
    label: "QTRD PENDING",
    status: "info",
    message: "Questrade status is pending.",
    rawMessage,
    tokenPersisted,
  };
}

export function getHealthLabelStatus(label) {
  const value = String(label || "").toUpperCase();

  if (value.includes("LIVE") || value.includes("CONNECTED") || value.includes("ONLINE")) return "ok";
  if (value.includes("TIMEOUT") || value.includes("DEGRADED") || value.includes("DELAYED") || value.includes("LIMITED") || value.includes("FALLBACK") || value.includes("PENDING")) {
    return "warn";
  }
  if (value.includes("DISCONNECTED") || value.includes("UNAVAILABLE") || value.includes("ERROR")) return "bad";

  return "info";
}

export function normalizeProviderStatus(input = {}, {
  source = "Unknown provider",
  marketSession = null,
  now = Date.now(),
  staleAfterMs = 120_000,
} = {}) {
  const providerTimestamp = input.providerTimestamp || input.updatedAt || input.lastSuccessAt || null;
  const receivedTimestamp = input.receivedTimestamp || input.backendTime || null;
  const timestampMs = providerTimestamp ? new Date(providerTimestamp).getTime() : NaN;
  const explicitCacheAge = Number(input.cacheAgeMs);
  const cacheAgeMs = Number.isFinite(explicitCacheAge)
    ? Math.max(0, explicitCacheAge)
    : Number.isFinite(timestampMs)
      ? Math.max(0, now - timestampMs)
      : null;
  const unavailable = Boolean(input.unavailable) || String(input.label || "").toUpperCase().includes("UNAVAILABLE");
  const providerLimited = Boolean(input.providerLimited) || String(input.label || "").toUpperCase().includes("LIMITED");
  const delayed = Boolean(input.delayed) || String(input.label || "").toUpperCase().includes("DELAYED");
  const cached = Boolean(input.cached) || cacheAgeMs !== null && cacheAgeMs > 0;
  const stale = Boolean(input.stale) || cacheAgeMs !== null && cacheAgeMs > staleAfterMs;
  const state = unavailable
    ? "Unavailable"
    : providerLimited
      ? "Provider Limited"
      : stale
        ? "Stale"
        : delayed
          ? "Delayed"
          : cached
            ? "Cached"
            : "Live";

  return {
    source: input.source || source,
    state,
    providerTimestamp,
    receivedTimestamp,
    cacheAgeMs,
    marketSession: input.marketSession || marketSession,
    warning: input.userMessage || input.warning || null,
    lastSuccessAt: input.lastSuccessAt || providerTimestamp,
    available: !unavailable,
  };
}
