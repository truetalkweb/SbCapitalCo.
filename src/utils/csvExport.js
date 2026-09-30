export function escapeCsvValue(value) {
  const text = String(value ?? "");
  // Quotes alone do not stop spreadsheet formula interpretation of user/provider text.
  // Preserve actual numeric values and plain numeric strings used by accounting exports.
  const numeric = typeof value === 'number' || (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text) && Number.isFinite(Number(text)));
  const risky = !numeric && (/^\s*[=+\-@＝＋－＠]/u.test(text) || (text.length > 0 && text.charCodeAt(0) < 32));
  const safeText = risky ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function buildCsv(headers, rows) {
  const safeHeaders = Array.isArray(headers) ? headers : [];
  const safeRows = Array.isArray(rows) ? rows : [];

  return [
    safeHeaders.join(","),
    ...safeRows.map((row) =>
      safeHeaders.map((header) => escapeCsvValue(row?.[header])).join(",")
    ),
  ].join("\n");
}
