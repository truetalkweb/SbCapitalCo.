export const BROKER_API_URL = (import.meta.env.VITE_BROKER_API_URL || "http://localhost:4000").replace(/\/+$/, "");
export const PUBLIC_PRODUCT_MODE = String(import.meta.env.VITE_PUBLIC_PRODUCT_MODE ?? "true").toLowerCase() === "true";
export const ENABLE_BROKER_TOOLS = String(import.meta.env.VITE_ENABLE_BROKER_TOOLS ?? "false").toLowerCase() === "true";
export const ENABLE_LIVE_TRADING = String(import.meta.env.VITE_ENABLE_LIVE_TRADING ?? "false").toLowerCase() === "true";
export const BROKER_TOOLS_ENABLED = !PUBLIC_PRODUCT_MODE && ENABLE_BROKER_TOOLS;
export const LIVE_TRADING_ENABLED = BROKER_TOOLS_ENABLED && ENABLE_LIVE_TRADING;

export const terminalMonoFont =
  '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace';

export const terminalSansFont =
  '"Roboto", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const defaultStocks = [
  { symbol: "NVDA", price: null, change: null, volume: null, pendingQuote: true },
  { symbol: "AMD", price: null, change: null, volume: null, pendingQuote: true },
  { symbol: "TSLA", price: null, change: null, volume: null, pendingQuote: true },
  { symbol: "PLTR", price: null, change: null, volume: null, pendingQuote: true },
];

export const cryptoStocks = [
  { symbol: "BTC-USD", price: null, change: null, volume: null, pendingQuote: true },
  { symbol: "ETH-USD", price: null, change: null, volume: null, pendingQuote: true },
  { symbol: "SOL-USD", price: null, change: null, volume: null, pendingQuote: true },
];

export const forexStocks = [
  { symbol: "EUR/USD", price: null, change: null, volume: null, pendingQuote: true },
  { symbol: "GBP/USD", price: null, change: null, volume: null, pendingQuote: true },
  { symbol: "USD/CAD", price: null, change: null, volume: null, pendingQuote: true },
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
  { id: "audit", label: "Audit" },
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
