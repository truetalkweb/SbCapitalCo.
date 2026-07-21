export function escapeCsvValue(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
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
