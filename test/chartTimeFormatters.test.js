import test from 'node:test';
import assert from 'node:assert/strict';
import { createChartTimeFormatters } from '../src/utils/chartTimeFormatters.js';
const stamp = iso => Date.parse(iso) / 1000;
test('intraday chart labels honor saved zones with DST while retaining UTC identities', () => {
  const rows = [{ time: stamp('2026-03-06T14:30:00Z') }, { time: stamp('2026-03-09T13:30:00Z') }];
  const original = structuredClone(rows);
  for (const row of rows) {
    assert.equal(createChartTimeFormatters('America/New_York').tickMarkFormatter(row.time, 3), '09:30');
    assert.equal(createChartTimeFormatters('America/Vancouver').tickMarkFormatter(row.time, 3), '06:30');
  }
  assert.deepEqual(rows, original);
  assert.match(createChartTimeFormatters('America/New_York').timeFormatter(rows[0].time), /EST/);
  assert.match(createChartTimeFormatters('America/New_York').timeFormatter(rows[1].time), /EDT/);
  assert.equal(createChartTimeFormatters('UTC').tickMarkFormatter(rows[1].time, 3), '13:30');
});
test('daily date labels do not drift to the prior day, and invalid settings fail safely', () => {
  const daily = createChartTimeFormatters('America/Vancouver', false);
  assert.equal(daily.timeFormatter(stamp('2026-10-01T00:00:00Z')), 'Oct 1, 2026');
  assert.equal(daily.timeFormatter({ year: 2026, month: 10, day: 1 }), 'Oct 1, 2026');
  assert.equal(daily.timeFormatter('2026-10-01'), 'Oct 1, 2026');
  assert.equal(createChartTimeFormatters('Pacific/Auckland').tickMarkFormatter('2026-10-01', 2), '1');
  assert.equal(createChartTimeFormatters('invalid').timeZone, 'America/New_York');
  assert.equal(daily.timeFormatter(null), 'Unavailable'); assert.equal(daily.tickMarkFormatter(NaN, 3), null);
});
