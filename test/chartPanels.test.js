import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAdditionalCharts, resolveChartQuote } from "../src/utils/chartPanels.js";
import { createWorkspacePayload } from "../src/services/workspacePayloadPolicy.js";

test("third and fourth chart identities and intervals persist independently", () => {
  const additionalCharts = normalizeAdditionalCharts({ third: { symbol: "AMD", interval: "1D" }, fourth: { symbol: "MSFT", interval: "5m" } });
  const restored = normalizeAdditionalCharts(JSON.parse(JSON.stringify(createWorkspacePayload({ additionalCharts }))).additionalCharts);
  assert.deepEqual(restored, additionalCharts);
  const updated = normalizeAdditionalCharts({ ...restored, third: { ...restored.third, interval: "1m" } });
  assert.equal(updated.third.interval, "1m");
  assert.equal(updated.fourth.interval, "5m");
  assert.equal(updated.fourth.symbol, "MSFT");
});

test("invalid panel settings use explicit defaults and never borrow another quote", () => {
  assert.equal(normalizeAdditionalCharts({ third: { symbol: "<script>", interval: "bad" } }).third.symbol, "SPY");
  const wrong = { symbol: "TSLA", price: 200 };
  assert.equal(resolveChartQuote("QQQ", [], wrong).price, null);
  assert.equal(resolveChartQuote("TSLA", [], wrong).price, 200);
  assert.equal(resolveChartQuote("QQQ", [{ symbol: "QQQ", price: 500 }], wrong).price, 500);
});
