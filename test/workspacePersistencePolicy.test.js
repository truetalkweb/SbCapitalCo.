import assert from "node:assert/strict";
import test from "node:test";

import {
  getWorkspaceConflictKey,
  getWorkspaceFallbackKey,
  getWorkspaceFingerprint,
  loadWorkspaceFallback,
  reconcileWorkspacePayloads,
  saveWorkspaceConflict,
  saveWorkspaceFallback,
} from "../src/services/workspacePersistencePolicy.js";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test("workspace fingerprints ignore object key insertion order", () => {
  const first = { alerts: [{ id: "a1" }], preferences: { theme: "dark", compact: true } };
  const second = { preferences: { compact: true, theme: "dark" }, alerts: [{ id: "a1" }] };

  assert.equal(getWorkspaceFingerprint(first), getWorkspaceFingerprint(second));
});

test("fallback storage is isolated by authenticated user id", () => {
  const storage = createMemoryStorage();
  saveWorkspaceFallback(storage, "user-a", { watchlist: [{ symbol: "AAPL" }] }, { revision: 4 });
  saveWorkspaceFallback(storage, "user-b", { watchlist: [{ symbol: "NVDA" }] }, { revision: 2 });

  assert.deepEqual(loadWorkspaceFallback(storage, "user-a")?.payload.watchlist, [{ symbol: "AAPL" }]);
  assert.deepEqual(loadWorkspaceFallback(storage, "user-b")?.payload.watchlist, [{ symbol: "NVDA" }]);
  assert.notEqual(getWorkspaceFallbackKey("user-a"), getWorkspaceFallbackKey("user-b"));
});

test("blocked browser storage does not block cloud workspace restoration", () => {
  const blockedStorage = {
    getItem() {
      throw new Error("storage blocked");
    },
  };

  assert.equal(loadWorkspaceFallback(blockedStorage, "user-a"), null);
});

test("legacy raw fallback payloads remain readable and migrate on the next save", () => {
  const storage = createMemoryStorage();
  storage.setItem(getWorkspaceFallbackKey("legacy-user"), JSON.stringify({ alerts: [{ id: "old" }] }));

  const legacy = loadWorkspaceFallback(storage, "legacy-user");
  assert.equal(legacy?.legacy, true);
  assert.equal(legacy?.revision, 0);

  saveWorkspaceFallback(storage, "legacy-user", legacy.payload, { revision: 3 });
  const migrated = loadWorkspaceFallback(storage, "legacy-user");
  assert.equal(migrated?.legacy, false);
  assert.equal(migrated?.revision, 3);
});

test("three-way reconciliation preserves independent local and remote changes", () => {
  const base = { theme: "dark", alerts: [], replayNotes: "" };
  const local = { theme: "light", alerts: [], replayNotes: "" };
  const remote = { theme: "dark", alerts: [{ id: "remote-alert" }], replayNotes: "" };

  const result = reconcileWorkspacePayloads({ base, local, remote });
  assert.deepEqual(result.merged, {
    alerts: [{ id: "remote-alert" }],
    replayNotes: "",
    theme: "light",
  });
  assert.deepEqual(result.conflictKeys, []);
});

test("same-field conflicts deterministically keep cloud state and retain a local backup", () => {
  const storage = createMemoryStorage();
  const local = { replayNotes: "local note", theme: "dark" };
  const result = reconcileWorkspacePayloads({
    base: { replayNotes: "", theme: "dark" },
    local,
    remote: { replayNotes: "remote note", theme: "dark" },
  });

  assert.equal(result.merged.replayNotes, "remote note");
  assert.deepEqual(result.conflictKeys, ["replayNotes"]);
  assert.equal(saveWorkspaceConflict(storage, "user-a", local, result.conflictKeys), true);

  const backup = JSON.parse(storage.getItem(getWorkspaceConflictKey("user-a")));
  assert.deepEqual(backup.conflictKeys, ["replayNotes"]);
  assert.equal(backup.payload.replayNotes, "local note");
});
