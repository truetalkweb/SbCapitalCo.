export default function PaperAccountPanel({
  theme,
  selectedStock,
  selectedStockData,
  orders,
  realizedPnL,
  totalUnrealizedPnL,
}) {
  return (
    <>
      <h3 style={{ marginTop: "12px", fontSize: "13px" }}>
        Paper Account Summary
      </h3>

      <div style={{ fontSize: "11px", lineHeight: "1.65" }}>
        <div>Buying Power: $100,000.00</div>
        <div>Active Symbol: {selectedStock}</div>
        <div>Current Price: ${selectedStockData?.price}</div>
        <div>Total Orders: {orders.length}</div>

        <div>
          Realized P&L:{" "}
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
          Unrealized P&L:{" "}
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
    </>
  );
}