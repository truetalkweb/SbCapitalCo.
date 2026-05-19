export default function TickerTape({ theme, stocks = [], onPick }) {
  const winners = stocks.filter((s) => String(s.change).includes("+")).length;
  const losers = stocks.filter((s) => String(s.change).includes("-")).length;

  return (
    <div
      style={{
        height: "26px",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        background: theme.panel2,
        borderTop: `1px solid ${theme.border}`,
        borderBottom: `1px solid ${theme.border}`,
        color: theme.text,
        fontSize: "11px",
      }}
    >
      <div
        style={{
          padding: "0 10px",
          fontWeight: 900,
          color: theme.blue,
          borderRight: `1px solid ${theme.border}`,
          whiteSpace: "nowrap",
        }}
      >
        MARKET BREADTH ▲ {winners} ▼ {losers}
      </div>

      <div
        style={{
          display: "flex",
          gap: "18px",
          whiteSpace: "nowrap",
          animation: "tickerMove 38s linear infinite",
          paddingLeft: "14px",
        }}
      >
        {[...stocks, ...stocks].map((stock, index) => {
          const positive = String(stock.change).includes("+");

          return (
            <div
              key={`${stock.symbol}-${index}`}
              onClick={() => onPick(stock.symbol)}
              style={{
                cursor: "pointer",
                display: "flex",
                gap: "5px",
                alignItems: "center",
              }}
            >
              <b>{stock.symbol}</b>
              <span>${stock.price}</span>
              <span style={{ color: positive ? theme.green : theme.red }}>
                {stock.change}
              </span>
            </div>
          );
        })}
      </div>

      <style>
        {`
          @keyframes tickerMove {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
        `}
      </style>
    </div>
  );
}