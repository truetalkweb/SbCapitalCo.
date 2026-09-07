import { Search, X } from "lucide-react";
import { terminalMonoFont, terminalSansFont } from "../../../config/terminalConfig";
import { CHART_INDICATOR_OPTIONS } from "../../../indicators/chartIndicators";
import { money, num, pct, toneColor } from "../premiumWorkspaceData";
import { ActionButton, PremiumCard, PremiumTable, SectionTitle } from "../PremiumWorkspacePrimitives";

export default function ReplayWorkspacePage({
  addReplayBookmark,
      captureReplayScreenshot,
      chartIndicators,
      enterReplayFullscreen,
      isNarrowWorkspace,
      jumpReplay,
      selectReplayBookmark,
      replayData = [],
      timeZone = "America/Vancouver",
      openReplayJournal,
      page,
      removeReplayBookmark,
      renderChartGrid,
      replayActionStatus,
      replayBookmarks,
      replayChartRef,
      replayDataLength,
      replayIndex,
      replayIndicatorMenuOpen,
      replayNotes,
      replayPlaying,
      replayRows,
      replaySettingsOpen,
      replaySpeed,
      replayStats,
      replayBuy,
      replaySell,
      quantity,
      setQuantity,
      resetReplay,
      selectedStock,
      setChartIndicators,
      setReplayIndex,
      setReplayIndicatorMenuOpen,
      setReplayNotes,
      setReplayPlaying,
      setReplaySettingsOpen,
      setReplaySpeed,
      setTimeframe,
      stepReplay,
      theme,
      timeframe
}) {
    const replayStartingCash = 100000;
    const ready = Boolean(replayStats?.candle);
    const value = amount => amount === null || amount === undefined ? "Unavailable" : money(amount);
    const replayPositions = (replayStats?.positions || []).map(position => ({
      symbol: position.symbol, side: position.side, qty: position.qty,
      avg: value(position.avgPrice), last: value(position.lastPrice), pnl: value(position.unrealizedPnl),
      pnlValue: position.unrealizedPnl,
      pct: position.unrealizedPnl === null ? "Unavailable" : pct(position.unrealizedPnl / position.costBasis * 100),
    }));
    const replayPrice = replayStats?.candle?.close ?? null;
    const replayOpen = replayStats?.candle?.open ?? null;
    const replayMove = replayPrice !== null && replayOpen > 0 ? (replayPrice - replayOpen) / replayOpen * 100 : null;
    const replayStatus = !ready ? "Unavailable" : replayPlaying ? "Running" : "Paused";
    const formatReplayTime = candle => candle?.time
      ? new Date(candle.time * 1000).toLocaleString("en-CA", { timeZone, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" })
      : "Unavailable";
    const replaySummaryRows = [
      ["Starting Cash", money(replayStartingCash)],
      ["Cash", ready ? value(replayStats.cash) : "Unavailable"],
      ["Net Liquidation", ready ? value(replayStats.equity) : "Unavailable"],
      ["Total P&L", ready ? value(replayStats.netPnL) : "Unavailable"],
      ["Realized P&L", ready ? value(replayStats.realizedPnl) : "Unavailable"],
      ["Unrealized P&L", ready ? value(replayStats.unrealizedPnl) : "Unavailable"],
      ["Fees", ready ? value(replayStats.fees) : "Unavailable"],
      ["Closed Sales", ready ? replayStats.totalTrades : "Unavailable"],
      ["Win Rate", ready && replayStats.winRate !== null ? `${Number(replayStats.winRate).toFixed(1)}%` : "Unavailable"],
      ["Profit Factor", ready && replayStats.profitFactor !== null ? Number(replayStats.profitFactor).toFixed(2) : "Unavailable"],
      ["Max Drawdown", ready ? value(replayStats.maxDrawdown) : "Unavailable"],
    ];
    const replayProgress = replayDataLength > 1
      ? Math.min(100, Math.max(0, (replayIndex / (replayDataLength - 1)) * 100))
      : 0;
    const moveReplay = (steps) => {
      setReplayIndex?.((current) => Math.min(
        Math.max(current + steps, 0),
        Math.max(replayDataLength - 1, 0)
      ));
    };
    const replayStatusRows = [
      ["Replay Time", formatReplayTime(replayStats?.candle)],
      ["Data Speed", `${replaySpeed || 1}x`],
      ["Data Source", replayStats?.source || "Unavailable"],
      ["Data Quality", replayStats?.dataQuality || "unavailable"],
      ["Status", replayStatus],
    ];
    const replayMetric = (label, value) => (
      <label key={label} style={{ display: "grid", gap: 6, minWidth: 0 }}>
        <span style={{ color: theme.muted, fontSize: 10, fontWeight: 850, letterSpacing: 0.2, textTransform: "uppercase" }}>{label}</span>
        <span
          style={{
            minHeight: 34,
            display: "flex",
            alignItems: "center",
            borderTop: `1px solid ${theme.borderSoft || theme.border}`,
            color: theme.text,
            fontFamily: terminalMonoFont,
            fontSize: 13,
            fontWeight: 850,
          }}
        >
          {value}
        </span>
      </label>
    );
    const valueRow = ([label, value]) => {
      const parsed = num(String(value).replace(/[^0-9.-]/g, ""), 0);
      const color = String(value).includes("Unavailable") ? theme.muted : parsed < 0 ? theme.red : label.includes("P&L") && parsed > 0 ? theme.green : theme.text;
      return (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16, color: theme.muted, fontSize: 13 }}>
          <span>{label}</span>
          <b style={{ color, fontFamily: terminalMonoFont, fontWeight: 850 }}>{value}</b>
        </div>
      );
    };
    return (
      <div style={page}>
        <div style={{ display: "grid", gap: 12, minHeight: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
            <SectionTitle theme={theme} title="REPLAY" subtitle="Practice trading with historical market data. All orders are simulated." />
            <ActionButton theme={theme} active={replaySettingsOpen} onClick={() => setReplaySettingsOpen((current) => !current)}>Replay Settings</ActionButton>
          </div>
          {replaySettingsOpen && (
            <PremiumCard theme={theme} title="Replay Settings">
              <div style={{ padding: 14, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 11 }}>Default timeframe
                  <select value={timeframe} onChange={(event) => setTimeframe?.(event.target.value)} style={{ height: 34, minWidth: 120, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px" }}>{["1m", "5m", "15m", "1H", "1D"].map((frame) => <option key={frame}>{frame}</option>)}</select>
                </label>
                <div style={{ color: theme.muted, fontSize: 12, lineHeight: 1.45 }}>Playback and orders remain local simulations. Changing timeframe reloads the chart view; it never submits to a broker.</div>
              </div>
            </PremiumCard>
          )}
          <PremiumCard theme={theme}>
            <div
              style={{
                padding: 14,
                display: "grid",
                gridTemplateColumns: isNarrowWorkspace ? "repeat(2, minmax(0, 1fr))" : "150px 170px 140px 140px 110px minmax(220px, 1fr)",
                gap: 14,
                alignItems: "end",
              }}
            >
              {[
                ["Market", "Stocks (US)"],
                ["Time Zone", timeZone],
                ["First Bar", formatReplayTime(replayData[0])],
                ["Last Bar", formatReplayTime(replayData.at(-1))],
                ["Speed", `${replaySpeed || 1}x`],
              ].map(([label, value]) => replayMetric(label, value))}
              <div style={{ display: "flex", gap: 8, justifyContent: "end", flexWrap: "wrap", gridColumn: isNarrowWorkspace ? "1 / -1" : "auto" }}>
                <ActionButton theme={theme} disabled={!ready} onClick={() => jumpReplay("open")}>Go to Start</ActionButton>
                <ActionButton theme={theme} onClick={() => stepReplay?.()}>Step</ActionButton>
                <ActionButton theme={theme} good onClick={() => setReplayPlaying?.(!replayPlaying)}>
                  {replayPlaying ? "Pause Replay" : "Start Replay"}
                </ActionButton>
              </div>
            </div>
          </PremiumCard>

          <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "250px minmax(0, 1fr) 320px", gap: 10, alignItems: "stretch" }}>
            <PremiumCard theme={theme} title="Replay Controls">
              <div style={{ padding: 14, display: "grid", gap: 20 }}>
                <div>
                  <div style={{ color: theme.muted, fontSize: 12, marginBottom: 9 }}>Speed</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {["0.25x", "0.5x", "1x", "2x", "5x", "10x", "20x", "50x", "100x"].map((speed) => (
                      <ActionButton
                        key={speed}
                        theme={theme}
                        active={Number(speed.replace("x", "")) === Number(replaySpeed || 1)}
                        onClick={() => setReplaySpeed?.(Number(speed.replace("x", "")))}
                      >
                        {speed}
                      </ActionButton>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ color: theme.muted, fontSize: 12, marginBottom: 9 }}>Jump to Time</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      ["First Bar", "open"],
                      ["+ 1 Hour", 60],
                      ["+ 2 Hours", 120],
                      ["+ 3 Hours", 180],
                      ["Last Bar", "close"],
                    ].map(([label, target]) => (
                      <ActionButton
                        key={label}
                        theme={theme}
                        onClick={() => jumpReplay(target)}
                      >
                        {label}
                      </ActionButton>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: theme.muted, fontSize: 12, marginBottom: 8 }}>
                    <span>Bookmarks</span>
                    <ActionButton theme={theme} onClick={addReplayBookmark}>+ Add</ActionButton>
                  </div>
                  <div style={{ minHeight: 86, border: `1px dashed ${theme.borderSoft || theme.border}`, borderRadius: 8, padding: 8, color: theme.muted, fontSize: 12, lineHeight: 1.5, display: "grid", gap: 4, alignContent: "start" }}>
                    {replayBookmarks.length
                      ? replayBookmarks.map((bookmark) => (
                          <div key={bookmark.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 28px", gap: 4, alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => selectReplayBookmark?.(bookmark)}
                              style={{ minWidth: 0, border: 0, background: "transparent", color: theme.text, padding: "4px 3px", textAlign: "left", cursor: "pointer", fontFamily: terminalMonoFont, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            >
                              {bookmark.label}
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete replay bookmark ${bookmark.label}`}
                              title="Delete bookmark"
                              onClick={() => removeReplayBookmark(bookmark.id)}
                              style={{ width: 28, height: 28, display: "grid", placeItems: "center", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 5, background: "transparent", color: theme.muted, cursor: "pointer" }}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))
                      : "No bookmarks saved for this replay session."}
                  </div>
                </div>
              </div>
            </PremiumCard>

            <div style={{ display: "grid", gridTemplateRows: "minmax(480px, 1fr) 78px", gap: 10, minHeight: 0 }}>
              <div ref={replayChartRef} style={{ minHeight: 0, background: theme.page }}>
                <PremiumCard
                  theme={theme}
                  title={`${selectedStock} Replay Chart`}
                  action={<span style={{ color: theme.muted, fontFamily: terminalMonoFont }}>Historical simulation</span>}
                  style={{ display: "grid", gridTemplateRows: "auto auto minmax(420px, 1fr) auto", minHeight: 560, height: "100%" }}
                >
                <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${theme.borderSoft || theme.border}`, display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
                        <span style={{ color: theme.text, fontSize: 28, fontWeight: 950, fontFamily: terminalMonoFont }}>{selectedStock}</span>
                        <span style={{ color: theme.text, fontSize: 16, fontWeight: 850, fontFamily: terminalMonoFont }}>{replayPrice ? money(replayPrice) : "Unavailable"}</span>
                        <span style={{ color: replayMove === null ? theme.muted : toneColor(theme, replayMove), fontSize: 13, fontWeight: 900, fontFamily: terminalMonoFont }}>{replayMove === null ? "Unavailable" : pct(replayMove)}</span>
                      </div>
                      <div style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>{timeframe} · Historical replay · Simulated orders</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ height: 32, minWidth: 180, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 7, background: theme.panel2, display: "flex", alignItems: "center", gap: 8, padding: "0 10px", color: theme.muted }}>
                        <Search size={14} />
                        <span style={{ color: theme.text, fontFamily: terminalMonoFont, fontWeight: 850 }}>{selectedStock}</span>
                      </div>
                      {["1m", "5m", "15m", "1H", "1D"].map((frame) => (
                        <ActionButton key={frame} theme={theme} active={frame === timeframe} onClick={() => setTimeframe?.(frame)}>{frame}</ActionButton>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <ActionButton theme={theme} active={replayIndicatorMenuOpen} onClick={() => setReplayIndicatorMenuOpen((current) => !current)}>Indicators</ActionButton>
                    <ActionButton theme={theme} onClick={captureReplayScreenshot}>Screenshot</ActionButton>
                    <ActionButton theme={theme} onClick={enterReplayFullscreen}>Fullscreen</ActionButton>
                    {replayActionStatus && (
                      <span role="status" style={{ alignSelf: "center", color: theme.green, fontSize: 11, fontWeight: 800 }}>
                        {replayActionStatus}
                      </span>
                    )}
                  </div>
                  {replayIndicatorMenuOpen && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {CHART_INDICATOR_OPTIONS.map((indicator) => (
                        <ActionButton key={indicator.id} theme={theme} active={Boolean(chartIndicators?.[indicator.id])} aria-pressed={Boolean(chartIndicators?.[indicator.id])} onClick={() => setChartIndicators?.((current) => ({ ...current, [indicator.id]: !current?.[indicator.id] }))}>
                          {indicator.label}
                        </ActionButton>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ minHeight: 420, height: "100%" }}>{renderChartGrid?.({ layoutMode: "1", compact: true, embeddedChart: true })}</div>
                <div style={{ borderTop: `1px solid ${theme.borderSoft || theme.border}`, padding: "10px 14px", color: theme.muted, fontSize: 12 }}>
                  <span role="status">{replayStats?.message || "Historical replay data is unavailable"}</span>
                </div>
                </PremiumCard>
              </div>
              <PremiumCard theme={theme}>
                <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 16 }}>
                  <div>
                    <div
                      role="progressbar"
                      aria-label="Replay progress"
                      aria-valuemin="0"
                      aria-valuemax={Math.max(replayDataLength - 1, 0)}
                      aria-valuenow={Math.min(replayIndex, Math.max(replayDataLength - 1, 0))}
                      style={{ height: 4, background: theme.panel2, borderRadius: 99, overflow: "hidden" }}
                    >
                      <div style={{ width: `${replayProgress}%`, height: "100%", background: `linear-gradient(90deg, ${theme.blue}, ${theme.green})` }} />
                    </div>
                    <div style={{ color: theme.text, marginTop: 12, fontFamily: terminalMonoFont, fontWeight: 850 }}>
                      Replay {replayStatus.toLowerCase()} · Step {Math.min(replayIndex + 1, Math.max(replayDataLength, 1))} of {Math.max(replayDataLength, 1)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "end" }}>
                    <ActionButton theme={theme} aria-label="Jump to replay start" title="Jump to start" onClick={() => setReplayIndex?.(0)}>|&lt;</ActionButton>
                    <ActionButton theme={theme} aria-label="Previous replay candle" title="Previous candle" onClick={() => moveReplay(-1)}>&lt;</ActionButton>
                    <ActionButton theme={theme} aria-label={replayPlaying ? "Pause replay" : "Play replay"} active={replayPlaying} onClick={() => setReplayPlaying?.(!replayPlaying)}>
                      {replayPlaying ? "||" : ">"}
                    </ActionButton>
                    <ActionButton theme={theme} aria-label="Advance replay five candles" title="Advance five candles" onClick={() => moveReplay(5)}>&gt;&gt;</ActionButton>
                    <ActionButton theme={theme} aria-label="Jump to replay end" title="Jump to end" onClick={() => setReplayIndex?.(Math.max(replayDataLength - 1, 0))}>&gt;|</ActionButton>
                    <ActionButton theme={theme} onClick={() => resetReplay?.()}>Reset</ActionButton>
                  </div>
                </div>
              </PremiumCard>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <PremiumCard theme={theme} title="Simulation Summary">
                <div style={{ padding: 14, display: "grid", gap: 11 }}>{replaySummaryRows.map(valueRow)}</div>
                <div style={{ padding: 14, display: "grid", gap: 8 }}>
                  <label style={{ display: "grid", gap: 4, color: theme.muted }}>Shares
                    <input aria-label="Simulated order shares" type="number" min="1" step="1" value={quantity ?? ""} onChange={event => setQuantity?.(event.target.value)} style={{ width: "100%", minWidth: 0, boxSizing: "border-box", color: theme.text, background: theme.panel2, border: `1px solid ${theme.border}`, padding: 8 }} />
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <ActionButton theme={theme} disabled={!ready || !replayBuy} onClick={() => replayBuy?.()}>Simulate buy</ActionButton>
                    <ActionButton theme={theme} disabled={!ready || !replaySell} onClick={() => replaySell?.()}>Simulate sell</ActionButton>
                  </div>
                </div>
              </PremiumCard>
              <PremiumCard theme={theme} title="Market Replay Status">
                <div style={{ padding: 14, display: "grid", gap: 11 }}>
                  {replayStatusRows.map(([label, value]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16, color: theme.muted, fontSize: 13 }}>
                      <span>{label}</span>
                      <b style={{ color: value === "Running" ? theme.green : theme.text, fontFamily: terminalMonoFont }}>{value}</b>
                    </div>
                  ))}
                </div>
              </PremiumCard>
              <PremiumCard theme={theme} title="Market Events">
                <div style={{ padding: 14, color: theme.muted, fontSize: 12, lineHeight: 1.6 }}>No verified events are attached to this replay session.</div>
              </PremiumCard>
              <PremiumCard theme={theme} title="Replay Notes">
                <div style={{ padding: 14, display: "grid", gap: 10 }}>
                  <textarea
                    aria-label="Replay session notes"
                    placeholder="Add notes for this replay session..."
                    maxLength={1000}
                    value={replayNotes}
                    onChange={(event) => setReplayNotes?.(event.target.value)}
                    style={{ minHeight: 96, resize: "vertical", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 7, background: theme.panel2, color: theme.text, padding: 12, fontFamily: terminalSansFont }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: theme.muted, fontSize: 11 }}>
                    <span>{replayNotes.length} / 1000</span>
                    <ActionButton theme={theme} onClick={() => openReplayJournal?.()}>Send to Journal</ActionButton>
                  </div>
                </div>
              </PremiumCard>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "minmax(0, 0.95fr) minmax(0, 1.45fr)", gap: 10 }}>
            <PremiumCard theme={theme} title="Open Positions (Replay)">
              <PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true }, { key: "side", label: "Side", width: "70px", color: (row) => row.side === "Short" ? theme.red : theme.green }, { key: "qty", label: "Qty", width: "60px" }, { key: "avg", label: "Avg Price", width: "90px" }, { key: "last", label: "Last", width: "80px" }, { key: "pnl", label: "Unrealized P&L", width: "120px", color: (row) => row.pnlValue === null ? theme.muted : toneColor(theme, row.pnlValue) }, { key: "pct", label: "P&L (%)", width: "80px", color: (row) => row.pnlValue === null ? theme.muted : toneColor(theme, row.pnlValue) }]} rows={replayPositions} />
            </PremiumCard>
            <PremiumCard theme={theme} title="Trade History (Replay)">
              <PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "180px" }, { key: "symbol", label: "Symbol", width: "90px", mono: true }, { key: "side", label: "Side", width: "80px", color: (row) => row.side === "SELL" || row.side === "Short" ? theme.red : theme.green }, { key: "qty", label: "Qty", width: "70px" }, { key: "price", label: "Price", width: "90px" }, { key: "pnl", label: "P&L", width: "90px", color: (row) => row.pnl === "Unavailable" ? theme.muted : String(row.pnl).includes("-") ? theme.red : theme.green }]} rows={replayRows} />
            </PremiumCard>
            </div>
        </div>
      </div>
    );
  
}
