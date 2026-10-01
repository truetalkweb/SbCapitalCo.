import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
const backend = 'https://sbcapitalco-backend-production.up.railway.app';
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, options);
const checks = [], errors = [], commands = [];
const record = value => { checks.push(value); console.log(`PASS ${value}`); };
let userId, browser;
try {
  const created = await admin.auth.admin.createUser({ email: `paper-costs-${crypto.randomUUID()}@example.com`, password: `Qa!${crypto.randomBytes(24).toString('hex')}`, email_confirm: true, app_metadata: { plan: 'premium', audit_fixture: true } });
  assert.ifError(created.error); userId = created.data.user.id;
  const saved = await admin.from('terminal_workspaces').insert({ user_id: userId, data: { activeWorkspace: 'settings', selectedStock: 'AAPL', layoutMode: '1', timeframe: '5m', orders: [], positions: {}, realizedPnL: 0 } }); assert.ifError(saved.error);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: created.data.user.email }); assert.ifError(link.error);
  const auth = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'email' }); assert.ifError(auth.error);
  const headers = { Authorization: `Bearer ${auth.data.session.access_token}` };
  async function api(command) {
    const response = await fetch(`${backend}/api/paper/${command ? 'commands' : 'account'}`, { headers: { ...headers, ...(command ? { 'Content-Type': 'application/json' } : {}) }, ...(command ? { method: 'POST', body: JSON.stringify({ command }) } : {}), signal: AbortSignal.timeout(20000) });
    return { status: response.status, ...await response.json() };
  }
  async function preference(key) { const row = await admin.from('terminal_workspaces').select('data').eq('user_id', userId).single(); assert.ifError(row.error); return row.data.data.premiumPreferences?.paperCosts?.[key]; }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('sb_public_onboarding_dismissed', 'true'); localStorage.setItem('sb_focused_terminal_workspace_v1', 'true');
  }, { key: `sb-${new URL(process.env.SUPABASE_URL).hostname.split('.')[0]}-auth-token`, session: auth.data.session });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.route(/\/api\/questrade\/(?:orders|submit|execute|cancel)/i, () => { throw new Error('Real execution forbidden in paper-cost verification'); });
  await page.goto('https://www.sbcapitalco.com');
  await page.getByRole('tab', { name: 'Trading', exact: true }).click({ timeout: 30000 });
  await page.getByLabel('Commission per fill ($)', { exact: true }).fill('1');
  await page.getByLabel('Commission per share ($)', { exact: true }).fill('0.01');
  await page.getByLabel('Adverse slippage (bps)', { exact: true }).fill('10');
  await expect.poll(() => preference('slippageBps'), { timeout: 20000 }).toBe(10);
  await expect.poll(() => preference('commissionPerOrder')).toBe(1);
  await fs.mkdir('artifacts/deployment/paper-costs', { recursive: true });
  await page.screenshot({ path: 'artifacts/deployment/paper-costs/mobile-settings.png' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  record('Production cost settings persist in the owned workspace and fit mobile');
  await page.setViewportSize({ width: 1536, height: 1024 });
  const navigate = async name => page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name, exact: true }).click();
  await navigate('Dashboard');
  const ticket = page.getByRole('region', { name: 'Paper trade ticket', exact: true });
  async function draft() {
    await expect(ticket.getByRole('button', { name: 'Place Paper Buy', exact: true })).toBeEnabled({ timeout: 30000 });
    await ticket.getByLabel('Paper order type').selectOption('LIMIT'); await ticket.getByLabel('Paper quantity').fill('1');
    await ticket.getByLabel('Limit price', { exact: true }).fill('0.01');
    await ticket.locator('summary').click(); await ticket.getByLabel('Paper duration').selectOption('GTC');
  }
  let drop = true;
  await page.route('**/api/paper/commands', async route => {
    commands.push(route.request().postDataJSON().command);
    if (!drop) return route.continue();
    drop = false; const response = await route.fetch(); assert.equal(response.status(), 200); await route.abort('connectionreset');
  });
  // A penny limit remains unmarketable; production verification never injects quotes.
  await draft(); await ticket.getByRole('button', { name: 'Place Paper Buy', exact: true }).click();
  await expect(ticket.getByRole('status')).toContainText('Response not confirmed');
  let snapshot = await api(); assert.equal(snapshot.status, 200); assert.equal(snapshot.state.orders.length, 1);
  const original = snapshot.state.orders[0]; assert.equal(original.status, 'WORKING');
  assert.deepEqual(original.paperCosts, { commissionPerOrder: 1, commissionPerShare: 0.01, slippageBps: 10 });
  record('Deployed API freezes simulated costs without charging a waiting order');
  await navigate('Settings'); await page.getByRole('tab', { name: 'Trading', exact: true }).click();
  await page.getByLabel('Commission per fill ($)', { exact: true }).fill('2');
  await expect.poll(() => preference('commissionPerOrder')).toBe(2);
  await navigate('Dashboard');
  await expect.poll(async () => { const row = await admin.from('terminal_workspaces').select('data').eq('user_id', userId).single(); assert.ifError(row.error); return row.data.data.activeWorkspace; }, { timeout: 20000 }).toBe('dashboard');
  await page.reload(); await draft();
  await ticket.getByRole('button', { name: 'Place Paper Buy', exact: true }).click();
  await expect(ticket.getByRole('status')).toContainText('WORKING');
  snapshot = await api(); assert.equal(snapshot.state.orders.length, 1);
  assert.equal(commands.length, 2); assert.equal(commands[0].id, commands[1].id); assert.deepEqual(commands[0].paperCosts, commands[1].paperCosts);
  assert.equal(snapshot.state.realizedPnL, 0); assert.deepEqual(snapshot.state.positions, {});
  record('Unconfirmed order retry survives reload and preference changes without a duplicate or new fees');
  const invalid = await api({ id: crypto.randomUUID(), kind: 'submit', draft: { symbol: 'AAPL', side: 'BUY', type: 'LIMIT', limitPrice: 0.01, quantity: 1, tif: 'GTC' }, paperCosts: { slippageBps: 500 } });
  assert.equal(invalid.status, 422); assert.equal((await api()).state.orders.length, 1);
  record('Production rejects invalid cost settings without a new order');
  const editId = crypto.randomUUID();
  const edited = await api({ id: editId, kind: 'amend', orderId: original.id, changes: { quantity: 2, limitPrice: 0.02, paperCosts: {} } });
  assert.equal(edited.status, 200); assert.deepEqual(edited.order.paperCosts, original.paperCosts); assert.equal(edited.order.status, 'WORKING');
  record('Amendment retains the original cost model across the deployed server ledger');
  const cancelled = await api({ id: crypto.randomUUID(), kind: 'cancel-all' }); assert.equal(cancelled.status, 200);
  assert.ok(cancelled.state.orders.every(row => row.status === 'CANCELLED')); assert.equal(cancelled.state.realizedPnL, 0); assert.deepEqual(cancelled.state.positions, {});
  await expect(ticket.getByRole('status')).toContainText('CANCELLED', { timeout: 15000 });
  assert.deepEqual(errors, []); record('Cancellation charges no commission, leaves no position, and refreshes the browser without errors');
  await page.screenshot({ path: 'artifacts/deployment/paper-costs/dashboard.png' });
} finally {
  await browser?.close(); await client.auth.signOut();
  if (userId) { const removed = await admin.auth.admin.deleteUser(userId); assert.ifError(removed.error); record('Disposable QA user and workspace removed'); }
  await fs.mkdir('artifacts/deployment/paper-costs', { recursive: true });
  await fs.writeFile('artifacts/deployment/paper-costs/verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, errors }, null, 2));
}
