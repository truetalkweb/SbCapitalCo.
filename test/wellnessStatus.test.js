import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProviderStatus, getHealthLabelStatus } from '../src/utils/healthStatus.js';
import { scannerCoverage } from '../src/utils/scannerCoverage.js';
import { formatScannerSourceStatus, formatNewsSourceStatus } from '../src/utils/marketUtils.js';
import { getNewsStatusLabel } from '../src/utils/newsMetadata.js';
test('health status never invents a fresh timestamp from null cache age or missing evidence', () => {
  assert.equal(normalizeProviderStatus({ cacheAgeMs: null, label: 'LIVE' }).state, 'Unavailable');
  assert.equal(normalizeProviderStatus({ cacheAgeMs: 0, label: 'LIVE' }).state, 'Unavailable');
  assert.equal(normalizeProviderStatus({ lastSuccessAt: '2026-01-01', cacheAgeMs: null }).state, 'Stale');
  assert.equal(normalizeProviderStatus({ lastSuccessAt: '2026-01-01', cacheAgeMs: 0 }).state, 'Stale');
  assert.equal(normalizeProviderStatus({ lastSuccessAt: '2099-01-01' }).state, 'Unavailable');
  assert.equal(getHealthLabelStatus('STALE'), 'warn'); assert.equal(getHealthLabelStatus('CACHED'), 'warn');
  assert.equal(getHealthLabelStatus('DISCONNECTED'), 'bad');
  assert.equal(formatScannerSourceStatus({ updatedAt: '2026-01-01', statusLabel: 'SCANNER LIVE' }), 'SCANNER STALE');
  assert.equal(formatNewsSourceStatus({ statusLabel: 'NEWS LIVE' }), 'NEWS UNAVAILABLE');
  assert.equal(formatNewsSourceStatus({ source: 'Backend News' }), 'NEWS PENDING');
  assert.equal(formatScannerSourceStatus({ source: 'FMP' }), 'SCANNER PENDING');
  assert.equal(getNewsStatusLabel({ updatedAt: '2026-01-01', rowCount: 1 }, Date.parse('2026-10-17')), 'NEWS STALE');
});
test('cached and limited coverage cannot be presented as full-market rankings, and unknown coverage is explicit', () => {
  const result = scannerCoverage({ cached: true, degraded: true, coverage: 'bounded-universe', warnings: ['Provider plan limit active'] });
  assert.equal(result.partial, true); assert.match(result.warning, /not full-market rankings/); assert.match(result.snapshot, /Cached/);
  assert.match(scannerCoverage({}).detail, /unverified/);
  assert.match(scannerCoverage({ pending: true, refreshing: true }).snapshot, /Waiting/);
});
