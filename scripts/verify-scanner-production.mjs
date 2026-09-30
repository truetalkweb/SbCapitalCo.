import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect } from '@playwright/test';

const url = 'https://www.sbcapitalco.com';
const backend = 'https://sbcapitalco-backend-production.up.railway.app';
const config = { auth: { persistSession: false, autoRefreshToken: false } };
for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_PUBLISHABLE_KEY']) assert.ok(process.env[key], `${key} required`);
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, config);
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, config);
const checks = [], errors = [];
let userId, browser;
const record = (value) => { checks.push(value); console.log(`PASS ${value}`); };
try {
  let scanner;
  const hasConfiguredQuotes = (payload) => ['AAPL', 'NVDA', 'TSLA', 'MSFT']
    .some((symbol) => payload.movers?.some((row) => row.symbol === symbol));
  await expect.poll(async () => {
    const response = await fetch(`${backend}/api/scanner`);
    assert.equal(response.status, 200);
    scanner = await response.json();
    return hasConfiguredQuotes(scanner);
  }, { timeout: 45000, intervals: [3000] }).toBe(true);
  assert.equal(scanner.contractVersion, 'scanner-v2');
  assert.ok(scanner.verifiedMovers.length > 0, 'Live deployment must return verified provider rows');
  assert.equal(scanner.contextMovers.length, 0);
  assert.equal(new Set(scanner.movers.map((row) => row.symbol)).size, scanner.movers.length);
  for (const [key, count] of Object.entries(scanner.counts)) assert.equal(scanner[key].length, count, key);
  for (const row of scanner.movers) {
    assert.equal(row.isSynthetic, false);
    assert.equal(row.isFallback, false);
    assert.equal(row.verified, true);
    assert.ok(row.price > 0 && row.volume >= 1000);
    if (!row.providerTimestamp) assert.notEqual(row.freshness, 'live');
    if (row.previousClose > 0) assert.ok(Math.abs((row.price / row.previousClose - 1) * 100 - row.changePercent) < 0.02);
    if (row.avgVolume > 0) assert.ok(Math.abs(row.volume / row.avgVolume - row.relativeVolume) < 0.02);
  }
  record('Live scanner returns unique verified rows, consistent counts and provider-derived daily movement');
  record('Configured-symbol quote fallback supplies actual provider rows');
  const email = `scanner-ui-${crypto.randomUUID()}@example.com`;
  const password = `Qa!${crypto.randomBytes(24).toString('hex')}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(created.error);
  userId = created.data.user.id;
  const saved = await admin.from('terminal_workspaces').insert({ user_id: userId, data: {
    activeWorkspace: 'scanner', selectedStock: scanner.gainers[0]?.symbol || scanner.movers[0].symbol,
    layoutMode: '1', orders: [], positions: {}, realizedPnL: 0,
  } }); assert.ifError(saved.error);
  const auth = await client.auth.signInWithPassword({ email, password }); assert.ifError(auth.error);
  const key = `sb-${new URL(process.env.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1536, height: 1024 } });
  await context.addInitScript(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session));
    localStorage.setItem('sb_public_onboarding_dismissed', 'true');
    localStorage.setItem('sb_focused_terminal_workspace_v1', 'true');
  }, { key, session: auth.data.session });
  const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  const workspace = page.locator('.ws-workspace[data-workspace="scanner"]');
  await expect(workspace).toBeVisible({ timeout: 30000 });
  await page.getByLabel('Minimum relative volume').selectOption('0');
  await expect(workspace).toContainText(scanner.coverageLabel, { timeout: 30000 });
  await expect(workspace).toContainText('Verified provider');
  assert.ok(await workspace.getByRole('row').count() > 1, 'Scanner table has provider rows');
  const highRvol = scanner.gainers.find((row) => row.relativeVolume > 25);
  if (highRvol) {
    await expect(workspace.getByRole('row', { name: `Select ${highRvol.symbol}`, exact: true }))
      .toContainText(`${highRvol.relativeVolume.toFixed(1)}x`);
    record('Production table preserves large RVOL ratios');
  }
  await fs.mkdir('artifacts/deployment/scanner', { recursive: true });
  await page.screenshot({ path: 'artifacts/deployment/scanner/gainers.png', fullPage: true });
  record('Authenticated production scanner displays verified provider evidence and coverage disclosure');
  await page.getByRole('tab', { name: 'Losers', exact: true }).click();
  if (scanner.losers.length) await expect(workspace).toContainText(scanner.losers[0].symbol);
  if (scanner.premarket.length === 0) {
    await page.getByRole('tab', { name: 'Premarket', exact: true }).click();
    await expect(workspace).toContainText('Results: 0');
    await expect(workspace.getByRole('row')).toHaveCount(1);
    await page.screenshot({ path: 'artifacts/deployment/scanner/empty-premarket.png', fullPage: true });
    record('Empty production category stays empty without substitute prices');
  }
  assert.deepEqual(errors, []); record('No authenticated production browser runtime errors');
} finally {
  await browser?.close();
  await client.auth.signOut();
  if (userId) {
    const deleted = await admin.auth.admin.deleteUser(userId); assert.ifError(deleted.error);
    record('Disposable scanner verification account removed');
  }
  await fs.mkdir('artifacts/deployment/scanner', { recursive: true });
  await fs.writeFile('artifacts/deployment/scanner/verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, errors }, null, 2));
}
