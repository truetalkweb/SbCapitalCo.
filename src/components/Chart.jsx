import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  CrosshairMode,
} from "lightweight-charts";

export default function Chart({ symbol, timeframe }) {
  const chartContainerRef = useRef(null);

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

    const basePrices = {
      NVDA: 211.5,
      AMD: 168.22,
      TSLA: 251.44,
      PLTR: 42.7,
    };

    const now = Math.floor(Date.now() / 1000);
    let price = basePrices[symbol] || 100;
    const data = [];

    for (let i = 0; i < 100; i++) {
      const open = price;
      const close = open + (Math.random() - 0.5) * 4;
      const high = Math.max(open, close) + Math.random() * 2;
      const low = Math.min(open, close) - Math.random() * 2;

      data.push({
        time: now - (100 - i) * 60,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
      });

      price = close;
    }

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