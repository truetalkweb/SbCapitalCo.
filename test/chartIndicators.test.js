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

test('VWAP resets at the Eastern date boundary without splitting the same session at UTC midnight', () => {
  const bar = (iso, price) => ({ time: Date.parse(iso) / 1000, high: price, low: price, close: price, volume: 100 });
  const rows = [bar('2026-10-01T23:59:00Z', 10), bar('2026-10-02T00:00:00Z', 20), bar('2026-10-02T08:00:00Z', 100)];
  assert.deepEqual(calculateVWAP(rows).map(row => row.value), [10, 15, 100]);
  assert.deepEqual(calculateVWAP(rows.slice(0, 2)).map(row => row.value), [10, 15]);
});
