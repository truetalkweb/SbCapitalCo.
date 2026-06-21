import { useEffect, useState } from "react";
import { terminalMonoFont, terminalSansFont } from "../config/terminalConfig";

const steps = [
  {
    title: "Scanner",
    detail: "Finds active movers using price action, volume, relative volume, and gap context.",
  },
  {
    title: "Market News",
    detail: "Shows ticker-related headlines first, then broader market headlines when coverage is limited.",
  },
  {
    title: "Intelligence",
    detail: "Combines chart, scanner, and headline context so stronger setups stand out faster.",
  },
  {
    title: "Watchlist",
    detail: "Keeps the names you care about close to their chart, news, and context.",
  },
];

const dataSources = [
  ["Scanner", "Ranked movers from available market data, volume, relative volume, gaps, and intraday movement."],
  ["News", "Provider-backed headlines when available, with broader market headlines used when ticker coverage is thin."],
  ["AI / Intelligence", "A summary and context layer for faster review. It is not financial advice or a trade recommendation."],
  ["Provider limited", "API plan limits, rate limits, or cached fallback data may reduce freshness or coverage."],
];

const onboardingTabs = [
  { id: "quick", label: "Quick Start" },
  { id: "sources", label: "Data Sources" },
];

export default function PublicOnboarding({
  theme,
  isOpen,
  onClose,
  onDontShowAgain,
}) {
  const [activeView, setActiveView] = useState("quick");

  function moveTab(direction) {
    const activeIndex = onboardingTabs.findIndex((tab) => tab.id === activeView);
    const nextIndex = (activeIndex + direction + onboardingTabs.length) % onboardingTabs.length;
    setActiveView(onboardingTabs[nextIndex].id);
  }

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDark = theme.isDark !== false;
  const overlayBg = isDark ? "rgba(2,6,12,0.56)" : "rgba(15,23,42,0.18)";
  const panelBg = isDark ? "#080d14" : "#ffffff";
  const stepBg = isDark ? "rgba(255,255,255,0.025)" : "#f7f9fc";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="public-onboarding-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        padding: "18px",
        background: overlayBg,
        backdropFilter: "blur(8px)",
        fontFamily: terminalSansFont,
      }}
    >
      <div
        className="public-onboarding-panel"
        style={{
          width: "clamp(320px, 36vw, 620px)",
          maxWidth: "620px",
          maxHeight: "min(720px, calc(100vh - 36px))",
          overflow: "auto",
          boxSizing: "border-box",
          background: panelBg,
          color: theme.text,
          border: `1px solid ${theme.borderSoft || theme.border}`,
          borderRadius: "12px",
          boxShadow: isDark
            ? "0 24px 70px rgba(0,0,0,0.55)"
            : "0 24px 70px rgba(15,23,42,0.18)",
        }}
      >
        <div
          style={{
            padding: "18px 18px 14px",
            borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
            display: "grid",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "start",
            }}
          >
            <div>
              <div
                id="public-onboarding-title"
                style={{
                  fontSize: "17px",
                  fontWeight: 900,
                  lineHeight: 1.2,
                }}
              >
                SbCapitalCo Terminal
              </div>
              <div
                style={{
                  marginTop: "4px",
                  color: theme.muted,
                  fontSize: "11.5px",
                  lineHeight: 1.45,
                  maxWidth: "500px",
                }}
              >
                A focused market-intelligence workspace for finding active stocks and understanding the catalyst context behind them.
              </div>
            </div>
            <button
              className="public-focus-control"
              type="button"
              onClick={onClose}
              aria-label="Close onboarding"
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "7px",
                border: `1px solid ${theme.borderSoft || theme.border}`,
                background: stepBg,
                color: theme.text,
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: 900,
              }}
            >
              x
            </button>
          </div>
        </div>

        <div style={{ padding: "16px 18px 18px", display: "grid", gap: "14px" }}>
          <div
            role="tablist"
            aria-label="Onboarding sections"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "4px",
              padding: "3px",
              border: `1px solid ${theme.borderSoft || theme.border}`,
              borderRadius: "8px",
              background: stepBg,
            }}
          >
            {onboardingTabs.map((tab) => {
              const selected = activeView === tab.id;
              return (
              <button
                className="public-focus-control"
                key={tab.id}
                type="button"
                role="tab"
                id={`public-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`public-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveView(tab.id)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight") {
                    event.preventDefault();
                    moveTab(1);
                  }

                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    moveTab(-1);
                  }
                }}
                style={{
                  height: "30px",
                  width: "100%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1px solid ${selected ? `${theme.blue}88` : "transparent"}`,
                  borderRadius: "6px",
                  background: selected
                    ? isDark
                      ? "rgba(45,140,255,0.18)"
                      : "rgba(45,140,255,0.12)"
                    : "transparent",
                  color: selected ? theme.text : theme.muted,
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 900,
                  boxShadow: selected ? `inset 0 -2px 0 ${theme.blue}` : "none",
                  transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
                }}
              >
                {tab.label}
              </button>
              );
            })}
          </div>

          {activeView === "quick" && (
          <div
            role="tabpanel"
            id="public-panel-quick"
            aria-labelledby="public-tab-quick"
            style={{ display: "grid", gap: "14px" }}
          >
          <div className="public-onboarding-steps" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "9px" }}>
            {steps.map((step, index) => (
              <div
                key={step.title}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr",
                  gap: "10px",
                  padding: "12px",
                  borderRadius: "9px",
                  border: `1px solid ${theme.borderSoft || theme.border}`,
                  background: isDark ? "rgba(255,255,255,0.018)" : "#f8fafc",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "999px",
                    background: `${theme.blue}18`,
                    color: theme.blue,
                  fontFamily: terminalMonoFont,
                  fontSize: "11px",
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                  {index + 1}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: theme.text, fontSize: "12px", fontWeight: 900 }}>
                    {step.title}
                  </div>
                  <div style={{ marginTop: "3px", color: theme.muted, fontSize: "11px", lineHeight: 1.45 }}>
                    {step.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              color: theme.faint || theme.muted,
              fontSize: "10.5px",
              lineHeight: 1.45,
              borderTop: `1px solid ${theme.borderSoft || theme.border}`,
              paddingTop: "10px",
            }}
          >
            Informational market context only. Verify data freshness, liquidity, and your own risk plan before acting.
          </div>
          </div>
          )}

          {activeView === "sources" && (
          <div
            role="tabpanel"
            id="public-panel-sources"
            aria-labelledby="public-tab-sources"
            style={{ display: "grid", gap: "14px" }}
          >
          <div
            style={{
              border: `1px solid ${theme.borderSoft || theme.border}`,
              borderRadius: "9px",
              overflow: "hidden",
            }}
          >
            {dataSources.map(([label, detail], index) => (
              <div
                key={label}
                className="public-onboarding-status-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "10px",
                  padding: "10px 11px",
                  borderBottom: index === dataSources.length - 1 ? "none" : `1px solid ${theme.borderSoft || theme.border}`,
                  background: index % 2 === 0 ? "transparent" : stepBg,
                }}
              >
                <div style={{ color: theme.cyan || theme.blue, fontFamily: terminalMonoFont, fontSize: "10px", fontWeight: 850 }}>
                  {label}
                </div>
                <div style={{ color: theme.muted, fontSize: "11px", lineHeight: 1.45 }}>
                  {detail}
                </div>
              </div>
            ))}
          </div>

          <div style={{ color: theme.faint || theme.muted, fontSize: "10.5px", lineHeight: 1.45 }}>
            Data can be delayed, cached, incomplete, or limited by provider plans. Scanner and news context are informational only.
          </div>
          </div>
          )}

          <div className="public-onboarding-actions" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" }}>
            <button
              className="public-focus-control"
              type="button"
              onClick={onClose}
              style={{
                height: "34px",
                border: "none",
                borderRadius: "7px",
                background: `linear-gradient(180deg, ${theme.blue}, #1765c6)`,
                color: "#ffffff",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 900,
              }}
            >
              Start using terminal
            </button>
            <button
              className="public-focus-control"
              type="button"
              onClick={onDontShowAgain}
              style={{
                height: "34px",
                borderRadius: "7px",
                border: `1px solid ${theme.borderSoft || theme.border}`,
                background: stepBg,
                color: theme.text,
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 850,
              }}
            >
              Do not show again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
