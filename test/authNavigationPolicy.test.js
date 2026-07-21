import assert from "node:assert/strict";
import test from "node:test";

import {
  getSafeAuthReturnPath,
  isSafeInternalReturnPath,
} from "../src/services/authNavigationPolicy.js";

test("authentication restoration preserves an internal workspace destination", () => {
  assert.equal(
    getSafeAuthReturnPath("https://www.sbcapitalco.com/terminal?view=scanner#results"),
    "/terminal?view=scanner#results",
  );
});

test("authentication restoration strips tokens and provider errors", () => {
  const restored = getSafeAuthReturnPath(
    "https://www.sbcapitalco.com/?access_token=secret&refresh_token=hidden&error_description=bad#access_token=secret",
  );

  assert.equal(restored, "/");
  assert.equal(restored.includes("secret"), false);
});

test("only relative same-origin return paths pass the redirect gate", () => {
  assert.equal(isSafeInternalReturnPath("/settings"), true);
  assert.equal(isSafeInternalReturnPath("//attacker.example"), false);
  assert.equal(isSafeInternalReturnPath("https://attacker.example"), false);
  assert.equal(isSafeInternalReturnPath("settings"), false);
});
