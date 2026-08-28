import assert from "node:assert/strict";
import test from "node:test";

import { shouldFetchMarketNews } from "../src/utils/scannerNewsAdapters.js";

test("broad market news is requested only when ticker coverage is insufficient", () => {
  assert.equal(shouldFetchMarketNews([], 6), true);
  assert.equal(shouldFetchMarketNews(new Array(5).fill({}), 6), true);
  assert.equal(shouldFetchMarketNews(new Array(6).fill({}), 6), false);
  assert.equal(shouldFetchMarketNews(new Array(12).fill({}), 6), false);
});
