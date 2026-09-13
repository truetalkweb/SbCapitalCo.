import { useState } from "react";
import { normalizeAdditionalCharts, resolveChartQuote } from "../utils/chartPanels.js";

export default function WorkspaceGrid({
  theme, layoutMode, gridMode, renderChartPanel,
  selectedStock, setMainSymbol, secondarySymbol, setSecondarySymbol,
  timeframe, setMainTimeframe, secondaryTimeframe, setSecondaryTimeframe,
  selectedStockData, secondaryStockData, allSymbols = [],
  mainChartStatus, secondaryChartStatus, setMainChartStatus, setSecondaryChartStatus,
  syncCharts, additionalCharts, setAdditionalCharts,
  compact = false, embeddedChart = false, viewportWidth = 1920, workstation = false,
}) {
  const count = compact || layoutMode === "1" ? 1 : gridMode === "4" ? 4 : gridMode === "3" ? 3 : 2;
  const narrow = viewportWidth <= 760 && count > 1;
  const [activeTile, setActiveTile] = useState(0);
  const [extraStatus, setExtraStatus] = useState({});
  const extra = normalizeAdditionalCharts(additionalCharts);
  const updateExtra = (id, patch) => setAdditionalCharts?.(current => {
    const normalized = normalizeAdditionalCharts(current);
    return normalizeAdditionalCharts({ ...normalized, [id]: { ...normalized[id], ...patch } });
  });
  const panels = [
    { id: "main", title: "Main Chart", symbol: selectedStock, setSymbol: setMainSymbol, tf: timeframe, setTf: setMainTimeframe,
      fallback: selectedStockData, chartStatus: mainChartStatus, onStatusChange: setMainChartStatus },
    { id: "secondary", title: "Chart 2", symbol: secondarySymbol, setSymbol: setSecondarySymbol, tf: secondaryTimeframe, setTf: setSecondaryTimeframe,
      fallback: secondaryStockData, chartStatus: secondaryChartStatus, onStatusChange: setSecondaryChartStatus },
    ...["third", "fourth"].map((id, index) => ({ id, title: `Chart ${index + 3}`, symbol: extra[id].symbol,
      setSymbol: symbol => updateExtra(id, { symbol }), tf: extra[id].interval, setTf: interval => updateExtra(id, { interval }),
      chartStatus: extraStatus[id] || "LOADING", onStatusChange: status => setExtraStatus(current => current[id] === status ? current : { ...current, [id]: status }) })),
  ].slice(0, count);
  const shellStyle = { minHeight: 0, minWidth: 0, overflow: "hidden", display: "grid", borderRadius: 6,
    border: `1px solid ${theme.borderSoft || theme.border}`, background: theme.panel };
  const focusedIndex = Math.min(activeTile, count - 1);
  return (
    <div style={{ height: "100%", minHeight: 0, width: "100%", display: "grid", gridTemplateRows: narrow ? "32px minmax(0, 1fr)" : "minmax(0, 1fr)", gap: 4 }}>
      {narrow && (
        <div role="group" aria-label="Focused chart" style={{ display: "flex", gap: 4 }}>
          {panels.map((panel, index) => <button type="button" key={panel.id} aria-pressed={focusedIndex === index} onClick={() => setActiveTile(index)}
            style={{ background: focusedIndex === index ? theme.blue : theme.panel, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 4, minWidth: 40 }}>Chart {index + 1}</button>)}
        </div>
      )}
      <div style={{ minHeight: 0, display: "grid", gap: compact ? 5 : 7, overflow: "hidden", background: theme.bg,
        gridTemplateColumns: count === 1 || narrow ? "minmax(0, 1fr)" : count === 3 ? "minmax(0, 1.35fr) minmax(0, 0.9fr)" : "repeat(2, minmax(0, 1fr))",
        gridTemplateRows: count >= 3 && !narrow ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)" }}>
        {panels.map((panel, index) => {
          const symbol = syncCharts ? selectedStock : panel.symbol;
          const quote = resolveChartQuote(symbol, allSymbols, syncCharts ? selectedStockData : panel.fallback);
          return (
            <div key={panel.id} data-chart-panel={panel.id} style={{ ...shellStyle,
              ...(count === 3 && index === 0 && !narrow ? { gridRow: "1 / 3" } : {}),
              ...(narrow && focusedIndex !== index ? { display: "none" } : {}) }}>
              {renderChartPanel({
                panelId: panel.id, title: panel.title, symbol, editableSymbol: true,
                setSymbol: syncCharts ? setMainSymbol : panel.setSymbol,
                tf: syncCharts ? timeframe : panel.tf, setTf: syncCharts ? setMainTimeframe : panel.setTf,
                livePrice: quote.price ?? null, quoteChange: quote.change ?? quote.changePercent ?? null,
                secondary: index !== 0, chartStatus: panel.chartStatus, onStatusChange: panel.onStatusChange,
                workstation, embedded: embeddedChart || count >= 3, hideToolbar: embeddedChart, dense: count === 2 && viewportWidth < 1800,
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
