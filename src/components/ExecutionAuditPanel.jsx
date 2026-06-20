function formatPtTimestamp(value) {
  if (!value) return "Pending";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "Pending";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Vancouver",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(parsed);
}

function formatMoney(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) return "$0.00";

  return `$${number.toFixed(2)}`;
}

function formatRatio(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number) || number <= 0) return "N/A";

  return `${number.toFixed(2)}R`;
}

function getStatusColor(theme, result) {
  const normalized = String(result || "").toLowerCase();

  if (["submitted", "filled", "simulated"].includes(normalized)) return theme.green;
  if (normalized === "failed") return theme.red;
  if (normalized === "blocked") return theme.amber;
  if (["cancelled"].includes(normalized)) return theme.muted;

  return theme.blue;
}

export default function ExecutionAuditPanel({
  theme,
  auditTrail = [],
  clearAuditTrail,
  buttonStyle,
}) {
  const rows = auditTrail.slice(0, 80);
  const counts = auditTrail.reduce(
    (acc, item) => {
      const result = String(item.result || "unknown").toLowerCase();
      acc.total += 1;
      acc[result] = (acc[result] || 0) + 1;
      return acc;
    },
    { total: 0 }
  );
  const cardStyle = {
    background: `linear-gradient(180deg, ${theme.panel2}, ${theme.panel})`,
    border: `1px solid ${theme.borderSoft || theme.border}`,
    borderRadius: "8px",
    padding: "9px",
    boxShadow: theme.isDark
      ? "inset 0 1px 0 rgba(255,255,255,0.04)"
      : "0 1px 2px rgba(15,23,42,0.04)",
  };
  const mono = {
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <div style={{ display: "grid", gap: "9px" }}>
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 950 }}>Execution Audit</h3>
            <div style={{ color: theme.muted, fontSize: "10px", marginTop: "2px" }}>
              Local order intent, risk decision, and submission trail.
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
              ...mono,
            }}
          >
            {counts.total} ROWS
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px", marginTop: "8px" }}>
          {[
            ["Submitted", (counts.submitted || 0) + (counts.filled || 0) + (counts.simulated || 0), theme.green],
            ["Blocked", counts.blocked || 0, theme.amber],
            ["Failed", counts.failed || 0, theme.red],
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
              <div style={{ color, fontSize: "12px", fontWeight: 950, marginTop: "2px", ...mono }}>{value}</div>
            </div>
          ))}
        </div>
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
          <div style={{ color: theme.text, fontWeight: 950, marginBottom: "2px" }}>No execution records yet</div>
          <div>Submitted, blocked, cancelled, and failed order attempts will appear here.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "7px" }}>
          {rows.map((entry) => {
            const color = getStatusColor(theme, entry.result);

            return (
              <div key={entry.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ color: theme.text, fontSize: "12px", fontWeight: 950, ...mono }}>
                        {entry.symbol}
                      </span>
                      <span style={{ color: entry.side === "BUY" ? theme.green : theme.red, fontSize: "10px", fontWeight: 950 }}>
                        {entry.side}
                      </span>
                      <span style={{ color: theme.muted, fontSize: "9px", fontWeight: 900, ...mono }}>
                        {entry.quantity} {entry.orderType}
                      </span>
                    </div>
                    <div style={{ color: theme.muted, fontSize: "9px", marginTop: "2px", ...mono }}>
                      {formatPtTimestamp(entry.timestamp)}
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
                    {entry.result || "recorded"}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "5px", marginTop: "8px" }}>
                  {[
                    ["Entry", formatMoney(entry.entryPrice)],
                    ["Value", formatMoney(entry.orderValue)],
                    ["Risk", formatMoney(entry.orderRisk)],
                    ["Reward", formatMoney(entry.orderReward)],
                    ["R:R", formatRatio(entry.riskReward)],
                    ["Mode", entry.tradingMode || "paper"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        background: theme.panel3 || theme.panel,
                        border: `1px solid ${theme.borderSoft || theme.border}`,
                        borderRadius: "6px",
                        padding: "6px",
                        minWidth: 0,
                      }}
                    >
                      <div style={{ color: theme.muted, fontSize: "8px", fontWeight: 950, textTransform: "uppercase" }}>
                        {label}
                      </div>
                      <div style={{ color: theme.text, fontSize: "10px", fontWeight: 900, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...mono }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {entry.reason && (
                  <div style={{ color, fontSize: "10px", lineHeight: 1.45, marginTop: "8px", fontWeight: 800 }}>
                    {entry.reason}
                  </div>
                )}

                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px", color: theme.faint || theme.muted, fontSize: "9px", fontWeight: 900 }}>
                  <span style={mono}>{entry.id}</span>
                  <span>{entry.brokerConnected ? "Broker connected" : "Broker not connected"}</span>
                  {entry.accountId && <span style={mono}>Acct {entry.accountId}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {auditTrail.length > 0 && (
        <button type="button" onClick={clearAuditTrail} style={{ ...(buttonStyle ? buttonStyle(false) : {}), width: "100%" }}>
          Clear Local Execution Audit
        </button>
      )}
    </div>
  );
}
