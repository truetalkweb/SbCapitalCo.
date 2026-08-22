import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SCANNER_FILTERS,
  filterScannerRows,
  mergeScannerFilters,
  selectScannerUniverse,
} from "../src/utils/premiumScanner.js";

const rows = [
  {
    symbol: "AAPL",
    name: "Apple",
    price: 210,
    volume: 25_000_000,
    relativeVolume: 2.4,
    marketCap: 3_000_000_000_000,
    floatShares: 15_000_000_000,
    risk: "Low",
    sector: "Technology",
    country: "US",
    dataMode: "provider",
  },
  {
    symbol: "RISK",
    name: "Risk Example",
    price: 3,
    volume: 90_000,
    relativeVolume: 0.8,
    marketCap: 20_000_000,
    floatShares: 8_000_000,
    risk: "High",
    sector: "Healthcare",
    country: "US",
    dataMode: "provider",
  },
  { symbol: "EMPTY", dataMode: "unavailable" },
];

test("scanner filter defaults merge stored and preference values predictably", () => {
  const result = mergeScannerFilters({ minPrice: "2", risk: "high" }, { minPrice: "5" });
  assert.equal(result.minPrice, "5");
  assert.equal(result.risk, "high");
  assert.equal(result.country, DEFAULT_SCANNER_FILTERS.country);
});

test("scanner rows enforce quality thresholds and remove unavailable rows", () => {
  const result = filterScannerRows(
    rows,
    { ...DEFAULT_SCANNER_FILTERS, minVolume: "100000", risk: "low", country: "US" },
    1.5,
  );
  assert.deepEqual(result.map((row) => row.symbol), ["AAPL"]);
});

test("scanner universe honors the selected tab before generic fallback rows", () => {
  const result = selectScannerUniverse({
    scannerTab: "Losers",
    scannerGroups: {
      gainers: [{ symbol: "GAIN", price: 10, changePercent: 5 }],
      losers: [{ symbol: "LOSS", price: 8, changePercent: -4 }],
    },
    scannerStocks: rows,
    selectedStock: "LOSS",
  });
  assert.equal(result[0].symbol, "LOSS");
});
