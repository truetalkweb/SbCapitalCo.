import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "./components/Chart";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

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
  const [user, setUser] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authMessage, setAuthMessage] = useState("");
  const [cloudStatus, setCloudStatus] = useState("Local workspace");

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
  const [positions, setPositions] = useState(() =>
    loadSetting("sb_positions", {})
  );
  const [realizedPnL, setRealizedPnL] = useState(() =>
    loadSetting("sb_realized_pnl", 0)
  );

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

  const [alerts, setAlerts] = useState(() => loadSetting("sb_alerts", []));
  const [alertInput, setAlertInput] = useState("");
  const [syncCharts, setSyncCharts] = useState(() =>
    loadSetting("sb_sync_charts", false)
  );

  const [mainChartStatus, setMainChartStatus] = useState("LOADING");
  const [secondaryChartStatus, setSecondaryChartStatus] = useState("LOADING");

  const [replayMode, setReplayMode] = useState(false);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [replayIndex, setReplayIndex] = useState(80);
  const [mainReplayData, setMainReplayData] = useState([]);
  const [replayTrades, setReplayTrades] = useState([]);
  const [replayEquity, setReplayEquity] = useState([100000]);

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

  const totalUnrealizedPnL = Object.entries(positions).reduce(
    (total, [symbol, pos]) => {
      const live = Number(allSymbols.find((s) => s.symbol === symbol)?.price || 0);
      return total + (live - pos.average) * pos.quantity;
    },
    0
  );

  const basePrice = Number(selectedStockData?.price || 100);

  const ladderRows = useMemo(() => {
    return Array.from({ length: 15 }, (_, index) => {
      const offset = 7 - index;
      const price = basePrice + offset * 0.05;
      const bidSize = offset <= 0 ? Math.floor(Math.random() * 900) + 100 : 0;
      const askSize = offset >= 0 ? Math.floor(Math.random() * 900) + 100 : 0;
      const maxSize = 1000;

      return {
        price: price.toFixed(2),
        bidSize,
        askSize,
        bidWidth: `${Math.min(100, (bidSize / maxSize) * 100)}%`,
        askWidth: `${Math.min(100, (askSize / maxSize) * 100)}%`,
        isLast: Math.abs(price - basePrice) < 0.03,
      };
    });
  }, [basePrice, level2]);

  const replayStats = useMemo(() => {
    const closedTrades = replayTrades.filter((trade) => trade.type === "SELL");
    const winners = closedTrades.filter((trade) => Number(trade.pnl) > 0);
    const losers = closedTrades.filter((trade) => Number(trade.pnl) < 0);
    const netPnL = closedTrades.reduce((total, trade) => total + Number(trade.pnl || 0), 0);
    const winRate = closedTrades.length
      ? ((winners.length / closedTrades.length) * 100).toFixed(1)
      : "0.0";

    const avgWin = winners.length
      ? winners.reduce((total, trade) => total + Number(trade.pnl), 0) / winners.length
      : 0;

    const avgLoss = losers.length
      ? losers.reduce((total, trade) => total + Number(trade.pnl), 0) / losers.length
      : 0;

    return {
      totalTrades: closedTrades.length,
      winners: winners.length,
      losers: losers.length,
      netPnL,
      winRate,
      avgWin,
      avgLoss,
      equity: replayEquity[replayEquity.length - 1] || 100000,
    };
  }, [replayTrades, replayEquity]);

  const workspacePayload = useMemo(
    () => ({
      selectedStock,
      secondarySymbol,
      liveStocks,
      timeframe,
      secondaryTimeframe,
      layoutMode,
      quantity,
      orders,
      positions,
      realizedPnL,
      alerts,
      syncCharts,
      themeMode,
      showEMA9,
      showEMA20,
      scannerTab,
      replayMode,
      replaySpeed,
      replayIndex,
      replayTrades,
      replayEquity,
    }),
    [
      selectedStock,
      secondarySymbol,
      liveStocks,
      timeframe,
      secondaryTimeframe,
      layoutMode,
      quantity,
      orders,
      positions,
      realizedPnL,
      alerts,
      syncCharts,
      themeMode,
      showEMA9,
      showEMA20,
      scannerTab,
      replayMode,
      replaySpeed,
      replayIndex,
      replayTrades,
      replayEquity,
    ]
  );

  function applyWorkspace(data) {
    if (!data) return;
    if (data.selectedStock) setSelectedStock(data.selectedStock);
    if (data.secondarySymbol) setSecondarySymbol(data.secondarySymbol);
    if (Array.isArray(data.liveStocks)) setLiveStocks(data.liveStocks);
    if (data.timeframe) setTimeframe(data.timeframe);
    if (data.secondaryTimeframe) setSecondaryTimeframe(data.secondaryTimeframe);
    if (data.layoutMode) setLayoutMode(data.layoutMode);
    if (data.quantity) setQuantity(data.quantity);
    if (Array.isArray(data.orders)) setOrders(data.orders);
    if (data.positions) setPositions(data.positions);
    if (typeof data.realizedPnL === "number") setRealizedPnL(data.realizedPnL);
    if (Array.isArray(data.alerts)) setAlerts(data.alerts);
    if (typeof data.syncCharts === "boolean") setSyncCharts(data.syncCharts);
    if (data.themeMode) setThemeMode(data.themeMode);
    if (typeof data.showEMA9 === "boolean") setShowEMA9(data.showEMA9);
    if (typeof data.showEMA20 === "boolean") setShowEMA20(data.showEMA20);
    if (data.scannerTab) setScannerTab(data.scannerTab);
    if (typeof data.replayMode === "boolean") setReplayMode(data.replayMode);
    if (data.replaySpeed) setReplaySpeed(data.replaySpeed);
    if (typeof data.replayIndex === "number") setReplayIndex(data.replayIndex);
    if (Array.isArray(data.replayTrades)) setReplayTrades(data.replayTrades);
    if (Array.isArray(data.replayEquity)) setReplayEquity(data.replayEquity);
  }

  async function handleAuthSubmit(mode = authMode) {
    setAuthMessage("");

    try {
      if (!authEmail || !authPassword) {
        setAuthMessage("Enter email and password.");
        return;
      }

      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        setAuthMessage("Account created.");
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
        setAuthMessage("Signed in.");
      }

      setAuthPassword("");
    } catch (error) {
      setAuthMessage(error.message || "Authentication failed.");
    }
  }

  async function saveWorkspaceToCloud() {
    if (!user) {
      setCloudStatus("Sign in to save cloud workspace");
      return;
    }

    try {
      await setDoc(doc(db, "workspaces", user.uid), {
        ...workspacePayload,
        updatedAt: serverTimestamp(),
        owner: user.uid,
      });

      setCloudStatus(`Cloud saved ${new Date().toLocaleTimeString()}`);
    } catch {
      setCloudStatus("Cloud save failed");
    }
  }

  async function loadWorkspaceFromCloud() {
    if (!user) {
      setCloudStatus("Sign in to load cloud workspace");
      return;
    }

    try {
      const snapshot = await getDoc(doc(db, "workspaces", user.uid));

      if (!snapshot.exists()) {
        setCloudStatus("No cloud workspace found");
        return;
      }

      applyWorkspace(snapshot.data());
      setCloudStatus(`Cloud loaded ${new Date().toLocaleTimeString()}`);
    } catch {
      setCloudStatus("Cloud load failed");
    }
  }

  async function handleLogout() {
    await signOut(auth);
    setCloudStatus("Local workspace");
  }

  const replayCandle = mainReplayData[replayIndex] || null;

  function panelStyle(extra = {}) {
    return {
      background: theme.panel,
      border: `1px solid ${theme.border}`,
      color: theme.text,
      borderRadius: "6px",
      padding: "6px",
      overflow: "hidden",
      minHeight: 0,
      boxShadow: isDark
        ? "0 0 0 1px rgba(255,255,255,0.02)"
        : "0 1px 8px rgba(0,0,0,0.04)",
      ...extra,
    };
  }

  function panelTitle(title) {
    return (
      <div
        style={{
          fontSize: "12px",
          fontWeight: 900,
          borderBottom: `1px solid ${theme.border}`,
          paddingBottom: "6px",
          marginBottom: "6px",
          letterSpacing: "0.2px",
        }}
      >
        {title}
      </div>
    );
  }

  const buttonStyle = (active = false) => ({
    height: "28px",
    padding: "0 9px",
    background: active ? theme.blue : theme.panel2,
    border: `1px solid ${theme.border}`,
    color: active ? "#ffffff" : theme.text,
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  });

  const timeframeButtonStyle = (active = false) => ({
    width: "40px",
    height: "28px",
    padding: 0,
    background: active ? theme.blue : theme.panel2,
    border: `1px solid ${theme.border}`,
    color: active ? "#ffffff" : theme.text,
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "11px",
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
    if (syncCharts) setSecondarySymbol(cleanSymbol);
    subscribeToSymbol(cleanSymbol);
    setSearchSymbol("");
  }

  function selectMainSymbol(symbol) {
    setSelectedStock(symbol);
    if (syncCharts) setSecondarySymbol(symbol);
  }

  function setMainTimeframe(value) {
    setTimeframe(value);
    if (syncCharts) setSecondaryTimeframe(value);
  }

  function addPriceAlert() {
    const trigger = Number(alertInput);

    if (!trigger || trigger <= 0) return;

    const nextAlert = {
      id: Date.now(),
      symbol: selectedStock,
      trigger,
      direction: trigger >= Number(selectedStockData?.price || 0) ? "above" : "below",
      active: true,
      createdAt: new Date().toLocaleTimeString(),
    };

    setAlerts((prev) => [nextAlert, ...prev.slice(0, 8)]);
    setAlertInput("");
  }

  function removeAlert(id) {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  }

  function stepReplay() {
    setReplayIndex((prev) => {
      if (!mainReplayData.length) return prev;
      return Math.min(prev + 1, mainReplayData.length - 1);
    });
  }

  function replayBuy() {
    const candle = mainReplayData[replayIndex];
    if (!candle) return;

    const price = Number(candle.close);
    const qty = Number(quantity) || 1;

    setReplayTrades((prev) => [
      ...prev,
      {
        id: Date.now(),
        type: "BUY",
        symbol: selectedStock,
        qty,
        price,
        time: candle.time,
      },
    ]);
  }

  function replaySell() {
    const candle = mainReplayData[replayIndex];
    if (!candle) return;

    const price = Number(candle.close);
    const qty = Number(quantity) || 1;

    const lastOpenBuy = [...replayTrades]
      .reverse()
      .find((trade) => trade.type === "BUY" && !trade.closed);

    const pnl = lastOpenBuy ? (price - lastOpenBuy.price) * qty : 0;
    const nextEquity = (replayEquity[replayEquity.length - 1] || 100000) + pnl;

    setReplayTrades((prev) =>
      prev
        .map((trade) =>
          trade.id === lastOpenBuy?.id ? { ...trade, closed: true } : trade
        )
        .concat({
          id: Date.now(),
          type: "SELL",
          symbol: selectedStock,
          qty,
          price,
          pnl,
          time: candle.time,
        })
    );

    setReplayEquity((prev) => [...prev, nextEquity]);
  }

  function resetReplay() {
    setReplayPlaying(false);
    setReplayIndex(80);
    setReplayTrades([]);
    setReplayEquity([100000]);
    setOrders([]);
    setPositions({});
    setRealizedPnL(0);
    setAlerts([]);
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
      "sb_positions",
      "sb_realized_pnl",
      "sb_alerts",
      "sb_sync_charts",
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
    setPositions({});
    setRealizedPnL(0);
  }

  function placeOrder(side) {
    const currentPrice = Number(selectedStockData?.price || 0);
    const qty = Number(quantity);

    if (!qty || qty <= 0 || !currentPrice) return;

    const existing = positions[selectedStock] || {
      quantity: 0,
      average: 0,
    };

    let updatedPositions = { ...positions };
    let updatedRealized = Number(realizedPnL || 0);

    if (side === "BUY") {
      const totalCost = existing.average * existing.quantity + currentPrice * qty;
      const newQty = existing.quantity + qty;

      updatedPositions[selectedStock] = {
        quantity: newQty,
        average: totalCost / newQty,
      };
    }

    if (side === "SELL") {
      const sellQty = Math.min(qty, existing.quantity);

      if (sellQty <= 0) return;

      const pnl = (currentPrice - existing.average) * sellQty;
      updatedRealized += pnl;

      const remaining = existing.quantity - sellQty;

      if (remaining <= 0) {
        delete updatedPositions[selectedStock];
      } else {
        updatedPositions[selectedStock] = {
          ...existing,
          quantity: remaining,
        };
      }
    }

    setPositions(updatedPositions);
    setRealizedPnL(updatedRealized);

    const order = {
      id: Date.now(),
      side,
      symbol: selectedStock,
      quantity: qty,
      price: currentPrice.toFixed(2),
      value: (currentPrice * qty).toFixed(2),
      realizedPnL:
        side === "SELL"
          ? ((currentPrice - existing.average) * Math.min(qty, existing.quantity)).toFixed(2)
          : null,
      time: new Date().toLocaleTimeString(),
    };

    setOrders((prev) => [order, ...prev.slice(0, 20)]);
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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setCloudStatus("Local workspace");
        return;
      }

      setCloudStatus(`Signed in: ${currentUser.email}`);

      try {
        const snapshot = await getDoc(doc(db, "workspaces", currentUser.uid));

        if (snapshot.exists()) {
          applyWorkspace(snapshot.data());
          setCloudStatus(`Cloud loaded ${new Date().toLocaleTimeString()}`);
        }
      } catch {
        setCloudStatus("Signed in · cloud load skipped");
      }
    });

    return () => unsubscribe();
  }, []);

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
    localStorage.setItem("sb_positions", JSON.stringify(positions));
    localStorage.setItem("sb_realized_pnl", JSON.stringify(realizedPnL));
    localStorage.setItem("sb_alerts", JSON.stringify(alerts));
    localStorage.setItem("sb_sync_charts", JSON.stringify(syncCharts));
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
    positions,
    realizedPnL,
    alerts,
    syncCharts,
  ]);

  useEffect(() => {
    function handleHotkeys(event) {
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        placeOrder("BUY");
      }

      if (event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        placeOrder("SELL");
      }

      if (event.shiftKey && event.key === "1") {
        event.preventDefault();
        setLayoutMode("1");
      }

      if (event.shiftKey && event.key === "2") {
        event.preventDefault();
        setLayoutMode("2");
      }

      if (event.key === "Escape") {
        setShowIndicators(false);
      }
    }

    window.addEventListener("keydown", handleHotkeys);

    return () => window.removeEventListener("keydown", handleHotkeys);
  }, [quantity, selectedStock, selectedStockData, positions, realizedPnL]);

  useEffect(() => {
    if (!replayMode || !replayPlaying) return;

    const interval = setInterval(() => {
      setReplayIndex((prev) => {
        if (!mainReplayData.length) return prev;

        if (prev >= mainReplayData.length - 1) {
          setReplayPlaying(false);
          return prev;
        }

        return prev + 1;
      });
    }, Math.max(120, 900 / replaySpeed));

    return () => clearInterval(interval);
  }, [replayMode, replayPlaying, replaySpeed, mainReplayData.length]);

  useEffect(() => {
    setAlerts((prev) =>
      prev.map((alert) => {
        if (!alert.active || alert.symbol !== selectedStock) return alert;

        const price = Number(selectedStockData?.price || 0);
        const triggered =
          alert.direction === "above"
            ? price >= alert.trigger
            : price <= alert.trigger;

        if (!triggered) return alert;

        return {
          ...alert,
          active: false,
          triggeredAt: new Date().toLocaleTimeString(),
        };
      })
    );
  }, [selectedStockData, selectedStock]);

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
      defaultStocks.forEach((stock) => subscribeToSymbol(stock.symbol));
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

  function ScannerTable({ rows, onPick = selectMainSymbol }) {
    return (
      <>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            fontSize: "10px",
            color: theme.muted,
            paddingBottom: "6px",
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
              padding: "4px 0",
              borderBottom: `1px solid ${theme.border}`,
              cursor: "pointer",
              fontSize: "11px",
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
    chartStatus = "LOADING",
    onStatusChange,
  }) {
    return (
      <div
        style={{
          ...panelStyle({
            padding: "0px",
            background: "#050b14",
          }),
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: "6px 10px",
            marginBottom: "0px",
            background: theme.panel,
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: "10px", color: theme.muted }}>{title}</div>
              <div style={{ fontSize: secondary ? "16px" : "19px", fontWeight: 900 }}>
                {symbol}
              </div>
              <span
                style={{
                  color: secondary ? theme.blue : theme.green,
                  fontWeight: 800,
                  fontSize: "10px",
                }}
              >
                ● QUOTE LIVE · CHART {chartStatus}
              </span>
            </div>

            {secondary && (
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                style={{
                  width: "82px",
                  height: "28px",
                  padding: "0 7px",
                  background: theme.panel2,
                  border: `1px solid ${theme.border}`,
                  color: theme.text,
                  borderRadius: "4px",
                  fontWeight: 800,
                }}
              />
            )}

            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
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
              gap: "5px",
              marginBottom: "0px",
              padding: "5px 8px",
              flexWrap: "wrap",
              position: "relative",
              background: theme.panel,
              borderBottom: `1px solid ${theme.border}`,
            }}
          >
            <button style={buttonStyle(false)}>Crosshair</button>
            <button
              style={buttonStyle(false)}
              onClick={() => setShowIndicators(!showIndicators)}
            >
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
                  top: "36px",
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
            background: "#050b14",
          }}
        >
          <Chart
            symbol={symbol}
            timeframe={tf}
            livePrice={Number(livePrice || 100)}
            showEMA9={showEMA9}
            showEMA20={showEMA20}
            onStatusChange={onStatusChange}
            replayMode={replayMode && !secondary}
            replayIndex={replayIndex}
            onReplayData={setMainReplayData}
            replayTrades={replayTrades}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        background: theme.bg,
        color: theme.text,
        overflow: "hidden",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          height: "42px",
          background: theme.panel,
          borderBottom: `1px solid ${theme.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          gap: "8px",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: "16px" }}>
          SbCapital<span style={{ color: theme.blue }}>Co.</span>
        </div>

        <span style={{ color: theme.muted, fontSize: "11px" }}>
          Pro TradingView-Style Workspace
        </span>

        <button onClick={() => setLayoutMode("1")} style={buttonStyle(layoutMode === "1")}>
          1 Chart
        </button>

        <button onClick={() => setLayoutMode("2")} style={buttonStyle(layoutMode === "2")}>
          2 Charts
        </button>

        <button onClick={() => setSyncCharts(!syncCharts)} style={buttonStyle(syncCharts)}>
          Sync {syncCharts ? "On" : "Off"}
        </button>

        <button onClick={() => setReplayMode(!replayMode)} style={buttonStyle(replayMode)}>
          Replay {replayMode ? "On" : "Off"}
        </button>

        <button onClick={resetReplay} style={buttonStyle(false)}>
          Reset Replay
        </button>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "7px" }}>
          <span style={{ fontSize: "11px" }}>
            Data: <span style={{ color: theme.green, fontWeight: 800 }}>Finnhub + FMP</span>
          </span>
          <span style={{ fontSize: "11px", color: theme.muted }}>
            Chart: {mainChartStatus}
          </span>

          <button onClick={() => setThemeMode(isDark ? "light" : "dark")} style={buttonStyle(false)}>
            {isDark ? "Light" : "Dark"}
          </button>

          <button onClick={saveWorkspaceToCloud} style={buttonStyle(Boolean(user))}>
            Cloud Save
          </button>

          <button onClick={loadWorkspaceFromCloud} style={buttonStyle(false)}>
            Cloud Load
          </button>

          <button onClick={resetWorkspace} style={buttonStyle(false)}>
            Reset
          </button>
        </div>
      </div>

      <div
        style={{
          height: "calc(100vh - 68px)",
          display: "grid",
          gridTemplateColumns:
            layoutMode === "2"
              ? "240px minmax(1200px, 1fr) 300px"
              : "240px minmax(1400px, 1fr) 300px",
          gap: "6px",
          padding: "6px",
          overflow: "hidden",
        }}
      >
        <div
          style={panelStyle({
            height: "100%",
            overflowY: "auto",
          })}
        >
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
              padding: "8px",
              background: theme.panel2,
              border: `1px solid ${theme.border}`,
              color: theme.text,
              borderRadius: "4px",
              marginBottom: "6px",
              fontSize: "11px",
            }}
          />

          <button onClick={addSymbol} style={{ ...buttonStyle(true), width: "100%" }}>
            Add Symbol
          </button>

          <h3 style={{ marginTop: "12px", fontSize: "13px" }}>Account + Cloud</h3>

          {user ? (
            <div style={{ fontSize: "10px", lineHeight: "1.5" }}>
              <div style={{ color: theme.green, fontWeight: 900 }}>Signed in</div>
              <div style={{ color: theme.muted, overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.email}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", marginTop: "6px" }}>
                <button onClick={saveWorkspaceToCloud} style={buttonStyle(true)}>
                  Save
                </button>
                <button onClick={loadWorkspaceFromCloud} style={buttonStyle(false)}>
                  Load
                </button>
              </div>

              <button
                onClick={handleLogout}
                style={{ ...buttonStyle(false), width: "100%", marginTop: "6px" }}
              >
                Logout
              </button>

              <div style={{ color: theme.muted, marginTop: "5px" }}>{cloudStatus}</div>
            </div>
          ) : (
            <div>
              <input
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="Email"
                style={{
                  width: "100%",
                  padding: "7px",
                  background: theme.panel2,
                  border: `1px solid ${theme.border}`,
                  color: theme.text,
                  borderRadius: "4px",
                  marginBottom: "5px",
                  fontSize: "11px",
                }}
              />

              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Password"
                style={{
                  width: "100%",
                  padding: "7px",
                  background: theme.panel2,
                  border: `1px solid ${theme.border}`,
                  color: theme.text,
                  borderRadius: "4px",
                  marginBottom: "5px",
                  fontSize: "11px",
                }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
                <button
                  onClick={() => {
                    setAuthMode("login");
                    handleAuthSubmit("login");
                  }}
                  style={buttonStyle(authMode === "login")}
                >
                  Login
                </button>

                <button
                  onClick={() => {
                    setAuthMode("signup");
                    handleAuthSubmit("signup");
                  }}
                  style={buttonStyle(authMode === "signup")}
                >
                  Sign Up
                </button>
              </div>

              <div style={{ color: theme.muted, fontSize: "10px", marginTop: "5px" }}>
                {authMessage || cloudStatus}
              </div>
            </div>
          )}

          <h3 style={{ marginTop: "12px", fontSize: "13px" }}>Watchlist</h3>

          {liveStocks.map((stock) => (
            <div
              key={stock.symbol}
              onClick={() => selectMainSymbol(stock.symbol)}
              style={{
                padding: "6px 0",
                borderBottom: `1px solid ${theme.border}`,
                cursor: "pointer",
                color: selectedStock === stock.symbol ? theme.blue : theme.text,
                fontWeight: selectedStock === stock.symbol ? 900 : 500,
                fontSize: "11px",
              }}
            >
              {stock.symbol}
            </div>
          ))}

          <h3 style={{ marginTop: "12px", fontSize: "13px" }}>
            Scanner {scannerLoading ? "Loading..." : ""}
          </h3>

          <div style={{ display: "flex", gap: "5px", marginBottom: "6px", flexWrap: "wrap" }}>
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

          <h3 style={{ marginTop: "12px", fontSize: "13px" }}>Small Cap Movers</h3>
          <ScannerTable rows={smallCapMovers} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateRows: "1fr 130px",
            gap: "6px",
            height: "100%",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: layoutMode === "2" ? "minmax(0, 1fr) minmax(0, 1fr)" : "1fr",
              gap: "6px",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            {renderChartPanel({
              title: "Main Chart",
              symbol: selectedStock,
              setSymbol: selectMainSymbol,
              tf: timeframe,
              setTf: setMainTimeframe,
              livePrice: selectedStockData?.price,
              chartStatus: mainChartStatus,
              onStatusChange: setMainChartStatus,
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
                chartStatus: secondaryChartStatus,
                onStatusChange: setSecondaryChartStatus,
              })}
          </div>

          <div
            style={panelStyle({
              height: "130px",
              overflowY: "auto",
            })}
          >
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
                    padding: "3px 0",
                    fontSize: "10px",
                    lineHeight: "1.3",
                  }}
                >
                  <div style={{ color: theme.muted, fontSize: "9px" }}>
                    {item.time} · {item.source}
                  </div>
                  <div>{item.text}</div>
                </a>
              ))
            )}
          </div>
        </div>

        <div
          style={panelStyle({
            height: "100%",
            overflowY: "auto",
          })}
        >
          {panelTitle("Paper Trade + Level 1/2")}

          <div style={{ fontSize: "11px", lineHeight: "1.65" }}>
            <div>Buying Power: $100,000.00</div>
            <div>Active Symbol: {selectedStock}</div>
            <div>Current Price: ${selectedStockData?.price}</div>
            <div>Total Orders: {orders.length}</div>
            <div>
              Realized P&L:{" "}
              <span style={{ color: realizedPnL >= 0 ? theme.green : theme.red, fontWeight: 900 }}>
                ${Number(realizedPnL).toFixed(2)}
              </span>
            </div>
            <div>
              Unrealized P&L:{" "}
              <span style={{ color: totalUnrealizedPnL >= 0 ? theme.green : theme.red, fontWeight: 900 }}>
                ${Number(totalUnrealizedPnL).toFixed(2)}
              </span>
            </div>
          </div>

          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              background: theme.panel2,
              border: `1px solid ${theme.border}`,
              color: theme.text,
              borderRadius: "4px",
              marginTop: "8px",
              marginBottom: "6px",
              fontSize: "11px",
            }}
          />

          <div style={{ marginBottom: "6px", fontSize: "11px" }}>
            Estimated: ${estimatedValue}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <button onClick={() => placeOrder("BUY")} style={{ ...buttonStyle(true), background: theme.green, border: "none" }}>
              BUY
            </button>

            <button onClick={() => placeOrder("SELL")} style={{ ...buttonStyle(true), background: theme.red, border: "none" }}>
              SELL
            </button>
          </div>

          <h3 style={{ marginTop: "12px", fontSize: "13px" }}>Replay + Backtest</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
            <button onClick={() => setReplayPlaying(!replayPlaying)} style={buttonStyle(replayPlaying)}>
              {replayPlaying ? "Pause" : "Play"}
            </button>
            <button onClick={stepReplay} style={buttonStyle(false)}>
              Step
            </button>
            <button onClick={resetReplay} style={buttonStyle(false)}>
              Reset
            </button>
          </div>

          <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
            {[1, 2, 5].map((speed) => (
              <button
                key={speed}
                onClick={() => setReplaySpeed(speed)}
                style={buttonStyle(replaySpeed === speed)}
              >
                {speed}x
              </button>
            ))}
            <button onClick={replayBuy} style={{ ...buttonStyle(true), background: theme.green, border: "none" }}>
              Replay Buy
            </button>
            <button onClick={replaySell} style={{ ...buttonStyle(true), background: theme.red, border: "none" }}>
              Replay Sell
            </button>
          </div>

          <div style={{ marginTop: "6px", fontSize: "10px", lineHeight: "1.55" }}>
            <div>Replay Candle: {mainReplayData.length ? `${Math.min(replayIndex + 1, mainReplayData.length)} / ${mainReplayData.length}` : "Loading"}</div>
            <div>Replay Price: ${replayCandle?.close ? Number(replayCandle.close).toFixed(2) : "—"}</div>
            <div>Equity: ${Number(replayStats.equity).toFixed(2)}</div>
            <div>Net P&L: <span style={{ color: replayStats.netPnL >= 0 ? theme.green : theme.red, fontWeight: 900 }}>${replayStats.netPnL.toFixed(2)}</span></div>
            <div>Trades: {replayStats.totalTrades} · Win Rate: {replayStats.winRate}%</div>
            <div>Winners: {replayStats.winners} · Losers: {replayStats.losers}</div>
            <div>Avg Win: ${replayStats.avgWin.toFixed(2)} · Avg Loss: ${replayStats.avgLoss.toFixed(2)}</div>
          </div>

          <h3 style={{ marginTop: "12px", fontSize: "13px" }}>Price Alerts</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 72px", gap: "6px" }}>
            <input
              type="number"
              value={alertInput}
              onChange={(e) => setAlertInput(e.target.value)}
              placeholder={`Alert @ ${selectedStockData?.price || ""}`}
              style={{
                width: "100%",
                padding: "7px",
                background: theme.panel2,
                border: `1px solid ${theme.border}`,
                color: theme.text,
                borderRadius: "4px",
                fontSize: "11px",
              }}
            />

            <button onClick={addPriceAlert} style={buttonStyle(true)}>
              Add
            </button>
          </div>

          {alerts.length === 0 ? (
            <div style={{ color: theme.muted, fontSize: "11px", marginTop: "6px" }}>
              No alerts set.
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "6px",
                  padding: "4px 0",
                  borderBottom: `1px solid ${theme.border}`,
                  fontSize: "10px",
                  color: alert.active ? theme.text : theme.muted,
                }}
              >
                <span>
                  {alert.symbol} {alert.direction} ${alert.trigger.toFixed(2)}{" "}
                  <b style={{ color: alert.active ? theme.green : theme.red }}>
                    {alert.active ? "ACTIVE" : "TRIGGERED"}
                  </b>
                </span>
                <button onClick={() => removeAlert(alert.id)} style={buttonStyle(false)}>
                  X
                </button>
              </div>
            ))
          )}

          <h3 style={{ marginTop: "12px", fontSize: "13px" }}>DOM Ladder + Depth Heatmap</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 70px 1fr",
              gap: "2px",
              fontSize: "10px",
              color: theme.muted,
              paddingBottom: "4px",
              borderBottom: `1px solid ${theme.border}`,
            }}
          >
            <span>Bid</span>
            <span style={{ textAlign: "center" }}>Price</span>
            <span style={{ textAlign: "right" }}>Ask</span>
          </div>

          {ladderRows.map((row) => (
            <div
              key={row.price}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 70px 1fr",
                gap: "2px",
                alignItems: "center",
                minHeight: "20px",
                fontSize: "10px",
                background: row.isLast ? "rgba(33,150,243,0.12)" : "transparent",
                borderBottom: `1px solid ${theme.border}`,
              }}
            >
              <div style={{ position: "relative", textAlign: "left", overflow: "hidden" }}>
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 2,
                    bottom: 2,
                    width: row.bidWidth,
                    background: "rgba(0,200,150,0.22)",
                  }}
                />
                <span style={{ position: "relative", color: theme.green }}>
                  {row.bidSize || ""}
                </span>
              </div>

              <div style={{ textAlign: "center", fontWeight: 900, color: row.isLast ? theme.blue : theme.text }}>
                {row.price}
              </div>

              <div style={{ position: "relative", textAlign: "right", overflow: "hidden" }}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 2,
                    bottom: 2,
                    width: row.askWidth,
                    background: "rgba(239,83,80,0.22)",
                  }}
                />
                <span style={{ position: "relative", color: theme.red }}>
                  {row.askSize || ""}
                </span>
              </div>
            </div>
          ))}

          <h3 style={{ marginTop: "12px", fontSize: "13px" }}>Open Positions</h3>

          {Object.keys(positions).length === 0 ? (
            <div style={{ color: theme.muted, fontSize: "11px" }}>
              No open positions
            </div>
          ) : (
            Object.entries(positions).map(([symbol, pos]) => {
              const live = Number(allSymbols.find((s) => s.symbol === symbol)?.price || 0);
              const unrealized = (live - pos.average) * pos.quantity;

              return (
                <div
                  key={symbol}
                  style={{
                    padding: "4px 0",
                    borderBottom: `1px solid ${theme.border}`,
                    fontSize: "11px",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{symbol}</div>
                  <div>Qty: {pos.quantity}</div>
                  <div>Avg: ${pos.average.toFixed(2)}</div>
                  <div>
                    Unrealized:{" "}
                    <span style={{ color: unrealized >= 0 ? theme.green : theme.red, fontWeight: 900 }}>
                      ${unrealized.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })
          )}

          <h3 style={{ marginTop: "12px", fontSize: "13px" }}>Level 1</h3>

          <div style={{ fontSize: "11px", lineHeight: "1.65" }}>
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

          <h3 style={{ marginTop: "12px", fontSize: "13px" }}>Level 2</h3>

          {level2.map((row, index) => (
            <div
              key={index}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                padding: "4px 0",
                borderBottom: `1px solid ${theme.border}`,
                fontSize: "11px",
              }}
            >
              <span>{row.marketMaker}</span>
              <span style={{ color: theme.green }}>{row.bid}</span>
              <span style={{ color: theme.red }}>{row.ask}</span>
              <span>{row.size}</span>
            </div>
          ))}

          <h3 style={{ marginTop: "12px", fontSize: "13px" }}>Recent Paper Orders</h3>

          {orders.length === 0 ? (
            <p style={{ color: theme.muted, fontSize: "11px" }}>No paper trades yet.</p>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                style={{
                  borderBottom: `1px solid ${theme.border}`,
                  padding: "4px 0",
                  fontSize: "11px",
                }}
              >
                <div style={{ color: order.side === "BUY" ? theme.green : theme.red, fontWeight: 900 }}>
                  {order.side} {order.symbol}
                </div>
                <div>Qty: {order.quantity}</div>
                <div>Price: ${order.price}</div>
                <div>Value: ${order.value}</div>
                {order.realizedPnL !== null && (
                  <div>
                    P&L:{" "}
                    <span style={{ color: Number(order.realizedPnL) >= 0 ? theme.green : theme.red, fontWeight: 900 }}>
                      ${order.realizedPnL}
                    </span>
                  </div>
                )}
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
          fontSize: "10px",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "0 10px",
        }}
      >
        <span>Connected: Finnhub + FMP</span>
        <span>Main: {selectedStock}</span>
        <span>Secondary: {secondarySymbol}</span>
        <span>Layout: {layoutMode} Chart</span>
        <span>Realized P&L: ${Number(realizedPnL).toFixed(2)}</span>
        <span>Paper Trading Only</span>
        <span>Hotkeys: Shift+B Buy · Shift+S Sell</span>
        <span>Chart Engine: Timeframe Aggregated</span>
        <span>Phase 3: Replay + Backtesting</span>
        <span>Cloud: {user ? user.email : "Local"}</span>
      </div>
    </div>
  );
}
