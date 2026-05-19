export default function ProfessionalScanner({
  theme,
  scannerTab,
  setScannerTab,
  scannerStocks,
  selectMainSymbol,
}) {
  const tabs = [
    "Gainers",
    "Losers",
    "Active",
    "Momentum",
    "Relative Volume",
    "AI Movers",
  ];

  function scoreStock(stock) {
    const change = parseFloat(String(stock.change).replace("%", "")) || 0;
    const volume = parseFloat(String(stock.volume).replace(/[A-Z]/g, "")) || 0;

    return (change * 1.7 + volume * 0.4).toFixed(1);
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "6px",
          marginBottom: "10px",
          flexWrap: "wrap",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setScannerTab(tab)}
            style={{
              height: "28px",
              padding: "0 10px",
              borderRadius: "6px",
              border: `1px solid ${theme.border}`,
              background:
                scannerTab === tab ? theme.blue : theme.panel2,
              color:
                scannerTab === tab ? "#fff" : theme.text,
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr",
          padding: "8px 6px",
          borderBottom: `1px solid ${theme.border}`,
          color: theme.muted,
          fontSize: "10px",
          fontWeight: 900,
          letterSpacing: "0.3px",
        }}
      >
        <div>SYMBOL</div>
        <div>PRICE</div>
        <div>CHANGE</div>
        <div>VOLUME</div>
        <div>AI SCORE</div>
      </div>

      <div
        style={{
          overflowY: "auto",
          flex: 1,
        }}
      >
        {scannerStocks.map((stock, index) => {
          const positive =
            String(stock.change).includes("+");

          return (
            <div
              key={`${stock.symbol}-${index}`}
              onClick={() => selectMainSymbol(stock.symbol)}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr",
                padding: "9px 6px",
                borderBottom: `1px solid ${theme.border}`,
                cursor: "pointer",
                fontSize: "11px",
                alignItems: "center",
                transition: "0.15s",
              }}
            >
              <div
                style={{
                  fontWeight: 900,
                  color: theme.text,
                }}
              >
                {stock.symbol}
              </div>

              <div>${stock.price}</div>

              <div
                style={{
                  color: positive
                    ? theme.green
                    : theme.red,
                  fontWeight: 800,
                }}
              >
                {stock.change}
              </div>

              <div>{stock.volume}</div>

              <div
                style={{
                  color: theme.blue,
                  fontWeight: 900,
                }}
              >
                {scoreStock(stock)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}