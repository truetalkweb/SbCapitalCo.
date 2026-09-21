import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from '@babel/parser';

test('actual session restore callback preserves workspace readiness on token refresh, resets on user switch', () => {
 const source = readFileSync(new URL('../src/hooks/useCloudWorkspace.js', import.meta.url), 'utf8');
 const ast = parse(source, { sourceType: 'module' });
 let callback;
 const visit = node => {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && node.id?.name === 'finishSessionRestore') callback = node.init;
  for (const value of Object.values(node)) for (const child of Array.isArray(value) ? value : [value]) visit(child);
 };
 visit(ast); assert.ok(callback);
 const ready = [], users = [];
 const context = vm.createContext({ active: true, initialized: false, restoredUserId: null,
  setWorkspaceReady: value => ready.push(value), setUser: value => users.push(value), setAuthReady() {} });
 const restore = vm.runInContext(`(${source.slice(callback.start, callback.end)})`, context);
 restore({ user: { id: 'a' } }); assert.deepEqual(ready, [false]);
 ready.length = 0;
 restore({ user: { id: 'a', refreshed: true } }); assert.deepEqual(ready, []);
 assert.equal(users.at(-1).refreshed, true);
 restore({ user: { id: 'b' } }); assert.deepEqual(ready, [false]);
 restore(null); assert.deepEqual(ready, [false, false]);
});
