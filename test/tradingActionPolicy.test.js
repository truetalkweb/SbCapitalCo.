import assert from "node:assert/strict";
import test from "node:test";

import { getTradingActionMode } from "../src/services/tradingActionPolicy.js";

test("paper execution is available without a broker; unapproved live routing remains review-only", () => {
  assert.equal(getTradingActionMode(), "paper");
  assert.equal(getTradingActionMode({
    brokerConnected: true,
    brokerToolsEnabled: false,
    liveTradingEnabled: true,
    requestedMode: "live",
  }), "review-only");
  assert.equal(getTradingActionMode({
    brokerConnected: false,
    brokerToolsEnabled: true,
    liveTradingEnabled: true,
    requestedMode: "live",
  }), "review-only");
});

test("paper simulation works with or without private broker tooling", () => {
  assert.equal(getTradingActionMode({ requestedMode: "paper", brokerConnected: false }), "paper");
  assert.equal(getTradingActionMode({
    brokerConnected: true,
    brokerToolsEnabled: true,
    requestedMode: "paper",
  }), "paper");
});

test("live mode fails closed unless both private broker tools and live trading are enabled", () => {
  assert.equal(getTradingActionMode({
    brokerConnected: true,
    brokerToolsEnabled: true,
    liveTradingEnabled: false,
    requestedMode: "live",
  }), "review-only");
  assert.equal(getTradingActionMode({
    brokerConnected: true,
    brokerToolsEnabled: true,
    liveTradingEnabled: true,
    requestedMode: "live",
  }), "live");
});
