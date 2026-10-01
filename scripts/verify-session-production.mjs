import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { getUsEquitySession, getNextUsEquityClose } from '../src/utils/marketSession.js';
const backend = 'https://sbcapitalco-backend-production.up.railway.app';
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, options);
const checks = [], errors = []; let browser, userId;
const record = value => { checks.push(value); console.log(`PASS ${value}`); };
try {
  const created = await admin.auth.admin.createUser({ email: `session-${crypto.randomUUID()}@example.com`, password: `Qa!${crypto.randomBytes(24).toString('hex')}`, email_confirm: true, app_metadata: { plan: 'premium', audit_fixture: true } });
  assert.ifError(created.error); userId = created.data.user.id;
  const saved = await admin.from('terminal_workspaces').insert({ user_id: userId, data: { activeWorkspace: 'dashboard', selectedStock: 'AAPL', layoutMode: '1', timeframe: '5m', timeZone: 'America/New_York', orders: [], positions: {}, realizedPnL: 0 } }); assert.ifError(saved.error);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: created.data.user.email }); assert.ifError(link.error);
  const auth = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'email' }); assert.ifError(auth.error);
  const headers = { Authorization: `Bearer ${auth.data.session.access_token}`, 'Content-Type': 'application/json' };
  const api = async command => {
    const response = await fetch(`${backend}/api/paper/${command ? 'commands' : 'account'}`, { headers, ...(command ? { method: 'POST', body: JSON.stringify({ command }) } : {}), signal: AbortSignal.timeout(20000) });
    return { status: response.status, ...await response.json() };
  };
  browser = await chromium.launch({ headless: true }); const context = await browser.newContext({ viewport: { width: 1536, height: 1024 } });
  await context.addInitScript(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('sb_public_onboarding_dismissed', 'true'); localStorage.setItem('sb_focused_terminal_workspace_v1', 'true');
  }, { key: `sb-${new URL(process.env.SUPABASE_URL).hostname.split('.')[0]}-auth-token`, session: auth.data.session });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.route(/\/api\/questrade\/(?:orders|submit|execute|cancel)/i, () => { throw new Error('Real execution forbidden in session verification'); });
  await page.goto('https://www.sbcapitalco.com');
  const current = getUsEquitySession(new Date());
  await expect(page.locator('.ws-market-status')).toContainText(current.status === 'OPEN' ? 'Market Open' : current.status === 'CLOSED' ? 'Market Closed' : current.status, { timeout: 30000 });
  await expect(page.getByRole('region', { name: 'Paper trade ticket', exact: true })).toContainText(current.isRegular ? 'Market open' : 'Session closed');
  await expect(page.locator('.ws-clock')).toContainText('ET'); record('Production market status, ticket and Eastern clock agree with the shared session calendar');
  const chart = page.getByRole('region', { name: 'Primary trading chart', exact: true });
  async function tooltip() {
    const canvas = chart.locator('canvas').first(); await expect(canvas).toBeVisible();
    await expect(chart.getByRole('button', { name: 'Retry chart data', exact: true })).toHaveCount(0);
    for (let attempt = 0; attempt < 10; attempt++) {
      const box = await canvas.boundingBox(); await page.mouse.move(box.x + box.width * (0.55 + attempt * 0.025), box.y + box.height * 0.45);
      if (await chart.locator('[data-chart-time]').isVisible()) return chart.locator('[data-chart-time]');
      await page.waitForTimeout(1000);
    }
    throw new Error('Provider chart history did not expose a candle tooltip.');
  }
  await expect(await tooltip()).toContainText(/E[DS]T/); record('Real provider candle tooltip renders Eastern time with the correct DST abbreviation');
  const navigate = async name => page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name, exact: true }).click();
  await navigate('Settings'); await page.getByLabel('Time zone', { exact: true }).selectOption('UTC');
  await expect.poll(async () => { const row = await admin.from('terminal_workspaces').select('data').eq('user_id', userId).single(); assert.ifError(row.error); return row.data.data.timeZone; }).toBe('UTC');
  await navigate('Dashboard'); await expect(await tooltip()).toContainText('UTC');
  await expect(page.locator('.ws-clock')).toContainText('ET'); record('Saved UTC preference changes real chart labels while keeping the session clock Eastern');
  const accepted = await api({ id: crypto.randomUUID(), kind: 'submit', draft: { symbol: 'AAPL', side: 'BUY', type: 'LIMIT', quantity: 1, limitPrice: 0.01, tif: 'DAY' } });
  assert.equal(accepted.status, 200); assert.equal(accepted.order.status, 'WORKING');
  assert.equal(accepted.order.expiresAt, getNextUsEquityClose(new Date(accepted.order.submittedAt)));
  assert.deepEqual(accepted.state.positions, {}); record('Production DAY order expiry matches the server calendar without a fabricated fill');
  const cancelled = await api({ id: crypto.randomUUID(), kind: 'cancel-all' }); assert.equal(cancelled.status, 200);
  assert.equal(cancelled.state.orders[0].status, 'CANCELLED'); assert.deepEqual(errors, []);
  await fs.mkdir('artifacts/deployment/session', { recursive: true }); await page.screenshot({ path: 'artifacts/deployment/session/dashboard.png' });
  record('Production cancellation and browser execution complete without runtime errors');
} finally {
  await browser?.close(); await client.auth.signOut();
  if (userId) { const removed = await admin.auth.admin.deleteUser(userId); assert.ifError(removed.error); record('Disposable session account and workspace removed'); }
  await fs.mkdir('artifacts/deployment/session', { recursive: true });
  await fs.writeFile('artifacts/deployment/session/verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, errors }, null, 2));
}
