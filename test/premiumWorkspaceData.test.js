import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStocks,
  hasNumericValue,
  makeJournalTrades,
  makeNews,
  makeReplayTrades,
  nullableMoveOf,
} from "../src/components/premium/premiumWorkspaceData.js";

test("workspace numeric helpers preserve missing values", () => {
  assert.equal(hasNumericValue(null), false);
  assert.equal(hasNumericValue("1.25x"), true);
  assert.equal(nullableMoveOf({ changePercent: null }), null);
  assert.equal(nullableMoveOf({ changePercent: "-2.40%" }), -2.4);
});

test("workspace stock adapter preserves the selected unavailable symbol", () => {
  const rows = buildStocks([], [], null, "ZZZZ");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].symbol, "ZZZZ");
  assert.equal(rows[0].price, null);
  assert.equal(rows[0].change, null);
  assert.equal(rows[0].dataMode, "unavailable");
});

test("workspace stock adapter ranks provider rows and keeps market context", () => {
  const rows = buildStocks([], [{
    symbol: "NVDA",
    price: 200,
    changePercent: 2.5,
    volume: 1_000_000,
    relativeVolume: 1.8,
    catalyst: "Data-center demand",
    source: "Provider",
    verified: true,
  }], null, "NVDA");
  assert.equal(rows[0].symbol, "NVDA");
  assert.equal(rows[0].price, 200);
  assert.equal(rows[0].dataMode, "provider");
  assert.match(rows[0].setup, /Data-center demand/);
});

test("workspace news adapter uses real rows before deterministic fallback", () => {
  const real = makeNews([{ headline: "Nvidia announces new platform", symbol: "NVDA" }], "NVDA");
  assert.equal(real.length, 1);
  assert.match(real[0].headline, /Nvidia/);

  const fallback = makeNews([], "NVDA");
  assert.ok(fallback.length > 0);
  assert.ok(fallback.every((row) => row.headline));
});

test("journal and replay adapters preserve review-only records", () => {
  const journal = makeJournalTrades([{ id: "j1", symbol: "TSLA", pnl: -25 }]);
  assert.equal(journal[0].symbol, "TSLA");
  assert.equal(journal[0].pnl, -25);

  const replay = makeReplayTrades([{ type: "Sell", price: 210 }], "TSLA");
  assert.equal(replay[0].symbol, "TSLA");
  assert.equal(replay[0].side, "Sell");
  assert.equal(replay[0].price, 210);
});
