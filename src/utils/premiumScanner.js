import { buildStocks, num } from "../components/premium/premiumWorkspaceData.js";

export const DEFAULT_SCANNER_FILTERS = Object.freeze({
  search: "",
  minPrice: "",
  maxPrice: "",
  minVolume: "",
  minRvol: "",
  minMarketCap: "",
  maxFloat: "",
  risk: "all",
  sector: "all",
  country: "all",
});

export function mergeScannerFilters(storedFilters = {}, preferenceFilters = {}) {
  return {
    ...DEFAULT_SCANNER_FILTERS,
    ...(storedFilters || {}),
    ...(preferenceFilters || {}),
  };
}

export function selectScannerUniverse({
  scannerTab,
  scannerGroups = {},
  scannerStocks = [],
  selectedStockData,
  selectedStock,
  fallbackStocks = [],
}) {
  const rowsByTab = {
    Gainers: scannerGroups.gainers,
    Losers: scannerGroups.losers,
    Active: scannerGroups.active,
    Momentum: scannerGroups.momentum,
    "High RVOL": scannerGroups.unusualVolume?.length
      ? scannerGroups.unusualVolume
      : scannerGroups.relativeVolume,
    "News Movers": scannerGroups.newsMovers,
    "New Highs": scannerGroups.newHighs,
    "New Lows": scannerGroups.newLows,
    Premarket: scannerGroups.premarket,
  };
  const activeRows = rowsByTab[scannerTab] || scannerGroups.gainers || scannerStocks;
  if (activeRows?.length) return buildStocks([], activeRows, selectedStockData, selectedStock);
  if (scannerStocks?.length) return buildStocks([], scannerStocks, selectedStockData, selectedStock);
  return fallbackStocks;
}

export function filterScannerRows(rows = [], filters = DEFAULT_SCANNER_FILTERS, minimumRvol = 0) {
  return rows.filter((row) => {
    if (row.dataMode === "unavailable") return false;
    const search = String(filters.search || "").trim().toUpperCase();
    const price = num(row.price, Number.NaN);
    const volume = num(row.volume, Number.NaN);
    const rvol = num(row.relativeVolume ?? row.rvol, Number.NaN);
    const marketCap = num(row.marketCap, Number.NaN);
    const floatShares = num(row.floatShares ?? row.float, Number.NaN);

    if (search && !String(row.symbol || "").toUpperCase().includes(search) && !String(row.name || "").toUpperCase().includes(search)) return false;
    if (filters.minPrice && (!Number.isFinite(price) || price < Number(filters.minPrice))) return false;
    if (filters.maxPrice && (!Number.isFinite(price) || price > Number(filters.maxPrice))) return false;
    if (filters.minVolume && (!Number.isFinite(volume) || volume < Number(filters.minVolume))) return false;
    if (minimumRvol && (!Number.isFinite(rvol) || rvol < minimumRvol)) return false;
    if (filters.minMarketCap && (!Number.isFinite(marketCap) || marketCap < Number(filters.minMarketCap))) return false;
    if (filters.maxFloat && (!Number.isFinite(floatShares) || floatShares > Number(filters.maxFloat))) return false;
    if (filters.risk !== "all" && String(row.risk || "").toLowerCase() !== filters.risk) return false;
    if (filters.sector !== "all" && String(row.sector || "") !== filters.sector) return false;
    if (filters.country !== "all" && String(row.country || "").toUpperCase() !== filters.country) return false;
    return true;
  });
}
