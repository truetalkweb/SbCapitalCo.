import { test, expect } from '@playwright/test';

test('maximum retained depth renders safely and replay DOM clears across a book gap', async ({ page }, testInfo) => {
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== 'http://127.0.0.1:4175') {
      external.push(route.request().url()); return route.abort();
    }
    return route.continue();
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/e2e/correctness/fixtures/order-flow-stress.html');
  await expect(page.getByRole('img', { name: 'Simulated footprint chart' })).toBeVisible();
  await expect(page.locator('.of-dom tbody tr')).not.toHaveCount(0);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.orderFlowStress.state())).toEqual({ simulated: true, trades: 1280, levels: 120000, currentBookValid: true, complete: true });
  expect(errors).toEqual([]);
  await page.evaluate(() => window.orderFlowStress.injectGap());
  await expect(page.getByText('No valid depth snapshot. Waiting for provider synchronization.')).toBeVisible();
  expect(await page.evaluate(() => window.orderFlowStress.state())).toMatchObject({ currentBookValid: false, complete: false });
  await page.getByLabel('Order flow mode').selectOption('replay');
  await page.getByLabel('Order flow replay position').fill('1279');
  await expect(page.locator('.of-dom tbody tr')).not.toHaveCount(0);
  await page.getByLabel('Order flow replay position').fill('1287');
  await expect(page.getByText('No valid depth snapshot. Waiting for provider synchronization.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('full-depth-replay-gap.png') });
  expect(errors).toEqual([]); expect(external).toEqual([]);
});
