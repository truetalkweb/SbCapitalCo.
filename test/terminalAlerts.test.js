import assert from "node:assert/strict";
import test from "node:test";

import { shouldTriggerPriceAlert } from "../src/hooks/useTerminalAlerts.js";

const now = Date.parse("2026-09-06T15:00:00Z");
const quote = (price, extra = {}) => ({ symbol: "AAPL", price, source: "Provider", timestamp: now / 1000, ...extra });

test("price alerts trigger only when monitoring and the rule are active", () => {
  const above = { symbol: "AAPL", active: true, direction: "above", trigger: 100 };

  assert.equal(shouldTriggerPriceAlert(above, quote(101), true, now), true);
  assert.equal(shouldTriggerPriceAlert(above, quote(101), false, now), false);
  assert.equal(shouldTriggerPriceAlert({ ...above, active: false }, quote(101), true, now), false);
});

test("price alert direction and invalid quotes fail safely", () => {
  const below = { symbol: "AAPL", active: true, direction: "below", trigger: 90 };
  assert.equal(shouldTriggerPriceAlert(below, quote(89), true, now), true);
  assert.equal(shouldTriggerPriceAlert(below, quote(91), true, now), false);
  assert.equal(shouldTriggerPriceAlert(below, quote(Number.NaN), true, now), false);
});

test("stale, cached, synthetic, delayed, mismatched and unverified quotes cannot trigger alerts", () => {
  const above = { symbol: "AAPL", active: true, direction: "above", trigger: 100 };
  for (const extra of [{ timestamp: now / 1000 - 60 }, { timestamp: null }, { cached: true }, { fallback: true },
    { isSynthetic: true }, { delayed: true }, { symbol: "TSLA" }, { timestampSource: "received" }]) {
    assert.equal(shouldTriggerPriceAlert(above, quote(101, extra), true, now), false);
  }
  assert.equal(shouldTriggerPriceAlert(above, 101, true, now), false);
});
