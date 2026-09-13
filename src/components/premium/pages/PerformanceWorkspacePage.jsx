import { useState } from "react";
import { journalStatistics } from "../../../utils/journalAccounting.js";
import { money } from "../premiumWorkspaceData";
import { ActionButton, EmptyWorkspace, MetricTile, PremiumCard, PremiumTable, SectionTitle, SeriesSparkline } from "../PremiumWorkspacePrimitives";

export default function PerformanceWorkspacePage({ exportDailyReport, exportTradeSummaryCsv, exportWeeklyReport, isNarrowWorkspace, journalRows, page, theme }) {
  const [currency, setCurrency] = useState("USD");
  const stats = journalStatistics(journalRows, currency);
  const currencies = [...new Set(["USD", ...journalRows.map(row => row.currency || "USD")])];
  const bySymbol = [...stats.trades.reduce((map, row) => {
    const current = map.get(row.symbol) || { symbol: row.symbol, pnl: 0, trades: 0, wins: 0 };
    current.pnl += row.pnl; current.trades++; if (row.pnl > 0) current.wins++;
    map.set(row.symbol, current); return map;
  }, new Map()).values()];
  const display = value => value === null ? "Unavailable" : value.toFixed(2);
  return <div className="terminal-page" style={page}>
    <SectionTitle theme={theme} title="Performance" subtitle="Completed journal trades · full history · fees included when recorded" />
    <label style={{ color: theme.muted }}>Reporting currency <select aria-label="Performance currency" value={currency} onChange={event => setCurrency(event.target.value)}>{currencies.map(value => <option key={value}>{value}</option>)}</select></label>
    <p style={{ color: theme.muted, fontSize: 12 }}>{stats.total} completed trades in {currency}. {stats.excluded} notes, open trades, incomplete records, or other currencies excluded. No currency conversion is assumed.</p>
    {!stats.total ? <EmptyWorkspace theme={theme} title="No performance history" detail="Record a completed trade with a known net P&L, or quantity, entry, exit and fees. Notes remain in the Journal without affecting returns." /> : <>
      <PremiumCard theme={theme}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
        {[["Net P&L", money(stats.net)], ["Gross Profit", money(stats.grossProfit)], ["Gross Loss", money(-stats.grossLoss)], ["Win Rate", `${display(stats.winRate)}%`], ["Profit Factor", display(stats.profitFactor)], ["Max Drawdown", money(stats.maxDrawdown === null ? null : -stats.maxDrawdown)], ["Total Trades", stats.total], ["Expectancy", money(stats.expectancy)]].map(([label,value]) => <MetricTile key={label} theme={theme} label={label} value={value} />)}
      </div></PremiumCard>
      <PremiumCard theme={theme} title={`Cumulative realized P&L (${currency})`}><div style={{ padding: 16 }}>
        <SeriesSparkline theme={theme} values={stats.curve} cumulative height={240} />
        {stats.maxDrawdown === null && <p style={{ color: theme.muted }}>Curve and drawdown require a valid timestamp on every included trade.</p>}
      </div></PremiumCard>
      <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "1fr" : "2fr 1fr", gap: 12 }}>
        <PremiumCard theme={theme} title="Performance By Symbol"><PremiumTable theme={theme} columns={[
          {key:"symbol",label:"Symbol",width:"1fr"}, {key:"pnl",label:`Net P&L (${currency})`,width:"140px",render:row=>money(row.pnl)},
          {key:"trades",label:"Trades",width:"80px"}, {key:"wins",label:"Win rate",width:"90px",render:row=>`${(row.wins / row.trades * 100).toFixed(1)}%`},
        ]} rows={bySymbol} /></PremiumCard>
        <PremiumCard theme={theme} title="Trade Statistics"><div style={{ padding: 16, display: "grid", gap: 12 }}>
          {[["Average win", stats.averageWin], ["Average loss", stats.averageLoss === null ? null : -stats.averageLoss], ["Best trade", stats.best], ["Worst trade", stats.worst]].map(([label,value])=><div key={label} style={{display:"flex",justifyContent:"space-between"}}><span>{label}</span><b>{money(value)}</b></div>)}
        </div></PremiumCard>
      </div>
    </>}
    <PremiumCard theme={theme} title="Export Reports"><div style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
      <ActionButton theme={theme} onClick={exportDailyReport}>Daily Report</ActionButton>
      <ActionButton theme={theme} onClick={exportWeeklyReport}>Weekly Review</ActionButton>
      <ActionButton theme={theme} onClick={exportTradeSummaryCsv}>Trade Summary CSV</ActionButton>
    </div><p style={{padding:"0 16px",color:theme.muted,fontSize:12}}>Daily and weekly reports use USD journal records; CSV retains each record's currency.</p></PremiumCard>
  </div>;
}
