import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
  createSeriesMarkers,
} from "lightweight-charts";
import { CHART_INDICATORS, VOLUME_INDICATOR } from "../indicators/chartIndicators";
import { marketDataService } from "../services/marketDataService";
import { normalizeCandleDataset, normalizeMarketQuote } from "../utils/marketDataContract.js";
import { visibleReplayCandles } from "../utils/replayLedger.js";

const DEFAULT_BROKER_API_URL = (import.meta.env.VITE_BROKER_API_URL || "http://localhost:4000").replace(/\/+$/, "");

function formatVolume(volume) {
  if (volume === null || volume === undefined || !Number.isFinite(Number(volume))) return "Unavailable";
  const value = Number(volume);
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

function getCandleDateKey(candle) {
  const timestamp = Number(candle?.time || 0);
  if (!timestamp) return "";
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function calculateAutoLevels(candles) {
  const source = Array.isArray(candles) ? candles.filter(Boolean) : [];
  if (!source.length) return [];

  const latestDateKey = getCandleDateKey(source[source.length - 1]);
  const firstSessionIndex = source.findIndex((candle) => getCandleDateKey(candle) === latestDateKey);
  const sessionCandles = firstSessionIndex >= 0 ? source.slice(firstSessionIndex) : source.slice(-80);
  const high = Math.max(...sessionCandles.map((candle) => Number(candle.high)).filter(Number.isFinite));
  const low = Math.min(...sessionCandles.map((candle) => Number(candle.low)).filter(Number.isFinite));
  const previousClose =
    firstSessionIndex > 0 && Number.isFinite(Number(source[firstSessionIndex - 1]?.close))
      ? Number(source[firstSessionIndex - 1].close)
      : null;
  const levels = [];

  if (Number.isFinite(high)) {
    levels.push({ title: "Day High", price: high, color: "#00c896" });
  }

  if (Number.isFinite(low)) {
    levels.push({ title: "Day Low", price: low, color: "#ef5350" });
  }

  if (previousClose && Number.isFinite(previousClose)) {
    levels.push({ title: "Prev Close", price: previousClose, color: "#8a94a6" });
  }

  return levels;
}

function Chart({
  symbol,
  timeframe,
  indicators = {},
  onStatusChange,
  replayMode = false,
  replayIndex = null,
  onReplayData,
  replayTrades = [],
  brokerApiUrl = DEFAULT_BROKER_API_URL,
  trendTools = {},
  isDark = true,
  workstation = false,
}) {
  const chartSymbol = String(symbol || "").trim().toUpperCase() || "SPY";
  const chartTheme = isDark
    ? {
        background: workstation ? "#060c10" : "#050b14",
        text: "#d1d4dc",
        muted: "#8a94a6",
        faint: "#5f6b7a",
        grid: workstation ? "rgba(23,36,43,0.38)" : "rgba(31,41,55,0.55)",
        border: "#1f2937",
        overlay: "rgba(5,11,20,0.76)",
        overlayStrong: "rgba(5,11,20,0.92)",
        overlayBorder: "rgba(35,48,68,0.85)",
        tooltipTitle: "#ffffff",
        loadingAccent: "#8fb7ff",
      }
    : {
        background: "#ffffff",
        text: "#1d2733",
        muted: "#667085",
        faint: "#98a2b3",
        grid: "rgba(148,163,184,0.28)",
        border: "#d7dde8",
        overlay: "rgba(255,255,255,0.88)",
        overlayStrong: "rgba(255,255,255,0.96)",
        overlayBorder: "rgba(203,213,225,0.95)",
        tooltipTitle: "#111827",
        loadingAccent: "#1765c6",
      };
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const indicatorSeriesRef = useRef({});
  const markersRef = useRef(null);
  const trendLineRefs = useRef([]);
  const candlesRef = useRef([]);
  const lastCandleRef = useRef(null);
  const statusRef = useRef("LOADING");
  const lastAppliedTimeRef = useRef(0);
  const onReplayDataRef = useRef(onReplayData);
  const onStatusChangeRef = useRef(onStatusChange);
  const pendingStreamTickRef = useRef(null);
  const streamFrameRef = useRef(null);
  const lastStreamTickAtRef = useRef(null);
  const resizeFrameRef = useRef(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [hadChartHistoryBeforeLoad, setHadChartHistoryBeforeLoad] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRevision, setHistoryRevision] = useState(0);
  const replayViewRef = useRef({ replayMode, replayIndex });
  const liveQuoteLineRef = useRef(null);

  useLayoutEffect(() => {
    replayViewRef.current = { replayMode, replayIndex };
  }, [replayMode, replayIndex]);

  const setStatus = useCallback((nextStatus) => {
    if (statusRef.current === nextStatus) return;

    statusRef.current = nextStatus;
    if (typeof onStatusChangeRef.current === "function") {
      onStatusChangeRef.current(nextStatus);
    }
  }, []);

  useEffect(() => {
    onReplayDataRef.current = onReplayData;
  }, [onReplayData]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const getVisibleCandles = useCallback(() => {
    if (!replayMode) return candlesRef.current;

    return visibleReplayCandles(candlesRef.current, replayIndex);
  }, [replayIndex, replayMode]);

  const updateIndicators = useCallback((source = getVisibleCandles()) => {
    CHART_INDICATORS.forEach((indicator) => {
      const series = indicatorSeriesRef.current[indicator.id];
      if (!series) return;

      series.setData(indicators[indicator.id] ? indicator.calculate(source) : []);
    });
    if (containerRef.current) {
      const times = Object.values(indicatorSeriesRef.current).flatMap(series => series.data().map(row => row.time));
      containerRef.current.dataset.indicatorEnd = times.length ? String(Math.max(...times)) : "";
    }
  }, [getVisibleCandles, indicators]);

  const updateVolume = useCallback((source = getVisibleCandles()) => {
    if (!volumeSeriesRef.current) return;
    if (!indicators[VOLUME_INDICATOR.id]) {
      volumeSeriesRef.current.setData([]);
      return;
    }

    volumeSeriesRef.current.setData(
      source.filter((candle) => candle.volume !== null && candle.volume !== undefined).map((candle) => ({
        time: candle.time,
        value: candle.volume,
        color:
          candle.close >= candle.open
            ? "rgba(0,200,150,0.35)"
            : "rgba(239,83,80,0.35)",
      }))
    );
  }, [getVisibleCandles, indicators]);

  const updateMarkers = useCallback(() => {
    if (!candleSeriesRef.current) return;

    const markers = replayTrades
      .filter((trade) => trade.symbol === chartSymbol && trade.time <= (candleSeriesRef.current.data().at(-1)?.time ?? -Infinity))
      .map((trade) => ({
        time: trade.time,
        position: trade.type === "BUY" ? "belowBar" : "aboveBar",
        color: trade.type === "BUY" ? "#00c896" : "#ef5350",
        shape: trade.type === "BUY" ? "arrowUp" : "arrowDown",
        text:
          trade.type === "BUY"
            ? `BUY ${trade.qty}`
            : `SELL ${trade.qty}${trade.pnl ? ` $${Number(trade.pnl).toFixed(2)}` : ""}`,
      }));

    markersRef.current?.setMarkers(markers);
    containerRef.current.dataset.markerEnd = markers.length ? String(Math.max(...markers.map(marker => marker.time))) : "";
    containerRef.current.dataset.markerCount = String(markers.length);
  }, [replayTrades, chartSymbol]);

  const clearTrendLines = useCallback(() => {
    if (!candleSeriesRef.current || !trendLineRefs.current.length) {
      trendLineRefs.current = [];
      return;
    }

    trendLineRefs.current.forEach((line) => {
      try {
        candleSeriesRef.current.removePriceLine(line);
      } catch {
        // Price lines may already be gone after a rapid chart remount.
      }
    });
    trendLineRefs.current = [];
  }, []);

  const updateTrendTools = useCallback((source = getVisibleCandles()) => {
    clearTrendLines();

    if (!trendTools?.autoLevels || !candleSeriesRef.current) return;

    const levels = calculateAutoLevels(source);
    trendLineRefs.current = levels.map((level) =>
      candleSeriesRef.current.createPriceLine({
        price: level.price,
        color: level.color,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: level.title,
      })
    );
  }, [clearTrendLines, getVisibleCandles, trendTools?.autoLevels]);

  const updateVolumeRef = useRef(updateVolume);
  const updateIndicatorsRef = useRef(updateIndicators);
  const updateMarkersRef = useRef(updateMarkers);
  const updateTrendToolsRef = useRef(updateTrendTools);

  const applyHistoryDataset = useCallback((dataset, nextStatus, options = {}) => {
    const normalizedRows = dataset.candles;

    if (!normalizedRows.length || !candleSeriesRef.current) return false;

    candlesRef.current = normalizedRows;
    lastCandleRef.current = normalizedRows[normalizedRows.length - 1];

    const view = replayViewRef.current;
    const visible = view.replayMode ? visibleReplayCandles(normalizedRows, view.replayIndex) : normalizedRows;
    markersRef.current?.setMarkers([]);
    candleSeriesRef.current.setData(visible);
    containerRef.current.dataset.visibleCandleCount = String(candleSeriesRef.current.data().length);
    containerRef.current.dataset.visibleEnd = String(candleSeriesRef.current.data().at(-1)?.time ?? "");
    updateVolumeRef.current(visible);
    if (typeof onReplayDataRef.current === "function") onReplayDataRef.current(dataset);
    updateIndicatorsRef.current(visible);
    updateMarkersRef.current();
    updateTrendToolsRef.current(visible);

    if (chartRef.current && options.fitContent !== false) {
      chartRef.current.timeScale().fitContent();
    }

    if (nextStatus) setStatus(nextStatus);
    return true;
  }, [setStatus]);

  useLayoutEffect(() => {
    updateVolumeRef.current = updateVolume;
  }, [updateVolume]);

  useLayoutEffect(() => {
    updateIndicatorsRef.current = updateIndicators;
  }, [updateIndicators]);

  useLayoutEffect(() => {
    updateMarkersRef.current = updateMarkers;
  }, [updateMarkers]);

  useLayoutEffect(() => {
    updateTrendToolsRef.current = updateTrendTools;
  }, [updateTrendTools]);

  const applyLivePrice = useCallback((priceValue, timestamp, options = {}) => {
    if (replayViewRef.current.replayMode || !candleSeriesRef.current || !lastCandleRef.current) return;
    if (!Number.isFinite(priceValue) || priceValue <= 0 || !Number.isFinite(timestamp)) return;
    if (timestamp <= lastAppliedTimeRef.current) return;
    lastAppliedTimeRef.current = timestamp;
    // Quote snapshots are not trades: show a separate price line, never invent OHLC or volume.
    const settings = { price: priceValue, color: "#2196f3", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "Quote" };
    if (liveQuoteLineRef.current) liveQuoteLineRef.current.applyOptions(settings);
    else liveQuoteLineRef.current = candleSeriesRef.current.createPriceLine(settings);
    containerRef.current.dataset.quotePrice = String(priceValue);
    setStatus(options.status || "LIVE");
  }, [setStatus]);

  const queueStreamTick = useCallback((trade) => {
    if (replayMode) return;
    const quote = normalizeMarketQuote({ ...trade, symbol: trade.s || trade.symbol, price: trade.p ?? trade.price }, { symbol: chartSymbol });
    if (quote.asOf !== null && quote.asOf <= Math.max(lastAppliedTimeRef.current, pendingStreamTickRef.current?.timestamp || 0)) return;
    if (quote.quality !== "live") {
      pendingStreamTickRef.current = null;
      if (liveQuoteLineRef.current && candleSeriesRef.current) candleSeriesRef.current.removePriceLine(liveQuoteLineRef.current);
      liveQuoteLineRef.current = null;
      if (containerRef.current) delete containerRef.current.dataset.quotePrice;
      setStatus(quote.quality.toUpperCase());
      return;
    }

    pendingStreamTickRef.current = {
      price: quote.price,
      timestamp: quote.asOf,
      options: {
        status: "LIVE QUOTE",
      },
    };
    lastStreamTickAtRef.current = Date.now();

    if (streamFrameRef.current) return;

    streamFrameRef.current = requestAnimationFrame(() => {
      streamFrameRef.current = null;
      const tick = pendingStreamTickRef.current;
      pendingStreamTickRef.current = null;

      if (!tick) return;

      applyLivePrice(tick.price, tick.timestamp, tick.options);
    });
  }, [applyLivePrice, replayMode, chartSymbol, setStatus]);

  useEffect(() => {
    if (!containerRef.current) return;

    const hadHistory = false;
    containerRef.current.dataset.visibleCandleCount = "0";
    containerRef.current.dataset.visibleEnd = "";
    containerRef.current.dataset.indicatorEnd = "";
    containerRef.current.dataset.markerEnd = "";
    containerRef.current.dataset.markerCount = "0";
    delete containerRef.current.dataset.quotePrice;
    candlesRef.current = [];
    lastCandleRef.current = null;
    lastAppliedTimeRef.current = 0;
    liveQuoteLineRef.current = null;
    if (tooltipRef.current) tooltipRef.current.style.display = "none";
    setHistoryError("");
    onReplayDataRef.current?.({ symbol: chartSymbol, interval: timeframe, quality: "unavailable", candles: [], reason: "Loading historical data" });
    setHadChartHistoryBeforeLoad(hadHistory);
    setIsHistoryLoading(true);
    setStatus(hadHistory ? "UPDATING" : "LOADING");
    let disposed = false;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      autoSize: false,
      layout: {
        background: { color: chartTheme.background },
        textColor: chartTheme.text,
        fontSize: 12,
      },
      grid: {
        vertLines: { color: chartTheme.grid },
        horzLines: { color: chartTheme.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(33,150,243,0.55)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#2196f3",
        },
        horzLine: {
          color: "rgba(33,150,243,0.55)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#2196f3",
        },
      },
      localization: {
        priceFormatter: (price) => `$${Number(price).toFixed(2)}`,
      },
      rightPriceScale: {
        borderColor: chartTheme.border,
        textColor: chartTheme.text,
        scaleMargins: {
          top: 0.08,
          bottom: 0.22,
        },
      },
      timeScale: {
        borderColor: chartTheme.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 10,
        barSpacing: 7,
        minBarSpacing: 2,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00c896",
      downColor: "#ef5350",
      borderUpColor: "#00c896",
      borderDownColor: "#ef5350",
      wickUpColor: "#00c896",
      wickDownColor: "#ef5350",
      priceLineColor: "#2196f3",
      priceLineWidth: 1,
      lastValueVisible: true,
      priceLineVisible: true,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
      lastValueVisible: false,
      priceLineVisible: false,
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.78,
        bottom: 0,
      },
    });

    const indicatorSeries = CHART_INDICATORS.reduce((seriesById, indicator) => {
      seriesById[indicator.id] = chart.addSeries(LineSeries, {
        color: indicator.color,
        lineWidth: indicator.lineWidth,
        priceLineVisible: false,
        lastValueVisible: false,
        title: indicator.label,
      });
      return seriesById;
    }, {});


    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    markersRef.current = createSeriesMarkers(candleSeries, []);
    volumeSeriesRef.current = volumeSeries;
    indicatorSeriesRef.current = indicatorSeries;

    chart.subscribeCrosshairMove((param) => {
      if (disposed) return;
      if (!tooltipRef.current || !containerRef.current) return;

      if (!param.time || !param.point) {
        tooltipRef.current.style.display = "none";
        return;
      }

      const candle = candleSeriesRef.current?.data().find((item) => item.time === param.time);
      if (!candle) {
        tooltipRef.current.style.display = "none";
        return;
      }

      // The chart library returns OHLC only; look up volume after validating the visible timestamp.
      const volume = candlesRef.current.find(item => item.time === candle.time)?.volume ?? null;

      tooltipRef.current.style.display = "block";
      tooltipRef.current.style.left = `${Math.min(param.point.x + 14, containerRef.current.clientWidth - 170)}px`;
      tooltipRef.current.style.top = `${Math.max(param.point.y - 84, 8)}px`;
      tooltipRef.current.innerHTML = `
        <div style="font-weight:900;color:${chartTheme.tooltipTitle};margin-bottom:4px">${escapeHtml(chartSymbol)} - ${escapeHtml(timeframe)}</div>
        <div>O: <b>${candle.open.toFixed(2)}</b></div>
        <div>H: <b style="color:#00c896">${candle.high.toFixed(2)}</b></div>
        <div>L: <b style="color:#ef5350">${candle.low.toFixed(2)}</b></div>
        <div>C: <b>${candle.close.toFixed(2)}</b></div>
        <div>Vol: <b>${formatVolume(volume)}</b></div>
      `;
    });

    async function loadCandles() {
      try {
        const cleanBrokerApiUrl = String(brokerApiUrl || "").replace(/\/+$/, "");
        if (!cleanBrokerApiUrl) throw new Error("Chart provider is not configured");
          const backendData = await fetchJsonWithTimeout(
            `${cleanBrokerApiUrl}/api/questrade/candles/${encodeURIComponent(chartSymbol)}?timeframe=${encodeURIComponent(timeframe)}`,
            3500
          );
        const dataset = normalizeCandleDataset(backendData, { symbol: chartSymbol, interval: timeframe });
        if (disposed) return;
        if (!dataset.candles.length) {
          setStatus("UNAVAILABLE");
          setHistoryError(dataset.reason);
          onReplayDataRef.current?.(dataset);
          setIsHistoryLoading(false);
          return;
        }
        applyHistoryDataset(dataset, dataset.quality.toUpperCase(), { fitContent: true });
        setIsHistoryLoading(false);
      } catch (error) {
        if (disposed) return;
        setStatus("UNAVAILABLE");
        setHistoryError(error.message || "Historical data is unavailable");
        onReplayDataRef.current?.({ symbol: chartSymbol, interval: timeframe, quality: "unavailable", candles: [], reason: error.message });
        setIsHistoryLoading(false);
      }
    }

    loadCandles();

    let priorWidth = containerRef.current.clientWidth;
    const resizeObserver = new ResizeObserver(() => {
      if (disposed) return;
      if (!containerRef.current || !chartRef.current) return;
      if (resizeFrameRef.current) cancelAnimationFrame(resizeFrameRef.current);

      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        if (disposed || !containerRef.current || !chartRef.current) return;

        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
        if (priorWidth === 0 && containerRef.current.clientWidth > 0) chartRef.current.timeScale().fitContent();
        priorWidth = containerRef.current.clientWidth;
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      if (streamFrameRef.current) {
        cancelAnimationFrame(streamFrameRef.current);
        streamFrameRef.current = null;
      }
      if (resizeFrameRef.current) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      chartRef.current = null;
      candleSeriesRef.current = null;
      markersRef.current = null;
      volumeSeriesRef.current = null;
      indicatorSeriesRef.current = {};
      trendLineRefs.current = [];
      requestAnimationFrame(() => {
        try {
          chart.remove();
        } catch {
          // Lightweight Charts can already be disposed during rapid layout switches.
        }
      });
    };
  }, [applyHistoryDataset, brokerApiUrl, chartSymbol, chartTheme.background, chartTheme.border, chartTheme.grid, chartTheme.text, chartTheme.tooltipTitle, setStatus, timeframe, historyRevision]);

  useEffect(() => {
    updateIndicators();
  }, [updateIndicators]);

  useEffect(() => {
    updateVolume();
  }, [updateVolume]);

  useEffect(() => {
    updateTrendTools();
  }, [updateTrendTools]);

  useEffect(() => {
    if (!chartSymbol || replayMode) return undefined;

    const unsubscribe = marketDataService.subscribe(chartSymbol, queueStreamTick);
    const staleTimer = window.setInterval(() => {
      if (!lastStreamTickAtRef.current) return;

      const isStale = Date.now() - lastStreamTickAtRef.current > 15000;
      if (isStale && statusRef.current === "LIVE QUOTE") {
        setStatus("STALE");
      }
    }, 5000);

    return () => {
      unsubscribe();
      window.clearInterval(staleTimer);

      if (streamFrameRef.current) {
        cancelAnimationFrame(streamFrameRef.current);
        streamFrameRef.current = null;
      }
    };
  }, [chartSymbol, queueStreamTick, replayMode, setStatus]);

  useLayoutEffect(() => {
    if (!candleSeriesRef.current || !candlesRef.current.length) return;

    if (replayMode && liveQuoteLineRef.current) {
      candleSeriesRef.current.removePriceLine(liveQuoteLineRef.current);
      liveQuoteLineRef.current = null;
      delete containerRef.current.dataset.quotePrice;
    }
    if (tooltipRef.current) tooltipRef.current.style.display = "none";

    const source = replayMode ? getVisibleCandles() : candlesRef.current;

    // Markers must be removed before their referenced bars leave the series.
    markersRef.current?.setMarkers([]);
    candleSeriesRef.current.setData(source);
    containerRef.current.dataset.visibleCandleCount = String(candleSeriesRef.current.data().length);
    containerRef.current.dataset.visibleEnd = String(candleSeriesRef.current.data().at(-1)?.time ?? "");
    updateVolumeRef.current(source);
    updateIndicatorsRef.current(source);
    updateMarkersRef.current();
    updateTrendToolsRef.current(source);
  }, [getVisibleCandles, replayIndex, replayMode, replayTrades]);

  return (
    <div
      ref={containerRef}
      data-chart-canvas={chartSymbol}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 0,
        background: chartTheme.background,
        overflow: "hidden",
        cursor: "crosshair",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "12px",
          zIndex: 5,
          padding: "6px 8px",
          borderRadius: "6px",
          background: workstation ? "transparent" : chartTheme.overlay,
          border: workstation ? "0" : `1px solid ${chartTheme.overlayBorder}`,
          color: chartTheme.text,
          fontSize: "11px",
          lineHeight: "1.35",
          backdropFilter: workstation ? "none" : "blur(8px)",
          pointerEvents: "none",
        }}
      >
        <div style={{ fontWeight: 900, color: chartTheme.tooltipTitle }}>
          {chartSymbol} - {timeframe}
        </div>
        <div>
          {CHART_INDICATORS.map((indicator, index) => (
            <React.Fragment key={indicator.id}>
              {index > 0 && " / "}
              <span style={{ color: indicators[indicator.id] ? indicator.color : chartTheme.faint }}>
                {indicator.shortLabel}
              </span>
            </React.Fragment>
          ))}
          {indicators[VOLUME_INDICATOR.id] && (
            <>
              {" / "}
              <span style={{ color: VOLUME_INDICATOR.color }}>{VOLUME_INDICATOR.shortLabel}</span>
            </>
          )}
          {trendTools?.autoLevels && (
            <>
              {" / "}
              <span style={{ color: "#8fb7ff" }}>Levels</span>
            </>
          )}
        </div>
      </div>

      {isHistoryLoading && (
        <div
          style={{
            position: "absolute",
            top: "52px",
            right: "12px",
            zIndex: 7,
            padding: "6px 8px",
            borderRadius: "6px",
            background: chartTheme.overlay,
            border: `1px solid ${chartTheme.overlayBorder}`,
            color: chartTheme.loadingAccent,
            fontSize: "10px",
            fontWeight: 850,
            pointerEvents: "none",
            backdropFilter: "blur(8px)",
          }}
        >
          <span style={{ color: chartTheme.text }}>{hadChartHistoryBeforeLoad ? "Updating" : "Loading"}</span>{" "}
          {chartSymbol}
          <span style={{ display: "block", marginTop: "2px", color: chartTheme.muted, fontWeight: 700 }}>
            {hadChartHistoryBeforeLoad ? "Keeping chart context active" : "Building chart history"}
          </span>
        </div>
      )}

      {historyError && !isHistoryLoading && (
        <div role="status" style={{ position: "absolute", inset: "40% 12px auto", zIndex: 7, textAlign: "center", color: chartTheme.text }}>
          <div>{historyError}</div>
          <button type="button" onClick={() => setHistoryRevision(value => value + 1)} style={{ marginTop: 12, padding: "8px 16px", color: chartTheme.text, background: chartTheme.background, border: `1px solid ${chartTheme.border}`, borderRadius: 4 }}>Retry chart data</button>
        </div>
      )}

      <div
        ref={tooltipRef}
        data-chart-tooltip={chartSymbol}
        style={{
          position: "absolute",
          zIndex: 6,
          display: "none",
          minWidth: "145px",
          padding: "8px",
          borderRadius: "8px",
          background: chartTheme.overlayStrong,
          border: `1px solid ${chartTheme.overlayBorder}`,
          color: chartTheme.text,
          fontSize: "11px",
          lineHeight: "1.45",
          pointerEvents: "none",
          boxShadow: "0 12px 24px rgba(0,0,0,0.35)",
        }}
      />
    </div>
  );
}

export default React.memo(Chart);
