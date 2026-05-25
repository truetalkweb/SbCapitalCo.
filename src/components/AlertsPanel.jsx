export default function AlertsPanel({
  theme,
  buttonStyle,
  alertInput,
  setAlertInput,
  addPriceAlert,
  alerts,
  removeAlert,
  selectedStockData,
}) {
  return (
    <>
      <h3 style={{ marginTop: "12px", fontSize: "13px" }}>
        Price Alerts
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 72px",
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

        <button onClick={addPriceAlert} style={buttonStyle(true)}>
          Add
        </button>
      </div>

      {alerts.length === 0 ? (
        <div
          style={{
            color: theme.muted,
            fontSize: "11px",
            marginTop: "6px",
          }}
        >
          No alerts set.
        </div>
      ) : (
        alerts.map((alert) => (
          <div
            key={alert.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "6px",
              padding: "4px 0",
              borderBottom: `1px solid ${theme.border}`,
              fontSize: "10px",
              color: alert.active ? theme.text : theme.muted,
            }}
          >
            <span>
              {alert.symbol} {alert.direction} $
              {alert.trigger.toFixed(2)}{" "}
              <b
                style={{
                  color: alert.active
                    ? theme.green
                    : theme.red,
                }}
              >
                {alert.active
                  ? "ACTIVE"
                  : "TRIGGERED"}
              </b>
            </span>

            <button
              onClick={() => removeAlert(alert.id)}
              style={buttonStyle(false)}
            >
              X
            </button>
          </div>
        ))
      )}
    </>
  );
}