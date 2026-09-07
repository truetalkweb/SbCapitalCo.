import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { parse } from "@babel/parser";
import { getTradingActionMode } from "../src/services/tradingActionPolicy.js";

const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
function findFunction(node, name) {
  if (node?.type === "FunctionDeclaration" && node.id?.name === name) return node;
  if (!node || typeof node !== "object") return null;
  for (const value of Object.values(node)) {
    for (const child of Array.isArray(value) ? value : [value]) {
      if (child && typeof child === "object") {
        const match = findFunction(child, name);
        if (match) return match;
      }
    }
  }
  return null;
}

test("the actual App order handler returns before any execution call in public review mode", async () => {
  const handler = findFunction(ast, "submitOrderTicket");
  assert.ok(handler, "The production order handler must be inspected, not replaced by a fixture callback");
  for (const side of ["BUY", "SELL"]) {
    const messages = [];
    const audits = [];
    const activities = [];
    const executions = [];
    const forbidden = (...args) => { executions.push(args); throw new Error("Execution boundary crossed"); };
    const context = vm.createContext({
      tradingActionMode: getTradingActionMode({ brokerToolsEnabled: false, brokerConnected: true,
        liveTradingEnabled: true, requestedMode: "live" }),
      orderSide: side, selectedStock: "AAPL", setOrderMessage: value => messages.push(value),
      buildOrderAuditRecord: (action, status, reason) => ({ action, status, reason }),
      pushOrderAudit: value => audits.push(value), pushActivity: value => activities.push(value),
      submitLiveOrder: forbidden, placeOrder: forbidden, fetch: forbidden, window: { confirm: forbidden },
    });
    // Run the unchanged handler body with isolated side-effect spies, not an authenticated App mount.
    await vm.runInContext(`(${source.slice(handler.start, handler.end)})()`, context);
    assert.deepEqual(executions, []);
    assert.match(messages.at(-1), /review prepared/i);
    assert.equal(audits[0].status, "review_only");
    assert.equal(activities[0].status, "review");
  }
});
