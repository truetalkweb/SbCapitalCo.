import { useEffect, useRef, useState } from "react";
import Chart from "./components/Chart";

const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

const defaultStocks = [
  { symbol: "NVDA", price: 211.5, change: "+0.00%" },
  { symbol: "AMD", price: 168.22, change: "+0.00%" },
  { symbol: "TSLA", price: 251.44, change: "+0.00%" },
  { symbol: "PLTR", price: 42.7, change: "+0.00%" },
];

export default function App() {
  const [selectedStock, setSelectedStock] = useState("NVDA");
  const [searchSymbol, setSearchSymbol] = useState("");
  const [liveStocks, setLiveStocks] = useState(defaultStocks);
  const [timeframe, setTimeframe] = useState("15m");
  const [quantity, setQuantity] = useState(10);
  const [orders, setOrders] = useState([]);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);

  const socketRef = useRef(null);
  const subscribedSymbolsRef = useRef(new Set());

  const selectedStockData =
    liveStocks.find((stock) => stock.symbol === selectedStock) || liveStocks[0];

  const estimatedValue = (
    Number(selectedStockData?.price || 0) * Number(quantity || 0)
  ).toFixed(2);

  const [level2, setLevel2] = useState([
    { marketMaker: "ARCA", bid: 211.45, ask: 211.55, size: 500 },
    { marketMaker: "NASDAQ", bid: 211.4, ask: 211.6, size: 1200 },
  ]);

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
        { symbol: cleanSymbol, price: 100, change: "+0.00%" },
      ]);
    }

    setSelectedStock(cleanSymbol);
    subscribeToSymbol(cleanSymbol);
    setSearchSymbol("");
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

    setOrders((prev) => [order, ...prev.slice(0, 9)]);
  }

  useEffect(() => {
    const savedStocks = localStorage.getItem("sb_watchlist");
    const savedOrders = localStorage.getItem("sb_orders");

    if (savedStocks) setLiveStocks(JSON.parse(savedStocks));
    if (savedOrders) setOrders(JSON.parse(savedOrders));
  }, []);

  useEffect(() => {
    localStorage.setItem("sb_watchlist", JSON.stringify(liveStocks));
  }, [liveStocks]);

  useEffect(() => {
    localStorage.setItem("sb_orders", JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    if (!FINNHUB_API_KEY) return;

    const socket = new WebSocket(
      `wss://ws.finnhub.io?token=${FINNHUB_API_KEY}`
    );

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

  // Fallback movement so the platform stays alive when market is closed or WebSocket is quiet.
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
    async function fetchRealNews() {
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
            data.slice(0, 8).map((item) => ({
              id: item.id || item.datetime,
              text: item.headline,
              source: item.source,
              url: item.url,
              time: new Date(item.datetime * 1000).toLocaleDateString(),
            }))
          );
        } else {
          setNews([
            {
              id: 1,
              time: "Fallback",
              source: "SbCapitalCo.",
              text: `${selectedStock} is on watch. No recent news available.`,
              url: null,
            },
          ]);
        }
      } catch {
        setNews([
          {
            id: 1,
            time: "Fallback",
            source: "SbCapitalCo.",
            text: `Unable to load news for ${selectedStock}.`,
            url: null,
          },
        ]);
      }

      setNewsLoading(false);
    }

    fetchRealNews();
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
      ]);
    }, 1500);

    return () => clearInterval(interval);
  }, [selectedStockData]);

  return (
    <div className="app">
      <div className="header">
        <div className="logo">
          SbCapital<span>Co.</span>
        </div>

       <div style={{ marginLeft: "auto", fontSize: "13px", color: "#787b86" }}>
  Data: <span className="green">LIVE/SIM ACTIVE</span>

    </div>
      </div>

      <div className="main">
        <div className="panel">
          <div className="box">
            <h3>Search Symbol</h3>

            <input
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") addSymbol();
              }}
              placeholder="AAPL, MSFT, SPY..."
              style={{
                width: "100%",
                padding: "10px",
                background: "#131722",
                border: "1px solid #2a2e39",
                color: "#d1d4dc",
                borderRadius: "4px",
                marginBottom: "10px",
              }}
            />

            <button
              onClick={addSymbol}
              style={{
                width: "100%",
                padding: "10px",
                background: "#2196f3",
                border: "none",
                color: "#ffffff",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Add Symbol
            </button>
          </div>

          <div className="box">
            <h3>Watchlist</h3>

            {liveStocks.map((stock) => (
              <div
                key={stock.symbol}
                onClick={() => setSelectedStock(stock.symbol)}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid #2a2e39",
                  cursor: "pointer",
                  color: selectedStock === stock.symbol ? "#2196f3" : "#d1d4dc",
                  fontWeight: selectedStock === stock.symbol ? "bold" : "normal",
                }}
              >
                {stock.symbol}
              </div>
            ))}
          </div>

          <div className="box">
            <h3>Top Movers Scanner</h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr",
                alignItems: "center",
                columnGap: "14px",
                fontSize: "12px",
                color: "#787b86",
                paddingBottom: "10px",
                borderBottom: "1px solid #2a2e39",
                marginBottom: "4px",
                fontWeight: "600",
                width: "100%",
              }}
            >
              <span>Symbol</span>
              <span>Price</span>
              <span style={{ textAlign: "right" }}>Change</span>
            </div>

            {[...liveStocks]
              .sort((a, b) => {
                const changeA = Number(a.change.replace("%", ""));
                const changeB = Number(b.change.replace("%", ""));
                return changeB - changeA;
              })
              .map((stock) => (
                <div
                  className="stock-row"
                  key={stock.symbol}
                  onClick={() => setSelectedStock(stock.symbol)}
                  style={{ cursor: "pointer" }}
                >
                  <span className="stock-symbol">{stock.symbol}</span>
                  <span className="stock-price">${stock.price}</span>
                  <span
                    className={`stock-change ${
                      stock.change.includes("+") ? "green" : "red"
                    }`}
                  >
                    {stock.change}
                  </span>
                </div>
              ))}
          </div>
        </div>

        <div className="chart">
          <div className="box">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
                borderBottom: "1px solid #2a2e39",
                paddingBottom: "10px",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <h2 style={{ margin: 0 }}>{selectedStock}</h2>
                  <span style={{ color: "#26a69a", fontWeight: "bold" }}>
                ● LIVE/SIM
                  </span>
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
                  <span>${selectedStockData?.price}</span>
                  <span
                    className={
                      selectedStockData?.change.includes("+") ? "green" : "red"
                    }
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
                    style={{
                      background: timeframe === item ? "#2196f3" : "#131722",
                      border: "1px solid #2a2e39",
                      color: timeframe === item ? "#ffffff" : "#d1d4dc",
                      padding: "7px 12px",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="box">
            <Chart
              symbol={selectedStock}
              timeframe={timeframe}
              livePrice={Number(selectedStockData?.price)}
            />
          </div>
        </div>

        <div className="right">
          <div className="box">
            <h3>Portfolio</h3>

            <div style={{ fontSize: "13px", lineHeight: "1.8" }}>
              <div>Buying Power: $100,000.00</div>
              <div>Total Orders: {orders.length}</div>
              <div>Active Symbol: {selectedStock}</div>
              <div>
                Mode: <span className="green">Paper Trading</span>
              </div>
            </div>
          </div>

          <div className="box">
            <h3>Order Ticket</h3>

            <div style={{ marginBottom: "12px", fontSize: "14px" }}>
              <div>Symbol: {selectedStock}</div>
              <div>Price: ${selectedStockData?.price}</div>
            </div>

            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                background: "#131722",
                border: "1px solid #2a2e39",
                color: "#d1d4dc",
                borderRadius: "4px",
                marginBottom: "10px",
              }}
            />

            <div style={{ marginBottom: "10px" }}>
              Estimated: ${estimatedValue}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
              }}
            >
              <button
                onClick={() => placeOrder("BUY")}
                style={{
                  padding: "10px",
                  background: "#26a69a",
                  border: "none",
                  color: "#ffffff",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                BUY
              </button>

              <button
                onClick={() => placeOrder("SELL")}
                style={{
                  padding: "10px",
                  background: "#ef5350",
                  border: "none",
                  color: "#ffffff",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                SELL
              </button>
            </div>
          </div>

          <div className="box">
            <h3>Recent Orders</h3>

            {orders.length === 0 ? (
              <p style={{ color: "#787b86", fontSize: "12px" }}>
                No paper trades yet.
              </p>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    borderBottom: "1px solid #2a2e39",
                    padding: "8px 0",
                    fontSize: "12px",
                  }}
                >
                  <div
                    style={{
                      color: order.side === "BUY" ? "#26a69a" : "#ef5350",
                      fontWeight: "bold",
                    }}
                  >
                    {order.side} {order.symbol}
                  </div>
                  <div>Qty: {order.quantity}</div>
                  <div>Value: ${order.value}</div>
                  <div style={{ color: "#787b86" }}>{order.time}</div>
                </div>
              ))
            )}
          </div>

          <div className="box">
            <h3>Market News</h3>

            {newsLoading ? (
              <p>Loading...</p>
            ) : (
              news.map((item) => (
                <div className="news-item" key={item.id}>
                  <span className="news-time">
                    {item.time} · {item.source}
                  </span>
                  <p>{item.text}</p>
                </div>
              ))
            )}
          </div>

          <div className="box">
            <h3>Level 2</h3>

            {level2.map((row, index) => (
              <div
                key={index}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  padding: "8px 0",
                  borderBottom: "1px solid #2a2e39",
                  fontSize: "13px",
                }}
              >
                <span>{row.marketMaker}</span>
                <span className="green">{row.bid}</span>
                <span className="red">{row.ask}</span>
                <span>{row.size}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="status-bar">
        <span>Connected: Finnhub</span>
        <span>Symbol: {selectedStock}</span>
        <span>Timeframe: {timeframe}</span>
        <span>Fallback Movement Active</span>
        <span>Paper Trading Only</span>
      </div>
    </div>
  );
}