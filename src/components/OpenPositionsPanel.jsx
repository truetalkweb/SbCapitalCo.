import { buildPositionRows } from "../utils/portfolioAccounting.js";
import { money } from "./premium/premiumWorkspaceData.js";
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
        buildPositionRows(positions, allSymbols).map((pos) => {
          const symbol = pos.symbol;
          const unrealized = pos.unrealizedPnl;
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
                <span style={{ color: theme.muted }}>Qty {pos.qty}</span>
              </div>

              <div>
                Avg {money(pos.avg)} / Unrealized{" "}
                <span
                  style={{
                    color:
                      unrealized >= 0
                        ? theme.green
                        : theme.red,
                    fontWeight: 900,
                  }}
                >
                  {money(unrealized)}
                </span>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
