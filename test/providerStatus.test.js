import assert from "node:assert/strict";
import test from "node:test";

import { normalizeProviderStatus } from "../src/utils/healthStatus.js";

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
