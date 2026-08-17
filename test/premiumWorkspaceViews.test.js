import assert from "node:assert/strict";
import test from "node:test";
import {
  filterMoverRows,
  filterNewsRows,
  filterOrderRows,
  filterWatchlistRows,
  selectVisibleRow,
} from "../src/utils/premiumWorkspaceViews.js";

test("order views expose only matching lifecycle states", () => {
  const rows = [
    { symbol: "AAPL", status: "FILLED" },
    { symbol: "NVDA", status: "WORKING" },
    { symbol: "AMD", status: "PARTIALLY FILLED" },
    { symbol: "TSLA", status: "REJECTED" },
  ];
  assert.deepEqual(filterOrderRows(rows, "Working").map((row) => row.symbol), ["NVDA", "AMD"]);
  assert.deepEqual(filterOrderRows(rows, "Filled").map((row) => row.symbol), ["AAPL"]);
  assert.deepEqual(filterOrderRows(rows, "Rejected").map((row) => row.symbol), ["TSLA"]);
});

test("news views classify headlines and honor watchlist membership", () => {
  const rows = [
    { symbol: "AAPL", headline: "Apple raises quarterly guidance" },
    { symbol: "COIN", headline: "Bitcoin strength lifts Coinbase" },
    { symbol: "SPY", headline: "Fed rate outlook moves the market" },
  ];
  assert.equal(filterNewsRows(rows, "Earnings").length, 1);
  assert.equal(filterNewsRows(rows, "Crypto")[0].symbol, "COIN");
  assert.equal(filterNewsRows(rows, "Watchlist", "", ["AAPL"])[0].symbol, "AAPL");
});

test("watchlist and mover views use real row fields", () => {
  const rows = [
    { symbol: "SPY", change: "+0.2%", relativeVolume: 0.8 },
    { symbol: "NVDA", change: "+3.1%", relativeVolume: 2.2 },
    { symbol: "TSLA", change: "-4.0%", relativeVolume: 1.7 },
  ];
  assert.deepEqual(filterWatchlistRows(rows, "ETFs").map((row) => row.symbol), ["SPY"]);
  assert.deepEqual(filterWatchlistRows(rows, "Momentum").map((row) => row.symbol), ["NVDA", "TSLA"]);
  assert.deepEqual(filterMoverRows(rows, "Losers").map((row) => row.symbol), ["TSLA"]);
});

test("detail selection cannot remain on a row hidden by the active view", () => {
  const visibleRows = [{ id: "working", symbol: "TSLA" }];
  assert.equal(selectVisibleRow(visibleRows, "filled", "NVDA")?.id, "working");
  assert.equal(selectVisibleRow([], "filled", "NVDA"), null);
});
