import React, { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  CrosshairMode,
} from "lightweight-charts";

const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

function getTimeframeSeconds(timeframe) {
  if (timeframe === "1m") return 60;
  if (timeframe === "5m") return 60 * 5;
  if (timeframe === "15m") return 60 * 15;
  if (timeframe === "1H") return 60 * 60;
  if (timeframe === "1D") return 60 * 60 * 24;
  return 60 * 15;
}

function getTimeframeSettings(timeframe) {
  const now = Math.floor(Date.now() / 1000);

  if (timeframe === "1m") return { resolution: "1", from: now - 60 * 60 * 6 };
  if (timeframe === "5m") return { resolution: "5", from: now - 60 * 60 * 24 };
  if (timeframe === "15m") return { resolution: "15", from: now - 60 * 60 * 24 * 5 };
  if (timeframe === "1H") return { resolution: "60", from: now - 60 * 60 * 24 * 30 };
  if (timeframe === "1D") return { resolution: "D", from: now - 60 * 60 * 24 * 180 };

  return { resolution: "15", from: now - 60 * 60 * 24 * 5 };
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

function generateFallbackCandles(livePrice, timeframe) {
  const seconds = getTimeframeSeconds(timeframe);
  const now = bucketTime(Math.floor(Date.now() / 1000), timeframe);
  let price = Number(livePrice) || 100;
  const data = [];

  for (let i = 180; i > 0; i--) {
    const open = price;
    const move = (Math.random() - 0.5) * (price * 0.012);
    const close = open + move;
    const high = Math.max(open, close) + Math.random() * (price * 0.006);
    const low = Math.min(open, close) - Math.random() * (price * 0.006);

    data.push({
      time: now - i * seconds,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
    });

    price = close;
  }

  return data;
}

function Chart({
  symbol,
  timeframe,
  livePrice,
  showEMA9 = true,
  showEMA20 = true,
  onStatusChange,
  replayMode = false,
  replayIndex = null,
  onReplayData,
  replayTrades = [],
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const ema9Ref = useRef(null);
  const ema20Ref = useRef(null);
  const candlesRef = useRef([]);
  const lastCandleRef = useRef(null);
  const lastLivePriceRef = useRef(null);
  const statusRef = useRef("LOADING");
  const replayModeRef = useRef(false);

  function setStatus(nextStatus) {
    statusRef.current = nextStatus;
    if (typeof onStatusChange === "function") {
      onStatusChange(nextStatus);
    }
  }

  function updateIndicators() {
    if (!ema9Ref.current || !ema20Ref.current) return;

    ema9Ref.current.setData(
      showEMA9 ? calculateEMA(candlesRef.current, 9) : []
    );

    ema20Ref.current.setData(
      showEMA20 ? calculateEMA(candlesRef.current, 20) : []
    );
  }

  function applyLivePrice(priceValue, timestamp = Math.floor(Date.now() / 1000)) {
    if (!priceValue || !candleSeriesRef.current || !lastCandleRef.current) return;

    const price = Number(priceValue);
    const currentBucket = bucketTime(timestamp, timeframe);
    const last = lastCandleRef.current;

    let updated;

    if (last.time === currentBucket) {
      updated = {
        ...last,
        high: Number(Math.max(last.high, price).toFixed(2)),
        low: Number(Math.min(last.low, price).toFixed(2)),
        close: Number(price.toFixed(2)),
      };

      candlesRef.current = candlesRef.current.map((candle) =>
        candle.time === currentBucket ? updated : candle
      );
    } else if (currentBucket > last.time) {
      updated = {
        time: currentBucket,
        open: Number(last.close.toFixed(2)),
        high: Number(price.toFixed(2)),
        low: Number(price.toFixed(2)),
        close: Number(price.toFixed(2)),
      };

      candlesRef.current = [...candlesRef.current, updated].slice(-300);
    } else {
      return;
    }

    lastCandleRef.current = updated;
    candleSeriesRef.current.update(updated);
    updateIndicators();

    if (statusRef.current !== "LIVE" && statusRef.current !== "DELAYED") {
      setStatus("LIVE");
    }
  }

  useEffect(() => {
    if (!containerRef.current) return;

    setStatus("LOADING");

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { color: "#050b14" },
        textColor: "#d1d4dc",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "#111c2d" },
        horzLines: { color: "#111c2d" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "#1f2937",
        textColor: "#d1d4dc",
        scaleMargins: {
          top: 0.1,
          bottom: 0.12,
        },
      },
      timeScale: {
        borderColor: "#1f2937",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: 8,
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

    const ema9Series = chart.addSeries(LineSeries, {
      color: "#2196f3",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const ema20Series = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    ema9Ref.current = ema9Series;
    ema20Ref.current = ema20Series;

    async function loadCandles() {
      try {
        const now = Math.floor(Date.now() / 1000);
        const { resolution, from } = getTimeframeSettings(timeframe);

        const res = await fetch(
          `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${now}&token=${FINNHUB_API_KEY}`
        );

        const data = await res.json();

        if (data.s === "ok" && Array.isArray(data.t) && data.t.length > 0) {
          const candles = data.t.map((time, i) => ({
            time,
            open: Number(data.o[i].toFixed(2)),
            high: Number(data.h[i].toFixed(2)),
            low: Number(data.l[i].toFixed(2)),
            close: Number(data.c[i].toFixed(2)),
          }));

          candlesRef.current = candles;
          lastCandleRef.current = candles[candles.length - 1];

          candleSeries.setData(candles);
          if (typeof onReplayData === "function") onReplayData(candles);
          updateIndicators();
          chart.timeScale().fitContent();
          setStatus("LIVE");

          if (lastLivePriceRef.current) {
            applyLivePrice(lastLivePriceRef.current);
          }
        } else {
          const fallback = generateFallbackCandles(livePrice, timeframe);

          candlesRef.current = fallback;
          lastCandleRef.current = fallback[fallback.length - 1];

          candleSeries.setData(fallback);
          if (typeof onReplayData === "function") onReplayData(fallback);
          updateIndicators();
          chart.timeScale().fitContent();
          setStatus("SIM");
        }
      } catch {
        const fallback = generateFallbackCandles(livePrice, timeframe);

        candlesRef.current = fallback;
        lastCandleRef.current = fallback[fallback.length - 1];

        candleSeries.setData(fallback);
        if (typeof onReplayData === "function") onReplayData(fallback);
        updateIndicators();
        chart.timeScale().fitContent();
        setStatus("SIM");
      }
    }

    loadCandles();

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;

      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      ema9Ref.current = null;
      ema20Ref.current = null;
    };
  }, [symbol, timeframe]);

  useEffect(() => {
    updateIndicators();
  }, [showEMA9, showEMA20]);

  useEffect(() => {
    if (!livePrice || replayMode) return;

    lastLivePriceRef.current = Number(livePrice);
    applyLivePrice(Number(livePrice));
  }, [livePrice, showEMA9, showEMA20, timeframe, replayMode]);

  useEffect(() => {
    replayModeRef.current = replayMode;

    if (!candleSeriesRef.current || !candlesRef.current.length) return;

    if (!replayMode) {
      candleSeriesRef.current.setData(candlesRef.current);
      updateIndicators();
      return;
    }

    const safeIndex =
      typeof replayIndex === "number"
        ? Math.min(Math.max(replayIndex, 5), candlesRef.current.length - 1)
        : candlesRef.current.length - 1;

    const visibleCandles = candlesRef.current.slice(0, safeIndex + 1);

    candleSeriesRef.current.setData(visibleCandles);

    if (ema9Ref.current) {
      ema9Ref.current.setData(showEMA9 ? calculateEMA(visibleCandles, 9) : []);
    }

    if (ema20Ref.current) {
      ema20Ref.current.setData(showEMA20 ? calculateEMA(visibleCandles, 20) : []);
    }

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
            : `SELL ${trade.qty} ${trade.pnl ? `$${Number(trade.pnl).toFixed(2)}` : ""}`,
      }));

    if (typeof candleSeriesRef.current.setMarkers === "function") {
      candleSeriesRef.current.setMarkers(markers);
    }
  }, [replayMode, replayIndex, replayTrades, showEMA9, showEMA20]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        background: "#050b14",
        overflow: "hidden",
        cursor: "grab",
      }}
    />
  );
}

export default React.memo(Chart);
