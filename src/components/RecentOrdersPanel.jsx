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
        <p style={{ color: theme.muted, fontSize: "11px" }}>
          No paper trades yet.
        </p>
      ) : (
        orders.map((order) => (
          <div
            key={order.id}
            style={{
              borderBottom: `1px solid ${theme.border}`,
              padding: "4px 0",
              fontSize: "11px",
            }}
          >
            <div
              style={{
                color: order.side === "BUY" ? theme.green : theme.red,
                fontWeight: 900,
              }}
            >
              {order.side} {order.symbol}
            </div>

            <div>Qty: {order.quantity}</div>
            <div>Price: ${order.price}</div>
            <div>Value: ${order.value}</div>

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