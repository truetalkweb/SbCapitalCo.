import { useState } from "react";

export default function WorkspaceGrid({
  theme,
  layoutMode,
  gridMode,
  renderChartPanel,
  selectedStock,
  setMainSymbol,
  secondarySymbol,
  setSecondarySymbol,
  timeframe,
  setMainTimeframe,
  secondaryTimeframe,
  setSecondaryTimeframe,
  selectedStockData,
  secondaryStockData,
  allSymbols = [],
  mainChartStatus,
  secondaryChartStatus,
  setMainChartStatus,
  setSecondaryChartStatus,
  syncCharts,
  compact = false,
  embeddedChart = false,
}) {
  const isOneChart = compact || layoutMode === "1";
  const isFourChart = !isOneChart && gridMode === "4";
  const [thirdChartSymbol, setThirdChartSymbol] = useState("SPY");
  const [fourthChartSymbol, setFourthChartSymbol] = useState("QQQ");
  const [thirdChartStatus, setThirdChartStatus] = useState("LOADING");
  const [fourthChartStatus, setFourthChartStatus] = useState("LOADING");
  const thirdSymbol = syncCharts ? selectedStock : thirdChartSymbol;
  const fourthSymbol = syncCharts ? selectedStock : fourthChartSymbol;

  function findChartData(symbol, fallback = null) {
    const cleanSymbol = String(symbol || "").toUpperCase();

    return (
      allSymbols.find((stock) => String(stock?.symbol || "").toUpperCase() === cleanSymbol) ||
      fallback ||
      { symbol: cleanSymbol, price: null, change: null }
    );
  }

  const thirdStockData = findChartData(thirdSymbol, syncCharts ? selectedStockData : null);
  const fourthStockData = findChartData(fourthSymbol, syncCharts ? selectedStockData : secondaryStockData);

  const shellStyle = {
    height: "100%",
    minHeight: 0,
    overflow: "hidden",
    borderRadius: "8px",
    border: `1px solid ${theme.borderSoft || theme.border}`,
    background: "#050b14",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
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
        gap: compact ? "5px" : "7px",
        overflow: "hidden",
        background: theme.bg,
      }}
    >
      <div style={shellStyle}>
        {renderChartPanel({
          title: "Main Chart",
          symbol: selectedStock,
          setSymbol: setMainSymbol,
          editableSymbol: true,
          tf: timeframe,
          setTf: setMainTimeframe,
          livePrice: selectedStockData?.price,
          quoteChange: selectedStockData?.change,
          chartStatus: mainChartStatus,
          onStatusChange: setMainChartStatus,
          embedded: embeddedChart,
        })}
      </div>

      {!isOneChart && (
        <div style={shellStyle}>
          {renderChartPanel({
            title: "Secondary Chart",
            symbol: secondarySymbol,
            setSymbol: setSecondarySymbol,
            editableSymbol: true,
            tf: secondaryTimeframe,
            setTf: setSecondaryTimeframe,
            livePrice: secondaryStockData?.price,
            quoteChange: secondaryStockData?.change,
            secondary: true,
            chartStatus: secondaryChartStatus,
            onStatusChange: setSecondaryChartStatus,
            embedded: embeddedChart,
          })}
        </div>
      )}

      {isFourChart && (
        <div style={shellStyle}>
          {renderChartPanel({
          title: "Market Index",
          symbol: thirdSymbol,
          setSymbol: setThirdChartSymbol,
          editableSymbol: !syncCharts,
          tf: timeframe,
          setTf: setMainTimeframe,
          livePrice: thirdStockData?.price,
          quoteChange: thirdStockData?.change,
          secondary: true,
          chartStatus: syncCharts ? mainChartStatus : thirdChartStatus,
          onStatusChange: syncCharts ? () => {} : setThirdChartStatus,
          embedded: embeddedChart,
        })}
      </div>
      )}

      {isFourChart && (
        <div style={shellStyle}>
          {renderChartPanel({
          title: "Tech Index",
          symbol: fourthSymbol,
            setSymbol: setFourthChartSymbol,
            editableSymbol: !syncCharts,
            tf: secondaryTimeframe,
            setTf: setSecondaryTimeframe,
            livePrice: fourthStockData?.price,
            quoteChange: fourthStockData?.change,
            secondary: true,
            chartStatus: syncCharts ? secondaryChartStatus : fourthChartStatus,
            onStatusChange: syncCharts ? () => {} : setFourthChartStatus,
            embedded: embeddedChart,
          })}
        </div>
      )}
    </div>
  );
}
