import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_WORKSPACE_BYTES,
  getWorkspacePayloadSize,
  isValidWorkspacePayload,
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
