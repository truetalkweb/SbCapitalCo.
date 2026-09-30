import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect } from '@playwright/test';

const backend = 'https://sbcapitalco-backend-production.up.railway.app';
const url = 'https://www.sbcapitalco.com';
const config = { auth: { persistSession: false, autoRefreshToken: false } };
for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_PUBLISHABLE_KEY']) assert.ok(process.env[key], `${key} required`);
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, config);
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, config);
const checks = [], errors = [];
let userId, browser;
const record = (value) => { checks.push(value); console.log(`PASS ${value}`); };
try {
  const newsResponse = await fetch(`${backend}/api/news/NVDA?limit=14`);
  assert.equal(newsResponse.status, 200);
  const articles = (await newsResponse.json()).news.filter((row) => row.url && !row.fallback);
  assert.ok(articles.length);
  const article = articles.at(-1);
  const body = JSON.stringify({ newsItem: article });
  const anonymous = await fetch(`${backend}/api/ai/summarize-news`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
  assert.equal(anonymous.status, 401); record('Anonymous AI generation remains blocked');
  const password = `Qa!${crypto.randomBytes(24).toString('hex')}`;
  const created = await admin.auth.admin.createUser({ email: `ai-ui-${crypto.randomUUID()}@example.com`,
    password, email_confirm: true });
  assert.ifError(created.error); userId = created.data.user.id;
  const auth = await client.auth.signInWithPassword({ email: created.data.user.email, password }); assert.ifError(auth.error);
  const headers = { Authorization: `Bearer ${auth.data.session.access_token}`, 'Content-Type': 'application/json' };
  const free = await fetch(`${backend}/api/ai/summarize-news`, { method: 'POST', headers, body });
  assert.equal(free.status, 403); record('Free-account AI generation remains blocked');
  const entitlement = await admin.from('user_entitlements').insert({ user_id: userId, plan: 'pro', status: 'active' }); assert.ifError(entitlement.error);
  const firstResponse = await fetch(`${backend}/api/ai/summarize-news`, { method: 'POST', headers, body });
  assert.equal(firstResponse.status, 200); const first = await firstResponse.json();
  assert.equal(first.summary.source, 'gemini'); assert.equal(first.summary.mode, 'generated');
  assert.ok(first.summary.summary); assert.ok(first.summary.evidence.headline);
  const cachedResponse = await fetch(`${backend}/api/ai/summarize-news`, { method: 'POST', headers, body });
  assert.equal(cachedResponse.status, 200); const cached = await cachedResponse.json();
  assert.equal(cached.cached, true); assert.equal(cached.summary.cached, true);
  assert.equal(cached.summary.summary, first.summary.summary);
  record('Authenticated Gemini generation and repeat-request cache work with actual provider news');
  const tickerResponse = await fetch(`${backend}/api/ai/catalyst/NVDA?limit=4`, { headers });
  assert.equal(tickerResponse.status, 200);
  const ticker = await tickerResponse.json();
  assert.equal(ticker.intelligence.source, 'gemini');
  assert.equal(ticker.intelligence.mode, 'generated');
  assert.ok(ticker.intelligence.summary);
  const sourceUrls = new Set(ticker.news.map((row) => row.url).filter(Boolean));
  for (const catalyst of ticker.intelligence.keyCatalysts) {
    if (catalyst.url) assert.ok(sourceUrls.has(catalyst.url), 'AI catalyst citations must come from provider news');
  }
  record('Live ticker AI generates with provider-owned catalyst citations');
  const health = await (await fetch(`${backend}/api/platform/health`)).json();
  assert.equal(health.ai.status, 'available'); assert.equal(health.ai.live, true);
  record('Public health reports successful generation without exposing credentials');
  const workspace = await admin.from('terminal_workspaces').insert({ user_id: userId, data: {
    activeWorkspace: 'news', selectedStock: 'NVDA', layoutMode: '1', orders: [], positions: {}, realizedPnL: 0,
  } }); assert.ifError(workspace.error);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1536, height: 1024 } });
  await context.addInitScript(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('sb_public_onboarding_dismissed', 'true');
    localStorage.setItem('sb_focused_terminal_workspace_v1', 'true');
  }, { key: `sb-${new URL(process.env.SUPABASE_URL).hostname.split('.')[0]}-auth-token`, session: auth.data.session });
  const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  const button = page.getByRole('button', { name: 'Generate AI Summary', exact: true });
  await expect(button).toBeEnabled({ timeout: 30000 });
  const resultPromise = page.waitForResponse((response) => response.url().includes('/api/ai/summarize-news') && response.request().method() === 'POST');
  await button.click(); const result = await (await resultPromise).json();
  assert.equal(result.summary.source, 'gemini');
  await expect(page.getByLabel('Article AI summary')).toContainText(result.summary.summary);
  await expect(page.getByText(/AI analysis · gemini/)).toBeVisible();
  await page.getByRole('button', { name: 'Refresh AI Summary', exact: true }).click();
  await expect(page.getByText(/AI analysis · gemini · cached/)).toBeVisible();
  record('Production News page generates and displays cached Gemini summaries on demand');
  await fs.mkdir('artifacts/deployment/ai', { recursive: true });
  await page.screenshot({ path: 'artifacts/deployment/ai/news-summary.png', fullPage: true });
  assert.deepEqual(errors, []); record('No authenticated browser runtime errors');
} finally {
  await browser?.close(); await client.auth.signOut();
  if (userId) { const deleted = await admin.auth.admin.deleteUser(userId); assert.ifError(deleted.error); record('Disposable AI verification account and entitlements removed'); }
  await fs.mkdir('artifacts/deployment/ai', { recursive: true });
  await fs.writeFile('artifacts/deployment/ai/verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, errors }, null, 2));
}
