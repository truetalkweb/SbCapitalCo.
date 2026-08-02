import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PUBLIC_INFORMATION_EFFECTIVE_DATE,
  PUBLIC_INFORMATION_SECTIONS,
} from "../src/config/publicInformation.js";

test("public beta help exposes every required information section once", () => {
  const ids = PUBLIC_INFORMATION_SECTIONS.map(({ id }) => id);

  assert.deepEqual(ids, ["quick", "sources", "risk", "privacy", "terms", "support"]);
  assert.equal(new Set(ids).size, ids.length);
  assert.match(PUBLIC_INFORMATION_EFFECTIVE_DATE, /^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
});

test("public beta copy preserves the core safety and privacy disclosures", async () => {
  const source = await readFile(new URL("../src/components/PublicOnboarding.jsx", import.meta.url), "utf8");

  for (const statement of [
    "does not provide investment, legal, tax, or personalized financial advice",
    "may be delayed, cached, incomplete, inaccurate, or unavailable",
    "No paid checkout or public live-broker execution is enabled",
    "Passwords, access tokens, broker credentials, account numbers, and order payloads are excluded",
    "permanently delete your account",
    "Report an issue",
  ]) {
    assert.ok(source.includes(statement), statement);
  }
});
