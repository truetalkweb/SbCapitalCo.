import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = 'https://sbcapitalco-backend-production.up.railway.app';
const checks = [];
async function read(path) {
  const started = performance.now();
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(6000) });
  const data = await response.json();
  assert.equal(response.status, 200, path);
  return { path, elapsedMs: Math.round(performance.now() - started), data };
}
function verifyHealth(data) {
  for (const name of ['marketData', 'scanner', 'news', 'ai']) {
    const service = data[name];
    assert.ok(service.staleAfterMs > 0, `${name} freshness threshold`);
    if (service.mode === 'Live') {
      assert.ok(service.lastSuccessAt && Number.isFinite(service.freshnessMs), `${name} live evidence`);
      assert.ok(service.freshnessMs <= service.staleAfterMs, `${name} live age`);
      assert.equal(service.stale, false);
    }
  }
}
try {
  const initial = await read('/api/platform/health'); verifyHealth(initial.data);
  checks.push({ check: 'initial health labels require recent response evidence', ...initial });
  const responses = await Promise.all(['/api/ticker/AAPL', '/api/scanner', '/api/news/AAPL?limit=8'].map(read));
  for (const response of responses) {
    const { data, ...timing } = response;
    checks.push({ check: 'bounded provider response', ...timing, pending: Boolean(data.pending), refreshing: Boolean(data.refreshing), cached: Boolean(data.cached), degraded: Boolean(data.degraded), source: data.source || null, updatedAt: data.updatedAt || null, warning: data.userMessage || data.warning || null });
    assert.ok(response.elapsedMs < 6000, response.path);
    if (data.pending && !data.cached) assert.equal(data.updatedAt, null, `${response.path} pending timestamp`);
  }
  const after = await read('/api/platform/health'); verifyHealth(after.data);
  checks.push({ check: 'post-request health labels require recent response evidence', ...after });
  console.log(JSON.stringify({ checks }, null, 2));
} finally {
  await fs.mkdir('artifacts/deployment/wellness', { recursive: true });
  await fs.writeFile('artifacts/deployment/wellness/public-health.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2));
}
