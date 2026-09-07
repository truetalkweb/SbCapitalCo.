import assert from "node:assert/strict";
import test from "node:test";

import { getQuestradeHealth, normalizeProviderStatus } from "../src/utils/healthStatus.js";
import { buildTerminalSourceLabels } from "../src/utils/marketUtils.js";

test("healthy fallback remains available while a provider is limited", () => {
  const status = normalizeProviderStatus({
    providerLimited: true,
    cached: true,
    lastSuccessAt: "2026-07-24T10:00:00.000Z",
  }, {
    source: "FMP + cache",
    now: new Date("2026-07-24T10:00:30.000Z").getTime(),
  });

  assert.equal(status.state, "Provider Limited");
  assert.equal(status.available, true);
  assert.equal(status.source, "FMP + cache");
  assert.equal(status.cacheAgeMs, 30_000);
});

test("old cached data is explicitly stale", () => {
  const status = normalizeProviderStatus({
    cached: true,
    updatedAt: "2026-07-24T10:00:00.000Z",
  }, {
    now: new Date("2026-07-24T10:05:00.000Z").getTime(),
  });

  assert.equal(status.state, "Stale");
  assert.equal(status.available, true);
});

test("unavailable data fails closed", () => {
  const status = normalizeProviderStatus({ unavailable: true });
  assert.equal(status.state, "Unavailable");
  assert.equal(status.available, false);
  assert.equal(status.cacheAgeMs, null);
});

test("configured Questrade source without successful data remains pending", () => {
  const platformHealth = {
    marketData: {
      source: "Questrade",
      lastSuccessAt: null,
      delayed: null,
    },
  };

  assert.equal(getQuestradeHealth({ platformHealth }).label, "QTRD PENDING");
  assert.equal(getQuestradeHealth({ brokerConnected: true, platformHealth }).label, "QTRD PENDING");
  assert.equal(buildTerminalSourceLabels({ platformHealth }).marketDataStatusLabel, "QUOTES UNAVAILABLE");
});

test("provider success is not proof of live quotes; identity and a fresh market timestamp are required", () => {
  const unusableQuotes = {
    NVDA: { source: "QTRD", price: null },
  };
  const usableQuotes = {
    NVDA: { symbol: "NVDA", source: "QTRD", price: 210.69, asOf: Date.now() },
  };
  const confirmedHealth = {
    marketData: {
      source: "Questrade",
      httpStatus: 200,
      lastSuccessAt: "2026-07-25T20:00:00.000Z",
    },
  };

  assert.equal(getQuestradeHealth({ liveQuotes: unusableQuotes }).label, "QTRD PENDING");
  assert.equal(buildTerminalSourceLabels({ liveQuotes: unusableQuotes }).marketDataStatusLabel, "QUOTES UNAVAILABLE");
  assert.equal(getQuestradeHealth({ liveQuotes: usableQuotes }).label, "QTRD LIVE");
  assert.equal(buildTerminalSourceLabels({ liveQuotes: usableQuotes }).marketDataStatusLabel, "QUOTES LIVE");
  assert.equal(buildTerminalSourceLabels({ platformHealth: confirmedHealth }).marketDataStatusLabel, "QUOTES UNAVAILABLE");
  assert.equal(getQuestradeHealth({ platformHealth: confirmedHealth }).label, "QTRD AVAILABLE");
  for (const quality of ["cached", "delayed", "historical", "simulated", "stale"]) {
    const liveQuotes = { NVDA: { ...usableQuotes.NVDA, quality } };
    assert.equal(buildTerminalSourceLabels({ liveQuotes }).marketDataStatusLabel, `QUOTES ${quality.toUpperCase()}`);
    assert.notEqual(getQuestradeHealth({ liveQuotes }).status, "ok");
  }
});
