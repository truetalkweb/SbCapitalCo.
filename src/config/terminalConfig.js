export const BROKER_API_URL = (import.meta.env.VITE_BROKER_API_URL || "http://localhost:4000").replace(/\/+$/, "");

export const terminalMonoFont =
  '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace';

export const defaultStocks = [
  { symbol: "NVDA", price: 211.5, change: "+1.18%", volume: "6.25M" },
  { symbol: "AMD", price: 168.22, change: "+0.74%", volume: "2.46M" },
  { symbol: "TSLA", price: 251.44, change: "-0.52%", volume: "8.94M" },
  { symbol: "PLTR", price: 42.7, change: "+1.06%", volume: "4.33M" },
];

export const cryptoStocks = [
  { symbol: "BTC-USD", price: 80739.85, change: "+0.69%", volume: "12.4B" },
  { symbol: "ETH-USD", price: 2331.05, change: "+1.03%", volume: "8.1B" },
  { symbol: "SOL-USD", price: 182.44, change: "+2.51%", volume: "2.8B" },
];

export const forexStocks = [
  { symbol: "EUR/USD", price: 1.1785, change: "+0.52%", volume: "-" },
  { symbol: "GBP/USD", price: 1.3632, change: "+0.61%", volume: "-" },
  { symbol: "USD/CAD", price: 1.3722, change: "-0.22%", volume: "-" },
];

export const marketRegions = {
  us: {
    label: "US",
    currency: "USD",
    timezone: "America/New_York",
    symbols: ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMD", "TSLA", "PLTR"],
  },
  canada: { label: "Canada", currency: "CAD", timezone: "America/Toronto", symbols: ["SHOP.TO", "RY.TO", "TD.TO", "BNS.TO"] },
  crypto: { label: "Crypto", currency: "USD", timezone: "UTC", symbols: ["BTC-USD", "ETH-USD", "SOL-USD"] },
  forex: { label: "Forex", currency: "FX", timezone: "UTC", symbols: ["EUR/USD", "GBP/USD", "USD/CAD"] },
};

export const popularSymbols = [
  "AAPL",
  "MSFT",
  "SPY",
  "QQQ",
  "META",
  "AMZN",
  "GOOGL",
  "COIN",
  "MARA",
  "SMCI",
  "AVGO",
  "NFLX",
];

export const defaultSmallCapMovers = [
  { symbol: "RNZA", price: 12.07, change: "+27.10%", volume: "44.84K" },
  { symbol: "REBN", price: 2.0, change: "+8.60%", volume: "84.17K" },
  { symbol: "DTI", price: 4.01, change: "+4.60%", volume: "333.03K" },
  { symbol: "PTL", price: 4.0, change: "+2.45%", volume: "314.15K" },
];

export const workspaceViews = [
  { id: "intelligence", label: "Intel", icon: "AI" },
  { id: "charts", label: "Charts", icon: "CH" },
  { id: "scanner", label: "Scanner", icon: "SC" },
  { id: "watchlist", label: "Watchlist", icon: "WL" },
  { id: "replay", label: "Replay", icon: "RP" },
  { id: "portfolio", label: "Portfolio", icon: "PF" },
  { id: "alerts", label: "Alerts", icon: "AL" },
  { id: "journal", label: "Journal", icon: "JN" },
  { id: "broker", label: "Broker", icon: "BR" },
  { id: "settings", label: "Settings", icon: "ST" },
];

export const rightPanelTabs = [
  { id: "intel", label: "Intel" },
  { id: "order", label: "Order" },
  { id: "broker", label: "Broker" },
  { id: "risk", label: "Risk" },
  { id: "replay", label: "Replay" },
  { id: "activity", label: "Activity" },
  { id: "health", label: "Health" },
  { id: "alerts", label: "Alerts" },
  { id: "dom", label: "DOM" },
  { id: "keys", label: "Keys" },
];

export const layoutPresets = {
  intelligence: {
    label: "Market Intel",
    activeWorkspace: "charts",
    layoutMode: "1",
    gridMode: "2",
    syncCharts: false,
    replayMode: false,
    rightTab: "intel",
  },
  day: {
    label: "Day Trading",
    activeWorkspace: "charts",
    layoutMode: "2",
    gridMode: "2",
    syncCharts: false,
    replayMode: false,
    rightTab: "order",
  },
  swing: {
    label: "Swing Review",
    activeWorkspace: "scanner",
    layoutMode: "2",
    gridMode: "2",
    syncCharts: true,
    replayMode: false,
    rightTab: "risk",
  },
  replay: {
    label: "Replay Lab",
    activeWorkspace: "replay",
    layoutMode: "1",
    gridMode: "2",
    syncCharts: false,
    replayMode: true,
    rightTab: "replay",
  },
  broker: {
    label: "Broker Focus",
    activeWorkspace: "broker",
    layoutMode: "1",
    gridMode: "2",
    syncCharts: false,
    replayMode: false,
    rightTab: "broker",
  },
  clean: {
    label: "Clean Chart",
    activeWorkspace: "charts",
    layoutMode: "1",
    gridMode: "2",
    syncCharts: false,
    replayMode: false,
    rightTab: "intel",
  },
  journal: {
    label: "Journal Review",
    activeWorkspace: "journal",
    layoutMode: "1",
    gridMode: "2",
    syncCharts: false,
    replayMode: false,
    rightTab: "risk",
  },
};

export const defaultJournalDraft = {
  symbol: "NVDA",
  bias: "Long",
  setup: "Breakout",
  grade: "B",
  tags: "",
  mistakeTags: "",
  followedPlan: "Yes",
  emotion: "Calm",
  result: "Review",
  screenshotUrl: "",
  plan: "",
  review: "",
};
