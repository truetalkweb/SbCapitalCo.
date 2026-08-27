/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CandlestickSeries, HistogramSeries, createChart } from "lightweight-charts";

import PremiumWorkspace from "/src/components/premium/PremiumWorkspace.jsx";
import { premiumWorkspaceViews } from "/src/config/premiumNavigation.js";
import { canUseWorkspace } from "/src/services/entitlementPolicy.js";

const theme = {
  mode: "dark",
  isDark: true,
  bg: "#040507",
  panel: "#0a0e15",
  panel2: "#0f141d",
  panel3: "#141b27",
  card: "#0b1018",
  border: "#242c38",
  borderSoft: "#182130",
  text: "#e7ecf3",
  muted: "#8a95a8",
  faint: "#5f6b7e",
  blue: "#2d8cff",
  cyan: "#19c6d8",
  green: "#00c896",
  red: "#ef5350",
  amber: "#f5b84b",
};

const stocks = [
  { symbol: "NVDA", name: "NVIDIA", price: 216.79, open: 212.2, dayHigh: 218.1, dayLow: 211.8, changePercent: 2.29, gapPercent: 1.1, volume: 68000000, averageVolume: 48000000, relativeVolume: 2.4, float: 24100000000, sector: "Technology", catalyst: "AI demand and premarket participation", scannerScore: 78, risk: "Elevated" },
  { symbol: "AAPL", name: "Apple", price: 214.2, open: 211.8, dayHigh: 215.1, dayLow: 210.9, changePercent: 1.18, gapPercent: 0.7, volume: 55200000, averageVolume: 46000000, relativeVolume: 1.8, float: 15800000000, sector: "Technology", catalyst: "Analyst upgrade ahead of earnings", scannerScore: 69, risk: "Controlled" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", price: 532.48, open: 531.1, dayHigh: 533.2, dayLow: 530.8, changePercent: 0.24, gapPercent: 0.1, volume: 62700000, averageVolume: 66000000, relativeVolume: 0.9, float: null, sector: "ETF", catalyst: "Broad market context", scannerScore: 52, risk: "Controlled" },
  { symbol: "TSLA", name: "Tesla", price: 186.32, open: 188.1, dayHigh: 189.4, dayLow: 185.5, changePercent: -0.58, gapPercent: -0.4, volume: 85400000, averageVolume: 71000000, relativeVolume: 1.6, float: 3200000000, sector: "Consumer", catalyst: "News-linked volatility", scannerScore: 61, risk: "Elevated" },
];

const news = [
  { id: "n1", symbol: "NVDA", relatedTicker: "NVDA", headline: "Nvidia extends AI infrastructure partnership", source: "Market News", timestamp: "2026-08-05T16:00:00.000Z", summary: "Demand remains firm across accelerator infrastructure.", url: "https://example.com/nvda", category: "Stocks" },
  { id: "n2", symbol: "AAPL", relatedTicker: "AAPL", headline: "Apple receives analyst upgrade before earnings", source: "Market News", timestamp: "2026-08-05T15:45:00.000Z", summary: "The analyst raised the price target on services demand.", url: "https://example.com/aapl", category: "Earnings" },
  { id: "n3", symbol: "SPY", relatedTicker: "SPY", headline: "Fed rate outlook moves broad indexes", source: "Market News", timestamp: "2026-08-05T15:30:00.000Z", summary: "Rates and economic data are driving the session.", url: "https://example.com/market", category: "Macro" },
];

const candles = [
  { time: "2026-07-29", open: 202, high: 207, low: 200, close: 205, volume: 32000000 },
  { time: "2026-07-30", open: 205, high: 210, low: 203, close: 208, volume: 41000000 },
  { time: "2026-07-31", open: 208, high: 211, low: 206, close: 207, volume: 36000000 },
  { time: "2026-08-01", open: 207, high: 214, low: 206, close: 212, volume: 52000000 },
  { time: "2026-08-04", open: 212, high: 218, low: 211, close: 216.79, volume: 68000000 },
];

function ReleaseChartFixture() {
  const hostRef = useRef(null);

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const chart = createChart(hostRef.current, {
      autoSize: true,
      layout: { background: { color: theme.bg }, textColor: theme.muted },
      grid: { vertLines: { color: theme.borderSoft }, horzLines: { color: theme.borderSoft } },
      rightPriceScale: { borderColor: theme.border },
      timeScale: { borderColor: theme.border },
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: theme.green,
      downColor: theme.red,
      wickUpColor: theme.green,
      wickDownColor: theme.red,
      borderVisible: false,
    });
    candleSeries.setData(candles.map((candle) => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    })));
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volumeSeries.setData(candles.map((candle) => ({ time: candle.time, value: candle.volume, color: candle.close >= candle.open ? "#00c89666" : "#ef535066" })));
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, []);

  return <div ref={hostRef} data-testid="release-chart" aria-label="Release gate market chart" style={{ width: "100%", height: "100%", minHeight: 280 }} />;
}

function AccessProbe({ plan }) {
  const allowed = premiumWorkspaceViews.filter((view) => canUseWorkspace({ plan }, view.id));
  return (
    <nav data-testid="access-probe" data-plan={plan} aria-label={`${plan} workspace access`} style={{ position: "fixed", left: -10000, top: 0 }}>
      {allowed.map((view) => <span key={view.id} data-workspace={view.id}>{view.label}</span>)}
    </nav>
  );
}

function Harness() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const requested = params.get("view") || "dashboard";
  const plan = params.get("plan") || "admin";
  const [activeWorkspace, setActiveWorkspace] = useState(requested);
  const [selectedStock, setSelectedStock] = useState("NVDA");
  const [quantity, setQuantity] = useState(10);
  const [scannerTab, setScannerTab] = useState("Gainers");
  const [timeframe, setTimeframe] = useState("1m");
  const [orderMessage, setOrderMessage] = useState("");
  const [premiumPreferences, setPremiumPreferences] = useState({ compactMode: false, scannerAutoRefresh: true, notificationPreferences: {} });
  const selectedStockData = stocks.find((row) => row.symbol === selectedStock) || stocks[0];

  return (
    <main data-testid="release-workspace" data-workspace={activeWorkspace} style={{ height: "100%", padding: 12, color: theme.text, overflow: "auto" }}>
      <AccessProbe plan={plan} />
      <output data-testid="order-message" style={{ position: "fixed", left: -10000 }}>{orderMessage}</output>
      <PremiumWorkspace
        activeWorkspace={activeWorkspace}
        setActiveWorkspace={setActiveWorkspace}
        viewportWidth={window.innerWidth}
        viewportHeight={window.innerHeight}
        theme={theme}
        renderChartGrid={() => <ReleaseChartFixture />}
        selectedStock={selectedStock}
        selectedStockData={selectedStockData}
        liveStocks={stocks}
        scannerStocks={stocks}
        scannerGroups={{
          gainers: stocks.filter((row) => row.changePercent > 0),
          losers: stocks.filter((row) => row.changePercent < 0),
          active: stocks,
          momentum: stocks,
          relativeVolume: stocks,
        }}
        scannerMeta={{ source: "Release fixture", degraded: false }}
        news={news}
        newsMeta={{ source: "Release fixture", degraded: false }}
        marketIndexes={stocks}
        alerts={[{ id: "a1", symbol: "NVDA", trigger: 220, direction: "above", active: true, createdAt: "2026-08-05T16:00:00.000Z" }]}
        orders={[{ id: "o1", symbol: "NVDA", side: "BUY", type: "LIMIT", quantity: 10, limitPrice: 215, status: "FILLED", filled: 10, remaining: 0, tif: "DAY" }, { id: "o2", symbol: "TSLA", side: "SELL", type: "LIMIT", quantity: 5, limitPrice: 188, status: "WORKING", filled: 0, remaining: 5, tif: "DAY" }]}
        positions={{ NVDA: { quantity: 10, average: 210 }, AAPL: { quantity: 5, average: 208 } }}
        allSymbols={stocks}
        accountSummary={{ buyingPower: 25000, netLiquidation: 102000 }}
        realizedPnL={320}
        totalUnrealizedPnL={125}
        quantity={quantity}
        setQuantity={setQuantity}
        setOrderSide={() => {}}
        setOrderConfirmed={() => {}}
        orderMessage={orderMessage}
        setOrderMessage={setOrderMessage}
        selectMainSymbol={(symbol) => setSelectedStock(symbol)}
        addSymbolToWatchlist={() => {}}
        removeWatchlistSymbol={() => {}}
        scannerTab={scannerTab}
        setScannerTab={setScannerTab}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        chartIndicators={{ ema9: true, ema20: true, vwap: false, volume: true }}
        setChartIndicators={() => {}}
        themeMode="dark"
        setThemeMode={() => {}}
        premiumPreferences={premiumPreferences}
        setPremiumPreferences={setPremiumPreferences}
        user={{ id: "release-user", email: "release@example.com" }}
        cloudStatus="Workspace up to date"
        cloudSyncPresentation={{ label: "Synced", tone: "good" }}
        saveWorkspaceToCloud={() => Promise.resolve(true)}
        loadWorkspaceFromCloud={() => Promise.resolve(true)}
        exportWorkspaceBackup={() => setOrderMessage("Workspace backup exported")}
        importWorkspaceBackup={() => Promise.resolve({ fieldCount: 3 })}
        exportDailyReport={() => setOrderMessage("Daily report exported")}
        exportWeeklyReport={() => setOrderMessage("Weekly report exported")}
        exportTradeSummaryCsv={() => setOrderMessage("Trade summary exported")}
        exportJournalCsv={() => setOrderMessage("Journal CSV exported")}
        journalEntries={[]}
        replayTrades={[]}
        replayStats={{}}
        journalDraft={{ setup: "", symbol: "NVDA" }}
        setJournalDraft={() => {}}
        entitlements={{ plan, status: "active", capabilities: {} }}
      />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
