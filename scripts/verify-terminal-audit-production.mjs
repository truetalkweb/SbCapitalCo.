import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

for (const key of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) assert.ok(process.env[key], `${key} required`);
const config = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, config);
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, config);
const checks = [], errors = [], executions = [];
const record = value => { checks.push(value); console.log(`PASS ${value}`); };
let userId, browser;
try {
  const created = await admin.auth.admin.createUser({ email: `terminal-audit-${crypto.randomUUID()}@example.com`, password: `Qa!${crypto.randomBytes(24).toString('hex')}`,
    email_confirm: true, app_metadata: { plan: 'premium', audit_fixture: true } });
  assert.ifError(created.error); userId = created.data.user.id;
  const saved = await admin.from('terminal_workspaces').insert({ user_id: userId, data: {
    activeWorkspace: 'journal', selectedStock: 'AAPL', layoutMode: '1', timeframe: '5m', positions: {}, orders: [],
    journalDraft: { recordType: 'trade', status: 'closed', symbol: 'AAPL', quantity: '10', entryPrice: '100', exitPrice: '120', fees: '2', pnl: 198, setup: 'Previous trade', review: 'Old review', bias: 'Short' },
    journalEntries: [{ id: 'csv-audit', symbol: 'AAPL', pnl: -40, setup: '=SUM(1,2)', review: '@SUM(A1:A2)', createdAt: new Date().toISOString() }],
    premiumPreferences: { watchlists: [{ id: 'main', name: 'Main', symbols: ['AAPL'] }, { id: 'other', name: 'Other', symbols: ['TSLA'] }], activeWatchlistId: 'missing-list' },
  } }); assert.ifError(saved.error);
  // Generate a disposable password session without sending mail or touching a real user's account.
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: created.data.user.email }); assert.ifError(link.error);
  const auth = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'email' }); assert.ifError(auth.error);
  const entitlement = await fetch('https://sbcapitalco-backend-production.up.railway.app/api/entitlements/me', { headers: { Authorization: `Bearer ${auth.data.session.access_token}` } });
  assert.equal(entitlement.status, 200); assert.equal((await entitlement.json()).plan, 'premium');
  const denied = await fetch('https://sbcapitalco-backend-production.up.railway.app/api/admin/monitoring', { headers: { Authorization: `Bearer ${auth.data.session.access_token}` } });
  assert.ok([402, 403].includes(denied.status)); record('Disposable premium audit account authenticates and cannot access Admin');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1536, height: 1024 } });
  await context.addInitScript(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('sb_public_onboarding_dismissed', 'true'); localStorage.setItem('sb_focused_terminal_workspace_v1', 'true');
  }, { key: `sb-${new URL(process.env.SUPABASE_URL).hostname.split('.')[0]}-auth-token`, session: auth.data.session });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.route(/\/api\/(?:paper\/commands|questrade\/(?:orders|submit|execute|cancel))/i, route => { executions.push(route.request().url()); return route.abort(); });
  await page.goto('https://www.sbcapitalco.com');
  await expect(page.getByLabel('Journal quantity', { exact: true })).toHaveValue('10', { timeout: 30000 });
  await page.getByRole('button', { name: 'Clear Draft', exact: true }).click();
  await expect(page.getByLabel('Journal record type', { exact: true })).toHaveValue('note');
  await page.getByLabel('Journal record type', { exact: true }).selectOption('trade');
  for (const label of ['quantity', 'entry price', 'exit price', 'total fees']) await expect(page.getByLabel(`Journal ${label}`, { exact: true })).toHaveValue('');
  await page.getByRole('tab', { name: 'Exports', exact: true }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Journal CSV', exact: true }).click();
  const stream = await (await download).createReadStream(); let csv = ''; for await (const chunk of stream) csv += chunk;
  assert.ok(csv.includes('"\'=SUM(1,2)"')); assert.ok(csv.includes('"\'@SUM(A1:A2)"')); assert.ok(csv.includes('"-40"'));
  record('Live Journal clears previous trade inputs and exports formula-like text without changing numeric P&L');
  const nav = page.getByRole('navigation', { name: 'Terminal workspaces' });
  await nav.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await expect(page.getByLabel('Active watchlist')).toHaveValue('main');
  await page.getByLabel('Watchlist symbol', { exact: true }).fill('NVDA');
  await page.getByRole('button', { name: 'Add Symbol', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove NVDA from watchlist', exact: true })).toBeVisible();
  await page.getByLabel('Active watchlist').selectOption('other');
  await expect(page.getByRole('button', { name: 'Remove NVDA from watchlist', exact: true })).toHaveCount(0);
  await page.getByLabel('Active watchlist').selectOption('main');
  record('Live Watchlist edits the visible fallback list and preserves the other collection');
  await fs.mkdir('artifacts/deployment/terminal-audit', { recursive: true });
  const tabs = ['Dashboard', 'Watchlist', 'Charts', 'Market Scanner', 'News & Calendar', 'Order Flow', 'Positions', 'Orders', 'Trade Journal', 'Performance', 'Risk Manager', 'Tools', 'Settings'];
  for (const theme of ['dark', 'light']) {
    await nav.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('tab', { name: 'General', exact: true }).click();
    await page.getByLabel('Theme', { exact: true }).selectOption(theme);
    for (const tab of tabs) {
      await nav.getByRole('button', { name: tab, exact: true }).click();
      await expect(nav.getByRole('button', { name: tab, exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(page.getByRole('heading', { name: 'Upgrade required', exact: true })).toHaveCount(0);
      await expect(page.getByText('Workspace unavailable', { exact: true })).toHaveCount(0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${tab} ${theme} horizontal overflow`);
    }
    await page.getByRole('button', { name: 'Notifications and alerts', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeVisible();
    record(`All 14 live workspaces render in ${theme} theme without horizontal overflow`);
    await page.screenshot({ path: `artifacts/deployment/terminal-audit/alerts-${theme}.png` });
  }
  assert.deepEqual(errors, []); assert.deepEqual(executions, []); record('No browser runtime errors or paper/broker execution requests');
} finally {
  await browser?.close(); await client.auth.signOut();
  if (userId) { const deleted = await admin.auth.admin.deleteUser(userId); assert.ifError(deleted.error); record('Disposable audit account and workspace removed'); }
  await fs.mkdir('artifacts/deployment/terminal-audit', { recursive: true });
  await fs.writeFile('artifacts/deployment/terminal-audit/verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, errors, executions }, null, 2));
}
