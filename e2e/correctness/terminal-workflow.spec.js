import { expect, test } from '@playwright/test';
import { initialWorkspace, setupApp, user } from '../support/appHarness.js';

for (const width of [390, 1536]) {
  test(`saved layouts, alert inbox and watchlist groups work together at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const now = new Date('2026-11-05T17:00:00Z');
    await page.clock.setFixedTime(now);
    const quote = price => ({ symbol: 'AAPL', price, bidPrice: price - .01, askPrice: price + .01, lastTradeTime: now.toISOString(), source: 'Test provider', realtime: true });
    const quotes = [quote(100)];
    const legacy = { symbol: 'SPY', price: 99 };
    const evidence = await setupApp(page, { ...initialWorkspace, selectedStock: 'SPY', liveStocks: [legacy], timeZone: 'America/Dawson_Creek', alerts: [
      { id: 'test-rule', symbol: 'AAPL', trigger: 110, direction: 'above', active: true, history: [] },
    ] }, { providerQuotes: quotes });
    const navigate = async name => {
      if (width < 800) await page.getByRole('button', { name: 'Open workspace navigation' }).click();
      await page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name, exact: true }).click();
    };
    const tools = page.getByText('Layouts and watchlist groups', { exact: true });
    const layout = page.getByLabel('Saved layout', { exact: true });
    const save = async name => {
      await page.getByLabel('Layout name', { exact: true }).fill(name);
      await page.getByRole('button', { name: 'Save layout', exact: true }).click();
    };
    await tools.press('Enter');
    await save('Market Overview');
    await page.getByRole('button', { name: '1 chart layout', exact: true }).click();
    await page.getByLabel('Show chart side panel').uncheck();
    await save('Focused Chart');
    await layout.selectOption({ label: 'Market Overview' });
    await expect(page.getByLabel('Show chart side panel')).toBeChecked();
    await expect.poll(() => evidence.workspace().premiumPreferences?.savedLayouts?.length).toBe(2);
    await page.reload();
    await tools.press('Enter');
    await expect(layout.locator('option:checked')).toHaveText('Market Overview');
    await expect.poll(() => evidence.workspace().layoutMode).toBe('2');
    await layout.selectOption({ label: 'Focused Chart' });
    await expect(page.getByLabel('Show chart side panel')).not.toBeChecked();
    await layout.selectOption({ label: 'Market Overview' });

    await navigate('Watchlist');
    await page.getByLabel('Watchlist name').fill('Ideas');
    await page.getByRole('button', { name: 'New List', exact: true }).click();
    await page.getByLabel('Watchlist name').fill('Review');
    await page.getByRole('button', { name: 'New List', exact: true }).click();

    await page.getByRole('button', { name: 'Notifications and alerts' }).click();
    const toggle = page.getByLabel('Enable background price alerts');
    await expect(toggle).toBeEnabled();
    await toggle.click();
    await expect(toggle).toBeChecked();
    await expect.poll(async () => (await evidence.alertService.snapshot(user.id)).enabled).toBe(true);
    quotes[0] = quote(111);
    await evidence.alertService.tick();
    await expect.poll(() => evidence.workspace().activeWorkspace).toBe("alerts");
    await page.reload();
    const inbox = page.getByRole('heading', { name: 'Alerts Inbox' });
    await expect(inbox).toBeVisible();
    await expect(page.getByText('1 unread', { exact: true })).toBeVisible();
    await expect(page.getByText(/10:00:00 MST.*Trigger price/)).toBeVisible();
    await page.getByLabel('Destination watchlist').selectOption({ label: 'Ideas' });
    await page.getByRole('button', { name: 'Add to group', exact: true }).click();
    await expect(page.getByText('AAPL added to Ideas')).toBeVisible();
    await page.getByRole('article').getByRole('button', { name: 'Open Chart', exact: true }).click();
    await expect(page.getByText(/Opened from alert · AAPL/)).toBeVisible();
    await expect.poll(() => evidence.workspace().selectedStock).toBe('AAPL');
    expect(evidence.workspace().premiumPreferences.savedLayouts[0].snapshot.selectedStock).toBe('SPY');
    await page.getByRole('button', { name: 'Review Order', exact: true }).press('Enter');
    await expect(page.getByRole('region', { name: 'Paper order review' })).toContainText('AAPL');

    await navigate('Watchlist');
    await page.getByLabel('Active watchlist').selectOption({ label: 'Ideas' });
    await page.getByLabel('Destination watchlist').selectOption({ label: 'Review' });
    await page.getByRole('button', { name: 'Copy symbol', exact: true }).click();
    await page.getByRole('button', { name: 'Move symbol', exact: true }).click();
    await expect.poll(() => evidence.workspace().premiumPreferences?.watchlists?.map(({ name, symbols }) => [name, symbols])).toEqual([
      ['Main Watchlist', ['SPY']], ['Ideas', []], ['Review', ['AAPL']],
    ]);
    await page.reload();
    await expect(page.getByLabel('Active watchlist').locator('option:checked')).toHaveText('Ideas');
    await page.getByRole('button', { name: 'Notifications and alerts' }).click();
    await expect(page.getByText('0 unread', { exact: true })).toBeVisible();
    await expect(page.getByRole('article').getByRole('button', { name: 'Open Chart', exact: true })).toHaveCount(1);
    await expect.poll(() => evidence.workspace().premiumPreferences?.alertInboxArchive?.length).toBe(1);
    await expect.poll(() => evidence.workspace().activeWorkspace).toBe('alerts');
    await page.route('**/api/alerts/account', route => route.fulfill({ status: 503, json: { error: 'Test outage' } }));
    await page.reload();
    await expect(page.getByText(/Server alert history is unavailable/)).toBeVisible();
    await expect(page.getByRole('article').getByRole('button', { name: 'Open Chart', exact: true })).toHaveCount(1);
    await expect(page.getByText('0 unread', { exact: true })).toBeVisible();
    expect(evidence.errors).toEqual([]);
  });
}

test('a different account on the same browser cannot see another account’s layouts, inbox state or groups', async ({ page, context }) => {
  const first = await setupApp(page, {
    ...initialWorkspace,
    premiumPreferences: {
      savedLayouts: [{ id: 'private-layout', name: 'Private Layout', snapshot: { selectedStock: 'SPY' } }],
      activeSavedLayoutId: 'private-layout',
      watchlists: [{ id: 'private-group', name: 'Private Group', symbols: ['SPY'] }],
      activeWatchlistId: 'private-group',
      alertInboxRead: ['private-event'],
      alertInboxArchive: [{ id: 'private-event', timestamp: Date.parse('2026-11-05T17:00:00Z'), symbol: 'SPY', trigger: 100, direction: 'above' }],
    },
  });
  const tools = p => p.getByText('Layouts and watchlist groups', { exact: true });
  await tools(page).press('Enter');
  await expect(page.getByLabel('Saved layout').locator('option:checked')).toHaveText('Private Layout');
  expect(first.workspace().premiumPreferences.alertInboxRead).toEqual(['private-event']);
  await page.close();

  const other = await context.newPage();
  await setupApp(other, initialWorkspace, { identity: { ...user, id: '00000000-0000-4000-8000-000000000002', email: 'second@example.test' } });
  await tools(other).press('Enter');
  await expect(other.getByLabel('Saved layout').locator('option')).toHaveCount(1);
  await other.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name: 'Watchlist', exact: true }).click();
  await expect(other.getByLabel('Active watchlist').locator('option')).toHaveText(['Main Watchlist']);
  await other.getByRole('button', { name: 'Notifications and alerts' }).click();
  await expect(other.getByText('No triggered alerts yet.')).toBeVisible();
  await expect(other.getByText('0 unread', { exact: true })).toBeVisible();
});

test('layout updates and deletions require confirmation and the unnamed layout can be restored', async ({ page }) => {
  const evidence = await setupApp(page, { ...initialWorkspace, selectedStock: 'SPY', timeframe: '1m' });
  await page.getByText('Layouts and watchlist groups', { exact: true }).press('Enter');
  const name = page.getByLabel('Layout name', { exact: true });
  const select = page.getByLabel('Saved layout', { exact: true });
  const click = label => page.getByRole('button', { name: label, exact: true }).click();
  await name.fill('Overview');
  await click('Save layout');
  await name.fill('Market Overview');
  await click('Rename layout');
  await expect(select.locator('option:checked')).toHaveText('Market Overview');
  await name.fill('Duplicate');
  await click('Duplicate layout');
  await expect(select.locator('option:checked')).toHaveText('Duplicate');
  await click('1 chart layout');
  await click('1D');
  await click('Update layout');
  await expect.poll(() => evidence.workspace().timeframe).toBe('1D');
  expect(evidence.workspace().premiumPreferences.savedLayouts[1].snapshot.timeframe).toBe('1m');
  await click('Confirm update');
  await expect.poll(() => evidence.workspace().premiumPreferences.savedLayouts[1].snapshot.timeframe).toBe('1D');
  await click('Delete layout');
  await expect(select.locator('option')).toHaveCount(3);
  await click('Confirm delete');
  await expect(select.locator('option')).toHaveCount(2);
  await select.selectOption({ label: 'Market Overview' });
  await click('1 chart layout');
  await select.selectOption('');
  await expect.poll(() => evidence.workspace().layoutMode).toBe('2');
  expect(evidence.workspace().timeframe).toBe('1m');
});

test('inbox filters distinct rule events and watchlist groups can be reordered and removed', async ({ page }) => {
  const events = [
    { id: 'first', type: 'triggered', occurredAt: '2026-11-05T16:00:00Z', trigger: 100, direction: 'above', price: 101 },
    { id: 'second', type: 'triggered', occurredAt: '2026-11-05T17:00:00Z', trigger: 110, direction: 'above', price: 111 },
  ];
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'alerts', alerts: [
    { id: 'rule', symbol: 'AAPL', trigger: 110, direction: 'above', active: false, triggeredAt: events[1].occurredAt, history: events },
  ], premiumPreferences: { activeWatchlistId: 'ideas', watchlists: [
    { id: 'main', name: 'Main Watchlist', symbols: ['AAPL'] },
    { id: 'ideas', name: 'Ideas', symbols: ['AAPL'] },
  ] } });
  const click = label => page.getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('article').first()).toContainText('$111.00');
  await page.getByLabel('Search alert events').fill('100');
  await click('Mark visible as read');
  await expect(page.getByText('1 unread', { exact: true })).toBeVisible();
  await page.getByLabel('Search alert events').clear();
  await page.getByLabel('Unread only').check();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('article').getByRole('button', { name: 'Mark as read', exact: true }).click();
  await expect(page.getByText('0 unread', { exact: true })).toBeVisible();

  await page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name: 'Watchlist', exact: true }).click();
  await click('Move group earlier');
  const groups = page.getByLabel('Active watchlist');
  await expect(groups.locator('option')).toHaveText(['Ideas', 'Main Watchlist']);
  await page.getByLabel('Watchlist symbol', { exact: true }).fill('AAPL');
  await click('Add Symbol');
  await expect(page.getByText('AAPL is already in this group.')).toBeVisible();
  await click('Remove List');
  await expect(groups.locator('option')).toHaveCount(2);
  await click('Confirm group deletion');
  await expect(groups.locator('option')).toHaveText(['Main Watchlist']);
  await expect.poll(() => evidence.workspace().premiumPreferences?.watchlists).toEqual([
    { id: 'main', name: 'Main Watchlist', symbols: ['AAPL'] },
  ]);
});
