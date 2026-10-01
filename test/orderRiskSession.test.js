import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { useOrderRisk } from '../src/hooks/useOrderRisk.js';
test('legacy risk controls share holidays, early closes, midnight and exclusive regular close', context => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-01T15:00:00Z') });
  let result;
  function Probe() {
    result = useOrderRisk({ positions: {}, selectedStock: 'AAPL', selectedStockData: { price: 100 }, quantity: 1, orderType: 'MARKET', orderSide: 'BUY', tradingMode: 'paper' });
    return null;
  }
  for (const [iso, allowed, label] of [
    ['2026-10-01T15:00:00Z', true, 'Regular'], ['2026-10-01T20:00:00Z', false, 'After Hours'],
    ['2026-11-27T18:00:00Z', false, 'After Hours'], ['2026-12-25T15:00:00Z', false, 'Closed'],
    ['2026-10-02T04:00:00Z', false, 'Closed'],
  ]) {
    context.mock.timers.setTime(Date.parse(iso)); renderToString(createElement(Probe));
    assert.equal(result.riskGuard.marketOrderAllowed, allowed); assert.equal(result.riskGuard.marketSession, label);
  }
});
