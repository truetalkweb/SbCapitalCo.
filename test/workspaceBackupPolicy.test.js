import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSPACE_BACKUP_MARKER,
  WORKSPACE_BACKUP_VERSION,
  createWorkspaceBackup,
  parseWorkspaceBackup,
  sanitizeImportedWorkspace,
  serializeWorkspaceBackup,
  readWorkspaceBackup,
  prepareWorkspaceRestore,
  MAX_BACKUP_BYTES,
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

const backup = payload => JSON.stringify({ marker: WORKSPACE_BACKUP_MARKER, version: 1, payload });
test('legacy paper snapshots and limits are preserved on the server rather than restored', async () => {
  const payload = { replayNotes: 'Import this note', paperLedger: { authority: 'server-v1', positions: { AAPL: 100 } }, orders: [{}], positions: {}, realizedPnL: 999, maxOrderValue: 0, riskPerTrade: 0, dailyLossLimit: 0 };
  const parsed = await readWorkspaceBackup({ text: async () => backup(payload) });
  assert.deepEqual(parsed.payload, { replayNotes: 'Import this note' }); assert.equal(parsed.excluded.length, 7);
  const exported = JSON.parse(serializeWorkspaceBackup(payload));
  assert.deepEqual(exported.payload, parsed.payload); assert.equal(exported.version, 1);
});
test('background-owned rules and monitor preference are excluded while browser rules remain portable', () => {
  const payload = { alerts: [{ id: 'rule', symbol: 'AAPL', trigger: 100, direction: 'above', active: true }], premiumPreferences: { notificationPreferences: { priceAlerts: false, soundAlerts: true } } };
  const server = prepareWorkspaceRestore(payload, { backgroundEnabled: true });
  assert.equal(Object.hasOwn(server.payload, 'alerts'), false);
  assert.deepEqual(server.payload.premiumPreferences.notificationPreferences, { soundAlerts: true });
  const local = createWorkspaceBackup(payload);
  assert.deepEqual(local.payload.alerts, payload.alerts); assert.equal(Object.hasOwn(local.payload.premiumPreferences.notificationPreferences, 'priceAlerts'), false);
  assert.equal(payload.premiumPreferences.notificationPreferences.priceAlerts, false);
});
test('malformed supported fields cannot replace valid workspace state', () => {
  for (const payload of [{ journalEntries: [null] }, { alerts: 'rules' }, { journalDraft: { symbol: 50 } }, { premiumPreferences: { notificationPreferences: [] } }, { liveStocks: [{ symbol: {} }] }, { timeZone: 'Not/AZone' }, { quantity: -1 }, { themeMode: {} }]) {
    assert.equal(parseWorkspaceBackup(backup(payload)).ok, false, JSON.stringify(payload));
  }
  assert.equal(parseWorkspaceBackup(backup({ journalEntries: [], quantity: '100', replayEquity: [100000, null], selectedScannerStock: null, replaySession: null })).ok, true);
  assert.equal(parseWorkspaceBackup('{"marker":"sb-terminal-workspace-backup","version":1,"payload":{"premiumPreferences":{"__proto__":{"injected":true}}}}').ok, false);
});
test('oversized files are rejected before reading and account-only backups have no restore action', async () => {
  let read = false;
  await assert.rejects(readWorkspaceBackup({ size: MAX_BACKUP_BYTES + 1, text: async () => { read = true; return ''; } }), /2 MB/);
  assert.equal(read, false);
  await assert.rejects(readWorkspaceBackup({ text: async () => backup({ paperLedger: {} }) }), /no restorable/);
  await assert.rejects(readWorkspaceBackup({ text: async () => 'invalid JSON' }), /invalid JSON/);
});
test('preview describes only imported sections and preserves omitted fields', async () => {
  const result = await readWorkspaceBackup({ text: async () => backup({ journalEntries: [], replayNotes: 'Saved note', injectedRole: 'admin' }) });
  assert.equal(result.fieldCount, 2); assert.equal(result.counts.journal, 0); assert.equal(result.counts.browserAlerts, undefined);
  assert.deepEqual(result.sections, ['Journal records and draft', 'Replay sessions, bookmarks and notes']);
  assert.equal(Object.hasOwn(result.payload, 'injectedRole'), false);
});
