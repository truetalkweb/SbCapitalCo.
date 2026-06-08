const shortcuts = [
  ["Ctrl/⌘ + K", "Open command palette", "Command"],
  ["Shift + B", "Prepare guarded buy ticket", "Trade"],
  ["Shift + S", "Prepare guarded sell ticket", "Trade"],
  ["Shift + 1", "Switch to one chart", "Layout"],
  ["Shift + 2", "Switch to two-chart grid", "Layout"],
  ["Esc", "Close floating chart controls", "Chart"],
];

const commandExamples = [
  "Open AAPL",
  "Replay Lab",
  "Open Order Ticket",
  "Go to Journal",
  "Open Alerts",
  "Turn Replay On",
];

export default function ShortcutsPanel({ theme }) {
  return (
    <div style={{ display: "grid", gap: "9px" }}>
      <h3 style={{ margin: 0, fontSize: "13px" }}>Keyboard Shortcuts</h3>

      <div
        style={{
          background: theme.panel2,
          border: `1px solid ${theme.border}`,
          borderRadius: "6px",
          padding: "8px",
          display: "grid",
          gap: "6px",
        }}
      >
        {shortcuts.map(([keys, action, group]) => (
          <div
            key={keys}
            style={{
              display: "grid",
              gridTemplateColumns: "92px 1fr auto",
              gap: "8px",
              alignItems: "center",
              padding: "5px 0",
              borderBottom: `1px solid ${theme.border}`,
              fontSize: "10px",
            }}
          >
            <kbd
              style={{
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                borderRadius: "4px",
                color: theme.text,
                padding: "4px 5px",
                fontWeight: 900,
                textAlign: "center",
              }}
            >
              {keys}
            </kbd>
            <span style={{ color: theme.text, fontWeight: 800 }}>{action}</span>
            <span style={{ color: theme.muted, fontWeight: 900 }}>{group}</span>
          </div>
        ))}
      </div>

      <div
        style={{
          background: theme.panel2,
          border: `1px solid ${theme.border}`,
          borderRadius: "6px",
          padding: "8px",
        }}
      >
        <div style={{ color: theme.text, fontSize: "11px", fontWeight: 900, marginBottom: "6px" }}>
          Command Palette Examples
        </div>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {commandExamples.map((command) => (
            <span
              key={command}
              style={{
                padding: "4px 7px",
                borderRadius: "999px",
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                color: theme.blue,
                fontSize: "10px",
                fontWeight: 900,
              }}
            >
              {command}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
