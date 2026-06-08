export default function AlertsPanel({
  theme,
  buttonStyle,
  alertInput,
  setAlertInput,
  alertDirection,
  setAlertDirection,
  addPriceAlert,
  alerts,
  removeAlert,
  alertNotifications,
  enableAlertNotifications,
  selectedStockData,
}) {
  const activeAlerts = alerts.filter((alert) => alert.active);
  const triggeredAlerts = alerts.filter((alert) => !alert.active);
  const canAddAlert = Number(alertInput) > 0;

  function renderAlert(alert) {
    return (
      <div
        key={alert.id}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "6px",
          padding: "6px 0",
          borderBottom: `1px solid ${theme.border}`,
          fontSize: "10px",
          color: alert.active ? theme.text : theme.muted,
        }}
      >
        <span>
          <b>{alert.symbol}</b> {alert.direction} ${alert.trigger.toFixed(2)}{" "}
          <b style={{ color: alert.active ? theme.green : theme.red }}>
            {alert.active ? "ACTIVE" : `TRIGGERED ${alert.triggeredAt || ""}`}
          </b>
        </span>

        <button onClick={() => removeAlert(alert.id)} style={buttonStyle(false)}>
          X
        </button>
      </div>
    );
  }

  return (
    <>
      <h3 style={{ marginTop: "12px", fontSize: "13px" }}>
        Price Alerts
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 82px 72px",
          gap: "6px",
        }}
      >
        <input
          type="number"
          value={alertInput}
          onChange={(e) => setAlertInput(e.target.value)}
          placeholder={`Alert @ ${selectedStockData?.price || ""}`}
          style={{
            width: "100%",
            padding: "7px",
            background: theme.panel2,
            border: `1px solid ${theme.border}`,
            color: theme.text,
            borderRadius: "4px",
            fontSize: "11px",
          }}
        />

        <select
          value={alertDirection}
          onChange={(e) => setAlertDirection(e.target.value)}
          style={{
            width: "100%",
            padding: "7px",
            background: theme.panel2,
            border: `1px solid ${theme.border}`,
            color: theme.text,
            borderRadius: "4px",
            fontSize: "11px",
          }}
        >
          <option value="above">Above</option>
          <option value="below">Below</option>
        </select>

        <button
          onClick={addPriceAlert}
          disabled={!canAddAlert}
          style={{
            ...buttonStyle(true),
            opacity: canAddAlert ? 1 : 0.55,
            cursor: canAddAlert ? "pointer" : "not-allowed",
          }}
        >
          Add
        </button>
      </div>

      <button
        onClick={enableAlertNotifications}
        style={{ ...buttonStyle(alertNotifications), width: "100%", marginTop: "6px" }}
      >
        Browser Notifications {alertNotifications ? "On" : "Off"}
      </button>

      {alerts.length === 0 ? (
        <div
          style={{
            color: theme.muted,
            border: `1px dashed ${theme.border}`,
            borderRadius: "6px",
            background: theme.panel2,
            padding: "10px",
            fontSize: "11px",
            marginTop: "6px",
            lineHeight: "1.45",
          }}
        >
          <div style={{ color: theme.text, fontWeight: 900, marginBottom: "3px" }}>
            No alerts set
          </div>
          <div>Create an above or below price alert for the active symbol.</div>
        </div>
      ) : (
        <>
          <h4 style={{ margin: "10px 0 3px", fontSize: "11px" }}>Active</h4>
          {activeAlerts.length ? activeAlerts.map(renderAlert) : (
            <div style={{ color: theme.muted, fontSize: "10px" }}>No active alerts.</div>
          )}

          <h4 style={{ margin: "10px 0 3px", fontSize: "11px" }}>Triggered</h4>
          {triggeredAlerts.length ? triggeredAlerts.map(renderAlert) : (
            <div style={{ color: theme.muted, fontSize: "10px" }}>No triggered alerts.</div>
          )}
        </>
      )}
    </>
  );
}
