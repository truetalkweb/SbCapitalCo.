const nyFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: 'h23',
});
function getNyDateParts(date) {
  const parts = nyFormatter.formatToParts(date);

  const value = (type) => parts.find((part) => part.type === type)?.value;

  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    weekday: value("weekday"),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

function formatDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function observedFixedHoliday(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();

  if (weekday === 0) return addUtcDays(date, 1);
  if (weekday === 6) return addUtcDays(date, -1);
  return date;
}

function nthWeekdayOfMonth(year, month, weekday, nth) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month - 1, 1 + offset + (nth - 1) * 7));
}

function lastWeekdayOfMonth(year, month, weekday) {
  const last = new Date(Date.UTC(year, month, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month - 1, last.getUTCDate() - offset));
}

function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
}

function toKey(date) {
  return formatDateKey(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
}

function getMarketHolidayKeys(year) {
  const holidays = new Set([
    // NYSE does not observe New Year's Day on the preceding Friday when
    // January 1 falls on Saturday (including December 31, 2027).
    ...(new Date(Date.UTC(year, 0, 1)).getUTCDay() === 6 ? [] : [toKey(observedFixedHoliday(year, 1, 1))]),
    toKey(nthWeekdayOfMonth(year, 1, 1, 3)),
    toKey(nthWeekdayOfMonth(year, 2, 1, 3)),
    toKey(addUtcDays(getEasterSunday(year), -2)),
    toKey(lastWeekdayOfMonth(year, 5, 1)),
    ...(year >= 2022 ? [toKey(observedFixedHoliday(year, 6, 19))] : []),
    toKey(observedFixedHoliday(year, 7, 4)),
    toKey(nthWeekdayOfMonth(year, 9, 1, 1)),
    toKey(nthWeekdayOfMonth(year, 11, 4, 4)),
    toKey(observedFixedHoliday(year, 12, 25)),
  ]);
  if (year === 2025) holidays.add('2025-01-09'); // National Day of Mourning.
  return holidays;
}

// Core equity calendar, with the conventional Nasdaq/Arca extended window.
// Sources: https://www.nyse.com/trade/hours-calendars and Nasdaq Trader calendar.
// This schedule does not infer a provider connection or an instrument halt.
export function getUsEquitySession(date = new Date()) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return { status: 'CLOSED', label: 'Closed', isRegular: false, reason: 'Invalid session time', earlyClose: false };
  const parts = getNyDateParts(date);
  const minutes = parts.hour * 60 + parts.minute;
  const dateKey = formatDateKey(parts.year, parts.month, parts.day);
  const weekend = ['Sat', 'Sun'].includes(parts.weekday), holiday = getMarketHolidayKeys(parts.year).has(dateKey);
  const thanksgivingFriday = toKey(addUtcDays(nthWeekdayOfMonth(parts.year, 11, 4, 4), 1));
  const earlyClose = !weekend && !holiday && (dateKey === thanksgivingFriday || (parts.month === 7 && parts.day === 3) || (parts.month === 12 && parts.day === 24));
  const closeMinute = earlyClose ? 780 : 960, extendedCloseMinute = earlyClose ? 1020 : 1200;
  const status = weekend || holiday ? 'CLOSED' : minutes >= 570 && minutes < closeMinute ? 'OPEN'
    : minutes >= 240 && minutes < 570 ? 'PREMARKET'
      : minutes >= closeMinute && minutes < extendedCloseMinute ? 'AFTER HOURS' : 'CLOSED';
  return { status, label: { OPEN: 'Regular', PREMARKET: 'Premarket', 'AFTER HOURS': 'After Hours', CLOSED: 'Closed' }[status],
    isRegular: status === 'OPEN', dateKey, earlyClose, closeMinute, extendedCloseMinute,
    reason: holiday ? 'Exchange holiday' : weekend ? 'Weekend' : earlyClose ? 'Early close at 13:00 ET' : 'US equity core session calendar' };
}

export function getUsMarketStatus(date = new Date()) {
  return getUsEquitySession(date).status;
}

export function getNextUsEquityClose(date = new Date()) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error('Invalid paper session time.');
  const parts = getNyDateParts(date);
  for (let offset = 0; offset < 15; offset++) {
    const noonUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + offset, 12));
    const session = getUsEquitySession(noonUtc);
    if (session.reason === 'Weekend' || session.reason === 'Exchange holiday') continue;
    const local = getNyDateParts(noonUtc);
    const close = noonUtc.getTime() + (session.closeMinute - local.hour * 60 - local.minute) * 60000;
    if (date.getTime() < close) return new Date(close).toISOString();
  }
  throw new Error('Unable to determine the next paper trading session.');
}
export { getNyDateParts, formatDateKey, getMarketHolidayKeys };
