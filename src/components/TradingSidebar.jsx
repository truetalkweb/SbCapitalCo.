import {
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
  { id: "charts", label: "Charts", icon: BarChart3 },
  { id: "scanner", label: "Scanner", icon: Search },
  { id: "watchlist", label: "Watchlist", icon: Star },
  { id: "broker", label: "Broker", icon: DollarSign },
  { id: "replay", label: "Replay", icon: Play },
  { id: "journal", label: "Journal", icon: BookOpen },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function TradingSidebar({
  activeWorkspace,
  setActiveWorkspace,
  brokerConnected,
}) {
  return (
    <aside
      style={{
        width: "64px",
        minWidth: "64px",
        maxWidth: "64px",
        height: "100%",
        background: "#050b14",
        borderRight: "1px solid #1e293b",
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
          borderBottom: "1px solid #1e293b",
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
            border: "1.5px solid rgba(255,255,255,0.85)",
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
          gap: "4px",
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeWorkspace === item.id;

          return (
            <button
              key={item.id}
              title={item.label}
              onClick={() => setActiveWorkspace(item.id)}
              style={{
                width: "100%",
                height: "48px",
                border: "none",
                borderLeft: active
                  ? "3px solid #2196f3"
                  : "3px solid transparent",
                background: active
                  ? "linear-gradient(90deg, rgba(33,150,243,0.20), transparent)"
                  : "transparent",
                color: active ? "#2196f3" : "#94a3b8",
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
                  e.currentTarget.style.color = "#e5e7eb";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#94a3b8";
                }
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} />
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
