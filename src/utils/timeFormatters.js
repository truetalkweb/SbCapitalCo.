export const PACIFIC_TIME_ZONE = "America/Los_Angeles";

function validDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const timestamp = typeof value === "number" && value < 10_000_000_000 ? value * 1000 : value;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatPacificTime(value, options = {}) {
  const date = validDate(value);
  const { fallback = "Unavailable", ...formatOptions } = options;
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    ...formatOptions,
  }).format(date);
}

export function formatPacificDate(value, options = {}) {
  const date = validDate(value);
  const { fallback = "Unavailable", ...formatOptions } = options;
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    ...formatOptions,
  }).format(date);
}

export function formatPacificDateTime(value, options = {}) {
  const date = validDate(value);
  const { fallback = "Unavailable", ...formatOptions } = options;
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    ...formatOptions,
  }).format(date);
}
