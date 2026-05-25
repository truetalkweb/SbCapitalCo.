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
            fontSize: "11px",
          }}
        >
          No open positions
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
              }}
            >
              <div style={{ fontWeight: 900 }}>
                {symbol}
              </div>

              <div>Qty: {pos.quantity}</div>

              <div>
                Avg: ${pos.average.toFixed(2)}
              </div>

              <div>
                Unrealized:{" "}
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