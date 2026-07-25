import { terminalMonoFont } from "../config/terminalConfig";

export default function ScannerTable({ rows = [], onPick, theme }) {
  const monoStyle = {
    fontFamily: terminalMonoFont,
    fontVariantNumeric: "tabular-nums",
  };
  const visibleRows = rows.slice(0, 12);
  const gridColumns = "minmax(92px, 1.15fr) 82px 78px 70px 72px";
  const isDark = theme.isDark !== false;
  const rowHoverBackground = isDark ? "rgba(255,255,255,0.026)" : "rgba(45,140,255,0.055)";
  const rowBackground = isDark ? "transparent" : "rgba(255,255,255,0.58)";
  const headerBackground = isDark ? theme.panel2 : "#f8fafc";

  function parseNumber(value) {
    const parsed = Number.parseFloat(String(value ?? "").replace(/[$,%x,]/g, ""));

    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseMove(stock) {
    return parseNumber(stock.changePercent ?? stock.change ?? stock.intradayMovePercent);
  }

  function formatPrice(value) {
    const parsed = parseNumber(value);

    return parsed && parsed > 0 ? `$${parsed.toFixed(2)}` : "PENDING";
  }

  function formatMove(move) {
    if (move === null) return "PENDING";
    if (Math.abs(move) < 0.005) return "0.01%";

    return `${move > 0 ? "+" : ""}${move.toFixed(2)}%`;
  }

  function formatRvol(stock) {
    const rvol = parseNumber(stock.relativeVolume ?? stock.rvol);

    if (rvol && rvol > 0) return `${rvol.toFixed(1)}x`;

    return "1.0x";
  }

  function formatFlow(stock) {
    const volumeRaw = String(stock.volume || "").toUpperCase();
    if (volumeRaw && volumeRaw !== "-") return volumeRaw;

    return "ACTIVE";
  }

  function formatScore(stock, move) {
    const score = parseNumber(stock.scannerScore ?? stock.score);

    if (score && score > 0) return score.toFixed(1);
    if (move !== null) return Math.max(1, Math.min(99, Math.abs(move) * 7)).toFixed(1);

    return "1.0";
  }

  function moveColor(move) {
    if (move === null || Math.abs(move) < 0.005) return theme.muted;

    return move > 0 ? theme.green : theme.red;
  }

  return (
    <div
      style={{
        border: `1px solid ${theme.borderSoft || theme.border}`,
        borderRadius: "7px",
        overflow: "hidden",
        background: headerBackground,
        boxShadow: isDark ? "inset 0 1px 0 rgba(255,255,255,0.025)" : "0 1px 2px rgba(15,23,42,0.03)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridColumns,
          gap: "6px",
          padding: "8px 10px",
          color: theme.muted,
          fontSize: "9px",
          fontWeight: 950,
          textTransform: "uppercase",
          borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
        }}
      >
        <span>Symbol</span>
        <span style={{ textAlign: "right" }}>Price</span>
        <span style={{ textAlign: "right" }}>Move</span>
        <span style={{ textAlign: "right" }}>RVOL</span>
        <span style={{ textAlign: "right" }}>Score</span>
      </div>

      {visibleRows.map((stock, index) => {
        const move = parseMove(stock);

        return (
          <button
            key={`${stock.symbol}-${index}`}
            data-smallcap-symbol={stock.symbol}
            onClick={() => onPick?.(stock.symbol, stock, "scanner-row")}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = rowHoverBackground;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = rowBackground;
            }}
            style={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: gridColumns,
              gap: "6px",
              alignItems: "center",
              minHeight: "42px",
              padding: "7px 10px",
              background: rowBackground,
              border: "none",
              borderBottom:
                index === visibleRows.length - 1 ? "none" : `1px solid ${theme.borderSoft || theme.border}`,
              cursor: "pointer",
              fontSize: "10px",
              textAlign: "left",
              transition: "background 0.15s ease",
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ ...monoStyle, display: "block", color: theme.text, fontWeight: 850 }}>
                {stock.symbol}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: "2px",
                  color: theme.muted,
                  fontSize: "8.5px",
                  fontWeight: 800,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {stock.catalystType || (String(stock.source || "").includes("FMP") ? "Provider" : stock.source) || "Context"}
              </span>
            </span>
            <span title={formatFlow(stock)} style={{ ...monoStyle, color: theme.text, fontWeight: 750, textAlign: "right" }}>
              {formatPrice(stock.price)}
            </span>
            <span
              style={{
                ...monoStyle,
                color: moveColor(move),
                fontWeight: 850,
                textAlign: "right",
              }}
            >
              {formatMove(move)}
            </span>
            <span style={{ ...monoStyle, color: theme.muted, fontWeight: 800, textAlign: "right" }}>
              {formatRvol(stock)}
            </span>
            <span style={{ ...monoStyle, color: theme.cyan || theme.blue, fontWeight: 850, textAlign: "right" }}>
              {formatScore(stock, move)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
