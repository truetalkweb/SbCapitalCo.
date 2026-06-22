import { dashboardMockMarketIndexes } from "../mocks/dashboardMockData";

function parseNumber(value) {
  const parsed = Number(String(value ?? "").replace(/[$,%+,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function Sparkline({ points = [], color }) {
  const values = points.length >= 2 ? points : [0.2, 0.36, 0.31, 0.48, 0.42, 0.62, 0.71];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const d = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 92;
      const y = 28 - ((value - min) / range) * 24;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 92 32" aria-hidden="true" style={{ width: "92px", height: "32px", display: "block" }}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`${d} L 92 32 L 0 32 Z`} fill={color} opacity="0.10" />
    </svg>
  );
}

export default function MarketSnapshotStrip({ theme, stocks = [], onPick }) {
  const monoFont =
    '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace';
  const wanted = ["SPY", "QQQ", "DIA", "IWM", "VIX"];
  const rows = wanted.map((symbol, index) => {
    const match = stocks.find((stock) => String(stock.symbol || "").toUpperCase() === symbol);
    const fallback = dashboardMockMarketIndexes[index];
    return {
      ...fallback,
      ...match,
      symbol,
    };
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(132px, 1fr))",
        gap: "0",
        minHeight: "78px",
        border: `1px solid ${theme.borderSoft || theme.border}`,
        borderRadius: "9px",
        overflow: "hidden",
        background: theme.panel,
      }}
    >
      {rows.map((stock, index) => {
        const move = parseNumber(stock.changePercent ?? stock.change ?? stock.percentChange);
        const isUp = move === null ? index < 3 : move >= 0;
        const color = isUp ? theme.green : theme.red;
        const price = parseNumber(stock.price ?? stock.last);

        return (
          <button
            key={stock.symbol}
            type="button"
            onClick={() => onPick?.(stock.symbol)}
            style={{
              minWidth: 0,
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "10px",
              alignItems: "center",
              padding: "11px 13px",
              background: "transparent",
              color: theme.text,
              border: "none",
              borderRight: index === rows.length - 1 ? "none" : `1px solid ${theme.borderSoft || theme.border}`,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: monoFont, fontSize: "12px", color: theme.muted, fontWeight: 800 }}>
                {stock.symbol}
              </span>
              <span style={{ display: "block", marginTop: "5px", fontFamily: monoFont, fontSize: "18px", fontWeight: 850 }}>
                {price ? price.toFixed(2) : "Quote"}
              </span>
              <span style={{ display: "block", marginTop: "4px", fontFamily: monoFont, color, fontSize: "11px", fontWeight: 850 }}>
                {move === null ? "Live" : `${move >= 0 ? "+" : ""}${move.toFixed(2)}%`}
              </span>
            </span>
            <Sparkline color={color} points={stock.sparkline} />
          </button>
        );
      })}
    </div>
  );
}
