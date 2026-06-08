export default function LoadingPanel({ theme, label = "Loading", height = "100%" }) {
  return (
    <div
      style={{
        height,
        minHeight: 0,
        display: "grid",
        placeItems: "center",
        background: theme.panel2,
        border: `1px solid ${theme.border}`,
        color: theme.muted,
        borderRadius: "6px",
        fontSize: "11px",
        fontWeight: 800,
      }}
    >
      {label}
    </div>
  );
}
