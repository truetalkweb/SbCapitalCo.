import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const vercelConfig = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const headers = Object.fromEntries(vercelConfig.headers[0].headers.map(({ key, value }) => [key.toLowerCase(), value]));

test("Vercel applies public-launch browser security headers", () => {
  assert.match(headers["content-security-policy"], /default-src 'self'/);
  assert.match(headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.match(headers["content-security-policy"], /connect-src[^;]+sbcapitalco-backend-production\.up\.railway\.app/);
  assert.equal(headers["x-frame-options"], "DENY");
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["referrer-policy"], "strict-origin-when-cross-origin");
  assert.match(headers["permissions-policy"], /camera=\(\)/);
  assert.equal(headers["cross-origin-opener-policy"], "same-origin");
});
