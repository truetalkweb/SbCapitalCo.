import { Suspense, lazy, useMemo } from "react";
import {
  Camera,
  Crosshair,
  Maximize2,
  PencilLine,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import ChartTickerInput from "./ChartTickerInput";
import LoadingPanel from "./LoadingPanel";
import {
  formatChartSourceStatus,
  formatQuoteSourceStatus,
} from "../utils/marketUtils";
import { CHART_INDICATORS, normalizeIndicatorState } from "../indicators/chartIndicators";

const Chart = lazy(() => import("./Chart"));

export default function ChartPanel({
  title,
  symbol,
  setSymbol,
  editableSymbol = false,
  tf,
  setTf,
  livePrice,
  quoteChange,
  secondary = false,
  chartStatus = "LOADING",
  onStatusChange,
  theme,
  allSymbols,
  viewportWidth,
  panelStyle,
  buttonStyle,
  timeframeButtonStyle,
  showIndicators,
  setShowIndicators,
  indicators,
  setIndicators,
  takeScreenshot,
  toggleFullscreen,
  chartAreaRef,
  initialLivePulse,
  replayMode,
  replayIndex,
  setMainReplayData,
  replayTrades,
  brokerApiUrl,
  advancedMode = false,
}) {
  const isPhoneChart = viewportWidth <= 700;
  const chartIndicators = useMemo(() => normalizeIndicatorState(indicators), [indicators]);
  const cleanChartSymbol = String(symbol || "").trim().toUpperCase();
  const commitChartSymbol = (nextSymbol) => {
    const clean = String(nextSymbol || "").trim().toUpperCase();

    if (!/^[A-Z0-9][A-Z0-9./:-]{0,13}$/.test(clean)) return;
    if (clean === cleanChartSymbol) return;

    setSymbol?.(clean);
  };
  const quoteIsPositive = !String(quoteChange || "").includes("-");
  const liveQuoteMeta = allSymbols.find((item) => item.symbol === cleanChartSymbol);
  const quoteSourceLabel = formatQuoteSourceStatus(liveQuoteMeta);
  const chartSourceLabel = formatChartSourceStatus(chartStatus);
  const quoteStatusColor =
    !liveQuoteMeta || quoteSourceLabel.includes("PENDING") || quoteSourceLabel.includes("STALE")
      ? theme.amber
      : liveQuoteMeta?.delayed || quoteSourceLabel.includes("DELAYED")
        ? theme.amber
        : theme.green;
  const statusColor =
    chartStatus === "LIVE" || chartStatus === "QTRD"
      ? theme.green
      : chartStatus === "LOADING"
        ? theme.blue
        : theme.amber;
  const toolButtonStyle = {
    ...buttonStyle(false),
    height: "28px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: isPhoneChart ? 0 : "6px",
    padding: isPhoneChart ? "0" : "0 9px",
    width: isPhoneChart ? "36px" : "auto",
    background: theme.panel2,
    borderColor: theme.borderSoft || theme.border,
    fontSize: "10px",
  };
  const toolIconStyle = { flexShrink: 0, color: theme.faint || theme.muted };
  const toggleIndicator = (indicatorId) => {
    setIndicators?.((current) => {
      const next = normalizeIndicatorState(current);
      return {
        ...next,
        [indicatorId]: !next[indicatorId],
      };
    });
  };

  return (
    <div
      style={{
        ...panelStyle({
          padding: "0px",
          background: "#050b14",
        }),
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: isPhoneChart ? "10px" : "10px 12px",
          marginBottom: "0px",
          background: `linear-gradient(180deg, ${theme.panel2}, ${theme.panel})`,
          borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: isPhoneChart ? "stretch" : "center",
            gap: "8px",
            flexDirection: isPhoneChart ? "column" : "row",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", minWidth: 0 }}>
              <span style={{ fontSize: "10px", color: theme.muted, fontWeight: 900, textTransform: "uppercase" }}>{title}</span>
              {livePrice && (
                <span style={{ color: theme.text, fontSize: "11px", fontWeight: 900 }}>
                  ${Number(livePrice).toFixed(2)}
                </span>
              )}
              {quoteChange && (
                <span style={{ color: quoteIsPositive ? theme.green : theme.red, fontSize: "10px", fontWeight: 900 }}>
                  {quoteChange}
                </span>
              )}
            </div>
            <div style={{ marginTop: "4px", fontSize: secondary ? "18px" : "22px", fontWeight: 950, lineHeight: 1 }}>
              {cleanChartSymbol}
            </div>
            <span
              style={{
                color: statusColor,
                fontWeight: 900,
                fontSize: "9px",
              }}
            >
              {chartSourceLabel}
            </span>
            <span
              style={{
                marginLeft: "8px",
                color: quoteStatusColor,
                fontWeight: 900,
                fontSize: "9px",
              }}
            >
              {quoteSourceLabel}
            </span>
          </div>

          <div
            style={{
              display: isPhoneChart ? "flex" : "grid",
              gridTemplateColumns: isPhoneChart ? undefined : "auto auto",
              gap: "8px",
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: isPhoneChart ? "flex-start" : "flex-end",
              marginLeft: isPhoneChart ? 0 : "auto",
              minWidth: 0,
              width: isPhoneChart ? "100%" : "auto",
            }}
          >
            {editableSymbol && typeof setSymbol === "function" && (
              <ChartTickerInput
                value={cleanChartSymbol}
                onCommit={commitChartSymbol}
                theme={theme}
                label={title}
              />
            )}

            <div
              style={{
                display: "flex",
                gap: "3px",
                flexWrap: "wrap",
                justifyContent: isPhoneChart ? "flex-start" : "center",
                padding: "3px",
                background: theme.panel,
                border: `1px solid ${theme.borderSoft || theme.border}`,
                borderRadius: "8px",
              }}
            >
              {["1m", "5m", "15m", "1H", "1D"].map((item) => (
                <button
                  key={item}
                  onClick={() => setTf(item)}
                  style={{
                    ...timeframeButtonStyle(tf === item),
                    height: "24px",
                    width: "38px",
                    borderColor: tf === item ? "rgba(45,140,255,0.7)" : "transparent",
                    background: tf === item ? `linear-gradient(180deg, ${theme.blue}, #1765c6)` : "transparent",
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!secondary && (
        <div
          style={{
            display: "flex",
            gap: "4px",
            marginBottom: "0px",
            padding: "7px 10px",
            flexWrap: "wrap",
            position: "relative",
            background: theme.panel,
            borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
          }}
        >
          {advancedMode && (
          <button style={toolButtonStyle} title="Crosshair">
            <Crosshair size={14} style={toolIconStyle} />
            {!isPhoneChart && "Crosshair"}
          </button>
          )}
          <button
            style={toolButtonStyle}
            onClick={() => setShowIndicators(!showIndicators)}
            title="Indicators"
          >
            <SlidersHorizontal size={14} style={toolIconStyle} />
            {!isPhoneChart && "Indicators"}
          </button>
          {advancedMode && (
          <button style={toolButtonStyle} title="Draw">
            <PencilLine size={14} style={toolIconStyle} />
            {!isPhoneChart && "Draw"}
          </button>
          )}
          {advancedMode && (
          <button style={toolButtonStyle} onClick={takeScreenshot} title="Screenshot">
            <Camera size={14} style={toolIconStyle} />
            {!isPhoneChart && "Screenshot"}
          </button>
          )}
          <button style={toolButtonStyle} onClick={toggleFullscreen} title="Fullscreen">
            <Maximize2 size={14} style={toolIconStyle} />
            {!isPhoneChart && "Fullscreen"}
          </button>
          {advancedMode && (
          <button style={toolButtonStyle} title="Settings">
            <Settings size={14} style={toolIconStyle} />
            {!isPhoneChart && "Settings"}
          </button>
          )}

          {showIndicators && (
            <div
              style={{
                position: "absolute",
                top: "42px",
                left: "78px",
                background: theme.panel2,
                border: `1px solid ${theme.border}`,
                borderRadius: "6px",
                padding: "8px",
                zIndex: 20,
                width: "170px",
                display: "grid",
                gap: "6px",
                boxShadow: "0 18px 36px rgba(0,0,0,0.36)",
              }}
            >
              {CHART_INDICATORS.map((indicator) => (
                <label
                  key={indicator.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    minHeight: "24px",
                    color: theme.text,
                    fontSize: "11px",
                    fontWeight: 850,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(chartIndicators[indicator.id])}
                    onChange={() => toggleIndicator(indicator.id)}
                  />
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "999px",
                      background: indicator.color,
                      boxShadow: `0 0 0 1px ${theme.borderSoft || theme.border}`,
                    }}
                  />
                  {indicator.label}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        ref={!secondary ? chartAreaRef : null}
        style={{
          flex: 1,
          minHeight: 0,
          height: "100%",
          background: "#050b14",
        }}
      >
        <Suspense fallback={<LoadingPanel theme={theme} label="Loading chart" />}>
          <Chart
            symbol={cleanChartSymbol}
            timeframe={tf}
            livePrice={Number(livePrice || 100)}
            livePulse={
              allSymbols.find((item) => item.symbol === cleanChartSymbol)?.lastUpdated ||
              initialLivePulse
            }
            indicators={chartIndicators}
            onStatusChange={onStatusChange}
            replayMode={replayMode && !secondary}
            replayIndex={replayIndex}
            onReplayData={setMainReplayData}
            replayTrades={replayTrades}
            brokerApiUrl={brokerApiUrl}
          />
        </Suspense>
      </div>
    </div>
  );
}
