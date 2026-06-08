export default function TickerTape({ theme, stocks = [], onPick }) {
  const monoFont =
    '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace';

  function parseMove(stock) {
    const raw = stock?.changePercent ?? stock?.change ?? stock?.percentChange ?? null;
    const parsed = Number.parseFloat(String(raw ?? "").replace("%", "").replace("+", "").trim());

    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatPrice(stock) {
    const value = Number(String(stock?.price ?? stock?.last ?? "").replace(/[$,]/g, ""));

    if (!Number.isFinite(value) || value <= 0) return "QUOTE";
    if (String(stock?.symbol || "").includes("/")) return value.toFixed(4);

    return `$${value.toFixed(2)}`;
  }

  function formatMove(move, hasLivePrice) {
    if (move === null) return hasLivePrice ? "LIVE" : "PENDING";
    if (Math.abs(move) < 0.005) return "FLAT";

    return `${move > 0 ? "+" : ""}${move.toFixed(2)}%`;
  }

  function moveColor(move) {
    if (move === null || Math.abs(move) < 0.005) return theme.muted;

    return move > 0 ? theme.green : theme.red;
  }

  const uniqueStocks = stocks.reduce((items, stock) => {
    const symbol = String(stock?.symbol || "").trim().toUpperCase();
    const price = Number(String(stock?.price ?? stock?.last ?? "").replace(/[$,]/g, ""));

    if (!symbol || items.some((item) => item.symbol === symbol)) return items;

    items.push({
      ...stock,
      symbol,
      hasLivePrice: Number.isFinite(price) && price > 0,
      move: parseMove(stock),
    });

    return items;
  }, []);
  const winners = uniqueStocks.filter((stock) => Number(stock.move) > 0).length;
  const losers = uniqueStocks.filter((stock) => Number(stock.move) < 0).length;
  const displayStocks = uniqueStocks.length ? [...uniqueStocks, ...uniqueStocks] : [];

  return (
    <div
      style={{
        height: "26px",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        background: theme.panel,
        borderTop: `1px solid ${theme.border}`,
        borderBottom: `1px solid ${theme.border}`,
        color: theme.text,
        fontSize: "11px",
        fontFamily: monoFont,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <div
        style={{
          padding: "0 10px",
          fontWeight: 900,
          color: theme.cyan || theme.blue,
          borderRight: `1px solid ${theme.border}`,
          background: theme.panel2,
          whiteSpace: "nowrap",
          flexShrink: 0,
          minWidth: "138px",
          height: "100%",
          display: "flex",
          alignItems: "center",
          position: "relative",
          zIndex: 2,
        }}
      >
        BREADTH ADV {winners} DEC {losers}
      </div>

      <div
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          height: "100%",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "18px",
            whiteSpace: "nowrap",
            width: "max-content",
            minWidth: "max-content",
            animation: "tickerMove 38s linear infinite",
            paddingLeft: "16px",
            height: "100%",
            alignItems: "center",
            willChange: "transform",
          }}
        >
          {displayStocks.map((stock, index) => (
            <div
              key={`${stock.symbol}-${index}`}
              data-ticker-symbol={stock.symbol}
              onClick={() => onPick?.(stock.symbol)}
              style={{
                cursor: "pointer",
                display: "inline-grid",
                gridTemplateColumns: "minmax(46px, auto) minmax(58px, auto) minmax(54px, auto)",
                columnGap: "7px",
                alignItems: "center",
                color: theme.text,
                minWidth: "154px",
                flex: "0 0 auto",
              }}
            >
              <b style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{stock.symbol}</b>
              <span style={{ textAlign: "right", color: stock.hasLivePrice ? theme.text : theme.muted }}>
                {formatPrice(stock)}
              </span>
              <span style={{ color: moveColor(stock.move), textAlign: "right", fontWeight: 800 }}>
                {formatMove(stock.move, stock.hasLivePrice)}
              </span>
            </div>
          ))}
        </div>
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
