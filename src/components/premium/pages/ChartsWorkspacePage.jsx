import { terminalMonoFont } from "../../../config/terminalConfig";
import { CHART_INDICATOR_OPTIONS } from "../../../indicators/chartIndicators";
import { formatPercent, formatPrice } from "../../../utils/dashboardFormatters";
import { hasNumericValue, money, nullableMoveOf, pct, toneColor } from "../premiumWorkspaceData";
import { ActionButton, DetailRail, PremiumCard, PremiumTable } from "../PremiumWorkspacePrimitives";

export default function ChartsWorkspacePage({
  chartIndicators,
  dashboard,
  gridMode,
  isNarrowWorkspace,
  layoutMode,
  page,
  renderChartGrid,
  selectMainSymbol,
  selected,
  selectedActions,
  setGridMode,
  setLayoutMode,
  setOrderMessage,
  stocks,
  theme,
  viewportHeight
}) {
    const enabledIndicatorRows = CHART_INDICATOR_OPTIONS
      .filter((indicator) => Boolean(chartIndicators?.[indicator.id]))
      .map((indicator) => ({
        indicator: indicator.label,
        status: "Enabled",
        params: indicator.id.startsWith("ema") ? `Period: ${indicator.id.replace("ema", "")}` : "Chart-calculated",
        value: "See chart",
        signal: "Not classified",
      }));
    const activeChartLayout = layoutMode === "1" ? "1" : gridMode === "4" ? "4" : gridMode === "3" ? "3" : "2";
    const chartStageHeight = isNarrowWorkspace
      ? "auto"
      : Math.max(
          activeChartLayout === "1" ? 520 : 470,
          Math.min(
            activeChartLayout === "1" ? 680 : 620,
            viewportHeight - (activeChartLayout === "1" ? 300 : 190)
          )
        );
    const showChartIntelCards = activeChartLayout === "1" && !isNarrowWorkspace;
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
    const intelligenceCards = [
      {
        title: "AI Market Brief",
        body: selected.whyMoving || selected.catalyst || selected.setup || "No confirmed catalyst is available for this symbol yet.",
        footer: nullableMoveOf(selected) === null ? "Context pending" : `${pct(nullableMoveOf(selected))} selected move`,
        tone: nullableMoveOf(selected) === null ? "neutral" : nullableMoveOf(selected) >= 0 ? "good" : "bad",
      },
      {
        title: "Market Breadth",
        body: `${stocks.filter((row) => nullableMoveOf(row) !== null && nullableMoveOf(row) >= 0).length} advancing / ${stocks.filter((row) => nullableMoveOf(row) !== null && nullableMoveOf(row) < 0).length} declining symbols in the current workspace feed.`,
        footer: `${stocks.length} tracked symbols`,
        tone: "neutral",
      },
      {
        title: "AI Signals",
        body: enabledIndicatorRows.length
          ? `${enabledIndicatorRows.map((row) => row.indicator).join(", ")} enabled on charts.`
          : "No optional chart indicators are enabled. EMA overlays remain available on the chart.",
        footer: `${enabledIndicatorRows.length} enabled`,
        tone: enabledIndicatorRows.length ? "good" : "neutral",
      },
      {
        title: "Sector Pulse",
        body: `${selected.sector || "Sector context"} is the active context for ${selected.symbol}. Scanner rank and news context update when provider data is available.`,
        footer: selected.risk ? `Risk: ${selected.risk}` : "Risk context pending",
        tone: selected.risk === "Low" || selected.risk === "Controlled" ? "good" : "warn",
      },
    ];

    return (
      <div style={{ ...page, overflow: isNarrowWorkspace ? "auto" : "hidden" }}>
        <div
          style={{
            height: isNarrowWorkspace ? "auto" : "100%",
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "minmax(0, 1fr) clamp(300px, 20vw, 360px)",
            gridTemplateRows: isNarrowWorkspace
              ? "auto"
              : showChartIntelCards
                ? `minmax(0, ${chartStageHeight}px) minmax(108px, 118px)`
                : `minmax(0, ${chartStageHeight}px)`,
            gap: 10,
            overflow: "hidden",
          }}
        >
          <PremiumCard
            theme={theme}
            style={{
              minHeight: 0,
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
                <div style={{ color: theme.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>Charts</div>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginTop: 3 }}>
                  <strong style={{ color: theme.text, fontFamily: terminalMonoFont, fontSize: 18 }}>{selected.symbol}</strong>
                  <span style={{ color: hasNumericValue(selected.price) ? theme.text : theme.muted, fontFamily: terminalMonoFont, fontWeight: 900 }}>
                    {hasNumericValue(selected.price) ? money(selected.price) : "Price pending"}
                  </span>
                  <span style={{ color: nullableMoveOf(selected) === null ? theme.muted : toneColor(theme, nullableMoveOf(selected)), fontFamily: terminalMonoFont, fontWeight: 900 }}>
                    {nullableMoveOf(selected) === null ? "Move pending" : pct(nullableMoveOf(selected))}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <span style={{ color: theme.muted, fontSize: 11, fontWeight: 850 }}>Layout</span>
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
            </div>
            <div style={{ minHeight: 0, padding: 8, overflow: "hidden" }}>
              {renderChartGrid?.({
                layoutMode: activeChartLayout === "1" ? "1" : "2",
                gridMode: activeChartLayout,
              })}
            </div>
          </PremiumCard>

          <div
            style={{
              gridColumn: isNarrowWorkspace ? "auto" : "2 / 3",
              gridRow: isNarrowWorkspace ? "auto" : "1 / 3",
              minHeight: 0,
              display: "grid",
              gap: 10,
              alignContent: "start",
              overflow: "hidden",
            }}
          >
            <DetailRail theme={theme} selected={selected} actions={selectedActions} compact detailStats={chartStats}>
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
          </div>

          {showChartIntelCards && (
            <div
              style={{
                gridColumn: isNarrowWorkspace ? "auto" : "1 / 2",
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 10,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {intelligenceCards.map((card) => {
                const tone = card.tone === "good" ? theme.green : card.tone === "bad" ? theme.red : card.tone === "warn" ? theme.amber : theme.blue;
                return (
                  <PremiumCard key={card.title} theme={theme} style={{ overflow: "hidden" }}>
                    <div style={{ padding: 12, display: "grid", gap: 6, minHeight: 0 }}>
                      <div style={{ color: theme.text, fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>{card.title}</div>
                      <div style={{ color: theme.muted, fontSize: 11, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{card.body}</div>
                      <div style={{ marginTop: "auto", color: tone, fontFamily: terminalMonoFont, fontSize: 10, fontWeight: 900 }}>{card.footer}</div>
                    </div>
                  </PremiumCard>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  
}

