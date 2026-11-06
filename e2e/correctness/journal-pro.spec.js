import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';
import { initialWorkspace, setupApp } from '../support/appHarness.js';

for (const width of [390, 1536]) {
  test(`Journal Pro edits and reconciles a closed trade in MST at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date('2026-11-02T17:00:00Z'));
    const note = { id: 'original-note', symbol: 'NVDA', setup: 'Legacy note', review: 'Original notes', recordType: 'note' };
    const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'journal', timeZone: 'America/Dawson_Creek', journalEntries: [note] });
    const tab = name => page.getByRole('tab', { name, exact: true });
    const field = name => page.getByLabel(`Journal ${name}`, { exact: true });
    const day = (date, amount) => page.getByRole('button', { name: `${date}, ${amount}, 1 trade`, exact: true });

    await expect(page.getByRole('heading', { name: 'Journal Pro', exact: true })).toBeVisible();
    await field('setup').fill('MST boundary');
    await field('record type').selectOption('trade');
    await field('side').selectOption('Short');
    await field('quantity').fill('2');
    await field('entry price').fill('100');
    await field('exit price').fill('90');
    await field('total fees').fill('1.25');
    await field('close time UTC').fill('2026-11-01T06:45');
    await page.getByRole('button', { name: 'Save Record', exact: true }).click();
    await expect.poll(() => evidence.workspace().journalEntries[0]?.pnl).toBe(18.75);
    const id = evidence.workspace().journalEntries[0].id;

    await tab('Calendar').click();
    await expect(page.getByText(/Net realized USD P&L by close date in America\/Dawson_Creek/)).toBeVisible();
    await expect(page.getByText('November 2026', { exact: true })).toBeVisible();
    await expect(day('2026-11-01', '$18.75')).toHaveCount(0);
    await page.getByRole('button', { name: 'Previous month' }).click();
    await day('2026-10-31', '$18.75').click();
    await expect(page.getByRole('region', { name: 'Trades closed on 2026-10-31' })).toContainText('MST boundary');

    await tab('Trades').click();
    await page.getByRole('row').filter({ hasText: 'MST boundary' }).getByRole('button', { name: /Edit journal entry/ }).click();
    await field('exit price').fill('95');
    await field('review').fill('Corrected exit price');
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect.poll(() => evidence.workspace().journalEntries.find(record => record.id === id)?.pnl).toBe(8.75);
    expect(evidence.workspace().journalEntries).toContainEqual(note);

    await page.reload();
    await tab('Calendar').click();
    await page.getByRole('button', { name: 'Previous month' }).click();
    await day('2026-10-31', '$8.75').click();
    await expect(page.getByRole('region', { name: 'Trades closed on 2026-10-31' })).toContainText('$8.75');
    await tab('Trades').click();
    await expect(page.getByText('Corrected exit price', { exact: true })).toBeVisible();
    await page.getByRole('row').filter({ hasText: 'MST boundary' }).getByRole('button', { name: /Delete journal entry/ }).click();
    await expect.poll(() => evidence.workspace().journalEntries.some(record => record.id === id)).toBe(false);
    await tab('Calendar').click();
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page.getByText('No realized USD P&L for this month.')).toBeVisible();
    expect(evidence.errors).toEqual([]);
    expect(evidence.blocked).toEqual([]);
  });
}

test('CSV preview validates and deduplicates trades that flow into the MST weekly review', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.clock.setFixedTime(new Date('2026-11-04T17:00:00Z'));
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'journal', timeZone: 'America/Dawson_Creek', journalEntries: [] });
  const tab = name => page.getByRole('tab', { name, exact: true });
  const upload = csv => page.getByLabel('Journal CSV file').setInputFiles({
    name: 'trades.csv', mimeType: 'text/csv', buffer: Buffer.from(csv),
  });
  const header = 'tradeId,symbol,side,closedAt,quantity,entryPrice,exitPrice,fees,setup,followedPlan\n';
  const prior = 'prior,MSFT,Long,2026-11-02T06:59:59Z,1,100,150,0,Breakout,\n';
  const win = 'winner,AAPL,Long,2026-11-02T07:00:00Z,10,100,102,1,"Opening, breakout",Yes\n';
  const loss = 'loser,SPY,Short,2026-11-03T18:30:00Z,2,100,103,1,Reversal,No\n';
  await tab('Import').click();
  await upload(header + win.replace('2026-11-02', '2026-11-31'));
  await expect(page.getByRole('alert')).toContainText('invalid fields');
  await expect(page.getByRole('button', { name: 'Import trades' })).toBeDisabled();
  await upload(header + prior + win + loss);
  await expect(page.getByText('3 new trades · 0 already imported · 0 errors')).toBeVisible();
  await expect(page.getByRole('cell', { name: '$19.00', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Import trades' }).click();
  await expect.poll(() => evidence.workspace().journalEntries.length).toBe(3);
  await page.reload();
  await tab('Import').click();
  await upload(header + prior + win + loss);
  await expect(page.getByText('0 new trades · 3 already imported · 0 errors')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import trades' })).toBeDisabled();
  await tab('Weekly Review').click();
  await expect(page.getByText('2026-11-02 through 2026-11-08')).toBeVisible();
  await expect(page.getByText('$12.00', { exact: true })).toBeVisible();
  await expect(page.getByText('$7.00', { exact: true })).toBeVisible();
  await expect(page.getByText('1 of 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Opening, breakout' })).toBeVisible();
  await page.getByRole('button', { name: 'Previous week' }).click();
  await expect(page.getByText('2026-10-26 through 2026-11-01')).toBeVisible();
  await expect(page.getByRole('cell', { name: '$50.00', exact: true })).toBeVisible();
});
