import test from 'node:test';
import assert from 'node:assert/strict';
import { createDisplayClockFormatters } from '../src/utils/displayClock.js';

test('MST header clock uses UTC minus seven throughout winter and summer', () => {
  const clock = createDisplayClockFormatters('America/Dawson_Creek');
  for (const date of ['2026-01-15T15:11:51Z', '2026-07-15T15:11:51Z']) assert.equal(clock.time.format(new Date(date)), '08:11:51 MST');
});

test('date and time use the same zone across midnight', () => {
  const clock = createDisplayClockFormatters('America/Dawson_Creek');
  const instant = new Date('2026-11-04T02:15:00Z');
  assert.equal(clock.date.format(instant), 'Tue, Nov 3, 2026');
  assert.equal(clock.time.format(instant), '19:15:00 MST');
  assert.match(createDisplayClockFormatters('UTC').date.format(instant), /Nov 4/);
});

test('invalid preferences fall back to a valid clock instead of crashing the header', () => {
  assert.equal(createDisplayClockFormatters('invalid').timeZone, 'America/New_York');
});
