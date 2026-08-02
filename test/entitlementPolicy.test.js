import assert from "node:assert/strict";
import test from "node:test";

import { premiumWorkspaceViews } from "../src/config/premiumNavigation.js";
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
  assert.equal(canUseWorkspace(premium, "broker"), false);
  assert.equal(canUseWorkspace(pro, "portfolio"), true);
});

test("every public workspace follows the complete plan matrix", () => {
  const expectedByPlan = {
    free: ["dashboard", "scanner", "chart-analysis", "watchlist", "news", "alerts", "orders", "positions", "settings"],
    pro: ["dashboard", "scanner", "chart-analysis", "watchlist", "news", "alerts", "orders", "positions", "replay", "journal", "settings"],
    premium: ["dashboard", "scanner", "chart-analysis", "watchlist", "news", "alerts", "orders", "positions", "risk", "performance", "replay", "journal", "settings"],
    admin: ["dashboard", "scanner", "chart-analysis", "watchlist", "news", "alerts", "orders", "positions", "risk", "performance", "replay", "journal", "settings"],
  };
  const workspaces = premiumWorkspaceViews.map(({ id }) => id);

  for (const [plan, allowed] of Object.entries(expectedByPlan)) {
    for (const workspace of workspaces) {
      assert.equal(canUseWorkspace({ plan }, workspace), allowed.includes(workspace), `${plan}:${workspace}`);
    }
  }

  assert.equal(canUseWorkspace({ plan: "premium" }, "broker"), false);
  assert.equal(canUseWorkspace({ plan: "admin" }, "broker"), true);
});

test("inactive paid entitlement payload fails closed when server capabilities are Free", () => {
  const inactive = {
    plan: "free",
    assignedPlan: "premium",
    status: "past_due",
    capabilities: DEFAULT_ENTITLEMENTS.capabilities,
  };

  for (const workspace of premiumWorkspaceViews.map(({ id }) => id)) {
    assert.equal(
      canUseWorkspace(inactive, workspace),
      ["dashboard", "scanner", "chart-analysis", "watchlist", "news", "alerts", "orders", "positions", "settings"].includes(workspace),
      workspace,
    );
  }
});

test("Admin receives the complete frontend workspace surface", () => {
  const admin = { plan: "admin", capabilities: {} };

  for (const workspace of ["replay", "journal", "risk", "performance", "broker"]) {
    assert.equal(canUseWorkspace(admin, workspace), true, workspace);
  }
});
