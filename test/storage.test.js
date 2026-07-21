import assert from "node:assert/strict";
import test from "node:test";

import { loadSetting, removeSettings, saveSetting } from "../src/utils/storage.js";

function withWindow(localStorage, callback) {
  const previousWindow = globalThis.window;
  globalThis.window = { localStorage };
  try {
    return callback();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("settings survive a fresh read from browser storage", () => {
  const storage = createMemoryStorage();

  withWindow(storage, () => {
    saveSetting("sb_layout_mode", "4");
    saveSetting("sb_watchlist", ["AAPL", "NVDA"]);

    assert.equal(loadSetting("sb_layout_mode", "1"), "4");
    assert.deepEqual(loadSetting("sb_watchlist", []), ["AAPL", "NVDA"]);
  });
});

test("missing or corrupted settings fail safely to the supplied fallback", () => {
  const storage = createMemoryStorage();
  storage.setItem("broken", "{not-json");

  withWindow(storage, () => {
    assert.equal(loadSetting("missing", "default"), "default");
    assert.deepEqual(loadSetting("broken", { safe: true }), { safe: true });
  });
});

test("storage failures do not crash the terminal", () => {
  const storage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };

  withWindow(storage, () => {
    assert.doesNotThrow(() => saveSetting("key", "value"));
    assert.equal(loadSetting("key", "fallback"), "fallback");
    assert.doesNotThrow(() => removeSettings(["key"]));
  });
});

test("removeSettings removes only the requested keys", () => {
  const storage = createMemoryStorage();

  withWindow(storage, () => {
    saveSetting("keep", 1);
    saveSetting("remove", 2);
    removeSettings(["remove"]);

    assert.equal(loadSetting("keep", 0), 1);
    assert.equal(loadSetting("remove", 0), 0);
  });
});
