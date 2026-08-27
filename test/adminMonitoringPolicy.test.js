import assert from "node:assert/strict";
import test from "node:test";

import {
  adminMonitoringErrorMessage,
  adminMonitoringMessage,
  readAdminJsonResponse,
} from "../src/services/adminMonitoringPolicy.js";

function response({ body, contentType = "application/json", ok = true, status = 200 }) {
  return {
    ok,
    status,
    headers: { get: () => contentType },
    json: async () => JSON.parse(body),
  };
}

test("admin monitoring accepts successful JSON responses", async () => {
  const result = await readAdminJsonResponse(response({ body: JSON.stringify({ services: { backend: "online" } }) }));
  assert.equal(result.services.backend, "online");
});

test("admin monitoring hides HTML and malformed response details", async () => {
  await assert.rejects(
    readAdminJsonResponse(response({ body: "<!doctype html>", contentType: "text/html" })),
    { message: "Admin monitoring is temporarily unavailable." }
  );
  await assert.rejects(
    readAdminJsonResponse(response({ body: "not-json" })),
    { message: "Admin monitoring is temporarily unavailable." }
  );
});

test("admin monitoring gives a clean authentication message", () => {
  assert.equal(adminMonitoringMessage(401), "Admin access could not be verified. Sign in again and retry.");
  assert.equal(adminMonitoringMessage(503), "Admin monitoring is temporarily unavailable.");
});

test("admin monitoring never exposes low-level network errors", () => {
  assert.equal(adminMonitoringErrorMessage(new Error("Failed to fetch")), "Admin monitoring is temporarily unavailable.");
  assert.equal(adminMonitoringErrorMessage(new Error("Unexpected token '<'")), "Admin monitoring is temporarily unavailable.");
  assert.equal(adminMonitoringErrorMessage(new Error(adminMonitoringMessage(401))), adminMonitoringMessage(401));
});
