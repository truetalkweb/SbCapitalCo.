import { Search, X } from "lucide-react";
import { terminalMonoFont, terminalSansFont } from "../../../config/terminalConfig";
import { CHART_INDICATOR_OPTIONS } from "../../../indicators/chartIndicators";
import { money, nullableMoveOf, num, pct, toneColor } from "../premiumWorkspaceData";
import { ActionButton, PremiumCard, PremiumTable, SectionTitle } from "../PremiumWorkspacePrimitives";

export default function ReplayWorkspacePage({
  addReplayBookmark,
      allSymbols,
      captureReplayScreenshot,
      chartIndicators,
      enterReplayFullscreen,
      isNarrowWorkspace,
      jumpReplay,
      openReplayJournal,
      page,
      removeReplayBookmark,
      renderChartGrid,
      replayActionStatus,
      replayBookmarks,
      replayChartRef,
      replayEquity,
      replayIndicatorMenuOpen,
      replayNet,
      replayNotes,
      replayPlaying,
      replayRows,
      replaySettingsOpen,
      replaySpeed,
      replayStats,
      replayTrades,
      replayWinRate,
      resetReplay,
      selected,
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
    const replayNetLiquidation = num(replayStats?.equity, replayEquity.at(-1) ?? replayStartingCash);
    const replayPeak = replayEquity.length ? Math.max(...replayEquity.map((value) => num(value, replayStartingCash))) : replayStartingCash;
    const replayMaxDrawdown = replayEquity.length
      ? Math.min(...replayEquity.map((value) => num(value, replayStartingCash) - replayPeak))
      : 0;
    const replayPositionsBySymbol = (replayTrades || []).reduce((positionsBySymbol, trade) => {
      const symbol = String(trade.symbol || selectedStock || "").toUpperCase();
      if (!symbol) return positionsBySymbol;
      const quantityValue = Math.abs(num(trade.quantity ?? trade.qty, 0));
      const priceValue = num(trade.price ?? trade.fillPrice, 0);
      const direction = String(trade.side || trade.type || "").toUpperCase();
      const quantityDelta = direction === "SELL" || direction === "SHORT" ? -quantityValue : quantityValue;
      const existing = positionsBySymbol[symbol] || { symbol, quantity: 0, cost: 0 };
      if (quantityDelta > 0) existing.cost += quantityDelta * priceValue;
      existing.quantity += quantityDelta;
      if (existing.quantity <= 0) existing.cost = 0;
      positionsBySymbol[symbol] = existing;
      return positionsBySymbol;
    }, {});
    const replayPositions = Object.values(replayPositionsBySymbol)
      .filter((position) => position.quantity !== 0)
      .map((position) => {
        const averagePrice = position.quantity > 0 ? position.cost / position.quantity : 0;
        const lastPrice = num(allSymbols?.find((row) => row.symbol === position.symbol)?.price, averagePrice);
        const unrealizedPnl = (lastPrice - averagePrice) * position.quantity;
        return {
          symbol: position.symbol,
          side: position.quantity > 0 ? "Long" : "Short",
          qty: Math.abs(position.quantity),
          avg: averagePrice ? money(averagePrice) : "Unavailable",
          last: lastPrice ? money(lastPrice) : "Unavailable",
          pnl: money(unrealizedPnl),
          pct: averagePrice ? `${((lastPrice - averagePrice) / averagePrice * 100).toFixed(2)}%` : "Unavailable",
        };
      });
    const replaySymbolData = allSymbols?.find((row) => row.symbol === selectedStock) || selected;
    const replayPrice = num(replaySymbolData?.price ?? selected?.price, 0);
    const replayMove = nullableMoveOf(replaySymbolData) ?? nullableMoveOf(selected) ?? 0;
    const replayStatus = replayPlaying ? "Running" : "Paused";
    const replaySummaryRows = [
      ["Starting Cash", money(replayStartingCash)],
      ["Net Liquidation", money(replayNetLiquidation)],
      ["Total P&L", money(replayNet)],
      ["Realized P&L", money(replayNet)],
      ["Unrealized P&L", replayPositions.length ? money(replayPositions.reduce((total, row) => total + num(row.pnl), 0)) : money(0)],
      ["Total Trades", replayRows.length],
      ["Win Rate", `${replayWinRate}%`],
      ["Profit Factor", replayRows.length ? "Review" : "Unavailable"],
      ["Max Drawdown", money(replayMaxDrawdown)],
    ];
    const replayStatusRows = [
      ["Replay Session", "Current"],
      ["Data Speed", `${replaySpeed || 1}x`],
      ["Data Source", "Historical simulation"],
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
                ["Date", "Current replay session"],
                ["Start Time", "Market open"],
                ["End Time", "Market close"],
                ["Speed", `${replaySpeed || 1}x`],
              ].map(([label, value]) => replayMetric(label, value))}
              <div style={{ display: "flex", gap: 8, justifyContent: "end", flexWrap: "wrap", gridColumn: isNarrowWorkspace ? "1 / -1" : "auto" }}>
                <ActionButton theme={theme} onClick={() => jumpReplay("open")}>Skip to Open</ActionButton>
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
                      ["Market Open", "open"],
                      ["+ 1 Hour", 60],
                      ["+ 2 Hours", 120],
                      ["+ 3 Hours", 180],
                      ["Market Close", "close"],
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
                      ? replayBookmarks.slice(0, 5).map((bookmark) => (
                          <div key={bookmark.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 28px", gap: 4, alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => setReplayIndex?.(bookmark.index)}
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
                        <span style={{ color: toneColor(theme, replayMove), fontSize: 13, fontWeight: 900, fontFamily: terminalMonoFont }}>{pct(replayMove)}</span>
                      </div>
                      <div style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>{replaySymbolData?.company || `${selectedStock} INC.`} · {timeframe} · NASDAQ</div>
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
                        <ActionButton key={indicator.id} theme={theme} active={Boolean(chartIndicators?.[indicator.id])} onClick={() => setChartIndicators?.((current) => ({ ...current, [indicator.id]: !current?.[indicator.id] }))}>
                          {indicator.label}
                        </ActionButton>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ minHeight: 420, height: "100%" }}>{renderChartGrid?.({ layoutMode: "1", compact: true, embeddedChart: true })}</div>
                <div style={{ borderTop: `1px solid ${theme.borderSoft || theme.border}`, padding: "10px 14px", color: theme.muted, fontSize: 12 }}>
                  Replay indicators are shown only when calculated by the chart. No synthetic RSI series is generated.
                </div>
                </PremiumCard>
              </div>
              <PremiumCard theme={theme}>
                <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 16 }}>
                  <div>
                    <div style={{ height: 4, background: theme.panel2, borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ width: replayRows.length ? "36%" : "0%", height: "100%", background: `linear-gradient(90deg, ${theme.blue}, ${theme.green})` }} />
                    </div>
                    <div style={{ color: theme.text, marginTop: 12, fontFamily: terminalMonoFont, fontWeight: 850 }}>Replay {replayStatus.toLowerCase()}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "end" }}>
                    <ActionButton theme={theme} onClick={() => resetReplay?.()}>|&lt;</ActionButton>
                    <ActionButton theme={theme} onClick={() => stepReplay?.()}>&lt;</ActionButton>
                    <ActionButton theme={theme} active={replayPlaying} onClick={() => setReplayPlaying?.(!replayPlaying)}>
                      {replayPlaying ? "||" : ">"}
                    </ActionButton>
                    <ActionButton theme={theme} onClick={() => stepReplay?.()}>&gt;&gt;</ActionButton>
                    <ActionButton theme={theme} onClick={() => stepReplay?.()}>&gt;|</ActionButton>
                    <ActionButton theme={theme} onClick={() => resetReplay?.()}>Reset</ActionButton>
                  </div>
                </div>
              </PremiumCard>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <PremiumCard theme={theme} title="Simulation Summary">
                <div style={{ padding: 14, display: "grid", gap: 11 }}>{replaySummaryRows.map(valueRow)}</div>
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
              <PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true }, { key: "side", label: "Side", width: "70px", color: (row) => row.side === "Short" ? theme.red : theme.green }, { key: "qty", label: "Qty", width: "60px" }, { key: "avg", label: "Avg Price", width: "90px" }, { key: "last", label: "Last", width: "80px" }, { key: "pnl", label: "Unrealized P&L", width: "120px", color: () => theme.green }, { key: "pct", label: "P&L (%)", width: "80px", color: () => theme.green }]} rows={replayPositions} />
            </PremiumCard>
            <PremiumCard theme={theme} title="Trade History (Replay)">
              <PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "90px" }, { key: "symbol", label: "Symbol", width: "90px", mono: true }, { key: "side", label: "Side", width: "80px", color: (row) => row.side === "Sell" || row.side === "Short" ? theme.red : theme.green }, { key: "qty", label: "Qty", width: "70px" }, { key: "price", label: "Price", width: "90px" }, { key: "pnl", label: "P&L", width: "90px", color: (row) => String(row.pnl).startsWith("+") ? theme.green : theme.muted }]} rows={replayRows} />
            </PremiumCard>
            </div>
        </div>
      </div>
    );
  
}

