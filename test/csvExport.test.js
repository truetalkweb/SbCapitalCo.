import assert from "node:assert/strict";
import test from "node:test";

import { buildCsv, escapeCsvValue } from "../src/utils/csvExport.js";

test("CSV values safely escape commas, quotes, and missing fields", () => {
  assert.equal(escapeCsvValue('Breakout, "A+"'), '"Breakout, ""A+"""');
  assert.equal(escapeCsvValue(null), '""');
});

test("CSV output preserves declared header and row order", () => {
  const csv = buildCsv(
    ["symbol", "setup", "result"],
    [
      { symbol: "AAPL", setup: 'VWAP "bounce"', result: 125.5 },
      { symbol: "NVDA", result: -40 },
    ],
  );

  assert.equal(
    csv,
    [
      "symbol,setup,result",
      '"AAPL","VWAP ""bounce""","125.5"',
      '"NVDA","","-40"',
    ].join("\n"),
  );
});
