import assert from "node:assert/strict";
import test from "node:test";

import { parseNullableMarketNumber } from "../src/utils/marketNumbers.js";

test("missing market values remain unavailable instead of becoming zero", () => {
  assert.equal(parseNullableMarketNumber(null), null);
  assert.equal(parseNullableMarketNumber(undefined), null);
  assert.equal(parseNullableMarketNumber(""), null);
  assert.equal(parseNullableMarketNumber("   "), null);
});

test("real zero and formatted market values remain valid numbers", () => {
  assert.equal(parseNullableMarketNumber(0), 0);
  assert.equal(parseNullableMarketNumber("0.00%"), 0);
  assert.equal(parseNullableMarketNumber("+2.35%"), 2.35);
  assert.equal(parseNullableMarketNumber("$1,234.56"), 1234.56);
});

test("invalid market strings fail closed to unavailable", () => {
  assert.equal(parseNullableMarketNumber("-"), null);
  assert.equal(parseNullableMarketNumber("Unknown"), null);
  assert.equal(parseNullableMarketNumber("Pending"), null);
});
