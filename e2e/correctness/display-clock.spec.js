import { test, expect } from '@playwright/test';
import { setupApp, initialWorkspace } from '../support/appHarness.js';

for (const date of ['2026-01-15T15:11:51Z', '2026-07-15T15:11:51Z']) test(`header follows MST at ${date}`, async ({ page }) => {
  await page.clock.setFixedTime(Date.parse(date));
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'settings', timeZone: 'America/Dawson_Creek' });
  await expect(page.locator('.ws-clock')).toContainText('08:11:51 MST');
  await page.getByLabel('Time zone', { exact: true }).selectOption('UTC');
  await expect(page.locator('.ws-clock')).toContainText('15:11:51 UTC');
  await expect.poll(() => evidence.workspace().timeZone).toBe('UTC');
  await page.getByLabel('Time zone', { exact: true }).selectOption('America/Dawson_Creek');
  await expect.poll(() => evidence.workspace().timeZone).toBe('America/Dawson_Creek');
  await page.reload();
  await expect(page.locator('.ws-clock')).toContainText('08:11:51 MST');
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});
