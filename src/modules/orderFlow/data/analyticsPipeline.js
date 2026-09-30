import { aggregateFlow, detectSignals } from '../analytics.js';
const atOrBefore = (timestamp, timestampNs, cursor) => timestampNs && cursor.timestampNs
  ? BigInt(timestampNs) <= BigInt(cursor.timestampNs) : timestamp <= cursor.timestamp;
export function selectReplayBooks(books, trade) {
  if (!trade) return [];
  return books.filter(book => atOrBefore(book.timestamp, book.timestampNs, trade))
    .map(book => book.validUntil != null && !atOrBefore(book.validUntil, book.validUntilNs, trade)
      ? { ...book, validUntil: undefined, validUntilNs: undefined } : book);
}
export function selectReplayBook(books, trade) {
  const book = selectReplayBooks(books, trade).at(-1);
  return !book || (book.validUntil != null && atOrBefore(book.validUntil, book.validUntilNs, trade)) ? null : book;
}
export function buildOrderFlowAnalysis({ trades, tick, timeframe, aggregation, settings, simulated, quality }) {
  const flow = aggregateFlow(trades, tick, timeframe, aggregation, settings);
  const complete = quality?.complete !== false && flow.metrics.sideCoverage === 1;
  if (!complete) flow.candles = flow.candles.map(candle => ({ ...candle, stackedBuy: false, stackedSell: false, unfinishedHigh: false, unfinishedLow: false,
    levels: candle.levels.map(level => ({ ...level, buyImbalance: false, sellImbalance: false })) }));
  return { flow, signals: complete ? detectSignals(flow, trades, tick, settings, simulated) : [],
    quality: { complete, sideCoverage: flow.metrics.sideCoverage, unknownVolume: flow.metrics.unknown,
      reason: quality?.complete === false ? 'Retained data contains sequence or connection gaps.' : flow.metrics.sideCoverage < 1 ? 'Aggressor side is incomplete; delta is partial and signals are suppressed.' : null } };
}
