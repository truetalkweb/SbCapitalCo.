import { aggregateFlow, detectSignals } from '../analytics.js';
export function selectReplayBooks(books, trade) {
  if (!trade) return [];
  return books.filter(book => book.timestampNs && trade.timestampNs ? BigInt(book.timestampNs) <= BigInt(trade.timestampNs) : book.timestamp <= trade.timestamp)
    .map(book => book.validUntil !== undefined && book.validUntil > trade.timestamp ? { ...book, validUntil: undefined } : book);
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
