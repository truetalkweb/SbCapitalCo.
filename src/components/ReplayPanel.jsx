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
}) {
  return (
    <>
      <h3 style={{ marginTop: "12px", fontSize: "13px" }}>
        Replay + Backtest
      </h3>

      <div
        style={{
          background: theme.panel2,
          border: `1px solid ${theme.border}`,
          borderRadius: "8px",
          padding: "9px",
          display: "grid",
          gap: "8px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "6px",
          }}
        >
          <button
            onClick={() => setReplayPlaying((prev) => !prev)}
            style={buttonStyle(replayPlaying)}
          >
            {replayPlaying ? "Pause" : "Play"}
          </button>

          <button onClick={stepReplay} style={buttonStyle(false)}>
            Step
          </button>

          <button onClick={resetReplay} style={buttonStyle(false)}>
            Reset
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "6px",
          }}
        >
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
          }}
        >
          <button
            onClick={replayBuy}
            style={{
              ...buttonStyle(true),
              background: theme.green,
              border: "none",
            }}
          >
            Replay Buy
          </button>

          <button
            onClick={replaySell}
            style={{
              ...buttonStyle(true),
              background: theme.red,
              border: "none",
            }}
          >
            Replay Sell
          </button>
        </div>

        <div
          style={{
            fontSize: "10px",
            lineHeight: "1.6",
            color: theme.muted,
          }}
        >
          <div>
            Replay Candle: {replayIndex} / {mainReplayData.length || 0}
          </div>

          <div>
            Replay Price: $
            {Number(replayCandle?.close || 0).toFixed(2)}
          </div>

          <div>
            Equity: $
            {Number(replayStats.equity || 0).toFixed(2)}
          </div>

          <div>
            Net P&L:{" "}
            <span
              style={{
                color:
                  replayStats.netPnL >= 0
                    ? theme.green
                    : theme.red,
                fontWeight: 900,
              }}
            >
              ${Number(replayStats.netPnL || 0).toFixed(2)}
            </span>
          </div>

          <div>
            Trades: {replayStats.totalTrades} · Win Rate:{" "}
            {replayStats.winRate}%
          </div>

          <div>
            Winners: {replayStats.winners} · Losers:{" "}
            {replayStats.losers}
          </div>

          <div>
            Avg Win: $
            {Number(replayStats.avgWin || 0).toFixed(2)} · Avg
            Loss: $
            {Math.abs(
              Number(replayStats.avgLoss || 0)
            ).toFixed(2)}
          </div>
        </div>
      </div>
    </>
  );
}