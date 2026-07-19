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
import PublicOnboarding from "./components/PublicOnboarding";
import AuthGate from "./components/AuthGate";
import MarketSnapshotStrip from "./components/MarketSnapshotStrip";
import PremiumWorkspace from "./components/premium/PremiumWorkspace";
import { createButtonStyle, createPanelStyle } from "./components/uiPrimitives";
import {
  BROKER_TOOLS_ENABLED,
  BROKER_API_URL,
  LIVE_TRADING_ENABLED,
  defaultJournalDraft,
  defaultSmallCapMovers,
  layoutPresets,
  marketRegions,
  popularSymbols,
  rightPanelTabs,
  terminalMonoFont,
  terminalSansFont,
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
  formatTerminalStatusLabel,
} from "./utils/marketUtils";
import { getCleanProviderMessage, getQuestradeHealth } from "./utils/healthStatus";
import { loadSetting, removeSettings, saveSetting } from "./utils/storage";
import { getAuthHeaders } from "./services/authenticatedRequest";
import {
  DEFAULT_ENTITLEMENTS,
  fetchCurrentEntitlements,
} from "./services/entitlements";
import {
  getDefaultIndicatorState,
  normalizeIndicatorState,
} from "./indicators/chartIndicators";
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
const ExecutionAuditPanel = lazy(() => import("./components/ExecutionAuditPanel"));
const CommandPalette = lazy(() => import("./components/CommandPalette"));
const RiskDashboard = lazy(() => import("./components/RiskDashboard"));
const ShortcutsPanel = lazy(() => import("./components/ShortcutsPanel"));
const ActivityLogPanel = lazy(() => import("./components/ActivityLogPanel"));
const ProductionHealthPanel = lazy(() => import("./components/ProductionHealthPanel"));
const MarketIntelligenceTerminal = lazy(() => import("./components/MarketIntelligenceTerminal"));

const publicRightTabIds = new Set(["intel", "risk", "health", "alerts"]);
const brokerRightTabIds = new Set(["broker", "order", "audit", "replay", "activity", "dom", "keys"]);
const brokerWorkspaceIds = new Set(["broker", "portfolio"]);
const coreRightTabs = new Set(["intel", "health", "alerts"]);
const advancedWorkspaceIds = new Set(["broker", "portfolio"]);
const marketSnapshotSymbols = ["SPY", "QQQ", "DIA", "IWM", "VIXM"];

function isRightTabAllowed(tabId) {
  if (!BROKER_TOOLS_ENABLED) return publicRightTabIds.has(tabId);
  if (brokerRightTabIds.has(tabId)) return true;
  return true;
}

function isWorkspaceAllowed(workspaceId) {
  if (!BROKER_TOOLS_ENABLED && brokerWorkspaceIds.has(workspaceId)) return false;
  return true;
}

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
    return ["order", "broker", "risk", "replay", "activity", "health", "alerts", "audit"].includes(tabId) && isRightTabAllowed(tabId) ? tabId : null;
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
  const [marketSnapshotQuotes, setMarketSnapshotQuotes] = useState({});

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
    LIVE_TRADING_ENABLED ? loadSetting("sb_trading_mode", "paper") : "paper"
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
  const [orderAuditTrail, setOrderAuditTrail] = useState(() =>
    loadSetting("sb_order_audit_trail", [])
  );
  const [orderAuditSyncStatus, setOrderAuditSyncStatus] = useState("Local audit ready");
  const [positions, setPositions] = useState(() =>
    loadSetting("sb_positions", {})
  );
  const [realizedPnL, setRealizedPnL] = useState(() =>
    loadSetting("sb_realized_pnl", 0)
  );

  const [showIndicators, setShowIndicators] = useState(false);
  const [chartIndicators, setChartIndicators] = useState(() =>
    normalizeIndicatorState({
      ...loadSetting("sb_chart_indicators", {}),
      ema9: loadSetting("sb_show_ema9", true),
      ema20: loadSetting("sb_show_ema20", true),
    })
  );
  const [scannerTab, setScannerTab] = useState(() =>
    loadSetting("sb_scanner_tab", "Gainers")
  );
  const [scannerPresets, setScannerPresets] = useState(() =>
    loadSetting("sb_scanner_presets", [{ id: "default", name: "All results", minRvol: 0 }])
  );
  const [activeScannerPreset, setActiveScannerPreset] = useState(() =>
    loadSetting("sb_active_scanner_preset", "default")
  );
  const [premiumDockTab, setPremiumDockTab] = useState("positions");
  const [themeMode, setThemeMode] = useState(() =>
    loadSetting("sb_theme_mode", "dark")
  );
  const [timeZone, setTimeZone] = useState(() =>
    loadSetting("sb_time_zone", "America/Vancouver")
  );
  const [marketRegion, setMarketRegion] = useState(() =>
    loadSetting("sb_market_region", "us")
  );
  const [premiumPreferences, setPremiumPreferences] = useState(() => ({
    defaultLandingTab: "dashboard",
    compactMode: false,
    scannerAutoRefresh: true,
    relativeVolumeThreshold: "1.50",
    riskWarnings: true,
    notificationPreferences: {
      priceAlerts: true,
      newsCatalysts: false,
      soundAlerts: false,
    },
    scannerFilters: {},
    ...loadSetting("sb_premium_preferences", {}),
  }));

  const [journalEntries, setJournalEntries] = useState(() =>
    loadSetting("sb_journal_entries", [])
  );
  const [journalDraft, setJournalDraft] = useState(() =>
    loadSetting("sb_journal_draft", defaultJournalDraft)
  );
  const [replayBookmarks, setReplayBookmarks] = useState(() =>
    loadSetting("sb_replay_bookmarks", [])
  );
  const [replayNotes, setReplayNotes] = useState(() =>
    loadSetting("sb_replay_notes", "")
  );
  const [activityLog, setActivityLog] = useState(() =>
    loadSetting("sb_activity_log", [])
  );
  const [advancedMode, setAdvancedMode] = useState(() =>
    loadSetting("sb_advanced_mode", false)
  );
  const [publicOnboardingOpen, setPublicOnboardingOpen] = useState(() =>
    !BROKER_TOOLS_ENABLED && !loadSetting("sb_public_onboarding_dismissed", false)
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
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === "undefined" ? 900 : window.innerHeight
  );
  const [level2, setLevel2] = useState([]);

  const chartAreaRef = useRef(null);
  const brokerBootstrappedRef = useRef(false);
  const activitySequenceRef = useRef(0);
  const lastBrokerSyncLoggedRef = useRef(null);
  const lastBrokerErrorLoggedRef = useRef("");

  const isDark = themeMode === "dark";
  const isCompactTerminal = viewportWidth <= 1180;
  const isPhoneTerminal = viewportWidth <= 700;
  const effectiveTradingMode = LIVE_TRADING_ENABLED ? tradingMode : "paper";

  const theme = {
    mode: themeMode,
    isDark,
    bg: isDark ? "#040507" : "#eef3f8",
    panel: isDark ? "#0a0e15" : "#ffffff",
    panel2: isDark ? "#0f141d" : "#f7f9fc",
    panel3: isDark ? "#141b27" : "#eef3f8",
    card: isDark ? "#0b1018" : "#ffffff",
    border: isDark ? "#242c38" : "#d7dde8",
    borderSoft: isDark ? "#182130" : "#e4e9f1",
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

  const pushOrderAudit = useCallback((entry) => {
    const timestamp = entry.timestamp || new Date().toISOString();
    const nextEntry = {
      id: entry.id || `AUD-${Date.now().toString(36).toUpperCase()}`,
      timestamp,
      symbol: entry.symbol || null,
      side: entry.side || null,
      quantity: Number(entry.quantity || 0),
      orderType: entry.orderType || "MARKET",
      limitPrice: entry.limitPrice ?? null,
      entryPrice: Number(entry.entryPrice || 0),
      stopLoss: Number(entry.stopLoss || 0),
      takeProfit: Number(entry.takeProfit || 0),
      orderValue: Number(entry.orderValue || 0),
      orderRisk: Number(entry.orderRisk || 0),
      orderReward: Number(entry.orderReward || 0),
      riskReward: Number(entry.riskReward || 0),
      tradingMode: entry.tradingMode || "paper",
      brokerConnected: Boolean(entry.brokerConnected),
      accountId: entry.accountId || null,
      result: entry.result || "recorded",
      reason: entry.reason || "",
      requestId: entry.requestId || null,
      syncStatus: "pending",
      syncMessage: "Sync pending",
    };

    setOrderAuditTrail((prev) => [nextEntry, ...prev].slice(0, 150));
    setOrderAuditSyncStatus("Syncing latest audit row");

    getAuthHeaders({ "Content-Type": "application/json" })
      .then((headers) => fetchWithTimeout(`${BROKER_API_URL}/api/audit/orders`, 6000, {
        method: "POST",
        headers,
        body: JSON.stringify(nextEntry),
      }))
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload.synced === false) {
          throw new Error(payload.validationErrors?.[0] || payload.error || "Backend audit sync failed.");
        }

        setOrderAuditTrail((prev) =>
          prev.map((item) =>
            item.id === nextEntry.id
              ? {
                  ...item,
                  syncStatus: "synced",
                  syncMessage: "Backend synced",
                  requestId: payload.requestId || item.requestId,
                }
              : item
          )
        );
        setOrderAuditSyncStatus("Backend audit synced");
      })
      .catch(() => {
        setOrderAuditTrail((prev) =>
          prev.map((item) =>
            item.id === nextEntry.id
              ? {
                  ...item,
                  syncStatus: "local",
                  syncMessage: "Local fallback",
                }
              : item
          )
        );
        setOrderAuditSyncStatus("Local fallback active");
      });

    return nextEntry;
  }, []);

  const clearOrderAuditTrail = useCallback(() => {
    setOrderAuditTrail([]);
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
    autoRefresh: premiumPreferences.scannerAutoRefresh !== false,
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
      (fmpSmallCaps.length ? fmpSmallCaps : defaultSmallCapMovers).map((stock) => ({
        ...applyLiveQuote(stock, liveQuotes),
        fallback: !fmpSmallCaps.length,
        degraded: !fmpSmallCaps.length,
        source: fmpSmallCaps.length ? stock.source || "FMP Scanner" : "Fallback Context",
      })),
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
  const marketSnapshotStocks = useMemo(
    () => [...Object.values(marketSnapshotQuotes), ...allSymbols],
    [allSymbols, marketSnapshotQuotes]
  );

  const {
    news,
    newsLoading,
    newsMeta,
    newsStatusLabel,
    refreshNews,
  } = useMarketNews({
    selectedStock,
    brokerApiUrl: BROKER_API_URL,
    scannerRows: scannerStocks,
  });

  const {
    alertDirection,
    alertInput,
    alertNotifications,
    alerts,
    addPriceAlert,
    createPriceAlert,
    enableAlertNotifications,
    removeAlert,
    setAlertDirection,
    setAlertInput,
    setAlerts,
    toggleAlert,
    updateAlert,
  } = useTerminalAlerts({
    selectedStock,
    selectedStockData,
    quotes: allSymbols,
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
    setReplayBookmarks([]);
    setReplayNotes("");
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
    riskGuard,
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
    tradingMode: effectiveTradingMode,
  });

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
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
      orderAuditTrail,
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
      timeZone,
      premiumPreferences,
      chartIndicators,
      scannerTab,
      scannerPresets,
      activeScannerPreset,
      replayMode,
      replaySpeed,
      replayIndex,
      replayTrades,
      replayEquity,
      replayBookmarks,
      replayNotes,
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
      orderAuditTrail,
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
      timeZone,
      premiumPreferences,
      chartIndicators,
      scannerTab,
      scannerPresets,
      activeScannerPreset,
      replayMode,
      replaySpeed,
      replayIndex,
      replayTrades,
      replayEquity,
      replayBookmarks,
      replayNotes,
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
    if (Array.isArray(data.orderAuditTrail)) setOrderAuditTrail(data.orderAuditTrail);
    if (data.positions) setPositions(data.positions);
    if (typeof data.realizedPnL === "number") setRealizedPnL(data.realizedPnL);
    if (Array.isArray(data.alerts)) setAlerts(data.alerts);
    if (data.tradingMode) setTradingMode(LIVE_TRADING_ENABLED ? data.tradingMode : "paper");
    if (typeof data.maxOrderValue !== "undefined") setMaxOrderValue(data.maxOrderValue);
    if (typeof data.dailyLossLimit !== "undefined") setDailyLossLimit(data.dailyLossLimit);
    if (typeof data.riskPerTrade !== "undefined") setRiskPerTrade(data.riskPerTrade);
    if (data.marketRegion) setMarketRegion(data.marketRegion);
    if (data.themeMode) setThemeMode(data.themeMode);
    if (data.timeZone) setTimeZone(data.timeZone);
    if (data.premiumPreferences && typeof data.premiumPreferences === "object") {
      setPremiumPreferences((current) => ({ ...current, ...data.premiumPreferences }));
    }
    if (data.chartIndicators) {
      setChartIndicators(normalizeIndicatorState(data.chartIndicators));
    } else if (typeof data.showEMA9 === "boolean" || typeof data.showEMA20 === "boolean") {
      setChartIndicators((current) =>
        normalizeIndicatorState({
          ...current,
          ...(typeof data.showEMA9 === "boolean" ? { ema9: data.showEMA9 } : {}),
          ...(typeof data.showEMA20 === "boolean" ? { ema20: data.showEMA20 } : {}),
        })
      );
    }
    if (data.scannerTab) setScannerTab(data.scannerTab);
    if (Array.isArray(data.scannerPresets)) setScannerPresets(data.scannerPresets);
    if (data.activeScannerPreset) setActiveScannerPreset(data.activeScannerPreset);
    if (typeof data.replayMode === "boolean") setReplayMode(data.replayMode);
    if (typeof data.replaySpeed !== "undefined") setReplaySpeed(data.replaySpeed);
    if (typeof data.replayIndex === "number") setReplayIndex(data.replayIndex);
    if (Array.isArray(data.replayTrades)) setReplayTrades(data.replayTrades);
    if (Array.isArray(data.replayEquity)) setReplayEquity(data.replayEquity);
    if (Array.isArray(data.replayBookmarks)) setReplayBookmarks(data.replayBookmarks);
    if (typeof data.replayNotes === "string") setReplayNotes(data.replayNotes);
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
    authBusy,
    authEmail,
    authMessage,
    authMode,
    authPassword,
    authReady,
    cloudStatus,
    handleAuthSubmit,
    handleLogout,
    handlePasswordReset,
    handlePasswordUpdate,
    isAuthConfigured,
    loadWorkspaceFromCloud,
    passwordRecovery,
    saveWorkspaceToCloud,
    setAuthEmail,
    setAuthMode,
    setAuthPassword,
    user,
  } = useCloudWorkspace({
    applyWorkspace,
    pushActivity,
    resetWorkspace,
    workspacePayload,
  });
  const [entitlements, setEntitlements] = useState(DEFAULT_ENTITLEMENTS);
  const [entitlementsStatus, setEntitlementsStatus] = useState("idle");
  const entitlementUserId = user?.id;

  useEffect(() => {
    let cancelled = false;
    if (!entitlementUserId) {
      return () => {
        cancelled = true;
      };
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);

    fetchCurrentEntitlements({ signal: controller.signal })
      .then((payload) => {
        if (cancelled) return;
        setEntitlements({
          ...DEFAULT_ENTITLEMENTS,
          ...(payload || {}),
          userId: entitlementUserId,
          capabilities: {
            ...DEFAULT_ENTITLEMENTS.capabilities,
            ...(payload?.capabilities || {}),
          },
        });
        setEntitlementsStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setEntitlements({
          ...DEFAULT_ENTITLEMENTS,
          userId: entitlementUserId,
        });
        setEntitlementsStatus("degraded");
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [entitlementUserId]);
  const activeUser = user;
  const effectiveEntitlements = activeUser ? entitlements : DEFAULT_ENTITLEMENTS;
  const effectiveEntitlementsStatus = activeUser ? entitlementsStatus : "idle";

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
  const openPublicOnboarding = useCallback(() => {
    setPublicOnboardingOpen(true);
  }, []);
  const closePublicOnboarding = useCallback(() => {
    setPublicOnboardingOpen(false);
  }, []);
  const dismissPublicOnboarding = useCallback(() => {
    saveSetting("sb_public_onboarding_dismissed", true);
    setPublicOnboardingOpen(false);
  }, []);

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
    if (!BROKER_TOOLS_ENABLED) {
      pushActivity({
        type: "system",
        status: "info",
        title: "Broker Tools Hidden",
        detail: "Public product mode keeps personal broker tools disabled.",
      });
      return;
    }

    pushActivity({
      type: "broker",
      status: "info",
      title: "Broker Refresh Requested",
      detail: "Refreshing broker status, accounts, balances, positions, and orders.",
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
      detail: "Refreshing backend, broker, scanner, and news status.",
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
    if (!BROKER_TOOLS_ENABLED) return;

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
        replayNotes ? `Session notes: ${replayNotes}` : "Session notes: none",
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

    const workspaceActions = workspaceViews.filter((view) => isWorkspaceAllowed(view.id)).map((view) => ({
      id: `workspace-${view.id}`,
      label: `Go to ${view.label}`,
      detail: "Switch workspace",
      group: "Workspace",
      keywords: `workspace view ${view.id}`,
      onRun: () => setActiveWorkspace(view.id),
    }));

    const rightTabActions = rightPanelTabs.filter((tab) => isRightTabAllowed(tab.id)).map((tab) => ({
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
        keywords: "ema vwap indicators chart",
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
      "sb_time_zone",
      "sb_market_region",
      "sb_premium_preferences",
      "sb_chart_indicators",
      "sb_show_ema9",
      "sb_show_ema20",
      "sb_scanner_tab",
      "sb_scanner_presets",
      "sb_active_scanner_preset",
      "sb_watchlist",
      "sb_orders",
      "sb_order_audit_trail",
      "sb_positions",
      "sb_realized_pnl",
      "sb_alerts",
      "sb_replay_bookmarks",
      "sb_replay_notes",
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
    setTimeZone("America/Vancouver");
    setMarketRegion("us");
    setPremiumPreferences({
      defaultLandingTab: "dashboard",
      compactMode: false,
      scannerAutoRefresh: true,
      relativeVolumeThreshold: "1.50",
      riskWarnings: true,
      notificationPreferences: {
        priceAlerts: true,
        newsCatalysts: false,
        soundAlerts: false,
      },
      scannerFilters: {},
    });
    setChartIndicators(getDefaultIndicatorState());
    setScannerTab("Gainers");
    setScannerPresets([{ id: "default", name: "All results", minRvol: 0 }]);
    setActiveScannerPreset("default");
    setOrders([]);
    setOrderAuditTrail([]);
    setPositions({});
    setRealizedPnL(0);
    setAlerts([]);
    setReplayBookmarks([]);
    setReplayNotes("");
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
    if (!BROKER_TOOLS_ENABLED || !brokerConnected) return false;

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
  }, [brokerConnected, positions, quantity, realizedPnL, selectedStock, selectedStockData?.price]);

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

  function buildOrderAuditRecord(sideOverride, result, reason = "", overrides = {}) {
    const qty = Number(overrides.quantity ?? quantity ?? 0);
    const currentPrice = Number(selectedStockData?.price || 0);
    const entryPrice = Number(
      overrides.entryPrice ??
        (orderType === "LIMIT" && Number(limitPrice) > 0 ? Number(limitPrice) : currentPrice)
    );
    const value = Number(overrides.orderValue ?? entryPrice * qty);

    return {
      id: overrides.id,
      timestamp: overrides.timestamp,
      symbol: overrides.symbol || selectedStock,
      side: sideOverride,
      quantity: qty,
      orderType,
      limitPrice: orderType === "LIMIT" ? Number(limitPrice || 0) : null,
      entryPrice,
      stopLoss: Number(stopLoss || 0),
      takeProfit: Number(takeProfit || 0),
      orderValue: value,
      orderRisk: Number(overrides.orderRisk ?? orderRisk ?? 0),
      orderReward: Number(overrides.orderReward ?? orderReward ?? 0),
      riskReward: Number(overrides.riskReward ?? riskReward ?? 0),
      tradingMode: effectiveTradingMode,
      brokerConnected: BROKER_TOOLS_ENABLED && brokerConnected,
      accountId: BROKER_TOOLS_ENABLED ? selectedBrokerAccount : null,
      result,
      reason,
      requestId: overrides.requestId,
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

    if (!BROKER_TOOLS_ENABLED || !brokerConnected) {
      const reason = "Order review prepared. Execution requires an active supported broker connection.";
      setOrderMessage(reason);
      pushOrderAudit(buildOrderAuditRecord(sideOverride, "review_only", reason));
      pushActivity({
        type: "order",
        status: "review",
        title: "Order Review Prepared",
        detail: reason,
        symbol: selectedStock,
      });
      return;
    }

    const qty = Number(quantity);
    const currentPrice = Number(selectedStockData?.price || 0);
    const entryPrice =
      orderType === "LIMIT" && Number(limitPrice) > 0
        ? Number(limitPrice)
        : currentPrice;

    if (!qty || qty <= 0) {
      setOrderMessage("Enter a valid quantity.");
      pushOrderAudit(buildOrderAuditRecord(sideOverride, "blocked", "Invalid quantity."));
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
      pushOrderAudit(buildOrderAuditRecord(sideOverride, "blocked", "Invalid entry price.", { entryPrice }));
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
      pushOrderAudit(buildOrderAuditRecord(sideOverride, "blocked", "Limit order missing limit price.", { entryPrice }));
      pushActivity({
        type: "order",
        status: "blocked",
        title: "Limit Order Blocked",
        detail: "Limit order was blocked because no limit price was provided.",
        symbol: selectedStock,
      });
      return;
    }

    if (effectiveTradingMode !== "paper") {
      if (safetyIssues.length > 0) {
        setOrderMessage(safetyIssues[0]);
        pushOrderAudit(buildOrderAuditRecord(sideOverride, "blocked", safetyIssues[0], { entryPrice }));
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
        pushOrderAudit(buildOrderAuditRecord(sideOverride, "cancelled", "User cancelled live submission before backend request.", { entryPrice }));
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
        setOrderMessage(`${sideOverride} ${qty} ${selectedStock} submitted through broker route.`);
        setOrderConfirmed(false);
        pushOrderAudit(buildOrderAuditRecord(sideOverride, "submitted", "Live order submitted through backend safety gate.", {
          entryPrice,
          requestId: response.requestId,
        }));
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
      pushOrderAudit(buildOrderAuditRecord(sideOverride, response?.error ? "failed" : "blocked", firstBlock || "Backend safety gate rejected the live order.", {
        entryPrice,
        requestId: response?.requestId,
      }));
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
      pushOrderAudit(buildOrderAuditRecord(sideOverride, "blocked", safetyIssues[0], { entryPrice }));
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
      pushOrderAudit(buildOrderAuditRecord(sideOverride, "cancelled", "User cancelled paper order before execution.", {
        id: auditId,
        timestamp: submittedAt,
        entryPrice,
      }));
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
      pushOrderAudit(buildOrderAuditRecord(sideOverride, "simulated", `Paper ${sideOverride.toLowerCase()} filled in local simulator.`, {
        id: auditId,
        timestamp: submittedAt,
        entryPrice,
        quantity: result.filledQty,
        orderValue: Number(entryPrice * result.filledQty),
      }));
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
      pushOrderAudit(buildOrderAuditRecord(sideOverride, "blocked", `No ${selectedStock} paper position was available to sell.`, {
        id: auditId,
        timestamp: submittedAt,
        entryPrice,
      }));
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
    if (!BROKER_TOOLS_ENABLED) return;
    if (brokerBootstrappedRef.current) return;

    brokerBootstrappedRef.current = true;
    Promise.resolve().then(handleRefreshBroker);
  }, [handleRefreshBroker]);

  useEffect(() => {
    if (!BROKER_TOOLS_ENABLED) return;
    if (selectedBrokerAccount) {
      Promise.resolve().then(() => handleLoadBrokerAccountData(selectedBrokerAccount));
    }
  }, [handleLoadBrokerAccountData, selectedBrokerAccount]);

  useEffect(() => {
    if (!BROKER_TOOLS_ENABLED || !LIVE_TRADING_ENABLED) return;
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
    if (!authReady || !user?.id) {
      return undefined;
    }

    let cancelled = false;

    async function loadBackendAuditTrail() {
      try {
        const headers = await getAuthHeaders();
        if (!headers.Authorization) {
          if (!cancelled) setOrderAuditSyncStatus("Local audit ready");
          return;
        }

        const response = await fetchWithTimeout(
          `${BROKER_API_URL}/api/audit/orders?limit=80`,
          6000,
          { headers }
        );
        const payload = await response.json();

        if (!response.ok) throw new Error(payload?.error || "Backend audit unavailable.");
        if (cancelled || !Array.isArray(payload.entries)) return;

        const syncedEntries = payload.entries.map((entry) => ({
          ...entry,
          syncStatus: "synced",
          syncMessage: "Backend synced",
        }));

        setOrderAuditTrail((prev) => {
          const byId = new Map();

          [...prev, ...syncedEntries].forEach((entry) => {
            if (!entry?.id) return;

            byId.set(entry.id, {
              ...byId.get(entry.id),
              ...entry,
            });
          });

          return Array.from(byId.values())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 150);
        });
        setOrderAuditSyncStatus(payload.count ? "Backend audit loaded" : "Backend audit ready");
      } catch {
        if (!cancelled) setOrderAuditSyncStatus("Local fallback active");
      }
    }

    loadBackendAuditTrail();

    return () => {
      cancelled = true;
    };
  }, [authReady, user?.id]);

  useEffect(() => {
    saveSetting("sb_timeframe", timeframe);
    saveSetting("sb_secondary_timeframe", secondaryTimeframe);
    saveSetting("sb_theme_mode", themeMode);
    saveSetting("sb_time_zone", timeZone);
    saveSetting("sb_market_region", marketRegion);
    saveSetting("sb_premium_preferences", premiumPreferences);
    saveSetting("sb_chart_indicators", chartIndicators);
    saveSetting("sb_scanner_tab", scannerTab);
    saveSetting("sb_scanner_presets", scannerPresets);
    saveSetting("sb_active_scanner_preset", activeScannerPreset);
    saveSetting("sb_orders", orders);
    saveSetting("sb_order_audit_trail", orderAuditTrail);
    saveSetting("sb_positions", positions);
    saveSetting("sb_realized_pnl", realizedPnL);
    saveSetting("sb_alerts", alerts);
    saveSetting("sb_replay_bookmarks", replayBookmarks);
    saveSetting("sb_replay_notes", replayNotes);
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
    timeZone,
    marketRegion,
    premiumPreferences,
    chartIndicators,
    scannerTab,
    scannerPresets,
    activeScannerPreset,
    orders,
    orderAuditTrail,
    positions,
    realizedPnL,
    alerts,
    replayBookmarks,
    replayNotes,
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

    const refreshMarketSnapshot = async () => {
      try {
        const response = await fetchWithTimeout(
          `${BROKER_API_URL}/api/questrade/quotes?symbols=${encodeURIComponent(marketSnapshotSymbols.join(","))}`,
          8000
        );

        if (!response.ok) return;

        const payload = await response.json();
        const quotes = Array.isArray(payload.quotes) ? payload.quotes : [];
        const nextQuotes = {};

        quotes.forEach((quote) => {
          const symbol = String(quote.symbol || "").trim().toUpperCase();
          const price = Number(quote.price ?? quote.lastTradePrice ?? quote.last ?? 0);
          const changePercent = Number(quote.changePercent ?? quote.percentChange);

          if (!symbol || price <= 0 || !Number.isFinite(price)) return;

          nextQuotes[symbol] = {
            symbol,
            price: price.toFixed(2),
            change: Number.isFinite(changePercent)
              ? `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`
              : quote.change || null,
            changePercent: Number.isFinite(changePercent) ? changePercent : null,
            volume: quote.volume || quote.tradeVolume || quote.volumeTotal || "QUOTE",
            source: quote.delayed ? "QTRD DELAYED" : "QTRD",
            delayed: Boolean(quote.delayed),
            realtime: quote.realtime !== false,
            lastTradeTime: quote.lastTradeTime || payload.updatedAt || null,
          };
        });

        if (!cancelled && Object.keys(nextQuotes).length) {
          setMarketSnapshotQuotes(nextQuotes);
        }
      } catch {
        // Keep the strip in a truthful unavailable state if the quote bridge fails.
      }
    };

    refreshMarketSnapshot();
    const interval = setInterval(refreshMarketSnapshot, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!BROKER_TOOLS_ENABLED) {
      return undefined;
    }
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
    (BROKER_TOOLS_ENABLED && activeWorkspace === "broker") ||
    activeWorkspace === "replay" ||
    (BROKER_TOOLS_ENABLED && activeWorkspace === "portfolio") ||
    activeWorkspace === "alerts";
  const usePremiumShell = true;
  const usePremiumChartShell = ["charts", "chart-analysis"].includes(activeWorkspace) && usePremiumShell;
  const showLeftDockPanel = showLeftDock && !usePremiumShell && (!isCompactTerminal || activeWorkspace !== "charts");
  const showRightDockPanel = !usePremiumShell && (showRightDock && (!isCompactTerminal || activeWorkspace !== "charts"));
  const sidebarPanelSize = isPhoneTerminal
    ? 12
    : viewportWidth >= 1600
      ? usePremiumShell ? 11 : 3
      : isCompactTerminal
        ? 5
        : usePremiumShell ? 10 : 4.2;
  const workspaceMinSize = isCompactTerminal && (showLeftDockPanel || showRightDockPanel) ? 46 : isCompactTerminal ? 82 : 28;
  const workspaceDefaultSize =
    100 - sidebarPanelSize - (showLeftDockPanel ? 18 : 0) - (showRightDockPanel ? (usePremiumShell ? 24 : 20) : 0);

  const isFourChartLayout = activeWorkspace === "charts" && layoutMode !== "1" && gridMode === "4";
  const showTickerTape = activeWorkspace === "charts" || (BROKER_TOOLS_ENABLED && activeWorkspace === "broker") || activeWorkspace === "replay";
  const showWorkspaceNewsPanel =
    !usePremiumShell &&
    (activeWorkspace === "charts" || (BROKER_TOOLS_ENABLED && activeWorkspace === "broker") || activeWorkspace === "replay") &&
    !isFourChartLayout;
  const centerRows =
    usePremiumShell
      ? "minmax(0, 1fr)"
      :
    activeWorkspace === "intelligence" ||
    activeWorkspace === "scanner" ||
    activeWorkspace === "watchlist" ||
    activeWorkspace === "journal" ||
    activeWorkspace === "settings" ||
    isFourChartLayout
      ? "1fr"
      : "minmax(0, 1fr) 188px";

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
  const publicMarketDataHealth = {
    ...qtrdHealth,
    label: formatTerminalStatusLabel(qtrdHealth.label || marketDataStatusLabel || "MARKET DATA PENDING").replace(/^QTRD\b/i, "MARKET DATA"),
    message: String(qtrdHealth.message || "Market data status pending.").replace(/Questrade/gi, "Market data"),
    rawMessage: BROKER_TOOLS_ENABLED ? qtrdHealth.rawMessage : "",
    tokenPersisted: BROKER_TOOLS_ENABLED ? qtrdHealth.tokenPersisted : false,
  };
  const visibleMarketDataHealth = BROKER_TOOLS_ENABLED ? qtrdHealth : publicMarketDataHealth;
  const backendHealthLabel = platformHealth?.backend?.status === "online" ? "BACKEND LIVE" : "BACKEND PENDING";
  const hasRenderableMarketData = allSymbols.some((stock) => Number(stock?.price || 0) > 0);
  const pendingMarketDataLabel = /PENDING/i.test(String(visibleMarketDataHealth.label || marketDataStatusLabel || ""));
  const resolvedMarketDataStatusLabel = pendingMarketDataLabel && hasRenderableMarketData
    ? "PROVIDER DATA"
    : visibleMarketDataHealth.label || marketDataStatusLabel;
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
        qtrdHealth: visibleMarketDataHealth,
        newsMeta,
        scannerMeta,
      }),
    [newsMeta, scannerMeta, selectedStock, selectedStockData, visibleMarketDataHealth]
  );
  const visibleRightPanelTabs = useMemo(
    () => rightPanelTabs.filter((tab) => isRightTabAllowed(tab.id) && (advancedMode || coreRightTabs.has(tab.id))),
    [advancedMode]
  );
  const activeRightTab = visibleRightPanelTabs.some((tab) => tab.id === rightTab) ? rightTab : "intel";
  const visibleWorkspaceViews = useMemo(
    () => workspaceViews.filter((view) => isWorkspaceAllowed(view.id)),
    []
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
  const premiumAccountSummary = useMemo(() => {
    const buyingPower = Number(primaryBrokerBalance?.buyingPower || primaryBrokerBalance?.cash || 0);
    const netLiquidation = Number(primaryBrokerBalance?.totalEquity || primaryBrokerBalance?.marketValue || 0);
    const dailyPnl = Number(realizedPnL || 0) + Number(totalUnrealizedPnL || 0);

    return {
      rows: [
        ["Buying Power", buyingPower > 0 ? `$${buyingPower.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "Paper Mode", "neutral"],
        ["Daily P&L", `${dailyPnl >= 0 ? "+" : "-"}$${Math.abs(dailyPnl).toFixed(2)}`, dailyPnl >= 0 ? "positive" : "negative"],
        ["Net Liquidation", netLiquidation > 0 ? `$${netLiquidation.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "Local Account", "neutral"],
      ].map(([label, value, tone]) => ({ label, value, tone })),
    };
  }, [primaryBrokerBalance, realizedPnL, totalUnrealizedPnL]);
  const showAccountCloudInLeftDock = activeWorkspace === "settings";
  const mobileDockTabs = BROKER_TOOLS_ENABLED
    ? [
        ["order", "Trade"],
        ["risk", "Risk"],
        ["audit", "Audit"],
        ["alerts", "Alerts"],
      ]
    : [
        ["intel", "Intel"],
        ["risk", "Risk"],
        ["health", "Health"],
        ["alerts", "Alerts"],
      ];

  useEffect(() => {
    saveSetting("sb_advanced_mode", advancedMode);
  }, [advancedMode]);

  useEffect(() => {
    if (!isWorkspaceAllowed(activeWorkspace) || (!usePremiumShell && !advancedMode && advancedWorkspaceIds.has(activeWorkspace))) {
      setActiveWorkspace("charts");
    }
  }, [activeWorkspace, advancedMode, setActiveWorkspace, usePremiumShell]);

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
        isDark={isDark}
        allSymbols={allSymbols}
        viewportWidth={viewportWidth}
        panelStyle={panelStyle}
        buttonStyle={buttonStyle}
        timeframeButtonStyle={timeframeButtonStyle}
        showIndicators={showIndicators}
        setShowIndicators={setShowIndicators}
        indicators={chartIndicators}
        setIndicators={setChartIndicators}
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
        premiumShell={usePremiumShell}
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
    const confidenceColor = (confidence) => {
      if (confidence === "High") return theme.green;
      if (confidence === "Medium") return theme.amber;
      return theme.muted;
    };
    const cleanStatus = (value) => formatTerminalStatusLabel(value || "Pending");
    const subtleCardBackground = isDark ? "rgba(12,18,29,0.84)" : "#ffffff";
    const nestedCardBackground = isDark ? "rgba(255,255,255,0.025)" : "#f6f9fd";
    const rightPanelCardStyle = {
      background: subtleCardBackground,
      border: `1px solid ${theme.borderSoft || theme.border}`,
      borderRadius: "7px",
      padding: "10px",
      minWidth: 0,
      boxShadow: isDark ? "none" : "0 1px 2px rgba(15,23,42,0.04), 0 8px 22px rgba(15,23,42,0.045)",
    };
    const compactLabelStyle = {
      color: theme.muted,
      fontSize: "8.5px",
      fontWeight: 800,
      textTransform: "uppercase",
      letterSpacing: 0,
      fontFamily: terminalSansFont,
    };
    const compactValueStyle = {
      marginTop: "3px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontFamily: terminalMonoFont,
      fontVariantNumeric: "tabular-nums",
      fontSize: "10px",
      fontWeight: 800,
    };
    const sourceRows = [
      ["Quote", cleanStatus(selectedDataConfidence.quote?.label), selectedDataConfidence.quote?.confidence],
      ["News", cleanStatus(selectedDataConfidence.news?.label), selectedDataConfidence.news?.confidence],
      ["Scanner", cleanStatus(selectedDataConfidence.scanner?.label), selectedDataConfidence.scanner?.confidence],
      ...(BROKER_TOOLS_ENABLED
        ? [["Broker", qtrdHealth.tokenPersisted ? "Token Stored" : brokerConnected ? "Broker Connected" : "Broker Locked", brokerConnected ? "High" : qtrdHealth.tokenPersisted ? "Medium" : "Limited"]]
        : []),
    ];
    const dockScore = selectedDockStock?.score10 || selectedDockStock?.score || selectedDockStock?.scoreValue || "Limited";
    const detailRows = [
      ["Data", selectedDataConfidence.confidence],
      ["Score", dockScore],
      ["Risk", cleanStatus(dockRisk)],
    ];
    const tapeRows = (selectedTickerNews.length ? selectedTickerNews : news.slice(0, 5)).filter((item) =>
      String(item?.headline || item?.summary || "").trim()
    );

    return (
      <div style={{ display: "grid", gap: "9px", fontFamily: terminalSansFont }}>
        <div style={rightPanelCardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "baseline" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: theme.text, fontSize: "12px", fontWeight: 850 }}>
                {selectedStock} Intelligence
              </div>
              <div style={{ color: theme.muted, fontSize: "9.5px", marginTop: "3px" }}>
                Confidence {cleanStatus(selectedDataConfidence.confidence)} / Updated {selectedDataConfidence.lastUpdatedLabel}
              </div>
            </div>
            <span
              style={{
                color: BROKER_TOOLS_ENABLED ? (brokerConnected ? theme.green : theme.amber) : confidenceColor(selectedDataConfidence.confidence),
                border: `1px solid ${(BROKER_TOOLS_ENABLED ? (brokerConnected ? theme.green : theme.amber) : confidenceColor(selectedDataConfidence.confidence))}4d`,
                borderRadius: "999px",
                padding: "3px 7px",
                background: BROKER_TOOLS_ENABLED
                  ? brokerConnected ? "rgba(0,200,150,0.07)" : "rgba(245,184,75,0.07)"
                  : "rgba(25,198,216,0.07)",
                fontSize: "8px",
                fontWeight: 850,
                textTransform: "uppercase",
                fontFamily: terminalMonoFont,
                whiteSpace: "nowrap",
              }}
            >
              {BROKER_TOOLS_ENABLED
                ? brokerConnected ? "Broker Connected" : "Broker Locked"
                : `${cleanStatus(selectedDataConfidence.confidence)} Context`}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "9px" }}>
            {sourceRows.map(([label, value, confidence]) => (
              <div
                key={label}
                style={{
                  minWidth: 0,
                  padding: "6px 7px",
                  borderRadius: "5px",
                  background: nestedCardBackground,
                  border: isDark ? "none" : `1px solid ${theme.borderSoft || theme.border}`,
                }}
              >
                <div style={compactLabelStyle}>{label}</div>
                <div style={{ ...compactValueStyle, color: confidenceColor(confidence) }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={rightPanelCardStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: "7px", alignItems: "center", minWidth: 0 }}>
                <span style={{ fontFamily: terminalMonoFont, color: theme.text, fontSize: "17px", fontWeight: 900 }}>
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
              <div style={{ fontFamily: terminalMonoFont, color: theme.text, fontSize: "15px", fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
                ${dockPrice.toFixed(2)}
              </div>
              <div style={{ fontFamily: terminalMonoFont, color: dockMove >= 0 ? theme.green : theme.red, fontSize: "11px", fontWeight: 900, marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                {dockMove >= 0 ? "+" : ""}
                {dockMove.toFixed(2)}%
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px", marginTop: "10px" }}>
            {detailRows.map(([label, value]) => (
              <div
                key={label}
                style={{
                  borderRadius: "6px",
                  padding: "6px 7px",
                  background: nestedCardBackground,
                  border: isDark ? "none" : `1px solid ${theme.borderSoft || theme.border}`,
                  minWidth: 0,
                }}
              >
                <div style={compactLabelStyle}>{label}</div>
                <div style={{ ...compactValueStyle, color: label === "Data" && value === "High" ? theme.green : label === "Risk" ? theme.amber : theme.text }}>
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

        <div style={rightPanelCardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
            <div style={{ color: theme.text, fontSize: "11px", fontWeight: 850, textTransform: "uppercase" }}>
              Catalyst Tape
            </div>
            <div style={{ color: theme.muted, fontSize: "9px", fontFamily: terminalMonoFont }}>
              {tapeRows.length} rows
            </div>
          </div>
          <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
            {tapeRows.map((item, index) => {
              const hasUrl = Boolean(item.url);
              const headline = String(item.headline || item.summary || "Market context update").trim();
              const source = cleanStatus(item.source || "News");
              const ticker = String(item.relatedTicker || item.symbol || selectedStock).toUpperCase();
              const content = (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                    <span style={{ ...compactValueStyle, marginTop: 0, color: theme.cyan, flex: "0 0 auto" }}>
                      {ticker}
                    </span>
                    <span style={{ color: theme.muted, fontSize: "9px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {source}
                    </span>
                  </div>
                  <div
                    style={{
                      color: theme.text,
                      fontSize: "10.5px",
                      fontWeight: 700,
                      lineHeight: 1.35,
                      marginTop: "4px",
                    }}
                  >
                    {headline}
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
                    cursor: "pointer",
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
            {!tapeRows.length && (
              <div style={{ color: theme.muted, fontSize: "10px", lineHeight: 1.4 }}>
                Catalyst feed pending. Chart, scanner, and quote context remain available.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderPremiumScannerBoard() {
    const premiumScannerTabs = ["Gainers", "Losers", "Active", "Momentum", "Relative Volume"];

    return (
      <div
        style={panelStyle({
          height: "100%",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "auto 1fr",
          padding: "12px 14px",
        })}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            paddingBottom: "10px",
            borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
            <div style={{ color: theme.text, fontSize: "13px", fontWeight: 900, letterSpacing: 0, textTransform: "uppercase" }}>
              Scanner
            </div>
            {premiumScannerTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setScannerTab(tab)}
                style={{
                  ...buttonStyle(scannerTab === tab),
                  height: "26px",
                  padding: "0 12px",
                  borderRadius: "6px",
                  textTransform: "capitalize",
                }}
              >
                {tab === "Relative Volume" ? "High RVOL" : tab}
              </button>
            ))}
          </div>
          <div style={{ color: theme.muted, fontFamily: terminalMonoFont, fontSize: "10px", fontWeight: 800, whiteSpace: "nowrap" }}>
            {scannerSourceLabel ? formatTerminalStatusLabel(scannerSourceLabel) : "Scanner"} / {scannerStocks.length} rows
          </div>
        </div>

        <div style={{ minHeight: 0, overflow: "auto", paddingTop: "8px" }}>
          <ScannerTable
            rows={scannerStocks.slice(0, 24)}
            onPick={selectMainSymbol}
            theme={theme}
          />
        </div>
      </div>
    );
  }

  function renderPremiumBottomDock() {
    const positionRows = Object.entries(positions || {}).map(([symbol, position]) => {
      const lastPrice = Number(allSymbols.find((stock) => stock.symbol === symbol)?.price || selectedStockData?.price || position.avgPrice || 0);
      const qty = Number(position.quantity || position.qty || 0);
      const avgPrice = Number(position.avgPrice || position.averagePrice || 0);
      const pnl = Number.isFinite(lastPrice) && Number.isFinite(avgPrice) ? (lastPrice - avgPrice) * qty : 0;

      return {
        symbol,
        side: qty >= 0 ? "LONG" : "SHORT",
        qty,
        avgPrice,
        lastPrice,
        pnl,
      };
    });
    const recentOrders = [...orders].slice(-4).reverse();
    const visibleAlerts = alerts.slice(0, 4);
    const tabs = [
      ["positions", `Positions (${positionRows.length})`],
      ["orders", `Orders (${orders.length})`],
      ["alerts", `Alerts (${alerts.length})`],
      ["messages", "Messages"],
    ];
    const dockGridColumns =
      premiumDockTab === "positions"
        ? "1fr 80px 80px 96px 96px 96px"
        : premiumDockTab === "orders"
          ? "1fr 80px 80px 96px 110px 1fr"
          : "1fr 110px 120px 1fr";
    const headerLabels =
      premiumDockTab === "positions"
        ? ["Symbol", "Side", "Qty", "Avg Price", "Last Price", "P&L"]
        : premiumDockTab === "orders"
          ? ["Symbol", "Side", "Qty", "Price", "Status", "Time"]
          : premiumDockTab === "alerts"
            ? ["Symbol", "Direction", "Target", "Status"]
            : ["Source", "Status", "Time", "Message"];

    function renderRows() {
      if (premiumDockTab === "positions") {
        if (!positionRows.length) return [["No positions", "Paper", "-", "-", "-", "$0.00"]];

        return positionRows.map((row) => [
          row.symbol,
          row.side,
          Math.abs(row.qty),
          row.avgPrice ? `$${row.avgPrice.toFixed(2)}` : "-",
          row.lastPrice ? `$${row.lastPrice.toFixed(2)}` : "-",
          `${row.pnl >= 0 ? "+" : "-"}$${Math.abs(row.pnl).toFixed(2)}`,
        ]);
      }

      if (premiumDockTab === "orders") {
        if (!recentOrders.length) return [["No recent orders", "-", "-", "-", "Idle", "-"]];

        return recentOrders.map((order) => [
          order.symbol || selectedStock,
          order.side || order.orderSide || "-",
          order.quantity || order.qty || "-",
          order.price ? `$${Number(order.price).toFixed(2)}` : order.limitPrice ? `$${Number(order.limitPrice).toFixed(2)}` : "Market",
          order.status || order.mode || "Recorded",
          order.time ? new Date(order.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "-",
        ]);
      }

      if (premiumDockTab === "alerts") {
        if (!visibleAlerts.length) return [["No alerts", "-", "-", "Idle"]];

        return visibleAlerts.map((alert) => [
          alert.symbol || selectedStock,
          alert.direction || "above",
          alert.price ? `$${Number(alert.price).toFixed(2)}` : "-",
          alert.active === false ? "Paused" : "Active",
        ]);
      }

      return [
        ["Data", resolvedMarketDataStatusLabel || "Market Data", "-", resolvedScannerMessage],
        ["News", resolvedNewsStatusLabel || "News", "-", resolvedNewsMessage],
      ];
    }

    return (
      <div
        style={panelStyle({
          height: "100%",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "34px 1fr",
          padding: 0,
        })}
      >
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
          }}
        >
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPremiumDockTab(id)}
              style={{
                minWidth: "126px",
                padding: "0 14px",
                border: "none",
                borderRight: `1px solid ${theme.borderSoft || theme.border}`,
                background: premiumDockTab === id ? "rgba(45,140,255,0.14)" : "transparent",
                color: premiumDockTab === id ? theme.blue : theme.muted,
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 850,
                textTransform: "uppercase",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ minHeight: 0, overflow: "auto", padding: "8px 12px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: dockGridColumns,
              gap: "10px",
              color: theme.muted,
              fontSize: "9px",
              fontWeight: 900,
              textTransform: "uppercase",
              padding: "0 0 6px",
              borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
            }}
          >
            {headerLabels.map((label) => (
              <span key={label} style={{ textAlign: label === "Symbol" || label === "Source" ? "left" : "right" }}>
                {label}
              </span>
            ))}
          </div>

          {renderRows().map((row, rowIndex) => (
            <div
              key={`${premiumDockTab}-${rowIndex}`}
              style={{
                display: "grid",
                gridTemplateColumns: dockGridColumns,
                gap: "10px",
                alignItems: "center",
                minHeight: "30px",
                borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
                color: theme.text,
                fontFamily: terminalMonoFont,
                fontSize: "10px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {row.map((cell, cellIndex) => {
                const value = String(cell);
                const isPnl = value.startsWith("+$") || value.startsWith("-$");
                return (
                  <span
                    key={`${value}-${cellIndex}`}
                    style={{
                      textAlign: cellIndex === 0 ? "left" : "right",
                      color: isPnl ? (value.startsWith("+") ? theme.green : theme.red) : theme.text,
                      fontWeight: cellIndex === 0 || isPnl ? 850 : 700,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {value}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderPremiumRightRail() {
    const railCard = {
      background: theme.panel,
      border: `1px solid ${theme.borderSoft || theme.border}`,
      borderRadius: "9px",
      padding: "12px",
      minWidth: 0,
    };
    const selectedPrice = Number(selectedStockData?.price || 0);
    const selectedMove = Number.parseFloat(String(selectedStockData?.change || selectedStockData?.changePercent || "0").replace("%", ""));
    const moveColor = selectedMove >= 0 ? theme.green : theme.red;
    const latestRows = (selectedTickerNews.length ? selectedTickerNews : news).slice(0, 4);
    const latestArticleRows = latestRows.filter((item) => !item.fallback && String(item.url || item.source || "").trim()).slice(0, 4);

    return (
      <div style={{ display: "grid", gap: "8px", height: "100%", overflow: "auto" }}>
        <div style={railCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "9px" }}>
            <div style={{ color: theme.text, textTransform: "uppercase", fontSize: "12px", fontWeight: 900 }}>
              My Watchlist
            </div>
            <button
              type="button"
              onClick={() => addSymbolToWatchlist(selectedStock)}
              style={{
                ...buttonStyle(false),
                width: "28px",
                height: "24px",
                padding: 0,
                display: "grid",
                placeItems: "center",
              }}
              title={`Add ${selectedStock} to watchlist`}
            >
              <Plus size={14} />
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 78px 62px",
              gap: "8px",
              color: theme.muted,
              fontSize: "10px",
              padding: "0 2px 6px",
              borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
            }}
          >
            <span>Symbol</span>
            <span style={{ textAlign: "right" }}>Last</span>
            <span style={{ textAlign: "right" }}>Chg%</span>
          </div>
          {liveStocks.slice(0, 8).map((stock) => {
            const move = Number.parseFloat(String(stock.change || stock.changePercent || "0").replace("%", ""));
            const active = stock.symbol === selectedStock;
            return (
              <button
                key={stock.symbol}
                type="button"
                onClick={() => selectMainSymbol(stock.symbol)}
                style={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: "1fr 78px 62px",
                  gap: "8px",
                  alignItems: "center",
                  minHeight: "28px",
                  border: "none",
                  borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
                  background: active ? "linear-gradient(90deg, rgba(45,140,255,0.24), transparent)" : "transparent",
                  color: theme.text,
                  cursor: "pointer",
                  padding: "0 2px",
                }}
              >
                <span style={{ fontFamily: terminalMonoFont, fontWeight: 850, textAlign: "left" }}>{stock.symbol}</span>
                <span style={{ fontFamily: terminalMonoFont, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {Number(stock.price || 0) > 0 ? Number(stock.price).toFixed(2) : "Quote"}
                </span>
                <span
                  style={{
                    fontFamily: terminalMonoFont,
                    color: move >= 0 ? theme.green : theme.red,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 850,
                  }}
                >
                  {Number.isFinite(move) ? `${move >= 0 ? "+" : ""}${move.toFixed(2)}%` : "Live"}
                </span>
              </button>
            );
          })}
        </div>

        <div style={railCard}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "start" }}>
            <div>
              <div style={{ fontFamily: terminalMonoFont, color: theme.text, fontSize: "20px", fontWeight: 950 }}>
                {selectedStock}
              </div>
              <div style={{ color: theme.muted, fontSize: "11px", marginTop: "3px" }}>
                {selectedStockData?.name || "Selected equity"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: terminalMonoFont, fontSize: "24px", fontWeight: 900, color: theme.text }}>
                {selectedPrice > 0 ? selectedPrice.toFixed(2) : "Quote"}
              </div>
              <div style={{ fontFamily: terminalMonoFont, color: moveColor, fontSize: "12px", fontWeight: 900 }}>
                {Number.isFinite(selectedMove) ? `${selectedMove >= 0 ? "+" : ""}${selectedMove.toFixed(2)}%` : "Live"}
              </div>
            </div>
          </div>

          <div style={{ color: theme.green, fontSize: "11px", fontWeight: 850, marginTop: "8px" }}>
            {marketDataStatusLabel?.includes("LIVE") || mainChartSourceLabel?.includes("QTRD")
              ? "Market Data Live"
              : marketDataStatusLabel || "Market Data Unavailable"}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "12px" }}>
            {[
              ["Volume", selectedStockData?.volume || selectedDockStock?.volume],
              ["RVOL", selectedDockStock?.relativeVolume || selectedDockStock?.rvol],
              ["Score", selectedDockStock?.score10 || selectedDockStock?.score],
              ["Risk", selectedDockStock?.riskLabel || selectedDockStock?.risk || selectedDataConfidence.confidence],
            ].map(([label, value]) => (
              <div key={label} style={{ background: isDark ? "rgba(255,255,255,0.025)" : "#f6f9fd", borderRadius: "7px", padding: "8px" }}>
                <div style={{ color: theme.muted, fontSize: "9px", fontWeight: 850, textTransform: "uppercase" }}>{label}</div>
                <div style={{ marginTop: "4px", fontFamily: terminalMonoFont, color: theme.text, fontSize: "11px", fontWeight: 850 }}>
                  {value ?? "Unavailable"}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "12px" }}>
            <button onClick={() => selectMainSymbol(selectedStock)} style={{ ...buttonStyle(true), height: "34px" }}>
              Open Chart
            </button>
            <button
              onClick={() => {
                if (hasSelectedInWatchlist) removeWatchlistSymbol(selectedStock);
                else addSymbolToWatchlist(selectedStock);
              }}
              style={{ ...buttonStyle(false), height: "34px" }}
            >
              {hasSelectedInWatchlist ? "Watching" : "Watch"}
            </button>
          </div>
        </div>

        <div style={railCard}>
          <div style={{ color: theme.text, textTransform: "uppercase", fontSize: "12px", fontWeight: 900, marginBottom: "10px" }}>
            Latest News
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            {latestArticleRows.length === 0 && (
              <div
                style={{
                  color: theme.muted,
                  fontSize: "11px",
                  lineHeight: 1.45,
                  border: `1px dashed ${theme.borderSoft || theme.border}`,
                  borderRadius: "7px",
                  padding: "12px",
                }}
              >
                Real article feed is loading or provider-limited. Scanner and chart context remain active.
              </div>
            )}
            {latestArticleRows.map((item, index) => {
              const headline = String(item.headline || item.summary || "Market update").trim();
              const row = (
                <div>
                  <div style={{ color: theme.muted, fontSize: "9px", marginBottom: "3px" }}>
                    {item.source || "Market News"}
                  </div>
                  <div style={{ color: theme.text, fontSize: "11px", lineHeight: 1.35, fontWeight: 750 }}>
                    {headline}
                  </div>
                </div>
              );

              return item.url ? (
                <a
                  key={item.id || `${headline}-${index}`}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: "none", display: "block" }}
                >
                  {row}
                </a>
              ) : (
                <div key={item.id || `${headline}-${index}`}>{row}</div>
              );
            })}
          </div>
        </div>

        <div style={railCard}>
          <div style={{ color: theme.text, textTransform: "uppercase", fontSize: "12px", fontWeight: 900, marginBottom: "10px" }}>
            Quick Order
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 82px", gap: "8px" }}>
            <label style={{ display: "grid", gap: "4px", minWidth: 0 }}>
              <span style={{ color: theme.muted, fontSize: "9px", fontWeight: 850, textTransform: "uppercase" }}>Symbol</span>
              <input
                value={selectedStock}
                readOnly
                style={{
                  height: "30px",
                  background: isDark ? "rgba(255,255,255,0.025)" : "#f6f9fd",
                  border: `1px solid ${theme.borderSoft || theme.border}`,
                  borderRadius: "6px",
                  color: theme.text,
                  padding: "0 8px",
                  fontFamily: terminalMonoFont,
                  fontWeight: 850,
                }}
              />
            </label>
            <label style={{ display: "grid", gap: "4px", minWidth: 0 }}>
              <span style={{ color: theme.muted, fontSize: "9px", fontWeight: 850, textTransform: "uppercase" }}>Shares</span>
              <input
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value) || 1)}
                inputMode="numeric"
                style={{
                  height: "30px",
                  background: isDark ? "rgba(255,255,255,0.025)" : "#f6f9fd",
                  border: `1px solid ${theme.borderSoft || theme.border}`,
                  borderRadius: "6px",
                  color: theme.text,
                  padding: "0 8px",
                  fontFamily: terminalMonoFont,
                  fontWeight: 850,
                }}
              />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "9px" }}>
            {["BUY", "SELL"].map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => {
                  setOrderSide(side);
                  setOrderConfirmed(false);
                  setPremiumDockTab("orders");
                  setOrderMessage(`${side} review prepared for ${selectedStock}. Use the full order ticket before submitting.`);
                }}
                style={{
                  height: "34px",
                  border: "none",
                  borderRadius: "7px",
                  background: side === "BUY"
                    ? "linear-gradient(180deg, #16a67a, #0b7a5b)"
                    : "linear-gradient(180deg, #e44848, #b82020)",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 900,
                }}
              >
                Review {side}
              </button>
            ))}
          </div>
          <div style={{ color: theme.muted, fontSize: "9.5px", lineHeight: 1.35, marginTop: "8px" }}>
            Review-only shortcut. It does not submit broker orders from this card.
          </div>
        </div>
      </div>
    );
  }

  // Legacy premium renderer kept temporarily as a fallback reference while the screenshot replica layer is verified.
  // eslint-disable-next-line no-unused-vars
  function renderPremiumMainWorkspace() {
    const pagePanel = (title, subtitle, content, extra = {}) => (
      <div
        style={panelStyle({
          height: "100%",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "auto 1fr",
          padding: "14px 16px",
          ...extra,
        })}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "12px",
            paddingBottom: "10px",
            borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
            minWidth: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ color: theme.text, fontSize: "14px", fontWeight: 950, textTransform: "uppercase" }}>
              {title}
            </div>
            {subtitle && (
              <div style={{ color: theme.muted, fontSize: "11px", marginTop: "3px" }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>
        <div style={{ minHeight: 0, overflow: "auto", paddingTop: "10px" }}>{content}</div>
      </div>
    );

    const metricCard = (label, value, tone = "neutral") => (
      <div
        key={label}
        style={{
          background: isDark ? "rgba(255,255,255,0.025)" : "#f6f9fd",
          border: `1px solid ${theme.borderSoft || theme.border}`,
          borderRadius: "8px",
          padding: "12px",
          minWidth: 0,
        }}
      >
        <div style={{ color: theme.muted, fontSize: "10px", fontWeight: 850, textTransform: "uppercase" }}>
          {label}
        </div>
        <div
          style={{
            marginTop: "7px",
            color: tone === "positive" ? theme.green : tone === "negative" ? theme.red : theme.text,
            fontFamily: terminalMonoFont,
            fontSize: "18px",
            fontWeight: 900,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </div>
      </div>
    );

    if (activeWorkspace === "charts") {
      return (
        <>
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
          {renderPremiumScannerBoard()}
          {renderPremiumBottomDock()}
        </>
      );
    }

    if (activeWorkspace === "chart-analysis") {
      return (
        <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr) 116px", gap: "6px", height: "100%", minHeight: 0 }}>
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
          {renderPremiumBottomDock()}
        </div>
      );
    }

    if (activeWorkspace === "scanner") {
      return renderPremiumScannerBoard();
    }

    if (activeWorkspace === "watchlist") {
      return pagePanel(
        "Watchlist",
        `${liveStocks.length} tracked symbols / ${selectedStock} selected`,
        <div style={{ display: "grid", gap: "8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 90px 120px", gap: "12px", color: theme.muted, fontSize: "10px", fontWeight: 850, textTransform: "uppercase", padding: "0 6px 6px", borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}>
            <span>Symbol</span>
            <span style={{ textAlign: "right" }}>Last</span>
            <span style={{ textAlign: "right" }}>Change</span>
            <span style={{ textAlign: "right" }}>Volume</span>
          </div>
          {liveStocks.map((stock) => {
            const move = Number.parseFloat(String(stock.change || stock.changePercent || "0").replace("%", ""));
            return (
              <button
                key={stock.symbol}
                type="button"
                onClick={() => selectMainSymbol(stock.symbol)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 110px 90px 120px",
                  gap: "12px",
                  alignItems: "center",
                  minHeight: "38px",
                  border: "none",
                  borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
                  background: stock.symbol === selectedStock ? "linear-gradient(90deg, rgba(45,140,255,0.18), transparent)" : "transparent",
                  color: theme.text,
                  cursor: "pointer",
                  padding: "0 6px",
                  fontFamily: terminalMonoFont,
                  fontSize: "12px",
                }}
              >
                <span style={{ textAlign: "left", fontWeight: 900 }}>{stock.symbol}</span>
                <span style={{ textAlign: "right" }}>{Number(stock.price || 0) > 0 ? `$${Number(stock.price).toFixed(2)}` : "Quote"}</span>
                <span style={{ textAlign: "right", color: move >= 0 ? theme.green : theme.red, fontWeight: 850 }}>{Number.isFinite(move) ? `${move >= 0 ? "+" : ""}${move.toFixed(2)}%` : "Live"}</span>
                <span style={{ textAlign: "right", color: theme.muted }}>{stock.volume || "Live"}</span>
              </button>
            );
          })}
        </div>
      );
    }

    if (activeWorkspace === "news" || activeWorkspace === "intelligence") {
      return pagePanel(
        activeWorkspace === "news" ? "Market News" : "Market Intelligence",
        `${selectedStock} / backend feed / ${news.length} rows`,
        activeWorkspace === "intelligence" ? (
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
          <MarketNewsPanel
            news={news}
            newsLoading={newsLoading}
            newsMeta={newsMeta}
            selectedStock={selectedStock}
            dataConfidence={selectedDataConfidence}
            theme={theme}
            terminalMonoFont={terminalMonoFont}
          />
        ),
        { padding: activeWorkspace === "intelligence" ? "0" : "14px 16px" }
      );
    }

    if (activeWorkspace === "orders") {
      return pagePanel(
        "Orders",
        "Review-only order ticket and recent activity",
        <Suspense fallback={<LoadingPanel theme={theme} label="Loading order ticket" height="240px" />}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)", gap: "10px", alignItems: "start" }}>
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
              tradingMode={effectiveTradingMode}
              setTradingMode={setTradingMode}
              liveTradingEnabled={LIVE_TRADING_ENABLED}
              orderConfirmed={orderConfirmed}
              setOrderConfirmed={setOrderConfirmed}
              maxOrderValue={maxOrderValue}
              setMaxOrderValue={setMaxOrderValue}
              dailyLossLimit={dailyLossLimit}
              setDailyLossLimit={setDailyLossLimit}
              riskPerTrade={riskPerTrade}
              setRiskPerTrade={setRiskPerTrade}
              orderPreview={orderPreview}
              riskGuard={riskGuard}
              liveReadiness={liveReadiness}
              liveOrderPreview={liveOrderPreview}
              liveOrderLoading={liveOrderLoading}
              orderConfirmationKey={orderConfirmationKey}
              safetyIssues={safetyIssues}
              previewLiveOrderTicket={previewLiveOrderTicket}
              submitOrderTicket={submitOrderTicket}
              orderMessage={orderMessage}
            />
            <RecentOrdersPanel theme={theme} orders={orders} />
          </div>
        </Suspense>
      );
    }

    if (activeWorkspace === "positions") {
      return pagePanel(
        "Positions",
        "Paper account, open exposure, and recent executions",
        <Suspense fallback={<LoadingPanel theme={theme} label="Loading positions" height="240px" />}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 360px) minmax(0, 1fr)", gap: "10px" }}>
            <PaperAccountPanel theme={theme} selectedStock={selectedStock} selectedStockData={selectedStockData} orders={orders} realizedPnL={realizedPnL} totalUnrealizedPnL={totalUnrealizedPnL} />
            <div style={{ display: "grid", gap: "10px" }}>
              <OpenPositionsPanel theme={theme} positions={positions} allSymbols={allSymbols} />
              <RecentOrdersPanel theme={theme} orders={orders} />
            </div>
          </div>
        </Suspense>
      );
    }

    if (activeWorkspace === "risk") {
      return pagePanel(
        "Risk",
        "Exposure, limits, and account controls",
        <Suspense fallback={<LoadingPanel theme={theme} label="Loading risk dashboard" height="240px" />}>
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
            primaryBrokerBalance={BROKER_TOOLS_ENABLED ? primaryBrokerBalance : null}
            brokerPositions={BROKER_TOOLS_ENABLED ? brokerPositions : []}
            brokerConnected={BROKER_TOOLS_ENABLED && brokerConnected}
            brokerSyncMeta={BROKER_TOOLS_ENABLED ? brokerSyncMeta : {}}
            brokerToolsEnabled={BROKER_TOOLS_ENABLED}
          />
        </Suspense>
      );
    }

    if (activeWorkspace === "performance") {
      const dailyPnl = Number(realizedPnL || 0) + Number(totalUnrealizedPnL || 0);
      return pagePanel(
        "Performance",
        "Trading account summary and execution quality",
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: "10px", height: "100%" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
            {metricCard("Daily P&L", `${dailyPnl >= 0 ? "+" : "-"}$${Math.abs(dailyPnl).toFixed(2)}`, dailyPnl >= 0 ? "positive" : "negative")}
            {metricCard("Realized P&L", `$${Number(realizedPnL || 0).toFixed(2)}`, Number(realizedPnL || 0) >= 0 ? "positive" : "negative")}
            {metricCard("Orders", orders.length, "neutral")}
            {metricCard("Alerts", alerts.length, "neutral")}
          </div>
          {renderPremiumBottomDock()}
        </div>
      );
    }

    if (activeWorkspace === "replay") {
      return pagePanel(
        "Replay",
        `${selectedStock} replay controls and trade review`,
        <Suspense fallback={<LoadingPanel theme={theme} label="Loading replay" height="240px" />}>
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
        </Suspense>
      );
    }

    if (activeWorkspace === "alerts") {
      return pagePanel(
        "Alerts",
        `${alerts.length} alert rules`,
        <Suspense fallback={<LoadingPanel theme={theme} label="Loading alerts" height="220px" />}>
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
        </Suspense>
      );
    }

    if (activeWorkspace === "journal") {
      return pagePanel(
        "Journal",
        "Trading notes, screenshots, and review exports",
        <Suspense fallback={<LoadingPanel theme={theme} label="Loading journal" height="240px" />}>
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
      );
    }

    if (activeWorkspace === "settings") {
      return pagePanel(
        "Settings",
        "Workspace controls and data status",
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)", gap: "10px" }}>
          <div style={{ display: "grid", gap: "10px" }}>
            {metricCard("Preset", layoutPresets[activePreset]?.label || "Custom")}
            {metricCard("Layout", `${layoutMode} Chart / Grid ${gridMode}`)}
            {metricCard("Theme", isDark ? "Dark" : "Light")}
            {metricCard("Cloud", user ? "Signed In" : "Local")}
          </div>
          <Suspense fallback={<LoadingPanel theme={theme} label="Loading health" height="240px" />}>
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
              qtrdHealth={visibleMarketDataHealth}
              brokerToolsEnabled={BROKER_TOOLS_ENABLED}
              buttonStyle={buttonStyle}
            />
          </Suspense>
        </div>
      );
    }

    return renderPremiumScannerBoard();
  }

  function renderPremiumChartGrid({ layoutMode: layoutModeOverride = "1", gridMode: gridModeOverride = "2", compact = false, embeddedChart = false } = {}) {
    return (
      <WorkspaceGrid
        theme={theme}
        layoutMode={layoutModeOverride}
        gridMode={gridModeOverride}
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
        compact={compact}
        embeddedChart={embeddedChart}
        viewportWidth={viewportWidth}
      />
    );
  }

  function renderReplicaPremiumWorkspace() {
    return (
      <PremiumWorkspace
        activeWorkspace={activeWorkspace}
        setActiveWorkspace={setActiveWorkspace}
        viewportWidth={viewportWidth}
        viewportHeight={viewportHeight}
        theme={theme}
        isDark={isDark}
        renderChartGrid={renderPremiumChartGrid}
        selectedStock={selectedStock}
        selectedStockData={selectedStockData}
        liveStocks={liveStocks}
        scannerStocks={scannerStocks}
        scannerGroups={{
          gainers: fmpGainers,
          losers: fmpLosers,
          active: fmpActive,
          momentum: fmpMomentum,
          relativeVolume: fmpRelativeVolume,
          aiMovers: fmpAiMovers,
          smallCaps: fmpSmallCaps,
        }}
        scannerMeta={scannerMeta}
        news={news}
        newsLoading={newsLoading}
        newsMeta={newsMeta}
        marketIndexes={marketSnapshotStocks}
        brokerApiUrl={BROKER_API_URL}
        alerts={alerts}
        createPriceAlert={createPriceAlert}
        toggleAlert={toggleAlert}
        updateAlert={updateAlert}
        removeAlert={removeAlert}
        orders={orders}
        positions={positions}
        allSymbols={allSymbols}
        accountSummary={premiumAccountSummary}
        realizedPnL={realizedPnL}
        totalUnrealizedPnL={totalUnrealizedPnL}
        quantity={quantity}
        setQuantity={setQuantity}
        setOrderSide={setOrderSide}
        setOrderConfirmed={setOrderConfirmed}
        setOrderMessage={setOrderMessage}
        setPremiumDockTab={setPremiumDockTab}
        selectMainSymbol={selectMainSymbol}
        addSymbolToWatchlist={addSymbolToWatchlist}
        removeWatchlistSymbol={removeWatchlistSymbol}
        scannerTab={scannerTab}
        setScannerTab={setScannerTab}
        scannerPresets={scannerPresets}
        setScannerPresets={setScannerPresets}
        activeScannerPreset={activeScannerPreset}
        setActiveScannerPreset={setActiveScannerPreset}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        chartIndicators={chartIndicators}
        setChartIndicators={setChartIndicators}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        timeZone={timeZone}
        setTimeZone={setTimeZone}
        premiumPreferences={premiumPreferences}
        setPremiumPreferences={setPremiumPreferences}
        activePreset={activePreset}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        gridMode={gridMode}
        setGridMode={setGridMode}
        user={user}
        handleLogout={handleLogout}
        saveWorkspaceToCloud={saveWorkspaceToCloud}
        loadWorkspaceFromCloud={loadWorkspaceFromCloud}
        requestPasswordReset={handlePasswordReset}
        resetWorkspace={resetWorkspace}
        brokerConnected={brokerConnected}
        journalEntries={journalEntries}
        replayPlaying={replayPlaying}
        replaySpeed={replaySpeed}
        replayStats={replayStats}
        replayTrades={replayTrades}
        replayEquity={replayEquity}
        replayIndex={replayIndex}
        replayDataLength={mainReplayData.length}
        replayBookmarks={replayBookmarks}
        setReplayBookmarks={setReplayBookmarks}
        replayNotes={replayNotes}
        setReplayNotes={setReplayNotes}
        setReplayPlaying={setReplayPlaying}
        setReplaySpeed={setReplaySpeed}
        setReplayIndex={setReplayIndex}
        stepReplay={stepReplay}
        resetReplay={resetReplay}
        takeScreenshot={takeScreenshot}
        toggleFullscreen={toggleFullscreen}
        openReplayJournal={openReplayJournal}
        journalDraft={journalDraft}
        addJournalEntry={addJournalEntry}
        exportJournalCsv={exportJournalCsv}
        exportTradeSummaryCsv={exportTradeSummaryCsv}
        entitlements={effectiveEntitlements}
        entitlementsStatus={effectiveEntitlementsStatus}
      />
    );
  }

  if (
    !authReady
    || !activeUser
    || passwordRecovery
  ) {
    return (
      <AuthGate
        busy={authBusy}
        configured={isAuthConfigured}
        email={authEmail}
        message={authMessage}
        mode={authMode}
        onEmailChange={setAuthEmail}
        onModeChange={setAuthMode}
        onPasswordChange={setAuthPassword}
        onPasswordUpdate={handlePasswordUpdate}
        onResetPassword={handlePasswordReset}
        onSubmit={handleAuthSubmit}
        password={authPassword}
        recovery={passwordRecovery}
        ready={authReady && !user}
      />
    );
  }

  return (
    <div
      className={`sb-terminal ${isDark ? "theme-dark" : "theme-light"}`}
      style={{
        height: "100vh",
        background: isDark
          ? "radial-gradient(circle at 38% -12%, rgba(25,198,216,0.08), transparent 28%), #040507"
          : "linear-gradient(180deg, #f7f9fc, #eef3f8)",
        color: theme.text,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: terminalSansFont,
      }}
    >
        <TerminalTopBar
        theme={theme}
        workspaceViews={visibleWorkspaceViews}
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
        brokerStateLabel={BROKER_TOOLS_ENABLED ? brokerSourceLabel : "PUBLIC MODE"}
        modeStatusLabel={modeSourceLabel}
        brokerStatus={BROKER_TOOLS_ENABLED ? brokerStatus : "Public mode"}
        brokerConnected={BROKER_TOOLS_ENABLED && brokerConnected}
        brokerToolsEnabled={BROKER_TOOLS_ENABLED}
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
        user={activeUser}
        handleLogout={handleLogout}
        compact={isCompactTerminal}
        advancedMode={advancedMode}
        setAdvancedMode={setAdvancedMode}
        selectedSymbol={selectedStock}
        onSymbolCommit={selectMainSymbol}
        onOpenHelp={!BROKER_TOOLS_ENABLED ? openPublicOnboarding : undefined}
        premiumShell={usePremiumShell}
      />

      {usePremiumShell && !isCompactTerminal && !["dashboard", "replay", "journal"].includes(activeWorkspace) ? (
        <div style={{ padding: activeWorkspace === "charts" ? "0 10px 5px" : "0 10px 8px", flexShrink: 0 }}>
          <MarketSnapshotStrip
            theme={theme}
            stocks={marketSnapshotStocks}
            onPick={selectMainSymbol}
            compact={activeWorkspace === "charts"}
          />
        </div>
      ) : !usePremiumShell && showTickerTape && (
        <TickerTape
          theme={theme}
          stocks={tickerTapeSymbols.slice(0, 12)}
          onPick={selectMainSymbol}
        />
      )}

      {!usePremiumShell && (
      <ProductionHealthStrip
        theme={theme}
        terminalMonoFont={terminalMonoFont}
        backendLabel={backendHealthLabel}
        qtrdHealth={visibleMarketDataHealth}
        scannerLabel={scannerSourceLabel}
        scannerMessage={resolvedScannerMessage}
        newsLabel={resolvedNewsStatusLabel}
        newsMessage={resolvedNewsMessage}
        aiLabel={aiHealthLabel}
        aiMessage={aiHealthMessage}
        lastCheckedAt={healthLastCheckedAt}
        onRefresh={handleRefreshProductionHealth}
        refreshing={healthRefreshing}
        brokerToolsEnabled={BROKER_TOOLS_ENABLED}
      />
      )}

      <PanelGroup
        key={`terminal-panels-${usePremiumShell ? "premium" : "compact"}-${showLeftDockPanel ? "left" : "no-left"}-${showRightDockPanel ? "right" : "no-right"}-${activeWorkspace}`}
        direction="horizontal"
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          padding: "8px",
          gap: "8px",
          overflow: "hidden",
        }}
      >
        <Panel
          id="sidebar-panel"
          order={1}
          defaultSize={sidebarPanelSize}
          minSize={sidebarPanelSize}
          maxSize={isPhoneTerminal ? 12 : usePremiumShell ? 13 : viewportWidth >= 1600 ? 3.3 : isCompactTerminal ? 6 : 4.6}
        >
          <TradingSidebar
          activeWorkspace={activeWorkspace}
          setActiveWorkspace={setActiveWorkspace}
          brokerConnected={BROKER_TOOLS_ENABLED && brokerConnected}
          brokerToolsEnabled={BROKER_TOOLS_ENABLED}
          advancedMode={advancedMode}
          brokerStatus={brokerStatus}
          theme={theme}
          isDark={isDark}
          expanded={usePremiumShell && !isCompactTerminal}
          accountSummary={usePremiumShell && !isCompactTerminal ? premiumAccountSummary : null}
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
                gridTemplateColumns: "minmax(58px, 1fr) 68px 58px 24px",
                gap: "6px",
                alignItems: "center",
                minHeight: "34px",
                padding: "5px 0",
                borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
                cursor: "pointer",
                color: selectedStock === stock.symbol ? theme.blue : theme.text,
                fontWeight: selectedStock === stock.symbol ? 900 : 500,
                fontSize: "10px",
              }}
            >
              <span style={{ fontFamily: terminalMonoFont, fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {stock.symbol}
              </span>
              <span style={{ fontFamily: terminalMonoFont, fontVariantNumeric: "tabular-nums", color: theme.text, textAlign: "right", fontWeight: 800 }}>
                {Number(stock.price || 0) > 0 ? `$${Number(stock.price).toFixed(2)}` : "Quote"}
              </span>
              <span
                style={{
                  fontFamily: terminalMonoFont,
                  fontVariantNumeric: "tabular-nums",
                  color: Math.abs(Number.parseFloat(String(stock.change || "").replace("%", "").replace("+", "")) || 0) < 0.005
                    ? theme.muted
                    : String(stock.change || "").includes("-") ? theme.red : theme.green,
                  textAlign: "right",
                  fontWeight: 850,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {(() => {
                  const parsed = Number.parseFloat(String(stock.change || "").replace("%", "").replace("+", ""));

                  if (!Number.isFinite(parsed)) return stock.change || "Live";
                  if (Math.abs(parsed) < 0.005) return "0.00%";

                  return `${parsed > 0 ? "+" : ""}${parsed.toFixed(2)}%`;
                })()}
              </span>
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
            gap: "4px",
            height: "100%",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {usePremiumShell ? (
            renderReplicaPremiumWorkspace()
          ) : activeWorkspace === "intelligence" ? (
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
            <>
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
              {usePremiumChartShell && renderPremiumScannerBoard()}
              {usePremiumChartShell && renderPremiumBottomDock()}
            </>
          )}

          {showWorkspaceNewsPanel && (
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
            <Panel
              id="right-dock-panel"
              order={4}
              defaultSize={usePremiumShell ? 24 : 20}
              minSize={isPhoneTerminal ? 0 : usePremiumShell ? 21 : 15}
              maxSize={usePremiumShell ? 27 : 35}
            >
              <div
                style={panelStyle({
                  height: "100%",
                  overflowY: usePremiumShell ? "hidden" : "auto",
                })}
              >
                {panelTitle(usePremiumShell ? "Market Console" : BROKER_TOOLS_ENABLED && advancedMode ? "Advanced Console" : "Market Intelligence")}

                {usePremiumShell ? (
                  renderPremiumRightRail()
                ) : (
                  <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(54px, 1fr))",
                    gap: "4px",
                    marginBottom: "9px",
                    padding: "4px",
                    background: isDark ? "rgba(255,255,255,0.018)" : theme.panel2,
                    border: `1px solid ${theme.borderSoft || theme.border}`,
                    borderRadius: "7px",
                  }}
                >
                  {visibleRightPanelTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setRightTab(tab.id)}
                      style={{
                        ...buttonStyle(activeRightTab === tab.id),
                        height: "25px",
                        minWidth: 0,
                        padding: "0 5px",
                        fontSize: "9px",
                        fontFamily: terminalSansFont,
                        fontWeight: 800,
                        borderColor: activeRightTab === tab.id ? "rgba(25,198,216,0.7)" : "transparent",
                        background: activeRightTab === tab.id
                          ? `linear-gradient(180deg, ${theme.blue}, #1765c6)`
                          : isDark ? "rgba(255,255,255,0.015)" : theme.panel,
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <Suspense fallback={<LoadingPanel theme={theme} label="Loading console panels" height="180px" />}>
                  {activeRightTab === "intel" && renderIntelligenceDock()}

                  {activeRightTab === "order" && (
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
                      tradingMode={effectiveTradingMode}
                      setTradingMode={setTradingMode}
                      liveTradingEnabled={LIVE_TRADING_ENABLED}
                      orderConfirmed={orderConfirmed}
                      setOrderConfirmed={setOrderConfirmed}
                      maxOrderValue={maxOrderValue}
                      setMaxOrderValue={setMaxOrderValue}
                      dailyLossLimit={dailyLossLimit}
                      setDailyLossLimit={setDailyLossLimit}
                      riskPerTrade={riskPerTrade}
                      setRiskPerTrade={setRiskPerTrade}
                      orderPreview={orderPreview}
                      riskGuard={riskGuard}
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

                  {BROKER_TOOLS_ENABLED && activeRightTab === "broker" && (
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

                  {activeRightTab === "risk" && (
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
                        primaryBrokerBalance={BROKER_TOOLS_ENABLED ? primaryBrokerBalance : null}
                        brokerPositions={BROKER_TOOLS_ENABLED ? brokerPositions : []}
                        brokerConnected={BROKER_TOOLS_ENABLED && brokerConnected}
                        brokerSyncMeta={BROKER_TOOLS_ENABLED ? brokerSyncMeta : {}}
                        brokerToolsEnabled={BROKER_TOOLS_ENABLED}
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

                  {activeRightTab === "replay" && (
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

                  {activeRightTab === "activity" && (
                    <ActivityLogPanel
                      theme={theme}
                      activityLog={activityLog}
                      clearActivityLog={clearActivityLog}
                      buttonStyle={buttonStyle}
                    />
                  )}

                  {activeRightTab === "audit" && (
                    <ExecutionAuditPanel
                      theme={theme}
                      auditTrail={orderAuditTrail}
                      syncStatus={orderAuditSyncStatus}
                      clearAuditTrail={clearOrderAuditTrail}
                      buttonStyle={buttonStyle}
                    />
                  )}

                  {activeRightTab === "health" && (
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
                      qtrdHealth={visibleMarketDataHealth}
                      brokerToolsEnabled={BROKER_TOOLS_ENABLED}
                      buttonStyle={buttonStyle}
                    />
                  )}

                  {activeRightTab === "alerts" && (
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

                  {activeRightTab === "dom" && (
                    <DOMPanel
                      theme={theme}
                      ladderRows={ladderRows}
                      selectedStockData={selectedStockData}
                      level2={level2}
                    />
                  )}

                  {activeRightTab === "keys" && (
                    <ShortcutsPanel theme={theme} />
                  )}
                </Suspense>
                  </>
                )}
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
          {mobileDockTabs.filter(([tabId]) => isRightTabAllowed(tabId)).map(([tabId, label]) => (
            <button
              key={tabId}
              onClick={() => openMobileDockTab(tabId)}
              style={{
                ...buttonStyle(activeRightTab === tabId && mobileDockOpen),
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
                {BROKER_TOOLS_ENABLED ? "Mobile Trading Dock" : "Mobile Insight Dock"}
              </div>
              <div style={{ color: theme.muted, fontSize: "9px", fontWeight: 850 }}>
                {selectedStock} / {rightPanelTabs.find((tab) => tab.id === activeRightTab)?.label || "Tools"}
              </div>
            </div>
            <button
              onClick={() => setMobileDockOpen(false)}
              title={BROKER_TOOLS_ENABLED ? "Close mobile trading dock" : "Close mobile insight dock"}
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
              {activeRightTab === "order" && (
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
                  tradingMode={effectiveTradingMode}
                  setTradingMode={setTradingMode}
                  liveTradingEnabled={LIVE_TRADING_ENABLED}
                  orderConfirmed={orderConfirmed}
                  setOrderConfirmed={setOrderConfirmed}
                  maxOrderValue={maxOrderValue}
                  setMaxOrderValue={setMaxOrderValue}
                  dailyLossLimit={dailyLossLimit}
                  setDailyLossLimit={setDailyLossLimit}
                  riskPerTrade={riskPerTrade}
                  setRiskPerTrade={setRiskPerTrade}
                  orderPreview={orderPreview}
                  riskGuard={riskGuard}
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

              {activeRightTab === "risk" && (
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
                    primaryBrokerBalance={BROKER_TOOLS_ENABLED ? primaryBrokerBalance : null}
                    brokerPositions={BROKER_TOOLS_ENABLED ? brokerPositions : []}
                    brokerConnected={BROKER_TOOLS_ENABLED && brokerConnected}
                    brokerSyncMeta={BROKER_TOOLS_ENABLED ? brokerSyncMeta : {}}
                    brokerToolsEnabled={BROKER_TOOLS_ENABLED}
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

              {BROKER_TOOLS_ENABLED && activeRightTab === "broker" && (
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

              {activeRightTab === "replay" && (
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

              {activeRightTab === "activity" && (
                <ActivityLogPanel
                  theme={theme}
                  activityLog={activityLog}
                  clearActivityLog={clearActivityLog}
                  buttonStyle={buttonStyle}
                />
              )}

              {activeRightTab === "audit" && (
                <ExecutionAuditPanel
                  theme={theme}
                  auditTrail={orderAuditTrail}
                  syncStatus={orderAuditSyncStatus}
                  clearAuditTrail={clearOrderAuditTrail}
                  buttonStyle={buttonStyle}
                />
              )}

              {activeRightTab === "health" && (
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
                  qtrdHealth={visibleMarketDataHealth}
                  brokerToolsEnabled={BROKER_TOOLS_ENABLED}
                  buttonStyle={buttonStyle}
                />
              )}

              {activeRightTab === "alerts" && (
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

      {!BROKER_TOOLS_ENABLED && (
        <PublicOnboarding
          theme={theme}
          isOpen={publicOnboardingOpen}
          onClose={closePublicOnboarding}
          onDontShowAgain={dismissPublicOnboarding}
        />
      )}

      {!usePremiumShell && (
      <TerminalStatusBar
        theme={theme}
        terminalMonoFont={terminalMonoFont}
        disclosure={
          !BROKER_TOOLS_ENABLED
            ? "Market data may be delayed or provider-limited. Scanner/news context is informational only; verify before acting."
            : ""
        }
        rows={
          advancedMode
            ? [
                ["Data", resolvedMarketDataStatusLabel],
                ["Backend", backendHealthLabel],
                ["Scanner", scannerSourceLabel],
                ["News", resolvedNewsStatusLabel],
                ...(BROKER_TOOLS_ENABLED ? [["Broker", brokerSourceLabel], ["Mode", modeSourceLabel]] : [["AI", aiHealthLabel]]),
                ["Checked", healthLastCheckedAt ? new Date(healthLastCheckedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Pending"],
              ]
            : [
                ["Data", resolvedMarketDataStatusLabel],
                ["Backend", backendHealthLabel],
                ["Scanner", scannerSourceLabel],
                ["News", resolvedNewsStatusLabel],
                ...(BROKER_TOOLS_ENABLED ? [["Broker", brokerSourceLabel], ["Mode", modeSourceLabel]] : [["AI", aiHealthLabel]]),
                ["Checked", healthLastCheckedAt ? new Date(healthLastCheckedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Pending"],
              ]
        }
      />
      )}

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
