const ETF_SYMBOLS = new Set(["SPY", "QQQ", "DIA", "IWM", "VIX", "VOO", "XLK", "XLF"]);
const CRYPTO_SYMBOLS = new Set(["COIN", "MARA", "RIOT", "MSTR", "HOOD"]);

function textOf(...values) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function numeric(value) {
  const parsed = Number(String(value ?? "").replace(/[$,%+,x]/gi, "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesSearch(row, search, fields) {
  const query = String(search || "").trim().toLowerCase();
  if (!query) return true;
  return fields.some((field) => String(row?.[field] || "").toLowerCase().includes(query));
}

export function filterWatchlistRows(rows = [], view = "Main Watchlist", search = "") {
  return rows.filter((row) => {
    if (!matchesSearch(row, search, ["symbol", "name", "sector", "catalyst"])) return false;
    const symbol = String(row?.symbol || "").toUpperCase();
    const move = numeric(row?.changePercent ?? row?.change);
    const rvol = numeric(row?.relativeVolume ?? row?.rvol);
    const context = textOf(row?.catalyst, row?.setup, row?.reason);

    if (view === "Momentum") return Math.abs(move || 0) >= 1 || (rvol || 0) >= 1.5;
    if (view === "ETFs") return ETF_SYMBOLS.has(symbol) || textOf(row?.name, row?.sector).includes("etf");
    if (view === "Earnings") return /earn|guidance|revenue|eps/.test(context);
    return true;
  });
}

export function filterNewsRows(rows = [], view = "Top News", search = "", watchlistSymbols = []) {
  const watched = new Set(watchlistSymbols.map((symbol) => String(symbol || "").toUpperCase()));
  return rows.filter((row) => {
    if (!matchesSearch(row, search, ["headline", "summary", "symbol", "source"])) return false;
    const symbol = String(row?.symbol || row?.relatedTicker || "").toUpperCase();
    const content = textOf(row?.headline, row?.summary, row?.source, symbol);

    if (view === "Market") return !symbol || ETF_SYMBOLS.has(symbol) || /market|index|fed|rates|econom/.test(content);
    if (view === "Stocks") return Boolean(symbol) && !CRYPTO_SYMBOLS.has(symbol);
    if (view === "Earnings") return /earn|guidance|revenue|eps|quarter/.test(content);
    if (view === "Macro") return /fed|rate|inflation|jobs|gdp|treasury|econom|oil/.test(content);
    if (view === "Analyst") return /analyst|upgrade|downgrade|price target|initiates|rating/.test(content);
    if (view === "Crypto") return CRYPTO_SYMBOLS.has(symbol) || /bitcoin|crypto|coinbase|ethereum/.test(content);
    if (view === "Watchlist") return watched.has(symbol);
    return true;
  });
}

export function filterOrderRows(rows = [], view = "All Orders", search = "") {
  return rows.filter((row) => {
    if (!matchesSearch(row, search, ["symbol", "side", "type", "status", "id"])) return false;
    const status = String(row?.status || "").toUpperCase();
    if (view === "Working") return status.includes("WORK") || status.includes("OPEN") || status.includes("PENDING") || status.includes("PART");
    if (view === "Filled") return status.includes("FILL") && !status.includes("PART");
    if (view === "Cancelled") return status.includes("CANCEL");
    if (view === "Rejected") return status.includes("REJECT");
    return true;
  });
}

export function filterMoverRows(rows = [], view = "Top Movers") {
  const ranked = [...rows];
  if (view === "Gainers") return ranked.filter((row) => (numeric(row?.changePercent ?? row?.change) || 0) > 0).sort((a, b) => (numeric(b?.changePercent ?? b?.change) || 0) - (numeric(a?.changePercent ?? a?.change) || 0));
  if (view === "Losers") return ranked.filter((row) => (numeric(row?.changePercent ?? row?.change) || 0) < 0).sort((a, b) => (numeric(a?.changePercent ?? a?.change) || 0) - (numeric(b?.changePercent ?? b?.change) || 0));
  if (view === "Active") return ranked.sort((a, b) => (numeric(b?.volume) || 0) - (numeric(a?.volume) || 0));
  if (view === "Momentum") return ranked.sort((a, b) => (numeric(b?.scannerScore ?? b?.score) || 0) - (numeric(a?.scannerScore ?? a?.score) || 0));
  return ranked.sort((a, b) => Math.abs(numeric(b?.changePercent ?? b?.change) || 0) - Math.abs(numeric(a?.changePercent ?? a?.change) || 0));
}

export function selectVisibleRow(rows = [], selectedKey, preferredSymbol, keyField = "id") {
  return rows.find((row) => row?.[keyField] === selectedKey)
    || rows.find((row) => row?.symbol === preferredSymbol)
    || rows[0]
    || null;
}
