import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
} from "lightweight-charts";
import { CHART_INDICATORS, VOLUME_INDICATOR } from "../indicators/chartIndicators";
import { marketDataService } from "../services/marketDataService";

const DEFAULT_BROKER_API_URL = (import.meta.env.VITE_BROKER_API_URL || "http://localhost:4000").replace(/\/+$/, "");

function getTimeframeSeconds(timeframe) {
  if (timeframe === "1m") return 60;
  if (timeframe === "5m") return 60 * 5;
  if (timeframe === "15m") return 60 * 15;
  if (timeframe === "1H") return 60 * 60;
  if (timeframe === "1D") return 60 * 60 * 24;
  return 60 * 15;
}

function bucketTime(timestamp, timeframe) {
  const seconds = getTimeframeSeconds(timeframe);
  return Math.floor(timestamp / seconds) * seconds;
}

function formatVolume(volume) {
  const value = Number(volume || 0);
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

function generateFallbackCandles(livePrice, timeframe) {
  const seconds = getTimeframeSeconds(timeframe);
  const now = bucketTime(Math.floor(Date.now() / 1000), timeframe);
  let price = Number(livePrice) || 100;
  const data = [];

  for (let i = 220; i > 0; i--) {
    const open = price;
    const move = (Math.random() - 0.5) * (price * 0.012);
    const close = open + move;
    const high = Math.max(open, close) + Math.random() * (price * 0.006);
    const low = Math.min(open, close) - Math.random() * (price * 0.006);
    const volume = Math.floor(Math.random() * 900000) + 100000;

    data.push({
      time: now - i * seconds,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    price = close;
  }

  return data;
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

function normalizeBackendCandles(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((candle) => ({
      time: Number(candle.time),
      open: Number(Number(candle.open).toFixed(4)),
      high: Number(Number(candle.high).toFixed(4)),
      low: Number(Number(candle.low).toFixed(4)),
      close: Number(Number(candle.close).toFixed(4)),
      volume: Number(candle.volume || 1),
    }))
    .filter((candle) =>
      Number.isFinite(candle.time) &&
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close)
    );
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
  livePrice,
  livePulse = null,
  indicators = {},
  onStatusChange,
  replayMode = false,
  replayIndex = null,
  onReplayData,
  replayTrades = [],
  brokerApiUrl = DEFAULT_BROKER_API_URL,
  trendTools = {},
  isDark = true,
}) {
  const chartSymbol = String(symbol || "").trim().toUpperCase() || "SPY";
  const chartTheme = isDark
    ? {
        background: "#050b14",
        text: "#d1d4dc",
        muted: "#8a94a6",
        faint: "#5f6b7a",
        grid: "rgba(31,41,55,0.55)",
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
  const trendLineRefs = useRef([]);
  const candlesRef = useRef([]);
  const lastCandleRef = useRef(null);
  const lastLivePriceRef = useRef(null);
  const statusRef = useRef("LOADING");
  const animationFrameRef = useRef(null);
  const displayPriceRef = useRef(null);
  const targetPriceRef = useRef(null);
  const targetTickMetaRef = useRef(null);
  const lastAppliedPriceRef = useRef(null);
  const lastAppliedTimeRef = useRef(0);
  const livePriceRef = useRef(livePrice);
  const onReplayDataRef = useRef(onReplayData);
  const onStatusChangeRef = useRef(onStatusChange);
  const lastIndicatorUpdateRef = useRef(0);
  const pendingStreamTickRef = useRef(null);
  const streamFrameRef = useRef(null);
  const lastStreamTickAtRef = useRef(null);
  const resizeFrameRef = useRef(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [hadChartHistoryBeforeLoad, setHadChartHistoryBeforeLoad] = useState(false);

  const setStatus = useCallback((nextStatus) => {
    if (statusRef.current === nextStatus) return;

    statusRef.current = nextStatus;
    if (typeof onStatusChangeRef.current === "function") {
      onStatusChangeRef.current(nextStatus);
    }
  }, []);

  useEffect(() => {
    livePriceRef.current = livePrice;
  }, [livePrice]);

  useEffect(() => {
    onReplayDataRef.current = onReplayData;
  }, [onReplayData]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const getVisibleCandles = useCallback(() => {
    if (!replayMode) return candlesRef.current;

    const safeIndex =
      typeof replayIndex === "number"
        ? Math.min(Math.max(replayIndex, 5), candlesRef.current.length - 1)
        : candlesRef.current.length - 1;

    return candlesRef.current.slice(0, safeIndex + 1);
  }, [replayIndex, replayMode]);

  const updateIndicators = useCallback((source = getVisibleCandles()) => {
    CHART_INDICATORS.forEach((indicator) => {
      const series = indicatorSeriesRef.current[indicator.id];
      if (!series) return;

      series.setData(indicators[indicator.id] ? indicator.calculate(source) : []);
    });
  }, [getVisibleCandles, indicators]);

  const updateVolume = useCallback((source = getVisibleCandles()) => {
    if (!volumeSeriesRef.current) return;
    if (!indicators[VOLUME_INDICATOR.id]) {
      volumeSeriesRef.current.setData([]);
      return;
    }

    volumeSeriesRef.current.setData(
      source.map((candle) => ({
        time: candle.time,
        value: candle.volume || 1,
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
      .filter((trade) => trade.time)
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

    if (typeof candleSeriesRef.current.setMarkers === "function") {
      candleSeriesRef.current.setMarkers(markers);
    }
  }, [replayTrades]);

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

  const applyHistoryDataset = useCallback((rows, nextStatus, options = {}) => {
    const normalizedRows = Array.isArray(rows) ? rows : [];

    if (!normalizedRows.length || !candleSeriesRef.current) return false;

    candlesRef.current = normalizedRows;
    lastCandleRef.current = normalizedRows[normalizedRows.length - 1];
    displayPriceRef.current = lastCandleRef.current.close;
    targetPriceRef.current = lastCandleRef.current.close;
    lastAppliedPriceRef.current = lastCandleRef.current.close;

    candleSeriesRef.current.setData(normalizedRows);
    updateVolumeRef.current(normalizedRows);
    if (typeof onReplayDataRef.current === "function") onReplayDataRef.current(normalizedRows);
    updateIndicatorsRef.current(normalizedRows);
    updateMarkersRef.current();
    updateTrendToolsRef.current(normalizedRows);

    if (chartRef.current && options.fitContent !== false) {
      chartRef.current.timeScale().fitContent();
    }

    if (nextStatus) setStatus(nextStatus);
    return true;
  }, [setStatus]);

  useEffect(() => {
    updateVolumeRef.current = updateVolume;
  }, [updateVolume]);

  useEffect(() => {
    updateIndicatorsRef.current = updateIndicators;
  }, [updateIndicators]);

  useEffect(() => {
    updateMarkersRef.current = updateMarkers;
  }, [updateMarkers]);

  useEffect(() => {
    updateTrendToolsRef.current = updateTrendTools;
  }, [updateTrendTools]);

  const updateCurrentCandle = useCallback((priceValue, timestamp = Math.floor(Date.now() / 1000), options = {}) => {
    if (!priceValue || !candleSeriesRef.current || !lastCandleRef.current) return;

    const price = Number(priceValue);
    const currentBucket = bucketTime(timestamp, timeframe);
    const last = lastCandleRef.current;
    const volumeIncrement = Math.max(Number(options.volumeIncrement || 1), 1);
    let createdNewBucket = false;

    let updated;

    if (last.time === currentBucket) {
      updated = {
        ...last,
        high: Number(Math.max(last.high, price).toFixed(2)),
        low: Number(Math.min(last.low, price).toFixed(2)),
        close: Number(price.toFixed(2)),
        volume: Number(last.volume || 0) + volumeIncrement,
      };

      candlesRef.current = candlesRef.current.map((candle) =>
        candle.time === currentBucket ? updated : candle
      );
    } else if (currentBucket > last.time) {
      const open = Number(last.close.toFixed(2));
      createdNewBucket = true;

      updated = {
        time: currentBucket,
        open,
        high: Number(Math.max(open, price).toFixed(2)),
        low: Number(Math.min(open, price).toFixed(2)),
        close: Number(price.toFixed(2)),
        volume: volumeIncrement,
      };

      candlesRef.current = [...candlesRef.current, updated].slice(-350);
    } else {
      return;
    }

    lastCandleRef.current = updated;
    lastAppliedPriceRef.current = price;
    lastAppliedTimeRef.current = Date.now();

    if (!replayMode) {
      candleSeriesRef.current.update(updated);

      if (volumeSeriesRef.current && indicators[VOLUME_INDICATOR.id]) {
        volumeSeriesRef.current.update({
          time: updated.time,
          value: updated.volume,
          color:
            updated.close >= updated.open
              ? "rgba(0,200,150,0.35)"
              : "rgba(239,83,80,0.35)",
        });
      }

      const now = Date.now();
      const shouldUpdateIndicators =
        options.forceIndicators ||
        createdNewBucket ||
        now - lastIndicatorUpdateRef.current > 1000;

      if (shouldUpdateIndicators) {
        updateIndicators(candlesRef.current);
        updateTrendToolsRef.current(candlesRef.current);
        lastIndicatorUpdateRef.current = now;
      }
    }

    if (options.status) {
      setStatus(options.status);
    } else if (statusRef.current !== "LIVE" && statusRef.current !== "DELAYED" && statusRef.current !== "QTRD" && statusRef.current !== "SIM") {
      setStatus("LIVE");
    }
  }, [indicators, replayMode, setStatus, timeframe, updateIndicators]);

  const rebaseLatestCandle = useCallback((priceValue, timestamp = Math.floor(Date.now() / 1000), options = {}) => {
    if (!priceValue || !candleSeriesRef.current || !lastCandleRef.current) return;

    const price = Number(priceValue);
    const currentBucket = bucketTime(timestamp, timeframe);
    const previous = lastCandleRef.current;
    const spread = Math.max(price * 0.0012, 0.03);
    const volumeIncrement = Math.max(Number(options.volumeIncrement || 1), 1);

    const updated = {
      time: currentBucket >= previous.time ? currentBucket : previous.time,
      open: Number((price - spread * 0.35).toFixed(2)),
      high: Number((price + spread).toFixed(2)),
      low: Number((price - spread).toFixed(2)),
      close: Number(price.toFixed(2)),
      volume: Math.max(Number(previous.volume || 0) + volumeIncrement, Number(previous.volume || 0)),
    };

    candlesRef.current = candlesRef.current
      .filter((candle) => candle.time !== updated.time)
      .concat(updated)
      .sort((a, b) => a.time - b.time)
      .slice(-350);

    lastCandleRef.current = updated;
    displayPriceRef.current = price;
    targetPriceRef.current = price;
    lastAppliedPriceRef.current = price;
    lastAppliedTimeRef.current = Date.now();

    if (!replayMode) {
      candleSeriesRef.current.update(updated);
      updateVolume(candlesRef.current);
      updateIndicators(candlesRef.current);
      updateTrendToolsRef.current(candlesRef.current);
    }

    setStatus(options.status || "LIVE");
  }, [replayMode, setStatus, timeframe, updateIndicators, updateVolume]);

  const runSmoothAnimation = useCallback(() => {
    if (animationFrameRef.current) return;

    const animate = () => {
      animationFrameRef.current = null;

      if (
        replayMode ||
        !targetPriceRef.current ||
        !displayPriceRef.current ||
        !candleSeriesRef.current ||
        !lastCandleRef.current
      ) {
        return;
      }

      const target = Number(targetPriceRef.current);
      const current = Number(displayPriceRef.current);
      const diff = target - current;
      const tickMeta = targetTickMetaRef.current || {};
      const tickTimestamp = tickMeta.timestamp || Math.floor(Date.now() / 1000);
      const tickOptions = tickMeta.options || {};

      if (Math.abs(diff) < Math.max(target * 0.00008, 0.01)) {
        displayPriceRef.current = target;
        updateCurrentCandle(target, tickTimestamp, tickOptions);
        return;
      }

      const next = current + diff * 0.18;
      displayPriceRef.current = next;
      updateCurrentCandle(next, tickTimestamp, tickOptions);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [replayMode, updateCurrentCandle]);

  const applyLivePrice = useCallback((priceValue, timestamp = Math.floor(Date.now() / 1000), options = {}) => {
    if (!priceValue || !candleSeriesRef.current || !lastCandleRef.current) return;

    const price = Number(priceValue);
    if (!price || Number.isNaN(price)) return;

    const lastClose = Number(lastCandleRef.current.close || price);
    const gapPercent = lastClose > 0 ? Math.abs((price - lastClose) / lastClose) : 0;

    // If REST candles are delayed and the live quote is far away, do not draw one giant candle.
    // Rebase the latest candle around the live quote, then smooth future ticks.
    if (gapPercent > 0.025) {
      rebaseLatestCandle(price, timestamp, options);
      return;
    }

    if (!displayPriceRef.current) {
      displayPriceRef.current = lastClose;
    }

    targetTickMetaRef.current = {
      timestamp,
      options,
    };
    targetPriceRef.current = price;
    runSmoothAnimation();
  }, [rebaseLatestCandle, runSmoothAnimation]);

  const applyLivePriceRef = useRef(applyLivePrice);

  useEffect(() => {
    applyLivePriceRef.current = applyLivePrice;
  }, [applyLivePrice]);

  const queueStreamTick = useCallback((trade) => {
    const price = Number(trade?.p || trade?.price || 0);

    if (!price || Number.isNaN(price) || replayMode) return;

    pendingStreamTickRef.current = {
      price,
      timestamp: Number(trade.t || trade.timestamp || Math.floor(Date.now() / 1000)),
      options: {
        status: trade.delayed ? "DELAYED" : "QTRD",
        volumeIncrement: Number(trade.lastTradeSize || 1) || 1,
      },
    };
    lastStreamTickAtRef.current = Date.now();

    if (streamFrameRef.current) return;

    streamFrameRef.current = requestAnimationFrame(() => {
      streamFrameRef.current = null;
      const tick = pendingStreamTickRef.current;
      pendingStreamTickRef.current = null;

      if (!tick) return;

      lastLivePriceRef.current = tick.price;
      applyLivePrice(tick.price, tick.timestamp, tick.options);
    });
  }, [applyLivePrice, replayMode]);

  useEffect(() => {
    if (!containerRef.current) return;

    const hadHistory = candlesRef.current.length > 0;
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
    volumeSeriesRef.current = volumeSeries;
    indicatorSeriesRef.current = indicatorSeries;

    if (hadHistory) {
      applyHistoryDataset(candlesRef.current, "UPDATING", { fitContent: true });
    }

    chart.subscribeCrosshairMove((param) => {
      if (disposed) return;
      if (!tooltipRef.current || !containerRef.current) return;

      if (!param.time || !param.point) {
        tooltipRef.current.style.display = "none";
        return;
      }

      const candle = candlesRef.current.find((item) => item.time === param.time);
      if (!candle) {
        tooltipRef.current.style.display = "none";
        return;
      }

      tooltipRef.current.style.display = "block";
      tooltipRef.current.style.left = `${Math.min(param.point.x + 14, containerRef.current.clientWidth - 170)}px`;
      tooltipRef.current.style.top = `${Math.max(param.point.y - 84, 8)}px`;
      tooltipRef.current.innerHTML = `
        <div style="font-weight:900;color:${chartTheme.tooltipTitle};margin-bottom:4px">${escapeHtml(chartSymbol)} - ${escapeHtml(timeframe)}</div>
        <div>O: <b>${candle.open.toFixed(2)}</b></div>
        <div>H: <b style="color:#00c896">${candle.high.toFixed(2)}</b></div>
        <div>L: <b style="color:#ef5350">${candle.low.toFixed(2)}</b></div>
        <div>C: <b>${candle.close.toFixed(2)}</b></div>
        <div>Vol: <b>${formatVolume(candle.volume)}</b></div>
      `;
    });

    async function loadCandles() {
      try {
        const cleanBrokerApiUrl = String(brokerApiUrl || "").replace(/\/+$/, "");

        if (cleanBrokerApiUrl) {
          const backendData = await fetchJsonWithTimeout(
            `${cleanBrokerApiUrl}/api/questrade/candles/${encodeURIComponent(chartSymbol)}?timeframe=${encodeURIComponent(timeframe)}`,
            9000
          );
          const backendCandles = normalizeBackendCandles(backendData.candles);

          if (backendCandles.length) {
            if (disposed) return;

            applyHistoryDataset(backendCandles, "QTRD", { fitContent: true });
            setIsHistoryLoading(false);

            if (lastLivePriceRef.current) {
              applyLivePriceRef.current(lastLivePriceRef.current);
            }
            return;
          }
        }

        const fallback = generateFallbackCandles(livePriceRef.current, timeframe);
        if (disposed) return;

        applyHistoryDataset(fallback, "SIM", { fitContent: true });
        setIsHistoryLoading(false);
      } catch {
        const fallback = generateFallbackCandles(livePriceRef.current, timeframe);
        if (disposed) return;

        applyHistoryDataset(fallback, "SIM", { fitContent: true });
        setIsHistoryLoading(false);
      }
    }

    loadCandles();

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
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
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
  }, [applyHistoryDataset, brokerApiUrl, chartSymbol, chartTheme.background, chartTheme.border, chartTheme.grid, chartTheme.text, chartTheme.tooltipTitle, setStatus, timeframe]);

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
    if (!livePrice || replayMode) return;

    lastLivePriceRef.current = Number(livePrice);
    applyLivePrice(Number(livePrice), Math.floor(Date.now() / 1000));
  }, [applyLivePrice, livePrice, livePulse, replayMode]);

  useEffect(() => {
    if (!chartSymbol || replayMode) return undefined;

    const unsubscribe = marketDataService.subscribe(chartSymbol, queueStreamTick);
    const staleTimer = window.setInterval(() => {
      if (!lastStreamTickAtRef.current) return;

      const isStale = Date.now() - lastStreamTickAtRef.current > 15000;
      if (isStale && statusRef.current === "QTRD") {
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

  useEffect(() => {
    if (!candleSeriesRef.current || !candlesRef.current.length) return;

    const source = replayMode ? getVisibleCandles() : candlesRef.current;

    candleSeriesRef.current.setData(source);
    updateVolumeRef.current(source);
    updateIndicatorsRef.current(source);
    updateMarkersRef.current();
    updateTrendToolsRef.current(source);
  }, [getVisibleCandles, replayIndex, replayMode, replayTrades]);

  return (
    <div
      ref={containerRef}
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
          background: chartTheme.overlay,
          border: `1px solid ${chartTheme.overlayBorder}`,
          color: chartTheme.text,
          fontSize: "11px",
          lineHeight: "1.35",
          backdropFilter: "blur(8px)",
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

      <div
        ref={tooltipRef}
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
