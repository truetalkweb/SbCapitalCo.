export default function OrderTicket({
  theme,
  buttonStyle,
  orderSide,
  setOrderSide,
  orderType,
  setOrderType,
  quantity,
  setQuantity,
  limitPrice,
  setLimitPrice,
  stopLoss,
  setStopLoss,
  takeProfit,
  setTakeProfit,
  selectedStock,
  selectedStockData,
  orderEntryPrice,
  estimatedValue,
  riskReward,
  orderRisk,
  orderReward,
  submitOrderTicket,
  orderMessage,
}) {
  return (
    <>
      <h3 style={{ marginTop: "12px", fontSize: "13px" }}>Professional Order Ticket</h3>

      <div
        style={{
          background: theme.panel2,
          border: `1px solid ${theme.border}`,
          borderRadius: "8px",
          padding: "9px",
          display: "grid",
          gap: "8px",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <button
            onClick={() => setOrderSide("BUY")}
            style={{
              ...buttonStyle(orderSide === "BUY"),
              background: orderSide === "BUY" ? theme.green : theme.panel,
              border: orderSide === "BUY" ? "none" : `1px solid ${theme.border}`,
            }}
          >
            BUY
          </button>

          <button
            onClick={() => setOrderSide("SELL")}
            style={{
              ...buttonStyle(orderSide === "SELL"),
              background: orderSide === "SELL" ? theme.red : theme.panel,
              border: orderSide === "SELL" ? "none" : `1px solid ${theme.border}`,
            }}
          >
            SELL
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <button
            onClick={() => setOrderType("MARKET")}
            style={buttonStyle(orderType === "MARKET")}
          >
            Market
          </button>

          <button
            onClick={() => setOrderType("LIMIT")}
            style={buttonStyle(orderType === "LIMIT")}
          >
            Limit
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <label style={{ fontSize: "10px", color: theme.muted }}>
            Quantity
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                color: theme.text,
                borderRadius: "5px",
                marginTop: "4px",
                fontSize: "11px",
              }}
            />
          </label>

          <label style={{ fontSize: "10px", color: theme.muted }}>
            Limit Price
            <input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              disabled={orderType !== "LIMIT"}
              placeholder={String(selectedStockData?.price || "")}
              style={{
                width: "100%",
                padding: "8px",
                background: orderType === "LIMIT" ? theme.panel : "rgba(127,127,127,0.10)",
                border: `1px solid ${theme.border}`,
                color: theme.text,
                borderRadius: "5px",
                marginTop: "4px",
                fontSize: "11px",
                opacity: orderType === "LIMIT" ? 1 : 0.55,
              }}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <label style={{ fontSize: "10px", color: theme.muted }}>
            Stop Loss
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="Optional"
              style={{
                width: "100%",
                padding: "8px",
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                color: theme.text,
                borderRadius: "5px",
                marginTop: "4px",
                fontSize: "11px",
              }}
            />
          </label>

          <label style={{ fontSize: "10px", color: theme.muted }}>
            Take Profit
            <input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="Optional"
              style={{
                width: "100%",
                padding: "8px",
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                color: theme.text,
                borderRadius: "5px",
                marginTop: "4px",
                fontSize: "11px",
              }}
            />
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
            fontSize: "10px",
            lineHeight: "1.5",
            color: theme.muted,
          }}
        >
          <div>
            Symbol: <b style={{ color: theme.text }}>{selectedStock}</b>
          </div>
          <div>
            Entry: <b style={{ color: theme.text }}>${Number(orderEntryPrice || 0).toFixed(2)}</b>
          </div>
          <div>
            Est. Value: <b style={{ color: theme.text }}>${estimatedValue}</b>
          </div>
          <div>
            R:R: <b style={{ color: theme.blue }}>{riskReward}</b>
          </div>
          <div>
            Risk: <b style={{ color: orderRisk > 0 ? theme.red : theme.text }}>${orderRisk.toFixed(2)}</b>
          </div>
          <div>
            Reward: <b style={{ color: orderReward > 0 ? theme.green : theme.text }}>${orderReward.toFixed(2)}</b>
          </div>
        </div>

        <button
          onClick={submitOrderTicket}
          style={{
            ...buttonStyle(true),
            width: "100%",
            background: orderSide === "BUY" ? theme.green : theme.red,
            border: "none",
          }}
        >
          Submit Paper {orderSide}
        </button>

        <div style={{ fontSize: "10px", color: theme.muted, lineHeight: "1.4" }}>
          {orderMessage ||
            "Paper execution only. Real broker routing can be connected later through the Questrade order API."}
        </div>
      </div>
    </>
  );
}