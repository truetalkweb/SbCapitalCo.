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
}) {
  const visibleItems = NAV_ITEMS.filter((item) => advancedMode || !item.advanced);

  return (
    <aside
      style={{
        width: "100%",
        minWidth: 0,
        maxWidth: "none",
        height: "100%",
        background: "linear-gradient(180deg, #07090d 0%, #05070b 58%, #030407 100%)",
        borderRight: "1px solid rgba(55,65,81,0.42)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: "inset -1px 0 0 rgba(255,255,255,0.025)",
      }}
    >
      <div
        style={{
          height: "74px",
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "0 14px",
          borderBottom: "1px solid rgba(55,65,81,0.42)",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <img
          src="/sbcapitalco-logo.png"
          alt="SbCapitalCo"
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "50%",
            objectFit: "cover",
            background: "#000",
            border: "1px solid rgba(231,236,243,0.52)",
            boxShadow: "0 0 0 3px rgba(25,198,216,0.04)",
          }}
        />

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: "#f8fafc",
              fontSize: "13px",
              fontWeight: 950,
              lineHeight: 1.1,
              whiteSpace: "nowrap",
            }}
          >
            SB Terminal
          </div>
          <div
            style={{
              color: brokerConnected ? "#00c896" : "#ef5350",
              fontSize: "9px",
              fontWeight: 900,
              marginTop: "4px",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            {brokerConnected ? "Broker connected" : "Broker locked"}
          </div>
        </div>

        <span
          style={{
            position: "absolute",
            right: "14px",
            top: "20px",
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
          padding: "14px 10px 10px",
          gap: "4px",
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {visibleItems.map((item, index) => {
          const Icon = item.icon;
          const active = activeWorkspace === item.id;
          const showGroup = index === 0 || visibleItems[index - 1]?.group !== item.group;

          return (
            <div key={item.id} style={{ display: "contents" }}>
              {showGroup && (
                <div
                  style={{
                    color: "#697386",
                    fontSize: "10px",
                    fontWeight: 900,
                    padding: item.group === "Main" ? "0 8px 8px" : "13px 8px 7px",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {item.group}
                </div>
              )}
            <button
              title={item.label}
              onClick={() => setActiveWorkspace(item.id)}
              style={{
                width: "100%",
                height: "42px",
                border: `1px solid ${active ? "rgba(45,140,255,0.55)" : "transparent"}`,
                background: active
                  ? "linear-gradient(90deg, rgba(45,140,255,0.20), rgba(25,198,216,0.055))"
                  : "transparent",
                color: active ? "#f8fafc" : "#a0a8b8",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: "10px",
                padding: "0 10px",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "all 0.16s ease",
                flexShrink: 0,
                fontSize: "13px",
                fontWeight: active ? 950 : 800,
                boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.08)" : "none",
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
              <span
                style={{
                  width: "24px",
                  height: "24px",
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "7px",
                  color: active ? "#19c6d8" : "#8a95a8",
                  background: active ? "rgba(25,198,216,0.10)" : "rgba(148,163,184,0.055)",
                  flexShrink: 0,
                }}
              >
                <Icon size={16} strokeWidth={active ? 2.45 : 2} />
              </span>
              <span>{item.label}</span>
            </button>
            </div>
          );
        })}
      </nav>

      <div
        style={{
          padding: "10px 14px 14px",
          borderTop: "1px solid rgba(55,65,81,0.35)",
          color: "#697386",
          fontSize: "10px",
          fontWeight: 800,
          lineHeight: 1.45,
        }}
      >
        AI market desk
      </div>
    </aside>
  );
}
