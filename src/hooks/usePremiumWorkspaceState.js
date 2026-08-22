import { useRef, useState } from "react";

export function usePremiumWorkspaceState() {
  const [selectedNewsId, setSelectedNewsId] = useState(null);
  const [selectedAlertSymbol, setSelectedAlertSymbol] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedPositionSymbol, setSelectedPositionSymbol] = useState(null);
  const [alertDraftPrice, setAlertDraftPrice] = useState("");
  const [alertDraftDirection, setAlertDraftDirection] = useState("above");
  const [alertView, setAlertView] = useState("Active Alerts");
  const [watchlistView, setWatchlistView] = useState("Main Watchlist");
  const [watchlistSearch, setWatchlistSearch] = useState("");
  const [newsView, setNewsView] = useState("Top News");
  const [newsSearch, setNewsSearch] = useState("");
  const [orderView, setOrderView] = useState("All Orders");
  const [orderSearch, setOrderSearch] = useState("");
  const [bottomDockView, setBottomDockView] = useState("positions");
  const [replayIndicatorMenuOpen, setReplayIndicatorMenuOpen] = useState(false);
  const [replaySettingsOpen, setReplaySettingsOpen] = useState(false);
  const [replayActionStatus, setReplayActionStatus] = useState("");
  const [settingsTab, setSettingsTab] = useState("General");
  const [passwordResetStatus, setPasswordResetStatus] = useState("idle");
  const [accountDeleteConfirmation, setAccountDeleteConfirmation] = useState("");
  const replayChartRef = useRef(null);

  return {
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
  };
}
