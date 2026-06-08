export function createPanelStyle(theme, isDark, extra = {}) {
  return {
    background: `linear-gradient(180deg, ${theme.panel2}, ${theme.panel})`,
    border: `1px solid ${theme.borderSoft || theme.border}`,
    color: theme.text,
    borderRadius: "8px",
    padding: "9px",
    overflow: "hidden",
    minHeight: 0,
    boxShadow: isDark
      ? "inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 30px rgba(0,0,0,0.18)"
      : "0 1px 8px rgba(0,0,0,0.04)",
    ...extra,
  };
}

export function createButtonStyle(theme, active = false, extra = {}) {
  return {
    height: "30px",
    padding: "0 10px",
    background: active
      ? `linear-gradient(180deg, ${theme.blue}, #1765c6)`
      : `linear-gradient(180deg, ${theme.panel3 || theme.panel2}, ${theme.panel2})`,
    border: `1px solid ${active ? "rgba(45,140,255,0.72)" : theme.borderSoft || theme.border}`,
    color: active ? "#ffffff" : theme.text,
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "10px",
    fontWeight: 900,
    whiteSpace: "nowrap",
    boxShadow: active
      ? "inset 0 1px 0 rgba(255,255,255,0.16)"
      : "inset 0 1px 0 rgba(255,255,255,0.04)",
    ...extra,
  };
}

export function createInputStyle(theme, enabled = true, extra = {}) {
  return {
    width: "100%",
    height: "34px",
    padding: "0 9px",
    background: enabled ? theme.panel : "rgba(127,127,127,0.10)",
    border: `1px solid ${theme.borderSoft || theme.border}`,
    color: theme.text,
    borderRadius: "6px",
    marginTop: "5px",
    fontSize: "11px",
    fontWeight: 850,
    opacity: enabled ? 1 : 0.55,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
    ...extra,
  };
}

export function createCardStyle(theme, extra = {}) {
  return {
    background: theme.panel3 || theme.panel,
    border: `1px solid ${theme.borderSoft || theme.border}`,
    borderRadius: "7px",
    padding: "9px",
    display: "grid",
    gap: "8px",
    ...extra,
  };
}

export function createLabelStyle(theme, extra = {}) {
  return {
    fontSize: "10px",
    color: theme.muted,
    fontWeight: 900,
    minWidth: 0,
    ...extra,
  };
}

export function sectionTitleStyle(theme, extra = {}) {
  return {
    color: theme.text,
    fontSize: "10px",
    fontWeight: 950,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    ...extra,
  };
}
