import assert from "node:assert/strict";
import test from "node:test";
import { appendReplayFill, calculateReplayLedger, maximumDrawdown, replaySnapshot, visibleReplayCandles } from "../src/utils/replayLedger.js";

const buy = (qty, price = 100, extra = {}) => ({ id: "buy", type: "BUY", symbol: "AAPL", qty, price, time: 1000, ...extra });
const sell = (qty, price = 110, extra = {}) => ({ id: "sell", type: "SELL", symbol: "AAPL", qty, price, time: 2000, ...extra });

test("partial and full closes preserve immutable fills and correct FIFO basis", () => {
  const events = Object.freeze([Object.freeze(buy(100)), Object.freeze(sell(40))]);
  const partial = calculateReplayLedger({ events, marks: { AAPL: 120 } });
  assert.equal(events[0].qty, 100);
  assert.deepEqual(partial.positions[0], { symbol: "AAPL", side: "Long", qty: 60, costBasis: 6000, avgPrice: 100, lastPrice: 120, unrealizedPnl: 1200 });
  assert.equal(partial.realizedPnl, 400);
  assert.equal(partial.cash, 94400);
  assert.equal(partial.equity, 101600);
  const full = calculateReplayLedger({ events: [...events, sell(60, 120, { id: "sell2", time: 3000 })] });
  assert.deepEqual(full.positions, []);
  assert.equal(full.realizedPnl, 1600);
  assert.equal(full.equity, 101600);
});

test("multiple lots and proportional fees reconcile exactly through partial closes", () => {
  const events = [buy(3, 10, { fee: 0.01 }), buy(2, 20, { id: "buy2", time: 1100, fee: 0.02 }), sell(4, 30, { fee: 0.03 })];
  const partial = calculateReplayLedger({ events, marks: { AAPL: 30 } });
  assert.equal(partial.positions[0].qty, 1);
  assert.equal(partial.positions[0].costBasis, 20.01);
  assert.equal(partial.realizedPnl, 69.95);
  const full = calculateReplayLedger({ events: [...events, sell(1, 30, { id: "last", time: 3000, fee: 0.04 })] });
  assert.equal(full.realizedPnl, 79.9);
  assert.equal(full.cash, 100079.9);
  assert.equal(full.fees, 0.1);
});

test("invalid quantities, prices, fees, order types and unsupported shorts are rejected", () => {
  for (const qty of [0, -1, null, "", NaN, 1.5, Infinity, "1%", "$100", "1e3", " 2 "]) assert.throws(() => calculateReplayLedger({ events: [buy(qty)] }));
  for (const price of [null, "", 0, -1, NaN, Infinity]) assert.throws(() => calculateReplayLedger({ events: [buy(1, price)] }));
  assert.throws(() => calculateReplayLedger({ events: [buy(1, 100, { fee: -1 })] }));
  assert.throws(() => calculateReplayLedger({ events: [buy(1, 100, { orderType: "LIMIT" })] }));
  assert.throws(() => calculateReplayLedger({ events: [sell(1)] }));
  assert.throws(() => calculateReplayLedger({ events: [buy(1001)] }));
  assert.throws(() => calculateReplayLedger({ events: [buy(1), sell(2)] }));
  assert.throws(() => calculateReplayLedger({ events: [buy(1), buy(1)] }));
});

test("undefined performance ratios remain unavailable before any closed sales", () => {
  const result = calculateReplayLedger();
  assert.equal(result.winRate, null);
  assert.equal(result.avgWin, null);
  assert.equal(result.avgLoss, null);
  assert.equal(result.profitFactor, null);
  assert.equal(result.realizedPnl, 0);
});

test("missing marks remain unknown and never mark positions at zero", () => {
  const result = calculateReplayLedger({ events: [buy(1)], marks: {} });
  assert.equal(result.positions[0].lastPrice, null);
  assert.equal(result.unrealizedPnl, null);
  assert.equal(result.equity, null);
  assert.equal(result.netPnL, null);
});

test("drawdown uses earlier peaks and includes unrealized equity changes", () => {
  assert.equal(maximumDrawdown([100000, 101000]), 0);
  assert.equal(maximumDrawdown([100, 120, 110, 140, 125]), -15);
  assert.equal(maximumDrawdown([100, null]), null);
  const result = replaySnapshot({ events: [buy(100)], symbol: "AAPL", index: 2,
    candles: [{ time: 1000, close: 100 }, { time: 2000, close: 120 }, { time: 3000, close: 110 }] });
  assert.equal(result.equity, 101000);
  assert.equal(result.maxDrawdown, -1000);
});

test("early replay boundaries exclude future candles, marks, fills and equity", () => {
  const candles = Array.from({ length: 8 }, (_, index) => ({ time: 1000 + index * 1000, close: 100 + index }));
  for (let index = 0; index < 6; index++) {
    assert.equal(visibleReplayCandles(candles, index).length, index + 1);
    const state = replaySnapshot({ events: [buy(1), sell(1, 105, { time: 6000 })], candles, index, symbol: "AAPL" });
    assert.ok(state.fills.every(fill => fill.time <= candles[index].time));
    assert.equal(state.candle.time, candles[index].time);
  }
  assert.deepEqual(visibleReplayCandles(candles, -1), []);
  assert.deepEqual(visibleReplayCandles(candles, null), []);
  const events = appendReplayFill({ events: [], candles, index: 0, symbol: "AAPL", side: "BUY", quantity: 1, id: "test" });
  assert.equal(events[0].price, 100);
  assert.equal(events[0].time, 1000);
});
