import { terminalMonoFont } from "../config/terminalConfig";

export default function ScannerTable({ rows = [], onPick, theme }) {
  const monoStyle = {
    fontFamily: terminalMonoFont,
    fontVariantNumeric: "tabular-nums",
  };
  const visibleRows = rows.slice(0, 9);

  function parseNumber(value) {
    const parsed = Number.parseFloat(String(value ?? "").replace(/[$,%x,]/g, ""));

    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseMove(stock) {
    return parseNumber(stock.changePercent ?? stock.change ?? stock.intradayMovePercent);
  }

  function formatPrice(value) {
    const parsed = parseNumber(value);

    return parsed && parsed > 0 ? `$${parsed.toFixed(2)}` : "QUOTE";
  }

  function formatMove(move) {
    if (move === null) return "LIVE";
    if (Math.abs(move) < 0.005) return "FLAT";

    return `${move > 0 ? "+" : ""}${move.toFixed(2)}%`;
  }

  function formatVolume(stock) {
    const rvol = parseNumber(stock.relativeVolume ?? stock.rvol);

    if (rvol && rvol > 0) return `${rvol.toFixed(1)}x`;

    const volumeRaw = String(stock.volume || "").toUpperCase();
    if (volumeRaw && volumeRaw !== "-") return volumeRaw;

    return "ACTIVE";
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
        background: theme.panel2,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.025)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 0.9fr 0.82fr 0.76fr",
          gap: "8px",
          padding: "7px 8px",
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
        <span style={{ textAlign: "right" }}>Flow</span>
      </div>

      {visibleRows.map((stock, index) => {
        const move = parseMove(stock);

        return (
          <button
            key={`${stock.symbol}-${index}`}
            data-smallcap-symbol={stock.symbol}
            onClick={() => onPick?.(stock.symbol, stock)}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = "rgba(255,255,255,0.026)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "transparent";
            }}
            style={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: "1fr 0.9fr 0.82fr 0.76fr",
              gap: "8px",
              alignItems: "center",
              padding: "7px 8px",
              background: "transparent",
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
                  fontSize: "8px",
                  fontWeight: 800,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {stock.catalystType || stock.source || "Small Cap"}
              </span>
            </span>
            <span style={{ ...monoStyle, color: theme.text, fontWeight: 750, textAlign: "right" }}>
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
              {formatVolume(stock)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
