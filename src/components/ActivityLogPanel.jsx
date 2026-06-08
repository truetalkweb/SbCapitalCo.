import { useMemo, useState } from "react";

function formatDateTime(value) {
  if (!value) return "Pending";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "Pending";

  return parsed.toLocaleString();
}

function getStatusColor(theme, status) {
  const normalized = String(status || "").toLowerCase();

  if (["success", "filled", "synced", "loaded", "saved"].includes(normalized)) return theme.green;
  if (["blocked", "failed", "error"].includes(normalized)) return theme.red;
  if (["warning", "degraded", "cancelled"].includes(normalized)) return theme.amber;

  return theme.blue;
}

export default function ActivityLogPanel({
  theme,
  activityLog = [],
  clearActivityLog,
  buttonStyle,
}) {
  const [filter, setFilter] = useState("All");
  const filters = ["All", "Order", "Risk", "Broker", "Scanner", "Cloud", "System"];
  const rows = useMemo(() => {
    const normalizedFilter = filter.toLowerCase();

    return activityLog
      .filter((entry) => {
        if (filter === "All") return true;
        return String(entry.type || "").toLowerCase() === normalizedFilter;
      })
      .slice(0, 80);
  }, [activityLog, filter]);
  const counts = activityLog.reduce(
    (acc, entry) => {
      const type = String(entry.type || "system").toLowerCase();
      acc.total += 1;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    { total: 0 }
  );
  const cardStyle = {
    background: `linear-gradient(180deg, ${theme.panel2}, ${theme.panel})`,
    border: `1px solid ${theme.borderSoft || theme.border}`,
    borderRadius: "8px",
    padding: "9px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  };

  return (
    <div style={{ display: "grid", gap: "9px" }}>
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 950 }}>Activity / Audit Log</h3>
            <div style={{ color: theme.muted, fontSize: "10px", marginTop: "2px" }}>
              Local audit trail for paper trading, risk, broker, scanner, and cloud actions.
            </div>
          </div>
          <span
            style={{
              color: theme.cyan || theme.blue,
              border: `1px solid ${theme.borderSoft || theme.border}`,
              background: "rgba(25,198,216,0.08)",
              borderRadius: "999px",
              padding: "4px 8px",
              fontSize: "9px",
              fontWeight: 950,
              whiteSpace: "nowrap",
            }}
          >
            {counts.total} EVENTS
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px", marginTop: "8px" }}>
          {[
            ["Orders", counts.order || 0, theme.blue],
            ["Risk Blocks", counts.risk || 0, theme.red],
            ["Broker", counts.broker || 0, theme.green],
          ].map(([label, value, color]) => (
            <div
              key={label}
              style={{
                background: theme.panel3 || theme.panel,
                border: `1px solid ${theme.borderSoft || theme.border}`,
                borderRadius: "7px",
                padding: "7px",
                minWidth: 0,
              }}
            >
              <div style={{ color: theme.muted, fontSize: "9px", fontWeight: 950, textTransform: "uppercase" }}>
                {label}
              </div>
              <div style={{ color, fontSize: "12px", fontWeight: 950, marginTop: "2px" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            style={{
              ...(buttonStyle ? buttonStyle(filter === item) : {}),
              height: "26px",
              padding: "0 8px",
              fontSize: "9px",
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            ...cardStyle,
            color: theme.muted,
            borderStyle: "dashed",
            fontSize: "10px",
            lineHeight: "1.45",
          }}
        >
          <div style={{ color: theme.text, fontWeight: 950, marginBottom: "2px" }}>No audit events yet</div>
          <div>Order, risk, broker, scanner, and cloud events will appear here as the terminal is used.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "7px" }}>
          {rows.map((entry) => {
            const color = getStatusColor(theme, entry.status);

            return (
              <div key={entry.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: theme.text, fontSize: "11px", fontWeight: 950 }}>
                      {entry.title || "Activity"}
                    </div>
                    <div style={{ color: theme.muted, fontSize: "9px", marginTop: "2px" }}>
                      {formatDateTime(entry.createdAt)}
                    </div>
                  </div>
                  <span
                    style={{
                      color,
                      border: `1px solid ${color}55`,
                      background: `${color}14`,
                      borderRadius: "999px",
                      padding: "3px 7px",
                      fontSize: "8px",
                      fontWeight: 950,
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.status || "info"}
                  </span>
                </div>
                <div style={{ color: theme.muted, fontSize: "10px", lineHeight: "1.45", marginTop: "7px" }}>
                  {entry.detail || "Structured activity recorded."}
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "7px" }}>
                  <span style={{ color: theme.faint || theme.muted, fontSize: "9px", fontWeight: 900 }}>
                    {String(entry.type || "system").toUpperCase()}
                  </span>
                  {entry.symbol && (
                    <span style={{ color: theme.blue, fontSize: "9px", fontWeight: 950 }}>{entry.symbol}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activityLog.length > 0 && (
        <button type="button" onClick={clearActivityLog} style={{ ...(buttonStyle ? buttonStyle(false) : {}), width: "100%" }}>
          Clear Local Audit Log
        </button>
      )}
    </div>
  );
}
