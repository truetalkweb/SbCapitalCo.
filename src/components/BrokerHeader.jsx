export default function BrokerHeader({
  theme,
  brokerConnected,
  brokerStatus,
  brokerAccounts,
  brokerLoading,
  selectedBrokerAccount,
  setSelectedBrokerAccount,
  refreshBroker,
  loadBrokerAccountData,
  primaryBrokerBalance,
  buttonStyle,
  brokerApiUrl,
}) {
  return (
    <>
      <h3 style={{ marginTop: "0px", fontSize: "13px" }}>Questrade Live Broker</h3>

      <div style={{ fontSize: "11px", lineHeight: "1.6" }}>
        <div>
          Status:{" "}
          <span style={{ color: brokerConnected ? theme.green : theme.red, fontWeight: 900 }}>
            {brokerStatus}
          </span>
        </div>
        <div>Backend: {brokerApiUrl}</div>
        <div>Accounts: {brokerAccounts.length}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "6px" }}>
        <button onClick={refreshBroker} style={buttonStyle(brokerConnected)}>
          {brokerLoading ? "Loading..." : "Connect"}
        </button>

        <button onClick={() => loadBrokerAccountData()} style={buttonStyle(false)}>
          Sync
        </button>
      </div>

      {brokerAccounts.length > 0 && (
        <select
          value={selectedBrokerAccount}
          onChange={(e) => setSelectedBrokerAccount(e.target.value)}
          style={{
            width: "100%",
            padding: "7px",
            background: theme.panel2,
            border: `1px solid ${theme.border}`,
            color: theme.text,
            borderRadius: "4px",
            marginTop: "6px",
            fontSize: "11px",
          }}
        >
          {brokerAccounts.map((account) => (
            <option key={account.number} value={account.number}>
              {account.type} · {account.number} · {account.status}
            </option>
          ))}
        </select>
      )}

      {primaryBrokerBalance && (
        <div style={{ marginTop: "6px", fontSize: "10px", lineHeight: "1.55" }}>
          <div>Currency: {primaryBrokerBalance.currency || "—"}</div>
          <div>Cash: ${Number(primaryBrokerBalance.cash || 0).toFixed(2)}</div>
          <div>Market Value: ${Number(primaryBrokerBalance.marketValue || 0).toFixed(2)}</div>
          <div>Total Equity: ${Number(primaryBrokerBalance.totalEquity || 0).toFixed(2)}</div>
          <div>Buying Power: ${Number(primaryBrokerBalance.buyingPower || 0).toFixed(2)}</div>
        </div>
      )}
    </>
  );
}