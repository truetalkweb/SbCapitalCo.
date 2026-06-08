import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
} from "lightweight-charts";
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

function calculateEMA(data, period) {
  if (!data.length) return [];

  const multiplier = 2 / (period + 1);
  let ema = data[0].close;

  return data.map((candle) => {
    ema = (candle.close - ema) * multiplier + ema;

    return {
      time: candle.time,
      value: Number(ema.toFixed(2)),
    };
  });
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

function Chart({
  symbol,
  timeframe,
  livePrice,
  livePulse = null,
  showEMA9 = true,
  showEMA20 = true,
  onStatusChange,
  replayMode = false,
  replayIndex = null,
  onReplayData,
  replayTrades = [],
  brokerApiUrl = DEFAULT_BROKER_API_URL,
}) {
  const chartSymbol = String(symbol || "").trim().toUpperCase() || "SPY";
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const ema9Ref = useRef(null);
  const ema20Ref = useRef(null);
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
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

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
    if (!ema9Ref.current || !ema20Ref.current) return;

    ema9Ref.current.setData(showEMA9 ? calculateEMA(source, 9) : []);
    ema20Ref.current.setData(showEMA20 ? calculateEMA(source, 20) : []);
  }, [getVisibleCandles, showEMA9, showEMA20]);

  const updateVolume = useCallback((source = getVisibleCandles()) => {
    if (!volumeSeriesRef.current) return;

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
  }, [getVisibleCandles]);

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

      if (volumeSeriesRef.current) {
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
        lastIndicatorUpdateRef.current = now;
      }
    }

    if (options.status) {
      setStatus(options.status);
    } else if (statusRef.current !== "LIVE" && statusRef.current !== "DELAYED" && statusRef.current !== "QTRD" && statusRef.current !== "SIM") {
      setStatus("LIVE");
    }
  }, [replayMode, setStatus, timeframe, updateIndicators]);

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

    setIsHistoryLoading(true);
    setStatus("LOADING");
    let disposed = false;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      autoSize: false,
      layout: {
        background: { color: "#050b14" },
        textColor: "#d1d4dc",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(31,41,55,0.55)" },
        horzLines: { color: "rgba(31,41,55,0.55)" },
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
        borderColor: "#1f2937",
        textColor: "#d1d4dc",
        scaleMargins: {
          top: 0.08,
          bottom: 0.22,
        },
      },
      timeScale: {
        borderColor: "#1f2937",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: 8,
        minBarSpacing: 3,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: false,
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

    const ema9Series = chart.addSeries(LineSeries, {
      color: "#2196f3",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "EMA 9",
    });

    const ema20Series = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "EMA 20",
    });


    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ema9Ref.current = ema9Series;
    ema20Ref.current = ema20Series;

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
        <div style="font-weight:900;color:#fff;margin-bottom:4px">${escapeHtml(chartSymbol)} - ${escapeHtml(timeframe)}</div>
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

            candlesRef.current = backendCandles;
            lastCandleRef.current = backendCandles[backendCandles.length - 1];
            displayPriceRef.current = lastCandleRef.current.close;
            targetPriceRef.current = lastCandleRef.current.close;
            lastAppliedPriceRef.current = lastCandleRef.current.close;

            candleSeries.setData(backendCandles);
            updateVolume(backendCandles);
            if (typeof onReplayDataRef.current === "function") onReplayDataRef.current(backendCandles);
            updateIndicators(backendCandles);
            updateMarkers();
            chart.timeScale().fitContent();
            setStatus("QTRD");
            setIsHistoryLoading(false);

            if (lastLivePriceRef.current) {
              applyLivePrice(lastLivePriceRef.current);
            }
            return;
          }
        }

        const fallback = generateFallbackCandles(livePriceRef.current, timeframe);
        if (disposed) return;

        candlesRef.current = fallback;
        lastCandleRef.current = fallback[fallback.length - 1];
        displayPriceRef.current = lastCandleRef.current.close;
        targetPriceRef.current = lastCandleRef.current.close;
        lastAppliedPriceRef.current = lastCandleRef.current.close;

        candleSeries.setData(fallback);
        updateVolume(fallback);
        if (typeof onReplayDataRef.current === "function") onReplayDataRef.current(fallback);
        updateIndicators(fallback);
        updateMarkers();
        chart.timeScale().fitContent();
        setStatus("SIM");
        setIsHistoryLoading(false);
      } catch {
        const fallback = generateFallbackCandles(livePriceRef.current, timeframe);
        if (disposed) return;

        candlesRef.current = fallback;
        lastCandleRef.current = fallback[fallback.length - 1];
        displayPriceRef.current = lastCandleRef.current.close;
        targetPriceRef.current = lastCandleRef.current.close;
        lastAppliedPriceRef.current = lastCandleRef.current.close;

        candleSeries.setData(fallback);
        updateVolume(fallback);
        if (typeof onReplayDataRef.current === "function") onReplayDataRef.current(fallback);
        updateIndicators(fallback);
        updateMarkers();
        chart.timeScale().fitContent();
        setStatus("SIM");
        setIsHistoryLoading(false);
      }
    }

    loadCandles();

    const resizeObserver = new ResizeObserver(() => {
      if (disposed) return;
      if (!containerRef.current || !chartRef.current) return;

      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
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
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema9Ref.current = null;
      ema20Ref.current = null;
      requestAnimationFrame(() => {
        try {
          chart.remove();
        } catch {
          // Lightweight Charts can already be disposed during rapid layout switches.
        }
      });
    };
  }, [applyLivePrice, brokerApiUrl, chartSymbol, setStatus, timeframe, updateIndicators, updateMarkers, updateVolume]);

  useEffect(() => {
    updateIndicators();
  }, [updateIndicators]);

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

    if (!replayMode) {
      candleSeriesRef.current.setData(candlesRef.current);
      updateVolume(candlesRef.current);
      updateIndicators(candlesRef.current);
      updateMarkers();
      return;
    }

    const visibleCandles = getVisibleCandles();

    candleSeriesRef.current.setData(visibleCandles);
    updateVolume(visibleCandles);
    updateIndicators(visibleCandles);
    updateMarkers();
  }, [
    getVisibleCandles,
    replayMode,
    replayIndex,
    replayTrades,
    showEMA9,
    showEMA20,
    updateIndicators,
    updateMarkers,
    updateVolume,
  ]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 0,
        background: "#050b14",
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
          background: "rgba(5,11,20,0.76)",
          border: "1px solid rgba(35,48,68,0.85)",
          color: "#d1d4dc",
          fontSize: "11px",
          lineHeight: "1.35",
          backdropFilter: "blur(8px)",
          pointerEvents: "none",
        }}
      >
        <div style={{ fontWeight: 900, color: "#ffffff" }}>
          {chartSymbol} - {timeframe}
        </div>
        <div>
          EMA9 <span style={{ color: "#2196f3" }}>--</span> / EMA20{" "}
          <span style={{ color: "#f59e0b" }}>--</span> / {" "}
          <span style={{ color: "#a855f7" }}>---</span>
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
            background: "rgba(5,11,20,0.78)",
            border: "1px solid rgba(35,48,68,0.9)",
            color: "#8fb7ff",
            fontSize: "10px",
            fontWeight: 850,
            pointerEvents: "none",
            backdropFilter: "blur(8px)",
          }}
        >
          Loading {chartSymbol}
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
          background: "rgba(5,11,20,0.92)",
          border: "1px solid rgba(35,48,68,0.95)",
          color: "#d1d4dc",
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
