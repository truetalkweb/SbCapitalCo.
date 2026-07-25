const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9./:-]{0,15}$/;

export function normalizeSymbol(value) {
  const symbol = String(value || "").trim().toUpperCase();
  return SYMBOL_PATTERN.test(symbol) ? symbol : "";
}

export function inferAssetType(symbol, explicitType = "") {
  const normalizedType = String(explicitType || "").trim().toLowerCase();
  if (normalizedType) return normalizedType;
  if (symbol.includes("-USD")) return "crypto";
  if (symbol.includes("/") || /^[A-Z]{6}$/.test(symbol)) return "forex";
  return "equity";
}

export function createSymbolContext(symbol, metadata = {}, previous = null) {
  const normalizedSymbol = normalizeSymbol(symbol);
  if (!normalizedSymbol) return previous;

  return {
    symbol: normalizedSymbol,
    company: metadata.company || metadata.companyName || metadata.name || normalizedSymbol,
    exchange: metadata.exchange || metadata.market || null,
    assetType: inferAssetType(normalizedSymbol, metadata.assetType || metadata.type),
    currency: metadata.currency || (normalizedSymbol.includes("-USD") ? "USD" : "USD"),
    marketSession: metadata.marketSession || metadata.session || null,
    selectionSource: metadata.selectionSource || metadata.sourceContext || "terminal",
    selectedAt: metadata.selectedAt || new Date().toISOString(),
  };
}

export function isCurrentRequest(requestSymbol, currentSymbol) {
  return normalizeSymbol(requestSymbol) === normalizeSymbol(currentSymbol);
}
