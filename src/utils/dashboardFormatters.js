import { formatPacificTime } from "./timeFormatters.js";

function toNumber(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/[$,%+,x]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatPrice(value, digits = 2) {
  return toNumber(value).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatCurrency(value, digits = 2) {
  return `$${formatPrice(value, digits)}`;
}

export function formatSignedCurrency(value, digits = 2) {
  const parsed = toNumber(value);
  return `${parsed >= 0 ? "+" : "-"}$${Math.abs(parsed).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatPercent(value, digits = 2) {
  const parsed = toNumber(value);
  return `${parsed >= 0 ? "+" : ""}${parsed.toFixed(digits)}%`;
}

export function formatMultiple(value, digits = 1) {
  const parsed = toNumber(value, 1);
  return `${parsed.toFixed(digits)}x`;
}

export function formatCompactNumber(value, digits = 2) {
  const parsed = toNumber(value);
  const abs = Math.abs(parsed);
  if (abs >= 1_000_000_000_000) return `${(parsed / 1_000_000_000_000).toFixed(digits)}T`;
  if (abs >= 1_000_000_000) return `${(parsed / 1_000_000_000).toFixed(digits)}B`;
  if (abs >= 1_000_000) return `${(parsed / 1_000_000).toFixed(digits)}M`;
  if (abs >= 1_000) return `${(parsed / 1_000).toFixed(digits)}K`;
  return parsed.toFixed(0);
}

export function formatNewsClock(timestamp) {
  if (!timestamp) return "Market";
  return formatPacificTime(timestamp, { fallback: String(timestamp) });
}

export function asNumber(value, fallback = 0) {
  return toNumber(value, fallback);
}
