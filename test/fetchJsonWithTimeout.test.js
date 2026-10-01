import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fetchJsonWithTimeout } from '../src/services/fetchJsonWithTimeout.js';

test('JSON timeout covers a stalled body after successful headers and closes the request', async () => {
  let disconnected;
  const closed = new Promise(resolve => { disconnected = resolve; });
  const server = createServer((request, response) => {
    request.on('close', disconnected);
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.write('{"candles":');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(fetchJsonWithTimeout(`http://127.0.0.1:${server.address().port}`, { timeoutMs: 100 }), error => ['AbortError', 'TimeoutError'].includes(error.name));
    await Promise.race([closed, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('request remained open')), 1000); timer.unref(); })]);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('caller cancellation reaches a pending fetch and removes its abort listener', async t => {
  const originalFetch = globalThis.fetch;
  const caller = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  let removals = 0;
  const remove = caller.signal.removeEventListener.bind(caller.signal);
  caller.signal.removeEventListener = (...args) => { removals++; return remove(...args); };
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true }); started();
  });
  const pending = fetchJsonWithTimeout('https://example.test/history', { signal: caller.signal, timeoutMs: 1000 });
  await ready; caller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(removals, 1);
});

test('valid JSON succeeds and invalid JSON or HTTP errors settle promptly', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response('{"candles":[]}', { status: 200 });
  assert.deepEqual(await fetchJsonWithTimeout('https://example.test'), { candles: [] });
  globalThis.fetch = async () => new Response('{', { status: 200 });
  await assert.rejects(fetchJsonWithTimeout('https://example.test'), SyntaxError);
  globalThis.fetch = async () => new Response('', { status: 503 });
  await assert.rejects(fetchJsonWithTimeout('https://example.test'), /HTTP 503/);
});
