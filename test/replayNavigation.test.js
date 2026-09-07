import assert from "node:assert/strict";
import test from "node:test";
import { replayJumpIndex, replayBookmarkIndex } from "../src/utils/replayNavigation.js";

test("replay jumps use actual timestamps across missing bars and session gaps", () => {
  const candles = [1000, 1060, 4600, 87400].map(time => ({ time }));
  assert.equal(replayJumpIndex(candles, 2, "open"), 0);
  assert.equal(replayJumpIndex(candles, 0, 60), 2);
  assert.equal(replayJumpIndex(candles, 2, 60), 3);
  assert.equal(replayJumpIndex(candles, 0, "close"), 3);
});

test("bookmarks cannot seek another instrument, interval or revised dataset", () => {
  const session = { symbol: "AAPL", interval: "1m", fingerprint: "verified" };
  const bookmark = { ...session, time: 1060 };
  const candles = [{ time: 1000 }, { time: 1060 }];
  assert.equal(replayBookmarkIndex(bookmark, session, candles), 1);
  for (const change of [{ symbol: "TSLA" }, { interval: "1D" }, { fingerprint: "revised" }]) {
    assert.equal(replayBookmarkIndex(bookmark, { ...session, ...change }, candles), null);
  }
  assert.equal(replayBookmarkIndex({ index: 1, symbol: "AAPL" }, session, candles), null);
});
