export default function RecentOrdersPanel({
  theme,
  orders,
}) {
  return (
    <>
      <h3 style={{ marginTop: "12px", fontSize: "13px" }}>
        Recent Paper Orders
      </h3>

      {orders.length === 0 ? (
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
            No paper trades yet
          </div>
          <div>Submitted paper orders will appear here with fill value and realized P&L.</div>
        </div>
      ) : (
        orders.map((order) => (
          <div
            key={order.id}
            style={{
              borderBottom: `1px solid ${theme.border}`,
              padding: "4px 0",
              fontSize: "11px",
              lineHeight: "1.45",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <span
                style={{
                  color: order.side === "BUY" ? theme.green : theme.red,
                  fontWeight: 900,
                }}
              >
                {order.side} {order.symbol}
              </span>
              <span style={{ color: theme.muted }}>Qty {order.quantity}</span>
            </div>

            <div>Price ${order.price} / Value ${order.value}</div>

            {order.auditId && (
              <div style={{ color: theme.blue, fontWeight: 900 }}>
                Audit {order.auditId} - {order.auditStatus || "Guardrails Passed"}
              </div>
            )}

            {order.guardrails && (
              <div style={{ color: theme.muted }}>
                Max ${Number(order.guardrails.maxOrderValue || 0).toFixed(2)} / Risk $
                {Number(order.guardrails.orderRisk || 0).toFixed(2)}
              </div>
            )}

            {order.realizedPnL !== null && (
              <div>
                P&L:{" "}
                <span
                  style={{
                    color:
                      Number(order.realizedPnL) >= 0
                        ? theme.green
                        : theme.red,
                    fontWeight: 900,
                  }}
                >
                  ${order.realizedPnL}
                </span>
              </div>
            )}

            <div style={{ color: theme.muted }}>
              {order.time}
            </div>
          </div>
        ))
      )}
    </>
  );
}
