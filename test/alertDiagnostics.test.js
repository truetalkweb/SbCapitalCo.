import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAlertQuote } from '../src/utils/alertDiagnostics.js';
const now = Date.parse('2026-10-02T14:00Z');
const quote = extra => ({ symbol: 'AAPL', price: 100, source: 'Isolated provider', timestamp: now / 1000, ...extra });
test('diagnostics distinguish scan time from market timestamp and preserve last valid evidence on failure', () => {
  const live = evaluateAlertQuote(quote({ timestamp: now / 1000 - 5 }), 'AAPL', now);
  assert.equal(live.state, 'watching'); assert.notEqual(live.checkedAt, live.lastValidQuoteAt);
  const failed = evaluateAlertQuote(null, 'AAPL', now + 30000, live, true);
  assert.equal(failed.state, 'waiting'); assert.match(failed.reason, /request failed/); assert.equal(failed.lastValidQuoteAt, live.lastValidQuoteAt); assert.equal(failed.quoteTimestamp, null);
});
test('stale, delayed, halted, mismatched and fabricated samples never become valid live evidence', () => {
  for (const extra of [{ timestamp: now / 1000 - 60 }, { delayed: true }, { isHalted: true }, { symbol: 'TSLA' }, { isSynthetic: true }, { timestampSource: 'received' }]) {
    const data = evaluateAlertQuote(quote(extra), 'AAPL', now); assert.equal(data.state, 'waiting'); assert.equal(data.lastValidQuoteAt, null); assert.equal(data.lastValidPrice, null);
  }
});
