export const INSTRUMENTS = {
  ES: { tick: 0.25, base: 5800, exchange: 'CME', decimals: 2 },
  NQ: { tick: 0.25, base: 21425, exchange: 'CME', decimals: 2 },
  MES: { tick: 0.25, base: 5800, exchange: 'CME', decimals: 2 },
  MNQ: { tick: 0.25, base: 21425, exchange: 'CME', decimals: 2 },
  CL: { tick: 0.01, base: 70, exchange: 'NYMEX', decimals: 2 },
  GC: { tick: 0.1, base: 2700, exchange: 'COMEX', decimals: 1 },
  BTCUSDT: { tick: 0.1, base: 65000, exchange: 'Crypto', decimals: 1 },
  ETHUSDT: { tick: 0.01, base: 2500, exchange: 'Crypto', decimals: 2 },
};
export const DEFAULT_SETTINGS = { ratio: 3, minVolume: 25, stacked: 3, largeTrade: 80, depth: 24,
  opacity: 0.28, fontSize: 11, compact: true, grid: true, buyColor: '#19d994', sellColor: '#ff505b',
  background: '#070d11', sounds: false, sessionStart: '09:30', sessionEnd: '16:00' };
export function formatFlow(value, compact = true) {
  if (value == null || !Number.isFinite(value)) return '—';
  return compact && Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
export const priceKey = (price, tick) => Math.round(price / tick);
export function inSession(timestamp, start, end) {
  const date = new Date(timestamp), minute = date.getUTCHours() * 60 + date.getUTCMinutes();
  const toMinutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const low = toMinutes(start), high = toMinutes(end);
  return low === high || (low < high ? minute >= low && minute < high : minute >= low || minute < high);
}

export function aggregateFlow(trades, tick, timeframe, aggregation, settings = DEFAULT_SETTINGS) {
  const step = tick * aggregation, buckets = new Map(), profile = new Map();
  let buy = 0, sell = 0, unknown = 0, weighted = 0;
  for (const trade of trades) {
    if (!(trade.size > 0) || !Number.isFinite(trade.price) || !['buy', 'sell', 'unknown'].includes(trade.side)) continue;
    const timestamp = Math.floor(trade.timestamp / timeframe) * timeframe;
    let candle = buckets.get(timestamp);
    if (!candle) { candle = { timestamp, open: trade.price, close: trade.price, high: trade.price, low: trade.price, levels: new Map(), volume: 0, delta: 0, unknownVolume: 0 }; buckets.set(timestamp, candle); }
    candle.close = trade.price; candle.high = Math.max(candle.high, trade.price); candle.low = Math.min(candle.low, trade.price);
    candle.volume += trade.size; candle.delta += trade.side === 'buy' ? trade.size : trade.side === 'sell' ? -trade.size : 0;
    if (trade.side === 'unknown') candle.unknownVolume += trade.size;
    const key = priceKey(trade.price, step);
    if (!candle.levels.has(key)) candle.levels.set(key, { price: Number((key * step).toFixed(8)), bidVolume: 0, askVolume: 0, unknownVolume: 0 });
    candle.levels.get(key)[trade.side === 'buy' ? 'askVolume' : trade.side === 'sell' ? 'bidVolume' : 'unknownVolume'] += trade.size;
    profile.set(key, (profile.get(key) || 0) + trade.size);
    if (trade.side === 'buy') buy += trade.size; else if (trade.side === 'sell') sell += trade.size; else unknown += trade.size;
    weighted += trade.price * trade.size;
  }
  const candles = [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp).map(candle => {
    const map = candle.levels;
    const levels = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([key, level]) => {
      const lowerBid = map.get(key - 1)?.bidVolume || 0, upperAsk = map.get(key + 1)?.askVolume || 0;
      return { ...level, delta: level.askVolume - level.bidVolume,
        buyImbalance: !candle.unknownVolume && level.askVolume >= settings.minVolume && lowerBid > 0 && level.askVolume / lowerBid >= settings.ratio,
        sellImbalance: !candle.unknownVolume && level.bidVolume >= settings.minVolume && upperAsk > 0 && level.bidVolume / upperAsk >= settings.ratio };
    });
    const stack = field => { let count = 0, previous = null; return levels.some(level => {
      count = level[field] ? (previous !== null && Math.abs(level.price - previous - step) < step / 100 ? count + 1 : 1) : 0;
      previous = level.price; return count >= settings.stacked;
    }); };
    const poc = levels.reduce((best, row) => row.bidVolume + row.askVolume + row.unknownVolume > best.bidVolume + best.askVolume + best.unknownVolume ? row : best, levels[0]);
    return { ...candle, levels, poc: poc?.price, stackedBuy: stack('buyImbalance'), stackedSell: stack('sellImbalance'),
      unfinishedHigh: Boolean(levels.at(-1)?.bidVolume && levels.at(-1)?.askVolume), unfinishedLow: Boolean(levels[0]?.bidVolume && levels[0]?.askVolume) };
  });
  const volume = buy + sell + unknown, ordered = [...profile.entries()].sort((a, b) => a[0] - b[0]);
  const pocIndex = ordered.reduce((best, row, index) => row[1] > (ordered[best]?.[1] || 0) ? index : best, 0);
  let lo = pocIndex, hi = pocIndex, covered = ordered[pocIndex]?.[1] || 0;
  while (covered < volume * 0.7 && (lo > 0 || hi < ordered.length - 1)) {
    if (lo > 0 && (hi === ordered.length - 1 || ordered[lo - 1][1] >= ordered[hi + 1][1])) covered += ordered[--lo][1];
    else covered += ordered[++hi][1];
  }
  let cumulative = 0;
  return { step, timeframe, candles, profile: ordered.map(([key, amount]) => ({ price: Number((key * step).toFixed(8)), volume: amount })),
    cumulative: candles.map(candle => ({ timestamp: candle.timestamp, delta: cumulative += candle.delta })),
    metrics: { buy, sell, unknown, volume, sideCoverage: volume ? (buy + sell) / volume : 1, delta: buy - sell, deltaPercent: volume ? (buy - sell) / volume * 100 : 0,
      vwap: volume ? weighted / volume : null, poc: ordered.length ? ordered[pocIndex][0] * step : null,
      valueLow: ordered.length ? ordered[lo][0] * step : null, valueHigh: ordered.length ? ordered[hi][0] * step : null, openInterest: null } };
}

export function detectSignals(flow, trades, tick, settings, simulated = true) {
  const signals = [], add = (c, type, strength, description) => signals.push({ id: `${c.timestamp}:${c.close ?? c.price}:${type}`, timestamp: c.timestamp,
    price: c.close ?? c.price, type, strength, description, simulated });
  for (let i = 1; i < flow.candles.length - 1; i++) {
    const c = flow.candles[i], prev = flow.candles[i - 1], range = c.high - c.low;
    if (c.stackedBuy) add(c, 'Stacked Buy Imbalance', 'High', `${settings.stacked}+ adjacent diagonal buy imbalances at ${settings.ratio}:1.`);
    if (c.stackedSell) add(c, 'Stacked Sell Imbalance', 'High', `${settings.stacked}+ adjacent diagonal sell imbalances at ${settings.ratio}:1.`);
    if (range <= tick * 5 && Math.abs(c.delta) > c.volume * 0.45 && c.volume >= settings.largeTrade * 5) add(c, c.delta < 0 ? 'Buy Absorption' : 'Sell Absorption', 'Medium', 'Large aggressive volume with a narrow range; possible passive absorption.');
    if (Math.abs(prev.delta) > prev.volume * 0.5 && Math.abs(c.delta) < Math.abs(prev.delta) * 0.2) add(c, prev.delta > 0 ? 'Buyer Exhaustion' : 'Seller Exhaustion', 'Medium', 'Aggressive delta declined sharply from the prior candle.');
    if ((c.close > prev.close && c.delta < -c.volume * 0.25) || (c.close < prev.close && c.delta > c.volume * 0.25)) add(c, 'Delta Divergence', 'Medium', 'Price direction opposes signed aggressive volume.');
    if ((prev.unfinishedHigh && c.high < prev.high) || (prev.unfinishedLow && c.low > prev.low)) add(c, 'Failed Auction', 'Medium', 'Two-sided extreme volume followed by failure to extend; heuristic candidate.');
  }
  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    if (t.size >= settings.largeTrade && ['buy', 'sell'].includes(t.side)) add(t, t.side === 'buy' ? 'Large Market Buy' : 'Large Market Sell', 'High', `${t.size} ${simulated ? 'simulated ' : ''}aggressive units at one price.`);
    if (i && Math.abs(t.price - trades[i - 1].price) >= tick * 3 && t.size >= settings.largeTrade) add(t, 'Liquidity Sweep', 'Medium', 'Large trade crossed multiple price increments; possible sweep, not order-level confirmation.');
  }
  if (flow.profile.length) {
    const average = flow.metrics.volume / flow.profile.length, latest = trades.at(-1);
    for (const level of flow.profile) {
      // Emit a node event only when price is trading in that node, rather than
      // continuously assigning the newest timestamp to every historical node.
      if (!latest || priceKey(latest.price, flow.step) !== priceKey(level.price, flow.step)) continue;
      if (level.volume >= average * 2) add({ ...latest, price: level.price, close: level.price }, 'High Volume Node', 'Medium', 'Traded volume exceeds twice the mean price-level volume.');
      else if (level.volume < average * 0.2) add({ ...latest, price: level.price, close: level.price }, 'Low Volume Node', 'Medium', 'Traded volume is below one fifth of the mean price-level volume.');
    }
  }
  return signals.sort((a, b) => b.timestamp - a.timestamp).slice(0, 80);
}
