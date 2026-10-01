import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, options);
const checks = [], errors = [], executions = [];
const record = text => { checks.push(text); console.log(`PASS ${text}`); };
let userId, browser;
try {
  const created = await admin.auth.admin.createUser({ email: `mobile-${crypto.randomUUID()}@example.com`, password: `Qa!${crypto.randomBytes(24).toString('hex')}`, email_confirm: true, app_metadata: { plan: 'premium', audit_fixture: true } });
  assert.ifError(created.error); userId = created.data.user.id;
  const saved = await admin.from('terminal_workspaces').insert({ user_id: userId, data: { activeWorkspace: 'dashboard', selectedStock: 'AAPL', layoutMode: '1', timeframe: '5m', positions: {}, orders: [] } }); assert.ifError(saved.error);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: created.data.user.email }); assert.ifError(link.error);
  const auth = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'email' }); assert.ifError(auth.error);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await context.addInitScript(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('sb_public_onboarding_dismissed','true'); localStorage.setItem('sb_focused_terminal_workspace_v1','true');
  }, { key: `sb-${new URL(process.env.SUPABASE_URL).hostname.split('.')[0]}-auth-token`, session: auth.data.session });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.route(/\/api\/(?:paper\/commands|questrade\/(?:orders|submit|execute|cancel))/i, route => { executions.push(route.request().url()); return route.abort(); });
  await page.goto('https://www.sbcapitalco.com');
  await expect(page.getByRole('region', { name: 'Paper trade ticket', exact: true }).getByRole('button', { name: 'Place Paper Buy', exact: true })).toBeEnabled({ timeout: 30000 });
  await fs.mkdir('artifacts/deployment/mobile', { recursive: true });
  for (const width of [320,390,768]) {
    await page.setViewportSize({ width, height: 844 });
    const navigate = async name => {
      if (width <= 700) await page.getByRole('button', { name: 'Open workspace navigation' }).click();
      await page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name, exact: true }).click();
    };
    for (const theme of ['dark','light']) {
      await navigate('Settings'); await page.getByRole('tab', { name: 'General', exact: true }).click();
      await page.getByLabel('Theme', { exact: true }).selectOption(theme);
      for (const name of ['Dashboard','Watchlist','Charts','Market Scanner','News & Calendar','Order Flow','Positions','Orders','Trade Journal','Performance','Risk Manager','Tools','Settings']) {
        await navigate(name);
        if (name === 'Order Flow') {
          await expect(page.getByRole('toolbar', { name: 'Order flow toolbar' })).toBeVisible();
          const rect = await page.getByRole('region', { name: 'Simulated DOM ladder' }).boundingBox(); assert.ok(rect.width <= width && rect.height >= 200);
        } else if (name === 'Dashboard') {
          const rect = await page.getByRole('region', { name: 'Paper trade ticket', exact: true }).boundingBox();
          assert.ok(rect.width > (width <= 700 ? width - 50 : 200));
          if (width === 390) await page.screenshot({ path: `artifacts/deployment/mobile/dashboard-${theme}.png` });
        } else await expect(page.locator('.ws-workspace')).toBeVisible();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} ${width} ${theme} overflow`);
      }
      await page.getByRole('button', { name: 'Notifications and alerts' }).click();
      await expect(page.getByRole('heading', { name: 'Alerts', level: 1, exact: true })).toBeVisible();
      record(`All 14 live workspaces usable at ${width}px ${theme} with no page overflow`);
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(executions, []); record('No browser runtime errors or execution requests');
} finally {
  await browser?.close(); await client.auth.signOut();
  if (userId) { const removed = await admin.auth.admin.deleteUser(userId); assert.ifError(removed.error); record('Disposable mobile account and workspace removed'); }
  await fs.mkdir('artifacts/deployment/mobile', { recursive: true });
  await fs.writeFile('artifacts/deployment/mobile/verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, errors, executions }, null, 2));
}
