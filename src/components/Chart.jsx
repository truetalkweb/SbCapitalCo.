import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  CrosshairMode,
} from "lightweight-charts";

export default function Chart({ symbol, timeframe, livePrice }) {
  const chartContainerRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const lastCandleRef = useRef(null);

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

    candleSeriesRef.current = candleSeries;

    const now = Math.floor(Date.now() / 60) * 60;
    let price = Number(livePrice) || 100;
    const data = [];

    for (let i = 100; i > 0; i--) {
      const open = price;
      const close = open + (Math.random() - 0.5) * 2;
      const high = Math.max(open, close) + Math.random();
      const low = Math.min(open, close) - Math.random();

      const candle = {
        time: now - i * 60,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
      };

      data.push(candle);
      price = close;
    }

    lastCandleRef.current = data[data.length - 1];

    candleSeries.setData(data);
    chart.timeScale().fitContent();

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
    if (!livePrice || !candleSeriesRef.current || !lastCandleRef.current) return;

    const currentTime = Math.floor(Date.now() / 60) * 60;
    const lastCandle = lastCandleRef.current;

    let updatedCandle;

    if (lastCandle.time === currentTime) {
      updatedCandle = {
        ...lastCandle,
        high: Math.max(lastCandle.high, livePrice),
        low: Math.min(lastCandle.low, livePrice),
        close: livePrice,
      };
    } else {
      updatedCandle = {
        time: currentTime,
        open: lastCandle.close,
        high: livePrice,
        low: livePrice,
        close: livePrice,
      };
    }

    lastCandleRef.current = updatedCandle;
    candleSeriesRef.current.update(updatedCandle);
  }, [livePrice]);

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