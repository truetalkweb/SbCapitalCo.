import { terminalMonoFont } from "../../../config/terminalConfig";
import { formatPercent, formatPrice } from "../../../utils/dashboardFormatters";
import { hasNumericValue, money, nullableMoveOf, pct, toneColor } from "../premiumWorkspaceData";
import { ActionButton, DetailRail, PremiumCard, PremiumTable } from "../PremiumWorkspacePrimitives";

export default function ChartsWorkspacePage({
  workflowTools,
  chartRailVisible,
  chartRailWidth,
  alertContext,
  reviewOrder,
  dashboard,
  gridMode,
  isNarrowWorkspace,
  layoutMode,
  page,
  renderChartGrid,
  selectMainSymbol,
  selected,
  selectedActions,
  tradePlanEditor,
  setGridMode,
  setLayoutMode,
  setOrderMessage,
  theme
}) {
    const sidePanelWidth = Number.isFinite(chartRailWidth) ? Math.max(260, Math.min(400, chartRailWidth)) + "px" : "clamp(300px, 20vw, 360px)";
    const activeChartLayout = layoutMode === "1" ? "1" : gridMode === "4" ? "4" : gridMode === "3" ? "3" : "2";
    const setDeskLayout = (nextLayout) => {
      setLayoutMode?.(nextLayout === "1" ? "1" : "2");
      setGridMode?.(nextLayout === "1" ? "2" : nextLayout);
      setOrderMessage?.(`${nextLayout} chart trading desk layout selected.`);
    };
    const chartStats = [
      ["Day High", selected.dayHigh ?? selected.high],
      ["Day Low", selected.dayLow ?? selected.low],
      ["Volume", selected.volume],
      ["Float", selected.floatShares ?? selected.float],
      ["Market Cap", selected.marketCap],
      ["Beta", selected.beta],
    ];
    return (
      <div className="terminal-page ws-charts-page" style={{ ...page, overflow: isNarrowWorkspace ? "auto" : "hidden" }}>
        <div
          style={{
            height: isNarrowWorkspace ? "auto" : "100%",
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: isNarrowWorkspace || !chartRailVisible ? "minmax(0, 1fr)" : "minmax(0, 1fr) " + sidePanelWidth,
            gridTemplateRows: isNarrowWorkspace ? "auto" : "minmax(300px, 1fr)",
            gap: 12,
            overflow: "hidden",
          }}
        >
          <PremiumCard
            theme={theme}
            style={{
              minHeight: isNarrowWorkspace ? 500 : 0,
              display: "grid",
              gridTemplateRows: "auto minmax(0, 1fr)",
              gridColumn: isNarrowWorkspace ? "auto" : "1 / 2",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                minHeight: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "8px 12px",
                borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ color: theme.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Charts</div>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginTop: 3 }}>
                  <strong style={{ color: theme.text, fontFamily: terminalMonoFont, fontSize: 18 }}>{selected.symbol}</strong>
                  <span style={{ color: hasNumericValue(selected.price) ? theme.text : theme.muted, fontFamily: terminalMonoFont, fontWeight: 600 }}>
                    {hasNumericValue(selected.price) ? money(selected.price) : "Price pending"}
                  </span>
                  <span style={{ color: nullableMoveOf(selected) === null ? theme.muted : toneColor(theme, nullableMoveOf(selected)), fontFamily: terminalMonoFont, fontWeight: 600 }}>
                    {nullableMoveOf(selected) === null ? "Move pending" : pct(nullableMoveOf(selected))}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <span style={{ color: theme.muted, fontSize: 11, fontWeight: 600 }}>Layout</span>
                {["1", "2", "3", "4"].map((item) => (
                  <ActionButton
                    key={item}
                    theme={theme}
                    active={activeChartLayout === item}
                    onClick={() => setDeskLayout(item)}
                    style={{ width: 38, height: 28, padding: 0 }}
                    aria-label={`${item} chart layout`}
                  >
                    {item}
                  </ActionButton>
                ))}
              </div>
              {!chartRailVisible && <ActionButton theme={theme} good onClick={reviewOrder}>Review Paper Order</ActionButton>}
              {alertContext && <div role="status" style={{ color: theme.muted }}>Opened from alert · {alertContext.symbol} price {alertContext.direction} {money(alertContext.trigger)}</div>}
              {workflowTools}
            </div>
            <div style={{ minHeight: 0, padding: 8, overflow: "hidden" }}>
              {renderChartGrid?.({
                layoutMode: activeChartLayout === "1" ? "1" : "2",
                gridMode: activeChartLayout,
              })}
            </div>
          </PremiumCard>

          {chartRailVisible && <div
            style={{
              gridColumn: isNarrowWorkspace ? "auto" : "2 / 3",
              gridRow: isNarrowWorkspace ? "auto" : "1 / 2",
              minHeight: 0,
              display: "grid",
              gap: 10,
              alignContent: "start",
              overflow: "auto",
            }}
          >
            <DetailRail theme={theme} selected={selected} actions={selectedActions} compact detailStats={chartStats}>
              {tradePlanEditor}
              <PremiumCard theme={theme} title="Watchlist">
                <PremiumTable
                  theme={theme}
                  columns={[
                    { key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true },
                    { key: "price", label: "Last", width: "72px", align: "right", mono: true, render: (row) => hasNumericValue(row.price) ? formatPrice(row.price) : "Pending" },
                    { key: "change", label: "Chg%", width: "64px", align: "right", mono: true, color: (row) => nullableMoveOf(row) === null ? theme.muted : toneColor(theme, nullableMoveOf(row)), render: (row) => nullableMoveOf(row) === null ? "Pending" : formatPercent(nullableMoveOf(row)) },
                  ]}
                  rows={dashboard.watchlistRows.slice(0, 7)}
                  selectedKey={selected.symbol}
                  onSelect={(row) => selectMainSymbol?.(row.symbol, row, "scanner-row")}
                  rowMinHeight={30}
                  headerMinHeight={28}
                  cellPadding="0 9px"
                  columnGap={7}
                  style={{ maxHeight: 260 }}
                />
              </PremiumCard>
              <PremiumCard theme={theme} title="Chart Context">
                <div style={{ padding: 12, display: "grid", gap: 9, color: theme.muted, fontSize: 12, lineHeight: 1.45 }}>
                  <div><b style={{ color: theme.text }}>Catalyst:</b> {selected.catalyst || selected.setup || "No verified catalyst available"}</div>
                  <div><b style={{ color: theme.text }}>Data:</b> {selected.dataMode === "provider" ? "Provider data" : selected.dataMode === "cached" ? "Cached data" : "Fallback context"}</div>
                  <div><b style={{ color: theme.text }}>Trade:</b> Review-only shortcuts. No live broker execution from this workspace.</div>
                </div>
              </PremiumCard>
            </DetailRail>
          </div>}

        </div>
      </div>
    );
  
}
