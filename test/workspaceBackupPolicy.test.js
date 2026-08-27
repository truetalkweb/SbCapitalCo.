import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSPACE_BACKUP_MARKER,
  WORKSPACE_BACKUP_VERSION,
  createWorkspaceBackup,
  parseWorkspaceBackup,
  sanitizeImportedWorkspace,
  serializeWorkspaceBackup,
} from "../src/services/workspaceBackupPolicy.js";

test("workspace backups round-trip recognized private workspace fields", () => {
  const serialized = serializeWorkspaceBackup(
    {
      selectedStock: "NVDA",
      liveStocks: [{ symbol: "NVDA" }],
      replayNotes: "Review the opening range.",
    },
    { exportedAt: "2026-08-27T12:00:00.000Z" },
  );
  const parsed = parseWorkspaceBackup(serialized);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.exportedAt, "2026-08-27T12:00:00.000Z");
  assert.equal(parsed.fieldCount, 3);
  assert.deepEqual(parsed.payload.liveStocks, [{ symbol: "NVDA" }]);
});

test("workspace imports discard unknown fields instead of applying them", () => {
  const sanitized = sanitizeImportedWorkspace({
    selectedStock: "AAPL",
    injectedRole: "admin",
    serviceKey: "never-import-this",
  });

  assert.deepEqual(sanitized, { selectedStock: "AAPL" });
  assert.equal(Object.hasOwn(sanitized, "injectedRole"), false);
  assert.equal(Object.hasOwn(sanitized, "serviceKey"), false);
});

test("workspace backup parser rejects malformed, foreign, and unsupported files", () => {
  assert.equal(parseWorkspaceBackup("not json").ok, false);
  assert.equal(parseWorkspaceBackup(JSON.stringify({ marker: "foreign", version: 1, payload: { selectedStock: "AAPL" } })).ok, false);
  assert.equal(parseWorkspaceBackup(JSON.stringify({ marker: WORKSPACE_BACKUP_MARKER, version: 99, payload: { selectedStock: "AAPL" } })).ok, false);
  assert.equal(parseWorkspaceBackup(JSON.stringify({ marker: WORKSPACE_BACKUP_MARKER, version: WORKSPACE_BACKUP_VERSION, payload: { unknown: true } })).ok, false);
});

test("workspace backup creation requires at least one supported field", () => {
  assert.equal(createWorkspaceBackup({ unknown: true }), null);
  assert.equal(createWorkspaceBackup(null), null);
});
