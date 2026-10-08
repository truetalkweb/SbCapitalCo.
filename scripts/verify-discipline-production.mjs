import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { getNyDateParts } from '../src/utils/marketSession.js';
const backend = 'https://sbcapitalco-backend-production.up.railway.app';
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, options);
const checks = [], errors = []; let browser, userId, headers;
const record = value => { checks.push(value); console.log(`PASS ${value}`); };
async function api(module, command, extra = {}) {
  const response = await fetch(`${backend}/api/${module}/${command ? 'commands' : 'account'}`, {
    headers: { ...headers, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
    ...(command ? { method: 'POST', body: JSON.stringify({ command, ...extra }) } : {}),
  });
  return { status: response.status, ...await response.json() };
}
try {
  for (const [path, method] of [['account', 'GET'], ['commands', 'POST']]) {
    const response = await fetch(`${backend}/api/alerts/${path}`, { method, ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}), signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 401);
  }
  record('Production background alert routes reject anonymous reads and writes');
  const created = await admin.auth.admin.createUser({ email: `discipline-${crypto.randomUUID()}@example.com`, password: `Qa!${crypto.randomBytes(24).toString('hex')}`, email_confirm: true, app_metadata: { plan: 'premium', audit_fixture: true } });
  assert.ifError(created.error); userId = created.data.user.id;
  const saved = await admin.from('terminal_workspaces').insert({ user_id: userId, data: { activeWorkspace: 'settings', selectedStock: 'AAPL', layoutMode: '1', timeframe: '5m', orders: [], positions: {}, realizedPnL: 0, journalEntries: [] } }); assert.ifError(saved.error);
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: created.data.user.email }); assert.ifError(link.error);
  const auth = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'email' }); assert.ifError(auth.error);
  headers = { Authorization: `Bearer ${auth.data.session.access_token}` };
  browser = await chromium.launch({ headless: true }); const context = await browser.newContext({ viewport: { width: 1536, height: 1024 } });
  await context.addInitScript(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('sb_public_onboarding_dismissed', 'true'); localStorage.setItem('sb_focused_terminal_workspace_v1', 'true');
  }, { key: `sb-${new URL(process.env.SUPABASE_URL).hostname.split('.')[0]}-auth-token`, session: auth.data.session });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.route(/\/api\/questrade\/(?:orders|submit|execute|cancel)/i, () => { throw new Error('Real execution forbidden in discipline verification'); });
  await fs.mkdir('artifacts/deployment/discipline', { recursive: true });
  await page.goto('https://www.sbcapitalco.com');
  const navigate = async name => name === 'Alerts' ? page.getByRole('button', { name: 'Notifications and alerts', exact: true }).click() : page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name, exact: true }).click();
  await page.getByRole('tab', { name: 'Trading', exact: true }).click({ timeout: 30000 });
  await page.getByLabel('Maximum order value ($)', { exact: true }).fill('2000');
  await page.getByLabel('Risk per trade ($)', { exact: true }).fill('25');
  await page.getByLabel('Daily realized loss limit ($)', { exact: true }).fill('100');
  await page.getByLabel('Commission per fill ($)', { exact: true }).fill('1');
  await page.getByLabel('Commission per share ($)', { exact: true }).fill('0.01');
  await page.getByLabel('Adverse slippage (bps)', { exact: true }).fill('10');
  await page.getByLabel('Require pre-trade checklist', { exact: true }).check();
  await page.getByRole('button', { name: 'Save Paper Rules', exact: true }).click();
  await expect.poll(async () => (await api('paper')).state.riskPolicy?.checklistRequired).toBe(true);
  // Costs use workspace autosave; risk rules use a separate server transaction.
  // Wait for both persisted authorities before testing a reload.
  await expect.poll(async () => { const row = await admin.from('terminal_workspaces').select('data').eq('user_id', userId).single(); assert.ifError(row.error); return row.data.data.premiumPreferences?.paperCosts; }, { timeout: 15000 }).toEqual({ commissionPerOrder: 1, commissionPerShare: .01, slippageBps: 10 });
  await page.reload(); await page.getByRole('tab', { name: 'Trading', exact: true }).click();
  await expect(page.getByLabel('Risk per trade ($)', { exact: true })).toHaveValue('25'); record('Saved paper rules survive a production reload');
  await expect(page.getByLabel('Commission per fill ($)', { exact: true })).toHaveValue('1');
  await expect(page.getByLabel('Commission per share ($)', { exact: true })).toHaveValue('0.01');
  await expect(page.getByLabel('Adverse slippage (bps)', { exact: true })).toHaveValue('10');
  const checklist = { plan: true, size: true, exit: true };
  let result = await api('paper', { id: crypto.randomUUID(), kind: 'submit', draft: { symbol: 'AAPL', side: 'BUY', type: 'LIMIT', quantity: 30, limitPrice: 100, stopLoss: 99, checklist, tif: 'GTC' } }, { limits: { maxOrderValue: 0, riskPerTrade: 0 } });
  assert.equal(result.status, 422); assert.match(result.error, /maximum order value/);
  result = await api('paper', { id: crypto.randomUUID(), kind: 'submit', draft: { symbol: 'AAPL', side: 'BUY', type: 'LIMIT', quantity: 1, limitPrice: 0.01, tif: 'DAY' } });
  assert.equal(result.status, 422); assert.match(result.error, /checklist/); record('Production server rejects missing checklist and weaker request caps');
  result = await api('paper', { id: crypto.randomUUID(), kind: 'submit', paperCosts: { commissionPerOrder: 1, commissionPerShare: .01, slippageBps: 10 }, draft: { symbol: 'AAPL', side: 'BUY', type: 'LIMIT', quantity: 20, limitPrice: 100, stopLoss: 98.9, checklist, tif: 'GTC' } }, { limits: { riskPerTrade: 9999 } });
  assert.equal(result.status, 422); assert.match(result.error, /planned loss \$26.38 > \$25.00/); assert.match(result.error, /commissions/);
  record('Production server rejects a stop-distance-valid entry when costs exceed its saved risk budget');
  await navigate('Dashboard'); const ticket = page.getByRole('region', { name: 'Paper trade ticket', exact: true });
  await expect(ticket.getByRole('button', { name: 'Place Paper Buy', exact: true })).toBeDisabled();
  await ticket.getByLabel('Paper order type').selectOption('LIMIT'); await ticket.getByLabel('Limit price', { exact: true }).fill('0.01'); await ticket.getByLabel('Paper quantity').fill('1');
  await ticket.locator('summary').click(); await ticket.getByLabel('Stop loss', { exact: true }).fill('0.005'); await ticket.getByLabel('Paper setup').fill('QA waiting order');
  await expect(ticket.getByLabel('Planned paper risk')).toContainText('round-trip commissions');
  for (const label of ['Setup and entry plan reviewed', 'Position size and loss reviewed', 'Exit and stop plan reviewed']) await ticket.getByLabel(label, { exact: true }).check();
  await ticket.getByRole('button', { name: 'Place Paper Buy', exact: true }).click(); await expect(ticket.getByRole('status')).toContainText('WORKING');
  const state = (await api('paper')).state; assert.deepEqual(state.positions, {}); assert.equal(state.orders[0].setup, 'QA waiting order');
  assert.deepEqual(state.orders[0].checklist, checklist); assert.equal((await api('paper', { id: crypto.randomUUID(), kind: 'cancel-all' })).status, 200);
  record('Checklist ticket submits an unmarketable paper limit and cancellation succeeds without a fabricated fill');
  await navigate('Trade Journal'); await page.getByLabel('Journal record type').selectOption('trade');
  await page.getByLabel('Journal symbol', { exact: true }).fill('AAPL');
  await page.getByLabel('Journal quantity', { exact: true }).fill('1'); await page.getByLabel('Journal entry price', { exact: true }).fill('100');
  await page.getByLabel('Journal exit price', { exact: true }).fill('110'); await page.getByLabel('Journal total fees', { exact: true }).fill('0');
  await page.getByLabel('Journal setup', { exact: true }).fill('QA manual review'); await page.getByLabel('Journal entry time UTC').fill('2026-10-02T14:00');
  await page.getByLabel('Journal planned risk').fill('5'); await page.getByLabel('Journal recorded checklist').selectOption('complete'); await page.getByLabel('Journal mistake tags').fill('QA late entry');
  await page.getByRole('button', { name: 'Save Record', exact: true }).click();
  await expect.poll(async () => { const row = await admin.from('terminal_workspaces').select('data').eq('user_id', userId).single(); assert.ifError(row.error); return row.data.data.journalEntries?.some(entry => entry.setup === 'QA manual review'); }).toBe(true);
  await page.getByRole('tab', { name: 'Statistics', exact: true }).click(); await page.getByLabel('Journal analysis dimension').selectOption('time');
  await expect(page.getByText('10:00–10:59 ET', { exact: true })).toBeVisible(); await page.getByLabel('Journal analysis dimension').selectOption('session');
  await expect(page.getByText('Regular', { exact: true })).toBeVisible(); await page.screenshot({ path: 'artifacts/deployment/discipline/journal.png' });
  record('An explicitly manual QA journal record persists and uses its recorded entry hour/session');
  await page.getByLabel('Journal analysis dimension').selectOption('risk');
  const plannedRow = page.getByRole('row', { name: 'Select Within planned risk', exact: true }); await expect(plannedRow).toContainText('$5.00'); await expect(plannedRow).toContainText('2.00R');
  await page.getByLabel('Journal analysis dimension').selectOption('checklist'); await expect(page.getByRole('row', { name: 'Select Recorded complete', exact: true })).toBeVisible();
  await page.getByLabel('Journal analysis dimension').selectOption('mistakes'); await expect(page.getByRole('cell', { name: 'QA late entry', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/deployment/discipline/journal-discipline.png' });
  record('Production journal compares explicitly recorded manual risk, R, checklist acknowledgements and mistake tags');
  const journalState = await admin.from('terminal_workspaces').select('data').eq('user_id', userId).single(); assert.ifError(journalState.error);
  const manualRecord = journalState.data.data.journalEntries.find(entry => entry.setup === 'QA manual review');
  const { year, month, day } = getNyDateParts(new Date(manualRecord.createdAt));
  const reportDay = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  await page.getByLabel('Journal from date ET').fill(reportDay); await page.getByLabel('Journal through date ET').fill(reportDay);
  await page.getByLabel('Journal symbol filter').selectOption('AAPL'); await page.getByLabel('Journal setup filter').selectOption('QA manual review');
  await page.getByLabel('Journal record filter').selectOption('trade');
  await expect(page.getByRole('status').filter({ hasText: '1 matching records' })).toBeVisible();
  await expect(page.getByText('$10.00', { exact: true }).first()).toBeVisible();
  await expect.poll(async () => { const row = await admin.from('terminal_workspaces').select('data').eq('user_id', userId).single(); assert.ifError(row.error); return row.data.data.premiumPreferences?.journalFilters?.from; }).toBe(reportDay);
  await page.reload(); await expect(page.getByLabel('Journal from date ET')).toHaveValue(reportDay);
  await expect(page.getByLabel('Journal symbol filter')).toHaveValue('AAPL');
  await page.getByRole('tab', { name: 'Exports', exact: true }).click();
  const scopedDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Filtered Journal CSV', exact: true }).click();
  const scopedStream = await (await scopedDownload).createReadStream(); const scopedChunks = []; for await (const chunk of scopedStream) scopedChunks.push(chunk);
  const scopedCsv = Buffer.concat(scopedChunks).toString('utf8');
  assert.equal(scopedCsv.trim().split('\n').length, 2); assert.match(scopedCsv, /filterFromET/); assert.ok(scopedCsv.includes(reportDay)); assert.ok(scopedCsv.includes(manualRecord.id));
  assert.match(scopedCsv, /plannedRiskAmount/); assert.match(scopedCsv, /entryChecklistStatus/); assert.match(scopedCsv, /mistakeTags/); assert.ok(scopedCsv.includes('QA late entry'));
  await page.screenshot({ path: 'artifacts/deployment/discipline/journal-filters.png' });
  await page.getByRole('button', { name: 'Clear Filters', exact: true }).click(); await expect(page.getByLabel('Journal symbol filter')).toHaveValue('');
  record('Production journal date/symbol/setup filters persist after reload, scope statistics and export the matching CSV with report criteria');
  await navigate('Alerts'); await page.getByLabel('Alert trigger price').fill('1000000'); await page.getByRole('button', { name: /Create/, exact: false }).click();
  const monitoring = page.getByLabel('Enable background price alerts'); await expect(monitoring).toBeEnabled(); await monitoring.click(); await expect(monitoring).toBeChecked();
  result = await api('alerts'); assert.equal(result.enabled, true); assert.equal(result.alerts.length, 1); assert.equal(result.alerts[0].trigger, 1000000);
  const scanBefore = result.worker.lastScanAt;
  await expect.poll(async () => (await api('alerts')).worker.lastScanAt, { timeout: 45000, intervals: [3000, 5000] }).not.toBe(scanBefore);
  result = await api('alerts'); assert.equal(result.alerts[0].history.length, 0); record('Production background worker scans opted-in rules with real provider plumbing and no invented triggers');
  await expect.poll(async () => (await api('alerts')).alerts[0].diagnostics?.checkedAt, { timeout: 45000, intervals: [3000, 5000] }).toBeTruthy();
  await page.reload(); await page.getByRole('row', { name: 'Select AAPL', exact: true }).click();
  const diagnostics = page.getByLabel('Selected alert diagnostics'); await expect(diagnostics).toContainText('Rule last checked'); await expect(diagnostics).toContainText('Last valid live quote');
  await expect(diagnostics).toContainText('Worker last scan (all accounts'); await page.screenshot({ path: 'artifacts/deployment/discipline/alert-diagnostics.png' });
  record('Production per-rule alert diagnostics persist and distinguish rule/market timestamps from global worker scans');
  const recoveryCommands = []; let loseReply = true;
  await page.route('**/api/alerts/commands', async route => {
    const command = route.request().postDataJSON().command;
    if (command.kind !== 'upsert') return route.continue();
    recoveryCommands.push(command);
    const response = await route.fetch();
    assert.equal(response.status(), 200);
    if (loseReply) { loseReply = false; return route.abort('failed'); }
    return route.fulfill({ response });
  });
  await page.getByLabel('Alert trigger price').fill('1000001'); await page.getByRole('button', { name: /Create/ }).click();
  await expect.poll(() => recoveryCommands.length).toBe(1);
  await expect.poll(async () => (await api('alerts')).alerts.length).toBe(2);
  await page.reload(); await expect(page.getByLabel('Enable background price alerts')).toBeChecked();
  await expect.poll(() => recoveryCommands.length).toBe(2);
  assert.deepEqual(recoveryCommands[1], recoveryCommands[0]);
  await expect.poll(() => page.evaluate(id => sessionStorage.getItem(`sb-alert-pending-v1:${id}`), userId)).toBeNull();
  result = await api('alerts'); assert.equal(result.alerts.length, 2); assert.equal(result.alerts.filter(rule => rule.trigger === 1000001).length, 1);
  record('Committed lost production alert reply recovers after reload with the same command/rule IDs and no duplicate');
  await page.screenshot({ path: 'artifacts/deployment/discipline/alerts.png' });
  await navigate('Settings'); await page.getByRole('tab', { name: 'Data & Connections', exact: true }).click();
  const backupInput = page.getByLabel('Select workspace backup', { exact: true });
  const envelope = payload => JSON.stringify({ marker: 'sb-terminal-workspace-backup', version: 1, payload });
  await backupInput.setInputFiles({ name: 'qa-invalid-backup.json', mimeType: 'application/json', buffer: Buffer.from(envelope({ journalEntries: [null] })) });
  await expect(page.getByRole('status').filter({ hasText: 'does not contain valid terminal data' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restore Selected', exact: true })).toHaveCount(0);
  const paperBeforeRestore = (await api('paper')).state;
  const alertsBeforeRestore = await api('alerts');
  await backupInput.setInputFiles({ name: 'qa-legacy-workspace.json', mimeType: 'application/json', buffer: Buffer.from(envelope({
    replayNotes: 'QA validated workspace restore', journalEntries: [{ id: 'qa-restored-note', symbol: 'AAPL', recordType: 'note', notes: 'Explicitly manual QA backup note' }],
    paperLedger: { orders: [{ id: 'do-not-import' }], positions: { AAPL: { qty: 999 } }, realizedPnL: 999999 }, orders: [{ id: 'do-not-import' }], positions: { AAPL: { qty: 999 } }, realizedPnL: 999999,
    maxOrderValue: 0, riskPerTrade: 0, dailyLossLimit: 0, alerts: [{ id: 'do-not-import', symbol: 'TSLA', trigger: 1, direction: 'above', active: true }],
    premiumPreferences: { notificationPreferences: { priceAlerts: false, soundAlerts: false } },
  })) });
  await expect(page.getByLabel('Workspace restore preview')).toContainText('9 protected account fields ignored');
  await page.screenshot({ path: 'artifacts/deployment/discipline/backup.png' });
  await page.getByRole('button', { name: 'Restore Selected', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'workspace fields restored' })).toBeVisible();
  await expect.poll(async () => { const row = await admin.from('terminal_workspaces').select('data').eq('user_id', userId).single(); assert.ifError(row.error); return row.data.data.replayNotes; }).toBe('QA validated workspace restore');
  const paperAfterRestore = (await api('paper')).state, alertsAfterRestore = await api('alerts');
  assert.deepEqual(paperAfterRestore.orders, paperBeforeRestore.orders); assert.deepEqual(paperAfterRestore.positions, paperBeforeRestore.positions);
  assert.deepEqual(paperAfterRestore.riskPolicy, paperBeforeRestore.riskPolicy);
  assert.equal(alertsAfterRestore.enabled, true); assert.equal(alertsAfterRestore.paused, false);
  assert.deepEqual(alertsAfterRestore.alerts, alertsBeforeRestore.alerts);
  await page.reload(); await page.getByRole('tab', { name: 'Data & Connections', exact: true }).click();
  const backupDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export Backup', exact: true }).click();
  const downloadStream = await (await backupDownload).createReadStream(); const chunks = []; for await (const chunk of downloadStream) chunks.push(chunk);
  const exportedBackup = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.equal(exportedBackup.payload.replayNotes, 'QA validated workspace restore');
  assert.equal(exportedBackup.payload.journalEntries[0].id, 'qa-restored-note');
  for (const field of ['orders', 'positions', 'paperLedger', 'realizedPnL', 'maxOrderValue', 'riskPerTrade', 'dailyLossLimit', 'alerts']) assert.equal(Object.hasOwn(exportedBackup.payload, field), false);
  assert.equal(Object.hasOwn(exportedBackup.payload.premiumPreferences.notificationPreferences, 'priceAlerts'), false);
  record('Production backup rejects malformed records, previews legacy replacements, persists manual data and preserves server orders/risk/alerts');
  const paused = await api('alerts', { id: crypto.randomUUID(), kind: 'pause', paused: true }); assert.equal(paused.paused, true);
  for (const rule of result.alerts) { const removed = await api('alerts', { id: crypto.randomUUID(), kind: 'remove', alertId: rule.id }); assert.equal(removed.status, 200); }
  assert.equal((await api('alerts')).alerts.length, 0);
  await api('alerts', { id: crypto.randomUUID(), kind: 'monitoring', enabled: false });
  const direct = await client.from('alert_accounts').select('user_id'); assert.ok(direct.error, 'Authenticated browser must not read backend-only alert storage');
  record('Background rules persist, pause/delete succeed and direct browser access to alert storage is denied');
  assert.deepEqual(errors, []); record('Production browser flows complete without runtime errors');
} finally {
  await browser?.close(); await client.auth.signOut();
  if (userId) {
    const removed = await admin.auth.admin.deleteUser(userId); assert.ifError(removed.error);
    for (const table of ['terminal_workspaces', 'paper_accounts', 'alert_accounts']) { const row = await admin.from(table).select('user_id').eq('user_id', userId); assert.ifError(row.error); assert.equal(row.data.length, 0); }
    record('Disposable QA account, manual journal, paper ledger and alerts were removed');
  }
  await fs.mkdir('artifacts/deployment/discipline', { recursive: true });
  await fs.writeFile('artifacts/deployment/discipline/verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, errors }, null, 2));
}
