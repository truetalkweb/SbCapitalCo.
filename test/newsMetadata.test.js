import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNewsMeta, getNewsStatusLabel } from '../src/utils/newsMetadata.js';
const now = Date.parse('2026-09-30T19:00:00Z'), rows = [{ headline: 'Provider article', fallback: false }];

test('news never manufactures a provider timestamp or trusts live labels without freshness', () => {
  for (const updatedAt of [undefined, null, '', 'invalid', new Date(now + 10000).toISOString()]) {
    const meta = buildNewsMeta({ source: 'Backend News', statusLabel: 'NEWS LIVE', providerStatus: { label: 'LIVE' }, updatedAt }, rows, now);
    assert.equal(meta.updatedAt, null); assert.equal(meta.confidenceLabel, 'Freshness unknown');
    assert.equal(getNewsStatusLabel(meta), 'NEWS FRESHNESS UNKNOWN');
  }
});
test('news requires usable rows and a valid provider update while keeping fallback/cached/limited precedence', () => {
  const timestamp = new Date(now - 1000).toISOString();
  assert.equal(getNewsStatusLabel(buildNewsMeta({ updatedAt: timestamp }, rows, now)), 'NEWS LIVE');
  assert.equal(getNewsStatusLabel(buildNewsMeta({ updatedAt: timestamp, statusLabel: 'LIVE' }, [], now)), 'NEWS PENDING');
  for (const [fields, expected] of [[{ degraded: true }, 'NEWS FALLBACK'], [{ cached: true }, 'NEWS CACHED'],
    [{ providerWarnings: ['Quota exceeded'] }, 'NEWS PROVIDER LIMITED'], [{ providerStatus: { label: 'DELAYED' } }, 'NEWS DELAYED']]) {
    const meta = buildNewsMeta({ updatedAt: timestamp, ...fields }, rows, now);
    assert.equal(getNewsStatusLabel(meta), expected); assert.notEqual(meta.confidenceLabel, 'Live');
  }
  assert.equal(getNewsStatusLabel(buildNewsMeta({}, [{ fallback: true }], now)), 'NEWS FALLBACK');
});
