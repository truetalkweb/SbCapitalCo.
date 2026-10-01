import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

for (const key of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) assert.ok(process.env[key], `${key} required`);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, options);
const checks = [], errors = [], mutations = [];
const record = text => { checks.push(text); console.log(`PASS ${text}`); };
let userId, browser;
try {
  const created = await admin.auth.admin.createUser({ email: `keyboard-${crypto.randomUUID()}@example.com`, password: `Qa!${crypto.randomBytes(24).toString('hex')}`, email_confirm: true, app_metadata: { plan: 'premium', audit_fixture: true } });
  assert.ifError(created.error); userId = created.data.user.id;
  const saved = await admin.from('terminal_workspaces').insert({ user_id: userId, data: { activeWorkspace: 'dashboard', selectedStock: 'AAPL', layoutMode: '1', timeframe: '5m', positions: {}, orders: [] } }); assert.ifError(saved.error);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: created.data.user.email }); assert.ifError(link.error);
  const auth = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'email' }); assert.ifError(auth.error);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('sb_public_onboarding_dismissed', 'true'); localStorage.setItem('sb_focused_terminal_workspace_v1', 'true');
  }, { key: `sb-${new URL(process.env.SUPABASE_URL).hostname.split('.')[0]}-auth-token`, session: auth.data.session });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.route(/\/api\/(?:paper\/commands|issues|questrade\/(?:orders|submit|execute|cancel))/i, route => { mutations.push(route.request().url()); return route.abort(); });
  await page.goto('https://www.sbcapitalco.com');
  await expect(page.getByRole('region', { name: 'Paper trade ticket', exact: true }).getByRole('button', { name: 'Place Paper Buy', exact: true })).toBeEnabled({ timeout: 30000 });
  await fs.mkdir('artifacts/deployment/keyboard', { recursive: true });
  for (const width of [390, 1536]) {
    await page.setViewportSize({ width, height: 900 });
    if (width <= 700) await page.getByRole('button', { name: 'Open workspace navigation' }).click();
    await page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('tab', { name: 'General', exact: true }).click();
    const opener = page.getByRole('button', { name: 'Report Issue', exact: true }); await opener.click();
    const report = page.getByRole('dialog', { name: 'Report an issue', exact: true });
    await expect(report.getByLabel('Description', { exact: true })).toBeFocused();
    await report.getByRole('button', { name: 'Send report', exact: true }).focus(); await page.keyboard.press('Tab');
    await expect(report.getByRole('button', { name: 'Close issue report' })).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(report.getByRole('button', { name: 'Send report', exact: true })).toBeFocused();
    await page.screenshot({ path: `artifacts/deployment/keyboard/report-${width}.png` });
    await page.keyboard.press('Escape'); await expect(opener).toBeFocused();
    const help = page.getByRole('button', { name: 'Help, Terms & Privacy', exact: true }); await help.click();
    await expect(page.locator('[role=dialog] [role=tab][aria-selected=true]')).toBeFocused();
    await page.keyboard.press('ArrowRight'); await expect(page.locator('[role=dialog] [role=tab][aria-selected=true]')).toBeFocused();
    await page.keyboard.press('Escape'); await expect(help).toBeFocused();
    const account = page.getByRole('button', { name: 'Account menu', exact: true });
    await account.click(); await page.getByRole('button', { name: 'Help & shortcuts', exact: true }).click();
    await page.getByRole('tab', { name: 'Support', exact: true }).click();
    await page.getByRole('button', { name: 'Report an issue', exact: true }).click();
    await expect(report.getByLabel('Description', { exact: true })).toBeFocused();
    await page.keyboard.press('Escape'); await expect(account).toBeFocused();
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Command palette', exact: true });
    await expect(palette.getByLabel('Search commands')).toBeFocused();
    await palette.getByLabel('Search commands').fill('Go to');
    await palette.getByRole('button', { name: 'Go to Watchlist Switch workspace Workspace', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Watchlist', level: 1, exact: true })).toBeVisible();
    await expect(account).toBeFocused();
    await page.keyboard.press('Control+k'); await expect(palette).toBeVisible();
    await palette.getByRole('button').last().focus(); await page.keyboard.press('Tab');
    await expect(palette.getByLabel('Search commands')).toBeFocused();
    await page.keyboard.press('Escape'); await expect(account).toBeFocused();
    record(`Live dialogs contain focus, dismiss, restore and activate the focused command at ${width}px`);
  }
  assert.deepEqual(errors, []); assert.deepEqual(mutations, []); record('No browser runtime errors, order execution or issue report submissions');
} finally {
  await browser?.close(); await client.auth.signOut();
  if (userId) { const removed = await admin.auth.admin.deleteUser(userId); assert.ifError(removed.error); record('Disposable keyboard account and workspace removed'); }
  await fs.mkdir('artifacts/deployment/keyboard', { recursive: true });
  await fs.writeFile('artifacts/deployment/keyboard/verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, errors, mutations }, null, 2));
}
