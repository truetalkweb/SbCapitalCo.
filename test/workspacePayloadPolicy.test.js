import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_WORKSPACE_BYTES,
  PERSISTED_WORKSPACE_FIELDS,
  createWorkspacePayload,
  getWorkspacePayloadSize,
  isValidWorkspacePayload,
  serializeWatchlistForWorkspace,
} from "../src/services/workspacePayloadPolicy.js";

test("workspace payloads must be JSON objects", () => {
  assert.equal(isValidWorkspacePayload({ watchlist: ["AAPL"] }), true);
  assert.equal(isValidWorkspacePayload([]), false);
  assert.equal(isValidWorkspacePayload("workspace"), false);
  assert.equal(isValidWorkspacePayload(null), false);
});

test("workspace payload size is measured as UTF-8 bytes", () => {
  assert.equal(getWorkspacePayloadSize({ label: "é" }), 14);
});

test("oversized and unserializable workspace payloads are rejected", () => {
  assert.equal(
    isValidWorkspacePayload({ notes: "x".repeat(MAX_WORKSPACE_BYTES) }),
    false,
  );

  const cyclic = {};
  cyclic.self = cyclic;
  assert.equal(isValidWorkspacePayload(cyclic), false);
});

test("cloud watchlist serialization ignores transient quote changes", () => {
  const first = serializeWatchlistForWorkspace([
    { symbol: "aapl", price: 210.14, change: "+1.2%" },
    { symbol: "NVDA", price: 178.2, source: "Questrade" },
  ]);
  const next = serializeWatchlistForWorkspace([
    { symbol: "AAPL", price: 211.05, change: "+1.6%" },
    { symbol: "nvda", price: 179.8, source: "FMP" },
    { symbol: "AAPL", price: 211.05 },
  ]);

  assert.deepEqual(first, [{ symbol: "AAPL" }, { symbol: "NVDA" }]);
  assert.deepEqual(next, first);
});

test("workspace contract includes every user-owned terminal capability", () => {
  const values = Object.fromEntries(PERSISTED_WORKSPACE_FIELDS.map((field) => [field, `${field}-value`]));
  const payload = createWorkspacePayload(values);

  assert.deepEqual(Object.keys(payload), [...PERSISTED_WORKSPACE_FIELDS]);
  [
    "liveStocks",
    "alerts",
    "journalEntries",
    "journalDraft",
    "premiumPreferences",
    "layoutMode",
    "gridMode",
    "scannerPresets",
    "activeScannerPreset",
    "replayBookmarks",
    "replayNotes",
  ].forEach((field) => assert.equal(payload[field], `${field}-value`));
});
