import assert from "node:assert/strict";
import test from "node:test";

import { shouldTriggerPriceAlert } from "../src/hooks/useTerminalAlerts.js";

test("price alerts trigger only when monitoring and the rule are active", () => {
  const above = { active: true, direction: "above", trigger: 100 };

  assert.equal(shouldTriggerPriceAlert(above, 101, true), true);
  assert.equal(shouldTriggerPriceAlert(above, 101, false), false);
  assert.equal(shouldTriggerPriceAlert({ ...above, active: false }, 101, true), false);
});

test("price alert direction and invalid quotes fail safely", () => {
  assert.equal(shouldTriggerPriceAlert({ active: true, direction: "below", trigger: 90 }, 89, true), true);
  assert.equal(shouldTriggerPriceAlert({ active: true, direction: "below", trigger: 90 }, 91, true), false);
  assert.equal(shouldTriggerPriceAlert({ active: true, direction: "above", trigger: 100 }, Number.NaN, true), false);
});
