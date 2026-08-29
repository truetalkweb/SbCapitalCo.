import process from "node:process";

const frontendUrl = String(process.env.SMOKE_FRONTEND_URL || "https://www.sbcapitalco.com").replace(/\/+$/, "");
const backendUrl = String(process.env.SMOKE_BACKEND_URL || "https://sbcapitalco-backend-production.up.railway.app").replace(/\/+$/, "");
const canonicalOrigin = new URL(frontendUrl).origin;
const failures = [];

function pass(label) {
  console.log(`PASS ${label}`);
}

function fail(label, detail) {
  failures.push(label);
  console.error(`FAIL ${label}: ${detail}`);
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetch(url, { redirect: "manual", ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function check(label, operation) {
  try {
    const result = await operation();
    if (result === true) pass(label);
    else fail(label, result || "check returned no evidence");
  } catch (error) {
    fail(label, error?.name === "AbortError" ? "request timed out" : String(error?.message || error));
  }
}

let frontendHtml = "";
await check("frontend availability and security headers", async () => {
  const response = await request(frontendUrl);
  frontendHtml = await response.text();
  if (response.status !== 200) return `HTTP ${response.status}`;
  const requiredHeaders = [
    "content-security-policy",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
    "cross-origin-opener-policy",
    "strict-transport-security",
  ];
  const missing = requiredHeaders.filter((header) => !response.headers.get(header));
  return missing.length ? `missing ${missing.join(", ")}` : true;
});

let publicHealth = null;
await check("backend public health contract", async () => {
  const response = await request(`${backendUrl}/api/platform/health`);
  if (response.status !== 200) return `HTTP ${response.status}`;
  publicHealth = await response.json();
  const allowedModes = new Set(["Live", "Delayed", "Cached", "Simulated", "Degraded", "Unavailable"]);
  const services = ["broker", "marketData", "scanner", "ai", "news"];
  const invalid = services.filter((service) => !allowedModes.has(publicHealth?.[service]?.mode));
  if (invalid.length) return `invalid provider modes: ${invalid.join(", ")}`;
  const serialized = JSON.stringify(publicHealth).toLowerCase();
  return /tokenstore|access_token|refresh_token|api[_-]?key|railwayurl|api_server/.test(serialized)
    ? "public response contains a forbidden diagnostic field"
    : true;
});

await check("protected routes reject anonymous access", async () => {
  for (const path of ["/api/entitlements/me", "/api/config/status", "/api/health/deep", "/api/admin/monitoring"]) {
    const response = await request(`${backendUrl}${path}`);
    if (response.status !== 401) return `${path} returned ${response.status}`;
    const payload = await response.json();
    if (!payload.requestId || payload.requestId !== response.headers.get("x-request-id")) return `${path} correlation ID missing`;
  }
  return true;
});

await check("hostile CORS origin is rejected", async () => {
  const response = await request(`${backendUrl}/api/platform/health`, { headers: { Origin: "https://attacker.invalid" } });
  return response.status === 403 && !response.headers.get("access-control-allow-origin")
    ? true
    : `HTTP ${response.status} with ACAO ${response.headers.get("access-control-allow-origin")}`;
});

await check("canonical CORS and preflight are accepted", async () => {
  const response = await request(`${backendUrl}/api/platform/health`, { headers: { Origin: canonicalOrigin } });
  if (response.status !== 200 || response.headers.get("access-control-allow-origin") !== canonicalOrigin) {
    return `GET returned ${response.status} with unexpected ACAO`;
  }
  const preflight = await request(`${backendUrl}/api/platform/health`, {
    method: "OPTIONS",
    headers: { Origin: canonicalOrigin, "Access-Control-Request-Method": "GET" },
  });
  return preflight.status === 204 && preflight.headers.get("access-control-allow-origin") === canonicalOrigin
    ? true
    : `preflight returned ${preflight.status}`;
});

await check("rate-limit headers are present", async () => {
  const response = await request(`${backendUrl}/api/ticker/AAPL`);
  return response.headers.get("ratelimit") || response.headers.get("ratelimit-policy")
    ? true
    : "RateLimit headers missing";
});

await check("Supabase authentication is reachable", async () => {
  const response = await request(`${backendUrl}/api/entitlements/me`, { headers: { Authorization: "Bearer smoke-test-invalid-token" } });
  const payload = await response.json();
  return response.status === 401 && payload.error === "Session is invalid or expired."
    ? true
    : `auth gate returned ${response.status}: ${payload.error || "unknown response"}`;
});

await check("production bundles contain no server secrets", async () => {
  const scriptUrls = Array.from(frontendHtml.matchAll(/<script[^>]+src=["']([^"']+)["']/gi), (match) => new URL(match[1], frontendUrl).href);
  if (!scriptUrls.length) return "no application bundles found";
  const bundleText = (await Promise.all(scriptUrls.map(async (url) => {
    const response = await request(url);
    return response.status === 200 ? response.text() : "";
  }))).join("\n");
  const forbidden = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "QUESTRADE_REFRESH_TOKEN",
    "GEMINI_API_KEY",
    "FMP_API_KEY",
    "FINNHUB_API_KEY",
    "OPENAI_API_KEY",
    "FIREBASE_PRIVATE_KEY",
    "BEGIN PRIVATE KEY",
  ];
  const found = forbidden.filter((marker) => bundleText.includes(marker));
  return found.length ? `found forbidden markers: ${found.join(", ")}` : true;
});

if (failures.length) {
  console.error(`\nProduction smoke failed (${failures.length} checks).`);
  process.exitCode = 1;
} else {
  console.log("\nProduction smoke passed.");
}
