import {
  Brain,
  BarChart3,
  Search,
  Play,
  BookOpen,
  Settings,
  DollarSign,
  Bell,
  Star,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "charts", label: "Charts", group: "Main", icon: BarChart3 },
  { id: "scanner", label: "Scanner", group: "Main", icon: Search },
  { id: "watchlist", label: "Watchlist", group: "Main", icon: Star },
  { id: "intelligence", label: "Intel", group: "Main", icon: Brain },
  { id: "alerts", label: "Alerts", group: "Main", icon: Bell },
  { id: "broker", label: "Broker", group: "Advanced", icon: DollarSign, advanced: true },
  { id: "replay", label: "Replay", group: "Advanced", icon: Play, advanced: true },
  { id: "journal", label: "Journal", group: "Advanced", icon: BookOpen, advanced: true },
  { id: "settings", label: "Settings", group: "Advanced", icon: Settings, advanced: true },
];

export default function Tradingsidebar({
  activeWorkspace,
  setActiveWorkspace,
  brokerConnected,
  advancedMode = false,
  theme,
  isDark = true,
}) {
  const visibleItems = NAV_ITEMS.filter((item) => advancedMode || !item.advanced);
  const sidebarBackground = isDark
    ? "linear-gradient(180deg, #07090d 0%, #05070b 58%, #030407 100%)"
    : "linear-gradient(180deg, #ffffff 0%, #f3f7fb 100%)";
  const sidebarBorder = isDark ? "rgba(55,65,81,0.42)" : theme?.borderSoft || "#d7dde8";
  const inactiveIconColor = isDark ? "#8a95a8" : "#667085";
  const inactiveIconBackground = isDark ? "rgba(148,163,184,0.055)" : "rgba(15,23,42,0.045)";
  const activeIconColor = isDark ? "#19c6d8" : theme?.blue || "#2d8cff";
  const activeButtonColor = isDark ? "#f8fafc" : theme?.text || "#1d2733";

  return (
    <aside
      style={{
        width: "100%",
        minWidth: "50px",
        maxWidth: "none",
        height: "100%",
        background: sidebarBackground,
        borderRight: `1px solid ${sidebarBorder}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: isDark ? "inset -1px 0 0 rgba(255,255,255,0.025)" : "inset -1px 0 0 rgba(15,23,42,0.035)",
      }}
    >
      <div
        style={{
          height: "68px",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0",
          borderBottom: `1px solid ${sidebarBorder}`,
          position: "relative",
          flexShrink: 0,
        }}
      >
        <img
          src="/sbcapitalco-logo.png"
          alt="SbCapitalCo"
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            objectFit: "cover",
            background: "#000",
            border: isDark ? "1px solid rgba(231,236,243,0.52)" : "1px solid rgba(15,23,42,0.16)",
            boxShadow: isDark ? "0 0 0 3px rgba(25,198,216,0.04)" : "0 6px 18px rgba(15,23,42,0.10)",
          }}
        />

        <span
          style={{
            position: "absolute",
            right: "11px",
            bottom: "17px",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: brokerConnected ? "#00c896" : "#ef5350",
            border: `1px solid ${isDark ? "#050b14" : "#ffffff"}`,
            boxShadow: `0 0 10px ${brokerConnected ? "#00c896" : "#ef5350"}`,
          }}
        />
      </div>

      <nav
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "10px 6px",
          gap: "6px",
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = activeWorkspace === item.id;

          return (
            <div key={item.id} style={{ display: "contents" }}>
            <button
              title={item.label}
              aria-label={item.label}
              onClick={() => setActiveWorkspace(item.id)}
              style={{
                width: "38px",
                height: "38px",
                border: `1px solid ${active ? "rgba(25,198,216,0.55)" : "transparent"}`,
                background: active
                  ? "linear-gradient(180deg, rgba(45,140,255,0.20), rgba(25,198,216,0.08))"
                  : "transparent",
                color: active ? activeButtonColor : inactiveIconColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "all 0.16s ease",
                flexShrink: 0,
                boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.08)" : "none",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = isDark ? "rgba(148,163,184,0.08)" : "rgba(45,140,255,0.07)";
                  e.currentTarget.style.color = activeButtonColor;
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = inactiveIconColor;
                }
              }}
            >
              <span
                style={{
                  width: "22px",
                  height: "22px",
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "7px",
                  color: active ? activeIconColor : inactiveIconColor,
                  background: active ? "rgba(25,198,216,0.10)" : inactiveIconBackground,
                  flexShrink: 0,
                }}
              >
                <Icon size={15} strokeWidth={active ? 2.45 : 2} />
              </span>
            </button>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
