import test from 'node:test';
import assert from 'node:assert/strict';
import { getServiceHealthSummary, getQuestradeHealth, resolveDataHealthLabel } from '../src/utils/healthStatus.js';

test('configured idle AI and private broker are informational rather than outages', () => {
  assert.equal(getServiceHealthSummary('ai', { configured: true, status: 'pending', mode: 'Unavailable' }).label, 'AI READY');
  assert.equal(getServiceHealthSummary('ai', { configured: true, status: 'pending', mode: 'Unavailable' }).status, 'info');
  assert.equal(getServiceHealthSummary('broker', { status: 'private', mode: 'Unavailable' }).status, 'info');
  assert.equal(getServiceHealthSummary('scanner', { status: 'pending', mode: 'Unavailable' }).label, 'SCANNER PENDING');
});

test('public health mode controls service labels and preserves recovery guidance', () => {
  const summary = getServiceHealthSummary('scanner', { mode: 'Degraded', userMessage: 'Partial coverage.', recoveryAction: 'Check row timestamps.' });
  assert.equal(summary.status, 'warn');
  assert.match(summary.message, /Partial coverage.*Check row timestamps/);
  assert.equal(getServiceHealthSummary('news', { mode: 'Cached' }).label, 'NEWS CACHED');
  assert.equal(getServiceHealthSummary('ai', { configured: true, mode: 'Stale', live: true }).status, 'warn');
  assert.equal(getServiceHealthSummary('marketData', { mode: 'Unavailable' }).status, 'bad');
});

test('a degraded or delayed feed cannot be hidden by another live feed', () => {
  for (const state of ['DEGRADED', 'DELAYED', 'STALE', 'UNAVAILABLE', 'CACHED']) {
    assert.equal(resolveDataHealthLabel(`SCANNER ${state}`, 'NEWS LIVE'), 'Data Limited');
  }
  assert.equal(resolveDataHealthLabel('SCANNER LIVE', 'NEWS PENDING'), 'Data Pending');
  assert.equal(resolveDataHealthLabel('SCANNER LIVE', 'NEWS LIVE'), 'Data Live');
});

test('market status uses public freshness evidence without requiring private broker diagnostics', () => {
  for (const mode of ['Live', 'Stale', 'Degraded', 'Cached']) {
    const health = getQuestradeHealth({ platformHealth: { marketData: { source: 'Questrade', mode }, broker: { status: 'private' } } });
    assert.equal(health.label, `QTRD ${mode.toUpperCase()}`);
    assert.equal(health.status, mode === 'Live' ? 'ok' : 'warn');
  }
});
