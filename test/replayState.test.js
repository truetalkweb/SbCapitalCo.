import assert from "node:assert/strict";
import test from "node:test";
import { createReplayState, replayReducer, serializeReplayState } from "../src/utils/replayState.js";
import { replaySnapshot } from "../src/utils/replayLedger.js";

const dataset = { symbol: "AAPL", interval: "1m", source: "Provider", quality: "historical", isSynthetic: false,
  candles: [100, 110, 120].map((close, index) => ({ time: 1000 + index * 1000, open: close, high: close, low: close, close, volume: null })) };
const ready = () => replayReducer(createReplayState(), { type: "DATASET", dataset });
const fill = (state, side = "BUY", quantity = 100, id = "buy") => replayReducer(state, { type: "FILL", symbol: "AAPL", side, quantity, id });

test("engine ledger keeps original buy quantity after partial sale", () => {
  let state = fill(ready());
  state = replayReducer(state, { type: "SEEK", index: 1 });
  state = fill(state, "SELL", 40, "sell");
  assert.equal(state.events[0].qty, 100);
  assert.equal(replaySnapshot({ ...state, events: state.events }).positions[0].qty, 60);
});

test("rewind forks event history explicitly and reset preserves archive", () => {
  let state = fill(ready());
  state = replayReducer(state, { type: "SEEK", index: 2 });
  state = replayReducer(state, { type: "SEEK", index: 0 });
  assert.equal(state.events.length, 0);
  assert.equal(state.archives[0].events[0].qty, 100);
  assert.match(state.message, /archived/);
  state = fill(state);
  state = replayReducer(state, { type: "RESET" });
  assert.equal(state.archives.length, 2);
});

test("context change invalidates old quotes immediately and ignores late dataset responses", () => {
  let state = fill(ready());
  state = replayReducer(state, { type: "CONTEXT", symbol: "TSLA", interval: "1D" });
  assert.equal(state.candles.length, 0);
  assert.equal(state.events.length, 0);
  assert.equal(state.archives.length, 1);
  assert.equal(replayReducer(state, { type: "DATASET", dataset }), state);
});

test("changed historical bars fork existing trades, including a revised middle candle", () => {
  const state = replayReducer(fill(ready()), { type: "DATASET", dataset: { ...dataset, candles: dataset.candles.map((row, index) => index === 1 ? { ...row, close: 109 } : row) } });
  assert.equal(state.events.length, 0);
  assert.equal(state.archives.length, 1);
  assert.equal(state.index, 0);
});

test("restore requires exact dataset, valid fills and visible boundary", () => {
  const saved = serializeReplayState(fill(ready()));
  const pending = replayReducer(createReplayState(), { type: "RESTORE", session: saved });
  const restored = replayReducer(pending, { type: "DATASET", dataset });
  assert.equal(restored.events.length, 1);
  assert.equal(restored.playing, false);
  for (const bad of [{ ...saved, version: 0 }, { ...saved, fingerprint: "different" },
    { ...saved, events: saved.events.map(event => ({ ...event, time: 3000, price: 120 })) }]) {
    const rejected = replayReducer(ready(), { type: "RESTORE", session: bad });
    assert.equal(rejected.events.length, 0);
    assert.equal(rejected.archives.length, 1);
    assert.match(rejected.message, /archived/);
  }
});

test("pause, step, end, invalid orders and unavailable data fail safely", () => {
  let state = replayReducer(ready(), { type: "PLAY", value: true });
  assert.equal(state.playing, true);
  state = replayReducer(state, { type: "SEEK", index: current => current + 1, step: true });
  assert.equal(state.index, 1);
  assert.equal(state.playing, true);
  state = replayReducer(state, { type: "SEEK", index: 99, step: true });
  assert.equal(state.index, 2);
  assert.equal(state.playing, false);
  assert.equal(fill(state, "BUY", -1).events.length, 0);
  state = replayReducer(state, { type: "DATASET", dataset: { ...dataset, quality: "simulated", isSynthetic: true } });
  assert.equal(state.candles.length, 0);
  assert.equal(fill(state).events.length, 0);
});

test("restore waits for its instrument instead of rejecting against the previous chart", () => {
  const saved = serializeReplayState(fill(ready()));
  const other = replayReducer(createReplayState(), { type: "DATASET", dataset: { ...dataset, symbol: "TSLA" } });
  let state = replayReducer(other, { type: "RESTORE", session: saved });
  assert.deepEqual(state.pendingRestore, saved);
  assert.equal(state.archives.length, 0);
  state = replayReducer(state, { type: "CONTEXT", symbol: "AAPL", interval: "1m" });
  state = replayReducer(state, { type: "DATASET", dataset });
  assert.equal(state.events.length, 1);
  assert.equal(state.pendingRestore, null);
});

test("reset cancels and archives a pending restoration", () => {
  const saved = serializeReplayState(fill(ready()));
  let state = replayReducer(createReplayState(), { type: "RESTORE", session: saved });
  state = replayReducer(state, { type: "RESET" });
  assert.equal(state.pendingRestore, null);
  assert.equal(state.archives.length, 1);
  state = replayReducer(state, { type: "DATASET", dataset });
  assert.equal(state.events.length, 0);
});

test("restoration preserves current trades and existing archives without duplicating saved archives", () => {
  const saved = serializeReplayState(fill(ready()));
  let state = replayReducer(fill(ready(), "BUY", 20, "later-buy"), { type: "RESET" });
  state = fill(state, "BUY", 30, "current-buy");
  state = replayReducer(state, { type: "RESTORE", session: saved });
  assert.equal(state.events[0].qty, 100);
  assert.deepEqual(state.archives.map(record => record.events[0].qty), [20, 30]);
  const again = serializeReplayState(state);
  state = replayReducer(state, { type: "RESTORE", session: again });
  assert.equal(state.archives.length, 2);
});

test("invalid restoration does not discard active trades", () => {
  const state = replayReducer(fill(ready()), { type: "RESTORE", session: null });
  assert.equal(state.events.length, 1);
  assert.equal(state.pendingRestore, null);
  assert.match(state.message, /invalid/i);
});
