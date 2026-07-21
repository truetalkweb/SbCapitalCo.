import assert from "node:assert/strict";
import test from "node:test";

import { getTradingActionMode } from "../src/services/tradingActionPolicy.js";

test("public and disconnected order controls are review-only", () => {
  assert.equal(getTradingActionMode(), "review-only");
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

test("paper simulation requires connected private broker tooling", () => {
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
  }), "paper");
  assert.equal(getTradingActionMode({
    brokerConnected: true,
    brokerToolsEnabled: true,
    liveTradingEnabled: true,
    requestedMode: "live",
  }), "live");
});
