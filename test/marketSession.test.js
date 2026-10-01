import test from 'node:test';
import assert from 'node:assert/strict';
import { getNyDateParts, getUsEquitySession, getUsMarketStatus, getNextUsEquityClose, getMarketHolidayKeys } from '../src/utils/marketSession.js';
import { submitPaperOrder, processPaperOrders } from '../src/services/paperTradingEngine.js';
const status = time => getUsMarketStatus(new Date(time));
const quote = time => [{ symbol: 'AAPL', price: 100, source: 'Isolated session fixture', lastTradeTime: time }];
const empty = () => ({ orders: [], positions: {}, realizedPnL: 0 });
const submit = (time, extra = {}) => submitPaperOrder(empty(), { id: 'day', symbol: 'AAPL', side: 'BUY', quantity: 1, type: 'LIMIT', limitPrice: 95, tif: 'DAY', ...extra }, quote(time), Date.parse(time));

test('normal session boundaries are half-open and midnight is hour zero', () => {
  for (const [time, expected] of [['03:59:59', 'CLOSED'], ['04:00:00', 'PREMARKET'], ['09:29:59', 'PREMARKET'], ['09:30:00', 'OPEN'], ['15:59:59', 'OPEN'], ['16:00:00', 'AFTER HOURS'], ['19:59:59', 'AFTER HOURS'], ['20:00:00', 'CLOSED']]) assert.equal(status(`2026-10-01T${time}-04:00`), expected);
  assert.equal(getNyDateParts(new Date('2026-10-01T00:05:00-04:00')).hour, 0);
  assert.equal(getUsEquitySession(new Date(NaN)).isRegular, false);
});

test('published 2026 exchange holidays close the complete session, including Good Friday', () => {
  const dates = ['01-01', '01-19', '02-16', '04-03', '05-25', '06-19', '07-03', '09-07', '11-26', '12-25'];
  assert.equal(getMarketHolidayKeys(2026).size, 10);
  for (const date of dates) for (const hour of ['08', '12', '18']) assert.equal(status(`2026-${date}T${hour}:00:00-05:00`), 'CLOSED');
  assert.equal(status('2025-01-09T15:00:00Z'), 'CLOSED');
  assert.equal(status('2027-12-31T15:00:00Z'), 'OPEN', 'Saturday New Year does not close the preceding Friday');
});

test('published 2025–2028 early closes stop regular fills at 13:00 and extended labels at 17:00 ET', () => {
  for (const date of ['2025-07-03', '2025-11-28', '2025-12-24', '2026-11-27', '2026-12-24', '2027-11-26', '2028-07-03', '2028-11-24']) {
    assert.equal(getUsEquitySession(new Date(`${date}T12:59:59-04:00`)).earlyClose, true);
    const offset = date.slice(5, 7) === '07' ? '-04:00' : '-05:00';
    assert.equal(status(`${date}T12:59:59${offset}`), 'OPEN');
    assert.equal(status(`${date}T13:00:00${offset}`), 'AFTER HOURS');
    assert.equal(status(`${date}T16:59:59${offset}`), 'AFTER HOURS');
    assert.equal(status(`${date}T17:00:00${offset}`), 'CLOSED');
  }
  assert.equal(getUsEquitySession(new Date('2026-07-03T15:00:00Z')).earlyClose, false);
  assert.equal(getUsEquitySession(new Date('2027-12-24T15:00:00Z')).earlyClose, false);
});

test('next DAY expiry skips weekends and holidays, and uses the correct DST offset', () => {
  for (const [time, close] of [
    ['2026-11-27T17:59:59Z', '2026-11-27T18:00:00.000Z'],
    ['2026-11-27T18:00:00Z', '2026-11-30T21:00:00.000Z'],
    ['2026-12-24T19:00:00Z', '2026-12-28T21:00:00.000Z'],
    ['2026-03-06T21:00:00Z', '2026-03-09T20:00:00.000Z'],
    ['2026-10-30T20:00:00Z', '2026-11-02T21:00:00.000Z'],
    ['2026-07-02T20:00:00Z', '2026-07-06T20:00:00.000Z'],
  ]) assert.equal(getNextUsEquityClose(new Date(time)), close);
  assert.throws(() => getNextUsEquityClose(new Date(NaN)));
});

test('DAY orders expire at early close before a crossing quote; GTC survives and cannot fill after close', () => {
  const before = '2026-11-27T17:59:59Z', close = '2026-11-27T18:00:00Z';
  const day = submit(before); assert.equal(day.order.expiresAt, '2026-11-27T18:00:00.000Z');
  const crossing = quote(close).map(row => ({ ...row, price: 94 }));
  assert.equal(processPaperOrders(day.state, crossing, Date.parse(close)).orders[0].status, 'EXPIRED');
  const gtc = submit(before, { tif: 'GTC' });
  const waiting = processPaperOrders(gtc.state, crossing, Date.parse(close));
  assert.equal(waiting.orders[0].status, 'WORKING'); assert.deepEqual(waiting.positions, {});
  const next = '2026-11-30T14:30:00Z';
  assert.equal(processPaperOrders(waiting, quote(next).map(row => ({ ...row, price: 94 })), Date.parse(next)).orders[0].status, 'FILLED');
});

test('existing DAY orders with obsolete 16:00 expiry are corrected without rewriting earlier expiries or GTC', () => {
  const before = '2026-12-24T17:00:00Z', close = '2026-12-24T18:00:00Z';
  const original = submit(before).state;
  const old = { ...original, orders: original.orders.map(row => ({ ...row, expiresAt: '2026-12-24T21:00:00Z' })) };
  const repaired = processPaperOrders(old, quote(close), Date.parse(close));
  assert.equal(repaired.orders[0].status, 'EXPIRED'); assert.equal(repaired.orders[0].expiresAt, '2026-12-24T18:00:00.000Z');
  assert.equal(old.orders[0].expiresAt, '2026-12-24T21:00:00Z');
});
