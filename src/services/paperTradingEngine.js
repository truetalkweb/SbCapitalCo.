import { normalizeMarketQuote } from '../utils/marketDataContract.js';
import { parseNullableMarketNumber as number } from '../utils/marketNumbers.js';
import { getUsMarketStatus } from '../utils/marketSession.js';

export const PAPER_STARTING_CASH = 100000;
export const PAPER_TYPES = ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'];
export const isWorkingPaperOrder = order => order?.engine === 'paper-v1' && ['WORKING', 'PENDING', 'TRIGGERED'].includes(order.status);
const round = value => Math.round((value + Number.EPSILON) * 1e6) / 1e6;
const iso = now => new Date(now).toISOString();
const day = now => new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const positive = value => number(value) > 0 ? number(value) : null;
const actionOf = order => order.action || order.side;
const opening = order => ['BUY', 'SELL_SHORT'].includes(actionOf(order));
const shortAction = order => ['SELL_SHORT', 'BUY_TO_COVER'].includes(actionOf(order));
const reference = order => order.limitPrice || order.stopPrice || order.referencePrice || 0;

export function paperSellAvailability(state, symbol) {
  const held = Math.max(0, Number(state.positions?.[symbol]?.quantity) || 0);
  const reserved = (state.orders || []).filter(order => isWorkingPaperOrder(order) && order.symbol === symbol && actionOf(order) === 'SELL' && !order.parentId)
    .reduce((sum, order) => sum + order.quantity, 0);
  return { held, reserved, available: Math.max(0, held - reserved) };
}

export function paperCoverAvailability(state, symbol) {
  const held = Math.max(0, -(Number(state.positions?.[symbol]?.quantity) || 0));
  const reserved = (state.orders || []).filter(order => isWorkingPaperOrder(order) && order.symbol === symbol && actionOf(order) === 'BUY_TO_COVER' && !order.parentId)
    .reduce((sum, order) => sum + order.quantity, 0);
  return { held, reserved, available: Math.max(0, held - reserved) };
}

export function paperQuote(raw, now = Date.now()) {
  const normalized = normalizeMarketQuote(raw, { now });
  // Delayed feeds can power an explicitly delayed simulation, never a purported live fill.
  const age = normalized.asOf === null ? Infinity : now - normalized.asOf * 1000;
  if (raw?.isHalted || normalized.isSynthetic || normalized.fallback || normalized.degraded || normalized.cached
    || !['live', 'delayed'].includes(normalized.quality) || age < -5000
    || age > (normalized.quality === 'delayed' ? 20 * 60000 : 60000)) return null;
  const bid = positive(raw.bidPrice ?? raw.bid), ask = positive(raw.askPrice ?? raw.ask);
  if (bid && ask && bid > ask) return null;
  return { last: normalized.price, buy: ask || normalized.price, sell: bid || normalized.price,
    source: normalized.source, quality: normalized.quality, asOf: normalized.asOf,
    basis: bid && ask ? 'Bid / ask' : 'Last trade (spread unavailable)' };
}

export function paperBalances(state, quotes = [], now = Date.now()) {
  let cost = 0, value = 0, shortCollateral = 0, allMarks = true;
  for (const [symbol, position] of Object.entries(state.positions || {})) {
    const qty = number(position.quantity ?? position.qty), avg = number(position.average ?? position.avgPrice);
    if (qty === null || avg === null || avg < 0) return { cash: null, buyingPower: null, equity: null, unrealizedPnl: null };
    cost += qty * avg;
    // Paper model: restrict short proceeds plus 100% of entry notional as
    // collateral. Short proceeds cannot fund another position.
    if (qty < 0) shortCollateral += -qty * avg * 2;
    const quote = quotes.find(row => row.symbol === symbol);
    const mark = paperQuote(quote, now)?.last;
    if (qty && !mark) allMarks = false;
    value += qty * (mark || 0);
  }
  const cash = round(PAPER_STARTING_CASH + (number(state.realizedPnL) || 0) - cost);
  const reserved = (state.orders || []).filter(order => isWorkingPaperOrder(order) && opening(order))
    .reduce((sum, order) => sum + order.quantity * reference(order), 0);
  return { cash, shortCollateral: round(shortCollateral), reserved: round(reserved), buyingPower: round(Math.max(0, cash - shortCollateral - reserved)),
    equity: allMarks ? round(cash + value) : null, unrealizedPnl: allMarks ? round(value - cost) : null,
    realizedPnl: number(state.realizedPnL) || 0 };
}

function dayExpiry(now) {
  // Find the next regular session, including weekends and exchange holidays.
  let time = Math.floor(now / 60000) * 60000;
  for (let count = 0; count < 14 * 48; count++, time += 30 * 60000) {
    if (getUsMarketStatus(new Date(time)) !== 'OPEN') continue;
    while (getUsMarketStatus(new Date(time)) === 'OPEN') time += 60000;
    return iso(time);
  }
  throw new Error('Unable to determine the next paper trading session.');
}

export function submitPaperOrder(state, draft, quotes = [], now = Date.now(), limits = {}) {
  const existing = (state.orders || []).find(order => order.id === draft.id);
  if (existing) return { state, order: existing, duplicate: true };
  const symbol = String(draft.symbol || '').trim().toUpperCase();
  const action = draft.side, side = ['BUY', 'BUY_TO_COVER'].includes(action) ? 'BUY' : 'SELL';
  const isOpening = ['BUY', 'SELL_SHORT'].includes(action), isShort = ['SELL_SHORT', 'BUY_TO_COVER'].includes(action);
  const type = draft.type || 'MARKET', qty = Number(draft.quantity);
  const limitPrice = ['LIMIT', 'STOP_LIMIT'].includes(type) ? positive(draft.limitPrice) : null;
  const stopPrice = ['STOP', 'STOP_LIMIT'].includes(type) ? positive(draft.stopPrice) : null;
  const stopLoss = positive(draft.stopLoss), takeProfit = positive(draft.takeProfit);
  const fail = error => ({ state, error });
  if (!draft.id || !/^[A-Z][A-Z0-9.-]{0,13}$/.test(symbol) || !['BUY', 'SELL', 'SELL_SHORT', 'BUY_TO_COVER'].includes(action)) return fail('Select a valid equity symbol and side.');
  if (!PAPER_TYPES.includes(type)) return fail('Unsupported paper order type.');
  if (!Number.isSafeInteger(qty) || qty <= 0) return fail('Quantity must be a positive whole number.');
  if (['LIMIT', 'STOP_LIMIT'].includes(type) && !limitPrice) return fail('Enter a limit price greater than zero.');
  if (['STOP', 'STOP_LIMIT'].includes(type) && !stopPrice) return fail('Enter a stop trigger greater than zero.');
  for (const key of ['stopLoss', 'takeProfit']) if (draft[key] !== '' && draft[key] != null && !positive(draft[key])) return fail('Protection prices must be greater than zero.');
  if (!['DAY', 'GTC'].includes(draft.tif || 'DAY')) return fail('Select DAY or GTC duration.');
  if (!isOpening && (stopLoss || takeProfit)) return fail('Attach protection to an opening Buy or Sell Short order.');
  const savedPosition = state.positions?.[symbol];
  if (savedPosition && (!Number.isSafeInteger(Number(savedPosition.quantity))
    || number(savedPosition.average) === null || Number(savedPosition.average) < 0)) return fail('The saved paper position quantity or cost is invalid.');
  const signedHeld = Number(savedPosition?.quantity || 0);
  if (action === 'BUY' && signedHeld < 0) return fail('Use Buy to Cover to close the short position before buying long.');
  if (action === 'SELL_SHORT' && signedHeld > 0) return fail('Sell your long shares before opening a short position.');
  if (isOpening && (state.orders || []).some(order => isWorkingPaperOrder(order) && order.symbol === symbol && opening(order) && shortAction(order) !== isShort)) return fail('Cancel the opposite opening order before changing position direction.');
  const quote = paperQuote(quotes.find(row => row.symbol === symbol), now);
  const referencePrice = limitPrice || stopPrice || (side === 'BUY' ? quote?.buy : quote?.sell) || null;
  if (stopLoss && referencePrice && (isShort ? stopLoss <= referencePrice : stopLoss >= referencePrice)) return fail(isShort ? 'A short stop loss must be above the entry price.' : 'A protective stop loss must be below the buy entry price.');
  if (takeProfit && referencePrice && (isShort ? takeProfit >= referencePrice : takeProfit <= referencePrice)) return fail(isShort ? 'A short take profit must be below the entry price.' : 'Take profit must be above the buy entry price.');
  const balances = paperBalances(state, quotes, now);
  if (isOpening) {
    if (balances.buyingPower === null) return fail('Paper buying power cannot be calculated from the saved positions.');
    if (referencePrice && qty * referencePrice > balances.buyingPower) return fail('Insufficient paper buying power.');
    if (limits.maxOrderValue > 0 && referencePrice * qty > limits.maxOrderValue) return fail(`Order exceeds your $${limits.maxOrderValue} maximum order value.`);
    if (limits.riskPerTrade > 0 && stopLoss && referencePrice && Math.abs(referencePrice - stopLoss) * qty > limits.riskPerTrade) return fail('Order exceeds your configured risk per trade.');
    const todayPnl = (state.orders || []).filter(order => order.filledAt && day(order.filledAt) === day(now))
      .reduce((sum, order) => sum + (number(order.realizedPnL) || 0), 0);
    if (limits.dailyLossLimit > 0 && todayPnl <= -limits.dailyLossLimit) return fail('Your daily paper loss limit blocks new positions. You can still sell, cover or cancel.');
  } else if (action === 'SELL') {
    const { held, reserved, available } = paperSellAvailability(state, symbol);
    if (!held) return fail(`You do not own ${symbol} paper shares. Use Buy to open long, or Sell Short to open a short position.`);
    if (qty > available) return fail(reserved
      ? `${available} ${symbol} shares available; ${reserved} are reserved by working sells. Reduce quantity or cancel a working sell in Orders.`
      : `You own ${held} ${symbol} paper shares. Reduce the sell quantity to ${held} or less.`);
  } else {
    const { held, reserved, available } = paperCoverAvailability(state, symbol);
    if (!held) return fail(`There is no ${symbol} short position to cover. Use Sell Short to open one.`);
    if (qty > available) return fail(`${available} ${symbol} short shares available to cover${reserved ? `; ${reserved} reserved by working covers` : ''}. Reduce quantity or cancel a working cover.`);
  }
  const order = { id: draft.id, engine: 'paper-v1', mode: 'paper', source: 'Paper simulation', symbol, side, action,
    orderType: type, type, quantity: qty, requestedQuantity: qty, filled: 0, remaining: qty,
    limitPrice: ['LIMIT', 'STOP_LIMIT'].includes(type) ? limitPrice : null,
    stopPrice: ['STOP', 'STOP_LIMIT'].includes(type) ? stopPrice : null,
    stopLoss, takeProfit, referencePrice, tif: draft.tif || 'DAY', status: 'WORKING', price: null,
    createdAt: iso(now), submittedAt: iso(now), expiresAt: (draft.tif || 'DAY') === 'DAY' ? dayExpiry(now) : null,
    maxOrderValue: Number(limits.maxOrderValue) || 0, riskPerTrade: Number(limits.riskPerTrade) || 0 };
  const next = processPaperOrders({ ...state, orders: [order, ...(state.orders || [])] }, quotes, now);
  return { state: next, order: next.orders.find(row => row.id === order.id) };
}

export function cancelPaperOrder(state, id, now = Date.now()) {
  const order = state.orders.find(row => row.id === id);
  if (!isWorkingPaperOrder(order)) return { state, error: 'This order is no longer working.' };
  return { state: { ...state, orders: state.orders.map(row => row.id === id
    ? { ...row, status: 'CANCELLED', remaining: 0, cancelledAt: iso(now), reason: 'Cancelled by you' } : row) } };
}

export function processPaperOrders(state, quotes = [], now = Date.now()) {
  if (!(state.orders || []).some(isWorkingPaperOrder)) return state;
  const next = { ...state, positions: { ...state.positions }, orders: state.orders.map(order => ({ ...order })) };
  const open = getUsMarketStatus(new Date(now)) === 'OPEN';
  const working = next.orders.filter(isWorkingPaperOrder).reverse();
  for (const order of working) {
    if (!isWorkingPaperOrder(order)) continue;
    if (order.expiresAt && now >= Date.parse(order.expiresAt)) {
      Object.assign(order, { status: 'EXPIRED', remaining: 0, reason: 'DAY order expired', updatedAt: iso(now) }); continue;
    }
    const held = Number(next.positions[order.symbol]?.quantity || 0);
    const isShort = shortAction(order), isOpening = opening(order);
    const available = isShort ? Math.max(0, -held) : Math.max(0, held);
    if (order.parentId && available <= 0) {
      Object.assign(order, { status: 'CANCELLED', remaining: 0, reason: 'Protected position is closed' }); continue;
    }
    if (!open) { order.reason = 'Queued for the regular US equity session'; continue; }
    const quote = paperQuote(quotes.find(row => row.symbol === order.symbol), now);
    if (!quote) { order.reason = 'Waiting for a fresh provider quote'; continue; }
    const fillPrice = order.side === 'BUY' ? quote.buy : quote.sell;
    // The last reported trade triggers stops; execution can gap past the stop.
    if (['STOP', 'STOP_LIMIT'].includes(order.type) && !order.triggeredAt) {
      if (!(order.side === 'BUY' ? quote.last >= order.stopPrice : quote.last <= order.stopPrice)) {
        order.reason = 'Waiting for stop trigger'; continue;
      }
      order.triggeredAt = iso(now); order.status = 'TRIGGERED';
    }
    if (['LIMIT', 'STOP_LIMIT'].includes(order.type)
      && !(order.side === 'BUY' ? fillPrice <= order.limitPrice : fillPrice >= order.limitPrice)) {
      order.reason = order.triggeredAt ? 'Stop triggered; waiting for limit price' : 'Waiting for limit price'; continue;
    }
    const qty = order.parentId ? Math.min(order.quantity, available) : order.quantity;
    let reason = '';
    if (isOpening) {
      const balances = paperBalances(next, quotes, now);
      const otherReserved = next.orders.filter(other => other.id !== order.id && isWorkingPaperOrder(other) && opening(other))
        .reduce((sum, other) => sum + other.quantity * reference(other), 0);
      if (isShort ? held > 0 : held < 0) reason = 'Close the opposite position before opening this order';
      else if (balances.cash === null || fillPrice * qty > balances.cash - balances.shortCollateral - otherReserved) reason = 'Insufficient paper buying power at execution';
      else if (order.maxOrderValue > 0 && fillPrice * qty > order.maxOrderValue) reason = 'Execution exceeds maximum order value';
      else if ((order.stopLoss && (isShort ? order.stopLoss <= fillPrice : order.stopLoss >= fillPrice)) || (order.takeProfit && (isShort ? order.takeProfit >= fillPrice : order.takeProfit <= fillPrice))) reason = 'Price moved outside the attached protection levels';
      else if (order.riskPerTrade > 0 && order.stopLoss && Math.abs(fillPrice - order.stopLoss) * qty > order.riskPerTrade) reason = 'Execution exceeds risk per trade';
    } else if (qty > available || qty <= 0) reason = 'Insufficient paper shares at execution';
    else if (number(next.positions[order.symbol]?.average) === null) reason = 'Saved paper position cost is unavailable';
    if (reason) { Object.assign(order, { status: 'REJECTED', reason, remaining: 0, updatedAt: iso(now) }); continue; }
    const position = next.positions[order.symbol] || { quantity: 0, average: 0 };
    let realized = 0;
    if (isOpening) next.positions[order.symbol] = { ...position, quantity: held + (isShort ? -qty : qty),
      average: round((Number(position.average) * Math.abs(held) + fillPrice * qty) / (Math.abs(held) + qty)), source: 'Paper simulation', currency: 'USD' };
    else {
      realized = round((fillPrice - Number(position.average)) * qty * (isShort ? -1 : 1));
      next.realizedPnL = round((Number(next.realizedPnL) || 0) + realized);
      if (Math.abs(held) === qty) delete next.positions[order.symbol];
      else next.positions[order.symbol] = { ...position, quantity: held + (isShort ? qty : -qty) };
    }
    Object.assign(order, { status: 'FILLED', filled: qty, remaining: 0, price: fillPrice, value: round(fillPrice * qty),
      realizedPnL: realized, filledAt: iso(now), reason: `Simulated fill · ${quote.quality} quote · ${quote.basis}`,
      quoteSource: quote.source, quoteAsOf: quote.asOf, quoteQuality: quote.quality });
    if (order.ocoGroup) for (const sibling of next.orders) if (sibling.id !== order.id && sibling.ocoGroup === order.ocoGroup && isWorkingPaperOrder(sibling)) {
      Object.assign(sibling, { status: 'CANCELLED', remaining: 0, reason: 'Linked exit filled', cancelledAt: iso(now) });
    }
    if (isOpening) for (const [suffix, type, trigger] of [['stop', 'STOP', order.stopLoss], ['target', 'LIMIT', order.takeProfit]]) {
      if (!trigger) continue;
      const child = { id: `${order.id}-${suffix}`, engine: 'paper-v1', mode: 'paper', source: 'Paper simulation', symbol: order.symbol,
        side: isShort ? 'BUY' : 'SELL', action: isShort ? 'BUY_TO_COVER' : 'SELL', type, orderType: type, quantity: qty, requestedQuantity: qty, filled: 0, remaining: qty, price: null,
        stopPrice: type === 'STOP' ? trigger : null, limitPrice: type === 'LIMIT' ? trigger : null,
        status: 'WORKING', tif: 'GTC', parentId: order.id, ocoGroup: order.id, createdAt: iso(now), reason: 'Protective exit armed' };
      next.orders.unshift(child);
    }
  }
  for (const order of next.orders.filter(order => isWorkingPaperOrder(order) && order.parentId)) {
    const signedHeld = Number(next.positions[order.symbol]?.quantity || 0);
    const held = shortAction(order) ? Math.max(0, -signedHeld) : Math.max(0, signedHeld);
    if (held <= 0) Object.assign(order, { status: 'CANCELLED', remaining: 0, reason: 'Protected position is closed' });
    else if (order.quantity > held) { order.quantity = held; order.remaining = held; }
  }
  return JSON.stringify(next) === JSON.stringify(state) ? state : next;
}
