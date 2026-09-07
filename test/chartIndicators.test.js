import assert from "node:assert/strict";
import test from "node:test";
import { calculateEMA, calculateVWAP } from "../src/indicators/chartIndicators.js";

test("VWAP never invents volume for unknown or zero-volume bars", () => {
  const bar = { time: 1000, open: 10, high: 10, low: 10, close: 10, volume: null };
  assert.deepEqual(calculateVWAP([bar]), []);
  assert.deepEqual(calculateVWAP([{ ...bar, volume: 0 }]), []);
  const known = { ...bar, volume: 100 };
  assert.deepEqual(calculateVWAP([known, { ...bar, time: 2000, high: 50, low: 50, close: 50, volume: 0 }]), [{ time: 1000, value: 10 }, { time: 2000, value: 10 }]);
});

test("EMA calculated from a visible prefix is unaffected by later candles", () => {
  const data = [10, 20, 30].map((close, index) => ({ time: index + 1, close }));
  assert.deepEqual(calculateEMA(data.slice(0, 1), 9), [{ time: 1, value: 10 }]);
  assert.deepEqual(calculateEMA(data.slice(0, 2), 9), [{ time: 1, value: 10 }, { time: 2, value: 12 }]);
});
