import { useState } from "react";

export function useRecordPage(rows, size = 25, scope = "") {
  const [selection, setSelection] = useState({ page: 0, scope });
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = selection.scope === scope ? Math.min(selection.page, pages - 1) : 0;
  return { rows: rows.slice(page * size, (page + 1) * size), page, pages, size, total: rows.length,
    setPage: value => setSelection({ page: Math.max(0, Math.min(value, pages - 1)), scope }) };
}
