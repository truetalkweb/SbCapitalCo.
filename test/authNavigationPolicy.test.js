import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_RECOVERY_MESSAGES,
  getAuthEventRecovery,
  getSafeAuthErrorMessage,
  getSafeAuthReturnPath,
  isSafeInternalReturnPath,
} from "../src/services/authNavigationPolicy.js";

test("authentication failures map to safe actionable messages", () => {
  assert.equal(getSafeAuthErrorMessage(new Error("Invalid login credentials")), "Email or password is incorrect.");
  assert.equal(getSafeAuthErrorMessage(new Error("Email not confirmed")), "Confirm your email before signing in.");
  assert.equal(getSafeAuthErrorMessage(new Error("Password should be stronger")), "Use a password with at least 8 characters.");
  assert.equal(getSafeAuthErrorMessage(new Error("Rate limit exceeded")), "Too many attempts. Wait briefly and try again.");
  assert.equal(getSafeAuthErrorMessage(new Error("connect ECONNREFUSED provider.internal")), "Authentication failed. Try again.");
});

test("Supabase auth events produce bounded recovery actions", () => {
  assert.deepEqual(getAuthEventRecovery("PASSWORD_RECOVERY", { initialized: true }), {
    passwordRecovery: true,
    restoreDestination: false,
    message: "",
  });
  assert.equal(getAuthEventRecovery("SIGNED_IN", { initialized: true }).restoreDestination, true);
  assert.equal(getAuthEventRecovery("TOKEN_REFRESHED", { initialized: true }).message, "");
  assert.equal(getAuthEventRecovery("SIGNED_OUT", { initialized: false }).message, "");
  assert.equal(getAuthEventRecovery("SIGNED_OUT", { initialized: true }).message, AUTH_RECOVERY_MESSAGES.sessionEnded);
});

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
