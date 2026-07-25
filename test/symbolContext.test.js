import assert from "node:assert/strict";
import test from "node:test";

import {
  createSymbolContext,
  inferAssetType,
  isCurrentRequest,
  normalizeSymbol,
  resolveSelectionSource,
} from "../src/utils/symbolContext.js";

test("normalizeSymbol canonicalizes supported symbols and rejects unsafe input", () => {
  assert.equal(normalizeSymbol(" aapl "), "AAPL");
  assert.equal(normalizeSymbol("btc-usd"), "BTC-USD");
  assert.equal(normalizeSymbol("<script>"), "");
});

test("createSymbolContext records metadata and selection provenance", () => {
  const context = createSymbolContext("tsla", {
    name: "Tesla, Inc.",
    exchange: "NASDAQ",
    selectionSource: "scanner-row",
  });

  assert.equal(context.symbol, "TSLA");
  assert.equal(context.company, "Tesla, Inc.");
  assert.equal(context.exchange, "NASDAQ");
  assert.equal(context.assetType, "equity");
  assert.equal(context.selectionSource, "scanner-row");
  assert.ok(context.selectedAt);
});

test("asset type and request identity remain deterministic", () => {
  assert.equal(inferAssetType("BTC-USD"), "crypto");
  assert.equal(inferAssetType("EUR/USD"), "forex");
  assert.equal(isCurrentRequest(" nvda ", "NVDA"), true);
  assert.equal(isCurrentRequest("TSLA", "NVDA"), false);
});

test("generic same-symbol refreshes preserve explicit selection provenance", () => {
  const previous = createSymbolContext("COIN", {
    selectionSource: "dashboard-scanner",
  });

  assert.equal(
    resolveSelectionSource(previous, "COIN", "terminal"),
    "dashboard-scanner"
  );
  assert.equal(
    resolveSelectionSource(previous, "AAPL", "terminal"),
    "terminal"
  );
  assert.equal(
    resolveSelectionSource(previous, "COIN", "watchlist-row"),
    "watchlist-row"
  );
});
