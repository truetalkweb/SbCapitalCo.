export const premiumWorkspaceViews = [
  { id: "dashboard", label: "Dashboard", group: "Main" },
  { id: "scanner", label: "Scanner", group: "Main" },
  { id: "chart-analysis", label: "Charts", group: "Main" },
  { id: "watchlist", label: "Watchlist", group: "Main" },
  { id: "news", label: "News", group: "Main" },
  { id: "alerts", label: "Alerts", group: "Main" },
  { id: "orders", label: "Orders", group: "Advanced" },
  { id: "positions", label: "Positions", group: "Advanced" },
  { id: "risk", label: "Risk", group: "Advanced" },
  { id: "performance", label: "Performance", group: "Advanced" },
  { id: "replay", label: "Replay", group: "Advanced" },
  { id: "journal", label: "Journal", group: "Advanced" },
  { id: "settings", label: "Settings", group: "Advanced" },
];

// Keep every saved destination addressable while grouping the daily workflow.
export const premiumNavigationGroups = [
  { id: "dashboard", label: "Dashboard", children: ["dashboard"] },
  { id: "scanner", label: "Markets", children: ["scanner", "watchlist", "news"] },
  { id: "chart-analysis", label: "Charts", children: ["chart-analysis"] },
  { id: "positions", label: "Portfolio", children: ["positions", "orders", "risk"] },
  { id: "journal", label: "Review", children: ["journal", "performance", "replay"] },
  { id: "alerts", label: "Alerts", children: ["alerts"] },
  { id: "settings", label: "Settings", children: ["settings"] },
];
