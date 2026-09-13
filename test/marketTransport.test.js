import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function serviceHarness() {
  const timers = new Map(); let id = 0;
  const setTimeout = (callback,ms) => { timers.set(++id,{callback,ms}); return id; };
  const clearTimeout = key => timers.delete(key);
  const context = { URL, AbortController, Map, Set, setTimeout, clearTimeout,
    document: { visibilityState:"visible",addEventListener(){} },
    window: {setTimeout,clearTimeout}, EventSource: class {addEventListener(){} close(){}},
    normalizeQuoteEvent: quote=>quote,
    fetch: (_url,{signal})=>new Promise((_,reject)=>signal.addEventListener("abort",()=>reject(new Error("aborted")))),
  };
  let source=fs.readFileSync(new URL("../src/services/marketDataService.js",import.meta.url),"utf8");
  source=source.slice(source.indexOf("const STREAM_RECONNECT_BASE_MS"),source.indexOf("export const marketDataService"));
  vm.runInNewContext(`const ENABLE_QUOTE_SSE=true; const DEFAULT_BROKER_API_URL="http://localhost:4999"; ${source}; globalThis.service=new MarketDataService();`,context);
  return { service:context.service, timers, context };
}

test("hung quote requests time out and schedule a retry without staying in-flight",async()=>{
  const {service,timers}=serviceHarness();service.subscribedSymbols.add("AAPL");
  const request=service.pollQuotes();
  [...timers.values()].find(timer=>timer.ms===8000).callback(); await request;
  assert.equal(service.pollInFlight,false); assert.equal(service.status,"RECONNECTING");
  assert.ok([...timers.values()].some(timer=>timer.ms===1000));
});
test("REST fallback schedules a fresh SSE connection and hiding cancels reconnect",()=>{
  const {service,timers,context}=serviceHarness();service.subscribedSymbols.add("AAPL");
  service.startRestFallback();const reconnect=[...timers.values()].find(timer=>timer.ms===15000);
  assert.ok(reconnect); reconnect.callback();assert.ok(service.eventSource);
  service.startRestFallback();context.document.visibilityState="hidden";service.handleVisibilityChange();
  assert.equal(service.eventSource,null);assert.equal(service.reconnectTimer,null);
});

test("large subscriptions fetch every symbol in bounded REST batches", async () => {
  const { service, context } = serviceHarness();
  const symbols = Array.from({ length: 85 }, (_, index) => `T${index}`);
  symbols.forEach(symbol => service.subscribedSymbols.add(symbol));
  const requested = []; let active = 0; let peak = 0;
  context.fetch = async url => {
    active++; peak = Math.max(peak, active);
    const batch = new URL(url).searchParams.get("symbols").split(",");
    assert.ok(batch.length <= 20); requested.push(...batch);
    await Promise.resolve(); active--;
    return { ok: true, json: async () => ({ quotes: batch.map(symbol => ({ symbol, price: 100 })) }) };
  };
  service.connect();
  assert.equal(service.eventSource, null);
  await service.pollQuotes();
  assert.deepEqual(requested.sort(), symbols.sort());
  assert.ok(peak <= 3);
  assert.equal(service.status, "BACKEND");
});

test("a failed quote batch does not prevent other symbols from refreshing", async () => {
  const { service, context } = serviceHarness();
  Array.from({ length: 45 }, (_, index) => `T${index}`).forEach(symbol => service.subscribedSymbols.add(symbol));
  let requests = 0;
  context.fetch = async () => {
    requests++;
    if (requests === 1) throw new Error("Temporary failure");
    return { ok: true, json: async () => ({ quotes: [] }) };
  };
  await service.pollQuotes();
  assert.equal(requests, 3);
  assert.equal(service.status, "RECONNECTING");
  assert.equal(service.pollInFlight, false);
});
