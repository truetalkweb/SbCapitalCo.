import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePaperCommand, acknowledgePaperCommand } from '../src/services/paperCommandRecovery.js';
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
const buy = id => ({ kind: 'submit', id, draft: { id, symbol: 'AAPL', side: 'BUY', quantity: 10 } });
test('unacknowledged paper intent keeps its exact command through remount and generated ID changes', () => {
  const store = storage();
  const first = preparePaperCommand(buy('original'), 'user', store);
  assert.deepEqual(preparePaperCommand(buy('new-after-reload'), 'user', store), first);
  acknowledgePaperCommand(first, 'user', store);
  assert.equal(preparePaperCommand(buy('intentional-new'), 'user', store).id, 'intentional-new');
});
test('distinct intents and users cannot reuse an unconfirmed receipt', () => {
  const store = storage(); preparePaperCommand(buy('one'), 'a', store);
  assert.equal(preparePaperCommand({ ...buy('two'), draft: { ...buy('two').draft, quantity: 20 } }, 'a', store).id, 'two');
  assert.equal(preparePaperCommand(buy('three'), 'b', store).id, 'three');
  assert.equal(preparePaperCommand(buy('again'), 'a', store).id, 'one');
});
test('unavailable storage fails before a command can be sent', () => {
  assert.throws(() => preparePaperCommand(buy('one'), 'a', { getItem() { throw new Error('disabled'); } }), /disabled/);
});

test('optional checklist/setup metadata cannot duplicate an older unconfirmed order after upgrade', () => {
  const store = storage(), first = preparePaperCommand(buy('original'), 'user', store);
  const next = { ...buy('new'), draft: { ...buy('new').draft, setup: 'Reviewed setup', checklist: { plan: true, size: true, exit: true } } };
  assert.deepEqual(preparePaperCommand(next, 'user', store), first);
  acknowledgePaperCommand(first, 'user', store);
  const accepted = preparePaperCommand(next, 'user', store);
  assert.equal(accepted.draft.setup, 'Reviewed setup');
  assert.deepEqual(preparePaperCommand({ ...next, draft: { ...next.draft, setup: 'Changed review', checklist: {} } }, 'user', store), accepted);
});
