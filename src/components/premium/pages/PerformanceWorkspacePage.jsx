import { Download } from "lucide-react";
import { money, num } from "../premiumWorkspaceData";
import { ActionButton, EmptyWorkspace, MetricTile, PremiumCard, PremiumTable, SectionTitle, SeriesSparkline } from "../PremiumWorkspacePrimitives";

export default function PerformanceWorkspacePage({
  exportTradeSummaryCsv,
      isNarrowWorkspace,
      journalRows,
      page,
      positionRows,
      realizedPnL,
      theme,
      totalUnrealizedPnL
}) {
    const net = Number(realizedPnL || 0) + Number(totalUnrealizedPnL || 0);
    if (!journalRows.length && !positionRows.length && net === 0) {
      return <div style={page}><SectionTitle theme={theme} title="Performance" /><EmptyWorkspace theme={theme} title="No performance history" detail="Performance statistics will appear after confirmed journal entries or authenticated account activity exists. Sample P&L is intentionally disabled." /></div>;
    }
    const performanceValues = journalRows.map((row) => num(row.pnl));
    const grossProfit = performanceValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
    const grossLoss = Math.abs(performanceValues.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
    const wins = performanceValues.filter((value) => value > 0);
    const losses = performanceValues.filter((value) => value < 0);
    const winRate = performanceValues.length ? (wins.length / performanceValues.length) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;
    const avgWin = wins.length ? grossProfit / wins.length : 0;
    const avgLoss = losses.length ? grossLoss / losses.length : 0;
    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    performanceValues.forEach((value) => { equity += value; peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, peak - equity); });
    const bySymbol = Array.from(journalRows.reduce((map, row) => {
      const current = map.get(row.symbol) || { symbol: row.symbol, pnl: 0, trades: 0, wins: 0 };
      current.pnl += num(row.pnl);
      current.trades += 1;
      if (num(row.pnl) > 0) current.wins += 1;
      map.set(row.symbol, current);
      return map;
    }, new Map()).values()).map((row) => ({ ...row, ret: "Not calculated", win: `${((row.wins / row.trades) * 100).toFixed(1)}%` }));
    return (
      <div style={page}>
        <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "minmax(0, 1fr) 320px", gap: 10 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <SectionTitle theme={theme} title="Performance" />
            <PremiumCard theme={theme}><div style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0,1fr))" }}>{[["Net P&L", money(performanceValues.length ? performanceValues.reduce((a, b) => a + b, 0) : net), net >= 0 ? "good" : "bad"], ["Gross Profit", money(grossProfit), "good"], ["Gross Loss", money(-grossLoss), "bad"], ["Win Rate", `${winRate.toFixed(1)}%`, "neutral"], ["Profit Factor", profitFactor === null ? "Unavailable" : profitFactor.toFixed(2), "neutral"], ["Max Drawdown", money(-maxDrawdown), "bad"], ["Total Trades", String(performanceValues.length)], ["Avg Win", money(avgWin), "good"]].map(([a, b, tone]) => <MetricTile key={a} theme={theme} label={a} value={b} tone={tone} />)}</div></PremiumCard>
            <PremiumCard theme={theme} title="Recorded P&L Curve"><div style={{ height: 270, padding: 16 }}><SeriesSparkline theme={theme} values={performanceValues} height={240} /></div></PremiumCard>
            <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "0.9fr 1.1fr", gap: 10 }}>
              <PremiumCard theme={theme} title="P&L Breakdown"><div style={{ padding: 22, display: "grid", placeItems: "center", minHeight: 220 }}><div style={{ width: 150, height: 150, borderRadius: "50%", background: grossProfit + grossLoss > 0 ? `conic-gradient(${theme.green} 0 ${(grossProfit / (grossProfit + grossLoss)) * 100}%, ${theme.red} ${(grossProfit / (grossProfit + grossLoss)) * 100}% 100%)` : theme.panel2, display: "grid", placeItems: "center" }}><div style={{ width: 90, height: 90, borderRadius: "50%", background: theme.bg, display: "grid", placeItems: "center", textAlign: "center" }}>{money(performanceValues.reduce((a, b) => a + b, 0))}<br /><span style={{ color: theme.muted, fontSize: 11 }}>Recorded P&L</span></div></div></div></PremiumCard>
              <PremiumCard theme={theme} title="Performance By Symbol"><PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true }, { key: "pnl", label: "Net P&L", width: "100px", align: "right", render: (row) => money(row.pnl), color: (row) => row.pnl >= 0 ? theme.green : theme.red }, { key: "ret", label: "Return", width: "100px", align: "right" }, { key: "trades", label: "Trades", width: "70px" }, { key: "win", label: "Win Rate", width: "90px" }]} rows={bySymbol} emptyMessage="No journal performance by symbol" /></PremiumCard>
            </div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme} title="Performance Summary"><div style={{ padding: 14, display: "grid", gap: 12 }}>{[["Recorded Net P&L", money(performanceValues.reduce((a, b) => a + b, 0))], ["Average Win", money(avgWin)], ["Average Loss", money(-avgLoss)], ["Profit Factor", profitFactor === null ? "Unavailable" : profitFactor.toFixed(2)], ["Account Return", "Unavailable"], ["Alpha", "Unavailable"], ["Sharpe Ratio", "Unavailable"]].map(([a, b]) => <div key={a} style={{ display: "flex", justifyContent: "space-between" }}><span>{a}</span><b>{b}</b></div>)}</div></PremiumCard>
            <PremiumCard theme={theme} title="Risk Metrics"><div style={{ padding: 14, display: "grid", gap: 12 }}><div>Max drawdown {money(-maxDrawdown)}</div><div>Best trade {money(Math.max(0, ...performanceValues))}</div><div>Worst trade {money(Math.min(0, ...performanceValues))}</div></div></PremiumCard>
            <PremiumCard theme={theme} title="Export Reports"><div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><ActionButton theme={theme} disabled title="PDF report export is not wired yet">PDF <Download size={14} /></ActionButton><ActionButton theme={theme} onClick={exportTradeSummaryCsv}>CSV <Download size={14} /></ActionButton></div></PremiumCard>
          </div>
        </div>
      </div>
    );
  
}

