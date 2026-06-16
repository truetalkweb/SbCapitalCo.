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
  { id: "intelligence", label: "Intel", icon: Brain },
  { id: "charts", label: "Charts", icon: BarChart3 },
  { id: "scanner", label: "Scanner", icon: Search },
  { id: "watchlist", label: "Watchlist", icon: Star },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "broker", label: "Broker", icon: DollarSign, advanced: true },
  { id: "replay", label: "Replay", icon: Play, advanced: true },
  { id: "journal", label: "Journal", icon: BookOpen, advanced: true },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Tradingsidebar({
  activeWorkspace,
  setActiveWorkspace,
  brokerConnected,
  advancedMode = false,
}) {
  const visibleItems = NAV_ITEMS.filter((item) => advancedMode || !item.advanced);

  return (
    <aside
      style={{
        width: "60px",
        minWidth: "60px",
        maxWidth: "60px",
        height: "100%",
        background: "linear-gradient(180deg, #060a12, #03050a)",
        borderRight: "1px solid #202a3a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          height: "62px",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderBottom: "1px solid #202a3a",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <img
          src="/sbcapitalco-logo.png"
          alt="SbCapitalCo"
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "50%",
            objectFit: "cover",
            background: "#000",
            border: "1px solid rgba(231,236,243,0.72)",
            boxShadow: "0 0 0 3px rgba(255,255,255,0.025)",
          }}
        />

        <span
          style={{
            position: "absolute",
            right: "10px",
            bottom: "10px",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: brokerConnected ? "#00c896" : "#ef5350",
            border: "1px solid #050b14",
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
          paddingTop: "8px",
          gap: "3px",
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = activeWorkspace === item.id;

          return (
            <button
              key={item.id}
              title={item.label}
              onClick={() => setActiveWorkspace(item.id)}
              style={{
                width: "100%",
                height: "46px",
                border: "none",
                borderLeft: active
                  ? "3px solid #19c6d8"
                  : "3px solid transparent",
                background: active
                  ? "linear-gradient(90deg, rgba(25,198,216,0.18), transparent)"
                  : "transparent",
                color: active ? "#19c6d8" : "#8a95a8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.16s ease",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "rgba(148,163,184,0.08)";
                  e.currentTarget.style.color = "#e7ecf3";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#8a95a8";
                }
              }}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
