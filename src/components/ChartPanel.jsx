import { Suspense, lazy, useMemo, useState } from "react";
import {
  Camera,
  Maximize2,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import ChartTickerInput from "./ChartTickerInput";
import LoadingPanel from "./LoadingPanel";
import {
  formatChartSourceStatus,
  formatQuoteSourceStatus,
} from "../utils/marketUtils";
import { CHART_INDICATOR_OPTIONS, normalizeIndicatorState } from "../indicators/chartIndicators";

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
  isDark = true,
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
  const [showTrendTools, setShowTrendTools] = useState(false);
  const [trendTools, setTrendTools] = useState({ autoLevels: false });
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
    width: isPhoneChart ? "36px" : "112px",
    background: theme.panel2,
    borderColor: theme.borderSoft || theme.border,
    fontSize: "10px",
    flex: "0 0 auto",
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
  const toggleTrendTool = (toolId) => {
    setTrendTools((current) => ({
      ...current,
      [toolId]: !current[toolId],
    }));
  };

  return (
    <div
      style={{
        ...panelStyle({
          padding: "0px",
          background: isDark ? "#050b14" : "#ffffff",
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
          <div style={{ minWidth: 0, flex: "1 1 260px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "88px 86px 74px", alignItems: "baseline", gap: "8px", minWidth: 0 }}>
              <span style={{ fontSize: "10px", color: theme.muted, fontWeight: 900, textTransform: "uppercase" }}>{title}</span>
              <span style={{ color: livePrice ? theme.text : theme.muted, fontSize: "11px", fontWeight: 900, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                {livePrice ? `$${Number(livePrice).toFixed(2)}` : "QUOTE"}
              </span>
              <span style={{ color: quoteChange ? quoteIsPositive ? theme.green : theme.red : theme.muted, fontSize: "10px", fontWeight: 900, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                {quoteChange || "PENDING"}
              </span>
            </div>
            <div style={{ marginTop: "4px", fontSize: secondary ? "18px" : "22px", fontWeight: 950, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {cleanChartSymbol}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "82px 82px", gap: "8px", marginTop: "4px" }}>
              <span
                style={{
                  color: statusColor,
                  fontWeight: 900,
                  fontSize: "9px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {chartSourceLabel}
              </span>
              <span
                style={{
                  color: quoteStatusColor,
                  fontWeight: 900,
                  fontSize: "9px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {quoteSourceLabel}
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "7px",
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: isPhoneChart ? "flex-start" : "flex-end",
              marginLeft: isPhoneChart ? 0 : "auto",
              minWidth: 0,
              width: isPhoneChart ? "100%" : "auto",
              flex: isPhoneChart ? "1 1 auto" : "0 0 auto",
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
                flexWrap: "nowrap",
                justifyContent: isPhoneChart ? "flex-start" : "center",
                padding: "3px",
                background: theme.panel,
                border: `1px solid ${theme.borderSoft || theme.border}`,
                borderRadius: "8px",
                flex: "0 0 auto",
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
            overflow: "visible",
            zIndex: 30,
          }}
        >
          <div style={{ position: "relative", flex: "0 0 auto" }}>
            <button
              style={{
                ...toolButtonStyle,
                background: showTrendTools || trendTools.autoLevels ? `linear-gradient(180deg, ${theme.blue}, #1765c6)` : toolButtonStyle.background,
                borderColor: showTrendTools || trendTools.autoLevels ? "rgba(45,140,255,0.7)" : toolButtonStyle.borderColor,
                color: showTrendTools || trendTools.autoLevels ? "#ffffff" : toolButtonStyle.color,
              }}
              onClick={() => setShowTrendTools((value) => !value)}
              title="Trend Tools"
              aria-expanded={showTrendTools}
            >
              <TrendingUp size={14} style={{ ...toolIconStyle, color: showTrendTools || trendTools.autoLevels ? "#ffffff" : toolIconStyle.color }} />
              {!isPhoneChart && "Trend Tools"}
            </button>

            {showTrendTools && (
              <div
                style={{
                  position: "absolute",
                  top: "34px",
                  left: 0,
                  background: theme.panel2,
                  border: `1px solid ${theme.border}`,
                  borderRadius: "7px",
                  padding: "9px",
                  zIndex: 200,
                  width: "190px",
                  display: "grid",
                  gap: "7px",
                  boxShadow: "0 18px 36px rgba(0,0,0,0.42)",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    minHeight: "26px",
                    color: theme.text,
                    fontSize: "11px",
                    fontWeight: 850,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(trendTools.autoLevels)}
                    onChange={() => toggleTrendTool("autoLevels")}
                  />
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "999px",
                      background: theme.blue,
                      boxShadow: `0 0 0 1px ${theme.borderSoft || theme.border}`,
                    }}
                  />
                  Auto Levels
                </label>
                <div
                  style={{
                    color: theme.muted,
                    fontSize: "10px",
                    lineHeight: 1.35,
                    paddingLeft: "24px",
                  }}
                >
                  Session high, session low, and previous close.
                </div>
              </div>
            )}
          </div>
          <div style={{ position: "relative", flex: "0 0 auto" }}>
            <button
              style={{
                ...toolButtonStyle,
                background: showIndicators ? `linear-gradient(180deg, ${theme.blue}, #1765c6)` : toolButtonStyle.background,
                borderColor: showIndicators ? "rgba(45,140,255,0.7)" : toolButtonStyle.borderColor,
                color: showIndicators ? "#ffffff" : toolButtonStyle.color,
              }}
              onClick={() => setShowIndicators((value) => !value)}
              title="Indicators"
              aria-expanded={showIndicators}
            >
              <SlidersHorizontal size={14} style={{ ...toolIconStyle, color: showIndicators ? "#ffffff" : toolIconStyle.color }} />
              {!isPhoneChart && "Indicators"}
            </button>

            {showIndicators && (
              <div
                style={{
                  position: "absolute",
                  top: "34px",
                  left: 0,
                  background: theme.panel2,
                  border: `1px solid ${theme.border}`,
                  borderRadius: "7px",
                  padding: "8px",
                  zIndex: 200,
                  width: "176px",
                  display: "grid",
                  gap: "6px",
                  boxShadow: "0 18px 36px rgba(0,0,0,0.42)",
                }}
              >
                {CHART_INDICATOR_OPTIONS.map((indicator) => (
                  <label
                    key={indicator.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      minHeight: "26px",
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
        </div>
      )}

      <div
        ref={!secondary ? chartAreaRef : null}
        style={{
          flex: 1,
          minHeight: 0,
          height: "100%",
          background: isDark ? "#050b14" : "#ffffff",
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
            trendTools={trendTools}
            isDark={isDark}
          />
        </Suspense>
      </div>
    </div>
  );
}
