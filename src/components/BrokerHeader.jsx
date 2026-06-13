import { getCleanProviderMessage, getQuestradeHealth } from "../utils/healthStatus";

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "Pending";

  const number = Number(value);

  if (!Number.isFinite(number)) return "Pending";

  return number.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value) {
  if (!value) return "Not synced";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "Not synced";

  return parsed.toLocaleString();
}

function formatLatency(ms) {
  if (ms === null || ms === undefined || ms === "") return "Pending";
  if (!Number.isFinite(Number(ms))) return "Pending";
  if (Number(ms) < 1000) return `${Math.round(Number(ms))}ms`;

  return `${(Number(ms) / 1000).toFixed(1)}s`;
}

function formatAge(ms) {
  if (ms === null || ms === undefined || ms === "") return "Pending";

  const number = Number(ms);

  if (!Number.isFinite(number)) return "Pending";
  if (number < 60_000) return `${Math.max(1, Math.round(number / 1000))}s`;
  if (number < 3_600_000) return `${Math.round(number / 60_000)}m`;

  return `${Math.round(number / 3_600_000)}h`;
}

function maskAccountNumber(accountNumber) {
  const raw = String(accountNumber || "");

  if (raw.length <= 4) return raw ? "****" : "Account";

  return `****${raw.slice(-4)}`;
}

function StatusPill({ label, color, background, border }) {
  return (
    <span
      style={{
        color,
        background,
        border,
        borderRadius: "999px",
        padding: "4px 8px",
        fontSize: "9px",
        fontWeight: 950,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function Metric({ theme, label, value, color }) {
  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${theme.panel3 || theme.panel2}, ${theme.panel2})`,
        border: `1px solid ${theme.borderSoft || theme.border}`,
        borderRadius: "8px",
        padding: "7px",
        minWidth: 0,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
      }}
    >
      <div style={{ color: theme.muted, fontSize: "9px", fontWeight: 950, textTransform: "uppercase" }}>
        {label}
      </div>
      <div
        style={{
          color: color || theme.text,
          fontSize: "11px",
          fontWeight: 950,
          marginTop: "2px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function BrokerHeader({
  theme,
  brokerConnected,
  brokerStatus,
  brokerDetails,
  brokerError,
  brokerAccounts,
  brokerLoading,
  selectedBrokerAccount,
  setSelectedBrokerAccount,
  refreshBroker,
  loadBrokerAccountData,
  primaryBrokerBalance,
  buttonStyle,
  brokerApiUrl,
  platformHealth,
  liveReadiness,
  brokerSyncMeta,
  qtrdHealth,
}) {
  const accounts = Array.isArray(brokerAccounts) ? brokerAccounts : [];
  const canSync = brokerConnected && accounts.length > 0 && !brokerLoading;
  const tokenStatus = brokerDetails?.tokenStatus || platformHealth?.broker?.token || {};
  const tokenStore = brokerDetails?.tokenStore || platformHealth?.broker?.tokenStore || {};
  const brokerWarnings = brokerDetails?.warnings || platformHealth?.broker?.warnings || [];
  const syncStatus = platformHealth?.broker?.sync || brokerSyncMeta || {};
  const lastHttpStatus = tokenStatus.lastHttpStatus || brokerDetails?.token?.lastHttpStatus || null;
  const resolvedQtrdHealth = qtrdHealth || getQuestradeHealth({
    brokerConnected,
    brokerDetails,
    brokerError,
    platformHealth,
  });
  const expiresAt = tokenStatus.expiresAt ? new Date(tokenStatus.expiresAt) : null;
  const backendTime = brokerDetails?.backendTime ? new Date(brokerDetails.backendTime) : new Date();
  const minutesToExpiry = expiresAt
    ? Math.max(0, Math.round((expiresAt.getTime() - backendTime.getTime()) / 60000))
    : null;
  const tokenHealthy = brokerConnected && minutesToExpiry !== null && minutesToExpiry > 5;
  const endpointLabel = brokerApiUrl.includes("railway.app")
    ? "Railway production"
    : brokerApiUrl.includes("localhost")
    ? "Local backend"
    : "Custom backend";
  const selectedAccount = accounts.find((account) => account.number === selectedBrokerAccount);
  const rawDiagnostic = brokerError || tokenStatus.lastError || brokerDetails?.error || "";
  const diagnostic = rawDiagnostic
    ? getCleanProviderMessage(rawDiagnostic, resolvedQtrdHealth.message || "Questrade degraded. Retry shortly.")
    : "";
  const liveBlockingReasons = Array.isArray(liveReadiness?.blockingReasons)
    ? liveReadiness.blockingReasons
    : [];
  const liveReady =
    Boolean(liveReadiness) &&
    liveBlockingReasons.length === 0 &&
    liveReadiness.liveTradingEnabled;
  const persistenceLabel = tokenStore.firestore
    ? "Firestore persisted"
    : tokenStore.envRefreshToken
    ? "Env token present"
    : "Token missing";
  const cardStyle = {
    background: `linear-gradient(180deg, ${theme.panel3 || theme.panel2}, ${theme.panel2})`,
    border: `1px solid ${theme.borderSoft || theme.border}`,
    borderRadius: "8px",
    padding: "9px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 950 }}>Broker Operations</h3>
          <div style={{ color: theme.muted, fontSize: "10px", marginTop: "2px" }}>
            Questrade account sync and diagnostics
          </div>
        </div>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <StatusPill
            label={brokerConnected ? "DATA LINK" : "OFFLINE"}
            color={brokerConnected ? theme.green : theme.red}
            background={brokerConnected ? "rgba(0,200,150,0.10)" : "rgba(239,83,80,0.10)"}
            border={`1px solid ${brokerConnected ? "rgba(0,200,150,0.35)" : "rgba(239,83,80,0.35)"}`}
          />
          <StatusPill
            label={liveReady ? "LIVE READY" : "LIVE SUBMIT DISABLED"}
            color={liveReady ? theme.green : theme.amber}
            background={liveReady ? "rgba(0,200,150,0.10)" : "rgba(245,184,75,0.09)"}
            border={`1px solid ${liveReady ? "rgba(0,200,150,0.35)" : "rgba(245,184,75,0.32)"}`}
          />
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: "8px", display: "grid", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "flex-start" }}>
          <div>
            <div style={{ color: brokerConnected ? theme.green : theme.red, fontWeight: 950, fontSize: "12px" }}>
              {brokerConnected ? "Connected to Questrade" : resolvedQtrdHealth.label}
            </div>
            <div style={{ color: theme.muted, fontSize: "10px", marginTop: "2px", wordBreak: "break-word" }}>
              {endpointLabel}
            </div>
          </div>
          <div style={{ color: theme.muted, fontSize: "10px", textAlign: "right" }}>
            {brokerStatus}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "6px" }}>
          <Metric
            theme={theme}
            label="Token"
            value={tokenHealthy ? `${minutesToExpiry}m valid` : minutesToExpiry === null ? "Refresh needed" : `${minutesToExpiry}m left`}
            color={tokenHealthy ? theme.green : theme.amber}
          />
          <Metric
            theme={theme}
            label="Persistence"
            value={persistenceLabel}
            color={tokenStore.firestore || tokenStore.envRefreshToken ? theme.text : theme.red}
          />
          <Metric
            theme={theme}
            label="API"
            value={tokenStatus.apiServer ? "Questrade API ready" : "API pending"}
            color={tokenStatus.apiServer ? theme.text : theme.amber}
          />
          <Metric
            theme={theme}
            label="HTTP"
            value={lastHttpStatus ? String(lastHttpStatus) : brokerConnected ? "200" : "No response"}
            color={brokerConnected ? theme.green : theme.amber}
          />
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: "8px", display: "grid", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <div style={{ color: theme.text, fontWeight: 950, fontSize: "12px" }}>Account Selector</div>
          <div style={{ color: theme.muted, fontSize: "10px" }}>
            {accounts.length} account{accounts.length === 1 ? "" : "s"}
          </div>
        </div>

        {accounts.length > 0 ? (
          <select
            value={selectedBrokerAccount}
            onChange={(event) => setSelectedBrokerAccount(event.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              background: theme.panel,
              border: `1px solid ${theme.borderSoft || theme.border}`,
              color: theme.text,
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 850,
            }}
          >
            {accounts.map((account) => (
              <option key={account.number} value={account.number}>
                {account.type || "Broker"} - {maskAccountNumber(account.number)} - {account.status || "Active"}
              </option>
            ))}
          </select>
        ) : (
          <div style={{ color: theme.muted, fontSize: "10px", lineHeight: "1.45" }}>
            Connect broker to load account selector.
          </div>
        )}

        {selectedAccount && (
          <div style={{ color: theme.muted, fontSize: "10px", lineHeight: "1.45" }}>
            Selected {selectedAccount.type || "broker"} account {maskAccountNumber(selectedAccount.number)}.
          </div>
        )}

        {primaryBrokerBalance ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "6px" }}>
            <Metric theme={theme} label="Buying Power" value={formatMoney(primaryBrokerBalance.buyingPower)} color={theme.blue} />
            <Metric theme={theme} label="Cash" value={formatMoney(primaryBrokerBalance.cash)} />
            <Metric theme={theme} label="Equity" value={formatMoney(primaryBrokerBalance.totalEquity)} color={theme.green} />
            <Metric theme={theme} label="Market Value" value={formatMoney(primaryBrokerBalance.marketValue)} />
          </div>
        ) : (
          <div style={{ color: theme.muted, fontSize: "10px", lineHeight: "1.45" }}>
            Balance sync pending.
          </div>
        )}
      </div>

      <div style={{ ...cardStyle, marginTop: "8px", display: "grid", gap: "7px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
          <div style={{ color: theme.text, fontWeight: 950, fontSize: "12px" }}>Sync Health</div>
          <div style={{ color: platformHealth?.backend?.status === "online" ? theme.green : theme.amber, fontSize: "10px", fontWeight: 950 }}>
            {platformHealth?.backend?.status || "Pending"}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "6px" }}>
          <Metric theme={theme} label="Last Broker Sync" value={formatDateTime(syncStatus?.lastSuccessAt)} />
          <Metric theme={theme} label="Latency" value={formatLatency(syncStatus?.latencyMs)} />
          <Metric theme={theme} label="Token Refresh" value={formatDateTime(tokenStatus.lastRefreshAt)} />
          <Metric theme={theme} label="Token Age" value={formatAge(platformHealth?.broker?.tokenAgeMs)} />
          <Metric
            theme={theme}
            label="Scanner"
            value={platformHealth?.scanner?.lastError ? "Scanner error" : platformHealth?.scanner?.lastSuccessAt ? "Healthy" : "Waiting"}
            color={platformHealth?.scanner?.lastError ? theme.red : theme.text}
          />
          <Metric theme={theme} label="Cache" value={`${platformHealth?.scanner?.cacheSize || 0} rows`} />
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: "8px", display: "grid", gap: "7px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
          <div style={{ color: theme.text, fontWeight: 950, fontSize: "12px" }}>Live Readiness</div>
          <div style={{ color: liveReady ? theme.green : theme.amber, fontSize: "10px", fontWeight: 950 }}>
            {liveReady ? "Ready" : "Disabled"}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "6px" }}>
          <Metric theme={theme} label="Permission" value={liveReadiness?.orderPermissionDetected ? "Confirmed" : "Not confirmed"} color={liveReadiness?.orderPermissionDetected ? theme.green : theme.amber} />
          <Metric theme={theme} label="Live Env" value={liveReadiness?.liveTradingEnabled ? "Enabled" : "Off"} color={liveReadiness?.liveTradingEnabled ? theme.green : theme.amber} />
          <Metric theme={theme} label="Risk Gate" value={liveReadiness?.riskControlsEnabled ? "Configured" : "Needs env"} color={liveReadiness?.riskControlsEnabled ? theme.green : theme.amber} />
          <Metric theme={theme} label="Audit" value={liveReadiness?.auditLoggingEnabled ? "On" : "Off"} color={liveReadiness?.auditLoggingEnabled ? theme.green : theme.red} />
        </div>

        {liveBlockingReasons.length > 0 && (
          <div style={{ color: theme.amber, fontSize: "10px", lineHeight: "1.45" }}>
            {liveBlockingReasons.slice(0, 2).join(" ")}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "8px" }}>
        <button
          onClick={refreshBroker}
          disabled={brokerLoading}
          style={{
            ...buttonStyle(brokerConnected),
            opacity: brokerLoading ? 0.75 : 1,
            cursor: brokerLoading ? "wait" : "pointer",
          }}
        >
          {brokerLoading ? "Refreshing..." : brokerConnected ? "Refresh Broker" : "Connect Broker"}
        </button>

        <button
          onClick={() => loadBrokerAccountData()}
          disabled={!canSync}
          title={canSync ? "Sync balances, positions, and orders" : "Connect and select an account before syncing"}
          style={{
            ...buttonStyle(false),
            opacity: canSync ? 1 : 0.55,
            cursor: canSync ? "pointer" : "not-allowed",
          }}
        >
          Sync Account
        </button>
      </div>

      {(diagnostic || brokerWarnings.length > 0) && (
        <div
          style={{
            color: diagnostic ? theme.red : theme.amber,
            border: `1px solid ${diagnostic ? "rgba(239,83,80,0.45)" : "rgba(255,193,7,0.35)"}`,
            borderRadius: "7px",
            background: diagnostic ? "rgba(239,83,80,0.08)" : "rgba(255,193,7,0.07)",
            padding: "8px",
            marginTop: "8px",
            fontSize: "10px",
            lineHeight: "1.45",
          }}
        >
          <div style={{ color: theme.text, fontWeight: 950, marginBottom: "2px" }}>
            Broker Diagnostic
          </div>
          <div title={rawDiagnostic || undefined}>
            {diagnostic || brokerWarnings.slice(0, 2).map((warning) => getCleanProviderMessage(warning)).join(" ")}
          </div>
        </div>
      )}
    </>
  );
}
