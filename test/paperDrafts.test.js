import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePaperDraft, updatePaperDrafts } from '../src/utils/paperDrafts.js';

test('drafts preserve per-symbol plans without copying confirmations or arbitrary fields', () => {
  let drafts = updatePaperDrafts({}, { symbol: 'aapl', setup: 'Breakout', notes: 'Wait for volume', stopLoss: '95', takeProfit: '110', checklist: { plan: true }, confirmed: true });
  drafts = updatePaperDrafts(drafts, { symbol: 'MSFT', setup: 'Pullback' });
  drafts = updatePaperDrafts(drafts, { symbol: 'AAPL', side: 'SELL_SHORT' });
  assert.equal(drafts.AAPL.notes, 'Wait for volume');
  assert.equal(drafts.AAPL.stopLoss, '95');
  assert.equal(drafts.MSFT.setup, 'Pullback');
  assert.equal('checklist' in drafts.AAPL, false);
  assert.equal('confirmed' in drafts.AAPL, false);
});

test('draft storage stays bounded and rejects malformed symbols and oversized metadata', () => {
  assert.equal(normalizePaperDraft({ symbol: '__proto__' }), null);
  let drafts = {};
  for (let i = 0; i < 105; i++) drafts = updatePaperDrafts(drafts, { symbol: `T${i}`, notes: 'x'.repeat(3000), setup: 'y'.repeat(200) });
  assert.equal(Object.keys(drafts).length, 100);
  assert.equal(drafts.T104.notes.length, 2000);
  assert.equal(drafts.T104.setup.length, 100);
  assert.equal(drafts.T0, undefined);
  const changed = updatePaperDrafts({ AAPL: { symbol: 'AAPL', stopLoss: 95 } }, { symbol: 'AAPL', stopLoss: -1 });
  assert.equal(changed.AAPL.stopLoss, '');
});
