import { ChevronDown, ChevronRight } from "lucide-react";

export default function LeftSectionHeader({
  id,
  title,
  meta = "",
  open,
  onToggle,
  theme,
}) {
  const Icon = open ? ChevronDown : ChevronRight;

  return (
    <button
      onClick={() => onToggle?.(id)}
      style={{
        width: "100%",
        height: "30px",
        marginTop: "10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        background: "transparent",
        border: "none",
        borderTop: `1px solid ${theme.border}`,
        color: theme.text,
        cursor: "pointer",
        padding: "8px 0 0",
        fontSize: "12px",
        fontWeight: 900,
        textAlign: "left",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
        <Icon size={14} />
        {title}
      </span>
      {meta && <span style={{ color: theme.muted, fontSize: "10px" }}>{meta}</span>}
    </button>
  );
}
