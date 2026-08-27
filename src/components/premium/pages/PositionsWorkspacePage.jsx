import { terminalMonoFont } from "../../../config/terminalConfig";
import { money } from "../premiumWorkspaceData";
import { EmptyWorkspace, FilterBar, PremiumCard, PremiumTable, PremiumTabs, SectionTitle, StatusPill } from "../PremiumWorkspacePrimitives";

export default function PositionsWorkspacePage({
  mainTwoCol,
      orderRows,
      page,
      positionView,
      positionRows,
      selectMainSymbol,
      selectedPosition,
      selectedRail,
      setSelectedPositionSymbol,
      setPositionView,
      stocks,
      theme
}) {
    if (positionRows.length === 0) {
      return <div style={page}><SectionTitle theme={theme} title="Positions" /><EmptyWorkspace theme={theme} title="No connected positions" detail="Portfolio positions appear here only after an authenticated broker account supplies account data. No sample holdings are shown." /></div>;
    }
    const enriched = positionRows.map((row) => ({
      ...row,
      marketValue: row.last * row.qty,
      dayPnl: Number.isFinite(row.dayPnl) ? row.dayPnl : (row.last - row.avg) * row.qty,
      totalPnl: Number.isFinite(row.totalPnl) ? row.totalPnl : (row.last - row.avg) * row.qty,
    }));
    const portfolioValue = enriched.reduce((total, row) => total + row.marketValue, 0);
    const positionAllocation = enriched.map((row) => ({
      symbol: row.symbol,
      percent: portfolioValue > 0 ? (row.marketValue / portfolioValue) * 100 : null,
    }));
    const selectedPositionContext = stocks.find((row) => row.symbol === selectedPosition?.symbol);
    const selectPosition = (row) => {
      setSelectedPositionSymbol(row.symbol);
      selectMainSymbol?.(row.symbol, row, "position-row");
    };
    const openColumns = [
      { key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true },
      { key: "side", label: "Side", width: "80px", color: (row) => row.side === "SHORT" ? theme.red : theme.green },
      { key: "qty", label: "Qty", width: "70px", align: "right" },
      { key: "avg", label: "Avg Price", width: "100px", align: "right", mono: true, render: (row) => row.avg.toFixed(2) },
      { key: "last", label: "Last Price", width: "100px", align: "right", mono: true, render: (row) => row.last.toFixed(2) },
      { key: "marketValue", label: "Market Value", width: "120px", align: "right", mono: true, render: (row) => money(row.marketValue) },
      { key: "dayPnl", label: "Day P&L", width: "100px", align: "right", mono: true, color: (row) => row.dayPnl >= 0 ? theme.green : theme.red, render: (row) => money(row.dayPnl) },
      { key: "totalPnl", label: "Total P&L", width: "100px", align: "right", mono: true, color: (row) => row.totalPnl >= 0 ? theme.green : theme.red, render: (row) => money(row.totalPnl) },
      { key: "risk", label: "Risk", width: "80px", align: "center", render: (row) => <StatusPill theme={theme} tone="warn">{row.risk}</StatusPill> },
    ];
    const holdingsColumns = openColumns.filter((column) => !["dayPnl", "totalPnl", "risk"].includes(column.key));
    const allocationRows = enriched.map((row) => ({
      ...row,
      allocation: portfolioValue > 0 ? (row.marketValue / portfolioValue) * 100 : null,
    }));
    const allocationColumns = [
      { key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true },
      { key: "marketValue", label: "Market Value", width: "140px", align: "right", mono: true, render: (row) => money(row.marketValue) },
      { key: "allocation", label: "Portfolio %", width: "120px", align: "right", mono: true, render: (row) => row.allocation === null ? "Unavailable" : `${row.allocation.toFixed(1)}%` },
      { key: "allocationBar", label: "Allocation", width: "1.4fr", render: (row) => <div style={{ height: 6, background: theme.panel2, borderRadius: 99 }}><div style={{ width: `${Math.min(row.allocation || 0, 100)}%`, height: "100%", borderRadius: 99, background: theme.blue }} /></div> },
    ];
    const positionContent = positionView === "Closed Positions"
      ? <EmptyWorkspace theme={theme} title="No closed-position history" detail="Closed positions require authenticated realized-position history from the broker. Filled orders are not presented as closed positions." />
      : <PremiumTable
          theme={theme}
          columns={positionView === "Allocations" ? allocationColumns : positionView === "Holdings" ? holdingsColumns : openColumns}
          rows={positionView === "Allocations" ? allocationRows : enriched}
          selectedKey={selectedPosition?.symbol}
          onSelect={selectPosition}
        />;
    return (
      <div style={page}>
        <div style={mainTwoCol}>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme}>
              <div style={{ padding: 16, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}><SectionTitle theme={theme} title="Positions" /><PremiumTabs theme={theme} tabs={["Open Positions", "Closed Positions", "Holdings", "Allocations"]} active={positionView} onChange={setPositionView} />{positionView !== "Closed Positions" && <div style={{ marginTop: 14 }}><FilterBar theme={theme} search="All Symbols" items={["All Accounts", "All Sectors", "Sort: P&L %"]} /></div>}</div>
              {positionContent}
            </PremiumCard>
            <PremiumCard theme={theme} title="Position Activity"><PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "120px" }, { key: "symbol", label: "Symbol", width: "100px", mono: true }, { key: "action", label: "Action", width: "120px" }, { key: "side", label: "Side", width: "90px" }, { key: "qty", label: "Qty", width: "80px" }, { key: "note", label: "Status", width: "1fr" }]} rows={orderRows.filter((row) => enriched.some((position) => position.symbol === row.symbol)).slice(0, 5).map((row) => ({ time: row.time, symbol: row.symbol, action: row.status, side: row.side, qty: row.qty, note: "Authenticated order record" }))} emptyMessage="No authenticated position activity" /></PremiumCard>
          </div>
          {selectedRail(<><PremiumCard theme={theme} title="Position Context"><div style={{ padding: 14, display: "grid", gap: 10, color: theme.muted }}><div><b style={{ color: theme.text }}>Catalyst:</b> {selectedPositionContext?.catalyst || "No verified catalyst available"}</div><div><b style={{ color: theme.text }}>Risk:</b> {selectedPosition?.risk || "Unavailable"}</div><div><b style={{ color: theme.text }}>Technical insight:</b> Unavailable without a verified analysis feed</div></div></PremiumCard><PremiumCard theme={theme} title="Position Allocation"><div style={{ padding: 14, display: "grid", gap: 12 }}>{positionAllocation.map((row) => <div key={row.symbol} style={{ color: theme.text }}><span style={{ fontFamily: terminalMonoFont }}>{row.symbol}</span> {row.percent === null ? "Unavailable" : `${row.percent.toFixed(1)}%`}<div style={{ height: 5, background: theme.panel2, borderRadius: 99, marginTop: 5 }}><div style={{ width: row.percent === null ? "0%" : `${Math.min(row.percent, 100)}%`, height: "100%", background: theme.blue, borderRadius: 99 }} /></div></div>)}</div></PremiumCard></>)}
        </div>
      </div>
    );
  
}
