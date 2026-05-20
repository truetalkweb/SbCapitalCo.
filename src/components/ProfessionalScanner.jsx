export default function ProfessionalScanner({
  theme,
  scannerTab,
  setScannerTab,
  scannerStocks = [],
  selectMainSymbol,
}) {
  const tabs = ["Gainers", "Losers", "Active", "Momentum", "Relative Volume", "AI Movers"];

  function scoreStock(stock) {
    const change = parseFloat(String(stock.change).replace("%", "")) || 0;
    const volumeRaw = String(stock.volume || "0");

    const volume = volumeRaw.includes("B")
      ? parseFloat(volumeRaw) * 1000
      : volumeRaw.includes("M")
      ? parseFloat(volumeRaw)
      : volumeRaw.includes("K")
      ? parseFloat(volumeRaw) / 1000
      : parseFloat(volumeRaw) || 0;

    return Math.max(0, change * 2.2 + volume * 0.15).toFixed(1);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: "5px", marginBottom: "6px", flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setScannerTab(tab)}
            style={{
              height: "24px",
              padding: "0 8px",
              borderRadius: "5px",
              border: `1px solid ${theme.border}`,
              background: scannerTab === tab ? theme.blue : theme.panel2,
              color: scannerTab === tab ? "#fff" : theme.text,
              cursor: "pointer",
              fontSize: "10px",
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
          gridTemplateColumns: "1.15fr 1fr 1fr 1fr 0.8fr",
          padding: "6px 4px",
          borderBottom: `1px solid ${theme.border}`,
          color: theme.muted,
          fontSize: "9px",
          fontWeight: 900,
          letterSpacing: "0.3px",
        }}
      >
        <div>SYMBOL</div>
        <div>PRICE</div>
        <div>CHANGE</div>
        <div>VOLUME</div>
        <div>AI</div>
      </div>

      <div style={{ maxHeight: "235px", overflowY: "auto" }}>
        {scannerStocks.map((stock, index) => {
          const positive = String(stock.change).includes("+");

          return (
            <div
              key={`${stock.symbol}-${index}`}
              onClick={() => selectMainSymbol(stock.symbol)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              style={{
                display: "grid",
                gridTemplateColumns: "1.15fr 1fr 1fr 1fr 0.8fr",
                padding: "6px 4px",
                borderBottom: `1px solid ${theme.border}`,
                cursor: "pointer",
                fontSize: "10px",
                alignItems: "center",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ fontWeight: 900, color: theme.text }}>{stock.symbol}</div>
              <div>${stock.price}</div>
              <div style={{ color: positive ? theme.green : theme.red, fontWeight: 800 }}>
                {stock.change}
              </div>
              
              <div>{stock.volume}</div>
              <div style={{ color: theme.blue, fontWeight: 900 }}>{scoreStock(stock)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}