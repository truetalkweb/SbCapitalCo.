import { getStatusColor } from "../utils/marketUtils";

export default function TerminalStatusBar({ theme, terminalMonoFont, rows = [] }) {
  return (
    <div
      className="terminal-status-bar"
      style={{
        height: "22px",
        background: `linear-gradient(180deg, ${theme.panel || theme.bg}, ${theme.bg})`,
        borderTop: `1px solid ${theme.borderSoft || theme.border}`,
        color: theme.muted,
        fontSize: "9px",
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "0 6px",
        overflowX: "auto",
        whiteSpace: "nowrap",
      }}
    >
      {rows.map(([label, value]) => (
        <span
          key={label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "0 8px",
            minHeight: "16px",
            borderRight: `1px solid ${theme.borderSoft || theme.border}`,
          }}
        >
          <span style={{ color: theme.faint || theme.muted, fontWeight: 850, textTransform: "uppercase" }}>
            {label}:
          </span>
          <span
            style={{
              color: getStatusColor(value, theme),
              fontFamily: terminalMonoFont,
              fontVariantNumeric: "tabular-nums",
              fontWeight: 850,
            }}
          >
            {value}
          </span>
        </span>
      ))}
    </div>
  );
}
