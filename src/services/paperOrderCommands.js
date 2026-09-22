import { cancelPaperOrder, isWorkingPaperOrder, paperQuote, submitPaperOrder } from './paperTradingEngine.js';

// Pure commands run in a revision-checked server transaction. An error leaves
// the entire original ledger intact, including reservations and protection.
export function applyPaperCommand(state, command, quotes, now, limits = {}) {
  const fail = error => ({ state, error });
  const { id, kind } = command;
  if (typeof id !== 'string' || !/^[\w-]{1,100}$/.test(id)) return fail('Invalid command ID.');
  if (kind === 'submit') return submitPaperOrder(state, { ...command.draft, id }, quotes, now, limits);
  if (kind === 'cancel') return cancelPaperOrder(state, command.orderId, now);
  if (kind === 'amend') {
    const old = state.orders.find(row => row.id === command.orderId);
    if (!isWorkingPaperOrder(old)) return fail('This order is no longer working. Refresh before editing.');
    if (old.triggeredAt) return fail('This stop has already triggered. Cancel it before submitting a replacement.');
    const draft = { ...old, side: old.action || old.side, ...command.changes, id, symbol: old.symbol };
    // Action and symbol cannot be changed by an amend. Linked exits retain size.
    draft.side = old.action || old.side;
    if (old.parentId) draft.quantity = old.quantity;
    const cancelled = cancelPaperOrder(state, old.id, now).state;
    const result = submitPaperOrder(cancelled, draft, quotes, now, limits);
    if (result.error) return fail(result.error);
    result.state = { ...result.state, orders: result.state.orders.map(row => row.id === old.id
      ? { ...row, reason: 'Replaced by an edited order', replacedBy: id }
      : row.id === id ? { ...row, replaces: old.id, parentId: old.parentId, ocoGroup: old.ocoGroup } : row) };
    // A replacement may fill immediately, before its OCO identity is attached.
    if (result.order.status === 'FILLED' && old.ocoGroup) result.state.orders = result.state.orders.map(row =>
      row.id !== id && row.ocoGroup === old.ocoGroup && isWorkingPaperOrder(row)
        ? { ...row, status: 'CANCELLED', remaining: 0, reason: 'Linked exit filled', cancelledAt: new Date(now).toISOString() } : row);
    return { ...result, order: result.state.orders.find(row => row.id === id) };
  }
  if (kind === 'cancel-all') return { state: { ...state, orders: state.orders.map(row => isWorkingPaperOrder(row)
    && (!command.symbol || row.symbol === command.symbol)
      ? { ...row, status: 'CANCELLED', remaining: 0, reason: 'Cancelled by you', cancelledAt: new Date(now).toISOString() } : row) } };
  if (kind === 'close' || kind === 'flatten') {
    const symbols = kind === 'close' ? [command.symbol] : Object.keys(state.positions);
    if (kind === 'close' && !state.positions[command.symbol]?.quantity) return fail('This paper position is already closed.');
    // Cancel existing orders first so they cannot reserve exits or reopen a
    // position after a flatten. The close remains queued outside the session.
    let next = applyPaperCommand(state, { id, kind: 'cancel-all', symbol: kind === 'close' ? command.symbol : undefined }, quotes, now).state;
    for (const [index, symbol] of symbols.entries()) {
      const quantity = Number(next.positions[symbol]?.quantity || 0);
      if (!quantity) continue;
      const result = submitPaperOrder(next, { id: `${id}-${index}`, symbol, side: quantity < 0 ? 'BUY_TO_COVER' : 'SELL',
        type: 'MARKET', quantity: Math.abs(quantity), tif: 'GTC' }, quotes, now, limits);
      if (result.error) return fail(result.error);
      next = result.state;
    }
    return { state: next };
  }
  if (kind === 'protect') {
    const symbol = command.symbol, qty = Number(state.positions[symbol]?.quantity || 0);
    if (!qty) return fail('Select an open paper position.');
    const short = qty < 0, mark = paperQuote(quotes.find(row => row.symbol === symbol), now)?.last;
    if (!mark) return fail('A fresh provider quote is required to edit protection.');
    const stop = Number(command.stopLoss), target = Number(command.takeProfit);
    if ((!stop && !target) || !Number.isFinite(stop) || !Number.isFinite(target) || stop < 0 || target < 0) return fail('Enter a positive stop loss or take profit.');
    if (stop && (short ? stop <= mark : stop >= mark)) return fail('Stop loss must be on the loss side of the current price.');
    if (target && (short ? target >= mark : target <= mark)) return fail('Take profit must be on the profit side of the current price.');
    let next = { ...state, orders: state.orders.map(row => row.symbol === symbol && row.parentId && isWorkingPaperOrder(row)
      ? { ...row, status: 'CANCELLED', remaining: 0, reason: 'Position protection replaced', cancelledAt: new Date(now).toISOString() } : row) };
    for (const [suffix, type, price] of [['stop', 'STOP', stop], ['target', 'LIMIT', target]]) {
      if (!price) continue;
      const result = submitPaperOrder(next, { id: `${id}-${suffix}`, symbol, side: short ? 'BUY_TO_COVER' : 'SELL', type,
        quantity: Math.abs(qty), tif: 'GTC', stopPrice: type === 'STOP' ? price : null, limitPrice: type === 'LIMIT' ? price : null }, quotes, now, limits);
      if (result.error) return fail(result.error);
      next = { ...result.state, orders: result.state.orders.map(row => row.id === result.order.id ? { ...row, parentId: id, ocoGroup: id } : row) };
    }
    return { state: next };
  }
  return fail('Unsupported paper command.');
}

export function paperTradeHistory(state) {
  return (state.orders || []).filter(row => row.engine === 'paper-v1' && row.status === 'FILLED'
    && ['SELL', 'BUY_TO_COVER'].includes(row.action || row.side)).map(row => ({
      id: `paper-${row.id}`, orderId: row.id, symbol: row.symbol, recordType: 'trade', status: 'closed',
      bias: (row.action || row.side) === 'BUY_TO_COVER' ? 'Short' : 'Long', quantity: row.filled,
      entryPrice: row.entryPrice ?? null, exitPrice: row.price, pnl: row.realizedPnL, fees: 0,
      closedAt: row.filledAt, createdAt: row.filledAt, currency: 'USD', source: 'Paper simulation',
      setup: 'Paper execution', notes: row.closesPosition ? 'Position closed' : 'Realized exit (may be partial)',
      immutable: true,
    }));
}
