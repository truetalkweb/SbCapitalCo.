import assert from "node:assert/strict";
import test from "node:test";
import { isEligibleAlertQuote, normalizeCandleDataset, normalizeMarketQuote, normalizeQuoteEvent, mergeQuoteSnapshot } from "../src/utils/marketDataContract.js";

const now = Date.parse("2026-09-06T15:00:00Z");
const request = { symbol: "AAPL", interval: "1m", now };
const candle = { time: 1000, open: 10, high: 12, low: 9, close: 11, volume: null };
const payload = { symbol: "AAPL", timeframe: "1m", source: "Provider", candles: [candle] };
const quote = { symbol: "AAPL", price: 100, source: "Provider", timestamp: now / 1000 };

test('reported last trades and depth survive normalization without inventing missing prints', () => {
 const event=normalizeQuoteEvent({...quote,lastTradePrice:99.99,lastTradeSize:25,lastTradeTime:new Date(now).toISOString(),
  orderBook:[{bid:99.9,ask:100.1,bidSize:200,askSize:100},{bid:'bad',ask:0}],
  trades:[{id:'trade-1',time:now/1000,price:99.99,size:25,exchange:'NYSE'},{time:'bad',price:5,size:10}]},{},now);
 const snapshot=mergeQuoteSnapshot(null,event,now);
 assert.equal(snapshot.lastTradePrice,99.99); assert.equal(snapshot.lastTradeSize,25);
 assert.equal(snapshot.lastTradeTime,new Date(now).toISOString());
 assert.equal(snapshot.orderBook.length,1); assert.equal(snapshot.trades.length,1);
 const missing=mergeQuoteSnapshot(snapshot,normalizeQuoteEvent({...quote,timestamp:now/1000+1},{},now+1000),now+1000);
 assert.equal(missing.lastTradePrice,null); assert.deepEqual(missing.trades,[]); assert.deepEqual(missing.orderBook,[]);
});

test('malformed and explicitly simulated depth or prints do not break the quote feed', () => {
 const event=normalizeQuoteEvent({...quote,
  orderBook:[null,5,{bid:100,ask:99},{bid:99,ask:101,isSynthetic:true},{bid:98,ask:102}],
  trades:[null,5,{time:now/1000,price:100,size:10,isSynthetic:true},{time:now/1000,price:100,size:10}]},{},now);
 assert.equal(event.orderBook.length,1);assert.equal(event.trades.length,1);
});

test("provider BBO sizes and daily OHLC survive event normalization and snapshot merge", () => {
  const event = normalizeQuoteEvent({ ...quote, bidPrice: "99.95", bidSize: "1200", askPrice: "100.05", askSize: 800,
    openPrice: "98.5", highPrice: "101.25", lowPrice: "97.8" }, {}, now);
  const snapshot = mergeQuoteSnapshot(null, event, now);
  assert.deepEqual([snapshot.bidPrice, snapshot.bidSize, snapshot.askPrice, snapshot.askSize, snapshot.open, snapshot.high, snapshot.low],
    [99.95, 1200, 100.05, 800, 98.5, 101.25, 97.8]);
  const unavailable = mergeQuoteSnapshot(snapshot, normalizeQuoteEvent({ ...quote, timestamp: now / 1000 + 1,
    bidPrice: 0, bidSize: 0, askPrice: -1, askSize: "bad", openPrice: null }, {}, now + 1000), now + 1000);
  assert.equal(unavailable.bidPrice, null);
  assert.equal(unavailable.askPrice, null);
  assert.equal(unavailable.bidSize, 0);
  assert.equal(unavailable.askSize, null);
  assert.equal(unavailable.open, null);
});

test("history preserves identity, interval, source, timestamps, session and missing volume", () => {
  const result = normalizeCandleDataset({ ...payload, session: "regular" }, request);
  assert.equal(result.symbol, "AAPL");
  assert.equal(result.interval, "1m");
  assert.equal(result.source, "Provider");
  assert.equal(result.asOf, 1000);
  assert.equal(result.session, "regular");
  assert.equal(result.quality, "historical");
  assert.equal(result.candles[0].volume, null);
});

test("cached and delayed historical data remain explicitly distinguished", () => {
  assert.equal(normalizeCandleDataset({ ...payload, cached: true }, request).quality, "cached");
  assert.equal(normalizeCandleDataset({ ...payload, delayed: true }, request).quality, "delayed");
});

test("provider candle intervals retain native provenance and agree with canonical timeframe", () => {
  for (const [interval, providerInterval] of [["1m", "OneMinute"], ["5m", "FiveMinutes"], ["15m", "FifteenMinutes"], ["1H", "OneHour"], ["1D", "OneDay"]]) {
    for (const fields of [{ timeframe: interval, interval: providerInterval }, { timeframe: interval, interval, providerInterval }]) {
      const result = normalizeCandleDataset({ ...payload, ...fields }, { ...request, interval });
      assert.equal(result.quality, "historical");
      assert.equal(result.interval, interval);
      assert.equal(result.providerInterval, providerInterval);
    }
  }
  assert.equal(normalizeCandleDataset({ ...payload, interval: "FiveMinutes" }, request).quality, "unavailable");
  assert.equal(normalizeCandleDataset({ ...payload, providerInterval: "FiveMinutes" }, request).quality, "unavailable");
});

test("history requires an explicit matching interval and rejects synthetic row aliases", () => {
  assert.equal(normalizeCandleDataset({ ...payload, timeframe: undefined }, request).candles.length, 0);
  assert.equal(normalizeCandleDataset({ ...payload, interval: "1D" }, request).candles.length, 0);
  assert.equal(normalizeCandleDataset({ ...payload, timeframe: undefined, interval: "1m" }, request).interval, "1m");
  for (const flags of [{ synthetic: true }, { isFallback: true }, { quality: "simulated" }, { degraded: true }]) {
    assert.equal(normalizeCandleDataset({ ...payload, candles: [{ ...candle, ...flags }] }, request).candles.length, 0);
  }
});

test("empty, malformed, degraded, wrong-symbol and synthetic histories never become real candles", () => {
  for (const value of [null, {}, { ...payload, candles: [] }, { ...payload, source: null }, { ...payload, symbol: "TSLA" },
    { ...payload, timeframe: "1D" }, { ...payload, degraded: true }, { ...payload, fallback: true },
    { ...payload, isSynthetic: true }, { ...payload, candles: [{ ...candle, close: null }] },
    { ...payload, candles: [{ ...candle, high: 5 }] }, { ...payload, candles: [{ ...candle, volume: -1 }] }]) {
    assert.equal(normalizeCandleDataset(value, request).candles.length, 0);
  }
  const simulated = normalizeCandleDataset({ ...payload, isSynthetic: true }, request);
  assert.equal(simulated.isSynthetic, true);
  assert.equal(simulated.quality, "simulated");
});

test("out-of-order bars sort deterministically but conflicting duplicates fail closed", () => {
  const result = normalizeCandleDataset({ ...payload, candles: [{ ...candle, time: 2000 }, candle] }, request);
  assert.deepEqual(result.candles.map(row => row.time), [1000, 2000]);
  assert.equal(normalizeCandleDataset({ ...payload, candles: [candle, { ...candle, close: 10 }] }, request).quality, "unavailable");
});

test("quote quality and alert eligibility require actual fresh provider timestamps", () => {
  assert.equal(normalizeMarketQuote(quote, { now }).quality, "live");
  assert.equal(isEligibleAlertQuote(quote, "AAPL", now), true);
  for (const [change, expected] of [[{ cached: true }, "cached"], [{ delayed: true }, "delayed"], [{ isSynthetic: true }, "simulated"],
    [{ quality: "historical" }, "historical"], [{ timestamp: now / 1000 - 60 }, "stale"], [{ timestampSource: "received" }, "unavailable"],
    [{ timestamp: null }, "unavailable"], [{ price: null }, "unavailable"], [{ fallback: true }, "unavailable"]]) {
    assert.equal(normalizeMarketQuote({ ...quote, ...change }, { now }).quality, expected);
    assert.equal(isEligibleAlertQuote({ ...quote, ...change }, "AAPL", now), false);
  }
  assert.equal(isEligibleAlertQuote(quote, "TSLA", now), false);
  assert.equal(normalizeMarketQuote({ ...quote, price: null }, { now }).price, null);
});

test("stream normalization retains quality, source, session and real zero volume", () => {
  const event = normalizeQuoteEvent({ ...quote, volume: 0, session: "regular" }, { stream: { transport: "rest" } }, now);
  assert.equal(event.source, "Provider");
  assert.equal(event.session, "regular");
  assert.equal(event.v, 0);
  assert.equal(event.quality, "live");
  for (const quality of ["cached", "simulated", "historical", "delayed", "unavailable"]) {
    const event = normalizeQuoteEvent({ ...quote, quality }, {}, now);
    assert.equal(event.quality, quality);
    assert.equal(normalizeMarketQuote(event, { now }).quality, quality);
    assert.equal(isEligibleAlertQuote(event, "AAPL", now), false);
  }
  const unknownTime = normalizeQuoteEvent({ ...quote, timestamp: null, updatedAt: new Date(now).toISOString() }, {}, now);
  assert.equal(unknownTime.quality, "unavailable");
  assert.equal(unknownTime.asOf, null);
  assert.equal(normalizeQuoteEvent({ ...quote, price: null, bidPrice: 100 }, {}, now).price, null);
});

test("quote state merging preserves provenance and never borrows a prior quote's timestamp", () => {
  const prior = { ...quote, changePercent: 5, volume: 100, lastTradeTime: new Date(now).toISOString() };
  const current = mergeQuoteSnapshot(prior, { ...quote, price: 101, volume: 0 }, now);
  assert.equal(current.price, 101);
  assert.equal(current.change, null);
  assert.equal(current.volume, 0);
  assert.equal(current.source, "Provider");
  assert.equal(current.asOf, now / 1000);
  assert.equal(mergeQuoteSnapshot(current, { ...quote, timestamp: now / 1000 - 1 }, now), current);
  const missing = mergeQuoteSnapshot(prior, { symbol: "AAPL", price: 90 }, now);
  assert.equal(missing.asOf, null);
  assert.equal(missing.volume, null);
  assert.equal(missing.source, null);
  assert.equal(normalizeMarketQuote(missing, { now }).quality, "unavailable");
  const fresh = mergeQuoteSnapshot({ ...prior, realtime: false, isDelayed: true, dataMode: "historical", stale: true }, quote, now);
  assert.equal(normalizeMarketQuote(fresh, { now }).quality, "live");
  for (const dataMode of ["simulated", "cached", "historical", "stale", "unavailable"]) {
    assert.equal(isEligibleAlertQuote({ ...quote, quality: "live", dataMode }, "AAPL", now), false);
  }
});
