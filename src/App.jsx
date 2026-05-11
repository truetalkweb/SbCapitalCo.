import { useEffect, useRef, useState } from "react";
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
  const [searchSymbol, setSearchSymbol] = useState("");
  const [liveStocks, setLiveStocks] = useState(() =>
    loadSetting("sb_watchlist", defaultStocks)
  );
  const [timeframe, setTimeframe] = useState(() =>
    loadSetting("sb_timeframe", "15m")
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

  const selectedStockData =
    liveStocks.find((s) => s.symbol === selectedStock) ||
    fmpGainers.find((s) => s.symbol === selectedStock) ||
    fmpLosers.find((s) => s.symbol === selectedStock) ||
    fmpActive.find((s) => s.symbol === selectedStock) ||
    cryptoStocks.find((s) => s.symbol === selectedStock) ||
    forexStocks.find((s) => s.symbol === selectedStock) ||
    smallCapMovers.find((s) => s.symbol === selectedStock) ||
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

  const [level2, setLevel2] = useState([
    { marketMaker: "ARCA", bid: 211.45, ask: 211.55, size: 500 },
    { marketMaker: "NASDAQ", bid: 211.4, ask: 211.6, size: 1200 },
    { marketMaker: "BATS", bid: 211.35, ask: 211.65, size: 850 },
    { marketMaker: "IEX", bid: 211.3, ask: 211.7, size: 620 },
  ]);

  function panelStyle(extra = {}) {
    return {
      background: theme.panel,
      border: `1px solid ${theme.border}`,
      color: theme.text,
      borderRadius: "8px",
      padding: "12px",
      overflow: "auto",
      minHeight: 0,
      ...extra,
    };
  }

  function panelTitle(title) {
    return (
      <div
        style={{
          fontSize: "14px",
          fontWeight: 800,
          borderBottom: `1px solid ${theme.border}`,
          paddingBottom: "8px",
          marginBottom: "10px",
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
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  });

  const timeframeButtonStyle = (item) => ({
    width: "42px",
    height: "34px",
    padding: 0,
    background: timeframe === item ? theme.blue : theme.panel2,
    border: `1px solid ${theme.border}`,
    color: timeframe === item ? "#ffffff" : theme.text,
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 800,
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
    localStorage.removeItem("sb_selected_stock");
    localStorage.removeItem("sb_timeframe");
    localStorage.removeItem("sb_theme_mode");
    localStorage.removeItem("sb_show_ema9");
    localStorage.removeItem("sb_show_ema20");
    localStorage.removeItem("sb_scanner_tab");
    localStorage.removeItem("sb_watchlist");
    localStorage.removeItem("sb_orders");

    setSelectedStock("NVDA");
    setTimeframe("15m");
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
  }, [selectedStock]);

  useEffect(() => {
    localStorage.setItem("sb_timeframe", JSON.stringify(timeframe));
  }, [timeframe]);

  useEffect(() => {
    localStorage.setItem("sb_theme_mode", JSON.stringify(themeMode));
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem("sb_show_ema9", JSON.stringify(showEMA9));
  }, [showEMA9]);

  useEffect(() => {
    localStorage.setItem("sb_show_ema20", JSON.stringify(showEMA20));
  }, [showEMA20]);

  useEffect(() => {
    localStorage.setItem("sb_scanner_tab", JSON.stringify(scannerTab));
  }, [scannerTab]);

  useEffect(() => {
    localStorage.setItem("sb_watchlist", JSON.stringify(liveStocks));
  }, [liveStocks]);

  useEffect(() => {
    localStorage.setItem("sb_orders", JSON.stringify(orders));
  }, [orders]);

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

        const gainersData = await gainersRes.json();
        const losersData = await losersRes.json();
        const activeData = await activeRes.json();

        setFmpGainers(formatFmpStocks(gainersData));
        setFmpLosers(formatFmpStocks(losersData));
        setFmpActive(formatFmpStocks(activeData));
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
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveStocks((prev) =>
        prev.map((stock) => {
          const oldPrice = Number(stock.price);
          const move = (Math.random() - 0.5) * 0.45;
          const newPrice = Math.max(oldPrice + move, 1);
          const changePercent = (((newPrice - oldPrice) / oldPrice) * 100).toFixed(2);

          return {
            ...stock,
            price: newPrice.toFixed(2),
            change: `${changePercent >= 0 ? "+" : ""}${changePercent}%`,
          };
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

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

  function ScannerTable({ rows }) {
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
            onClick={() => setSelectedStock(stock.symbol)}
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
          height: "44px",
          background: theme.panel,
          borderBottom: `1px solid ${theme.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: "12px",
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

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px" }}>
            Data: <span style={{ color: theme.green, fontWeight: 800 }}>LIVE/SIM</span>
          </span>

          <button
            onClick={() => setThemeMode(isDark ? "light" : "dark")}
            style={buttonStyle(false)}
          >
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
          gridTemplateColumns: "270px minmax(620px, 1fr) 320px",
          gridTemplateRows: "minmax(560px, 1fr) 260px",
          gap: "8px",
          padding: "8px",
          height: "calc(100vh - 70px)",
        }}
      >
        <div style={{ ...panelStyle(), gridColumn: "1 / 2", gridRow: "1 / 2" }}>
          {panelTitle("Watchlist + Scanner")}

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

        <div style={{ ...panelStyle(), gridColumn: "1 / 2", gridRow: "2 / 3" }}>
          {panelTitle("Small Cap Top Movers")}
          <ScannerTable rows={smallCapMovers} />
        </div>

        <div
          style={{
            ...panelStyle(),
            gridColumn: "2 / 3",
            gridRow: "1 / 2",
            overflow: "hidden",
          }}
        >
          {panelTitle("Main Chart")}

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

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: `1px solid ${theme.border}`,
              borderBottom: `1px solid ${theme.border}`,
              padding: "10px 0",
              marginBottom: "10px",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "28px" }}>{selectedStock}</h2>
              <span style={{ color: theme.green, fontWeight: 800 }}>● LIVE/SIM</span>
              <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                <span>${selectedStockData?.price}</span>
                <span
                  style={{
                    color: selectedStockData?.change.includes("+")
                      ? theme.green
                      : theme.red,
                  }}
                >
                  {selectedStockData?.change}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {["1m", "5m", "15m", "1H", "1D"].map((item) => (
                <button
                  key={item}
                  onClick={() => setTimeframe(item)}
                  style={timeframeButtonStyle(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div ref={chartAreaRef} style={{ height: "calc(100% - 145px)" }}>
            <Chart
              symbol={selectedStock}
              timeframe={timeframe}
              livePrice={Number(selectedStockData?.price)}
              showEMA9={showEMA9}
              showEMA20={showEMA20}
            />
          </div>
        </div>

        <div style={{ ...panelStyle(), gridColumn: "2 / 3", gridRow: "2 / 3" }}>
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

        <div style={{ ...panelStyle(), gridColumn: "3 / 4", gridRow: "1 / 2" }}>
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
            <button
              onClick={() => placeOrder("BUY")}
              style={{ ...buttonStyle(true), background: theme.green, border: "none" }}
            >
              BUY
            </button>

            <button
              onClick={() => placeOrder("SELL")}
              style={{ ...buttonStyle(true), background: theme.red, border: "none" }}
            >
              SELL
            </button>
          </div>

          <h3 style={{ marginTop: "18px" }}>Level 1</h3>

          <div style={{ fontSize: "13px", lineHeight: "1.9" }}>
            <div>Last: ${selectedStockData?.price}</div>
            <div>
              Change:{" "}
              <span
                style={{
                  color: selectedStockData?.change.includes("+")
                    ? theme.green
                    : theme.red,
                }}
              >
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

        <div style={{ ...panelStyle(), gridColumn: "3 / 4", gridRow: "2 / 3" }}>
          {panelTitle("Recent Paper Orders")}

          {orders.length === 0 ? (
            <p style={{ color: theme.muted, fontSize: "12px" }}>
              No paper trades yet.
            </p>
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
                <div
                  style={{
                    color: order.side === "BUY" ? theme.green : theme.red,
                    fontWeight: 900,
                  }}
                >
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
        <span>Symbol: {selectedStock}</span>
        <span>Timeframe: {timeframe}</span>
        <span>Real Scanner Data</span>
        <span>Paper Trading Only</span>
      </div>
    </div>
  );
}