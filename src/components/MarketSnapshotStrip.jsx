function parseNumber(value) {
  const parsed = Number(String(value ?? "").replace(/[$,%+,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function Sparkline({ points = [], color, compact = false }) {
  const values = points.length >= 2 ? points : [];
  const height = compact ? 18 : 32;
  const width = compact ? 72 : 92;
  if (!values.length) {
    return <span style={{ width, color, fontSize: compact ? 8 : 10, textAlign: "center" }}>No data</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const d = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - 4 - ((value - min) / range) * (height - 8);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ width: `${width}px`, height: `${height}px`, display: "block" }}>
      <path d={d} fill="none" stroke={color} strokeWidth={compact ? "1.7" : "2"} strokeLinecap="round" strokeLinejoin="round" />
      <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill={color} opacity="0.10" />
    </svg>
  );
}

export default function MarketSnapshotStrip({ theme, stocks = [], onPick, compact = false }) {
  const monoFont =
    '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace';
  const wanted = ["SPY", "QQQ", "DIA", "IWM", "VIX"];
  const rows = wanted.map((symbol) => {
    const match = stocks.find((stock) => String(stock.symbol || "").toUpperCase() === symbol);
    return {
      ...(match || {}),
      symbol,
    };
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(118px, 1fr))",
        gap: "0",
        minHeight: compact ? "42px" : "78px",
        border: `1px solid ${theme.borderSoft || theme.border}`,
        borderRadius: compact ? "7px" : "9px",
        overflow: "hidden",
        background: theme.panel,
      }}
    >
      {rows.map((stock, index) => {
        const parsedPrice = parseNumber(stock.price ?? stock.last);
        const price = parsedPrice !== null && parsedPrice > 0 ? parsedPrice : null;
        const move = price === null ? null : parseNumber(stock.changePercent ?? stock.change ?? stock.percentChange);
        const isUp = move !== null && move >= 0;
        const color = move === null ? theme.muted : isUp ? theme.green : theme.red;

        return (
          <button
            key={stock.symbol}
            type="button"
            onClick={() => onPick?.(stock.symbol)}
            style={{
              minWidth: 0,
              display: "grid",
              gridTemplateColumns: compact ? "minmax(0, 1fr) 72px" : "1fr auto",
              gap: compact ? "7px" : "10px",
              alignItems: "center",
              padding: compact ? "4px 9px" : "11px 13px",
              background: "transparent",
              color: theme.text,
              border: "none",
              borderRight: index === rows.length - 1 ? "none" : `1px solid ${theme.borderSoft || theme.border}`,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: monoFont, fontSize: compact ? "9px" : "12px", lineHeight: 1, color: theme.muted, fontWeight: 800 }}>
                {stock.symbol}
              </span>
              <span style={{ display: "block", marginTop: compact ? "2px" : "5px", fontFamily: monoFont, fontSize: compact ? "13px" : "18px", lineHeight: 1, fontWeight: 850 }}>
                {price ? price.toFixed(2) : "Quote"}
              </span>
              <span style={{ display: "block", marginTop: compact ? "2px" : "4px", fontFamily: monoFont, color, fontSize: compact ? "9px" : "11px", lineHeight: 1, fontWeight: 850 }}>
                {move === null ? "Unavailable" : `${move >= 0 ? "+" : ""}${move.toFixed(2)}%`}
              </span>
            </span>
            <Sparkline color={color} points={stock.sparkline} compact={compact} />
          </button>
        );
      })}
    </div>
  );
}
