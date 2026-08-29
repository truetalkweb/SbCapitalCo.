import assert from "node:assert/strict";
import test from "node:test";

import { createVisibilityAwarePoller } from "../src/utils/visibilityScheduler.js";

function fakeDocument(initial = "visible") {
  const listeners = new Set();
  return {
    visibilityState: initial,
    addEventListener(_name, listener) { listeners.add(listener); },
    removeEventListener(_name, listener) { listeners.delete(listener); },
    setVisibility(value) {
      this.visibilityState = value;
      listeners.forEach((listener) => listener());
    },
  };
}

test("visibility-aware polling pauses while hidden and resumes once visible", async () => {
  const documentRef = fakeDocument("hidden");
  let calls = 0;
  const stop = createVisibilityAwarePoller(() => { calls += 1; }, 50, { documentRef });

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls, 0);
  documentRef.setVisibility("visible");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls, 1);
  documentRef.setVisibility("hidden");
  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.equal(calls, 1);
  stop();
});

test("visibility-aware polling never overlaps slow callbacks", async () => {
  const documentRef = fakeDocument();
  let active = 0;
  let maxActive = 0;
  const stop = createVisibilityAwarePoller(async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 25));
    active -= 1;
  }, 5, { documentRef });

  await new Promise((resolve) => setTimeout(resolve, 80));
  stop();
  assert.equal(maxActive, 1);
});
