import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Plus,
  Search,
  X,
} from "lucide-react";
import TickerTape from "./components/TickerTape";
import TerminalTopBar from "./components/TerminalTopBar";
import ProductionHealthStrip from "./components/ProductionHealthStrip";
import TerminalStatusBar from "./components/TerminalStatusBar";
import LeftSectionHeader from "./components/LeftSectionHeader";
import TradingSidebar from "./components/TradingSidebar";
import WorkspaceGrid from "./components/WorkspaceGrid";
import RightTradingPanel from "./components/RightTradingPanel";
import LoadingPanel from "./components/LoadingPanel";
import ScannerTable from "./components/ScannerTable";
import ChartPanel from "./components/ChartPanel";
import MarketNewsPanel from "./components/MarketNewsPanel";
import { createButtonStyle, createPanelStyle } from "./components/uiPrimitives";
import {
  BROKER_API_URL,
  defaultJournalDraft,
  defaultSmallCapMovers,
  layoutPresets,
  marketRegions,
  popularSymbols,
  rightPanelTabs,
  terminalMonoFont,
  workspaceViews,
} from "./config/terminalConfig";
import { useMarketData } from "./hooks/useMarketData";
import { useBrokerData } from "./hooks/useBrokerData";
import { useCloudWorkspace } from "./hooks/useCloudWorkspace";
import { useMarketNews } from "./hooks/useMarketNews";
import { useOrderRisk } from "./hooks/useOrderRisk";
import { useReplayEngine } from "./hooks/useReplayEngine";
import { useScannerData } from "./hooks/useScannerData";
import { useTerminalAlerts } from "./hooks/useTerminalAlerts";
import { useTerminalWorkspace } from "./hooks/useTerminalWorkspace";
import { useTerminalSymbols } from "./hooks/useTerminalSymbols";
import {
  applyLiveQuote,
  buildDataConfidence,
  buildTerminalSourceLabels,
  fetchWithTimeout,
} from "./utils/marketUtils";
import { getCleanProviderMessage, getQuestradeHealth } from "./utils/healthStatus";
import { loadSetting, removeSettings, saveSetting } from "./utils/storage";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

const ProfessionalScanner = lazy(() => import("./components/ProfessionalScanner"));
const BrokerHeader = lazy(() => import("./components/BrokerHeader"));
const BrokerPositions = lazy(() => import("./components/BrokerPositions"));
const OrderTicket = lazy(() => import("./components/OrderTicket"));
const ReplayPanel = lazy(() => import("./components/ReplayPanel"));
const AlertsPanel = lazy(() => import("./components/AlertsPanel"));
const DOMPanel = lazy(() => import("./components/DOMPanel"));
const PaperAccountPanel = lazy(() => import("./components/PaperAccountPanel"));
const OpenPositionsPanel = lazy(() => import("./components/OpenPositionsPanel"));
const RecentOrdersPanel = lazy(() => import("./components/RecentOrdersPanel"));
const JournalPanel = lazy(() => import("./components/JournalPanel"));
const CommandPalette = lazy(() => import("./components/CommandPalette"));
const RiskDashboard = lazy(() => import("./components/RiskDashboard"));
const ShortcutsPanel = lazy(() => import("./components/ShortcutsPanel"));
const ActivityLogPanel = lazy(() => import("./components/ActivityLogPanel"));
const ProductionHealthPanel = lazy(() => import("./components/ProductionHealthPanel"));
const MarketIntelligenceTerminal = lazy(() => import("./components/MarketIntelligenceTerminal"));

const coreRightTabs = new Set(["intel", "health", "alerts"]);
const advancedWorkspaceIds = new Set(["broker", "replay", "journal", "portfolio", "settings"]);

function getRequestedPresetId() {
  if (typeof window === "undefined") return null;

  try {
    const presetId = new URLSearchParams(window.location.search).get("preset");
    return layoutPresets[presetId] ? presetId : null;
  } catch {
    return null;
  }
}

function getRequestedMobileDockTab() {
  if (typeof window === "undefined") return null;

  try {
    const tabId = new URLSearchParams(window.location.search).get("mobileDock");
    return ["order", "broker", "risk", "replay", "activity", "health", "alerts"].includes(tabId) ? tabId : null;
  } catch {
    return null;
  }
}

export default function App() {
  const requestedPresetId = useMemo(() => getRequestedPresetId(), []);
  const requestedMobileDockTab = useMemo(() => getRequestedMobileDockTab(), []);
  const requestedPreset = requestedPresetId ? layoutPresets[requestedPresetId] : null;
  const {
    liveQuotes,
    wsStatus,
    updateLiveQuote: updateContextLiveQuote,
    subscribeToSymbols,
  } = useMarketData();

  const [timeframe, setTimeframe] = useState(() =>
    loadSetting("sb_timeframe", "15m")
  );
  const [secondaryTimeframe, setSecondaryTimeframe] = useState(() =>
    loadSetting("sb_secondary_timeframe", "5m")
  );
  const [quantity, setQuantity] = useState(10);
  const [orderSide, setOrderSide] = useState("BUY");
  const [orderType, setOrderType] = useState("MARKET");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [tradingMode, setTradingMode] = useState(() =>
    loadSetting("sb_trading_mode", "paper")
  );
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [maxOrderValue, setMaxOrderValue] = useState(() =>
    loadSetting("sb_max_order_value", 25000)
  );
  const [dailyLossLimit, setDailyLossLimit] = useState(() =>
    loadSetting("sb_daily_loss_limit", 500)
  );
  const [riskPerTrade, setRiskPerTrade] = useState(() =>
    loadSetting("sb_risk_per_trade", 250)
  );
  const [orders, setOrders] = useState(() => loadSetting("sb_orders", []));
  const [positions, setPositions] = useState(() =>
    loadSetting("sb_positions", {})
  );
  const [realizedPnL, setRealizedPnL] = useState(() =>
    loadSetting("sb_realized_pnl", 0)
  );

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
  const [marketRegion, setMarketRegion] = useState(() =>
    loadSetting("sb_market_region", "us")
  );

  const [journalEntries, setJournalEntries] = useState(() =>
    loadSetting("sb_journal_entries", [])
  );
  const [journalDraft, setJournalDraft] = useState(() =>
    loadSetting("sb_journal_draft", defaultJournalDraft)
  );
  const [activityLog, setActivityLog] = useState(() =>
    loadSetting("sb_activity_log", [])
  );
  const [advancedMode, setAdvancedMode] = useState(() =>
    loadSetting("sb_advanced_mode", false)
  );

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const [mainChartStatus, setMainChartStatus] = useState("LOADING");
  const [secondaryChartStatus, setSecondaryChartStatus] = useState("LOADING");

  const {
    mainReplayData,
    replayCandle,
    replayEquity,
    replayIndex,
    replayMode,
    replayPlaying,
    replaySell: replaySellState,
    replaySpeed,
    replayStats,
    replayTrades,
    replayBuy: replayBuyState,
    resetReplay: resetReplayState,
    setMainReplayData,
    setReplayEquity,
    setReplayIndex,
    setReplayMode,
    setReplayPlaying,
    setReplaySpeed,
    setReplayTrades,
    stepReplay,
  } = useReplayEngine({
    initialReplayMode: requestedPreset?.replayMode || false,
    quantity,
  });
  const {
    activeWorkspace,
    setActiveWorkspace,
    layoutMode,
    setLayoutMode,
    gridMode,
    setGridMode,
    syncCharts,
    setSyncCharts,
    leftSectionsOpen,
    rightTab,
    setRightTab,
    activePreset,
    setActivePreset,
    mobileDockOpen,
    setMobileDockOpen,
    applyLayoutPreset,
    applyWorkspaceLayout,
    resetWorkspaceLayout,
    toggleLeftSection,
    openMobileDockTab,
  } = useTerminalWorkspace({
    layoutPresets,
    requestedPreset,
    requestedPresetId,
    requestedMobileDockTab,
    setReplayMode,
    setReplayPlaying,
  });

  const {
    brokerStatus,
    brokerConnected,
    brokerDetails,
    brokerError,
    brokerAccounts,
    selectedBrokerAccount,
    setSelectedBrokerAccount,
    brokerPositions,
    brokerOrders,
    brokerLoading,
    liveOrderLoading,
    platformHealth,
    liveReadiness,
    liveOrderPreview,
    brokerSyncMeta,
    primaryBrokerBalance,
    lastHealthCheckedAt,
    loadBrokerAccountData,
    loadLiveReadiness,
    previewLiveOrder,
    submitLiveOrder,
    refreshBroker,
  } = useBrokerData(BROKER_API_URL);
  const [initialLivePulse] = useState(() => Date.now());
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth
  );

  const [level2, setLevel2] = useState([
    { marketMaker: "ARCA", bid: 211.45, ask: 211.55, size: 500 },
    { marketMaker: "NASDAQ", bid: 211.4, ask: 211.6, size: 1200 },
    { marketMaker: "BATS", bid: 211.35, ask: 211.65, size: 850 },
    { marketMaker: "IEX", bid: 211.3, ask: 211.7, size: 620 },
  ]);

  const chartAreaRef = useRef(null);
  const brokerBootstrappedRef = useRef(false);
  const activitySequenceRef = useRef(0);
  const lastBrokerSyncLoggedRef = useRef(null);
  const lastBrokerErrorLoggedRef = useRef("");

  const isDark = themeMode === "dark";
  const isCompactTerminal = viewportWidth <= 1180;
  const isPhoneTerminal = viewportWidth <= 700;

  const theme = {
    bg: isDark ? "#05070d" : "#eef3f8",
    panel: isDark ? "#0d121c" : "#ffffff",
    panel2: isDark ? "#111827" : "#f7f9fc",
    panel3: isDark ? "#151d2a" : "#eef3f8",
    border: isDark ? "#263142" : "#d7dde8",
    borderSoft: isDark ? "#1a2433" : "#e4e9f1",
    text: isDark ? "#e7ecf3" : "#1d2733",
    muted: isDark ? "#8a95a8" : "#697386",
    faint: isDark ? "#5f6b7e" : "#8a93a3",
    blue: "#2d8cff",
    cyan: "#19c6d8",
    green: "#00c896",
    red: "#ef5350",
    amber: "#f5b84b",
  };

  const pushActivity = useCallback((entry) => {
    const createdAt = new Date().toISOString();

    activitySequenceRef.current += 1;

    const nextEntry = {
      id: entry.id || `ACT-${Date.now()}-${activitySequenceRef.current}`,
      createdAt,
      type: entry.type || "system",
      status: entry.status || "info",
      title: entry.title || "Activity",
      detail: entry.detail || "Structured terminal activity recorded.",
      symbol: entry.symbol || null,
      meta: entry.meta || {},
    };

    setActivityLog((prev) => [nextEntry, ...prev].slice(0, 120));
  }, []);

  const clearActivityLog = useCallback(() => {
    setActivityLog([]);
  }, []);

  const {
    fmpGainers,
    fmpLosers,
    fmpActive,
    fmpMomentum,
    fmpRelativeVolume,
    fmpAiMovers,
    fmpSmallCaps,
    scannerLoading,
    scannerMeta,
    selectedScannerStock,
    setSelectedScannerStock,
    refreshScanner,
  } = useScannerData({
    brokerApiUrl: BROKER_API_URL,
    onActivity: pushActivity,
  });

  const resizeHandleStyle = {
    background: theme.border,
    borderRadius: "10px",
    flexShrink: 0,
  };

  const verticalResizeHandleStyle = {
    width: "5px",
    cursor: "col-resize",
    ...resizeHandleStyle,
  };

  const liveSmallCapMovers = useMemo(
    () =>
      (fmpSmallCaps.length ? fmpSmallCaps : defaultSmallCapMovers).map((stock) =>
        applyLiveQuote(stock, liveQuotes)
      ),
    [fmpSmallCaps, liveQuotes]
  );

  const {
    activeMarket,
    addSymbol,
    addSymbolToWatchlist,
    allSymbols,
    applySymbolWorkspace,
    liveStocks,
    removeWatchlistSymbol,
    resetTerminalSymbols,
    scannerStocks,
    searchSymbol,
    secondaryStockData,
    secondarySymbol,
    selectMainSymbol,
    selectedStock,
    selectedStockData,
    setSearchSymbol,
    setSecondarySymbol,
    symbolSuggestions,
    tickerTapeSymbols,
    trackedSymbols,
    updateLiveQuote,
  } = useTerminalSymbols({
    activeWorkspace,
    fmpActive,
    fmpAiMovers,
    fmpGainers,
    fmpLosers,
    fmpMomentum,
    fmpRelativeVolume,
    liveQuotes,
    liveSmallCapMovers,
    marketRegion,
    scannerTab,
    setSelectedScannerStock,
    syncCharts,
    updateContextLiveQuote,
  });

  const {
    news,
    newsLoading,
    newsMeta,
    newsStatusLabel,
    refreshNews,
  } = useMarketNews({
    selectedStock,
    brokerApiUrl: BROKER_API_URL,
  });

  const {
    alertDirection,
    alertInput,
    alertNotifications,
    alerts,
    addPriceAlert,
    enableAlertNotifications,
    removeAlert,
    setAlertDirection,
    setAlertInput,
    setAlerts,
  } = useTerminalAlerts({
    selectedStock,
    selectedStockData,
  });

  const replayBuy = useCallback(() => {
    replayBuyState(selectedStock);
  }, [replayBuyState, selectedStock]);

  const replaySell = useCallback(() => {
    replaySellState(selectedStock);
  }, [replaySellState, selectedStock]);

  const resetReplay = useCallback(() => {
    resetReplayState();
    setOrders([]);
    setPositions({});
    setRealizedPnL(0);
    setAlerts([]);
  }, [resetReplayState, setAlerts]);

  const {
    dailyRealizedLoss,
    estimatedValue,
    orderConfirmationKey,
    orderEntryPrice,
    orderPreview,
    orderReward,
    orderRisk,
    orderValue,
    riskReward,
    safetyIssues,
  } = useOrderRisk({
    brokerConnected,
    dailyLossLimit,
    limitPrice,
    liveReadiness,
    maxOrderValue,
    orderConfirmed,
    orderSide,
    orderType,
    positions,
    quantity,
    realizedPnL,
    riskPerTrade,
    selectedBrokerAccount,
    selectedStock,
    selectedStockData,
    stopLoss,
    takeProfit,
    tradingMode,
  });

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setGridMode, setLayoutMode]);
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
      const depthIndex = Math.min(Math.abs(offset), level2.length - 1);
      const bidSize = offset <= 0 ? Number(level2[depthIndex]?.size || 0) : 0;
      const askSize = offset >= 0 ? Number(level2[depthIndex]?.size || 0) : 0;
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

  const workspacePayload = useMemo(
    () => ({
      selectedStock,
      secondarySymbol,
      liveStocks,
      timeframe,
      secondaryTimeframe,
      layoutMode,
      gridMode,
      quantity,
      orders,
      positions,
      realizedPnL,
      alerts,
      syncCharts,
      tradingMode,
      maxOrderValue,
      dailyLossLimit,
      riskPerTrade,
      marketRegion,
      themeMode,
      showEMA9,
      showEMA20,
      scannerTab,
      replayMode,
      replaySpeed,
      replayIndex,
      replayTrades,
      replayEquity,
      journalEntries,
      journalDraft,
      activePreset,
      activeWorkspace,
      rightTab,
      leftSectionsOpen,
      selectedScannerStock,
    }),
    [
      selectedStock,
      secondarySymbol,
      liveStocks,
      timeframe,
      secondaryTimeframe,
      layoutMode,
      gridMode,
      quantity,
      orders,
      positions,
      realizedPnL,
      alerts,
      syncCharts,
      tradingMode,
      maxOrderValue,
      dailyLossLimit,
      riskPerTrade,
      marketRegion,
      themeMode,
      showEMA9,
      showEMA20,
      scannerTab,
      replayMode,
      replaySpeed,
      replayIndex,
      replayTrades,
      replayEquity,
      journalEntries,
      journalDraft,
      activePreset,
      activeWorkspace,
      rightTab,
      leftSectionsOpen,
      selectedScannerStock,
    ]
  );

  const applyWorkspace = useCallback((data) => {
    if (!data) return;

    applySymbolWorkspace(data);
    applyWorkspaceLayout(data);

    if (data.timeframe) setTimeframe(data.timeframe);
    if (data.secondaryTimeframe) setSecondaryTimeframe(data.secondaryTimeframe);
    if (typeof data.quantity !== "undefined") setQuantity(data.quantity);
    if (Array.isArray(data.orders)) setOrders(data.orders);
    if (data.positions) setPositions(data.positions);
    if (typeof data.realizedPnL === "number") setRealizedPnL(data.realizedPnL);
    if (Array.isArray(data.alerts)) setAlerts(data.alerts);
    if (data.tradingMode) setTradingMode(data.tradingMode);
    if (typeof data.maxOrderValue !== "undefined") setMaxOrderValue(data.maxOrderValue);
    if (typeof data.dailyLossLimit !== "undefined") setDailyLossLimit(data.dailyLossLimit);
    if (typeof data.riskPerTrade !== "undefined") setRiskPerTrade(data.riskPerTrade);
    if (data.marketRegion) setMarketRegion(data.marketRegion);
    if (data.themeMode) setThemeMode(data.themeMode);
    if (typeof data.showEMA9 === "boolean") setShowEMA9(data.showEMA9);
    if (typeof data.showEMA20 === "boolean") setShowEMA20(data.showEMA20);
    if (data.scannerTab) setScannerTab(data.scannerTab);
    if (typeof data.replayMode === "boolean") setReplayMode(data.replayMode);
    if (typeof data.replaySpeed !== "undefined") setReplaySpeed(data.replaySpeed);
    if (typeof data.replayIndex === "number") setReplayIndex(data.replayIndex);
    if (Array.isArray(data.replayTrades)) setReplayTrades(data.replayTrades);
    if (Array.isArray(data.replayEquity)) setReplayEquity(data.replayEquity);
    if (Array.isArray(data.journalEntries)) setJournalEntries(data.journalEntries);
    if (data.journalDraft) setJournalDraft(data.journalDraft);
    if (data.selectedScannerStock) setSelectedScannerStock(data.selectedScannerStock);
  }, [
    applySymbolWorkspace,
    applyWorkspaceLayout,
    setAlerts,
    setReplayEquity,
    setReplayIndex,
    setReplayMode,
    setReplaySpeed,
    setReplayTrades,
    setSelectedScannerStock,
  ]);

  const {
    authEmail,
    authMessage,
    authMode,
    authPassword,
    cloudStatus,
    handleAuthSubmit,
    handleLogout,
    loadWorkspaceFromCloud,
    saveWorkspaceToCloud,
    setAuthEmail,
    setAuthMode,
    setAuthPassword,
    user,
  } = useCloudWorkspace({
    applyWorkspace,
    pushActivity,
    workspacePayload,
  });

  function panelStyle(extra = {}) {
    return createPanelStyle(theme, isDark, extra);
  }

  function panelTitle(title) {
    return (
      <div
        style={{
          fontSize: "11px",
          fontWeight: 950,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
          paddingBottom: "7px",
          marginBottom: "8px",
          color: theme.text,
        }}
      >
        {title}
      </div>
    );
  }

  function sectionHeader(id, title, meta = "") {
    return (
      <LeftSectionHeader
        id={id}
        title={title}
        meta={meta}
        open={Boolean(leftSectionsOpen[id])}
        onToggle={toggleLeftSection}
        theme={theme}
      />
    );
  }

  function emptyState(title, detail) {
    return (
      <div
        style={{
          color: theme.muted,
          border: `1px dashed ${theme.border}`,
          borderRadius: "6px",
          padding: "10px",
          fontSize: "11px",
          lineHeight: "1.45",
          background: theme.panel2,
        }}
      >
        <div style={{ color: theme.text, fontWeight: 900, marginBottom: "3px" }}>
          {title}
        </div>
        <div>{detail}</div>
      </div>
    );
  }

  const buttonStyle = (active = false) => createButtonStyle(theme, active);

  const timeframeButtonStyle = (active = false) => ({
    width: "40px",
    height: "28px",
    padding: 0,
    background: active ? `linear-gradient(180deg, ${theme.blue}, #1765c6)` : theme.panel2,
    border: `1px solid ${active ? "rgba(45,140,255,0.72)" : theme.borderSoft || theme.border}`,
    color: active ? "#ffffff" : theme.text,
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "10px",
    fontWeight: 900,
  });

  const handleRefreshBroker = useCallback(async () => {
    pushActivity({
      type: "broker",
      status: "info",
      title: "Broker Refresh Requested",
      detail: "Refreshing Questrade status, accounts, balances, positions, and orders.",
    });

    await refreshBroker();
  }, [pushActivity, refreshBroker]);

  const [healthRefreshing, setHealthRefreshing] = useState(false);

  const handleRefreshProductionHealth = useCallback(async () => {
    if (healthRefreshing) return;

    setHealthRefreshing(true);
    pushActivity({
      type: "system",
      status: "info",
      title: "Health Refresh Requested",
      detail: "Refreshing backend, Questrade, scanner, and news status.",
    });

    try {
      await Promise.allSettled([
        refreshBroker(),
        refreshScanner(),
        refreshNews(),
      ]);
    } finally {
      setHealthRefreshing(false);
    }
  }, [healthRefreshing, pushActivity, refreshBroker, refreshScanner, refreshNews]);

  const handleLoadBrokerAccountData = useCallback(async (accountNumber) => {
    pushActivity({
      type: "broker",
      status: "info",
      title: "Broker Account Sync Requested",
      detail: "Syncing selected account balances, positions, and orders.",
    });

    await loadBrokerAccountData(accountNumber);
  }, [loadBrokerAccountData, pushActivity]);

  function setMainTimeframe(value) {
    setTimeframe(value);
    if (syncCharts) setSecondaryTimeframe(value);
  }

  function addJournalEntry() {
    const symbol = journalDraft.symbol.trim().toUpperCase() || selectedStock;
    const entry = {
      ...journalDraft,
      id: Date.now(),
      symbol,
      createdAt: new Date().toLocaleString(),
      linkedPrice: Number(selectedStockData?.price || 0).toFixed(2),
      linkedRealizedPnL: Number(realizedPnL || 0).toFixed(2),
    };

    setJournalEntries((prev) => [entry, ...prev.slice(0, 49)]);
    setJournalDraft({
      ...defaultJournalDraft,
      symbol,
      bias: journalDraft.bias,
      setup: journalDraft.setup,
      grade: "B",
    });
  }

  function openReplayJournal() {
    const closedReplayTrades = replayTrades.filter((trade) => trade.type === "SELL");
    const latestReplayTrade = closedReplayTrades[closedReplayTrades.length - 1];
    const replayNetPnl = Number(replayStats.netPnL || 0);
    const replayResult = replayNetPnl > 0 ? "Win" : replayNetPnl < 0 ? "Loss" : "Review";

    setJournalDraft((prev) => ({
      ...prev,
      symbol: selectedStock,
      bias: replayNetPnl >= 0 ? "Long" : "Review",
      setup: "Replay Backtest",
      grade: replayNetPnl > 0 ? "B" : "C",
      tags: "replay,backtest",
      mistakeTags: replayNetPnl < 0 ? "needs-review" : "",
      followedPlan: "Yes",
      emotion: "Calm",
      result: replayResult,
      plan: `Replay review for ${selectedStock}. Candle ${replayIndex} of ${mainReplayData.length || 0}.`,
      review: [
        `Replay net P&L: $${replayNetPnl.toFixed(2)}`,
        `Closed trades: ${closedReplayTrades.length}`,
        `Win rate: ${replayStats.winRate}%`,
        latestReplayTrade
          ? `Last close: ${latestReplayTrade.type} ${latestReplayTrade.qty} @ $${Number(latestReplayTrade.price || 0).toFixed(2)} with P&L $${Number(latestReplayTrade.pnl || 0).toFixed(2)}`
          : "Last close: none yet",
      ].join("\n"),
    }));
    setActiveWorkspace("journal");
    setRightTab("risk");
    setActivePreset("journal");
  }

  function deleteJournalEntry(id) {
    setJournalEntries((prev) => prev.filter((entry) => entry.id !== id));
  }

  const commandActions = useMemo(() => {
    const symbolActions = [
      ...allSymbols,
      ...scannerStocks,
      ...popularSymbols.map((symbol) => ({ symbol })),
    ]
      .filter((stock) => stock?.symbol)
      .filter((stock, index, stocks) =>
        stocks.findIndex((item) => item.symbol === stock.symbol) === index
      )
      .slice(0, 40)
      .map((stock) => ({
        id: `symbol-${stock.symbol}`,
        label: `Open ${stock.symbol}`,
        detail: stock.price
          ? `$${stock.price} ${stock.change || ""} ${stock.volume || ""}`
          : "Jump to symbol",
        group: "Symbol",
        keywords: `chart ticker watchlist ${stock.symbol}`,
        onRun: () => selectMainSymbol(stock.symbol, stock.price ? stock : null),
      }));

    const presetActions = Object.entries(layoutPresets).map(([id, preset]) => ({
      id: `preset-${id}`,
      label: preset.label,
      detail: `Workspace ${preset.activeWorkspace} · ${preset.layoutMode} chart · ${preset.rightTab}`,
      group: "Preset",
      keywords: `layout preset ${id}`,
      onRun: () => applyLayoutPreset(id),
    }));

    const workspaceActions = workspaceViews.map((view) => ({
      id: `workspace-${view.id}`,
      label: `Go to ${view.label}`,
      detail: "Switch workspace",
      group: "Workspace",
      keywords: `workspace view ${view.id}`,
      onRun: () => setActiveWorkspace(view.id),
    }));

    const rightTabActions = rightPanelTabs.map((tab) => ({
      id: `right-tab-${tab.id}`,
      label: `Open ${tab.label} Panel`,
      detail: "Switch right trading console tab",
      group: "Panel",
      keywords: `right panel tab ${tab.id}`,
      onRun: () => {
        setRightTab(tab.id);
        setActiveWorkspace("charts");
      },
    }));

    return [
      {
        id: "order-ticket",
        label: "Open Order Ticket",
        detail: "Focus the guarded paper order ticket",
        group: "Trade",
        keywords: "buy sell order ticket paper",
        onRun: () => {
          setActiveWorkspace("charts");
          setRightTab("order");
        },
      },
      {
        id: "add-alert",
        label: "Open Alerts",
        detail: `Create or review alerts for ${selectedStock}`,
        group: "Alert",
        keywords: "price alert notification",
        onRun: () => {
          setActiveWorkspace("alerts");
          setRightTab("alerts");
        },
      },
      {
        id: "toggle-replay",
        label: replayMode ? "Turn Replay Off" : "Turn Replay On",
        detail: "Toggle replay mode",
        group: "Replay",
        keywords: "backtest replay play",
        onRun: () => setReplayMode((value) => !value),
      },
      {
        id: "toggle-indicators",
        label: showIndicators ? "Hide Indicators Menu" : "Show Indicators Menu",
        detail: "Toggle chart indicator controls",
        group: "Chart",
        keywords: "ema indicators chart",
        onRun: () => setShowIndicators((value) => !value),
      },
      ...presetActions,
      ...workspaceActions,
      ...rightTabActions,
      ...symbolActions,
    ];
  }, [
    allSymbols,
    applyLayoutPreset,
    replayMode,
    scannerStocks,
    selectMainSymbol,
    selectedStock,
    setActiveWorkspace,
    setReplayMode,
    setRightTab,
    showIndicators,
  ]);

  function resetWorkspace() {
    const keysToReset = [
      "sb_selected_stock",
      "sb_secondary_symbol",
      "sb_timeframe",
      "sb_secondary_timeframe",
      "sb_layout_mode",
      "sb_grid_mode",
      "sb_theme_mode",
      "sb_market_region",
      "sb_show_ema9",
      "sb_show_ema20",
      "sb_scanner_tab",
      "sb_watchlist",
      "sb_orders",
      "sb_positions",
      "sb_realized_pnl",
      "sb_alerts",
      "sb_journal_entries",
      "sb_journal_draft",
      "sb_activity_log",
      "sb_active_preset",
      "sb_sync_charts",
      "sb_trading_mode",
      "sb_max_order_value",
      "sb_daily_loss_limit",
      "sb_risk_per_trade",
      "sb_active_workspace",
      "sb_right_tab",
      "sb_left_sections_open",
      "sb_selected_scanner_stock",
      "sb_selected_broker_account",
    ];

    removeSettings(keysToReset);

    resetWorkspaceLayout();
    resetTerminalSymbols();
    setTimeframe("15m");
    setSecondaryTimeframe("5m");
    setThemeMode("dark");
    setMarketRegion("us");
    setShowEMA9(true);
    setShowEMA20(true);
    setScannerTab("Gainers");
    setOrders([]);
    setPositions({});
    setRealizedPnL(0);
    setAlerts([]);
    setJournalEntries([]);
    setJournalDraft({ ...defaultJournalDraft, symbol: "NVDA" });
    setActivityLog([]);
    setTradingMode("paper");
    setOrderConfirmed(false);
    setMaxOrderValue(25000);
    setDailyLossLimit(500);
    setRiskPerTrade(250);
    setSelectedScannerStock(null);
  }

  const placeOrder = useCallback((side, options = {}) => {
    const currentPrice = Number(selectedStockData?.price || 0);
    const executionPrice = Number(options.price || currentPrice);
    const qty = Number(quantity);

    if (!qty || qty <= 0 || !executionPrice) return false;

    const existing = positions[selectedStock] || {
      quantity: 0,
      average: 0,
    };

    let updatedPositions = { ...positions };
    let updatedRealized = Number(realizedPnL || 0);
    let filledQty = qty;
    let orderRealizedPnL = null;

    if (side === "BUY") {
      const totalCost = existing.average * existing.quantity + executionPrice * qty;
      const newQty = existing.quantity + qty;

      updatedPositions[selectedStock] = {
        quantity: newQty,
        average: totalCost / newQty,
      };
    }

    if (side === "SELL") {
      const sellQty = Math.min(qty, existing.quantity);

      if (sellQty <= 0) return false;

      const pnl = (executionPrice - existing.average) * sellQty;
      updatedRealized += pnl;
      filledQty = sellQty;
      orderRealizedPnL = pnl;

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
      auditId: options.auditId,
      mode: options.mode || "paper",
      side,
      symbol: selectedStock,
      quantity: filledQty,
      requestedQuantity: qty,
      price: executionPrice.toFixed(2),
      value: (executionPrice * filledQty).toFixed(2),
      orderType: options.orderType,
      stopLoss: options.stopLoss,
      takeProfit: options.takeProfit,
      riskReward: options.riskReward,
      status:
        side === "SELL" && filledQty < qty
          ? "Paper Partially Filled"
          : options.status,
      realizedPnL: orderRealizedPnL !== null ? orderRealizedPnL.toFixed(2) : null,
      auditStatus: options.auditStatus || "Guardrails Passed",
      guardrails: options.guardrails || null,
      confirmationKey: options.confirmationKey,
      submittedAt: options.submittedAt,
      time: new Date().toLocaleTimeString(),
    };

    setOrders((prev) => [order, ...prev.slice(0, 20)]);
    return {
      filledQty,
      requestedQty: qty,
      partiallyFilled: filledQty < qty,
    };
  }, [positions, quantity, realizedPnL, selectedStock, selectedStockData?.price]);

  function buildBrokerOrderPayload(sideOverride = orderSide, confirmed = false) {
    const currentPrice = Number(selectedStockData?.price || 0);
    const entryPrice =
      orderType === "LIMIT" && Number(limitPrice) > 0
        ? Number(limitPrice)
        : currentPrice;

    return {
      accountNumber: selectedBrokerAccount,
      symbol: selectedStock,
      side: sideOverride,
      orderType,
      quantity: Number(quantity || 0),
      limitPrice: orderType === "LIMIT" ? Number(limitPrice || 0) : null,
      entryPrice,
      maxOrderValue: Number(maxOrderValue || 0),
      stopLoss: Number(stopLoss || 0),
      takeProfit: Number(takeProfit || 0),
      confirmed,
      userConfirmed: confirmed,
    };
  }

  async function previewLiveOrderTicket(sideOverride = orderSide) {
    setOrderMessage("Requesting backend live order preview...");

    const preview = await previewLiveOrder(buildBrokerOrderPayload(sideOverride, false));
    const firstBlock =
      preview?.validationErrors?.[0] ||
      preview?.readiness?.blockingReasons?.[0] ||
      preview?.error ||
      null;

    if (firstBlock) {
      setOrderMessage(`Live preview blocked: ${firstBlock}`);
      pushActivity({
        type: "broker",
        status: "blocked",
        title: "Live Preview Blocked",
        detail: firstBlock,
        symbol: selectedStock,
      });
      return preview;
    }

    setOrderMessage("Live preview completed. Submit remains controlled by backend readiness gates.");
    pushActivity({
      type: "broker",
      status: "ready",
      title: "Live Preview Ready",
      detail: `${selectedStock} preview returned from backend safety checks.`,
      symbol: selectedStock,
      meta: {
        requestId: preview?.requestId,
        estimatedValue: preview?.estimatedValue,
      },
    });

    return preview;
  }

  async function submitOrderTicket(sideOverride = orderSide) {
    setOrderMessage("");

    const qty = Number(quantity);
    const currentPrice = Number(selectedStockData?.price || 0);
    const entryPrice =
      orderType === "LIMIT" && Number(limitPrice) > 0
        ? Number(limitPrice)
        : currentPrice;

    if (!qty || qty <= 0) {
      setOrderMessage("Enter a valid quantity.");
      pushActivity({
        type: "order",
        status: "blocked",
        title: "Paper Order Blocked",
        detail: "Order ticket rejected the request because quantity was not valid.",
        symbol: selectedStock,
      });
      return;
    }

    if (!entryPrice || entryPrice <= 0) {
      setOrderMessage("Enter a valid entry price.");
      pushActivity({
        type: "order",
        status: "blocked",
        title: "Paper Order Blocked",
        detail: "Order ticket rejected the request because entry price was not valid.",
        symbol: selectedStock,
      });
      return;
    }

    if (orderType === "LIMIT" && !Number(limitPrice)) {
      setOrderMessage("Limit orders need a limit price.");
      pushActivity({
        type: "order",
        status: "blocked",
        title: "Limit Order Blocked",
        detail: "Limit order was blocked because no limit price was provided.",
        symbol: selectedStock,
      });
      return;
    }

    if (tradingMode !== "paper") {
      if (safetyIssues.length > 0) {
        setOrderMessage(safetyIssues[0]);
        pushActivity({
          type: "broker",
          status: "blocked",
          title: "Live Submit Blocked",
          detail: safetyIssues[0],
          symbol: selectedStock,
        });
        return;
      }

      const confirmText = [
        `Request LIVE ${sideOverride} ${qty} ${selectedStock}`,
        `Entry: $${entryPrice.toFixed(2)}`,
        `Value: $${(entryPrice * qty).toFixed(2)}`,
        "Backend safety gate will make the final submit decision.",
      ].join("\n");

      if (!window.confirm(confirmText)) {
        setOrderMessage("Live submission cancelled before backend request.");
        return;
      }

      const response = await submitLiveOrder(buildBrokerOrderPayload(sideOverride, true));
      const firstBlock =
        response?.blockingReasons?.[0] ||
        response?.error ||
        response?.preview?.validationErrors?.[0] ||
        response?.preview?.readiness?.blockingReasons?.[0] ||
        null;

      if (response?.submitted) {
        setOrderMessage(`${sideOverride} ${qty} ${selectedStock} submitted to Questrade.`);
        setOrderConfirmed(false);
        pushActivity({
          type: "broker",
          status: "submitted",
          title: "Live Order Submitted",
          detail: `${qty} ${selectedStock} submitted through backend live route.`,
          symbol: selectedStock,
          meta: {
            requestId: response.requestId,
          },
        });
        return;
      }

      setOrderMessage(firstBlock ? `Live submit disabled: ${firstBlock}` : "Live submit disabled by backend safety gate.");
      pushActivity({
        type: "broker",
        status: "blocked",
        title: "Live Submit Disabled",
        detail: firstBlock || "Backend safety gate rejected the live order.",
        symbol: selectedStock,
        meta: {
          requestId: response?.requestId,
        },
      });
      return;
    }

    if (safetyIssues.length > 0) {
      setOrderMessage(safetyIssues[0]);
      pushActivity({
        type: "risk",
        status: "blocked",
        title: "Risk Guardrail Blocked Order",
        detail: safetyIssues[0],
        symbol: selectedStock,
        meta: {
          orderValue,
          orderRisk,
          riskPerTrade: Number(riskPerTrade || 0),
          maxOrderValue: Number(maxOrderValue || 0),
        },
      });
      return;
    }

    const auditId = `SB-${Date.now().toString(36).toUpperCase()}`;
    const submittedAt = new Date().toISOString();
    const confirmText = [
      `Submit PAPER ${sideOverride} ${qty} ${selectedStock}`,
      `Entry: $${entryPrice.toFixed(2)}`,
      `Value: $${(entryPrice * qty).toFixed(2)}`,
      `Risk: $${orderRisk.toFixed(2)}`,
      `Audit: ${auditId}`,
    ].join("\n");

    if (!window.confirm(confirmText)) {
      setOrderMessage("Order submission cancelled before execution.");
      pushActivity({
        type: "order",
        status: "cancelled",
        title: "Paper Order Cancelled",
        detail: "User cancelled the final order confirmation before execution.",
        symbol: selectedStock,
      });
      return;
    }

    const result = placeOrder(sideOverride, {
      auditId,
      mode: "paper",
      price: entryPrice,
      orderType,
      stopLoss: Number(stopLoss) > 0 ? Number(stopLoss).toFixed(2) : null,
      takeProfit: Number(takeProfit) > 0 ? Number(takeProfit).toFixed(2) : null,
      riskReward,
      status: "Paper Filled",
      auditStatus: "Guardrails Passed",
      confirmationKey: orderConfirmationKey,
      submittedAt,
      guardrails: {
        maxOrderValue: Number(maxOrderValue || 0),
        dailyLossLimit: Number(dailyLossLimit || 0),
        riskPerTrade: Number(riskPerTrade || 0),
        orderRisk: Number(orderRisk || 0),
        orderValue: Number(entryPrice * qty),
        dailyRealizedLoss: Number(dailyRealizedLoss || 0),
      },
    });

    if (result) {
      const fillText = result.partiallyFilled
        ? `${result.filledQty} of ${result.requestedQty}`
        : result.filledQty;

      setOrderMessage(`${sideOverride} ${fillText} ${selectedStock} filled as paper ${orderType.toLowerCase()} order.`);
      setOrderConfirmed(false);
      pushActivity({
        type: "order",
        status: "filled",
        title: `Paper ${sideOverride} Filled`,
        detail: `${fillText} ${selectedStock} filled at $${entryPrice.toFixed(2)} as a ${orderType.toLowerCase()} order.`,
        symbol: selectedStock,
        meta: {
          auditId,
          quantity: result.filledQty,
          value: Number(entryPrice * result.filledQty),
          orderRisk: Number(orderRisk || 0),
        },
      });
    } else {
      setOrderMessage(`No ${selectedStock} position available to sell.`);
      pushActivity({
        type: "order",
        status: "blocked",
        title: "Paper Sell Blocked",
        detail: `No ${selectedStock} paper position was available to sell.`,
        symbol: selectedStock,
      });
    }
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

  function downloadFile(filename, content, type = "text/plain;charset=utf-8") {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  function csvValue(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportJournalCsv() {
    const headers = [
      "createdAt",
      "symbol",
      "bias",
      "setup",
      "grade",
      "result",
      "followedPlan",
      "emotion",
      "tags",
      "mistakeTags",
      "screenshotUrl",
      "plan",
      "review",
    ];
    const rows = journalEntries.map((entry) =>
      headers.map((header) => csvValue(entry[header])).join(",")
    );

    downloadFile(
      `journal-${new Date().toISOString().slice(0, 10)}.csv`,
      [headers.join(","), ...rows].join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  function exportTradeSummaryCsv() {
    const headers = [
      "time",
      "symbol",
      "side",
      "quantity",
      "price",
      "value",
      "realizedPnL",
      "stopLoss",
      "takeProfit",
      "riskReward",
      "status",
    ];
    const rows = orders.map((order) =>
      headers.map((header) => csvValue(order[header])).join(",")
    );

    downloadFile(
      `trade-summary-${new Date().toISOString().slice(0, 10)}.csv`,
      [headers.join(","), ...rows].join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  function isTodayRecord(dateText) {
    if (!dateText) return false;
    const parsed = new Date(dateText);

    if (Number.isNaN(parsed.getTime())) return false;

    return parsed.toDateString() === new Date().toDateString();
  }

  function buildDailyReportText() {
    const today = new Date().toLocaleDateString();
    const todaysOrders = orders.filter((order) => isTodayRecord(order.time));
    const todaysJournal = journalEntries.filter((entry) => isTodayRecord(entry.createdAt));
    const closedToday = todaysOrders.filter((order) => order.realizedPnL !== null);
    const dailyPnl = closedToday.reduce(
      (total, order) => total + Number(order.realizedPnL || 0),
      0
    );
    const latestJournal = todaysJournal.find((entry) => entry.symbol === selectedStock) || todaysJournal[0];

    return [
      `# SbCapitalCo Daily Report - ${today}`,
      "",
      "## Account",
      `- Realized P&L: $${Number(realizedPnL || 0).toFixed(2)}`,
      `- Unrealized P&L: $${Number(totalUnrealizedPnL || 0).toFixed(2)}`,
      `- Today's closed P&L: $${dailyPnl.toFixed(2)}`,
      `- Orders today: ${todaysOrders.length}`,
      `- Active symbol: ${selectedStock}`,
      "",
      "## Trade Summary",
      todaysOrders.length
        ? todaysOrders
            .map(
              (order) =>
                `- ${order.time}: ${order.side} ${order.quantity} ${order.symbol} @ $${order.price} (${order.status || "Paper"})`
            )
            .join("\n")
        : "- No paper trades recorded today.",
      "",
      "## Journal Links",
      todaysJournal.length
        ? todaysJournal
            .map((entry) => `- ${entry.createdAt}: ${entry.symbol} ${entry.setup} Grade ${entry.grade}`)
            .join("\n")
        : "- No journal entries recorded today.",
      "",
      "## Screenshot Reference",
      `- Suggested chart screenshot: ${selectedStock}-chart.png`,
      latestJournal ? `- Linked journal entry: ${latestJournal.id}` : "- Linked journal entry: none",
      "",
    ].join("\n");
  }

  function exportDailyReport() {
    downloadFile(
      `daily-report-${new Date().toISOString().slice(0, 10)}.md`,
      buildDailyReportText(),
      "text/markdown;charset=utf-8"
    );
  }

  function exportWeeklyReport() {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklyOrders = orders.filter((order) => {
      const parsed = new Date(order.time);
      return !Number.isNaN(parsed.getTime()) && parsed.getTime() >= weekAgo;
    });
    const weeklyJournal = journalEntries.filter((entry) => {
      const parsed = new Date(entry.createdAt);
      return !Number.isNaN(parsed.getTime()) && parsed.getTime() >= weekAgo;
    });
    const weeklyPnl = weeklyOrders.reduce(
      (total, order) => total + Number(order.realizedPnL || 0),
      0
    );
    const mistakeCounts = weeklyJournal.reduce((stats, entry) => {
      String(entry.mistakeTags || entry.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .forEach((tag) => {
          stats[tag] = (stats[tag] || 0) + 1;
        });
      return stats;
    }, {});

    downloadFile(
      `weekly-review-${new Date().toISOString().slice(0, 10)}.md`,
      [
        `# SbCapitalCo Weekly Review - ${new Date().toLocaleDateString()}`,
        "",
        `- Closed/order records: ${weeklyOrders.length}`,
        `- Journal reviews: ${weeklyJournal.length}`,
        `- Weekly realized P&L: $${weeklyPnl.toFixed(2)}`,
        "",
        "## Setup Performance",
        ...Object.entries(
          weeklyJournal.reduce((stats, entry) => {
            stats[entry.setup] ||= { total: 0, aGrade: 0 };
            stats[entry.setup].total += 1;
            if (entry.grade === "A" || entry.grade === "B") stats[entry.setup].aGrade += 1;
            return stats;
          }, {})
        ).map(([setup, stat]) => `- ${setup}: ${stat.aGrade}/${stat.total} A/B reviews`),
        "",
        "## Mistake Tags",
        ...(Object.entries(mistakeCounts).length
          ? Object.entries(mistakeCounts).map(([tag, count]) => `- ${tag}: ${count}`)
          : ["- No mistake tags recorded."]),
        "",
        "## Screenshot Links",
        ...(weeklyJournal.filter((entry) => entry.screenshotUrl).length
          ? weeklyJournal
              .filter((entry) => entry.screenshotUrl)
              .map((entry) => `- ${entry.symbol} ${entry.createdAt}: ${entry.screenshotUrl}`)
          : ["- No screenshots linked."]),
        "",
      ].join("\n"),
      "text/markdown;charset=utf-8"
    );
  }

  function exportScreenshotJournalLink() {
    const canvas = chartAreaRef.current?.querySelector("canvas");
    const latestEntry =
      journalEntries.find((entry) => entry.symbol === selectedStock) || journalEntries[0] || null;
    const fileDate = new Date().toISOString().slice(0, 10);

    if (canvas) {
      canvas.toBlob((blob) => {
        if (blob) downloadFile(`${fileDate}-${selectedStock}-chart.png`, blob, "image/png");
      });
    }

    downloadFile(
      `${fileDate}-${selectedStock}-screenshot-link.md`,
      [
        `# Screenshot Journal Link - ${selectedStock}`,
        "",
        `- Screenshot file: ${fileDate}-${selectedStock}-chart.png`,
        latestEntry ? `- Journal entry id: ${latestEntry.id}` : "- Journal entry id: none",
        latestEntry ? `- Journal created: ${latestEntry.createdAt}` : "- Journal created: none",
        latestEntry ? `- Setup: ${latestEntry.setup}` : "- Setup: none",
        "",
      ].join("\n"),
      "text/markdown;charset=utf-8"
    );
  }


  useEffect(() => {
    if (brokerBootstrappedRef.current) return;

    brokerBootstrappedRef.current = true;
    Promise.resolve().then(handleRefreshBroker);
  }, [handleRefreshBroker]);

  useEffect(() => {
    if (selectedBrokerAccount) {
      Promise.resolve().then(() => handleLoadBrokerAccountData(selectedBrokerAccount));
    }
  }, [handleLoadBrokerAccountData, selectedBrokerAccount]);

  useEffect(() => {
    if (brokerConnected && selectedBrokerAccount) {
      Promise.resolve().then(() => loadLiveReadiness(selectedBrokerAccount));
    }
  }, [brokerConnected, loadLiveReadiness, selectedBrokerAccount]);

  useEffect(() => {
    if (!brokerSyncMeta?.lastSuccessAt) return;
    if (lastBrokerSyncLoggedRef.current === brokerSyncMeta.lastSuccessAt) return;

    lastBrokerSyncLoggedRef.current = brokerSyncMeta.lastSuccessAt;
    pushActivity({
      type: "broker",
      status: "synced",
      title: "Broker Sync Completed",
      detail: "Broker balances, positions, or orders were refreshed successfully.",
    });
  }, [brokerSyncMeta?.lastSuccessAt, pushActivity]);

  useEffect(() => {
    if (!brokerError) return;
    if (lastBrokerErrorLoggedRef.current === brokerError) return;

    lastBrokerErrorLoggedRef.current = brokerError;
    pushActivity({
      type: "broker",
      status: "failed",
      title: "Broker Sync Failed",
      detail: brokerError,
    });
  }, [brokerError, pushActivity]);

  useEffect(() => {
    saveSetting("sb_timeframe", timeframe);
    saveSetting("sb_secondary_timeframe", secondaryTimeframe);
    saveSetting("sb_theme_mode", themeMode);
    saveSetting("sb_market_region", marketRegion);
    saveSetting("sb_show_ema9", showEMA9);
    saveSetting("sb_show_ema20", showEMA20);
    saveSetting("sb_scanner_tab", scannerTab);
    saveSetting("sb_orders", orders);
    saveSetting("sb_positions", positions);
    saveSetting("sb_realized_pnl", realizedPnL);
    saveSetting("sb_alerts", alerts);
    saveSetting("sb_journal_entries", journalEntries);
    saveSetting("sb_journal_draft", journalDraft);
    saveSetting("sb_activity_log", activityLog);
    saveSetting("sb_trading_mode", tradingMode);
    saveSetting("sb_max_order_value", maxOrderValue);
    saveSetting("sb_daily_loss_limit", dailyLossLimit);
    saveSetting("sb_risk_per_trade", riskPerTrade);
  }, [
    timeframe,
    secondaryTimeframe,
    themeMode,
    marketRegion,
    showEMA9,
    showEMA20,
    scannerTab,
    orders,
    positions,
    realizedPnL,
    alerts,
    journalEntries,
    journalDraft,
    activityLog,
    tradingMode,
    maxOrderValue,
    dailyLossLimit,
    riskPerTrade,
  ]);

  useEffect(() => {
    function handleHotkeys(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
        return;
      }

      const tag = event.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setOrderSide("BUY");
        setOrderMessage("Review and confirm the order ticket before submitting a BUY.");
      }

      if (event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setOrderSide("SELL");
        setOrderMessage("Review and confirm the order ticket before submitting a SELL.");
      }

      if (event.shiftKey && event.key === "1") {
        event.preventDefault();
        setLayoutMode("1");
      }

      if (event.shiftKey && event.key === "2") {
        event.preventDefault();
        setLayoutMode("2");
        setGridMode("2");
      }

      if (event.key === "Escape") {
        setShowIndicators(false);
      }
    }

    window.addEventListener("keydown", handleHotkeys);

    return () => window.removeEventListener("keydown", handleHotkeys);
  }, [setGridMode, setLayoutMode]);

  useEffect(() => {
    return subscribeToSymbols(trackedSymbols);
  }, [subscribeToSymbols, trackedSymbols]);

  useEffect(() => {
    let cancelled = false;

    const pollLiveQuotes = async () => {
      const uniqueSymbols = [...new Set(trackedSymbols)].slice(0, 12);

      if (!uniqueSymbols.length) return;

      try {
        const response = await fetchWithTimeout(
          `${BROKER_API_URL}/api/questrade/quotes?symbols=${encodeURIComponent(uniqueSymbols.join(","))}`,
          8000
        );

        if (!response.ok) return;

        const payload = await response.json();
        const quotes = Array.isArray(payload.quotes) ? payload.quotes : [];

        if (cancelled) return;

        quotes.forEach((quote) => {
          const price = Number(quote.price || 0);

          if (price <= 0) return;

          updateLiveQuote(quote.symbol, price, {
            volume: quote.volume || "QUOTE",
            source: quote.delayed ? "QTRD DELAYED" : "QTRD",
            delayed: Boolean(quote.delayed),
            realtime: quote.realtime !== false,
            bidPrice: quote.bidPrice,
            askPrice: quote.askPrice,
            lastTradeTime: quote.lastTradeTime,
          });
        });
      } catch {
        // Keep websocket/simulated values if the backend quote bridge is unavailable.
      }
    };

    pollLiveQuotes();
    const interval = setInterval(pollLiveQuotes, 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [trackedSymbols, updateLiveQuote]);

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
  
  const showLeftDock =
    activeWorkspace === "charts" ||
    activeWorkspace === "scanner" ||
    activeWorkspace === "watchlist" ||
    activeWorkspace === "journal" ||
    activeWorkspace === "settings";

  const showRightDock =
    activeWorkspace === "charts" ||
    activeWorkspace === "broker" ||
    activeWorkspace === "replay" ||
    activeWorkspace === "portfolio" ||
    activeWorkspace === "alerts";
  const showLeftDockPanel = showLeftDock && (!isCompactTerminal || activeWorkspace !== "charts");
  const showRightDockPanel = showRightDock && (!isCompactTerminal || activeWorkspace !== "charts");
  const sidebarPanelSize = isPhoneTerminal ? 15 : 4;
  const workspaceMinSize = isCompactTerminal && (showLeftDockPanel || showRightDockPanel) ? 46 : isCompactTerminal ? 82 : 30;
  const workspaceDefaultSize =
    100 - sidebarPanelSize - (showLeftDockPanel ? 18 : 0) - (showRightDockPanel ? 20 : 0);

  const centerRows =
    activeWorkspace === "intelligence" ||
    activeWorkspace === "scanner" ||
    activeWorkspace === "watchlist" ||
    activeWorkspace === "journal" ||
    activeWorkspace === "settings"
      ? "1fr"
      : "1fr 170px";

  const {
    marketDataStatusLabel,
    mainChartSourceLabel,
    scannerSourceLabel,
    newsSourceLabel,
    brokerSourceLabel,
    modeSourceLabel,
  } = buildTerminalSourceLabels({
    liveQuotes,
    platformHealth,
    mainChartStatus,
    scannerMeta,
    newsMeta,
    brokerConnected,
  });
  const qtrdHealth = useMemo(
    () =>
      getQuestradeHealth({
        brokerConnected,
        brokerDetails,
        brokerError,
        platformHealth,
        liveQuotes,
      }),
    [brokerConnected, brokerDetails, brokerError, liveQuotes, platformHealth]
  );
  const backendHealthLabel = platformHealth?.backend?.status === "online" ? "BACKEND LIVE" : "BACKEND PENDING";
  const resolvedMarketDataStatusLabel = qtrdHealth.label || marketDataStatusLabel;
  const resolvedNewsStatusLabel = newsStatusLabel || newsSourceLabel;
  const aiHealth = platformHealth?.ai || platformHealth?.deepHealth?.ai || null;
  const aiHealthLabel = aiHealth?.source === "gemini" && (aiHealth?.live || aiHealth?.providerLabel === "LIVE")
    ? "GEMINI LIVE"
    : aiHealth?.label
      ? String(aiHealth.label).replace(/^AI /, "AI ")
      : "AI PENDING";
  const aiHealthMessage = aiHealth?.userMessage ||
    aiHealth?.lastError ||
    (aiHealth?.source ? `${aiHealth.source} intelligence provider.` : "Gemini intelligence status pending.");
  const rawScannerMessage = scannerMeta?.userMessage ||
    scannerMeta?.userWarnings?.[0] ||
    platformHealth?.scanner?.providerStatus?.userMessage ||
    platformHealth?.scanner?.providerStatus?.userWarnings?.[0] ||
    scannerMeta?.lastWarning ||
    "";
  const rawNewsMessage = newsMeta?.userMessage ||
    newsMeta?.userWarnings?.[0] ||
    newsMeta?.providerStatus?.userMessage ||
    newsMeta?.providerStatus?.userWarnings?.[0] ||
    newsMeta?.warning ||
    "";
  const resolvedScannerMessage = rawScannerMessage
    ? getCleanProviderMessage(rawScannerMessage, "Provider limited. Cached/fallback data active.")
    : "Scanner status normal.";
  const resolvedNewsMessage = rawNewsMessage
    ? getCleanProviderMessage(rawNewsMessage, "News provider limited. Showing available headlines.")
    : "News status normal.";
  const healthLastCheckedAt =
    lastHealthCheckedAt ||
    platformHealth?.backendTime ||
    newsMeta?.backendTime ||
    scannerMeta?.backendTime ||
    newsMeta?.updatedAt ||
    scannerMeta?.updatedAt;
  const selectedDataConfidence = useMemo(
    () =>
      buildDataConfidence({
        selectedStock,
        selectedStockData,
        qtrdHealth,
        newsMeta,
        scannerMeta,
      }),
    [newsMeta, qtrdHealth, scannerMeta, selectedStock, selectedStockData]
  );
  const visibleRightPanelTabs = useMemo(
    () => rightPanelTabs.filter((tab) => advancedMode || coreRightTabs.has(tab.id)),
    [advancedMode]
  );
  const selectedDockStock = selectedScannerStock?.symbol === selectedStock
    ? selectedScannerStock
    : selectedStockData;
  const hasSelectedInWatchlist = liveStocks.some((stock) => stock.symbol === selectedStock);
  const selectedTickerNews = useMemo(
    () =>
      news
        .filter((item) => {
          const relatedTicker = String(item.relatedTicker || item.symbol || "").toUpperCase();
          const headline = String(item.headline || "").toUpperCase();
          return relatedTicker === selectedStock || headline.includes(selectedStock);
        })
        .slice(0, 4),
    [news, selectedStock]
  );
  const showAccountCloudInLeftDock = activeWorkspace === "settings";

  useEffect(() => {
    saveSetting("sb_advanced_mode", advancedMode);
  }, [advancedMode]);

  useEffect(() => {
    if (!advancedMode && advancedWorkspaceIds.has(activeWorkspace)) {
      setActiveWorkspace("charts");
    }
  }, [activeWorkspace, advancedMode, setActiveWorkspace]);

  useEffect(() => {
    if (!visibleRightPanelTabs.some((tab) => tab.id === rightTab)) {
      setRightTab("intel");
    }
  }, [rightTab, setRightTab, visibleRightPanelTabs]);

  function renderChartPanel(chartProps) {
    return (
      <ChartPanel
        {...chartProps}
        theme={theme}
        allSymbols={allSymbols}
        viewportWidth={viewportWidth}
        panelStyle={panelStyle}
        buttonStyle={buttonStyle}
        timeframeButtonStyle={timeframeButtonStyle}
        showIndicators={showIndicators}
        setShowIndicators={setShowIndicators}
        showEMA9={showEMA9}
        setShowEMA9={setShowEMA9}
        showEMA20={showEMA20}
        setShowEMA20={setShowEMA20}
        takeScreenshot={takeScreenshot}
        toggleFullscreen={toggleFullscreen}
        chartAreaRef={chartAreaRef}
        initialLivePulse={initialLivePulse}
        replayMode={replayMode}
        replayIndex={replayIndex}
        setMainReplayData={setMainReplayData}
        replayTrades={replayTrades}
        brokerApiUrl={BROKER_API_URL}
        advancedMode={advancedMode}
      />
    );
  }

  function renderIntelligenceDock() {
    const dockPrice = Number(selectedDockStock?.price || selectedStockData?.price || 0);
    const dockChange = String(selectedDockStock?.changePercent || selectedDockStock?.change || selectedStockData?.change || "0%");
    const dockMove = Number(String(dockChange).replace("%", "")) || 0;
    const dockRisk = selectedDockStock?.riskLabel || selectedDockStock?.risk || "Context";
    const dockCatalyst =
      selectedTickerNews[0]?.headline ||
      selectedDockStock?.catalyst ||
      selectedDockStock?.whyMoving ||
      "Monitoring chart, scanner, and headline context.";

    return (
      <div style={{ display: "grid", gap: "10px" }}>
        <div
          style={{
            background: theme.panel2,
            border: `1px solid ${theme.borderSoft || theme.border}`,
            borderRadius: "8px",
            padding: "10px",
          }}
        >
          <div style={{ color: theme.text, fontSize: "12px", fontWeight: 950 }}>
            {selectedStock} Market Intelligence
          </div>
          <div style={{ marginTop: "4px", color: theme.muted, fontSize: "10px", lineHeight: 1.45 }}>
            Selected ticker context, catalyst tape, and data confidence. Live trading locked; broker execution stays behind Advanced.
          </div>
          <div
            style={{
              marginTop: "8px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              border: `1px solid ${theme.amber}55`,
              borderRadius: "999px",
              padding: "4px 8px",
              color: theme.amber,
              background: "rgba(245,184,75,0.08)",
              fontSize: "9px",
              fontWeight: 950,
              textTransform: "uppercase",
              fontFamily: terminalMonoFont,
            }}
          >
            Live Trading Locked
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "9px" }}>
            {[
              ["Quote", selectedDataConfidence.quote?.label || "Pending", selectedDataConfidence.quote?.confidence],
              ["News", selectedDataConfidence.news?.label || "Pending", selectedDataConfidence.news?.confidence],
              ["Scanner", selectedDataConfidence.scanner?.label || "Pending", selectedDataConfidence.scanner?.confidence],
              ["Broker", qtrdHealth.tokenPersisted ? "Token Stored" : "Live Locked", qtrdHealth.confidence || "Limited"],
            ].map(([label, value, confidence]) => {
              const color = confidence === "High" ? theme.green : confidence === "Medium" ? theme.amber : theme.muted;

              return (
                <div
                  key={label}
                  style={{
                    border: `1px solid ${theme.borderSoft || theme.border}`,
                    borderRadius: "6px",
                    padding: "7px",
                    background: theme.panel,
                    minWidth: 0,
                  }}
                >
                  <div style={{ color: theme.muted, fontSize: "9px", fontWeight: 900, textTransform: "uppercase" }}>
                    {label}
                  </div>
                  <div
                    style={{
                      color,
                      fontSize: "10px",
                      fontWeight: 800,
                      marginTop: "3px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontFamily: terminalMonoFont,
                    }}
                  >
                    {value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            background: theme.panel2,
            border: `1px solid ${theme.borderSoft || theme.border}`,
            borderRadius: "8px",
            padding: "10px",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: "7px", alignItems: "center", minWidth: 0 }}>
                <span style={{ fontFamily: terminalMonoFont, color: theme.text, fontSize: "18px", fontWeight: 900 }}>
                  {selectedStock}
                </span>
                <span
                  style={{
                    color: hasSelectedInWatchlist ? theme.green : theme.cyan,
                    border: `1px solid ${(hasSelectedInWatchlist ? theme.green : theme.cyan)}55`,
                    borderRadius: "999px",
                    padding: "2px 6px",
                    fontSize: "8px",
                    fontWeight: 950,
                    textTransform: "uppercase",
                  }}
                >
                  {hasSelectedInWatchlist ? "Watching" : "Selected"}
                </span>
              </div>
              <div
                style={{
                  marginTop: "7px",
                  color: theme.muted,
                  fontSize: "10.5px",
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {dockCatalyst}
              </div>
            </div>
            <div style={{ textAlign: "right", minWidth: "78px" }}>
              <div style={{ fontFamily: terminalMonoFont, color: theme.text, fontSize: "15px", fontWeight: 900 }}>
                ${dockPrice.toFixed(2)}
              </div>
              <div style={{ fontFamily: terminalMonoFont, color: dockMove >= 0 ? theme.green : theme.red, fontSize: "11px", fontWeight: 900, marginTop: "4px" }}>
                {dockMove >= 0 ? "+" : ""}
                {dockMove.toFixed(2)}%
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px", marginTop: "10px" }}>
            {[
              ["Data", selectedDataConfidence.confidence],
              ["Source", selectedDataConfidence.scanner?.label || "Scanner"],
              ["Risk", dockRisk],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: `1px solid ${theme.borderSoft || theme.border}`,
                  borderRadius: "6px",
                  padding: "6px",
                  background: theme.panel,
                  minWidth: 0,
                }}
              >
                <div style={{ color: theme.muted, fontSize: "8px", fontWeight: 900, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontFamily: terminalMonoFont, color: label === "Data" && value === "High" ? theme.green : label === "Risk" ? theme.amber : theme.text, fontSize: "10px", fontWeight: 850, marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px", marginTop: "10px" }}>
            <button onClick={() => selectMainSymbol(selectedStock)} style={{ ...buttonStyle(true), height: "29px" }}>
              Open Chart
            </button>
            <button
              onClick={() => {
                if (liveStocks.some((stock) => stock.symbol === selectedStock)) {
                  removeWatchlistSymbol(selectedStock);
                } else {
                  addSymbolToWatchlist(selectedStock);
                }
              }}
              style={{ ...buttonStyle(false), height: "29px" }}
            >
              {hasSelectedInWatchlist ? "Watching" : "Watch"}
            </button>
          </div>
        </div>

        <div
          style={{
            background: theme.panel2,
            border: `1px solid ${theme.borderSoft || theme.border}`,
            borderRadius: "8px",
            padding: "10px",
          }}
        >
          <div style={{ color: theme.text, fontSize: "11px", fontWeight: 950, textTransform: "uppercase" }}>
            Catalyst Tape
          </div>
          <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
            {(selectedTickerNews.length ? selectedTickerNews : news.slice(0, 4)).map((item, index) => {
              const hasUrl = Boolean(item.url);
              const content = (
                <>
                  <div
                    style={{
                      color: theme.text,
                      fontSize: "11px",
                      fontWeight: 750,
                      lineHeight: 1.35,
                    }}
                  >
                    {item.headline}
                  </div>
                  <div
                    style={{
                      marginTop: "4px",
                      display: "flex",
                      gap: "6px",
                      color: theme.muted,
                      fontSize: "9px",
                      fontFamily: terminalMonoFont,
                    }}
                  >
                    <span>{item.relatedTicker || selectedStock}</span>
                    <span>{item.source || "News"}</span>
                  </div>
                </>
              );

              return hasUrl ? (
                <a
                  key={item.id || `${item.headline}-${index}`}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    textDecoration: "none",
                    display: "block",
                    borderTop: index === 0 ? "none" : `1px solid ${theme.borderSoft || theme.border}`,
                    paddingTop: index === 0 ? 0 : "8px",
                  }}
                >
                  {content}
                </a>
              ) : (
                <div
                  key={item.id || `${item.headline}-${index}`}
                  style={{
                    borderTop: index === 0 ? "none" : `1px solid ${theme.borderSoft || theme.border}`,
                    paddingTop: index === 0 ? 0 : "8px",
                  }}
                >
                  {content}
                </div>
              );
            })}
          </div>
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
        display: "flex",
        flexDirection: "column",
        fontFamily:
          "Roboto, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
        <TerminalTopBar
        theme={theme}
        workspaceViews={workspaceViews}
        activeWorkspace={activeWorkspace}
        setActiveWorkspace={setActiveWorkspace}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        gridMode={gridMode}
        setGridMode={setGridMode}
        syncCharts={syncCharts}
        setSyncCharts={setSyncCharts}
        replayMode={replayMode}
        setReplayMode={setReplayMode}
        resetReplay={resetReplay}
        wsStatus={wsStatus}
        mainChartStatus={mainChartStatus}
        marketDataStatusLabel={resolvedMarketDataStatusLabel}
        chartStatusLabel={mainChartSourceLabel}
        brokerStateLabel={brokerSourceLabel}
        modeStatusLabel={modeSourceLabel}
        brokerStatus={brokerStatus}
        brokerConnected={brokerConnected}
        isDark={isDark}
        setThemeMode={setThemeMode}
        saveWorkspaceToCloud={saveWorkspaceToCloud}
        loadWorkspaceFromCloud={loadWorkspaceFromCloud}
        resetWorkspace={resetWorkspace}
        layoutPresets={layoutPresets}
        activePreset={activePreset}
        applyLayoutPreset={applyLayoutPreset}
        marketRegions={marketRegions}
        marketRegion={marketRegion}
        setMarketRegion={setMarketRegion}
        activeMarket={activeMarket}
        buttonStyle={buttonStyle}
        user={user}
        compact={isCompactTerminal}
        advancedMode={advancedMode}
        setAdvancedMode={setAdvancedMode}
        selectedSymbol={selectedStock}
        onSymbolCommit={selectMainSymbol}
      />

      <TickerTape
        theme={theme}
        stocks={tickerTapeSymbols.slice(0, activeWorkspace === "intelligence" ? 14 : 20)}
        onPick={selectMainSymbol}
      />

      <ProductionHealthStrip
        theme={theme}
        terminalMonoFont={terminalMonoFont}
        backendLabel={backendHealthLabel}
        qtrdHealth={qtrdHealth}
        scannerLabel={scannerSourceLabel}
        scannerMessage={resolvedScannerMessage}
        newsLabel={resolvedNewsStatusLabel}
        newsMessage={resolvedNewsMessage}
        aiLabel={aiHealthLabel}
        aiMessage={aiHealthMessage}
        lastCheckedAt={healthLastCheckedAt}
        onRefresh={handleRefreshProductionHealth}
        refreshing={healthRefreshing}
      />

      <PanelGroup
        direction="horizontal"
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          padding: "6px",
          gap: "6px",
          overflow: "hidden",
        }}
      >
        <Panel id="sidebar-panel" order={1} defaultSize={sidebarPanelSize} minSize={sidebarPanelSize} maxSize={isPhoneTerminal ? 15 : 6}>
          <TradingSidebar
          activeWorkspace={activeWorkspace}
          setActiveWorkspace={setActiveWorkspace}
          brokerConnected={brokerConnected}
          advancedMode={advancedMode}
          brokerStatus={brokerStatus}
        />
        </Panel>

        <PanelResizeHandle id="sidebar-resize-handle" style={verticalResizeHandleStyle} />

        {showLeftDockPanel && (
          <>
            <Panel id="left-dock-panel" order={2} defaultSize={18} minSize={12} maxSize={32}>
              <div
          style={panelStyle({
            height: "100%",
            overflowY: "auto",
          })}
        >
          {panelTitle(
            activeWorkspace === "scanner"
              ? "Scanner Command Center"
              : activeWorkspace === "watchlist"
              ? "Watchlist"
              : activeWorkspace === "journal"
              ? "Trading Journal"
              : activeWorkspace === "settings"
              ? "Workspace Settings"
              : "Scanner + Watchlist"
          )}

          {activeWorkspace === "journal" && (
            <Suspense fallback={<LoadingPanel theme={theme} label="Loading journal" height="220px" />}>
              <JournalPanel
                theme={theme}
                buttonStyle={buttonStyle}
                draft={journalDraft}
                setDraft={setJournalDraft}
                entries={journalEntries}
                addEntry={addJournalEntry}
                deleteEntry={deleteJournalEntry}
                selectedStock={selectedStock}
                realizedPnL={realizedPnL}
                totalUnrealizedPnL={totalUnrealizedPnL}
                orders={orders}
                exportJournalCsv={exportJournalCsv}
                exportTradeSummaryCsv={exportTradeSummaryCsv}
                exportDailyReport={exportDailyReport}
                exportWeeklyReport={exportWeeklyReport}
                exportScreenshotJournalLink={exportScreenshotJournalLink}
              />
            </Suspense>
          )}

          {activeWorkspace === "settings" && (
            <div
              style={{
                background: theme.panel2,
                border: `1px solid ${theme.border}`,
                borderRadius: "6px",
                padding: "8px",
                fontSize: "11px",
                lineHeight: "1.6",
                marginBottom: "10px",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: "4px" }}>Workspace Controls</div>
              <div>Active View: {activeWorkspace}</div>
              <div>Preset: {layoutPresets[activePreset]?.label || "Custom"}</div>
              <div>Layout: {layoutMode} chart</div>
              <div>Sync: {syncCharts ? "On" : "Off"}</div>
              <div>Cloud: {user ? "Signed In" : "Local"}</div>
            </div>
          )}

          {activeWorkspace !== "journal" && (
          <>
          {sectionHeader("scanner", "Scanner", scannerLoading ? "Loading" : String(scannerStocks.length))}

          {leftSectionsOpen.scanner && (
            <Suspense fallback={<LoadingPanel theme={theme} label="Loading scanner" height="120px" />}>
              {scannerLoading ? (
                <LoadingPanel theme={theme} label="Loading scanner" height="120px" />
              ) : (
                <ProfessionalScanner
                  theme={theme}
                  scannerTab={scannerTab}
                  setScannerTab={setScannerTab}
                  scannerStocks={scannerStocks}
                  scannerMeta={scannerMeta}
                  selectMainSymbol={selectMainSymbol}
                  selectedScannerStock={selectedScannerStock}
                  addSymbolToWatchlist={addSymbolToWatchlist}
                />
              )}
            </Suspense>
          )}

          {sectionHeader("watchlist", "Watchlist", String(liveStocks.length))}

          <div style={{ position: "relative", marginBottom: "6px" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "8px",
                top: "8px",
                color: theme.muted,
                pointerEvents: "none",
              }}
            />
            <input
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") addSymbol();
              }}
              placeholder="AAPL, MSFT, SPY..."
              style={{
                width: "100%",
                padding: "7px 8px 7px 28px",
                background: theme.panel2,
                border: `1px solid ${theme.border}`,
                color: theme.text,
                borderRadius: "4px",
                fontSize: "11px",
              }}
            />
          </div>

          {symbolSuggestions.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "5px",
                marginBottom: "6px",
              }}
            >
              {symbolSuggestions.map((stock) => (
                <button
                  key={stock.symbol}
                  onClick={() => addSymbolToWatchlist(stock.symbol)}
                  title={`Add ${stock.symbol}`}
                  style={{
                    ...buttonStyle(false),
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "4px",
                    padding: "0 7px",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {stock.symbol}
                  </span>
                  <Plus size={13} />
                </button>
              ))}
            </div>
          )}

          <button
            onClick={addSymbol}
            style={{
              ...buttonStyle(true),
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              height: "28px",
              marginBottom: "7px",
            }}
          >
            <Plus size={12} />
            <span>Add Symbol</span>
          </button>

          {showAccountCloudInLeftDock && (
          <>
          {sectionHeader("account", "Account + Cloud", user ? "Signed in" : "Local")}

          {leftSectionsOpen.account && (user ? (
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
            <div style={{ minWidth: 0 }}>
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
          ))}
          </>
          )}

          {leftSectionsOpen.watchlist && liveStocks.length === 0 && (
            emptyState("Watchlist is empty", "Add a symbol above to start tracking live quotes.")
          )}

          {leftSectionsOpen.watchlist && liveStocks.map((stock) => (
            <div
              key={stock.symbol}
              onClick={() => selectMainSymbol(stock.symbol)}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 24px",
                gap: "5px",
                alignItems: "center",
                padding: "5px 0",
                borderBottom: `1px solid ${theme.border}`,
                cursor: "pointer",
                color: selectedStock === stock.symbol ? theme.blue : theme.text,
                fontWeight: selectedStock === stock.symbol ? 900 : 500,
                fontSize: "11px",
              }}
            >
              <span>{stock.symbol}</span>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  removeWatchlistSymbol(stock.symbol);
                }}
                title={`Remove ${stock.symbol}`}
                style={{
                  width: "22px",
                  height: "22px",
                  display: "grid",
                  placeItems: "center",
                  background: "transparent",
                  border: `1px solid ${theme.border}`,
                  color: theme.muted,
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}

          {sectionHeader("movers", "Small Cap Movers", String(liveSmallCapMovers.length))}

          {leftSectionsOpen.movers && (
            <ScannerTable
              rows={liveSmallCapMovers}
              onPick={selectMainSymbol}
              theme={theme}
            />
          )}
          </>
          )}
        </div>
            </Panel>

            <PanelResizeHandle id="left-dock-resize-handle" style={verticalResizeHandleStyle} />
          </>
        )}

        <Panel id="workspace-panel" order={3} defaultSize={workspaceDefaultSize} minSize={workspaceMinSize}>
          <div
          style={{
            display: "grid",
            gridTemplateRows: centerRows,
            gap: "6px",
            height: "100%",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {activeWorkspace === "intelligence" ? (
            <Suspense fallback={<LoadingPanel theme={theme} label="Loading market intelligence" />}>
              <MarketIntelligenceTerminal
                theme={theme}
                brokerApiUrl={BROKER_API_URL}
                user={user}
                localWatchlist={liveStocks}
                addSymbolToWatchlist={addSymbolToWatchlist}
                removeWatchlistSymbol={removeWatchlistSymbol}
                selectMainSymbol={selectMainSymbol}
                selectedStock={selectedStock}
              />
            </Suspense>
          ) : (
            <WorkspaceGrid
              theme={theme}
              layoutMode={layoutMode}
              gridMode={gridMode}
              renderChartPanel={renderChartPanel}
              selectedStock={selectedStock}
              setMainSymbol={selectMainSymbol}
              secondarySymbol={secondarySymbol}
              setSecondarySymbol={setSecondarySymbol}
              timeframe={timeframe}
              setMainTimeframe={setMainTimeframe}
              secondaryTimeframe={secondaryTimeframe}
              setSecondaryTimeframe={setSecondaryTimeframe}
              selectedStockData={selectedStockData}
              secondaryStockData={secondaryStockData}
              allSymbols={allSymbols}
              mainChartStatus={mainChartStatus}
              secondaryChartStatus={secondaryChartStatus}
              setMainChartStatus={setMainChartStatus}
              setSecondaryChartStatus={setSecondaryChartStatus}
              syncCharts={syncCharts}
              compact={isPhoneTerminal}
            />
          )}

          {(activeWorkspace === "charts" || activeWorkspace === "broker" || activeWorkspace === "replay") && (
            <MarketNewsPanel
              news={news}
              newsLoading={newsLoading}
              newsMeta={newsMeta}
              selectedStock={selectedStock}
              dataConfidence={selectedDataConfidence}
              theme={theme}
              terminalMonoFont={terminalMonoFont}
            />
          )}
        </div>
        </Panel>

        <RightTradingPanel showRightDock={showRightDockPanel}>
            <PanelResizeHandle id="right-dock-resize-handle" style={verticalResizeHandleStyle} />
            <Panel id="right-dock-panel" order={4} defaultSize={20} minSize={15} maxSize={35}>
              <div
                style={panelStyle({
                  height: "100%",
                  overflowY: "auto",
                })}
              >
                {panelTitle(advancedMode ? "Advanced Console" : "Market Intelligence")}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))",
                    gap: "5px",
                    marginBottom: "10px",
                    padding: "5px",
                    background: theme.panel,
                    border: `1px solid ${theme.borderSoft || theme.border}`,
                    borderRadius: "8px",
                  }}
                >
                  {visibleRightPanelTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setRightTab(tab.id)}
                      style={{
                        ...buttonStyle(rightTab === tab.id),
                        height: "28px",
                        minWidth: 0,
                        padding: "0 6px",
                        fontSize: "10px",
                        borderColor: rightTab === tab.id ? "rgba(25,198,216,0.7)" : "transparent",
                        background: rightTab === tab.id
                          ? `linear-gradient(180deg, ${theme.blue}, #1765c6)`
                          : "transparent",
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <Suspense fallback={<LoadingPanel theme={theme} label="Loading trading panels" height="180px" />}>
                  {rightTab === "intel" && renderIntelligenceDock()}

                  {rightTab === "order" && (
                    <OrderTicket
                      theme={theme}
                      buttonStyle={buttonStyle}
                      orderSide={orderSide}
                      setOrderSide={setOrderSide}
                      orderType={orderType}
                      setOrderType={setOrderType}
                      quantity={quantity}
                      setQuantity={setQuantity}
                      limitPrice={limitPrice}
                      setLimitPrice={setLimitPrice}
                      stopLoss={stopLoss}
                      setStopLoss={setStopLoss}
                      takeProfit={takeProfit}
                      setTakeProfit={setTakeProfit}
                      selectedStock={selectedStock}
                      selectedStockData={selectedStockData}
                      orderEntryPrice={orderEntryPrice}
                      estimatedValue={estimatedValue}
                      riskReward={riskReward}
                      orderRisk={orderRisk}
                      orderReward={orderReward}
                      tradingMode={tradingMode}
                      setTradingMode={setTradingMode}
                      orderConfirmed={orderConfirmed}
                      setOrderConfirmed={setOrderConfirmed}
                      maxOrderValue={maxOrderValue}
                      setMaxOrderValue={setMaxOrderValue}
                      dailyLossLimit={dailyLossLimit}
                      setDailyLossLimit={setDailyLossLimit}
                      riskPerTrade={riskPerTrade}
                      setRiskPerTrade={setRiskPerTrade}
                      orderPreview={orderPreview}
                      liveReadiness={liveReadiness}
                      liveOrderPreview={liveOrderPreview}
                      liveOrderLoading={liveOrderLoading}
                      orderConfirmationKey={orderConfirmationKey}
                      safetyIssues={safetyIssues}
                      previewLiveOrderTicket={previewLiveOrderTicket}
                      submitOrderTicket={submitOrderTicket}
                      orderMessage={orderMessage}
                    />
                  )}

                  {rightTab === "broker" && (
                    <>
                      <BrokerHeader
                        theme={theme}
                        brokerConnected={brokerConnected}
                        brokerStatus={brokerStatus}
                        brokerDetails={brokerDetails}
                        brokerError={brokerError}
                        brokerAccounts={brokerAccounts}
                        brokerLoading={brokerLoading}
                        selectedBrokerAccount={selectedBrokerAccount}
                        setSelectedBrokerAccount={setSelectedBrokerAccount}
                        refreshBroker={handleRefreshBroker}
                        loadBrokerAccountData={handleLoadBrokerAccountData}
                        primaryBrokerBalance={primaryBrokerBalance}
                        buttonStyle={buttonStyle}
                        brokerApiUrl={BROKER_API_URL}
                        platformHealth={platformHealth}
                        liveReadiness={liveReadiness}
                        brokerSyncMeta={brokerSyncMeta}
                        qtrdHealth={qtrdHealth}
                      />

                      <BrokerPositions
                        theme={theme}
                        brokerPositions={brokerPositions}
                        brokerOrders={brokerOrders}
                        brokerConnected={brokerConnected}
                        brokerSyncMeta={brokerSyncMeta}
                      />
                    </>
                  )}

                  {rightTab === "risk" && (
                    <>
                      <RiskDashboard
                        theme={theme}
                        positions={positions}
                        allSymbols={allSymbols}
                        orders={orders}
                        realizedPnL={realizedPnL}
                        totalUnrealizedPnL={totalUnrealizedPnL}
                        dailyLossLimit={dailyLossLimit}
                        maxOrderValue={maxOrderValue}
                        riskPerTrade={riskPerTrade}
                        primaryBrokerBalance={primaryBrokerBalance}
                        brokerPositions={brokerPositions}
                        brokerConnected={brokerConnected}
                        brokerSyncMeta={brokerSyncMeta}
                      />

                      <PaperAccountPanel
                        theme={theme}
                        selectedStock={selectedStock}
                        selectedStockData={selectedStockData}
                        orders={orders}
                        realizedPnL={realizedPnL}
                        totalUnrealizedPnL={totalUnrealizedPnL}
                      />

                      <OpenPositionsPanel
                        theme={theme}
                        positions={positions}
                        allSymbols={allSymbols}
                      />

                      <RecentOrdersPanel
                        theme={theme}
                        orders={orders}
                      />
                    </>
                  )}

                  {rightTab === "replay" && (
                    <ReplayPanel
                      theme={theme}
                      buttonStyle={buttonStyle}
                      replayPlaying={replayPlaying}
                      setReplayPlaying={setReplayPlaying}
                      stepReplay={stepReplay}
                      resetReplay={resetReplay}
                      replaySpeed={replaySpeed}
                      setReplaySpeed={setReplaySpeed}
                      replayBuy={replayBuy}
                      replaySell={replaySell}
                      replayIndex={replayIndex}
                      mainReplayData={mainReplayData}
                      replayCandle={replayCandle}
                      replayStats={replayStats}
                      replayTrades={replayTrades}
                      replayEquity={replayEquity}
                      selectedStock={selectedStock}
                      openReplayJournal={openReplayJournal}
                    />
                  )}

                  {rightTab === "activity" && (
                    <ActivityLogPanel
                      theme={theme}
                      activityLog={activityLog}
                      clearActivityLog={clearActivityLog}
                      buttonStyle={buttonStyle}
                    />
                  )}

                  {rightTab === "health" && (
                    <ProductionHealthPanel
                      theme={theme}
                      brokerApiUrl={BROKER_API_URL}
                      platformHealth={platformHealth}
                      brokerConnected={brokerConnected}
                      brokerDetails={brokerDetails}
                      brokerError={brokerError}
                      brokerSyncMeta={brokerSyncMeta}
                      scannerMeta={scannerMeta}
                      scannerLoading={scannerLoading}
                      wsStatus={wsStatus}
                      mainChartStatus={mainChartStatus}
                      refreshBroker={handleRefreshProductionHealth}
                      qtrdHealth={qtrdHealth}
                      buttonStyle={buttonStyle}
                    />
                  )}

                  {rightTab === "alerts" && (
                    <AlertsPanel
                      theme={theme}
                      buttonStyle={buttonStyle}
                      alertInput={alertInput}
                      setAlertInput={setAlertInput}
                      alertDirection={alertDirection}
                      setAlertDirection={setAlertDirection}
                      addPriceAlert={addPriceAlert}
                      alerts={alerts}
                      removeAlert={removeAlert}
                      alertNotifications={alertNotifications}
                      enableAlertNotifications={enableAlertNotifications}
                      selectedStockData={selectedStockData}
                    />
                  )}

                  {rightTab === "dom" && (
                    <DOMPanel
                      theme={theme}
                      ladderRows={ladderRows}
                      selectedStockData={selectedStockData}
                      level2={level2}
                    />
                  )}

                  {rightTab === "keys" && (
                    <ShortcutsPanel theme={theme} />
                  )}
                </Suspense>
              </div>
            </Panel>
          </RightTradingPanel>
      </PanelGroup>

      {isPhoneTerminal && activeWorkspace === "charts" && (
        <div
          style={{
            position: "fixed",
            left: "88px",
            right: "8px",
            bottom: mobileDockOpen ? "calc(58vh + 36px)" : "32px",
            zIndex: 45,
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "5px",
            padding: "5px",
            background: "rgba(5,7,13,0.92)",
            border: `1px solid ${theme.borderSoft || theme.border}`,
            borderRadius: "8px",
            boxShadow: "0 14px 34px rgba(0,0,0,0.35)",
            backdropFilter: "blur(10px)",
          }}
        >
          {[
            ["order", "Trade"],
            ["risk", "Risk"],
            ["replay", "Replay"],
            ["alerts", "Alerts"],
          ].map(([tabId, label]) => (
            <button
              key={tabId}
              onClick={() => openMobileDockTab(tabId)}
              style={{
                ...buttonStyle(rightTab === tabId && mobileDockOpen),
                height: "32px",
                minWidth: 0,
                padding: "0 5px",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isPhoneTerminal && mobileDockOpen && activeWorkspace === "charts" && (
        <div
          style={{
            position: "fixed",
            left: "82px",
            right: "6px",
            bottom: "30px",
            maxHeight: "58vh",
            zIndex: 50,
            background: `linear-gradient(180deg, ${theme.panel2}, ${theme.bg})`,
            border: `1px solid ${theme.borderSoft || theme.border}`,
            borderRadius: "10px 10px 8px 8px",
            boxShadow: "0 -18px 44px rgba(0,0,0,0.48)",
            overflow: "hidden",
            display: "grid",
            gridTemplateRows: "auto 1fr",
          }}
        >
          <div
            style={{
              height: "42px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              padding: "0 10px",
              borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ color: theme.text, fontSize: "12px", fontWeight: 950 }}>
                Mobile Trading Dock
              </div>
              <div style={{ color: theme.muted, fontSize: "9px", fontWeight: 850 }}>
                {selectedStock} · {rightPanelTabs.find((tab) => tab.id === rightTab)?.label || "Tools"}
              </div>
            </div>
            <button
              onClick={() => setMobileDockOpen(false)}
              title="Close mobile trading dock"
              style={{
                width: "30px",
                height: "30px",
                display: "grid",
                placeItems: "center",
                background: theme.panel,
                border: `1px solid ${theme.borderSoft || theme.border}`,
                color: theme.muted,
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ overflowY: "auto", padding: "9px" }}>
            <Suspense fallback={<LoadingPanel theme={theme} label="Loading mobile tools" height="180px" />}>
              {rightTab === "order" && (
                <OrderTicket
                  theme={theme}
                  buttonStyle={buttonStyle}
                  orderSide={orderSide}
                  setOrderSide={setOrderSide}
                  orderType={orderType}
                  setOrderType={setOrderType}
                  quantity={quantity}
                  setQuantity={setQuantity}
                  limitPrice={limitPrice}
                  setLimitPrice={setLimitPrice}
                  stopLoss={stopLoss}
                  setStopLoss={setStopLoss}
                  takeProfit={takeProfit}
                  setTakeProfit={setTakeProfit}
                  selectedStock={selectedStock}
                  selectedStockData={selectedStockData}
                  orderEntryPrice={orderEntryPrice}
                  estimatedValue={estimatedValue}
                  riskReward={riskReward}
                  orderRisk={orderRisk}
                  orderReward={orderReward}
                  tradingMode={tradingMode}
                  setTradingMode={setTradingMode}
                  orderConfirmed={orderConfirmed}
                  setOrderConfirmed={setOrderConfirmed}
                  maxOrderValue={maxOrderValue}
                  setMaxOrderValue={setMaxOrderValue}
                  dailyLossLimit={dailyLossLimit}
                  setDailyLossLimit={setDailyLossLimit}
                  riskPerTrade={riskPerTrade}
                  setRiskPerTrade={setRiskPerTrade}
                  orderPreview={orderPreview}
                  liveReadiness={liveReadiness}
                  liveOrderPreview={liveOrderPreview}
                  liveOrderLoading={liveOrderLoading}
                  orderConfirmationKey={orderConfirmationKey}
                  safetyIssues={safetyIssues}
                  previewLiveOrderTicket={previewLiveOrderTicket}
                  submitOrderTicket={submitOrderTicket}
                  orderMessage={orderMessage}
                  compact
                />
              )}

              {rightTab === "risk" && (
                <>
                  <RiskDashboard
                    theme={theme}
                    positions={positions}
                    allSymbols={allSymbols}
                    orders={orders}
                    realizedPnL={realizedPnL}
                    totalUnrealizedPnL={totalUnrealizedPnL}
                    dailyLossLimit={dailyLossLimit}
                    maxOrderValue={maxOrderValue}
                    riskPerTrade={riskPerTrade}
                    primaryBrokerBalance={primaryBrokerBalance}
                    brokerPositions={brokerPositions}
                    brokerConnected={brokerConnected}
                    brokerSyncMeta={brokerSyncMeta}
                  />

                  <PaperAccountPanel
                    theme={theme}
                    selectedStock={selectedStock}
                    selectedStockData={selectedStockData}
                    orders={orders}
                    realizedPnL={realizedPnL}
                    totalUnrealizedPnL={totalUnrealizedPnL}
                  />
                </>
              )}

              {rightTab === "broker" && (
                <>
                  <BrokerHeader
                    theme={theme}
                    brokerConnected={brokerConnected}
                    brokerStatus={brokerStatus}
                    brokerDetails={brokerDetails}
                    brokerError={brokerError}
                    brokerAccounts={brokerAccounts}
                    brokerLoading={brokerLoading}
                    selectedBrokerAccount={selectedBrokerAccount}
                    setSelectedBrokerAccount={setSelectedBrokerAccount}
                    refreshBroker={handleRefreshBroker}
                    loadBrokerAccountData={handleLoadBrokerAccountData}
                    primaryBrokerBalance={primaryBrokerBalance}
                    buttonStyle={buttonStyle}
                    brokerApiUrl={BROKER_API_URL}
                    platformHealth={platformHealth}
                    liveReadiness={liveReadiness}
                    brokerSyncMeta={brokerSyncMeta}
                    qtrdHealth={qtrdHealth}
                  />

                  <BrokerPositions
                    theme={theme}
                    brokerPositions={brokerPositions}
                    brokerOrders={brokerOrders}
                    brokerConnected={brokerConnected}
                    brokerSyncMeta={brokerSyncMeta}
                  />
                </>
              )}

              {rightTab === "replay" && (
                <ReplayPanel
                  theme={theme}
                  buttonStyle={buttonStyle}
                  replayPlaying={replayPlaying}
                  setReplayPlaying={setReplayPlaying}
                  stepReplay={stepReplay}
                  resetReplay={resetReplay}
                  replaySpeed={replaySpeed}
                  setReplaySpeed={setReplaySpeed}
                  replayBuy={replayBuy}
                  replaySell={replaySell}
                  replayIndex={replayIndex}
                  mainReplayData={mainReplayData}
                  replayCandle={replayCandle}
                  replayStats={replayStats}
                  replayTrades={replayTrades}
                  replayEquity={replayEquity}
                  selectedStock={selectedStock}
                  openReplayJournal={openReplayJournal}
                />
              )}

              {rightTab === "activity" && (
                <ActivityLogPanel
                  theme={theme}
                  activityLog={activityLog}
                  clearActivityLog={clearActivityLog}
                  buttonStyle={buttonStyle}
                />
              )}

              {rightTab === "health" && (
                <ProductionHealthPanel
                  theme={theme}
                  brokerApiUrl={BROKER_API_URL}
                  platformHealth={platformHealth}
                  brokerConnected={brokerConnected}
                  brokerDetails={brokerDetails}
                  brokerError={brokerError}
                  brokerSyncMeta={brokerSyncMeta}
                  scannerMeta={scannerMeta}
                  scannerLoading={scannerLoading}
                  wsStatus={wsStatus}
                  mainChartStatus={mainChartStatus}
                  refreshBroker={handleRefreshProductionHealth}
                  qtrdHealth={qtrdHealth}
                  buttonStyle={buttonStyle}
                />
              )}

              {rightTab === "alerts" && (
                <AlertsPanel
                  theme={theme}
                  buttonStyle={buttonStyle}
                  alertInput={alertInput}
                  setAlertInput={setAlertInput}
                  alertDirection={alertDirection}
                  setAlertDirection={setAlertDirection}
                  addPriceAlert={addPriceAlert}
                  alerts={alerts}
                  removeAlert={removeAlert}
                  alertNotifications={alertNotifications}
                  enableAlertNotifications={enableAlertNotifications}
                  selectedStockData={selectedStockData}
                />
              )}
            </Suspense>
          </div>
        </div>
      )}

      <TerminalStatusBar
        theme={theme}
        terminalMonoFont={terminalMonoFont}
        rows={
          advancedMode
            ? [
                ["Data", resolvedMarketDataStatusLabel],
                ["Backend", backendHealthLabel],
                ["Scanner", scannerSourceLabel],
                ["News", resolvedNewsStatusLabel],
                ["Broker", brokerSourceLabel],
                ["Mode", modeSourceLabel],
                ["Chart", mainChartSourceLabel],
                ["Main", selectedStock],
                ["Secondary", secondarySymbol],
                ["Layout", `${layoutMode} Chart`],
                ["P&L", `$${Number(realizedPnL).toFixed(2)}`],
                ["Cloud", user ? user.email : "Local"],
                ["Checked", healthLastCheckedAt ? new Date(healthLastCheckedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Pending"],
              ]
            : [
                ["Data", resolvedMarketDataStatusLabel],
                ["Scanner", scannerSourceLabel],
                ["News", resolvedNewsStatusLabel],
                ["Main", selectedStock],
                ["Checked", healthLastCheckedAt ? new Date(healthLastCheckedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Pending"],
              ]
        }
      />

      <Suspense fallback={null}>
        <CommandPalette
          theme={theme}
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          actions={commandActions}
        />
      </Suspense>
    </div>
  );
}
