import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeNewsRows,
  normalizeNewsRow,
  normalizeScannerGroups,
  normalizeScannerRow,
  rankScannerRows,
} from "../src/utils/scannerNewsAdapters.js";

function marketRow(overrides = {}) {
  return {
    symbol: "NVDA",
    price: 180,
    changePercent: 2.4,
    volume: 12_000_000,
    scannerScore: 72,
    source: "FMP Movers",
    verified: true,
    trustTier: 3,
    catalyst: "Verified provider momentum",
    ...overrides,
  };
}

test("missing gap, RVOL, and float remain unavailable", () => {
  const row = normalizeScannerRow(marketRow(), { contractVersion: "scanner-v2" });

  assert.equal(row.gapPercent, null);
  assert.equal(row.relativeVolume, null);
  assert.equal(row.floatShares, null);
  assert.equal(row.verified, true);
});

test("verified provider rows rank ahead of higher-scoring synthetic context", () => {
  const verified = normalizeScannerRow(marketRow({ scannerScore: 48 }));
  const synthetic = normalizeScannerRow(
    marketRow({
      symbol: "SYN",
      scannerScore: 99,
      verified: false,
      synthetic: true,
      fallback: true,
      trustTier: 1,
      source: "Local Scanner Context",
    })
  );

  assert.deepEqual(rankScannerRows([synthetic, verified]).map((row) => row.symbol), ["NVDA", "SYN"]);
});

test("restored provider rows stay verified and are presented as cached", () => {
  const restored = normalizeScannerRow(marketRow({
    isCached: true,
    freshness: "cached",
    providerTimestamp: "2026-07-25T11:30:00Z",
  }), {
    cached: true,
    persisted: true,
    updatedAt: "2026-07-25T11:30:00Z",
  });

  assert.equal(restored.verified, true);
  assert.equal(restored.isCached, true);
  assert.equal(restored.freshness, "cached");
  assert.notEqual(restored.dataStatus, "Live");
});

test("scanner categories stay independent", () => {
  const groups = normalizeScannerGroups({
    gainers: [marketRow({ symbol: "GAIN" })],
    newsMovers: [marketRow({ symbol: "NEWS", newsUrl: "https://example.com/story" })],
    newHighs: [marketRow({ symbol: "HIGH" })],
  });

  assert.deepEqual(groups.gainers.map((row) => row.symbol), ["GAIN"]);
  assert.deepEqual(groups.newsMovers.map((row) => row.symbol), ["NEWS"]);
  assert.deepEqual(groups.newHighs.map((row) => row.symbol), ["HIGH"]);
});

test("restored news remains clickable but is never presented as live", () => {
  const row = normalizeNewsRow({
    id: "cached-story",
    headline: "Nvidia raises guidance",
    source: "Yahoo Finance",
    timestamp: "2026-07-25T11:30:00Z",
    relatedTicker: "NVDA",
    url: "https://example.com/nvda",
    cached: true,
    persisted: true,
  });

  assert.equal(row.isClickable, true);
  assert.equal(row.cached, true);
  assert.equal(row.sourceType, "Cached Article");
  assert.equal(row.fallback, false);
});

test("news merge keeps ticker rows first and removes exact duplicate links", () => {
  const tickerRows = [{ id: "ticker", headline: "Ticker catalyst", url: "https://example.com/ticker" }];
  const marketRows = [
    { id: "duplicate", headline: "Ticker catalyst", url: "https://example.com/ticker" },
    { id: "market", headline: "Market context", url: "https://example.com/market" },
  ];

  assert.deepEqual(mergeNewsRows(tickerRows, marketRows).map((row) => row.id), ["ticker", "market"]);
});
