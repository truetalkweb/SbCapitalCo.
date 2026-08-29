import assert from "node:assert/strict";
import test from "node:test";

import {
  formatPacificDateTime,
  formatPacificTime,
} from "../src/utils/timeFormatters.js";

test("market timestamps are explicitly rendered in Pacific Time", () => {
  assert.match(formatPacificDateTime("2026-01-15T20:30:00.000Z"), /12:30 PM PST/);
  assert.match(formatPacificDateTime("2026-07-15T20:30:00.000Z"), /01:30 PM PDT/);
  assert.equal(formatPacificTime("2026-07-15T20:30:00.000Z"), "01:30 PM");
});

test("invalid timestamps remain unavailable rather than becoming the current time", () => {
  assert.equal(formatPacificTime(null), "Unavailable");
  assert.equal(formatPacificDateTime("not-a-date"), "Unavailable");
});
