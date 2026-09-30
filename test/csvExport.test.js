import assert from "node:assert/strict";
import test from "node:test";

import { buildCsv, escapeCsvValue } from "../src/utils/csvExport.js";

test('CSV neutralizes formula-like user/provider text while preserving signed accounting values', () => {
  for (const value of ['=SUM(1,2)', '+HYPERLINK("https://example.com")', '-2+3', '@SUM(A1:A2)', '  =1+1', '\t=1+1', '\r=1+1', '\n=1+1', '＝1+1', '＋1', '－1+2', '＠SUM(A1:A2)']) {
    assert.equal(escapeCsvValue(value), `"'${value.replaceAll('"', '""')}"`);
  }
  for (const value of [-40, 12.5, '-40', '+12.5', '-1.2e3']) assert.equal(escapeCsvValue(value), `"${value}"`);
});

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
