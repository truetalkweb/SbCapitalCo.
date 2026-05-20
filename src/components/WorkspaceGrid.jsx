export default function WorkspaceGrid({
  theme,
  layoutMode,
  gridMode,
  renderChartPanel,
  selectedStock,
  secondarySymbol,
  setSecondarySymbol,
  timeframe,
  setMainTimeframe,
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
  const isOneChart = layoutMode === "1";
  const isFourChart = !isOneChart && gridMode === "4";
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

  const gridStyle = isOneChart
    ? {
        gridTemplateColumns: "1fr",
        gridTemplateRows: "1fr",
      }
    : isFourChart
    ? {
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
      }
    : {
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr",
      };

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        width: "100%",
        display: "grid",
        ...gridStyle,
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
          setTf: setMainTimeframe,
          livePrice: selectedStockData?.price,
          chartStatus: mainChartStatus,
          onStatusChange: setMainChartStatus,
        })}
      </div>

      {!isOneChart && (
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
      )}

      {isFourChart && (
        <div style={shellStyle}>
          {renderChartPanel({
            title: "Market Index",
            symbol: thirdSymbol,
            setSymbol: () => {},
            tf: timeframe,
            setTf: setMainTimeframe,
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
            setTf: setSecondaryTimeframe,
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
