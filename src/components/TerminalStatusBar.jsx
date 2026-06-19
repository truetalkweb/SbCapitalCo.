import { formatTerminalStatusLabel, getStatusColor } from "../utils/marketUtils";

function getCellWidth(label) {
  const widths = {
    Data: "112px",
    Backend: "128px",
    Scanner: "164px",
    News: "154px",
    Broker: "148px",
    Mode: "112px",
    Chart: "108px",
    Main: "86px",
    Secondary: "108px",
    Layout: "104px",
    "P&L": "86px",
    Cloud: "120px",
    Checked: "112px",
  };

  return widths[label] || "110px";
}

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
        padding: "0 4px",
        overflow: "hidden",
        whiteSpace: "nowrap",
        contain: "layout paint",
      }}
    >
      {rows.map(([label, value]) => {
        const displayValue = formatTerminalStatusLabel(value);

        return (
        <span
          key={label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "0 6px",
            minHeight: "16px",
            width: getCellWidth(label),
            flex: `0 0 ${getCellWidth(label)}`,
            minWidth: 0,
            borderRight: `1px solid ${theme.borderSoft || theme.border}`,
          }}
        >
          <span style={{ color: theme.faint || theme.muted, fontWeight: 850, textTransform: "uppercase", flexShrink: 0 }}>
            {label}:
          </span>
          <span
            style={{
              color: getStatusColor(value, theme),
              fontFamily: terminalMonoFont,
              fontVariantNumeric: "tabular-nums",
              fontWeight: 850,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={String(value || "")}
          >
            {displayValue}
          </span>
        </span>
        );
      })}
    </div>
  );
}
