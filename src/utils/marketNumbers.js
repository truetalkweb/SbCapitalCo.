export function parseNullableMarketNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const parsed = Number(String(value).replace(/[$,%+,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}
