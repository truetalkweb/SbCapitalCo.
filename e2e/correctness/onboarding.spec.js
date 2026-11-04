import { test, expect } from '@playwright/test';
import { setupApp, initialWorkspace } from '../support/appHarness.js';

async function openGuide(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('button', { name: 'Help & shortcuts', exact: true }).click();
  await page.getByRole('tab', { name: 'Quick Start', exact: true }).click();
  return page.getByRole('dialog').filter({ has: page.getByRole('tab', { name: 'Quick Start', exact: true }) });
}

for (const width of [390, 1536]) test(`first-session actions navigate without submitting trades at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1024 });
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'dashboard', positions: {}, orders: [] });
  for (const [action, workspace] of [['Open Watchlist', 'watchlist'], ['Open Charts', 'charts'], ['Open Paper Orders', 'orders'], ['Open Journal', 'journal']]) {
    const guide = await openGuide(page);
    await expect(guide.getByText('Inspect a chart and prepare a plan', { exact: true })).toBeVisible();
    if (workspace === 'watchlist') await guide.screenshot({ path: info.outputPath('quick-start.png') });
    await guide.getByRole('button', { name: action, exact: true }).click();
    await expect(guide).toHaveCount(0);
    await expect(page.locator('.ws-workspace')).toHaveAttribute('data-workspace', workspace);
  }
  expect(evidence.workspace().paperLedger.orders).toHaveLength(0);
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test('Free onboarding explains journal access and settings describes paper simulation correctly', async ({ page }) => {
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'dashboard' });
  await page.route('**/api/entitlements/me', route => route.fulfill({ json: { plan: 'free', status: 'active', capabilities: { journal: false } } }));
  await page.reload();
  const guide = await openGuide(page);
  await expect(guide.getByText('Pro access required.', { exact: true })).toBeVisible();
  await guide.getByRole('button', { name: 'View plan access', exact: true }).click();
  await expect(page.locator('.ws-workspace')).toHaveAttribute('data-workspace', 'settings');
  await expect(page.getByText(/Charts, scanner, watchlists, news, alerts, order-flow tools, Orders and Positions, including paper simulation/)).toBeVisible();
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});
