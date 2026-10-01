import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
const backend = 'https://sbcapitalco-backend-production.up.railway.app';
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, options);
const checks = [], errors = [], ids = [];
const record = value => { checks.push(value); console.log(`PASS ${value}`); };
let userId, browser;
try {
  const created = await admin.auth.admin.createUser({ email: `reliability-${crypto.randomUUID()}@example.com`, password: `Qa!${crypto.randomBytes(24).toString('hex')}`, email_confirm: true });
  assert.ifError(created.error); userId = created.data.user.id;
  const saved = await admin.from('terminal_workspaces').insert({ user_id: userId, data: { activeWorkspace: 'dashboard', selectedStock: 'AAPL', layoutMode: '1', timeframe: '5m', orders: [], positions: {}, realizedPnL: 0 } }); assert.ifError(saved.error);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: created.data.user.email }); assert.ifError(link.error);
  const auth = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'email' }); assert.ifError(auth.error);
  const session = auth.data.session;
  const headers = { Authorization: `Bearer ${session.access_token}` };
  async function account() { const response = await fetch(`${backend}/api/paper/account`, { headers }); assert.equal(response.status, 200); return response.json(); }
  browser = await chromium.launch({ headless: true });
  async function device() {
    const context = await browser.newContext({ viewport: { width: 1536, height: 1024 } });
    await context.addInitScript(({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('sb_public_onboarding_dismissed', 'true'); localStorage.setItem('sb_focused_terminal_workspace_v1', 'true');
    }, { key: `sb-${new URL(process.env.SUPABASE_URL).hostname.split('.')[0]}-auth-token`, session });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.route(/\/api\/questrade\/(?:orders|submit|execute|cancel)/i, () => { throw new Error('Real execution forbidden in reliability verification'); });
    await page.goto('https://www.sbcapitalco.com');
    await expect(page.getByRole('region', { name: 'Paper trade ticket', exact: true }).getByRole('button', { name: 'Place Paper Buy', exact: true })).toBeEnabled({ timeout: 30000 });
    return page;
  }
  const page = await device(); let drop = true;
  await page.route('**/api/paper/commands', async route => {
    ids.push(route.request().postDataJSON().command.id);
    if (!drop) return route.continue();
    drop = false; const response = await route.fetch(); assert.equal(response.status(), 200);
    await route.abort('connectionreset');
  });
  const ticket = page.getByRole('region', { name: 'Paper trade ticket', exact: true });
  async function draft() {
    await expect(ticket.getByRole('button', { name: 'Place Paper Buy', exact: true })).toBeEnabled({ timeout: 30000 });
    await ticket.getByLabel('Paper order type').selectOption('LIMIT'); await ticket.getByLabel('Paper quantity').fill('1');
    await ticket.getByLabel('Limit price', { exact: true }).fill('0.01');
    await ticket.locator('summary').click(); await ticket.getByLabel('Paper duration').selectOption('GTC');
  }
  // A one-share penny limit uses real provider data and normally remains working,
  // including outside the session. No artificial quote or market fill is required.
  await draft(); await ticket.getByRole('button', { name: 'Place Paper Buy', exact: true }).click();
  await expect(ticket.getByRole('status')).toContainText('Response not confirmed');
  let snapshot = await account(); assert.equal(snapshot.state.orders.length, 1); assert.equal(snapshot.state.orders[0].status, 'WORKING');
  record('Live paper order commits even when its browser response is intentionally dropped');
  await page.reload(); await draft();
  await ticket.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  await expect(ticket.getByRole('status')).toContainText('WORKING');
  snapshot = await account(); assert.equal(snapshot.state.orders.length, 1); assert.equal(ids.length, 2); assert.equal(ids[0], ids[1]);
  record('Reload and rapid retry preserve the original command ID and one persisted order');
  const second = await device();
  await second.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name: 'Orders', exact: true }).click();
  await expect(second.getByRole('button', { name: 'Cancel all orders', exact: true })).toBeEnabled({ timeout: 30000 });
  await second.getByRole('button', { name: 'Cancel all orders', exact: true }).click();
  await second.getByRole('button', { name: 'Confirm paper action', exact: true }).click();
  await expect.poll(async () => (await account()).state.orders[0].status).toBe('CANCELLED');
  await expect(ticket.getByRole('status')).toContainText('CANCELLED', { timeout: 15000 });
  record('Independent browser device cancels the order and the original tab refreshes');
  assert.deepEqual(errors, []); assert.deepEqual((await account()).state.positions, {});
  record('No browser runtime errors, invented fills or open paper positions');
  await fs.mkdir('artifacts/deployment/reliability', { recursive: true });
  await page.screenshot({ path: 'artifacts/deployment/reliability/recovered-order.png' });
} finally {
  await browser?.close(); await client.auth.signOut();
  if (userId) { const removed = await admin.auth.admin.deleteUser(userId); assert.ifError(removed.error); record('Disposable reliability account and workspace removed'); }
  await fs.mkdir('artifacts/deployment/reliability', { recursive: true });
  await fs.writeFile('artifacts/deployment/reliability/verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, errors }, null, 2));
}
