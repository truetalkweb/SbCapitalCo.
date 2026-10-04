import { useState } from "react";
import { journalStatistics, groupJournalTrades, journalBreakdowns } from "../../../utils/journalAccounting.js";
import { DEFAULT_JOURNAL_FILTERS, normalizeJournalFilters, filterJournalRecords } from '../../../utils/journalFilters.js';
import RecordPagination from "../RecordPagination";
import { useRecordPage } from "../../../hooks/useRecordPage.js";
import { X } from "lucide-react";
import { defaultJournalDraft, terminalMonoFont, terminalSansFont } from "../../../config/terminalConfig";
import { money, num, makeJournalTrades } from "../premiumWorkspaceData";
import { ActionButton, FilterBar, MetricTile, PremiumCard, PremiumTable, PremiumTabs, SectionTitle, SeriesSparkline, StatusPill } from "../PremiumWorkspacePrimitives";

export default function JournalWorkspacePage({
  addJournalEntry,
      exportDailyReport,
      exportJournalCsv,
      exportWeeklyReport,
      isNarrowWorkspace,
      journalDraft,
      journalRows,
      journalView,
      journalFilters,
      setJournalFilters,
      page,
      removeJournalEntry,
      selectedStock,
      setJournalDraft,
      setJournalView,
      theme
}) {
    const [analysisDimension, setAnalysisDimension] = useState('setup');
    const filters = normalizeJournalFilters(journalFilters);
    const { groupExits } = filters;
    const updateFilters = changes => setJournalFilters?.({ ...filters, ...changes });
    const grouped = makeJournalTrades(groupJournalTrades(journalRows));
    const scope = filterJournalRecords(groupExits ? grouped : journalRows, filters);
    const presentedRows = scope.rows;
    const stats = journalStatistics(presentedRows);
    const breakdowns = journalBreakdowns(filterJournalRecords(grouped, filters).rows);
    const { wins, losses, breakeven } = stats;
    const tradeCount = stats.total;
    const journalNet = stats.net;
    const winRate = stats.winRate === null ? "Unavailable" : stats.winRate.toFixed(2) + "%";
    const journalPnls = stats.values;
    const journalAvgWin = stats.averageWin;
    const journalAvgLoss = stats.averageLoss;
    const journalProfitFactor = stats.profitFactor === null ? "Unavailable" : stats.profitFactor.toFixed(2);
    const pagination = useRecordPage(presentedRows, 25, JSON.stringify(filters));
    const symbols = [...new Set(journalRows.map(row => String(row.symbol || '').toUpperCase()).filter(Boolean))].sort();
    const setups = [...new Set(journalRows.map(row => String(row.setup || 'Unspecified').trim()))].sort();
    const filterStyle = { height: 32, minWidth: 0, maxWidth: '100%', background: theme.panel2, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 5, padding: '0 8px', colorScheme: theme.isDark ? 'dark' : 'light' };
    const showDraft = journalView === "Overview" || journalView === "Trades";
    const showStatistics = journalView === "Overview" || journalView === "Statistics";
    const showTrades = journalView === "Overview" || journalView === "Trades";
    return (
      <div className="terminal-page" style={page}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 16 }}>
            <SectionTitle theme={theme} title="Journal" subtitle="Track, review and improve your trading performance." />
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>
              <ActionButton theme={theme} onClick={() => setJournalDraft?.({ ...defaultJournalDraft, symbol: selectedStock, setup: '' })}>Clear Draft</ActionButton>
              <ActionButton theme={theme} active disabled={!journalDraft?.setup?.trim()} title={!journalDraft?.setup?.trim() ? "Enter a setup before saving" : "Save this journal draft"} onClick={addJournalEntry}>Save Record</ActionButton>
            </div>
          </div>
          <PremiumCard theme={theme}>
            <div style={{ padding: 12, display: "grid", gap: 12 }}>
            <PremiumTabs theme={theme} tabs={["Overview", "Trades", "Statistics", "Exports"]} active={journalView} onChange={setJournalView} />
              <label style={{ color: theme.muted, fontSize: 12 }}><input type="checkbox" aria-label="Group paper partial exits" checked={groupExits} onChange={event => updateFilters({ groupExits: event.target.checked })} /> Group paper partial exits by position</label>
              <span style={{ color: theme.muted, fontSize: 11 }}>{groupExits ? 'Grouped statistics count fully closed positions. Partial exits from positions still open are excluded; legacy exits without position IDs remain separate.' : 'Execution view counts each realized exit separately.'}</span>
              <div style={{ display: 'grid', gridTemplateColumns: isNarrowWorkspace ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
                <label style={{ display: 'grid', gap: 4, color: theme.muted, fontSize: 11 }}>From (ET)<input type="date" aria-label="Journal from date ET" value={filters.from} onChange={event => updateFilters({ from: event.target.value })} style={filterStyle} /></label>
                <label style={{ display: 'grid', gap: 4, color: theme.muted, fontSize: 11 }}>Through (ET)<input type="date" aria-label="Journal through date ET" value={filters.to} onChange={event => updateFilters({ to: event.target.value })} style={filterStyle} /></label>
                <label style={{ display: 'grid', gap: 4, color: theme.muted, fontSize: 11 }}>Symbol<select aria-label="Journal symbol filter" value={filters.symbol} onChange={event => updateFilters({ symbol: event.target.value })} style={filterStyle}><option value="">All symbols</option>{[...new Set([...symbols, ...(filters.symbol ? [filters.symbol] : [])])].map(symbol => <option key={symbol}>{symbol}</option>)}</select></label>
                <label style={{ display: 'grid', gap: 4, color: theme.muted, fontSize: 11 }}>Setup<select aria-label="Journal setup filter" value={filters.setup} onChange={event => updateFilters({ setup: event.target.value })} style={filterStyle}><option value="">All setups</option>{[...new Set([...setups, ...(filters.setup ? [filters.setup] : [])])].map(setup => <option key={setup}>{setup}</option>)}</select></label>
                <label style={{ display: 'grid', gap: 4, color: theme.muted, fontSize: 11 }}>Records<select aria-label="Journal record filter" value={filters.kind} onChange={event => updateFilters({ kind: event.target.value })} style={filterStyle}><option value="all">All records</option><option value="note">Notes</option><option value="trade">Trades</option></select></label>
              </div>
              <FilterBar theme={theme} search="Search journal records" value={filters.search} onSearchChange={search => updateFilters({ search })} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><ActionButton theme={theme} onClick={() => setJournalFilters?.({ ...DEFAULT_JOURNAL_FILTERS })}>Clear Filters</ActionButton><span role="status" style={{ color: scope.error ? theme.amber : theme.muted, fontSize: 11 }}>{scope.error || `${presentedRows.length} matching records · ${stats.total} completed USD trades${scope.unknownDateCount ? ` · ${scope.unknownDateCount} records excluded because their date is unknown` : ''}`}</span></div>
              <span style={{ color: theme.muted, fontSize: 11 }}>Date range uses the Eastern close/record day. Grouped positions include every partial exit and use their final close date. Table times are Pacific. Filters apply to records, statistics and comparisons.</span>
            </div>
          </PremiumCard>
          {showDraft && <PremiumCard theme={theme} title="Prepared Journal Draft">
              <div style={{ padding: 14, display: "flex", gap: 12, flexWrap: "wrap", color: theme.muted }}>
                <label>Record type <select aria-label="Journal record type" value={journalDraft.recordType || "note"} onChange={event => setJournalDraft(current => ({ ...current, recordType: event.target.value, status: event.target.value === "trade" ? "closed" : "note" }))}><option value="note">Note</option><option value="trade">Trade</option></select></label>
                {journalDraft.recordType === "trade" && <><label>Status <select aria-label="Journal trade status" value={journalDraft.status || "closed"} onChange={event => setJournalDraft(current => ({ ...current, status: event.target.value }))}><option value="closed">Closed</option><option value="open">Open</option></select></label><label>Side <select aria-label="Journal side" value={journalDraft.bias || "Long"} onChange={event => setJournalDraft(current => ({ ...current, bias: event.target.value }))}><option>Long</option><option>Short</option></select></label>{[["quantity","Quantity"],["entryPrice","Entry price"],["exitPrice","Exit price"],["fees","Total fees"]].map(([key,label])=><label key={key}>{label}<input aria-label={`Journal ${label.toLowerCase()}`} type="number" min="0" step="any" value={journalDraft[key] ?? ""} onChange={event => setJournalDraft(current => ({ ...current, [key]: event.target.value, pnl: null }))} style={{display:"block",width:100}} /></label>)}</>}
                {journalDraft.recordType === 'trade' && <label>Entry time (UTC)<input aria-label="Journal entry time UTC" type="datetime-local" value={journalDraft.openedAt ? String(journalDraft.openedAt).replace('Z', '').slice(0, 16) : ''} onChange={event => setJournalDraft(current => ({ ...current, openedAt: event.target.value ? `${event.target.value}:00Z` : null }))} /></label>}
                <span>Statistics include only completed USD trades with known P&amp;L. Enter total fees, including zero.</span>
              </div>
              <div style={{ padding: 14, display: "grid", gridTemplateColumns: isNarrowWorkspace ? "1fr" : "minmax(90px, .8fr) minmax(130px, 1.2fr) minmax(80px, .7fr) minmax(100px, .9fr) minmax(180px, 2fr)", gap: 12, alignItems: "end" }}>
                {[
                  ["Symbol", "symbol", journalDraft.symbol || selectedStock],
                  ["Setup", "setup", journalDraft.setup],
                ].map(([label, key, value]) => (
                  <label key={key} style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>
                    {label}
                    <input
                      aria-label={`Journal ${label.toLowerCase()}`}
                      value={value}
                      onChange={(event) => setJournalDraft?.((current) => ({ ...current, [key]: key === "symbol" ? event.target.value.toUpperCase() : event.target.value }))}
                      style={{ height: 34, minWidth: 0, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 9px", fontFamily: key === "symbol" ? terminalMonoFont : terminalSansFont }}
                    />
                  </label>
                ))}
                <label style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>
                  Grade
                  <select aria-label="Journal grade" value={journalDraft.grade || "B"} onChange={(event) => setJournalDraft?.((current) => ({ ...current, grade: event.target.value }))} style={{ height: 34, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px" }}>
                    {["A", "B", "C", "D"].map((grade) => <option key={grade}>{grade}</option>)}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>
                  Outcome
                  <select aria-label="Journal outcome" value={journalDraft.result || "Review"} onChange={(event) => setJournalDraft?.((current) => ({ ...current, result: event.target.value }))} style={{ height: 34, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px" }}>
                    {["Review", "Win", "Loss", "Breakeven"].map((result) => <option key={result}>{result}</option>)}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>
                  Review
                  <input aria-label="Journal review" value={journalDraft.review || ""} placeholder="What happened and what will you improve?" onChange={(event) => setJournalDraft?.((current) => ({ ...current, review: event.target.value }))} style={{ height: 34, minWidth: 0, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 9px" }} />
                </label>
              </div>
            </PremiumCard>}
            {showStatistics && <PremiumCard theme={theme}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))" }}>
                {[
                  ["Net P&L", money(journalNet), journalNet >= 0 ? "good" : "bad"],
                  ["Total Trades", String(tradeCount), "neutral"],
                  ["Win Rate", winRate, "good"],
                  ["Profit Factor", journalProfitFactor, "neutral"],
                  ["Avg Win", money(journalAvgWin), "good"],
                  ["Avg Loss", money(journalAvgLoss === null ? null : -journalAvgLoss), "bad"],
                  ["Expectancy", tradeCount ? money(journalNet / tradeCount) : "Unavailable", "neutral"],
                  ["Best Trade", tradeCount ? money(Math.max(...journalPnls)) : "Unavailable", stats.best >= 0 ? "good" : "bad"],
                  ["Worst Trade", tradeCount ? money(Math.min(...journalPnls)) : "Unavailable", stats.worst >= 0 ? "good" : "bad"],
                  ["Avg Hold Time", stats.averageHoldMs === null ? 'Unavailable' : `${(stats.averageHoldMs / 60000).toFixed(1)} min`, "neutral", `${stats.knownHoldCount} known entry times`],
                ].map(([label, value, tone, detail]) => (
                  <MetricTile key={label} theme={theme} label={label} value={value} tone={value === "Unavailable" ? "neutral" : tone} detail={detail} />
                ))}
              </div>
              <div style={{ padding: 14, borderTop: `1px solid ${theme.border}` }}>
                <label style={{ color: theme.muted, fontSize: 12 }}>Compare completed positions by <select aria-label="Journal analysis dimension" value={analysisDimension} onChange={event => setAnalysisDimension(event.target.value)}><option value="setup">Setup</option><option value="time">Entry hour (ET)</option><option value="session">Entry session</option></select></label>
                <p style={{ color: theme.muted, fontSize: 11 }}>Comparisons always group known paper position IDs. Entry time is never inferred from exit time.</p>
                <PremiumTable theme={theme} keyField="label" rows={breakdowns[analysisDimension]} emptyMessage="No completed trades to compare." columns={[
                  { key: 'label', label: 'Group', width: '1.5fr' }, { key: 'total', label: 'Trades', width: '70px' },
                  { key: 'net', label: 'Net P&L', width: '110px', render: row => money(row.net) },
                  { key: 'winRate', label: 'Win rate', width: '90px', render: row => `${row.winRate.toFixed(1)}%` },
                  { key: 'expectancy', label: 'Expectancy', width: '110px', render: row => money(row.expectancy) },
                  { key: 'profitFactor', label: 'Profit factor', width: '100px', render: row => row.profitFactor === null ? 'Unavailable' : row.profitFactor.toFixed(2) },
                ]} />
              </div>
            </PremiumCard>}
            {showStatistics && <div className="ws-journal-charts" style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "minmax(0, 1.35fr) 300px minmax(0, .85fr)", gap: 10 }}>
              <PremiumCard theme={theme} title="Equity Curve">
                <div style={{ padding: 16, height: 310 }}>
                  <div style={{ width: 170, marginBottom: 12 }}>
                    <StatusPill theme={theme} tone="neutral">Recorded Net P&amp;L</StatusPill>
                  </div>
                  <div style={{ height: 220, borderLeft: `1px solid ${theme.borderSoft || theme.border}`, borderBottom: `1px solid ${theme.borderSoft || theme.border}`, paddingTop: 12 }}>
                    <SeriesSparkline theme={theme} values={stats.curve} cumulative height={190} />
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
              <PremiumCard theme={theme} title="Recent Trade P&L">
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
            {showTrades && <PremiumCard theme={theme} title="Journal Records" action={<ActionButton theme={theme} active disabled={!journalDraft?.setup?.trim()} title={!journalDraft?.setup?.trim() ? "Enter a setup before saving" : "Save this journal draft"} onClick={addJournalEntry}>Save Draft</ActionButton>}>
              <PremiumTable
                theme={theme}
                columns={[
                  { key: "recordType", label: "Kind", width: "70px" },
                  { key: "date", label: "Date/Time (PT)", width: "150px" },
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
                  { key: "actions", label: "", width: "54px", align: "center", render: (row) => row.immutable ? <span title="Execution history is retained by the paper account">Auto</span> : <button type="button" aria-label={`Delete journal entry ${row.symbol}`} title="Delete journal entry" onClick={(event) => { event.stopPropagation(); removeJournalEntry?.(row.id); }} style={{ width: 28, height: 28, display: "grid", placeItems: "center", margin: "0 auto", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 5, background: "transparent", color: theme.muted, cursor: "pointer" }}><X size={13} /></button> },
                ]}
                rows={pagination.rows} keyField="id"
              />
              <RecordPagination theme={theme} state={pagination} label="journal records" />
            </PremiumCard>}
            {journalView === "Exports" && <PremiumCard theme={theme} title="Journal & Performance Exports">
              <div style={{ padding: 16, display: "grid", gridTemplateColumns: isNarrowWorkspace ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <ActionButton theme={theme} onClick={exportJournalCsv}>Journal CSV</ActionButton>
                <ActionButton theme={theme} disabled={Boolean(scope.error) || !presentedRows.length} onClick={() => exportJournalCsv?.(presentedRows, { filtered: true, filters })}>Filtered Journal CSV</ActionButton>
                <ActionButton theme={theme} onClick={exportDailyReport}>Daily Report</ActionButton>
                <ActionButton theme={theme} onClick={exportWeeklyReport}>Weekly Review</ActionButton>
              </div>
              <div style={{ padding: "0 16px 16px", color: theme.muted, fontSize: 12, lineHeight: 1.55 }}>Journal CSV retains all manual records and realized paper exits, including partial closes. Filtered Journal CSV exports every matching record in the selected grouped/execution view, including rows beyond the current page, and records its filter scope. Daily and weekly reports use their existing calendar periods rather than these filters. Paper exit P&amp;L includes allocated entry and exit commissions; slippage is included in fill prices. Account P&amp;L charges entry fees immediately, including positions still open.</div>
            </PremiumCard>}
        </div>
      </div>
    );
  
}
