import { parseNullableMarketNumber } from "./marketNumbers.js";

export const REPLAY_STARTING_CASH = 100000;
export const REPLAY_LEDGER_VERSION = 1;
const SCALE = 1000000n;

// Keep cash, fees and lot costs in millionths of a dollar until presentation.
function units(value, name, allowZero = true) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(text)) throw new Error(`Invalid ${name}`);
  const [whole, fraction = ""] = text.split(".");
  const result = BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0"));
  if ((!allowZero && result === 0n) || result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`Invalid ${name}`);
  return result;
}

const dollars = value => Number(value) / Number(SCALE);

export function visibleReplayCandles(candles, index) {
  if (!Number.isInteger(index) || index < 0) return [];
  return candles.slice(0, Math.min(index + 1, candles.length));
}

export function maximumDrawdown(equity) {
  if (!equity.length) return 0;
  let peak = -Infinity;
  let drawdown = 0;
  for (const value of equity) {
    if (parseNullableMarketNumber(value) === null) return null;
    peak = Math.max(peak, value);
    drawdown = Math.min(drawdown, value - peak);
  }
  return Math.round(drawdown * 1e6) / 1e6;
}

export function calculateReplayLedger({ events = [], startingCash = REPLAY_STARTING_CASH, marks = {} } = {}) {
  const initial = units(startingCash, "starting cash");
  let cash = initial;
  let realized = 0n;
  let feesPaid = 0n;
  let previousTime = -Infinity;
  const lots = new Map();
  const ids = new Set();
  const fills = [];
  for (const event of events) {
    const type = event.type;
    const symbol = String(event.symbol || "").trim().toUpperCase();
    const qty = /^(?:0|[1-9]\d*)$/.test(String(event.qty ?? "")) ? Number(event.qty) : null;
    const time = parseNullableMarketNumber(event.time);
    if (!["BUY", "SELL"].includes(type) || (event.orderType && event.orderType !== "MARKET")) throw new Error("Replay supports market buys and sells only");
    if (!/^[A-Z0-9][A-Z0-9./:-]{0,13}$/.test(symbol) || !Number.isSafeInteger(qty) || qty <= 0) throw new Error("Quantity must be a positive whole number of shares for a valid symbol");
    if (!Number.isSafeInteger(time) || time <= 0 || time < previousTime) throw new Error("Replay events must be chronological");
    if (event.id === undefined || event.id === null || ids.has(event.id)) throw new Error("Replay fill IDs must be unique");
    ids.add(event.id);
    previousTime = time;
    const price = units(event.price, "fill price", false);
    const fee = units(event.fee ?? 0, "fee");
    const value = price * BigInt(qty);
    const symbolLots = lots.get(symbol) || [];
    let pnl = null;
    if (type === "BUY") {
      if (value + fee > cash) throw new Error("Insufficient replay cash");
      cash -= value + fee;
      symbolLots.push({ qty, cost: value + fee });
    } else {
      if (qty > symbolLots.reduce((sum, lot) => sum + lot.qty, 0)) throw new Error("Replay sell exceeds the open long position");
      let remaining = qty;
      let basis = 0n;
      // FIFO allocations preserve remaining fee/cost remainders until the lot closes.
      while (remaining > 0) {
        const lot = symbolLots[0];
        const matched = Math.min(remaining, lot.qty);
        const allocated = matched === lot.qty ? lot.cost : lot.cost * BigInt(matched) / BigInt(lot.qty);
        basis += allocated;
        lot.cost -= allocated;
        lot.qty -= matched;
        remaining -= matched;
        if (!lot.qty) symbolLots.shift();
      }
      cash += value - fee;
      const result = value - fee - basis;
      realized += result;
      pnl = dollars(result);
    }
    lots.set(symbol, symbolLots);
    feesPaid += fee;
    fills.push({ ...event, symbol, qty, fee: dollars(fee), pnl });
  }
  let marketValue = 0n;
  let remainingBasis = 0n;
  let missingMark = false;
  const positions = [];
  for (const [symbol, symbolLots] of lots) {
    const qty = symbolLots.reduce((sum, lot) => sum + lot.qty, 0);
    if (!qty) continue;
    const cost = symbolLots.reduce((sum, lot) => sum + lot.cost, 0n);
    const mark = parseNullableMarketNumber(marks[symbol]);
    const markUnits = mark !== null && mark > 0 ? units(mark, "mark", false) : null;
    const value = markUnits === null ? null : markUnits * BigInt(qty);
    if (value === null) missingMark = true;
    else marketValue += value;
    remainingBasis += cost;
    positions.push({ symbol, side: "Long", qty, costBasis: dollars(cost), avgPrice: dollars(cost) / qty,
      lastPrice: markUnits === null ? null : dollars(markUnits),
      unrealizedPnl: value === null ? null : dollars(value - cost) });
  }
  const closed = fills.filter(fill => fill.type === "SELL");
  const winners = closed.filter(fill => fill.pnl > 0);
  const losers = closed.filter(fill => fill.pnl < 0);
  const grossProfit = winners.reduce((sum, fill) => sum + fill.pnl, 0);
  const grossLoss = -losers.reduce((sum, fill) => sum + fill.pnl, 0);
  const equity = missingMark ? null : dollars(cash + marketValue);
  return { positions, fills, cash: dollars(cash), fees: dollars(feesPaid),
    realizedPnl: dollars(realized), unrealizedPnl: missingMark ? null : dollars(marketValue - remainingBasis),
    equity, netPnL: equity === null ? null : dollars(cash + marketValue - initial),
    totalTrades: closed.length, winners: winners.length, losers: losers.length,
    winRate: closed.length ? winners.length / closed.length * 100 : null,
    avgWin: winners.length ? grossProfit / winners.length : null,
    avgLoss: losers.length ? -grossLoss / losers.length : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null };
}

export function replaySnapshot({ events = [], candles = [], index = 0, symbol, startingCash = REPLAY_STARTING_CASH }) {
  const visible = visibleReplayCandles(candles, index);
  const boundary = visible.at(-1)?.time;
  const eligible = events.filter(event => event.time <= boundary);
  const marks = boundary === undefined ? {} : { [symbol]: visible.at(-1).close };
  const ledger = calculateReplayLedger({ events: eligible, marks, startingCash });
  const equity = [startingCash];
  for (const candle of visible) {
    equity.push(calculateReplayLedger({ events: eligible.filter(event => event.time <= candle.time),
      marks: { [symbol]: candle.close }, startingCash }).equity);
  }
  return { ...ledger, equitySeries: equity, maxDrawdown: maximumDrawdown(equity), candle: visible.at(-1) || null };
}

export function appendReplayFill({ events, candles, index, symbol, side, quantity, fee = 0, orderType = "MARKET", id }) {
  const candle = visibleReplayCandles(candles, index).at(-1);
  if (!candle) throw new Error("Historical replay data is unavailable");
  const event = { id, version: REPLAY_LEDGER_VERSION, type: side, symbol, qty: quantity, price: candle.close, fee, orderType, time: candle.time };
  const next = [...events, event];
  calculateReplayLedger({ events: next, marks: { [symbol]: candle.close } });
  return next;
}
