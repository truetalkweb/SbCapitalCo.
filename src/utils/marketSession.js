function getNyDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

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
  return new Set([
    toKey(observedFixedHoliday(year, 1, 1)),
    toKey(nthWeekdayOfMonth(year, 1, 1, 3)),
    toKey(nthWeekdayOfMonth(year, 2, 1, 3)),
    toKey(addUtcDays(getEasterSunday(year), -2)),
    toKey(lastWeekdayOfMonth(year, 5, 1)),
    toKey(observedFixedHoliday(year, 6, 19)),
    toKey(observedFixedHoliday(year, 7, 4)),
    toKey(nthWeekdayOfMonth(year, 9, 1, 1)),
    toKey(nthWeekdayOfMonth(year, 11, 4, 4)),
    toKey(observedFixedHoliday(year, 12, 25)),
  ]);
}

export function getUsMarketStatus(date = new Date()) {
  const parts = getNyDateParts(date);
  const minutes = parts.hour * 60 + parts.minute;
  if (["Sat", "Sun"].includes(parts.weekday) || getMarketHolidayKeys(parts.year).has(formatDateKey(parts.year, parts.month, parts.day))) return "CLOSED";
  if (minutes >= 240 && minutes < 570) return "PREMARKET";
  if (minutes >= 570 && minutes < 960) return "OPEN";
  if (minutes >= 960 && minutes < 1200) return "AFTER HOURS";
  return "CLOSED";
}
export { getNyDateParts, formatDateKey, getMarketHolidayKeys };
