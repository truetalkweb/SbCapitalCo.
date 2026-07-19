import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ENTITLEMENTS,
  canUseFeature,
  canUseWorkspace,
  normalizePlan,
  planMeets,
} from "../src/services/entitlementPolicy.js";

test("unknown or missing plans fail closed to Free", () => {
  assert.equal(normalizePlan(), "free");
  assert.equal(normalizePlan("owner"), "free");
  assert.equal(planMeets("owner", "pro"), false);
});

test("Free retains Orders and Positions but not paid workspaces", () => {
  assert.equal(canUseWorkspace(DEFAULT_ENTITLEMENTS, "orders"), true);
  assert.equal(canUseWorkspace(DEFAULT_ENTITLEMENTS, "positions"), true);
  assert.equal(canUseWorkspace(DEFAULT_ENTITLEMENTS, "replay"), false);
  assert.equal(canUseWorkspace(DEFAULT_ENTITLEMENTS, "risk"), false);
});

test("explicit server capability denial overrides plan-derived UI access", () => {
  const entitlements = {
    plan: "premium",
    capabilities: {
      risk: false,
      performance: true,
    },
  };

  assert.equal(canUseFeature(entitlements, "risk"), false);
  assert.equal(canUseFeature(entitlements, "performance"), true);
});

test("workspace aliases resolve to their protected capabilities", () => {
  const pro = { plan: "pro" };
  const premium = { plan: "premium" };

  assert.equal(canUseWorkspace(pro, "broker"), false);
  assert.equal(canUseWorkspace(premium, "broker"), true);
  assert.equal(canUseWorkspace(pro, "portfolio"), true);
});

test("Admin receives the complete frontend workspace surface", () => {
  const admin = { plan: "admin", capabilities: {} };

  for (const workspace of ["replay", "journal", "risk", "performance", "broker"]) {
    assert.equal(canUseWorkspace(admin, workspace), true, workspace);
  }
});
