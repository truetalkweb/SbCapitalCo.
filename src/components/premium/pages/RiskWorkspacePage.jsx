import { terminalMonoFont } from "../../../config/terminalConfig";
import { money } from "../premiumWorkspaceData";
import { EmptyWorkspace, FilterBar, PremiumCard, PremiumTable, PremiumTabs, SectionTitle, StatusPill } from "../PremiumWorkspacePrimitives";

export default function RiskWorkspacePage({
  alertRows,
      mainTwoCol,
      page,
      positionRows,
      riskView,
      selectMainSymbol,
      selectedPosition,
      setSelectedPositionSymbol,
      setRiskView,
      theme
}) {
    if (positionRows.length === 0) {
      return <div style={page}><SectionTitle theme={theme} title="Risk" /><EmptyWorkspace theme={theme} title="Risk data unavailable" detail="Risk, exposure, beta, and VaR require authenticated portfolio positions. The terminal will not manufacture portfolio metrics when no account data exists." /></div>;
    }
    const totalMarketValue = positionRows.reduce((sum, row) => sum + row.last * row.qty, 0);
    const largestPosition = positionRows.reduce((largest, row) => Math.max(largest, row.last * row.qty), 0);
    const riskEvents = alertRows.filter((row) => row.status !== "Active").map((row) => ({
      time: row.created,
      type: row.type,
      severity: "Review",
      message: row.condition,
      symbol: row.symbol,
      status: row.status,
    }));
    const exposureRows = positionRows.map((row) => ({
      ...row,
      marketValue: row.last * row.qty,
      exposurePercent: totalMarketValue ? ((row.last * row.qty) / totalMarketValue) * 100 : null,
    }));
    const selectRiskPosition = (row) => {
      setSelectedPositionSymbol(row.symbol);
      selectMainSymbol?.(row.symbol, row, "risk-row");
    };
    const overviewColumns = [
      { key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true },
      { key: "side", label: "Side", width: "80px", color: (row) => row.side === "SHORT" ? theme.red : theme.green },
      { key: "qty", label: "Qty", width: "70px" },
      { key: "last", label: "Last Price", width: "100px", align: "right", mono: true, render: (row) => row.last.toFixed(2) },
      { key: "market", label: "Market Value", width: "120px", align: "right", mono: true, render: (row) => money(row.last * row.qty) },
      { key: "day", label: "Day P&L", width: "100px", align: "right", color: (row) => row.dayPnl >= 0 ? theme.green : theme.red, render: (row) => money(row.dayPnl) },
      { key: "exposure", label: "Exposure %", width: "90px", align: "right", render: (row) => totalMarketValue ? `${(((row.last * row.qty) / totalMarketValue) * 100).toFixed(1)}%` : "Unavailable" },
      { key: "beta", label: "Beta", width: "70px", render: (row) => row.beta ?? "Unavailable" },
      { key: "var", label: "VaR (1D)", width: "100px", align: "right", render: (row) => row.var1d === null ? "Unavailable" : money(row.var1d) },
      { key: "risk", label: "Risk", width: "90px", render: (row) => <StatusPill theme={theme} tone="warn">{row.risk}</StatusPill> },
    ];
    const exposureColumns = [
      { key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true },
      { key: "marketValue", label: "Market Value", width: "130px", align: "right", mono: true, render: (row) => money(row.marketValue) },
      { key: "exposurePercent", label: "Exposure", width: "100px", align: "right", mono: true, render: (row) => row.exposurePercent === null ? "Unavailable" : `${row.exposurePercent.toFixed(1)}%` },
      { key: "exposureBar", label: "Portfolio Weight", width: "1.5fr", render: (row) => <div style={{ height: 6, background: theme.panel2, borderRadius: 99 }}><div style={{ width: `${Math.min(row.exposurePercent || 0, 100)}%`, height: "100%", borderRadius: 99, background: row.exposurePercent > 25 ? theme.amber : theme.blue }} /></div> },
      { key: "risk", label: "Context", width: "100px", render: (row) => <StatusPill theme={theme} tone={row.exposurePercent > 25 ? "warn" : "neutral"}>{row.exposurePercent > 25 ? "Concentrated" : "Observed"}</StatusPill> },
    ];
    const limitRows = [
      { metric: "Largest position", current: totalMarketValue ? `${((largestPosition / totalMarketValue) * 100).toFixed(1)}%` : "Unavailable", reference: "25% review threshold", status: totalMarketValue && largestPosition / totalMarketValue > 0.25 ? "Review" : "Within reference" },
      { metric: "Gross exposure", current: money(totalMarketValue), reference: "Account-specific", status: "Context only" },
      { metric: "Daily VaR", current: "Unavailable", reference: "Requires verified model", status: "Not calculated" },
      { metric: "Margin usage", current: "Unavailable", reference: "Requires broker field", status: "Not calculated" },
    ];
    const limitColumns = [
      { key: "metric", label: "Risk Measure", width: "1fr", strong: true },
      { key: "current", label: "Current", width: "150px", align: "right", mono: true },
      { key: "reference", label: "Reference", width: "190px" },
      { key: "status", label: "Status", width: "130px", render: (row) => <StatusPill theme={theme} tone={row.status === "Review" ? "warn" : "neutral"}>{row.status}</StatusPill> },
    ];
    const riskContent = riskView === "Exposure"
      ? <PremiumTable theme={theme} columns={exposureColumns} rows={exposureRows} selectedKey={selectedPosition?.symbol} onSelect={selectRiskPosition} />
      : riskView === "Limits"
        ? <PremiumTable theme={theme} columns={limitColumns} rows={limitRows} keyField="metric" />
        : riskView === "Stress Test"
          ? <EmptyWorkspace theme={theme} title="Stress model unavailable" detail="Scenario stress testing needs verified historical correlations and account risk inputs. The terminal will not synthesize a stress result." />
          : riskView === "Margin"
            ? <EmptyWorkspace theme={theme} title="Margin data unavailable" detail="Margin requirements and excess liquidity must come from the authenticated broker account." />
            : <PremiumTable theme={theme} columns={overviewColumns} rows={positionRows} selectedKey={selectedPosition?.symbol} onSelect={selectRiskPosition} />;
    return (
      <div style={page}>
        <div style={mainTwoCol}>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme}>
              <div style={{ padding: 16, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}><SectionTitle theme={theme} title="Risk" /><PremiumTabs theme={theme} tabs={["Overview", "Limits", "Exposure", "Stress Test", "Margin"]} active={riskView} onChange={setRiskView} />{["Overview", "Exposure"].includes(riskView) && <div style={{ marginTop: 14 }}><FilterBar theme={theme} search="All Accounts" items={["All Symbols", "Risk Model: Standard"]} /></div>}</div>
              {riskContent}
            </PremiumCard>
            <PremiumCard theme={theme} title="Risk Events & Limits"><PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "140px" }, { key: "type", label: "Type", width: "180px" }, { key: "severity", label: "Severity", width: "100px", render: (row) => <StatusPill theme={theme} tone="warn">{row.severity}</StatusPill> }, { key: "message", label: "Message", width: "1fr" }, { key: "symbol", label: "Symbol", width: "90px", mono: true }, { key: "status", label: "Status", width: "100px" }]} rows={riskEvents} emptyMessage="No risk events recorded" /></PremiumCard>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme} title="Portfolio Risk Overview">
              <div style={{ padding: 14, display: "grid", gap: 12, minWidth: 0 }}>
                {[
                  ["Gross Exposure", money(totalMarketValue)],
                  ["Portfolio Beta", "Unavailable"],
                  ["VaR (1D)", "Unavailable"],
                  ["Largest Position", totalMarketValue ? `${((largestPosition / totalMarketValue) * 100).toFixed(1)}%` : "Unavailable"],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, color: theme.muted, fontSize: 12 }}>
                    <span>{label}</span>
                    <b style={{ color: String(value).startsWith("-") ? theme.red : theme.text, fontFamily: terminalMonoFont }}>{value}</b>
                  </div>
                ))}
              </div>
            </PremiumCard>
            <PremiumCard theme={theme} title="Risk Insight"><div style={{ padding: 14, color: theme.muted, lineHeight: 1.6 }}>Position exposure is calculated from authenticated holdings. Beta, VaR, and sector analytics remain unavailable until the broker supplies those fields.</div></PremiumCard>
          </div>
        </div>
      </div>
    );
  
}
