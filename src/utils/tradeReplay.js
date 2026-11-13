const DAY = 86400;


export function buildTradeReplay(record, orders = [], now = Date.now()) {
  if (!record?.immutable || record.source !== 'Paper simulation' || !record.tradeGroupId || !(record.closesPosition || (record.groupedPosition && record.status === 'closed'))) return null;
  const fills = orders.filter(order => order.engine === 'paper-v1' && order.status === 'FILLED'
    && order.tradeGroupId === record.tradeGroupId && order.symbol === record.symbol
    && ["BUY", "SELL", "SELL_SHORT", "BUY_TO_COVER"].includes(order.action || order.side))
    .map(order => ({
      id: order.id, time: Date.parse(order.filledAt) / 1000, action: order.action || order.side,
      price: order.price, qty: order.filled,
    }))
    .filter(fill => Number.isFinite(fill.time) && fill.price > 0 && fill.qty > 0)
    .sort((a, b) => a.time - b.time);
  const entryAction = record.bias === 'Short' ? 'SELL_SHORT' : 'BUY';
  const exitAction = record.bias === 'Short' ? 'BUY_TO_COVER' : 'SELL';
  if (!fills.some(fill => fill.action === entryAction) || !fills.some(fill => fill.action === exitAction)) return null;
  const start = Math.floor(fills[0].time / 60) * 60 - 1800;
  const last = fills.at(-1).time;
  const end = Math.min(Math.floor(last / 60) * 60 + 3600, Math.floor(now / 60000) * 60);
  if (end <= start) return null;
  const duration = end - start;
  const [timeframe, seconds, maxDays] = duration <= DAY ? ['1m', 60, 1]
    : duration <= 6 * DAY ? ['5m', 300, 6] : ['1H', 3600, 30];
  const from = Math.max(start, end - maxDays * DAY);
  return {
    id: record.tradeGroupId, symbol: record.symbol, fills, entryAction, timeframe, seconds,
    start: new Date(from * 1000).toISOString(), end: new Date(end * 1000).toISOString(),
    tradePlan: record.tradePlan, shortened: from !== start,
  };
}

export function matchReplayFills(fills, candles, seconds) {
  const times = new Set(candles.map(bar => bar.time));
  return fills.flatMap(fill => {
    const time = Math.floor(fill.time / seconds) * seconds;
    return times.has(time) ? [{ ...fill, executionTime: fill.time, time, type: fill.action.startsWith("BUY") ? "BUY" : "SELL" }] : [];
  });
}
