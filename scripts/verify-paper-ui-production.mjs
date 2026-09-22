import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect } from '@playwright/test';
const url = 'https://www.sbcapitalco.com';
const backend = 'https://sbcapitalco-backend-production.up.railway.app';
const config = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, config);
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, config);
const email = `paper-ui-${crypto.randomUUID()}@example.com`, password = `Qa!${crypto.randomBytes(24).toString('hex')}`;
let userId, browser;
const errors = [], checks = [];
const record = value => { checks.push(value); console.log(`PASS ${value}`); };
async function main() {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(created.error);
  userId = created.data.user.id;
  const saved = await admin.from('terminal_workspaces').insert({ user_id: userId, data: { activeWorkspace: 'dashboard', selectedStock: 'AAPL', layoutMode: '1', timeframe: '5m', orders: [], positions: {}, realizedPnL: 0 } }); assert.ifError(saved.error);
  const auth = await client.auth.signInWithPassword({ email, password }); assert.ifError(auth.error);
  const session = auth.data.session;
  const storageKey = `sb-${new URL(process.env.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  browser = await chromium.launch({ headless: true });
  async function device() {
    const context = await browser.newContext({ viewport: { width: 1536, height: 1024 } });
    await context.addInitScript(({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('sb_public_onboarding_dismissed', 'true'); localStorage.setItem('sb_focused_terminal_workspace_v1', 'true');
    }, { key: storageKey, session });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(url); return page;
  }
  async function account() {
    const response = await fetch(`${backend}/api/paper/account`, { headers: { Authorization: `Bearer ${session.access_token}` } });
    assert.equal(response.status, 200); return response.json();
  }
  const first = await device();
  const ticket = first.getByRole('region', { name: 'Paper trade ticket', exact: true });
  await expect(ticket).toContainText('Server execution continues', { timeout: 30000 });
  await expect(ticket.getByRole('button', { name: 'Place Paper Buy', exact: true })).toBeEnabled({ timeout: 30000 });
  await ticket.getByLabel('Paper order type').selectOption('MARKET'); await ticket.getByLabel('Paper quantity').fill('1');
  await ticket.getByRole('button', { name: 'Place Paper Buy', exact: true }).click();
  await expect.poll(async () => (await account()).state.positions.AAPL?.quantity, { timeout: 30000 }).toBe(1);
  await expect(ticket.getByRole('status')).toContainText('FILLED'); record('Live dashboard submits and displays a provider-backed paper fill');
  await fs.mkdir('artifacts/deployment/server-paper', { recursive: true });
  await first.screenshot({ path: 'artifacts/deployment/server-paper/dashboard-filled.png' });
  const second = await device();
  await second.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name: 'Orders', exact: true }).click();
  await expect(second.getByRole('button', { name: 'Close AAPL', exact: true })).toBeEnabled({ timeout: 30000 });
  await second.getByRole('button', { name: 'Close AAPL', exact: true }).click();
  await second.getByRole('button', { name: 'Confirm paper action', exact: true }).click();
  await expect.poll(async () => Object.keys((await account()).state.positions), { timeout: 30000 }).toEqual([]);
  await expect(first.getByRole('region', { name: 'Portfolio records' })).toContainText('No workspace positions.', { timeout: 15000 });
  record('Second device closes the holding and the first device refreshes automatically');
  await first.getByRole('tab', { name: 'Executions', exact: true }).click();
  await expect(first.getByRole('table', { name: 'Paper executions' })).toContainText('Questrade');
  await first.getByRole('tab', { name: 'Day Trade Log', exact: true }).click();
  await expect(first.getByRole('table', { name: 'Paper realized exits' })).toContainText('AAPL');
  await first.screenshot({ path: 'artifacts/deployment/server-paper/dashboard-history.png' });
  record('Live execution and realized-history panels display retained paper records');
  assert.deepEqual(errors, []); record('No browser runtime errors on either device');
}
try { await main(); }
finally {
  await browser?.close();
  if (userId) { const deleted = await admin.auth.admin.deleteUser(userId); assert.ifError(deleted.error); record('Disposable UI verification account and ledger removed'); }
  await fs.mkdir('artifacts/deployment/server-paper', { recursive: true });
  await fs.writeFile('artifacts/deployment/server-paper/ui-verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, errors }, null, 2));
}
