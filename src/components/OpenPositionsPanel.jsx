export default function OpenPositionsPanel({
  theme,
  positions,
  allSymbols,
}) {
  return (
    <>
      <h3 style={{ marginTop: "12px", fontSize: "13px" }}>
        Open Positions
      </h3>

      {Object.keys(positions).length === 0 ? (
        <div
          style={{
            color: theme.muted,
            border: `1px dashed ${theme.border}`,
            borderRadius: "6px",
            background: theme.panel2,
            padding: "10px",
            fontSize: "11px",
            lineHeight: "1.45",
          }}
        >
          <div style={{ color: theme.text, fontWeight: 900, marginBottom: "3px" }}>
            No open paper positions
          </div>
          <div>New paper fills will appear here with quantity, average cost, and unrealized P&L.</div>
        </div>
      ) : (
        Object.entries(positions).map(([symbol, pos]) => {
          const live =
            Number(
              allSymbols.find((s) => s.symbol === symbol)?.price || 0
            );

          const unrealized =
            (live - pos.average) * pos.quantity;

          return (
            <div
              key={symbol}
              style={{
                padding: "4px 0",
                borderBottom: `1px solid ${theme.border}`,
                fontSize: "11px",
                lineHeight: "1.45",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                <span style={{ fontWeight: 900 }}>{symbol}</span>
                <span style={{ color: theme.muted }}>Qty {pos.quantity}</span>
              </div>

              <div>
                Avg ${pos.average.toFixed(2)} / Unrealized{" "}
                <span
                  style={{
                    color:
                      unrealized >= 0
                        ? theme.green
                        : theme.red,
                    fontWeight: 900,
                  }}
                >
                  ${unrealized.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
