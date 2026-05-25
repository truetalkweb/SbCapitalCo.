export default function DOMPanel({
  theme,
  ladderRows,
  selectedStockData,
  level2,
}) {
  return (
    <>
      <h3 style={{ marginTop: "12px", fontSize: "13px" }}>
        DOM Ladder + Depth Heatmap
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 70px 1fr",
          gap: "2px",
          fontSize: "10px",
          color: theme.muted,
          paddingBottom: "4px",
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <span>Bid</span>
        <span style={{ textAlign: "center" }}>Price</span>
        <span style={{ textAlign: "right" }}>Ask</span>
      </div>

      {ladderRows.map((row) => (
        <div
          key={row.price}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 70px 1fr",
            gap: "2px",
            alignItems: "center",
            minHeight: "20px",
            fontSize: "10px",
            background: row.isLast
              ? "rgba(33,150,243,0.12)"
              : "transparent",
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <div style={{ position: "relative", textAlign: "left", overflow: "hidden" }}>
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 2,
                bottom: 2,
                width: row.bidWidth,
                background: "rgba(0,200,150,0.22)",
              }}
            />
            <span style={{ position: "relative", color: theme.green }}>
              {row.bidSize || ""}
            </span>
          </div>

          <div
            style={{
              textAlign: "center",
              fontWeight: 900,
              color: row.isLast ? theme.blue : theme.text,
            }}
          >
            {row.price}
          </div>

          <div style={{ position: "relative", textAlign: "right", overflow: "hidden" }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 2,
                bottom: 2,
                width: row.askWidth,
                background: "rgba(239,83,80,0.22)",
              }}
            />
            <span style={{ position: "relative", color: theme.red }}>
              {row.askSize || ""}
            </span>
          </div>
        </div>
      ))}

      <h3 style={{ marginTop: "12px", fontSize: "13px" }}>Level 1</h3>

      <div style={{ fontSize: "11px", lineHeight: "1.6" }}>
        <div>Last: ${selectedStockData?.price}</div>
        <div>Change: {selectedStockData?.change}</div>
        <div>Volume: {selectedStockData?.volume}</div>
        <div>
          Bid: $
          {(Number(selectedStockData?.price || 0) - 0.05).toFixed(2)}
        </div>
        <div>
          Ask: $
          {(Number(selectedStockData?.price || 0) + 0.05).toFixed(2)}
        </div>
      </div>

      <h3 style={{ marginTop: "12px", fontSize: "13px" }}>Level 2</h3>

      {level2.map((row, index) => (
        <div
          key={`${row.marketMaker}-${index}`}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            padding: "4px 0",
            borderBottom: `1px solid ${theme.border}`,
            fontSize: "10px",
          }}
        >
          <span>{row.marketMaker}</span>
          <span>{row.bid}</span>
          <span>{row.ask}</span>
          <span style={{ textAlign: "right" }}>{row.size}</span>
        </div>
      ))}
    </>
  );
}