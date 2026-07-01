export default function PaperAccountPanel({
  theme,
  selectedStock,
  selectedStockData,
  orders,
  realizedPnL,
  totalUnrealizedPnL,
}) {
  const stats = [
    ["Buying Power", "Not funded"],
    ["Active Symbol", selectedStock],
    ["Current Price", selectedStockData?.price ? `$${selectedStockData.price}` : "Unavailable"],
    ["Total Orders", orders.length],
  ];

  return (
    <>
      <h3 style={{ marginTop: "12px", fontSize: "13px" }}>
        Paper Account Summary
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "10px" }}>
        {stats.map(([label, value]) => (
          <div
            key={label}
            style={{
              background: theme.panel2,
              border: `1px solid ${theme.border}`,
              borderRadius: "6px",
              padding: "7px",
              minWidth: 0,
            }}
          >
            <div style={{ color: theme.muted, fontWeight: 900 }}>{label}</div>
            <div
              style={{
                color: theme.text,
                fontWeight: 900,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {value}
            </div>
          </div>
        ))}

        <div
          style={{
            gridColumn: "1 / -1",
            background: theme.panel2,
            border: `1px solid ${theme.border}`,
            borderRadius: "6px",
            padding: "7px",
            lineHeight: "1.55",
          }}
        >
          <div>
            Realized P&L{" "}
            <span
              style={{
                color: realizedPnL >= 0 ? theme.green : theme.red,
                fontWeight: 900,
              }}
            >
              ${Number(realizedPnL).toFixed(2)}
            </span>
          </div>

          <div>
            Unrealized P&L{" "}
            <span
              style={{
                color: totalUnrealizedPnL >= 0 ? theme.green : theme.red,
                fontWeight: 900,
              }}
            >
              ${Number(totalUnrealizedPnL).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
