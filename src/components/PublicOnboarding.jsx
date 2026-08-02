import { useEffect, useRef, useState } from "react";
import { terminalMonoFont, terminalSansFont } from "../config/terminalConfig";
import {
  PUBLIC_INFORMATION_EFFECTIVE_DATE,
  PUBLIC_INFORMATION_SECTIONS,
} from "../config/publicInformation";

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

function InformationPanel({ children, id, theme, title }) {
  return (
    <section role="tabpanel" id={`public-panel-${id}`} aria-labelledby={`public-tab-${id}`} style={{ display: "grid", gap: 10, color: theme.muted, fontSize: 11.5, lineHeight: 1.55 }}>
      <h2 style={{ margin: 0, color: theme.text, fontSize: 14 }}>{title}</h2>
      {children}
    </section>
  );
}

export default function PublicOnboarding({
  theme,
  isOpen,
  onClose,
  onDontShowAgain,
  onReportIssue,
}) {
  const [activeView, setActiveView] = useState("quick");
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);

  function moveTab(direction) {
    const activeIndex = PUBLIC_INFORMATION_SECTIONS.findIndex((tab) => tab.id === activeView);
    const nextIndex = (activeIndex + direction + PUBLIC_INFORMATION_SECTIONS.length) % PUBLIC_INFORMATION_SECTIONS.length;
    setActiveView(PUBLIC_INFORMATION_SECTIONS[nextIndex].id);
  }

  useEffect(() => {
    if (!isOpen) return undefined;

    returnFocusRef.current = document.activeElement;
    window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector('[role="tab"][aria-selected="true"]')?.focus();
    });

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
        return;
      }
      if (event.key === "Tab" && dialogRef.current) {
        const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus?.();
    };
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
        ref={dialogRef}
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
              gridTemplateColumns: "repeat(auto-fit, minmax(82px, 1fr))",
              gap: "4px",
              padding: "3px",
              border: `1px solid ${theme.borderSoft || theme.border}`,
              borderRadius: "8px",
              background: stepBg,
            }}
          >
            {PUBLIC_INFORMATION_SECTIONS.map((tab) => {
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

          {activeView === "risk" && (
            <InformationPanel id="risk" theme={theme} title="Risk and market-data disclosure">
              <p>SbCapitalCo Terminal is an informational research and review workspace. It does not provide investment, legal, tax, or personalized financial advice, and it does not guarantee any outcome.</p>
              <p>Quotes, charts, scanner ranks, news, catalysts, AI summaries, and derived metrics may be delayed, cached, incomplete, inaccurate, or unavailable. Provider labels and freshness indicators are decision context, not a warranty of accuracy.</p>
              <p>Paper, replay, review-only orders, risk scores, and simulated results do not reproduce live fills, slippage, fees, liquidity, halts, or market impact. Verify material information with your broker and primary sources before acting.</p>
              <p>Trading can result in substantial or total loss. You remain responsible for position sizing, suitability, regulatory obligations, and every order submitted outside this terminal.</p>
            </InformationPanel>
          )}

          {activeView === "privacy" && (
            <InformationPanel id="privacy" theme={theme} title="Privacy notice">
              <p>Effective {PUBLIC_INFORMATION_EFFECTIVE_DATE}. The private beta uses Supabase for authentication and per-user workspace storage. Workspace data can include watchlists, layouts, alerts, paper/replay activity, journal entries, settings, and scanner presets.</p>
              <p>Authenticated issue reports include your user identifier, report text, workspace name, page path, browser type, viewport, and optional redacted diagnostics. Passwords, access tokens, broker credentials, account numbers, and order payloads are excluded from diagnostics.</p>
              <p>Service providers may process technical data needed to host the frontend, backend, authentication, market data, news, and AI features. Data is retained while the beta account or operational record is needed; account deletion removes the Supabase account and cascading workspace records, subject to limited security and operational logs.</p>
              <p>Do not place secrets, broker credentials, or sensitive personal information in notes or issue descriptions. Use Security settings to reset your password or permanently delete your account.</p>
            </InformationPanel>
          )}

          {activeView === "terms" && (
            <InformationPanel id="terms" theme={theme} title="Private beta terms of use">
              <p>Effective {PUBLIC_INFORMATION_EFFECTIVE_DATE}. Access is provided to evaluate an unfinished private-beta product. Features, providers, limits, and availability may change or be withdrawn without notice.</p>
              <p>You may use the terminal only lawfully and may not probe, bypass, scrape, resell, disrupt, or attempt unauthorized access to accounts, entitlements, providers, or infrastructure. Keep credentials private and report suspected compromise promptly.</p>
              <p>No paid checkout or public live-broker execution is enabled in this beta. Any visible order controls are paper, simulated, or review-only unless the product explicitly states otherwise.</p>
              <p>The service is provided as available without guarantees of uninterrupted operation, market-data accuracy, fitness for a trading purpose, or preservation of unsaved work. Stop using the beta if these terms or risks are unacceptable.</p>
            </InformationPanel>
          )}

          {activeView === "support" && (
            <InformationPanel id="support" theme={theme} title="Support and responsible reporting">
              <p>For layout, functionality, accessibility, performance, data, or account issues, use the in-app report form. Include what you expected, what happened, and the active workspace; never include passwords, API keys, tokens, or broker credentials.</p>
              <p>Provider-limited, cached, delayed, or fallback labels describe data quality and are not necessarily incidents. Report persistent mismatches with the ticker, approximate time, and visible source label.</p>
              <button
                className="public-focus-control"
                type="button"
                onClick={() => { onClose?.(); onReportIssue?.(); }}
                style={{ height: 34, border: 0, borderRadius: 7, background: `linear-gradient(180deg, ${theme.blue}, #1765c6)`, color: "#fff", cursor: "pointer", fontWeight: 900 }}
              >
                Report an issue
              </button>
            </InformationPanel>
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
