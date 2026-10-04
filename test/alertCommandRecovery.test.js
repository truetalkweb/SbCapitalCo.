import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAlertCommand, acknowledgeAlertCommand, readPendingAlertCommand } from '../src/services/alertCommandRecovery.js';
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };
const create = id => ({ kind: 'upsert', alert: { id, symbol: 'AAPL', trigger: 110, direction: 'above', active: true, history: [], createdAt: new Date().toISOString() } });
test('uncertain create survives reload with its original rule and command identity', () => {
  const store = storage(), first = prepareAlertCommand(create('original-rule'), 'a', { create: true }, store);
  assert.deepEqual(prepareAlertCommand(create('new-rule'), 'a', { create: true }, store), first);
  assert.deepEqual(readPendingAlertCommand('a', store).command, first);
  acknowledgeAlertCommand(first, 'a', store);
  const next = prepareAlertCommand(create('intentional-new-rule'), 'a', { create: true }, store);
  assert.notEqual(next.id, first.id); assert.equal(next.alert.id, 'intentional-new-rule');
});
test('pending edits cannot be replaced by a different intent, monitoring mode or account', () => {
  const store = storage(), first = prepareAlertCommand(create('one'), 'a', {}, store);
  assert.throws(() => prepareAlertCommand({ kind: 'remove', alertId: 'one' }, 'a', {}, store), /awaiting confirmation/);
  assert.throws(() => prepareAlertCommand({ kind: 'monitoring', enabled: false }, 'a', {}, store), /awaiting confirmation/);
  const other = prepareAlertCommand({ kind: 'pause', paused: true }, 'b', {}, store);
  assert.notEqual(other.id, first.id); acknowledgeAlertCommand(other, 'b', store);
  assert.deepEqual(readPendingAlertCommand('a', store).command, first);
});
test('changing server history cannot turn an uncertain edit into a new mutation', () => {
  const store = storage(), first = prepareAlertCommand(create('one'), 'a', {}, store);
  const updated = create('one'); updated.alert.history = [{ id: 'server-trigger' }]; updated.alert.updatedAt = 'later';
  assert.deepEqual(prepareAlertCommand(updated, 'a', {}, store), first);
  updated.alert.trigger = 120;
  assert.throws(() => prepareAlertCommand(updated, 'a', {}, store), /awaiting confirmation/);
  acknowledgeAlertCommand({ id: 'unrelated-reply' }, 'a', store);
  assert.deepEqual(readPendingAlertCommand('a', store).command, first);
});
test('corrupt or unavailable recovery storage blocks requests before dispatch', () => {
  const store = storage(); store.setItem('sb-alert-pending-v1:a', '{');
  assert.throws(() => prepareAlertCommand(create('one'), 'a', {}, store), /invalid/);
  store.setItem('sb-alert-pending-v1:a', JSON.stringify({ version: 1, intent: 'x', command: {} }));
  assert.throws(() => readPendingAlertCommand('a', store), /invalid/);
  assert.throws(() => prepareAlertCommand(create('one'), 'a', {}, { getItem() { throw new Error('blocked storage'); } }), /blocked storage/);
});
test('stored payload is isolated from subsequent draft mutations', () => {
  const store = storage(), request = create('one'), first = prepareAlertCommand(request, 'a', {}, store);
  request.alert.trigger = 999;
  assert.equal(first.alert.trigger, 110); assert.equal(readPendingAlertCommand('a', store).command.alert.trigger, 110);
});
