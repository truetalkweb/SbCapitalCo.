import { Plus, Star } from "lucide-react";
import { terminalMonoFont } from "../../../config/terminalConfig";
import { formatPacificDateTime } from "../../../utils/timeFormatters";
import { money, num } from "../premiumWorkspaceData";
import { ActionButton, PremiumCard, PremiumTable, PremiumTabs, SectionTitle, StatusPill } from "../PremiumWorkspacePrimitives";

export default function AlertsWorkspacePage({
  alertDraftDirection,
      alertDraftPrice,
      alertRows,
      alertView,
      bottomDock,
      createPriceAlert,
      isNarrowWorkspace,
      mainTwoCol,
      notificationPreferences,
      page,
      quickOrder,
      removeAlert,
      selectMainSymbol,
      selected,
      selectedAlert,
      selectedRail,
      setAlertDraftDirection,
      setAlertDraftPrice,
      setAlertView,
      setOrderMessage,
      setSelectedAlertSymbol,
      theme,
      toggleAlert,
      updateAlert
}) {
    const monitoringActive = notificationPreferences?.priceAlerts !== false;
    const soundActive = Boolean(notificationPreferences?.soundAlerts);
    const presentedStatus = (row) => !monitoringActive && row?.status === "Active" ? "Queued" : row?.status;
    return (
      <div style={page}>
        <div style={mainTwoCol}>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme}>
              <div style={{ padding: 16, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}>
                <SectionTitle theme={theme} title="Alerts" subtitle="Manage price alerts saved to your private workspace." action={(
                  <div style={{ display: "flex", gap: 8 }}>
                    <StatusPill theme={theme} tone={monitoringActive ? "good" : "warn"}>{monitoringActive ? "Monitoring active" : "Monitoring paused"}</StatusPill>
                    {soundActive && <StatusPill theme={theme} tone="neutral">Sound on</StatusPill>}
                    <input aria-label="Alert trigger price" type="number" min="0.01" step="0.01" value={alertDraftPrice} onChange={(event) => setAlertDraftPrice(event.target.value)} placeholder={num(selected.price) ? num(selected.price).toFixed(2) : "Trigger price"} style={{ width: 130, height: 34, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 10px", fontFamily: terminalMonoFont }} />
                    <select aria-label="Alert direction" value={alertDraftDirection} onChange={(event) => setAlertDraftDirection(event.target.value)} style={{ height: 34, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px" }}><option value="above">Above</option><option value="below">Below</option></select>
                    <ActionButton theme={theme} active onClick={() => {
                      const created = createPriceAlert?.({ symbol: selected.symbol, trigger: alertDraftPrice, direction: alertDraftDirection });
                      if (created) { setAlertDraftPrice(""); setOrderMessage?.(`Alert created for ${selected.symbol}.`); }
                    }}>Create <Plus size={14} style={{ verticalAlign: "-2px", marginLeft: 6 }} /></ActionButton>
                  </div>
                )} />
                <PremiumTabs theme={theme} tabs={["Active Alerts", "Paused", "Triggered", "All Alerts"]} active={alertView} onChange={setAlertView} />
              </div>
              <PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true, render: (row) => <><Star size={14} color={theme.amber} fill={theme.amber} style={{ verticalAlign: "-2px", marginRight: 10 }} />{row.symbol}</> }, { key: "type", label: "Alert Type", width: "130px" }, { key: "condition", label: "Condition", width: "1.4fr" }, { key: "last", label: "Last Price", width: "100px", align: "right", mono: true, render: (row) => num(row.last) ? num(row.last).toFixed(2) : "Unavailable" }, { key: "target", label: "Target", width: "90px", align: "right", mono: true }, { key: "status", label: "Status", width: "100px", render: (row) => <StatusPill theme={theme} tone={presentedStatus(row) === "Triggered" ? "bad" : presentedStatus(row) === "Paused" || presentedStatus(row) === "Queued" ? "warn" : "good"}>{presentedStatus(row)}</StatusPill> }, { key: "created", label: "Created", width: "150px", render: (row) => row.created && row.created !== "Not recorded" ? formatPacificDateTime(row.created) : row.created }]} rows={alertRows.filter((row) => alertView === "All Alerts" || (alertView === "Active Alerts" ? row.status === "Active" : row.status === alertView))} selectedKey={selectedAlert?.id} keyField="id" emptyMessage={`No ${alertView.toLowerCase()} available.`} onSelect={(row) => { setSelectedAlertSymbol(row.id); selectMainSymbol?.(row.symbol, row, "alert-row"); }} />
            </PremiumCard>
            <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "1fr 390px", gap: 10 }}>{bottomDock}{quickOrder}</div>
          </div>
          {selectedRail(<><PremiumCard theme={theme} title="Selected Alert"><div style={{ padding: 14, display: "grid", gap: 9 }}>{selectedAlert ? <><b>{selectedAlert.symbol} {selectedAlert.type}</b><span>{selectedAlert.condition}</span><StatusPill theme={theme} tone={presentedStatus(selectedAlert) === "Triggered" ? "bad" : presentedStatus(selectedAlert) === "Paused" || presentedStatus(selectedAlert) === "Queued" ? "warn" : "good"}>{presentedStatus(selectedAlert)}</StatusPill><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><ActionButton theme={theme} onClick={() => toggleAlert?.(selectedAlert.id)}>{selectedAlert.status === "Active" ? "Pause" : "Resume"}</ActionButton><ActionButton theme={theme} danger onClick={() => { removeAlert?.(selectedAlert.id); setSelectedAlertSymbol(null); }}>Delete</ActionButton></div><ActionButton theme={theme} disabled={!Number(alertDraftPrice)} title={!Number(alertDraftPrice) ? "Enter a positive trigger price before updating the alert" : "Update the trigger and reactivate this alert"} onClick={() => { const next = Number(alertDraftPrice); if (next > 0) { updateAlert?.(selectedAlert.id, { trigger: next, direction: alertDraftDirection, active: true, triggeredAt: null }); setAlertDraftPrice(""); } }}>Update & Reactivate</ActionButton></> : <span style={{ color: theme.muted }}>Create an alert to manage it here.</span>}</div></PremiumCard><PremiumCard theme={theme} title="Alert Activity"><div style={{ padding: 14, display: "grid", gap: 8 }}>{selectedAlert?.history?.length ? selectedAlert.history.map((event) => <div key={event.id} style={{ borderBottom: `1px solid ${theme.borderSoft || theme.border}`, paddingBottom: 8 }}><div style={{ color: theme.text }}>{selectedAlert.symbol} triggered {event.direction} {money(event.trigger)}</div><div style={{ color: theme.muted, fontSize: 11, marginTop: 3 }}>{formatPacificDateTime(event.occurredAt)} at {money(event.price)}</div></div>) : <span style={{ color: theme.muted }}>{monitoringActive ? "No trigger activity yet. Alerts evaluate only while the terminal is open." : "Price-alert monitoring is paused in Settings. Saved rules remain intact."}</span>}</div></PremiumCard></>)}
        </div>
      </div>
    );
  
}
