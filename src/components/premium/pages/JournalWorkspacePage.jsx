import { X } from "lucide-react";
import { terminalMonoFont, terminalSansFont } from "../../../config/terminalConfig";
import { money, num } from "../premiumWorkspaceData";
import { ActionButton, FilterBar, MetricTile, PremiumCard, PremiumTable, PremiumTabs, SectionTitle, SeriesSparkline, StatusPill } from "../PremiumWorkspacePrimitives";

export default function JournalWorkspacePage({
  addJournalEntry,
      exportDailyReport,
      exportJournalCsv,
      exportWeeklyReport,
      isNarrowWorkspace,
      journalDraft,
      journalNet,
      journalRows,
      journalView,
      page,
      removeJournalEntry,
      selectedStock,
      setJournalDraft,
      setJournalView,
      theme
}) {
    const wins = journalRows.filter((row) => row.outcome === "Win").length;
    const losses = journalRows.filter((row) => row.outcome === "Loss").length;
    const tradeCount = journalRows.length;
    const winRate = `${((wins / Math.max(tradeCount, 1)) * 100).toFixed(2)}%`;
    const journalPnls = journalRows.map((row) => num(row.pnl));
    const journalGrossProfit = journalPnls.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
    const journalGrossLoss = Math.abs(journalPnls.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
    const journalAvgWin = wins ? journalGrossProfit / wins : 0;
    const journalAvgLoss = losses ? journalGrossLoss / losses : 0;
    const journalProfitFactor = journalGrossLoss ? (journalGrossProfit / journalGrossLoss).toFixed(2) : "Unavailable";
    const breakeven = journalRows.filter((row) => num(row.pnl) === 0).length;
    const showDraft = journalView === "Overview" || journalView === "Trades";
    const showStatistics = journalView === "Overview" || journalView === "Statistics";
    const showTrades = journalView === "Overview" || journalView === "Trades";
    return (
      <div style={page}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 16 }}>
            <SectionTitle theme={theme} title="Journal" subtitle="Track, review and improve your trading performance." />
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>
              <ActionButton theme={theme} onClick={() => setJournalDraft?.((current) => ({ ...current, symbol: selectedStock, setup: "", review: "", result: "Review", grade: "B" }))}>Clear Draft</ActionButton>
              <ActionButton theme={theme} active disabled={!journalDraft?.setup?.trim()} title={!journalDraft?.setup?.trim() ? "Enter a setup before saving" : "Save this journal draft"} onClick={addJournalEntry}>Save Trade</ActionButton>
            </div>
          </div>
          <PremiumCard theme={theme}>
            <div style={{ padding: 12, display: "grid", gap: 12 }}>
            <PremiumTabs theme={theme} tabs={["Overview", "Trades", "Statistics", "Exports"]} active={journalView} onChange={setJournalView} />
              {journalView === "Trades" && <FilterBar theme={theme} items={["All recorded dates", "All Symbols", "All Setups", "All Tags", "All Outcomes"]} />}
            </div>
          </PremiumCard>
          {showDraft && <PremiumCard theme={theme} title="Prepared Journal Draft">
              <div style={{ padding: 14, display: "grid", gridTemplateColumns: isNarrowWorkspace ? "1fr" : "120px 180px 100px 130px minmax(220px, 1fr)", gap: 12, alignItems: "end" }}>
                {[
                  ["Symbol", "symbol", journalDraft.symbol || selectedStock],
                  ["Setup", "setup", journalDraft.setup],
                ].map(([label, key, value]) => (
                  <label key={key} style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 10, fontWeight: 850, textTransform: "uppercase" }}>
                    {label}
                    <input
                      aria-label={`Journal ${label.toLowerCase()}`}
                      value={value}
                      onChange={(event) => setJournalDraft?.((current) => ({ ...current, [key]: key === "symbol" ? event.target.value.toUpperCase() : event.target.value }))}
                      style={{ height: 34, minWidth: 0, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 9px", fontFamily: key === "symbol" ? terminalMonoFont : terminalSansFont }}
                    />
                  </label>
                ))}
                <label style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 10, fontWeight: 850, textTransform: "uppercase" }}>
                  Grade
                  <select aria-label="Journal grade" value={journalDraft.grade || "B"} onChange={(event) => setJournalDraft?.((current) => ({ ...current, grade: event.target.value }))} style={{ height: 34, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px" }}>
                    {["A", "B", "C", "D"].map((grade) => <option key={grade}>{grade}</option>)}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 10, fontWeight: 850, textTransform: "uppercase" }}>
                  Outcome
                  <select aria-label="Journal outcome" value={journalDraft.result || "Review"} onChange={(event) => setJournalDraft?.((current) => ({ ...current, result: event.target.value }))} style={{ height: 34, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px" }}>
                    {["Review", "Win", "Loss", "Breakeven"].map((result) => <option key={result}>{result}</option>)}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 10, fontWeight: 850, textTransform: "uppercase" }}>
                  Review
                  <input aria-label="Journal review" value={journalDraft.review || ""} placeholder="What happened and what will you improve?" onChange={(event) => setJournalDraft?.((current) => ({ ...current, review: event.target.value }))} style={{ height: 34, minWidth: 0, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 9px" }} />
                </label>
              </div>
            </PremiumCard>}
            {showStatistics && <PremiumCard theme={theme}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10, minmax(0, 1fr))" }}>
                {[
                  ["Net P&L", money(journalNet), journalNet >= 0 ? "good" : "bad"],
                  ["Total Trades", String(tradeCount), "neutral"],
                  ["Win Rate", winRate, "good"],
                  ["Profit Factor", journalProfitFactor, "neutral"],
                  ["Avg Win", money(journalAvgWin), "good"],
                  ["Avg Loss", money(-journalAvgLoss), "bad"],
                  ["Expectancy", tradeCount ? money(journalNet / tradeCount) : "Unavailable", "neutral"],
                  ["Best Trade", tradeCount ? money(Math.max(...journalPnls)) : "Unavailable", "good"],
                  ["Worst Trade", tradeCount ? money(Math.min(...journalPnls)) : "Unavailable", "bad"],
                  ["Avg Hold Time", "Not calculated", "neutral"],
                ].map(([label, value, tone, detail]) => (
                  <MetricTile key={label} theme={theme} label={label} value={value} tone={tone} detail={detail} />
                ))}
              </div>
            </PremiumCard>}
            {showStatistics && <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "minmax(0, 1.35fr) 300px 0.85fr", gap: 10 }}>
              <PremiumCard theme={theme} title="Equity Curve">
                <div style={{ padding: 16, height: 310 }}>
                  <div style={{ width: 170, marginBottom: 12 }}>
                    <StatusPill theme={theme} tone="neutral">Recorded Net P&amp;L</StatusPill>
                  </div>
                  <div style={{ height: 220, borderLeft: `1px solid ${theme.borderSoft || theme.border}`, borderBottom: `1px solid ${theme.borderSoft || theme.border}`, paddingTop: 12 }}>
                    <SeriesSparkline theme={theme} values={journalPnls} height={190} />
                  </div>
                  <div style={{ textAlign: "center", color: theme.muted, fontSize: 12, marginTop: 8 }}>Cumulative recorded trade P&amp;L</div>
                </div>
              </PremiumCard>
              <PremiumCard theme={theme} title="Trades By Outcome">
                <div style={{ padding: 18, display: "grid", gridTemplateColumns: "150px 1fr", gap: 18, alignItems: "center", minHeight: 310 }}>
                  <div style={{ width: 138, height: 138, borderRadius: "50%", background: tradeCount ? `conic-gradient(${theme.green} 0 ${(wins / tradeCount) * 100}%, ${theme.red} ${(wins / tradeCount) * 100}% ${((wins + losses) / tradeCount) * 100}%, ${theme.muted} ${((wins + losses) / tradeCount) * 100}% 100%)` : theme.panel2, display: "grid", placeItems: "center" }}>
                    <div style={{ width: 76, height: 76, borderRadius: "50%", background: theme.bg, display: "grid", placeItems: "center", textAlign: "center", color: theme.text, fontFamily: terminalMonoFont }}>
                      <b>{tradeCount}</b>
                      <span style={{ color: theme.muted, fontSize: 10 }}>Total Trades</span>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 10, fontSize: 12 }}>
                    <span style={{ color: theme.green }}>Won {wins}</span>
                    <span style={{ color: theme.red }}>Lost {losses}</span>
                    <span style={{ color: theme.muted }}>Breakeven {breakeven}</span>
                  </div>
                </div>
              </PremiumCard>
              <PremiumCard theme={theme} title="P&L Distribution">
                <div style={{ padding: 18, height: 310, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", alignItems: "end", gap: 14 }}>
                  {(journalPnls.length ? journalPnls.slice(-7) : [0]).map((value, index) => {
                    const maxAbs = Math.max(1, ...journalPnls.map(Math.abs));
                    return (
                    <div key={index} style={{ display: "grid", gap: 8, alignItems: "end" }}>
                      <div style={{ height: Math.max(3, (Math.abs(value) / maxAbs) * 150), background: value >= 0 ? theme.green : theme.red, opacity: 0.86, borderRadius: "4px 4px 0 0" }} />
                      <span style={{ color: theme.muted, fontSize: 10, textAlign: "center" }}>{money(value)}</span>
                    </div>
                    );
                  })}
                </div>
              </PremiumCard>
            </div>}
            {showTrades && <PremiumCard theme={theme} title="Recent Trades" action={<ActionButton theme={theme} active disabled={!journalDraft?.setup?.trim()} title={!journalDraft?.setup?.trim() ? "Enter a setup before saving" : "Save this journal draft"} onClick={addJournalEntry}>Save Draft</ActionButton>}>
              <PremiumTable
                theme={theme}
                columns={[
                  { key: "date", label: "Date/Time", width: "150px" },
                  { key: "symbol", label: "Symbol", width: "90px", mono: true, strong: true },
                  { key: "setup", label: "Setup", width: "120px" },
                  { key: "side", label: "Side", width: "70px", color: (row) => row.side === "Short" ? theme.red : theme.green },
                  { key: "qty", label: "Qty", width: "70px", mono: true },
                  { key: "entry", label: "Entry", width: "85px", mono: true },
                  { key: "exit", label: "Exit", width: "85px", mono: true },
                  { key: "pnl", label: "P&L (USD)", width: "100px", mono: true, color: (row) => num(row.pnl) >= 0 ? theme.green : theme.red, render: (row) => money(row.pnl) },
                  { key: "pnlPct", label: "P&L (%)", width: "90px", mono: true, color: (row) => String(row.pnlPct).startsWith("-") ? theme.red : theme.green },
                  { key: "r", label: "R Multiple", width: "90px", mono: true, color: (row) => String(row.r).startsWith("-") ? theme.red : theme.green },
                  { key: "hold", label: "Hold Time", width: "90px" },
                  { key: "outcome", label: "Outcome", width: "80px", color: (row) => row.outcome === "Loss" ? theme.red : theme.green },
                  { key: "tag", label: "Notes", width: "90px", render: (row) => <StatusPill theme={theme} tone={row.outcome === "Loss" ? "warn" : "neutral"}>{row.tag || row.setup}</StatusPill> },
                  { key: "notes", label: "Review", width: "1fr" },
                  { key: "actions", label: "", width: "54px", align: "center", render: (row) => <button type="button" aria-label={`Delete journal entry ${row.symbol}`} title="Delete journal entry" onClick={(event) => { event.stopPropagation(); removeJournalEntry?.(row.id); }} style={{ width: 28, height: 28, display: "grid", placeItems: "center", margin: "0 auto", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 5, background: "transparent", color: theme.muted, cursor: "pointer" }}><X size={13} /></button> },
                ]}
                rows={journalRows}
              />
              <div style={{ padding: "12px 16px", color: theme.muted, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                <span>{journalRows.length ? `Showing 1 to ${Math.min(journalRows.length, 8)} of ${journalRows.length} trades` : "No recorded trades"}</span>
                {journalRows.length > 8 ? <span style={{ fontFamily: terminalMonoFont }}>1 2 3 4 5 ...</span> : null}
              </div>
            </PremiumCard>}
            {journalView === "Exports" && <PremiumCard theme={theme} title="Journal & Performance Exports">
              <div style={{ padding: 16, display: "grid", gridTemplateColumns: isNarrowWorkspace ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                <ActionButton theme={theme} onClick={exportJournalCsv}>Journal CSV</ActionButton>
                <ActionButton theme={theme} onClick={exportDailyReport}>Daily Report</ActionButton>
                <ActionButton theme={theme} onClick={exportWeeklyReport}>Weekly Review</ActionButton>
              </div>
              <div style={{ padding: "0 16px 16px", color: theme.muted, fontSize: 12, lineHeight: 1.55 }}>Exports contain only locally recorded journal and review data. Daily and weekly reports are generated as portable Markdown files.</div>
            </PremiumCard>}
        </div>
      </div>
    );
  
}
