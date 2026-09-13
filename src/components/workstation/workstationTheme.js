export function workstationTheme(base = {}) {
  const dark = base.isDark ?? base.mode !== "light";
  return {
    ...base,
    workstation: true,
    bg: dark ? "#05090c" : "#f4f7fa",
    panel: dark ? "#070d11" : "#ffffff",
    panel2: dark ? "#0d151b" : "#eaf0f4",
    panel3: dark ? "#111a21" : "#e4ecf2",
    card: dark ? "#070d11" : "#ffffff",
    border: dark ? "#18242c" : "#d4dfe6",
    borderSoft: dark ? "#18242c" : "#d4dfe6",
    text: dark ? "#f0f3f5" : "#172631",
    muted: dark ? "#8794a3" : "#526574",
    faint: dark ? "#637483" : "#6a7b88",
    blue: dark ? "#19d994" : "#08754e",
    green: dark ? "#19d994" : "#08754e",
    red: dark ? "#ff505b" : "#bf263d",
  };
}

export const workstationPages = {
  scanner: ["Market Scanner", "Screen and rank your market universe"],
  charts: ["Charts", "Analyze price, volume and indicators"],
  "chart-analysis": ["Charts", "Analyze price, volume and indicators"],
  watchlist: ["Watchlist", "Organize and follow your symbols"],
  news: ["News & Calendar", "Headlines and market context"],
  alerts: ["Alerts", "Manage your saved price conditions"],
  orders: ["Orders", "Review orders and activity"],
  positions: ["Positions", "Holdings, exposure and profit / loss"],
  risk: ["Risk Manager", "Review exposure and account limits"],
  performance: ["Performance", "Results from your recorded trades"],
  replay: ["Replay", "Practice and review historical sessions"],
  journal: ["Trade Journal", "Record and review your trading decisions"],
  settings: ["Settings", "Manage your workspace preferences"],
};
