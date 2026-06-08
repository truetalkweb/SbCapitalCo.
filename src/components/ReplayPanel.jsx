function formatMoney(value) {
  const numericValue = Number(value || 0);
  return `$${numericValue.toFixed(2)}`;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function buildEquityPath(values, width = 220, height = 58) {
  if (!values.length) return "";

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(maxValue - minValue, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;

  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - minValue) / range) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function ReplayPanel({
  theme,
  buttonStyle,
  replayPlaying,
  setReplayPlaying,
  stepReplay,
  resetReplay,
  replaySpeed,
  setReplaySpeed,
  replayBuy,
  replaySell,
  replayIndex,
  mainReplayData,
  replayCandle,
  replayStats,
  replayTrades = [],
  replayEquity = [],
  selectedStock,
  openReplayJournal,
}) {
  const closedTrades = replayTrades.filter((trade) => trade.type === "SELL");
  const openBuys = replayTrades.filter((trade) => trade.type === "BUY" && !trade.closed);
  const lastClosedTrade = closedTrades[closedTrades.length - 1];
  const currentPrice = Number(replayCandle?.close || 0);
  const openExposure = openBuys.reduce(
    (total, trade) => total + Number(trade.qty || 0) * Number(trade.price || 0),
    0
  );
  const openQty = openBuys.reduce((total, trade) => total + Number(trade.qty || 0), 0);
  const unrealizedPnl = openBuys.reduce(
    (total, trade) => total + (currentPrice - Number(trade.price || 0)) * Number(trade.qty || 0),
    0
  );
  const completedProgress = mainReplayData.length
    ? Math.min(100, Math.max(0, (replayIndex / Math.max(mainReplayData.length - 1, 1)) * 100))
    : 0;
  const equityValues = replayEquity.length ? replayEquity.map((value) => Number(value || 0)) : [100000];
  const equityPath = buildEquityPath(equityValues);
  const isPositive = Number(replayStats.netPnL || 0) >= 0;

  const cardStyle = {
    background: `linear-gradient(180deg, ${theme.panel3 || theme.panel2}, ${theme.panel2})`,
    border: `1px solid ${theme.border}`,
    borderRadius: "7px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
  };
  const labelStyle = {
    color: theme.muted,
    fontSize: "9px",
    fontWeight: 900,
    textTransform: "uppercase",
  };
  const metricStyle = {
    fontSize: "13px",
    fontWeight: 950,
    color: theme.text,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "grid", gap: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "start" }}>
        <div>
          <h3 style={{ margin: "2px 0 2px", fontSize: "13px", fontWeight: 950 }}>
            Replay Lab
          </h3>
          <div style={{ color: theme.muted, fontSize: "10px", fontWeight: 800 }}>
            {selectedStock} backtest workspace
          </div>
        </div>
        <div
          style={{
            color: replayPlaying ? theme.green : theme.muted,
            border: `1px solid ${replayPlaying ? "rgba(0,200,150,0.55)" : theme.border}`,
            background: replayPlaying ? "rgba(0,200,150,0.09)" : theme.panel2,
            borderRadius: "999px",
            padding: "4px 7px",
            fontSize: "9px",
            fontWeight: 950,
            whiteSpace: "nowrap",
          }}
        >
          {replayPlaying ? "RUNNING" : "PAUSED"}
        </div>
      </div>

      <div style={{ ...cardStyle, padding: "9px", display: "grid", gap: "8px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px" }}>
          <button onClick={() => setReplayPlaying((prev) => !prev)} style={buttonStyle(replayPlaying)}>
            {replayPlaying ? "Pause" : "Play"}
          </button>
          <button onClick={stepReplay} style={buttonStyle(false)}>
            Step
          </button>
          <button onClick={resetReplay} style={buttonStyle(false)}>
            Reset
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px" }}>
          {[1, 2, 5].map((speed) => (
            <button
              key={speed}
              onClick={() => setReplaySpeed(speed)}
              style={buttonStyle(replaySpeed === speed)}
            >
              {speed}x
            </button>
          ))}
        </div>

        <div style={{ height: "6px", background: theme.panel, borderRadius: "999px", overflow: "hidden" }}>
          <div
            style={{
              width: `${completedProgress}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${theme.blue}, ${theme.green})`,
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", color: theme.muted, fontSize: "10px", fontWeight: 800 }}>
          <span>Candle {replayIndex} / {mainReplayData.length || 0}</span>
          <span>{formatMoney(currentPrice)}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "6px" }}>
        {[
          ["Equity", formatMoney(replayStats.equity), theme.text],
          ["Net P&L", formatMoney(replayStats.netPnL), isPositive ? theme.green : theme.red],
          ["Win Rate", formatPercent(replayStats.winRate), theme.blue],
          ["Trades", replayStats.totalTrades, theme.text],
        ].map(([label, value, color]) => (
          <div key={label} style={{ ...cardStyle, padding: "8px", minWidth: 0 }}>
            <div style={labelStyle}>{label}</div>
            <div style={{ ...metricStyle, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ ...cardStyle, padding: "9px", display: "grid", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 950 }}>Equity Curve</div>
            <div style={{ color: theme.muted, fontSize: "10px" }}>
              {equityValues.length} points from replay fills
            </div>
          </div>
          <div style={{ color: isPositive ? theme.green : theme.red, fontSize: "11px", fontWeight: 950 }}>
            {formatMoney(replayStats.netPnL)}
          </div>
        </div>

        <svg viewBox="0 0 220 58" role="img" aria-label="Replay equity curve" style={{ width: "100%", height: "58px", display: "block" }}>
          <line x1="0" y1="48" x2="220" y2="48" stroke={theme.border} strokeWidth="1" />
          <path d={equityPath} fill="none" stroke={isPositive ? theme.green : theme.red} strokeWidth="2.4" strokeLinecap="round" />
          {equityValues.length <= 1 && (
            <text x="110" y="30" textAnchor="middle" fill={theme.muted} fontSize="9" fontWeight="800">
              Place replay trades to build curve
            </text>
          )}
        </svg>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
        <button
          onClick={replayBuy}
          style={{ ...buttonStyle(true), background: theme.green, border: "none" }}
        >
          Paper Buy
        </button>
        <button
          onClick={replaySell}
          style={{ ...buttonStyle(true), background: theme.red, border: "none" }}
        >
          Paper Sell
        </button>
      </div>

      <div style={{ ...cardStyle, padding: "9px", display: "grid", gap: "7px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <div style={{ fontSize: "12px", fontWeight: 950 }}>Position Context</div>
          <div style={{ color: openQty ? theme.green : theme.muted, fontSize: "10px", fontWeight: 950 }}>
            {openQty ? "OPEN" : "FLAT"}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px", fontSize: "10px" }}>
          <div>
            <div style={labelStyle}>Qty</div>
            <div style={metricStyle}>{openQty}</div>
          </div>
          <div>
            <div style={labelStyle}>Exposure</div>
            <div style={metricStyle}>{formatMoney(openExposure)}</div>
          </div>
          <div>
            <div style={labelStyle}>Open P&L</div>
            <div style={{ ...metricStyle, color: unrealizedPnl >= 0 ? theme.green : theme.red }}>
              {formatMoney(unrealizedPnl)}
            </div>
          </div>
        </div>
        <div style={{ color: theme.muted, fontSize: "10px", lineHeight: 1.45 }}>
          Avg win {formatMoney(replayStats.avgWin)} / avg loss {formatMoney(Math.abs(Number(replayStats.avgLoss || 0)))}.
          Last close {lastClosedTrade ? `${lastClosedTrade.symbol} ${formatMoney(lastClosedTrade.pnl)}` : "none yet"}.
        </div>
      </div>

      <div style={{ ...cardStyle, padding: "9px", display: "grid", gap: "7px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
          <div style={{ fontSize: "12px", fontWeight: 950 }}>Replay Tape</div>
          <button onClick={openReplayJournal} style={{ ...buttonStyle(false), width: "auto", padding: "0 9px" }}>
            Send To Review
          </button>
        </div>

        {replayTrades.length === 0 ? (
          <div style={{ color: theme.muted, fontSize: "10px", lineHeight: 1.45 }}>
            Use Paper Buy and Paper Sell to mark decisions. Completed sells create P&L and feed the review draft.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "5px", maxHeight: "158px", overflowY: "auto", paddingRight: "2px" }}>
            {[...replayTrades].reverse().slice(0, 10).map((trade) => {
              const tradeColor = trade.type === "BUY" ? theme.green : Number(trade.pnl || 0) >= 0 ? theme.green : theme.red;
              return (
                <div
                  key={trade.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "46px 1fr auto",
                    gap: "6px",
                    alignItems: "center",
                    padding: "6px",
                    borderRadius: "5px",
                    background: theme.panel,
                    border: `1px solid ${theme.borderSoft || theme.border}`,
                    fontSize: "10px",
                    minWidth: 0,
                  }}
                >
                  <span style={{ color: tradeColor, fontWeight: 950 }}>{trade.type}</span>
                  <span style={{ color: theme.text, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {trade.symbol} x{trade.qty} @ {formatMoney(trade.price)}
                  </span>
                  <span style={{ color: trade.type === "SELL" ? tradeColor : theme.muted, fontWeight: 950 }}>
                    {trade.type === "SELL" ? formatMoney(trade.pnl) : "open"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
