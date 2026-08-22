import { Star } from "lucide-react";
import { terminalMonoFont, terminalSansFont } from "../../config/terminalConfig";
import { useDashboardData } from "../../hooks/useDashboardData";
import { usePremiumScannerRows } from "../../hooks/usePremiumScannerRows";
import { usePremiumWorkspaceActions } from "../../hooks/usePremiumWorkspaceActions";
import { usePremiumWorkspaceState } from "../../hooks/usePremiumWorkspaceState";
import { usePremiumWorkspaceViews } from "../../hooks/usePremiumWorkspaceViews";
import DashboardMarketIntelligence from "./DashboardMarketIntelligence";
import {
  formatCompactNumber,
  formatMultiple,
} from "../../utils/dashboardFormatters";
import { saveSetting } from "../../utils/storage";
import { DEFAULT_SCANNER_FILTERS } from "../../utils/premiumScanner";
import {
  DEFAULT_ENTITLEMENTS,
  canUseWorkspace,
} from "../../services/entitlements";
import {
  buildStocks,
  hasNumericValue,
  makeJournalTrades,
  makeNews,
  makeReplayTrades,
  money,
  moveOf,
  num,
  pct,
  toneColor,
} from "./premiumWorkspaceData";

import {
  ActionButton,
  DetailRail,
  EmptyWorkspace,
  LockedWorkspace,
  PremiumCard,
  PremiumTable,
  PremiumTabs,
  StatusPill,
} from "./PremiumWorkspacePrimitives";
import AlertsWorkspacePage from "./pages/AlertsWorkspacePage";
import ChartsWorkspacePage from "./pages/ChartsWorkspacePage";
import JournalWorkspacePage from "./pages/JournalWorkspacePage";
import NewsWorkspacePage from "./pages/NewsWorkspacePage";
import OrdersWorkspacePage from "./pages/OrdersWorkspacePage";
import PerformanceWorkspacePage from "./pages/PerformanceWorkspacePage";
import PositionsWorkspacePage from "./pages/PositionsWorkspacePage";
import ReplayWorkspacePage from "./pages/ReplayWorkspacePage";
import RiskWorkspacePage from "./pages/RiskWorkspacePage";
import ScannerWorkspacePage from "./pages/ScannerWorkspacePage";
import SettingsWorkspacePage from "./pages/SettingsWorkspacePage";
import WatchlistWorkspacePage from "./pages/WatchlistWorkspacePage";

export default function PremiumWorkspace({
  activeWorkspace,
  setActiveWorkspace,
  viewportWidth = 1440,
  viewportHeight = 900,
  theme,
  renderChartGrid,
  selectedStock,
  selectedStockData,
  liveStocks,
  scannerStocks,
  scannerGroups = {},
  scannerMeta = {},
  news,
  newsMeta = {},
  marketIndexes = [],
  brokerApiUrl = "",
  alerts,
  createPriceAlert,
  toggleAlert,
  updateAlert,
  removeAlert,
  orders,
  positions,
  allSymbols,
  accountSummary,
  realizedPnL,
  totalUnrealizedPnL,
  quantity,
  setQuantity,
  setOrderSide,
  setOrderConfirmed,
  setOrderMessage,
  setPremiumDockTab,
  selectMainSymbol,
  addSymbolToWatchlist,
  removeWatchlistSymbol,
  scannerTab,
  setScannerTab,
  scannerPresets = [],
  setScannerPresets,
  activeScannerPreset = "default",
  setActiveScannerPreset,
  timeframe,
  setTimeframe,
  layoutMode = "1",
  setLayoutMode,
  gridMode = "2",
  setGridMode,
  chartIndicators,
  setChartIndicators,
  themeMode,
  setThemeMode,
  timeZone = "America/Vancouver",
  setTimeZone,
  premiumPreferences = {},
  setPremiumPreferences,
  user,
  saveWorkspaceToCloud,
  loadWorkspaceFromCloud,
  requestPasswordReset,
  deleteAccount,
  accountDeleteStatus = "idle",
  resetWorkspace,
  brokerConnected,
  journalEntries,
  replayPlaying,
  replaySpeed,
  replayStats,
  replayTrades,
  replayEquity = [],
  replayIndex = 0,
  replayDataLength = 0,
  replayBookmarks = [],
  setReplayBookmarks,
  replayNotes = "",
  setReplayNotes,
  setReplayPlaying,
  setReplaySpeed,
  setReplayIndex,
  stepReplay,
  resetReplay,
  takeScreenshot,
  toggleFullscreen,
  openReplayJournal,
  journalDraft,
  setJournalDraft,
  addJournalEntry,
  removeJournalEntry,
  exportJournalCsv,
  exportTradeSummaryCsv,
  entitlements = DEFAULT_ENTITLEMENTS,
  entitlementsStatus = "idle",
  onOpenHelp,
  onOpenIssueReport,
}) {
  const isNarrowWorkspace = viewportWidth <= 900;
  const stocks = buildStocks(liveStocks, scannerStocks, selectedStockData, selectedStock);
  const selected = stocks.find((row) => row.symbol === selectedStock) || stocks[0];
  const headlines = makeNews(news, selectedStock);
  const dashboard = useDashboardData({
    selectedStock,
    selectedStockData,
    liveStocks,
    scannerStocks,
    news,
    positions,
    orders,
    alerts,
    allSymbols,
    accountSummary,
    realizedPnL,
    totalUnrealizedPnL,
  });
  const orderRows = (orders || []).map((order, index) => ({
    time: order.time || order.createdAt?.slice(11, 19) || "Pending",
    symbol: order.symbol || selectedStock,
    side: order.side || order.orderSide || "BUY",
    type: order.type || order.orderType || "LIMIT",
    qty: order.qty || order.quantity || quantity,
    price: order.price || order.limitPrice || num(selected.price).toFixed(2),
    status: order.status || "REVIEW",
    filled: order.filled || 0,
    remaining: order.remaining || 0,
    tif: order.tif || "DAY",
    id: order.id || `LOCAL-${index + 1}`,
  }));
  const positionRows = Object.keys(positions || {}).length
    ? Object.entries(positions).map(([symbol, pos]) => ({
        symbol,
        side: Number(pos.quantity || 0) >= 0 ? "LONG" : "SHORT",
        qty: Math.abs(Number(pos.quantity || 0)),
        avg: Number(pos.average || pos.avgPrice || 0),
        last: num(allSymbols?.find((row) => row.symbol === symbol)?.price, Number(pos.average || 0)),
        exposure: "Not calculated",
        risk: pos.riskScore || "Context",
        beta: pos.beta ?? null,
        var1d: pos.var1d ?? null,
        dayPnl: Number(pos.dayPnl ?? pos.unrealizedPnl ?? 0),
        totalPnl: Number(pos.totalPnl ?? pos.unrealizedPnl ?? 0),
      }))
    : [];
  const alertRows = alerts?.length
    ? alerts.map((alert) => ({
        id: alert.id,
        symbol: alert.symbol || selectedStock,
        type: alert.direction ? `Price ${alert.direction}` : "Price Above",
        condition: alert.trigger ? `Price ${alert.direction || "above"} ${money(alert.trigger)}` : "No trigger configured",
        last: num(allSymbols?.find((row) => row.symbol === alert.symbol)?.price, 0),
        target: alert.trigger || "Not set",
        status: alert.triggeredAt ? "Triggered" : alert.active === false ? "Paused" : "Active",
        created: alert.createdAt || "Not recorded",
        next: alert.triggeredAt || "Not triggered",
        history: Array.isArray(alert.history) ? alert.history : [],
      }))
    : [];
  const journalRows = makeJournalTrades(journalEntries);
  const replayRows = makeReplayTrades(replayTrades, selectedStock);
  const journalNet = journalRows.reduce((total, row) => total + num(row.pnl), 0);
  const replayNet = num(replayStats?.netPnL, 0);
  const replayWinRate = replayStats?.winRate || "0.00";
  const workspaceState = usePremiumWorkspaceState();
  const {
    accountDeleteConfirmation,
    alertDraftDirection,
    alertDraftPrice,
    alertView,
    bottomDockView,
    newsSearch,
    newsView,
    orderSearch,
    orderView,
    passwordResetStatus,
    replayActionStatus,
    replayChartRef,
    replayIndicatorMenuOpen,
    replaySettingsOpen,
    selectedAlertSymbol,
    selectedNewsId,
    selectedOrderId,
    selectedPositionSymbol,
    settingsTab,
    setAccountDeleteConfirmation,
    setAlertDraftDirection,
    setAlertDraftPrice,
    setAlertView,
    setBottomDockView,
    setNewsSearch,
    setNewsView,
    setOrderSearch,
    setOrderView,
    setPasswordResetStatus,
    setReplayActionStatus,
    setReplayIndicatorMenuOpen,
    setReplaySettingsOpen,
    setSelectedAlertSymbol,
    setSelectedNewsId,
    setSelectedOrderId,
    setSelectedPositionSymbol,
    setSettingsTab,
    setWatchlistSearch,
    setWatchlistView,
    watchlistSearch,
    watchlistView,
  } = workspaceState;
  const defaultLandingTab = premiumPreferences.defaultLandingTab || activeWorkspace || "dashboard";
  const compactMode = Boolean(premiumPreferences.compactMode);
  const scannerAutoRefresh = premiumPreferences.scannerAutoRefresh !== false;
  const relativeVolumeThreshold = String(premiumPreferences.relativeVolumeThreshold ?? "1.50");
  const riskWarnings = premiumPreferences.riskWarnings !== false;
  const notificationPreferences = {
    priceAlerts: true,
    newsCatalysts: false,
    soundAlerts: false,
    ...(premiumPreferences.notificationPreferences || {}),
  };
  const updatePremiumPreference = (key, value) => {
    setPremiumPreferences?.((current) => ({ ...current, [key]: value }));
  };
  const updateNotificationPreference = (key, value) => {
    setPremiumPreferences?.((current) => ({
      ...current,
      notificationPreferences: {
        ...(current.notificationPreferences || {}),
        [key]: value,
      },
    }));
  };
  const captureReplayScreenshot = () => {
    const canvas = replayChartRef.current?.querySelector("canvas");
    if (!canvas) {
      setReplayActionStatus("Chart image is not ready yet.");
      takeScreenshot?.();
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${selectedStock}-replay-chart.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setReplayActionStatus("Replay chart image saved.");
    }, "image/png");
  };

  const enterReplayFullscreen = async () => {
    const replayChart = replayChartRef.current;
    if (!replayChart?.requestFullscreen) {
      toggleFullscreen?.();
      return;
    }

    await replayChart.requestFullscreen();
    setReplayActionStatus("Replay chart opened fullscreen.");
  };

  const jumpReplay = (target) => {
    if (!replayDataLength || !setReplayIndex) return;
    if (target === "open") {
      setReplayIndex(Math.min(80, replayDataLength - 1));
      return;
    }
    if (target === "close") {
      setReplayIndex(replayDataLength - 1);
      return;
    }
    const candleMinutes = {
      "1m": 1,
      "5m": 5,
      "15m": 15,
      "1H": 60,
      "1D": 390,
    }[timeframe] || 5;
    const candleSteps = Math.max(1, Math.round(target / candleMinutes));
    setReplayIndex((current) => Math.min(current + candleSteps, replayDataLength - 1));
  };

  const addReplayBookmark = () => {
    const bookmark = {
      id: `${selectedStock}-${replayIndex}-${replayBookmarks.length}`,
      symbol: selectedStock,
      index: replayIndex,
      label: `${selectedStock} step ${replayIndex + 1}`,
    };
    setReplayBookmarks((current) => {
      const next = [bookmark, ...current.filter((item) => item.symbol !== bookmark.symbol || item.index !== bookmark.index)].slice(0, 12);
      saveSetting("sb_replay_bookmarks", next);
      return next;
    });
  };

  const removeReplayBookmark = (bookmarkId) => {
    setReplayBookmarks((current) => {
      const next = current.filter((item) => item.id !== bookmarkId);
      saveSetting("sb_replay_bookmarks", next);
      return next;
    });
  };

  const sendPasswordReset = async () => {
    setPasswordResetStatus("sending");
    try {
      const sent = await requestPasswordReset?.();
      setPasswordResetStatus(sent ? "sent" : "failed");
    } catch {
      setPasswordResetStatus("failed");
    }
  };
  const {
    scannerDisplayRows,
    scannerFilters,
    scannerMinimumRvol,
    scannerUniverseRows,
  } = usePremiumScannerRows({
    activeScannerPreset,
    fallbackStocks: stocks,
    premiumPreferences,
    relativeVolumeThreshold,
    scannerGroups,
    scannerPresets,
    scannerStocks,
    scannerTab,
    selectedStock,
    selectedStockData,
  });
  const updateScannerFilter = (key, value) => {
    const next = { ...scannerFilters, [key]: value };
    saveSetting("sb_scanner_filters", next);
    updatePremiumPreference("scannerFilters", next);
  };
  const resetScannerFilters = () => {
    const next = { ...DEFAULT_SCANNER_FILTERS };
    updatePremiumPreference("relativeVolumeThreshold", "0");
    saveSetting("sb_scanner_filters", next);
    saveSetting("sb_relative_volume_threshold", "0");
    updatePremiumPreference("scannerFilters", next);
  };
  const {
    newsRows,
    selectedAlert,
    selectedOrder,
    selectedPosition,
    selectedStory,
    visibleOrderRows,
    watchlistRows,
  } = usePremiumWorkspaceViews({
    alertRows,
    dashboard,
    headlines,
    newsSearch,
    newsView,
    orderRows,
    orderSearch,
    orderView,
    positionRows,
    selected,
    selectedAlertSymbol,
    selectedNewsId,
    selectedOrderId,
    selectedPositionSymbol,
    watchlistSearch,
    watchlistView,
  });

  const {
    openChart,
    prepareOrderReview,
    prepareReviewAction,
  } = usePremiumWorkspaceActions({
    selectedSymbol: selected.symbol,
    selectMainSymbol,
    setActiveWorkspace,
    setOrderConfirmed,
    setOrderMessage,
    setOrderSide,
    setPremiumDockTab,
  });

  const page = {
    minHeight: 0,
    height: "100%",
    overflow: "auto",
    padding: compactMode ? "8px" : "12px",
    color: theme.text,
    fontFamily: terminalSansFont,
  };
  if (activeWorkspace !== "settings" && !canUseWorkspace(entitlements, activeWorkspace)) {
    return (
      <div style={page}>
        <LockedWorkspace
          theme={theme}
          activeWorkspace={activeWorkspace}
          entitlements={entitlements}
          status={entitlementsStatus}
        />
      </div>
    );
  }

  const mainTwoCol = {
    display: "grid",
    gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "minmax(0, 1fr) 360px",
    gap: 10,
    minHeight: 0,
  };
  const bottomDockTabs = [
    { id: "positions", label: `Positions (${positionRows.length})` },
    { id: "orders", label: `Orders (${orderRows.length})` },
    { id: "alerts", label: `Alerts (${alertRows.length})` },
  ];
  const bottomDockConfig = bottomDockView === "orders"
    ? {
        rows: orderRows.slice(0, 2),
        empty: "No authenticated orders",
        keyField: "id",
        columns: [
          { key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true },
          { key: "side", label: "Side", width: "80px", color: (row) => row.side === "BUY" ? theme.green : theme.red },
          { key: "qty", label: "Qty", width: "80px", align: "right", mono: true },
          { key: "price", label: "Price", width: "110px", align: "right", mono: true },
          { key: "status", label: "Status", width: "130px" },
        ],
      }
    : bottomDockView === "alerts"
      ? {
          rows: alertRows.slice(0, 2),
          empty: "No saved alerts",
          keyField: "id",
          columns: [
            { key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true },
            { key: "type", label: "Type", width: "130px" },
            { key: "target", label: "Target", width: "100px", align: "right", mono: true },
            { key: "status", label: "Status", width: "110px" },
          ],
        }
      : {
          rows: positionRows.slice(0, 1),
          empty: "No connected account positions",
          keyField: "symbol",
          columns: [
            { key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true },
            { key: "side", label: "Side", width: "80px", color: () => theme.green, mono: true },
            { key: "qty", label: "Qty", width: "80px", align: "right", mono: true },
            { key: "avg", label: "Avg Price", width: "110px", align: "right", mono: true, render: (row) => row.avg.toFixed(2) },
            { key: "last", label: "Last Price", width: "110px", align: "right", mono: true, render: (row) => row.last.toFixed(2) },
            { key: "pnl", label: "P&L", width: "110px", align: "right", mono: true, color: (row) => (row.last - row.avg) * row.qty >= 0 ? theme.green : theme.red, render: (row) => money((row.last - row.avg) * row.qty) },
          ],
        };
  const bottomDock = (
    <PremiumCard theme={theme} style={{ height: 142, overflow: "hidden" }}>
      <PremiumTabs theme={theme} tabs={bottomDockTabs} active={bottomDockView} onChange={setBottomDockView} />
      <PremiumTable
        theme={theme}
        columns={bottomDockConfig.columns}
        rows={bottomDockConfig.rows}
        keyField={bottomDockConfig.keyField}
        emptyMessage={bottomDockConfig.empty}
        style={{ height: "calc(100% - 40px)" }}
        rowMinHeight={32}
        headerMinHeight={30}
        cellPadding="0 12px"
        columnGap={10}
      />
    </PremiumCard>
  );
  const quickOrder = (
    <PremiumCard theme={theme} title="Quick Order" style={{ minWidth: 0, overflow: "hidden" }}>
      <div style={{ padding: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 62px 76px 82px", gap: 7, minWidth: 0 }}>
          {["Symbol", "Shares", "Order Type", "Limit Price"].map((label, index) => (
            <label key={label} style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 10, textTransform: "uppercase", minWidth: 0 }}>
              {label}
              <input
                value={index === 0 ? selectedStock : index === 1 ? quantity : index === 2 ? "LIMIT" : num(selected.price).toFixed(2)}
                onChange={(event) => index === 1 && setQuantity?.(Number(event.target.value) || 1)}
                readOnly={index !== 1}
                style={{ width: "100%", minWidth: 0, boxSizing: "border-box", height: 31, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 5, background: theme.panel2, color: theme.text, padding: "0 7px", fontFamily: terminalMonoFont }}
              />
            </label>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
          {["BUY", "SELL"].map((side) => (
            <ActionButton
              key={side}
              theme={theme}
              good={side === "BUY"}
              danger={side === "SELL"}
              onClick={() => {
                setOrderSide?.(side);
                setOrderConfirmed?.(false);
                setPremiumDockTab?.("orders");
                setOrderMessage?.(`${side} review prepared for ${selectedStock}. This shortcut is review-only.`);
              }}
            >
              {side === "BUY" ? "Buy" : "Sell"}
            </ActionButton>
          ))}
        </div>
      </div>
    </PremiumCard>
  );
  const selectedActions = (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9, marginTop: 16 }}>
      <ActionButton theme={theme} active onClick={() => openChart(selected.symbol)}>
        Open Chart
      </ActionButton>
      <ActionButton theme={theme} onClick={() => prepareReviewAction("Alert review", selected.symbol)}>
        Alert Review
      </ActionButton>
      <ActionButton theme={theme} good onClick={() => prepareOrderReview("BUY", selected.symbol)}>
        Review Order
      </ActionButton>
    </div>
  );
  function scannerTable(rows = stocks.slice(0, 8), selectedKey = selected.symbol, tableProps = {}) {
    return (
      <PremiumTable
        theme={theme}
        columns={[
          { key: "symbol", label: "Symbol", width: "1.5fr", mono: true, strong: true, render: (row) => <><Star size={14} color={theme.muted} style={{ verticalAlign: "-2px", marginRight: 10 }} />{row.symbol}<span style={{ display: "block", color: theme.muted, fontFamily: terminalSansFont, fontSize: 10, fontWeight: 500 }}>{row.name}</span></> },
          { key: "price", label: "Price", width: "90px", align: "right", mono: true, render: (row) => num(row.price).toFixed(2) },
          { key: "change", label: "Chg%", width: "90px", align: "right", mono: true, color: (row) => toneColor(theme, moveOf(row)), render: (row) => pct(moveOf(row)) },
          { key: "gap", label: "Gap%", width: "90px", align: "right", mono: true, color: (row) => hasNumericValue(row.gapPercent) ? toneColor(theme, row.gapPercent) : theme.muted, render: (row) => hasNumericValue(row.gapPercent) ? pct(row.gapPercent) : "Unavailable" },
          { key: "rvol", label: "RVOL", width: "70px", align: "right", mono: true, render: (row) => hasNumericValue(row.relativeVolume) ? formatMultiple(row.relativeVolume) : "Unavailable" },
          { key: "volume", label: "Volume", width: "95px", align: "right", mono: true, render: (row) => row.volumeLabel || (typeof row.volume === "string" ? row.volume : formatCompactNumber(row.volume, 1)) },
          { key: "float", label: "Float", width: "90px", align: "right", mono: true, render: (row) => row.floatLabel || (row.floatShares ? formatCompactNumber(row.floatShares, 2) : "Unavailable") },
          { key: "setup", label: "Catalyst", width: "130px", render: (row) => row.catalyst || row.setup },
          { key: "score", label: "Score", width: "70px", align: "center", render: (row) => <StatusPill theme={theme} tone={row.score >= 70 ? "good" : "warn"}>{row.score}</StatusPill> },
          { key: "risk", label: "Risk", width: "70px", align: "right", color: (row) => row.risk === "Low" ? theme.green : theme.amber },
        ]}
        rows={rows}
        selectedKey={selectedKey}
        onSelect={(row) => selectMainSymbol?.(row.symbol, row, "dashboard-watchlist")}
        {...tableProps}
      />
    );
  }

  function selectedRail(extra = null, selectedOverride = selected) {
    return (
      <DetailRail theme={theme} selected={selectedOverride} actions={selectedActions}>
        {extra}
      </DetailRail>
    );
  }


  if (activeWorkspace === "charts" || activeWorkspace === "chart-analysis") {
    return (
      <ChartsWorkspacePage
        {...{
          chartIndicators,
          dashboard,
          gridMode,
          isNarrowWorkspace,
          layoutMode,
          page,
          renderChartGrid,
          selectMainSymbol,
          selected,
          selectedActions,
          setGridMode,
          setLayoutMode,
          setOrderMessage,
          stocks,
          theme,
          viewportHeight,
        }}
      />
    );
  }

  if (activeWorkspace === "scanner") {
    return (
      <ScannerWorkspacePage
        {...{
          activeScannerPreset,
          isNarrowWorkspace,
          mainTwoCol,
          page,
          relativeVolumeThreshold,
          resetScannerFilters,
          scannerAutoRefresh,
          scannerDisplayRows,
          scannerFilters,
          scannerMeta,
          scannerMinimumRvol,
          scannerPresets,
          scannerTab,
          scannerTable,
          scannerUniverseRows,
          selected,
          selectedRail,
          selectedStock,
          setActiveScannerPreset,
          setOrderMessage,
          setScannerPresets,
          setScannerTab,
          theme,
          updatePremiumPreference,
          updateScannerFilter,
        }}
      />
    );
  }

  if (activeWorkspace === "watchlist") {
    return (
      <WatchlistWorkspacePage
        {...{
          addSymbolToWatchlist,
          alertRows,
          journalRows,
          mainTwoCol,
          page,
          removeWatchlistSymbol,
          selectMainSymbol,
          selected,
          selectedRail,
          setWatchlistSearch,
          setWatchlistView,
          theme,
          watchlistRows,
          watchlistSearch,
          watchlistView,
        }}
      />
    );
  }

  if (activeWorkspace === "news") {
    return (
      <NewsWorkspacePage
        {...{
          addSymbolToWatchlist,
          mainTwoCol,
          newsRows,
          newsSearch,
          newsView,
          page,
          prepareReviewAction,
          scannerTable,
          selectMainSymbol,
          selected,
          selectedStory,
          setActiveWorkspace,
          setNewsSearch,
          setNewsView,
          setSelectedNewsId,
          stocks,
          theme,
        }}
      />
    );
  }

  if (activeWorkspace === "alerts") {
    return (
      <AlertsWorkspacePage
        {...{
          alertDraftDirection,
          alertDraftPrice,
          alertRows,
          alertView,
          bottomDock,
          createPriceAlert,
          isNarrowWorkspace,
          mainTwoCol,
          page,
          quickOrder,
          removeAlert,
          selectMainSymbol,
          selected,
          selectedAlert,
          selectedRail,
          setAlertDraftDirection,
          setAlertDraftPrice,
          setAlertView,
          setOrderMessage,
          setSelectedAlertSymbol,
          theme,
          toggleAlert,
          updateAlert,
        }}
      />
    );
  }

  if (activeWorkspace === "orders") {
    return (
      <OrdersWorkspacePage
        {...{
          mainTwoCol,
          orderSearch,
          orderView,
          page,
          prepareReviewAction,
          quantity,
          quickOrder,
          selectMainSymbol,
          selected,
          selectedOrder,
          setOrderSearch,
          setOrderView,
          setSelectedOrderId,
          theme,
          visibleOrderRows,
        }}
      />
    );
  }

  if (activeWorkspace === "positions") {
    return (
      <PositionsWorkspacePage
        {...{
          mainTwoCol,
          orderRows,
          page,
          positionRows,
          selectMainSymbol,
          selectedPosition,
          selectedRail,
          setSelectedPositionSymbol,
          stocks,
          theme,
        }}
      />
    );
  }

  if (activeWorkspace === "risk") {
    return (
      <RiskWorkspacePage
        {...{
          alertRows,
          mainTwoCol,
          page,
          positionRows,
          selectMainSymbol,
          selectedPosition,
          setSelectedPositionSymbol,
          theme,
        }}
      />
    );
  }

  if (activeWorkspace === "performance") {
    return (
      <PerformanceWorkspacePage
        {...{
          exportTradeSummaryCsv,
          isNarrowWorkspace,
          journalRows,
          page,
          positionRows,
          realizedPnL,
          theme,
          totalUnrealizedPnL,
        }}
      />
    );
  }

  if (activeWorkspace === "journal") {
    return (
      <JournalWorkspacePage
        {...{
          addJournalEntry,
          exportJournalCsv,
          isNarrowWorkspace,
          journalDraft,
          journalNet,
          journalRows,
          page,
          removeJournalEntry,
          selectedStock,
          setJournalDraft,
          theme,
        }}
      />
    );
  }

  if (activeWorkspace === "replay") {
    return (
      <ReplayWorkspacePage
        {...{
          addReplayBookmark,
          allSymbols,
          captureReplayScreenshot,
          chartIndicators,
          enterReplayFullscreen,
          isNarrowWorkspace,
          jumpReplay,
          openReplayJournal,
          page,
          removeReplayBookmark,
          renderChartGrid,
          replayActionStatus,
          replayBookmarks,
          replayChartRef,
          replayEquity,
          replayIndicatorMenuOpen,
          replayNet,
          replayNotes,
          replayPlaying,
          replayRows,
          replaySettingsOpen,
          replaySpeed,
          replayStats,
          replayTrades,
          replayWinRate,
          resetReplay,
          selected,
          selectedStock,
          setChartIndicators,
          setReplayIndex,
          setReplayIndicatorMenuOpen,
          setReplayNotes,
          setReplayPlaying,
          setReplaySettingsOpen,
          setReplaySpeed,
          setTimeframe,
          stepReplay,
          theme,
          timeframe,
        }}
      />
    );
  }

  if (activeWorkspace === "settings") {
    return (
      <SettingsWorkspacePage
        {...{
          accountDeleteConfirmation,
          accountDeleteStatus,
          brokerApiUrl,
          brokerConnected,
          chartIndicators,
          compactMode,
          defaultLandingTab,
          deleteAccount,
          entitlements,
          gridMode,
          isNarrowWorkspace,
          layoutMode,
          loadWorkspaceFromCloud,
          notificationPreferences,
          onOpenHelp,
          onOpenIssueReport,
          page,
          passwordResetStatus,
          relativeVolumeThreshold,
          resetWorkspace,
          riskWarnings,
          saveWorkspaceToCloud,
          scannerAutoRefresh,
          sendPasswordReset,
          setAccountDeleteConfirmation,
          setChartIndicators,
          setGridMode,
          setLayoutMode,
          setOrderMessage,
          setSettingsTab,
          setThemeMode,
          setTimeZone,
          setTimeframe,
          settingsTab,
          theme,
          themeMode,
          timeZone,
          timeframe,
          updateNotificationPreference,
          updatePremiumPreference,
          user,
        }}
      />
    );
  }


  if (activeWorkspace === "dashboard") {
    return (
      <div
        onWheelCapture={(event) => {
          const target = event.target;
          if (
            target instanceof Element &&
            target.closest("canvas") &&
            Math.abs(event.deltaY) > Math.abs(event.deltaX)
          ) {
            event.preventDefault();
            event.currentTarget.scrollTop += event.deltaY;
          }
        }}
        style={{
          ...page,
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <DashboardMarketIntelligence
          theme={theme}
          viewportWidth={viewportWidth}
          chart={renderChartGrid?.({ layoutMode: "1" })}
          marketIndexes={marketIndexes}
          brokerApiUrl={brokerApiUrl}
          breadthRows={allSymbols}
          scannerGroups={scannerGroups}
          scannerMeta={scannerMeta}
          news={dashboard.newsRows.length ? dashboard.newsRows : headlines}
          newsMeta={newsMeta}
          selected={dashboard.selected}
          watchlist={dashboard.watchlistRows}
          onSelect={(symbol, row) =>
            selectMainSymbol?.(symbol, row || null, "dashboard-intelligence")
          }
          onOpenChart={(symbol) => {
            selectMainSymbol?.(symbol);
            setActiveWorkspace?.("charts");
          }}
          onAddWatch={addSymbolToWatchlist}
        />
      </div>
    );
  }

  return (
    <div style={page}>
      <EmptyWorkspace
        theme={theme}
        title="Workspace unavailable"
        detail="This workspace is not registered in the premium terminal router."
      />
    </div>
  );
}
