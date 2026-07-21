import assert from "node:assert/strict";
import test from "node:test";

import { premiumWorkspaceViews } from "../src/config/premiumNavigation.js";

const EXPECTED_WORKSPACES = [
  "dashboard",
  "scanner",
  "chart-analysis",
  "watchlist",
  "news",
  "alerts",
  "orders",
  "positions",
  "risk",
  "performance",
  "replay",
  "journal",
  "settings",
];

test("premium navigation exposes every public terminal workspace once", () => {
  const ids = premiumWorkspaceViews.map((item) => item.id);

  assert.deepEqual(ids, EXPECTED_WORKSPACES);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(premiumWorkspaceViews.every((item) => item.label && item.group));
});

test("Orders and Positions remain part of the public premium navigation contract", () => {
  assert.ok(premiumWorkspaceViews.some((item) => item.id === "orders"));
  assert.ok(premiumWorkspaceViews.some((item) => item.id === "positions"));
});
