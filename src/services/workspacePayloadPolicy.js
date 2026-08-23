export const MAX_WORKSPACE_BYTES = 2 * 1024 * 1024;

export const PERSISTED_WORKSPACE_FIELDS = Object.freeze([
  "selectedStock",
  "secondarySymbol",
  "liveStocks",
  "timeframe",
  "secondaryTimeframe",
  "layoutMode",
  "gridMode",
  "quantity",
  "orders",
  "orderAuditTrail",
  "positions",
  "realizedPnL",
  "alerts",
  "syncCharts",
  "tradingMode",
  "maxOrderValue",
  "dailyLossLimit",
  "riskPerTrade",
  "marketRegion",
  "themeMode",
  "timeZone",
  "premiumPreferences",
  "chartIndicators",
  "scannerTab",
  "scannerPresets",
  "activeScannerPreset",
  "replayMode",
  "replaySpeed",
  "replayIndex",
  "replayTrades",
  "replayEquity",
  "replayBookmarks",
  "replayNotes",
  "journalEntries",
  "journalDraft",
  "activePreset",
  "activeWorkspace",
  "rightTab",
  "leftSectionsOpen",
  "selectedScannerStock",
]);

export function createWorkspacePayload(values = {}) {
  return PERSISTED_WORKSPACE_FIELDS.reduce((payload, field) => {
    payload[field] = values[field];
    return payload;
  }, {});
}

export function getWorkspacePayloadSize(payload) {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function isValidWorkspacePayload(payload) {
  return Boolean(
    payload
    && typeof payload === "object"
    && !Array.isArray(payload)
    && getWorkspacePayloadSize(payload) <= MAX_WORKSPACE_BYTES
  );
}

export function serializeWatchlistForWorkspace(rows) {
  if (!Array.isArray(rows)) return [];

  const symbols = new Set();
  return rows.reduce((result, row) => {
    const symbol = String(row?.symbol || "").trim().toUpperCase();
    if (!symbol || symbols.has(symbol)) return result;
    symbols.add(symbol);
    result.push({ symbol });
    return result;
  }, []);
}
