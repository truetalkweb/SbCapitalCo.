export default function RecordPagination({ state, theme, label = "records" }) {
  const { page, pages, size, total, setPage } = state;
  const button = { border: `1px solid ${theme.border}`, color: theme.text, background: theme.panel2, padding: "7px 12px", borderRadius: 5 };
  return <nav aria-label={`${label} pagination`} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 12, fontSize: 12, color: theme.muted }}>
    <span role="status">{total ? `Showing ${page * size + 1}–${Math.min((page + 1) * size, total)} of ${total} ${label}` : `No ${label}`}</span>
    {pages > 1 && <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button type="button" style={button} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
      <span>Page {page + 1} of {pages}</span>
      <button type="button" style={button} disabled={page === pages - 1} onClick={() => setPage(page + 1)}>Next</button>
    </div>}
  </nav>;
}
