export default function BrokerPositions({
  theme,
  brokerPositions,
  brokerOrders,
}) {
  return (
    <>
      {brokerPositions.length > 0 && (
        <>
          <h3 style={{ marginTop: "12px", fontSize: "13px" }}>Live Positions</h3>

          {brokerPositions.slice(0, 6).map((position, index) => (
            <div
              key={`${position.symbol}-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "5px",
                padding: "4px 0",
                borderBottom: `1px solid ${theme.border}`,
                fontSize: "10px",
              }}
            >
              <span style={{ fontWeight: 900 }}>{position.symbol}</span>
              <span>Qty {position.openQuantity}</span>
              <span
                style={{
                  color: Number(position.openPnl || 0) >= 0 ? theme.green : theme.red,
                  textAlign: "right",
                }}
              >
                ${Number(position.openPnl || 0).toFixed(2)}
              </span>
            </div>
          ))}
        </>
      )}

      {brokerOrders.length > 0 && (
        <>
          <h3 style={{ marginTop: "12px", fontSize: "13px" }}>Live Orders</h3>

          {brokerOrders.slice(0, 5).map((order, index) => (
            <div
              key={`${order.id || index}`}
              style={{
                padding: "4px 0",
                borderBottom: `1px solid ${theme.border}`,
                fontSize: "10px",
              }}
            >
              <div style={{ fontWeight: 900 }}>
                {order.action} {order.symbol}
              </div>

              <div>
                Qty: {order.totalQuantity} · Status: {order.state}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}