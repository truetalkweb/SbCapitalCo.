import assert from "node:assert/strict";
import test from "node:test";

import {
  captureRuntimeDiagnostic,
  getRuntimeDiagnostics,
  normalizeDiagnosticEvent,
  redactSensitiveText,
} from "../src/services/runtimeDiagnostics.js";
import { buildIssueReportPayload } from "../src/services/issueReportPayload.js";

test("runtime diagnostics redact credentials and auth query values", () => {
  const redacted = redactSensitiveText("Bearer secret.token.value password=hunter2 ?access_token=abc123");
  assert.equal(redacted.includes("hunter2"), false);
  assert.equal(redacted.includes("abc123"), false);
  assert.match(redacted, /REDACTED/);
});

test("diagnostics retain actionable context without full external URLs", () => {
  const event = normalizeDiagnosticEvent({
    type: "runtime",
    message: "Chart failed",
    source: "https://provider.example/private/path?token=secret",
    line: 12,
  });
  assert.equal(event.message, "Chart failed");
  assert.equal(event.source, "provider.example");
  assert.equal(event.line, 12);
});

test("issue payload includes only bounded redacted diagnostics", () => {
  captureRuntimeDiagnostic({ type: "promise", message: "api_key=private-value failed" });
  const payload = buildIssueReportPayload({
    category: "data",
    description: "Quote panel did not refresh with token=secret-value",
    workspace: "charts",
  });
  assert.equal(payload.category, "data");
  assert.equal(payload.workspace, "charts");
  assert.equal(payload.description.includes("secret-value"), false);
  assert.ok(payload.diagnostics.length >= 1);
  assert.equal(getRuntimeDiagnostics(100).length <= 25, true);
});
