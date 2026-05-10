import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  CrosshairMode,
} from "lightweight-charts";

const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

function getTimeframeSettings(timeframe) {
  const now = Math.floor(Date.now() / 1000);

  if (timeframe === "1m") return { resolution: "1", from: now - 60 * 60 * 6 };
  if (timeframe === "5m") return { resolution: "5", from: now - 60 * 60 * 24 };
  if (timeframe === "15m") return { resolution: "15", from: now - 60 * 60 * 24 * 5 };
  if (timeframe === "1H") return { resolution: "60", from: now - 60 * 60 * 24 * 30 };
  if (timeframe === "1D") return { resolution: "D", from: now - 60 * 60 * 24 * 180 };

  return { resolution: "15", from: now - 60 * 60 * 24 * 5 };
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

function generateFallbackCandles(livePrice) {
  const now = Math.floor(Date.now() / 60) * 60;
  let price = Number(livePrice) || 100;
  const data = [];

  for (let i = 100; i > 0; i--) {
    const open = price;
    const close = open + (Math.random() - 0.5) * 2;
    const high = Math.max(open, close) + Math.random();
    const low = Math.min(open, close) - Math.random();

    data.push({
      time: now - i * 60,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
    });

    price = close;
  }

  return data;
}

export default function Chart({
  symbol,
  timeframe,
  livePrice,
  showEMA9 = true,
  showEMA20 = true,
}) {
  const chartContainerRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const ema9SeriesRef = useRef(null);
  const ema20SeriesRef = useRef(null);
  const lastCandleRef = useRef(null);
  const candlesRef = useRef([]);

  function updateIndicators() {
    if (!ema9SeriesRef.current || !ema20SeriesRef.current) return;

    if (showEMA9) {
      ema9SeriesRef.current.setData(calculateEMA(candlesRef.current, 9));
    } else {
      ema9SeriesRef.current.setData([]);
    }

    if (showEMA20) {
      ema20SeriesRef.current.setData(calculateEMA(candlesRef.current, 20));
    } else {
      ema20SeriesRef.current.setData([]);
    }
  }

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: "#131722" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "#2a2e39",
      },
      timeScale: {
        borderColor: "#2a2e39",
        timeVisible: true,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    const ema9Series = chart.addSeries(LineSeries, {
      color: "#2196f3",
      lineWidth: 2,
    });

    const ema20Series = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 2,
    });

    candleSeriesRef.current = candleSeries;
    ema9SeriesRef.current = ema9Series;
    ema20SeriesRef.current = ema20Series;

    async function loadCandles() {
      try {
        const now = Math.floor(Date.now() / 1000);
        const { resolution, from } = getTimeframeSettings(timeframe);

        const response = await fetch(
          `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${now}&token=${FINNHUB_API_KEY}`
        );

        const data = await response.json();

        if (data.s === "ok" && data.t?.length > 0) {
          const candles = data.t.map((time, index) => ({
            time,
            open: Number(data.o[index].toFixed(2)),
            high: Number(data.h[index].toFixed(2)),
            low: Number(data.l[index].toFixed(2)),
            close: Number(data.c[index].toFixed(2)),
          }));

          candlesRef.current = candles;
          lastCandleRef.current = candles[candles.length - 1];

          candleSeries.setData(candles);
          updateIndicators();
        } else {
          const fallback = generateFallbackCandles(livePrice);

          candlesRef.current = fallback;
          lastCandleRef.current = fallback[fallback.length - 1];

          candleSeries.setData(fallback);
          updateIndicators();
        }

        chart.timeScale().fitContent();
      } catch {
        const fallback = generateFallbackCandles(livePrice);

        candlesRef.current = fallback;
        lastCandleRef.current = fallback[fallback.length - 1];

        candleSeries.setData(fallback);
        updateIndicators();
        chart.timeScale().fitContent();
      }
    }

    loadCandles();

    const resizeObserver = new ResizeObserver(() => {
      if (!chartContainerRef.current) return;

      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
      });
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [symbol, timeframe]);

  useEffect(() => {
    updateIndicators();
  }, [showEMA9, showEMA20]);

  useEffect(() => {
    if (!livePrice || !candleSeriesRef.current || !lastCandleRef.current) {
      return;
    }

    const currentTime = Math.floor(Date.now() / 60) * 60;
    const lastCandle = lastCandleRef.current;

    let updatedCandle;

    if (lastCandle.time === currentTime) {
      updatedCandle = {
        ...lastCandle,
        high: Math.max(lastCandle.high, livePrice),
        low: Math.min(lastCandle.low, livePrice),
        close: Number(livePrice.toFixed(2)),
      };

      candlesRef.current = candlesRef.current.map((candle) =>
        candle.time === currentTime ? updatedCandle : candle
      );
    } else {
      updatedCandle = {
        time: currentTime,
        open: lastCandle.close,
        high: Number(livePrice.toFixed(2)),
        low: Number(livePrice.toFixed(2)),
        close: Number(livePrice.toFixed(2)),
      };

      candlesRef.current = [...candlesRef.current, updatedCandle].slice(-150);
    }

    lastCandleRef.current = updatedCandle;

    candleSeriesRef.current.update(updatedCandle);
    updateIndicators();
  }, [livePrice, showEMA9, showEMA20]);

  return (
    <div
      ref={chartContainerRef}
      style={{
        width: "100%",
        height: "500px",
      }}
    />
  );
}