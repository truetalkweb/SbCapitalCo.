export default function WorkspaceGrid({
  theme,
  gridMode,
  renderChartPanel,
  selectedStock,
  secondarySymbol,
  setSecondarySymbol,
  timeframe,
  secondaryTimeframe,
  setSecondaryTimeframe,
  selectedStockData,
  secondaryStockData,
  mainChartStatus,
  secondaryChartStatus,
  setMainChartStatus,
  setSecondaryChartStatus,
  syncCharts,
}) {
  const isFourChart = gridMode === "4";
  const thirdSymbol = syncCharts ? selectedStock : "SPY";
  const fourthSymbol = syncCharts ? selectedStock : "QQQ";

  const shellStyle = {
    height: "100%",
    minHeight: 0,
    overflow: "hidden",
    borderRadius: "8px",
    border: `1px solid ${theme.border}`,
    background: "#050b14",
  };

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        width: "100%",
        display: "grid",
        gridTemplateColumns: isFourChart ? "1fr 1fr" : "minmax(0, 1.45fr) minmax(320px, 0.75fr)",
        gridTemplateRows: isFourChart ? "1fr 1fr" : "1fr",
        gap: "6px",
        overflow: "hidden",
        background: theme.bg,
      }}
    >
      <div style={shellStyle}>
        {renderChartPanel({
          title: "Main Chart",
          symbol: selectedStock,
          setSymbol: () => {},
          tf: timeframe,
          setTf: () => {},
          livePrice: selectedStockData?.price,
          chartStatus: mainChartStatus,
          onStatusChange: setMainChartStatus,
        })}
      </div>

      <div style={shellStyle}>
        {renderChartPanel({
          title: "Secondary Chart",
          symbol: secondarySymbol,
          setSymbol: setSecondarySymbol,
          tf: secondaryTimeframe,
          setTf: setSecondaryTimeframe,
          livePrice: secondaryStockData?.price,
          secondary: true,
          chartStatus: secondaryChartStatus,
          onStatusChange: setSecondaryChartStatus,
        })}
      </div>

      {isFourChart && (
        <div style={shellStyle}>
          {renderChartPanel({
            title: "Market Index",
            symbol: thirdSymbol,
            setSymbol: () => {},
            tf: timeframe,
            setTf: () => {},
            livePrice: selectedStockData?.price,
            secondary: true,
            chartStatus: mainChartStatus,
            onStatusChange: () => {},
          })}
        </div>
      )}

      {isFourChart && (
        <div style={shellStyle}>
          {renderChartPanel({
            title: "Tech Index",
            symbol: fourthSymbol,
            setSymbol: () => {},
            tf: secondaryTimeframe,
            setTf: () => {},
            livePrice: secondaryStockData?.price,
            secondary: true,
            chartStatus: secondaryChartStatus,
            onStatusChange: () => {},
          })}
        </div>
      )}
    </div>
  );
}
