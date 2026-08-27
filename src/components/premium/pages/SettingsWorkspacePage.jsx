import { useRef, useState } from "react";
import AdminMonitoringPanel from "../../AdminMonitoringPanel";
import { terminalSansFont } from "../../../config/terminalConfig";
import { PLAN_LABELS, normalizePlan } from "../../../services/entitlements";
import { saveSetting } from "../../../utils/storage";
import { ActionButton, PremiumCard, PremiumTabs, SectionTitle, StatusPill } from "../PremiumWorkspacePrimitives";

export default function SettingsWorkspacePage({
  accountDeleteConfirmation,
      accountDeleteStatus,
      brokerApiUrl,
      brokerConnected,
      chartIndicators,
      compactMode,
      defaultLandingTab,
      deleteAccount,
      entitlements,
      exportWorkspaceBackup,
      gridMode,
      isNarrowWorkspace,
      layoutMode,
      loadWorkspaceFromCloud,
      importWorkspaceBackup,
      cloudStatus,
      cloudSyncPresentation,
      notificationPreferences,
      onOpenHelp,
      onOpenIssueReport,
      page,
      passwordResetStatus,
      relativeVolumeThreshold,
      resetWorkspace,
      riskWarnings,
      saveWorkspaceToCloud,
      scannerAutoRefresh,
      sendPasswordReset,
      setAccountDeleteConfirmation,
      setChartIndicators,
      setGridMode,
      setLayoutMode,
      setOrderMessage,
      setSettingsTab,
      setThemeMode,
      setTimeZone,
      setTimeframe,
      settingsTab,
      theme,
      themeMode,
      timeZone,
      timeframe,
      updateNotificationPreference,
      updatePremiumPreference,
      user
}) {
    const backupInputRef = useRef(null);
    const [backupStatus, setBackupStatus] = useState("");
    const [stagedBackup, setStagedBackup] = useState(null);

    const clearStagedBackup = () => {
      setStagedBackup(null);
      if (backupInputRef.current) backupInputRef.current.value = "";
    };

    const handleBackupExport = () => {
      try {
        exportWorkspaceBackup?.();
        setBackupStatus("Workspace backup downloaded.");
      } catch (error) {
        setBackupStatus(error?.message || "Workspace backup could not be exported.");
      }
    };

    const handleBackupRestore = async () => {
      if (!stagedBackup) return;
      setBackupStatus("Restoring workspace backup...");
      try {
        const result = await importWorkspaceBackup?.(stagedBackup);
        setBackupStatus(`${result?.fieldCount || "Validated"} workspace fields restored. Cloud sync will follow automatically.`);
        clearStagedBackup();
      } catch (error) {
        setBackupStatus(error?.message || "Workspace backup could not be restored.");
      }
    };
    const selectStyle = {
      width: 170,
      height: 30,
      background: theme.panel2,
      border: `1px solid ${theme.borderSoft || theme.border}`,
      borderRadius: 5,
      color: theme.text,
      padding: "0 8px",
      fontFamily: terminalSansFont,
    };
    const landingOptions = [
      ["dashboard", "Dashboard"],
      ["scanner", "Scanner"],
      ["chart-analysis", "Charts"],
      ["watchlist", "Watchlist"],
      ["news", "News"],
      ["alerts", "Alerts"],
      ["orders", "Orders"],
      ["positions", "Positions"],
      ["risk", "Risk"],
      ["performance", "Performance"],
      ["journal", "Journal"],
      ["replay", "Replay"],
      ["settings", "Settings"],
    ];
    const settingSelect = (label, value, options, onChange, disabled = false) => (
      <select
        aria-label={label}
        title={disabled ? `${label} is not available in the current public terminal` : undefined}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        style={{ ...selectStyle, opacity: disabled ? 0.55 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
      >
        {options.map((option) => {
          const [optionValue, optionLabel] = Array.isArray(option) ? option : [option, option];
          return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
        })}
      </select>
    );
    const settingToggle = (on = true, onChange, disabled = false, label = "Toggle setting") => (
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-pressed={Boolean(on)}
        onClick={() => !disabled && onChange?.(!on)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 99,
          border: `1px solid ${on ? theme.blue : theme.borderSoft || theme.border}`,
          background: on ? theme.blue : theme.border,
          display: "inline-flex",
          justifyContent: on ? "flex-end" : "flex-start",
          alignItems: "center",
          padding: 2,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff" }} />
      </button>
    );
    const disabledSetting = (text = "Coming later") => <span style={{ color: theme.muted, fontSize: 11 }}>{text}</span>;
    const accountPlan = normalizePlan(entitlements?.plan);
    const entitlementSource = entitlements?.source || "default";
    const planPill = (plan, active = false) => (
      <div
        key={plan}
        style={{
          border: `1px solid ${active ? theme.blue : theme.borderSoft || theme.border}`,
          background: active ? `${theme.blue}22` : theme.panel2,
          color: active ? theme.text : theme.muted,
          borderRadius: 7,
          padding: "10px 12px",
          minHeight: 62,
        }}
      >
        <div style={{ fontWeight: 900, color: active ? theme.blue : theme.text }}>{PLAN_LABELS[plan]}</div>
        <div style={{ fontSize: 11, marginTop: 5, lineHeight: 1.35 }}>
          {plan === "free" && "Core market terminal access."}
          {plan === "pro" && "AI summaries, replay, and journal."}
          {plan === "premium" && "Risk and performance analytics."}
          {plan === "admin" && "Owner-only administration and private diagnostics."}
        </div>
      </div>
    );
    const comingLaterButton = (label, title) => (
      <ActionButton key={label} theme={theme} disabled title={title || `${label} requires backend/account support`}>
        {label}
      </ActionButton>
    );
    const group = (title, rows, tab = "General") => settingsTab === tab ? (
      <PremiumCard theme={theme} title={title}>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          {rows.map(([label, control]) => (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", alignItems: "center", color: theme.muted, fontSize: 12, gap: 12 }}>
              <span>{label}</span>
              <span>{control}</span>
            </div>
          ))}
        </div>
      </PremiumCard>
    ) : null;
    const showPrimaryColumn = ["General", "Trading", "Layout"].includes(settingsTab);
    const showSecondaryColumn = ["General", "Notifications", "Data & Connections", "Security"].includes(settingsTab);
    const useSplitColumns = settingsTab === "General" && !isNarrowWorkspace;
    return (
      <div style={page}>
        <SectionTitle theme={theme} title="Settings" />
        <PremiumTabs theme={theme} tabs={["General", "Trading", "Layout", "Notifications", "Data & Connections", "Security"]} active={settingsTab} onChange={setSettingsTab} />
        <div style={{ display: "grid", gridTemplateColumns: useSplitColumns ? "minmax(0, 1.05fr) minmax(360px, 0.9fr)" : "minmax(0, 1fr)", gap: 10, marginTop: 12 }}>
          {showPrimaryColumn && <div style={{ display: "grid", gap: 10 }}>
            {settingsTab === "General" && <PremiumCard theme={theme} title="Account & Plan">
              <div style={{ padding: 16, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ color: theme.text, fontSize: 15, fontWeight: 900 }}>{user?.email || "Authenticated workspace"}</div>
                    <div style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>Plan source: {entitlementSource === "user_entitlements" ? "Supabase entitlement table" : entitlementSource === "app_metadata" ? "Supabase app metadata" : "Default free access"}</div>
                  </div>
                  <StatusPill theme={theme} tone={accountPlan === "free" ? "neutral" : "good"}>{PLAN_LABELS[accountPlan] || "Free"}</StatusPill>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "1fr" : "repeat(4, 1fr)", gap: 8 }}>
                  {["free", "pro", "premium", "admin"].map((plan) => planPill(plan, plan === accountPlan))}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionButton theme={theme} disabled title="Stripe checkout will be connected in the payments phase">Upgrade to Pro</ActionButton>
                  <ActionButton theme={theme} disabled title="Stripe checkout will be connected in the payments phase">Upgrade to Premium</ActionButton>
                </div>
                <div style={{ color: theme.muted, fontSize: 12, lineHeight: 1.5 }}>
                  Market data can be delayed, cached, or provider-limited. SbCapitalCo is an information and review workspace, not financial advice. Confirm liquidity, risk, and broker state before acting.
                </div>
              </div>
            </PremiumCard>}
            {group("Workspace Preferences", [
              ["Theme", settingSelect("Theme", themeMode || "dark", [["dark", "Dark"], ["light", "Light"]], (value) => setThemeMode?.(value))],
              ["Compact mode", settingToggle(compactMode, (value) => updatePremiumPreference("compactMode", value), false, "Toggle compact mode")],
              ["Default landing tab", settingSelect("Default landing tab", defaultLandingTab, landingOptions, (value) => { updatePremiumPreference("defaultLandingTab", value); saveSetting("sb_default_landing_tab", value); setOrderMessage?.(`Default landing tab saved: ${landingOptions.find(([id]) => id === value)?.[1] || value}.`); })],
              ["Time zone", settingSelect("Time zone", timeZone, [["America/Vancouver", "Pacific (PT)"], ["America/New_York", "Eastern (ET)"], ["Europe/London", "London"], ["UTC", "UTC"]], (value) => setTimeZone?.(value))],
              ["Currency display", settingSelect("Currency display", "USD", ["USD"], null, true)],
            ])}
            {group("Trading Preferences", [
              ["Default order type", disabledSetting("Review-only until broker execution is enabled")],
              ["Confirm before order", settingToggle(true, null, true, "Confirm before order")],
              ["Default TIF", disabledSetting("Review-only")],
              ["Hotkeys enabled", disabledSetting()],
              ["Risk warnings enabled", settingToggle(riskWarnings, (value) => updatePremiumPreference("riskWarnings", value), false, "Toggle risk warnings")],
            ], "Trading")}
            {group("Chart & Scanner Defaults", [
              ["Default chart timeframe", settingSelect("Default chart timeframe", timeframe || "15m", ["1m", "5m", "15m", "1H", "1D"], (value) => setTimeframe?.(value))],
              ["Show volume", settingToggle(Boolean(chartIndicators?.volume), (value) => setChartIndicators?.((current) => ({ ...current, volume: value })), false, "Toggle chart volume")],
              ["Scanner auto refresh", settingToggle(scannerAutoRefresh, (value) => { updatePremiumPreference("scannerAutoRefresh", value); setOrderMessage?.(`Scanner auto refresh ${value ? "enabled" : "paused"} locally.`); }, false, "Toggle scanner auto refresh")],
              ["Default universe", disabledSetting("US stocks only in this MVP")],
              ["Relative volume threshold", settingSelect("Relative volume threshold", relativeVolumeThreshold, ["1.25", "1.50", "2.00", "3.00"], (value) => updatePremiumPreference("relativeVolumeThreshold", value))],
            ], "Trading")}
            {settingsTab === "Layout" && <PremiumCard theme={theme} title="Layout Presets"><div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>{[
              ["Trader", "1", "2"],
              ["Research", "2", "2"],
              ["Minimal", "1", "2"],
              ["Risk", "2", "4"],
            ].map(([label, nextLayout, nextGrid]) => <button key={label} type="button" onClick={() => { setLayoutMode?.(nextLayout); setGridMode?.(nextGrid); setOrderMessage?.(`${label} layout applied.`); }} style={{ minHeight: 72, border: `1px solid ${layoutMode === nextLayout && gridMode === nextGrid ? theme.blue : theme.borderSoft || theme.border}`, borderRadius: 7, background: theme.panel2, color: theme.text, textAlign: "left", padding: 12, cursor: "pointer" }}>{label}<div style={{ color: theme.muted, fontSize: 11, marginTop: 5 }}>{nextLayout === "1" ? "Single chart workspace" : `${nextGrid}-chart workspace`}</div></button>)}</div></PremiumCard>}
          </div>}
          {showSecondaryColumn && <div style={{ display: "grid", gap: 10 }}>
            {group("Broker & Data Connections", [["Broker status", <StatusPill key="b" theme={theme} tone={brokerConnected ? "good" : "warn"}>{brokerConnected ? "Connected" : "Review-only"}</StatusPill>], ["Market data status", <StatusPill key="d" theme={theme} tone="neutral">Current workspace feed</StatusPill>], ["Connection management", disabledSetting("Managed by the private backend; credentials are never exposed here")], ["Refresh guidance", <span key="a">Use the terminal Retry control to refresh provider health.</span>]], "Data & Connections")}
            {group("Notification Settings", [["Price alert activity", settingToggle(notificationPreferences.priceAlerts, (value) => updateNotificationPreference("priceAlerts", value), false, "Toggle price alert activity")], ["News catalyst highlights", settingToggle(notificationPreferences.newsCatalysts, (value) => updateNotificationPreference("newsCatalysts", value), false, "Toggle news catalyst highlights")], ["Sound alerts", settingToggle(notificationPreferences.soundAlerts, (value) => updateNotificationPreference("soundAlerts", value), false, "Toggle sound alerts")], ["Delivery scope", disabledSetting("In-app while the terminal is open; no email or push delivery")]], "Notifications")}
            {group("Security", [
              ["Authentication", <StatusPill key="auth" theme={theme} tone="good">Supabase session</StatusPill>],
              ["Two-factor authentication", disabledSetting("Configure in Supabase Auth when required")],
              ["Device management", comingLaterButton("Unavailable", "Device management is not available in this MVP")],
              ["Password", <div key="password" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><ActionButton theme={theme} onClick={sendPasswordReset} disabled={passwordResetStatus === "sending"}>{passwordResetStatus === "sending" ? "Sending..." : "Send reset email"}</ActionButton>{passwordResetStatus === "sent" && <span role="status" style={{ color: theme.green, fontSize: 11 }}>Reset email sent</span>}{passwordResetStatus === "failed" && <span role="status" style={{ color: theme.amber, fontSize: 11 }}>Reset email could not be sent</span>}</div>],
              ["Delete account", (
                <div key="delete-account" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ color: theme.muted, fontSize: 10 }}>Type DELETE to permanently remove your account and cloud workspace.</span>
                    <input
                      aria-label="Account deletion confirmation"
                      autoComplete="off"
                      value={accountDeleteConfirmation}
                      onChange={(event) => setAccountDeleteConfirmation(event.target.value)}
                      placeholder="DELETE"
                      style={{ width: 180, height: 32, boxSizing: "border-box", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 5, background: theme.panel2, color: theme.text, padding: "0 9px" }}
                    />
                  </label>
                  <ActionButton
                    theme={theme}
                    danger
                    disabled={accountDeleteConfirmation !== "DELETE" || accountDeleteStatus === "deleting"}
                    onClick={() => deleteAccount?.(accountDeleteConfirmation)}
                  >
                    {accountDeleteStatus === "deleting" ? "Deleting..." : "Delete Account"}
                  </ActionButton>
                  {accountDeleteStatus === "failed" && <span role="status" style={{ color: theme.red, fontSize: 11 }}>Deletion failed. Retry or contact support.</span>}
                </div>
              )],
            ], "Security")}
            {group("Backup & Sync", [
              ["Cloud sync", <StatusPill key="c" theme={theme} tone={cloudSyncPresentation?.tone || (user ? "good" : "warn")}>{cloudSyncPresentation?.label || (user ? "Synced" : "Local only")}</StatusPill>],
              ["Status", cloudStatus || (user ? "Cloud workspace ready" : "Local browser storage only")],
              ["Cloud actions", <span key="sync"><ActionButton theme={theme} onClick={saveWorkspaceToCloud}>Save</ActionButton> <ActionButton theme={theme} onClick={loadWorkspaceFromCloud}>Load</ActionButton> <ActionButton theme={theme} onClick={resetWorkspace}>Reset</ActionButton></span>],
              ["Portable backup", (
                <div key="portable-backup" style={{ display: "grid", justifyItems: "end", gap: 7 }}>
                  <input
                    ref={backupInputRef}
                    type="file"
                    accept="application/json,.json"
                    aria-label="Select workspace backup"
                    onChange={(event) => {
                      setStagedBackup(event.target.files?.[0] || null);
                      setBackupStatus(event.target.files?.[0] ? "Backup selected. Confirm restore to replace the current workspace." : "");
                    }}
                    style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", clipPath: "inset(50%)", whiteSpace: "nowrap" }}
                  />
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <ActionButton theme={theme} onClick={handleBackupExport}>Export Backup</ActionButton>
                    <ActionButton theme={theme} onClick={() => backupInputRef.current?.click()}>Import Backup</ActionButton>
                    {stagedBackup && <ActionButton theme={theme} active onClick={handleBackupRestore}>Restore Selected</ActionButton>}
                    {stagedBackup && <ActionButton theme={theme} onClick={() => { clearStagedBackup(); setBackupStatus("Restore cancelled."); }}>Cancel</ActionButton>}
                  </div>
                  {stagedBackup && <span style={{ color: theme.text, fontSize: 11 }}>{stagedBackup.name}</span>}
                  {backupStatus && <span role="status" style={{ color: backupStatus.includes("could not") || backupStatus.includes("invalid") || backupStatus.includes("not an") ? theme.amber : theme.muted, fontSize: 11, maxWidth: 460, lineHeight: 1.4 }}>{backupStatus}</span>}
                </div>
              )],
            ], "Data & Connections")}
            {settingsTab === "General" && <PremiumCard theme={theme} title="Current Preferences">
              <div style={{ padding: 14, display: "grid", gap: 10 }}>
                {[
                  `Theme: ${themeMode || "dark"}`,
                  `Time zone: ${timeZone}`,
                  `Default landing: ${landingOptions.find(([id]) => id === defaultLandingTab)?.[1] || defaultLandingTab}`,
                  `Chart timeframe: ${timeframe || "15m"}`,
                  `Scanner auto refresh: ${scannerAutoRefresh ? "On" : "Paused"}`,
                ].map((x) => (
                  <div key={x} style={{ color: theme.text }}>
                    <span style={{ color: theme.green }}>*</span> {x}
                  </div>
                ))}
              </div>
            </PremiumCard>}
            {settingsTab === "General" && <PremiumCard theme={theme} title="Support & Diagnostics">
              <div style={{ padding: 14, display: "grid", gap: 10 }}>
                <div style={{ color: theme.muted, fontSize: 12, lineHeight: 1.5 }}>
                  Send a privacy-safe issue report with optional redacted runtime diagnostics. Credentials, tokens, order details, and broker account data are excluded.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionButton theme={theme} onClick={onOpenHelp}>Help, Terms & Privacy</ActionButton>
                  <ActionButton theme={theme} active onClick={onOpenIssueReport}>Report Issue</ActionButton>
                </div>
                {accountPlan === "admin" && <AdminMonitoringPanel brokerApiUrl={brokerApiUrl} theme={theme} />}
              </div>
            </PremiumCard>}
          </div>}
        </div>
      </div>
    );
  
}
