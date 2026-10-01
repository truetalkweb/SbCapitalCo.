import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, options);
const checks = [], errors = [], executions = [], timings = [], resources = [];
const record = text => { checks.push(text); console.log(`PASS ${text}`); };
let userId, browser;
try {
  const created = await admin.auth.admin.createUser({ email: `performance-${crypto.randomUUID()}@example.com`, password: `Qa!${crypto.randomBytes(24).toString('hex')}`, email_confirm: true, app_metadata: { plan: 'premium', audit_fixture: true } });
  assert.ifError(created.error); userId = created.data.user.id;
  const saved = await admin.from('terminal_workspaces').insert({ user_id: userId, data: { activeWorkspace: 'dashboard', selectedStock: 'AAPL', layoutMode: '1', timeframe: '5m', positions: {}, orders: [] } }); assert.ifError(saved.error);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: created.data.user.email }); assert.ifError(link.error);
  const auth = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'email' }); assert.ifError(auth.error);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1536, height: 1024 } });
  await context.addInitScript(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('sb_public_onboarding_dismissed','true'); localStorage.setItem('sb_focused_terminal_workspace_v1','true');
  }, { key: `sb-${new URL(process.env.SUPABASE_URL).hostname.split('.')[0]}-auth-token`, session: auth.data.session });
  await context.addInitScript(() => {
    window.qaPerformance = { intervals: new Map(), longTasks: [] };
    const start = window.setInterval.bind(window), stop = window.clearInterval.bind(window);
    window.setInterval = (fn, delay, ...args) => { const id = start(fn, delay, ...args); window.qaPerformance.intervals.set(id, delay); return id; };
    window.clearInterval = id => { window.qaPerformance.intervals.delete(id); stop(id); };
    new PerformanceObserver(list => { window.qaPerformance.longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration }))); }).observe({ type: 'longtask', buffered: true });
  });
  const startup = performance.now();
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.route(/\/api\/(?:paper\/commands|questrade\/(?:orders|submit|execute|cancel))/i, route => { executions.push(route.request().url()); return route.abort(); });
  await page.goto('https://www.sbcapitalco.com');
  await expect(page.getByRole('region', { name: 'Paper trade ticket', exact: true }).getByRole('button', { name: 'Place Paper Buy', exact: true })).toBeEnabled({ timeout: 30000 });
  await fs.mkdir('artifacts/deployment/performance', { recursive: true });
  const cdp = await context.newCDPSession(page);
  const settleChart = async () => {
    await expect(page.locator('[data-chart-canvas]').first()).toBeVisible();
    await expect.poll(() => page.locator('[data-chart-canvas]').first().evaluate(el => Number(el.dataset.visibleCandleCount || 0) > 0 || !!el.querySelector('button'))).toBe(true);
  };
  await settleChart();
  timings.push({ workspace: 'dashboard', stage: 'startup', ms: Math.round(performance.now() - startup), chart: await page.locator('[data-chart-canvas]').first().evaluate(el => ({ candles: Number(el.dataset.visibleCandleCount || 0), reason: el.querySelector('[role=status]')?.textContent || null })) });
  const snapshot = async stage => {
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage'), dom = await cdp.send('Memory.getDOMCounters');
    const stats = await page.evaluate(() => ({ intervals: [...window.qaPerformance.intervals.values()].sort((a,b) => a-b), canvasCount: document.querySelectorAll('canvas').length, domNodes: document.querySelectorAll('*').length }));
    resources.push({ stage, heapBytes: heap.usedSize, ...dom, ...stats });
  };
  const navigate = async name => {
    const before = performance.now();
    if (name === 'Alerts') await page.getByRole('button', { name: 'Notifications and alerts' }).click();
    else await page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name, exact: true }).click();
    if(name === 'Order Flow') await expect(page.getByRole('toolbar', { name: 'Order flow toolbar' })).toBeVisible();
    else if(name === 'Dashboard') await settleChart();
    else await expect(page.locator('.ws-workspace')).toBeVisible();
    timings.push({ workspace:name, ms:Math.round(performance.now()-before) });
  };
  const tabs = ['Watchlist','Charts','Market Scanner','News & Calendar','Order Flow','Positions','Orders','Trade Journal','Performance','Risk Manager','Tools','Settings','Alerts','Dashboard'];
  for(let round=0;round<3;round++) {
    for(const name of tabs) await navigate(name);
    await snapshot(`dashboard-round-${round+1}`);
  }
  // Observe a real one-minute streaming session, then ensure its interval is removed.
  await navigate('Order Flow'); await snapshot('order-flow-start');
  await page.waitForTimeout(30000); await snapshot('order-flow-30s');
  await page.waitForTimeout(30000); await snapshot('order-flow-60s');
  await navigate('Dashboard'); await snapshot('dashboard-after-stream');
  const baseline = resources[0], final = resources.at(-1);
  assert.deepEqual(final.intervals, baseline.intervals, 'Intervals accumulated after leaving workspaces');
  assert.equal(final.canvasCount, baseline.canvasCount, 'Canvas count accumulated');
  assert.ok(final.domNodes <= baseline.domNodes + 100, 'Dashboard DOM accumulated');
  record('Three complete workspace cycles and one-minute Order Flow session release interval/canvas resources');
  assert.deepEqual(errors, []); assert.deepEqual(executions, []); record('No runtime errors or order execution requests');
  await page.screenshot({ path: 'artifacts/deployment/performance/dashboard-settled.png' });
  const longTasks = await page.evaluate(() => window.qaPerformance.longTasks);
  await fs.writeFile('artifacts/deployment/performance/measurements.json', JSON.stringify({ measuredAt:new Date().toISOString(), timings, resources, longTasks },null,2));
} finally {
  await browser?.close(); await client.auth.signOut();
  if (userId) { const removed = await admin.auth.admin.deleteUser(userId); assert.ifError(removed.error); record('Disposable performance account and workspace removed'); }
  await fs.mkdir('artifacts/deployment/performance', { recursive:true });
  await fs.writeFile('artifacts/deployment/performance/verification.json',JSON.stringify({checkedAt:new Date().toISOString(),checks,errors,executions},null,2));
}