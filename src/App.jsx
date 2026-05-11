import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "./components/Chart";

const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;
const FMP_API_KEY = import.meta.env.VITE_FMP_API_KEY;

const defaultStocks = [
  { symbol: "NVDA", price: 211.5, change: "+0.00%", volume: "6.25M" },
  { symbol: "AMD", price: 168.22, change: "+0.00%", volume: "2.46M" },
  { symbol: "TSLA", price: 251.44, change: "+0.00%", volume: "8.94M" },
  { symbol: "PLTR", price: 42.7, change: "+0.00%", volume: "4.33M" },
];

const cryptoStocks = [
  { symbol: "BTC-USD", price: 80739.85, change: "+0.69%", volume: "12.4B" },
  { symbol: "ETH-USD", price: 2331.05, change: "+1.03%", volume: "8.1B" },
  { symbol: "SOL-USD", price: 182.44, change: "+2.51%", volume: "2.8B" },
];

const forexStocks = [
  { symbol: "EUR/USD", price: 1.1785, change: "+0.52%", volume: "-" },
  { symbol: "GBP/USD", price: 1.3632, change: "+0.61%", volume: "-" },
  { symbol: "USD/CAD", price: 1.3722, change: "-0.22%", volume: "-" },
];

const smallCapMovers = [
  { symbol: "RNZA", price: 12.07, change: "+27.10%", volume: "44.84K" },
  { symbol: "REBN", price: 2.0, change: "+8.60%", volume: "84.17K" },
  { symbol: "DTI", price: 4.01, change: "+4.60%", volume: "333.03K" },
  { symbol: "PTL", price: 4.0, change: "+2.45%", volume: "314.15K" },
];

function loadSetting(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function formatFmpStocks(data) {
  if (!Array.isArray(data)) return [];

  return data.slice(0, 20).map((item) => ({
    symbol: item.symbol,
    price: Number(item.price || 0).toFixed(2),
    change: item.changesPercentage
      ? `${Number(item.changesPercentage).toFixed(2)}%`
      : "+0.00%",
    volume: item.volume ? String(item.volume) : "—",
  }));
}

export default function App() {
  const [selectedStock, setSelectedStock] = useState(() =>
    loadSetting("sb_selected_stock", "NVDA")
  );
  const [secondarySymbol, setSecondarySymbol] = useState(() =>
    loadSetting("sb_secondary_symbol", "TSLA")
  );
  const [searchSymbol, setSearchSymbol] = useState("");
  const [liveStocks, setLiveStocks] = useState(() =>
    loadSetting("sb_watchlist", defaultStocks)
  );
  const [timeframe, setTimeframe] = useState(() =>
    loadSetting("sb_timeframe", "15m")
  );
  const [secondaryTimeframe, setSecondaryTimeframe] = useState(() =>
    loadSetting("sb_secondary_timeframe", "5m")
  );
  const [layoutMode, setLayoutMode] = useState(() =>
    loadSetting("sb_layout_mode", "2")
  );
  const [quantity, setQuantity] = useState(10);
  const [orders, setOrders] = useState(() => loadSetting("sb_orders", []));
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);
  const [showEMA9, setShowEMA9] = useState(() =>
    loadSetting("sb_show_ema9", true)
  );
  const [showEMA20, setShowEMA20] = useState(() =>
    loadSetting("sb_show_ema20", true)
  );
  const [scannerTab, setScannerTab] = useState(() =>
    loadSetting("sb_scanner_tab", "Gainers")
  );
  const [themeMode, setThemeMode] = useState(() =>
    loadSetting("sb_theme_mode", "dark")
  );

  const [fmpGainers, setFmpGainers] = useState([]);
  const [fmpLosers, setFmpLosers] = useState([]);
  const [fmpActive, setFmpActive] = useState([]);
  const [scannerLoading, setScannerLoading] = useState(false);

  const [level2, setLevel2] = useState([
    { marketMaker: "ARCA", bid: 211.45, ask: 211.55, size: 500 },
    { marketMaker: "NASDAQ", bid: 211.4, ask: 211.6, size: 1200 },
    { marketMaker: "BATS", bid: 211.35, ask: 211.65, size: 850 },
    { marketMaker: "IEX", bid: 211.3, ask: 211.7, size: 620 },
  ]);

  const socketRef = useRef(null);
  const subscribedSymbolsRef = useRef(new Set());
  const chartAreaRef = useRef(null);

  const isDark = themeMode === "dark";

  const theme = {
    bg: isDark ? "#07111f" : "#eef3f8",
    panel: isDark ? "#111827" : "#ffffff",
    panel2: isDark ? "#0b1220" : "#f7f9fc",
    border: isDark ? "#233044" : "#d7dde8",
    text: isDark ? "#d1d4dc" : "#1d2733",
    muted: isDark ? "#7a8599" : "#697386",
    blue: "#2196f3",
    green: "#00c896",
    red: "#ef5350",
  };

  const allSymbols = useMemo(
    () => [
      ...liveStocks,
      ...fmpGainers,
      ...fmpLosers,
      ...fmpActive,
      ...cryptoStocks,
      ...forexStocks,
      ...smallCapMovers,
    ],
    [liveStocks, fmpGainers, fmpLosers, fmpActive]
  );

  const selectedStockData =
    allSymbols.find((s) => s.symbol === selectedStock) || liveStocks[0];

  const secondaryStockData =
    allSymbols.find((s) => s.symbol === secondarySymbol) ||
    allSymbols.find((s) => s.symbol === "TSLA") ||
    liveStocks[0];

  let scannerStocks = [...liveStocks];

  if (scannerTab === "Gainers") {
    scannerStocks = fmpGainers.length ? fmpGainers : [...liveStocks];
  }

  if (scannerTab === "Losers") {
    scannerStocks = fmpLosers.length ? fmpLosers : [...liveStocks];
  }

  if (scannerTab === "Active") {
    scannerStocks = fmpActive.length ? fmpActive : [...liveStocks];
  }

  if (scannerTab === "Crypto") scannerStocks = cryptoStocks;
  if (scannerTab === "Forex") scannerStocks = forexStocks;

  const estimatedValue = (
    Number(selectedStockData?.price || 0) * Number(quantity || 0)
  ).toFixed(2);

  function panelStyle(extra = {}) {
    return {
      background: theme.panel,
      border: `1px solid ${theme.border}`,
      color: theme.text,
      borderRadius: "10px",
      padding: "12px",
      overflow: "auto",
      minHeight: 0,
      boxShadow: isDark ? "0 0 18px rgba(0,0,0,0.18)" : "0 4px 14px rgba(0,0,0,0.06)",
      ...extra,
    };
  }

  function panelTitle(title) {
    return (
      <div
        style={{
          fontSize: "13px",
          fontWeight: 900,
          borderBottom: `1px solid ${theme.border}`,
          paddingBottom: "8px",
          marginBottom: "10px",
          letterSpacing: "0.2px",
        }}
      >
        {title}
      </div>
    );
  }

  const buttonStyle = (active = false) => ({
    height: "30px",
    padding: "0 10px",
    background: active ? theme.blue : theme.panel2,
    border: `1px solid ${theme.border}`,
    color: active ? "#ffffff" : theme.text,
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  });

  const timeframeButtonStyle = (active = false) => ({
    width: "42px",
    height: "32px",
    padding: 0,
    background: active ? theme.blue : theme.panel2,
    border: `1px solid ${theme.border}`,
    color: active ? "#ffffff" : theme.text,
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 900,
  });

  function subscribeToSymbol(symbol) {
    if (!socketRef.current) return;
    if (subscribedSymbolsRef.current.has(symbol)) return;

    socketRef.current.send(JSON.stringify({ type: "subscribe", symbol }));
    subscribedSymbolsRef.current.add(symbol);
  }

  function addSymbol() {
    const cleanSymbol = searchSymbol.trim().toUpperCase();
    if (!cleanSymbol) return;

    const exists = liveStocks.some((stock) => stock.symbol === cleanSymbol);

    if (!exists) {
      setLiveStocks((prev) => [
        ...prev,
        { symbol: cleanSymbol, price: 100, change: "+0.00%", volume: "1.00M" },
      ]);
    }

    setSelectedStock(cleanSymbol);
    subscribeToSymbol(cleanSymbol);
    setSearchSymbol("");
  }

  function resetWorkspace() {
    [
      "sb_selected_stock",
      "sb_secondary_symbol",
      "sb_timeframe",
      "sb_secondary_timeframe",
      "sb_layout_mode",
      "sb_theme_mode",
      "sb_show_ema9",
      "sb_show_ema20",
      "sb_scanner_tab",
      "sb_watchlist",
      "sb_orders",
    ].forEach((key) => localStorage.removeItem(key));

    setSelectedStock("NVDA");
    setSecondarySymbol("TSLA");
    setTimeframe("15m");
    setSecondaryTimeframe("5m");
    setLayoutMode("2");
    setThemeMode("dark");
    setShowEMA9(true);
    setShowEMA20(true);
    setScannerTab("Gainers");
    setLiveStocks(defaultStocks);
    setOrders([]);
  }

  function placeOrder(side) {
    const order = {
      id: Date.now(),
      side,
      symbol: selectedStock,
      quantity,
      price: selectedStockData?.price,
      value: estimatedValue,
      time: new Date().toLocaleTimeString(),
    };

    setOrders((prev) => [order, ...prev.slice(0, 12)]);
  }

  function toggleFullscreen() {
    if (!chartAreaRef.current) return;

    if (!document.fullscreenElement) {
      chartAreaRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  function takeScreenshot() {
    const canvas = chartAreaRef.current?.querySelector("canvas");
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `${selectedStock}-chart.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  useEffect(() => {
    localStorage.setItem("sb_selected_stock", JSON.stringify(selectedStock));
    localStorage.setItem("sb_secondary_symbol", JSON.stringify(secondarySymbol));
    localStorage.setItem("sb_timeframe", JSON.stringify(timeframe));
    localStorage.setItem("sb_secondary_timeframe", JSON.stringify(secondaryTimeframe));
    localStorage.setItem("sb_layout_mode", JSON.stringify(layoutMode));
    localStorage.setItem("sb_theme_mode", JSON.stringify(themeMode));
    localStorage.setItem("sb_show_ema9", JSON.stringify(showEMA9));
    localStorage.setItem("sb_show_ema20", JSON.stringify(showEMA20));
    localStorage.setItem("sb_scanner_tab", JSON.stringify(scannerTab));
    localStorage.setItem("sb_watchlist", JSON.stringify(liveStocks));
    localStorage.setItem("sb_orders", JSON.stringify(orders));
  }, [
    selectedStock,
    secondarySymbol,
    timeframe,
    secondaryTimeframe,
    layoutMode,
    themeMode,
    showEMA9,
    showEMA20,
    scannerTab,
    liveStocks,
    orders,
  ]);

  useEffect(() => {
    async function fetchFmpScanners() {
      if (!FMP_API_KEY) return;

      setScannerLoading(true);

      try {
        const [gainersRes, losersRes, activeRes] = await Promise.all([
          fetch(`https://financialmodelingprep.com/stable/biggest-gainers?apikey=${FMP_API_KEY}`),
          fetch(`https://financialmodelingprep.com/stable/biggest-losers?apikey=${FMP_API_KEY}`),
          fetch(`https://financialmodelingprep.com/stable/actively-trading-list?apikey=${FMP_API_KEY}`),
        ]);

        setFmpGainers(formatFmpStocks(await gainersRes.json()));
        setFmpLosers(formatFmpStocks(await losersRes.json()));
        setFmpActive(formatFmpStocks(await activeRes.json()));
      } catch {
        setFmpGainers([]);
        setFmpLosers([]);
        setFmpActive([]);
      }

      setScannerLoading(false);
    }

    fetchFmpScanners();
    const interval = setInterval(fetchFmpScanners, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!FINNHUB_API_KEY) return;

    const socket = new WebSocket(`wss://ws.finnhub.io?token=${FINNHUB_API_KEY}`);
    socketRef.current = socket;

    socket.onopen = () => {
      liveStocks.forEach((stock) => subscribeToSymbol(stock.symbol));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "trade" && message.data) {
        message.data.forEach((trade) => {
          setLiveStocks((prev) =>
            prev.map((stock) => {
              if (stock.symbol !== trade.s) return stock;

              const oldPrice = Number(stock.price);
              const newPrice = Number(trade.p);

              const changePercent =
                oldPrice > 0
                  ? (((newPrice - oldPrice) / oldPrice) * 100).toFixed(2)
                  : "0.00";

              return {
                ...stock,
                price: newPrice.toFixed(2),
                change: `${changePercent >= 0 ? "+" : ""}${changePercent}%`,
              };
            })
          );
        });
      }
    };

    return () => socket.close();
  }, [liveStocks]);

  useEffect(() => {
    async function fetchNews() {
      if (!FINNHUB_API_KEY) return;

      setNewsLoading(true);

      try {
        const today = new Date();
        const fromDate = new Date();
        fromDate.setDate(today.getDate() - 14);

        const to = today.toISOString().split("T")[0];
        const from = fromDate.toISOString().split("T")[0];

        const response = await fetch(
          `https://finnhub.io/api/v1/company-news?symbol=${selectedStock}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`
        );

        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          setNews(
            data.slice(0, 12).map((item) => ({
              id: item.id || item.datetime,
              time: new Date(item.datetime * 1000).toLocaleTimeString(),
              source: item.source || "Market News",
              text: item.headline,
              url: item.url,
            }))
          );
        } else {
          setNews([
            {
              id: 1,
              time: new Date().toLocaleTimeString(),
              source: "SbCapitalCo.",
              text: `${selectedStock} remains active as traders watch momentum levels.`,
              url: "https://finnhub.io/",
            },
          ]);
        }
      } catch {
        setNews([
          {
            id: 1,
            time: new Date().toLocaleTimeString(),
            source: "SbCapitalCo.",
            text: `Unable to load live news for ${selectedStock}.`,
            url: "https://finnhub.io/",
          },
        ]);
      }

      setNewsLoading(false);
    }

    fetchNews();
  }, [selectedStock]);

  useEffect(() => {
    const interval = setInterval(() => {
      const basePrice = Number(selectedStockData?.price || 100);

      setLevel2([
        {
          marketMaker: "ARCA",
          bid: (basePrice - 0.05).toFixed(2),
          ask: (basePrice + 0.05).toFixed(2),
          size: Math.floor(Math.random() * 2000) + 100,
        },
        {
          marketMaker: "NASDAQ",
          bid: (basePrice - 0.1).toFixed(2),
          ask: (basePrice + 0.1).toFixed(2),
          size: Math.floor(Math.random() * 2000) + 100,
        },
        {
          marketMaker: "BATS",
          bid: (basePrice - 0.15).toFixed(2),
          ask: (basePrice + 0.15).toFixed(2),
          size: Math.floor(Math.random() * 2000) + 100,
        },
        {
          marketMaker: "IEX",
          bid: (basePrice - 0.2).toFixed(2),
          ask: (basePrice + 0.2).toFixed(2),
          size: Math.floor(Math.random() * 2000) + 100,
        },
      ]);
    }, 1500);

    return () => clearInterval(interval);
  }, [selectedStockData]);

  function ScannerTable({ rows, onPick = setSelectedStock }) {
    return (
      <>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            fontSize: "11px",
            color: theme.muted,
            paddingBottom: "7px",
            borderBottom: `1px solid ${theme.border}`,
            fontWeight: 700,
          }}
        >
          <span>Symbol</span>
          <span>Price</span>
          <span style={{ textAlign: "right" }}>Change</span>
        </div>

        {rows.map((stock) => (
          <div
            key={stock.symbol}
            onClick={() => onPick(stock.symbol)}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "6px",
              padding: "8px 0",
              borderBottom: `1px solid ${theme.border}`,
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            <span style={{ fontWeight: 800 }}>{stock.symbol}</span>
            <span>${stock.price}</span>
            <span
              style={{
                color: stock.change.includes("+") ? theme.green : theme.red,
                textAlign: "right",
              }}
            >
              {stock.change}
            </span>
          </div>
        ))}
      </>
    );
  }

  function renderChartPanel({
    title,
    symbol,
    setSymbol,
    tf,
    setTf,
    livePrice,
    secondary = false,
  }) {
    return (
      <div
        style={{
          ...panelStyle(),
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <div
          style={{
            borderBottom: `1px solid ${theme.border}`,
            paddingBottom: "8px",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: "12px", color: theme.muted }}>{title}</div>
              <div style={{ fontSize: secondary ? "20px" : "24px", fontWeight: 900 }}>
                {symbol}
              </div>
              <span style={{ color: secondary ? theme.blue : theme.green, fontWeight: 800, fontSize: "12px" }}>
                ● {secondary ? "SECONDARY" : "LIVE/SIM"}
              </span>
            </div>

            {secondary && (
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                style={{
                  width: "90px",
                  height: "32px",
                  padding: "0 8px",
                  background: theme.panel2,
                  border: `1px solid ${theme.border}`,
                  color: theme.text,
                  borderRadius: "4px",
                  fontWeight: 800,
                }}
              />
            )}

            <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
              {["1m", "5m", "15m", "1H", "1D"].map((item) => (
                <button
                  key={item}
                  onClick={() => setTf(item)}
                  style={timeframeButtonStyle(tf === item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!secondary && (
          <div
            style={{
              display: "flex",
              gap: "7px",
              marginBottom: "10px",
              flexWrap: "wrap",
              position: "relative",
            }}
          >
            <button style={buttonStyle(false)}>Crosshair</button>
            <button style={buttonStyle(false)} onClick={() => setShowIndicators(!showIndicators)}>
              Indicators
            </button>
            <button style={buttonStyle(false)}>Draw</button>
            <button style={buttonStyle(false)} onClick={takeScreenshot}>
              Screenshot
            </button>
            <button style={buttonStyle(false)} onClick={toggleFullscreen}>
              Fullscreen
            </button>
            <button style={buttonStyle(false)}>Settings</button>

            {showIndicators && (
              <div
                style={{
                  position: "absolute",
                  top: "38px",
                  left: "78px",
                  background: theme.panel,
                  border: `1px solid ${theme.border}`,
                  borderRadius: "6px",
                  padding: "10px",
                  zIndex: 20,
                  width: "150px",
                }}
              >
                <label style={{ display: "block", marginBottom: "8px" }}>
                  <input
                    type="checkbox"
                    checked={showEMA9}
                    onChange={() => setShowEMA9(!showEMA9)}
                  />{" "}
                  EMA 9
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={showEMA20}
                    onChange={() => setShowEMA20(!showEMA20)}
                  />{" "}
                  EMA 20
                </label>
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
          }}
        >
          <Chart
            symbol={symbol}
            timeframe={tf}
            livePrice={Number(livePrice || 100)}
            showEMA9={showEMA9}
            showEMA20={showEMA20}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        color: theme.text,
        overflow: "auto",
      }}
    >
      <div
        style={{
          height: "46px",
          background: theme.panel,
          borderBottom: `1px solid ${theme.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: "10px",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: "18px" }}>
          SbCapital<span style={{ color: theme.blue }}>Co.</span>
        </div>

        <span style={{ color: theme.muted, fontSize: "12px" }}>
          Pro Trading Workspace
        </span>

        <button onClick={() => setLayoutMode("1")} style={buttonStyle(layoutMode === "1")}>
          1 Chart
        </button>

        <button onClick={() => setLayoutMode("2")} style={buttonStyle(layoutMode === "2")}>
          2 Charts
        </button>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px" }}>
            Data: <span style={{ color: theme.green, fontWeight: 800 }}>Finnhub + FMP</span>
          </span>

          <button onClick={() => setThemeMode(isDark ? "light" : "dark")} style={buttonStyle(false)}>
            {isDark ? "Light Mode" : "Dark Mode"}
          </button>

          <button onClick={resetWorkspace} style={buttonStyle(false)}>
            Reset
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px minmax(760px, 1fr) 330px",
          gap: "10px",
          padding: "10px",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: "10px" }}>
          <div style={panelStyle({ height: "640px" })}>
            {panelTitle("Watchlist + Real Scanner")}

            <input
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") addSymbol();
              }}
              placeholder="AAPL, MSFT, SPY..."
              style={{
                width: "100%",
                padding: "9px",
                background: theme.panel2,
                border: `1px solid ${theme.border}`,
                color: theme.text,
                borderRadius: "4px",
                marginBottom: "8px",
              }}
            />

            <button onClick={addSymbol} style={{ ...buttonStyle(true), width: "100%" }}>
              Add Symbol
            </button>

            <h3 style={{ marginTop: "14px" }}>Watchlist</h3>

            {liveStocks.map((stock) => (
              <div
                key={stock.symbol}
                onClick={() => setSelectedStock(stock.symbol)}
                style={{
                  padding: "9px 0",
                  borderBottom: `1px solid ${theme.border}`,
                  cursor: "pointer",
                  color: selectedStock === stock.symbol ? theme.blue : theme.text,
                  fontWeight: selectedStock === stock.symbol ? 900 : 500,
                }}
              >
                {stock.symbol}
              </div>
            ))}

            <h3 style={{ marginTop: "16px" }}>
              Scanner {scannerLoading ? "Loading..." : ""}
            </h3>

            <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
              {["Gainers", "Losers", "Active", "Crypto", "Forex"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setScannerTab(tab)}
                  style={buttonStyle(scannerTab === tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            <ScannerTable rows={scannerStocks} />
          </div>

          <div style={panelStyle({ height: "250px" })}>
            {panelTitle("Small Cap Top Movers")}
            <ScannerTable rows={smallCapMovers} />
          </div>
        </div>

        <div style={{ display: "grid", gap: "10px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: layoutMode === "2" ? "1fr 1fr" : "1fr",
              gap: "10px",
              height: "650px",
            }}
          >
            {renderChartPanel({
              title: "Main Chart",
              symbol: selectedStock,
              setSymbol: setSelectedStock,
              tf: timeframe,
              setTf: setTimeframe,
              livePrice: selectedStockData?.price,
            })}

            {layoutMode === "2" &&
              renderChartPanel({
                title: "Secondary Chart",
                symbol: secondarySymbol,
                setSymbol: setSecondarySymbol,
                tf: secondaryTimeframe,
                setTf: setSecondaryTimeframe,
                livePrice: secondaryStockData?.price,
                secondary: true,
              })}
          </div>

          <div style={panelStyle({ height: "250px" })}>
            {panelTitle("Market News")}

            {newsLoading ? (
              <p>Loading...</p>
            ) : (
              news.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block",
                    color: theme.text,
                    textDecoration: "none",
                    borderBottom: `1px solid ${theme.border}`,
                    padding: "8px 0",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ color: theme.muted, fontSize: "10px" }}>
                    {item.time} · {item.source}
                  </div>
                  <div>{item.text}</div>
                </a>
              ))
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: "10px" }}>
          <div style={panelStyle({ height: "640px" })}>
            {panelTitle("Paper Trade + Level 1/2")}

            <div style={{ fontSize: "13px", lineHeight: "1.8" }}>
              <div>Buying Power: $100,000.00</div>
              <div>Active Symbol: {selectedStock}</div>
              <div>Current Price: ${selectedStockData?.price}</div>
              <div>Total Orders: {orders.length}</div>
            </div>

            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={{
                width: "100%",
                padding: "9px",
                background: theme.panel2,
                border: `1px solid ${theme.border}`,
                color: theme.text,
                borderRadius: "4px",
                marginTop: "10px",
                marginBottom: "8px",
              }}
            />

            <div style={{ marginBottom: "8px", fontSize: "12px" }}>
              Estimated: ${estimatedValue}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button onClick={() => placeOrder("BUY")} style={{ ...buttonStyle(true), background: theme.green, border: "none" }}>
                BUY
              </button>

              <button onClick={() => placeOrder("SELL")} style={{ ...buttonStyle(true), background: theme.red, border: "none" }}>
                SELL
              </button>
            </div>

            <h3 style={{ marginTop: "18px" }}>Level 1</h3>

            <div style={{ fontSize: "13px", lineHeight: "1.9" }}>
              <div>Last: ${selectedStockData?.price}</div>
              <div>
                Change:{" "}
                <span style={{ color: selectedStockData?.change.includes("+") ? theme.green : theme.red }}>
                  {selectedStockData?.change}
                </span>
              </div>
              <div>Volume: {selectedStockData?.volume || "2.89M"}</div>
              <div>Bid: ${(Number(selectedStockData?.price) - 0.05).toFixed(2)}</div>
              <div>Ask: ${(Number(selectedStockData?.price) + 0.05).toFixed(2)}</div>
            </div>

            <h3 style={{ marginTop: "14px" }}>Level 2</h3>

            {level2.map((row, index) => (
              <div
                key={index}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  padding: "7px 0",
                  borderBottom: `1px solid ${theme.border}`,
                  fontSize: "12px",
                }}
              >
                <span>{row.marketMaker}</span>
                <span style={{ color: theme.green }}>{row.bid}</span>
                <span style={{ color: theme.red }}>{row.ask}</span>
                <span>{row.size}</span>
              </div>
            ))}
          </div>

          <div style={panelStyle({ height: "250px" })}>
            {panelTitle("Recent Paper Orders")}

            {orders.length === 0 ? (
              <p style={{ color: theme.muted, fontSize: "12px" }}>No paper trades yet.</p>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    borderBottom: `1px solid ${theme.border}`,
                    padding: "8px 0",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ color: order.side === "BUY" ? theme.green : theme.red, fontWeight: 900 }}>
                    {order.side} {order.symbol}
                  </div>
                  <div>Qty: {order.quantity}</div>
                  <div>Value: ${order.value}</div>
                  <div style={{ color: theme.muted }}>{order.time}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          height: "26px",
          background: theme.panel,
          borderTop: `1px solid ${theme.border}`,
          color: theme.muted,
          fontSize: "11px",
          display: "flex",
          alignItems: "center",
          gap: "18px",
          padding: "0 12px",
        }}
      >
        <span>Connected: Finnhub + FMP</span>
        <span>Main: {selectedStock}</span>
        <span>Secondary: {secondarySymbol}</span>
        <span>Layout: {layoutMode} Chart</span>
        <span>Paper Trading Only</span>
      </div>
    </div>
  );
}