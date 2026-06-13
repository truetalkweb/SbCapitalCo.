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

export function getCleanProviderMessage(message, fallback = "Provider limited. Cached/fallback data active.") {
  const value = String(message || "").trim();

  if (!value) return fallback;
  if (/timeout|ECONNABORTED/i.test(value)) return "Questrade timeout. Token is persisted; retry shortly.";
  if (/429|rate/i.test(value)) return "Provider limited. Cached/fallback data active.";
  if (/restricted|subscription|plan/i.test(value)) return "Provider limited. Cached/fallback data active.";
  if (/news/i.test(value) && /limited|fallback|unavailable/i.test(value)) return "News provider limited. Showing available headlines.";
  if (/bad request/i.test(value)) return "Provider rejected the latest request. Cached/fallback data active.";

  return value.length > 90 ? fallback : value;
}

export function getQuestradeHealth({
  brokerConnected = false,
  brokerDetails = null,
  brokerError = "",
  platformHealth = null,
  liveQuotes = {},
} = {}) {
  const tokenStatus = brokerDetails?.tokenStatus || brokerDetails?.token || platformHealth?.broker?.token || {};
  const tokenStore = brokerDetails?.tokenStore || platformHealth?.broker?.tokenStore || {};
  const warnings = [
    brokerError,
    brokerDetails?.error,
    tokenStatus.lastError,
    ...(Array.isArray(brokerDetails?.warnings) ? brokerDetails.warnings : []),
    ...(Array.isArray(platformHealth?.broker?.warnings) ? platformHealth.broker.warnings : []),
  ].filter(Boolean);
  const rawMessage = warnings[0] || "";
  const tokenPersisted = Boolean(
    tokenStore.firestore ||
    tokenStore.envRefreshToken ||
    tokenStatus.refreshTokenPersisted ||
    brokerDetails?.token?.refreshTokenPersisted
  );
  const hasApiServer = Boolean(tokenStatus.apiServer || brokerDetails?.apiServer);
  const hasQuestradeQuote = Object.values(liveQuotes || {}).some((quote) =>
    String(quote?.source || "").toUpperCase().includes("QTRD")
  );
  const delayed = platformHealth?.marketData?.delayed === true ||
    Object.values(liveQuotes || {}).some((quote) => quote?.delayed);
  const timeout = /timeout|ECONNABORTED/i.test(rawMessage);

  if (brokerConnected || hasQuestradeQuote) {
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
