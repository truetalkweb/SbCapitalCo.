import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect } from '@playwright/test';
const config = { auth: { persistSession: false, autoRefreshToken: false } };
for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_PUBLISHABLE_KEY']) assert.ok(process.env[key], `${key} required`);
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, config);
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, config);
const checks = [], errors = [], executions = [];
let userId, browser;
const record = value => { checks.push(value); console.log(`PASS ${value}`); };
try {
  const email = `orderflow-ui-${crypto.randomUUID()}@example.com`, password = `Qa!${crypto.randomBytes(24).toString('hex')}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(created.error); userId = created.data.user.id;
  const saved = await admin.from('terminal_workspaces').insert({ user_id: userId, data: { activeWorkspace: 'order-flow', selectedStock: 'NVDA', layoutMode: '1', orders: [], positions: {} } }); assert.ifError(saved.error);
  const auth = await client.auth.signInWithPassword({ email, password }); assert.ifError(auth.error);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.addInitScript(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('sb_public_onboarding_dismissed', 'true'); localStorage.setItem('sb_focused_terminal_workspace_v1', 'true');
  }, { key: `sb-${new URL(process.env.SUPABASE_URL).hostname.split('.')[0]}-auth-token`, session: auth.data.session });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  // This check must never submit paper or broker commands, even if a UI regression introduces one.
  await page.route(/\/api\/(?:paper\/commands|questrade\/(?:orders|submit|execute|cancel))/i, route => { executions.push(route.request().url()); return route.abort(); });
  await page.goto('https://www.sbcapitalco.com');
  await expect(page.getByRole('toolbar', { name: 'Order flow toolbar' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('SIMULATED DATA', { exact: true })).toBeVisible();
  const chart = page.getByRole('region', { name: 'Footprint workspace' });
  const initial = await chart.locator('footer').innerText();
  await expect.poll(() => chart.locator('footer').innerText()).not.toBe(initial);
  await page.getByRole('button', { name: 'Pause simulated stream', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Simulated DOM ladder' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Simulated Time and Sales' })).toBeVisible();
  record('Authenticated free account renders the dynamic simulated footprint, DOM and tape');
  await page.getByRole('button', { name: 'Order flow settings', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Imbalance ratio', exact: true }).fill('4');
  await page.getByRole('button', { name: 'Close order flow settings', exact: true }).click();
  record('Production settings drawer applies analytics changes');
  await page.getByLabel('Order flow mode', { exact: true }).selectOption('replay');
  await page.getByRole('slider', { name: 'Order flow replay position' }).fill('100');
  await expect(chart).toContainText('101 trades');
  await page.getByRole('button', { name: 'Step trade', exact: true }).click();
  await expect(chart).toContainText('102 trades');
  record('Production replay uses only trades and book snapshots up to its cursor');
  await page.getByRole('button', { name: 'Reset order flow workspace', exact: true }).click();
  await page.getByLabel('Order flow symbol', { exact: true }).selectOption('NQ');
  await expect(chart).toContainText('SIMULATED NQ');
  await page.getByRole('button', { name: 'Pause simulated stream', exact: true }).click();
  await fs.mkdir('artifacts/deployment/order-flow', { recursive: true });
  await page.screenshot({ path: 'artifacts/deployment/order-flow/workspace.png', fullPage: true });
  record('Instrument switching and workspace reset work in production');
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Order book', exact: true })).toBeVisible();
  assert.deepEqual(executions, []); assert.deepEqual(errors, []);
  record('Dashboard remains available; no runtime errors or execution requests');
} finally {
  await browser?.close(); await client.auth.signOut();
  if (userId) { const deleted = await admin.auth.admin.deleteUser(userId); assert.ifError(deleted.error); record('Disposable verification account and workspace removed'); }
  await fs.mkdir('artifacts/deployment/order-flow', { recursive: true });
  await fs.writeFile('artifacts/deployment/order-flow/verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, errors, executions }, null, 2));
}
