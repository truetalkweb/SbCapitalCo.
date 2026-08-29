import { getCleanProviderMessage, getQuestradeHealth } from "../utils/healthStatus";
import { formatPacificDateTime } from "../utils/timeFormatters";

function formatDateTime(value) {
  return formatPacificDateTime(value, { fallback: "Not synced" });
}

function formatExpiry(tokenStatus, brokerDetails) {
  const expiresAt = tokenStatus?.expiresAt || brokerDetails?.token?.expiresAt;
  const backendTime = brokerDetails?.backendTime ? new Date(brokerDetails.backendTime) : new Date();

  if (!expiresAt) return "Refresh pending";

  const parsed = new Date(expiresAt);

  if (Number.isNaN(parsed.getTime())) return "Refresh pending";

  const minutes = Math.max(0, Math.round((parsed.getTime() - backendTime.getTime()) / 60000));

  return `${minutes}m remaining`;
}

function HealthRow({ theme, label, value, status = "info", detail }) {
  const color =
    status === "ok" ? theme.green : status === "bad" ? theme.red : status === "warn" ? theme.amber : theme.blue;

  return (
    <div
      style={{
        background: theme.panel3 || theme.panel,
        border: `1px solid ${theme.borderSoft || theme.border}`,
        borderRadius: "8px",
        padding: "8px",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
        <div style={{ color: theme.text, fontSize: "11px", fontWeight: 950 }}>{label}</div>
        <span
          style={{
            color,
            border: `1px solid ${color}55`,
            background: `${color}14`,
            borderRadius: "999px",
            padding: "3px 7px",
            fontSize: "8px",
            fontWeight: 950,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {status}
        </span>
      </div>
      <div style={{ color: theme.text, fontSize: "11px", fontWeight: 900, marginTop: "7px", wordBreak: "break-word" }}>
        {value}
      </div>
      {detail && (
        <div style={{ color: theme.muted, fontSize: "10px", lineHeight: "1.45", marginTop: "5px" }}>
          {detail}
        </div>
      )}
    </div>
  );
}

export default function ProductionHealthPanel({
  theme,
  brokerApiUrl,
  platformHealth,
  brokerConnected,
  brokerDetails,
  brokerError,
  brokerSyncMeta,
  scannerMeta,
  scannerLoading,
  wsStatus,
  mainChartStatus,
  refreshBroker,
  buttonStyle,
  qtrdHealth,
  brokerToolsEnabled = true,
}) {
  const tokenStatus = brokerDetails?.tokenStatus || platformHealth?.broker?.token || {};
  const tokenStore = brokerDetails?.tokenStore || platformHealth?.broker?.tokenStore || {};
  const brokerWarnings = brokerDetails?.warnings || platformHealth?.broker?.warnings || [];
  const resolvedQtrdHealth = qtrdHealth || getQuestradeHealth({
    brokerConnected,
    brokerDetails,
    brokerError,
    platformHealth,
  });
  const scannerWarning = scannerMeta?.userMessage ||
    scannerMeta?.userWarnings?.[0] ||
    platformHealth?.scanner?.providerStatus?.userMessage ||
    platformHealth?.scanner?.providerStatus?.userWarnings?.[0] ||
    "";
  const backendOnline = platformHealth?.backend?.status === "online";
  const scannerDegraded = Boolean(scannerMeta?.degraded || platformHealth?.scanner?.degraded);
  const tokenPersisted = Boolean(tokenStore.firestore || tokenStatus.refreshTokenPersisted);
  const marketDataDelayed = platformHealth?.marketData?.delayed === true;
  const marketDataOk = platformHealth?.marketData?.httpStatus === 200 || platformHealth?.marketData?.source === "Questrade";
  const marketDataLabel = resolvedQtrdHealth.label ||
    (marketDataDelayed ? "QTRD DELAYED" : marketDataOk ? "QTRD LIVE" : "QTRD PENDING");
  const chartLabel = mainChartStatus === "QTRD" || mainChartStatus === "LIVE"
    ? "CHART QTRD"
    : mainChartStatus === "SIM"
      ? "CHART SIM"
      : `CHART ${mainChartStatus || "PENDING"}`;
  const scannerStatusLabel = scannerMeta?.statusLabel ||
    (scannerMeta?.providerStatus?.label
      ? `SCANNER ${String(scannerMeta.providerStatus.label).toUpperCase()}`
      : null) ||
    (platformHealth?.scanner?.providerStatus?.label
      ? `SCANNER ${String(platformHealth.scanner.providerStatus.label).toUpperCase()}`
      : null);
  const scannerSource = String(scannerMeta?.source || platformHealth?.scanner?.source || "").toUpperCase();
  const aiHealth = platformHealth?.ai || platformHealth?.deepHealth?.ai || {};
  const newsHealth = platformHealth?.news || platformHealth?.deepHealth?.news || {};
  const aiLive = aiHealth.source === "gemini" && (aiHealth.live || aiHealth.providerLabel === "LIVE");
  const aiPersistentCache = aiHealth.persistentCache || {};
  const aiStatusMessage = getCleanProviderMessage(
    aiHealth.userMessage || aiHealth.lastError || aiPersistentCache.lastError,
    "AI intelligence is ready when provider data is available."
  );
  const brokerStatusMessage = getCleanProviderMessage(
    resolvedQtrdHealth.message || resolvedQtrdHealth.rawMessage,
    "Broker diagnostics are temporarily unavailable."
  );
  const brokerSyncMessage = getCleanProviderMessage(
    brokerSyncMeta?.lastError || platformHealth?.broker?.sync?.lastError,
    "No broker sync error recorded."
  );
  const aiLabel = aiLive
    ? "GEMINI LIVE"
    : aiHealth.label || (aiHealth.configured ? "AI DEGRADED" : "AI FALLBACK");
  const newsLabel = newsHealth.label || "NEWS PENDING";
  const scannerLabel = scannerLoading
    ? "SCANNER LOADING"
    : scannerStatusLabel
      ? scannerStatusLabel
      : scannerSource.includes("LOCAL")
      ? "SCANNER FALLBACK"
      : scannerSource.includes("FALLBACK")
        ? "SCANNER FALLBACK"
        : scannerSource.includes("FMP")
          ? "SCANNER LIVE"
          : scannerDegraded
            ? "SCANNER FALLBACK"
            : "SCANNER PENDING";
  const endpointLabel = brokerApiUrl.includes("railway.app")
    ? "Railway production backend"
    : brokerApiUrl.includes("localhost")
    ? "Local backend"
    : "Custom backend";
  const appHost = typeof window !== "undefined" ? window.location.host : "local";
  const cardStyle = {
    background: `linear-gradient(180deg, ${theme.panel2}, ${theme.panel})`,
    border: `1px solid ${theme.borderSoft || theme.border}`,
    borderRadius: "8px",
    padding: "9px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  };

  return (
    <div style={{ display: "grid", gap: "9px" }}>
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 950 }}>Production Health</h3>
            <div style={{ color: theme.muted, fontSize: "10px", marginTop: "2px" }}>
              {brokerToolsEnabled
                ? "Frontend, Railway, scanner, and broker diagnostics without exposing secrets."
                : "Frontend, Railway, scanner, news, and AI health for public product mode."}
            </div>
          </div>
          <span
            style={{
              color: backendOnline && (!brokerToolsEnabled || brokerConnected) ? theme.green : theme.amber,
              border: `1px solid ${backendOnline && (!brokerToolsEnabled || brokerConnected) ? "rgba(0,200,150,0.35)" : "rgba(245,184,75,0.35)"}`,
              background: backendOnline && (!brokerToolsEnabled || brokerConnected) ? "rgba(0,200,150,0.08)" : "rgba(245,184,75,0.08)",
              borderRadius: "999px",
              padding: "4px 8px",
              fontSize: "9px",
              fontWeight: 950,
              whiteSpace: "nowrap",
            }}
          >
            {backendOnline && (!brokerToolsEnabled || brokerConnected) ? "OPERATIONAL" : "DEGRADED"}
          </span>
        </div>
      </div>

      <HealthRow
        theme={theme}
        label="Frontend + Chart"
        value={`${appHost} / ${chartLabel}`}
        status="ok"
        detail={`Market data: ${marketDataLabel}. ${resolvedQtrdHealth.message} Transport: ${wsStatus || "BACKEND"}.`}
      />
      <HealthRow
        theme={theme}
        label="Railway Backend"
        value={endpointLabel}
        status={backendOnline ? "ok" : "warn"}
        detail={`Platform health: ${platformHealth?.backend?.status || "Pending response"}.`}
      />
      <HealthRow
        theme={theme}
        label="Scanner Source"
        value={scannerLabel}
        status={scannerDegraded ? "warn" : "ok"}
        detail={[
          `Freshness: ${formatDateTime(scannerMeta?.updatedAt || platformHealth?.scanner?.lastSuccessAt)}`,
          scannerMeta?.cached ? "Cached response active." : "Cache state normal.",
          scannerWarning ? `Status: ${scannerWarning}` : "No scanner warning reported.",
        ].join(" ")}
      />
      <HealthRow
        theme={theme}
        label="News Feed"
        value={newsLabel}
        status={newsHealth.providerLimited || newsHealth.degraded || newsHealth.fallback ? "warn" : newsHealth.live ? "ok" : "info"}
        detail={`Source: ${newsHealth.source || "Backend News"}. Cache: ${newsHealth.cacheSize || 0} entries. ${newsHealth.userMessage || "No raw provider errors exposed."}`}
      />
      <HealthRow
        theme={theme}
        label="AI Intelligence"
        value={aiLabel}
        status={aiLive ? "ok" : aiHealth.configured ? "warn" : "info"}
        detail={`Provider: ${aiHealth.source || aiHealth.provider || "local-fallback"}. Summary cache: ${aiHealth.summaryCacheSize || 0}. Catalyst cache: ${aiHealth.catalystCacheSize || 0}. Persistent cache: ${aiPersistentCache.enabled ? "Firestore" : "disabled"}${aiPersistentCache.lastHitAt ? `, last hit ${formatDateTime(aiPersistentCache.lastHitAt)}` : ""}. ${aiStatusMessage}`}
      />
      {brokerToolsEnabled && (
      <HealthRow
        theme={theme}
        label="Questrade Connection"
        value={brokerConnected ? "BROKER CONNECTED" : marketDataLabel}
        status={brokerConnected ? "ok" : resolvedQtrdHealth.status === "bad" ? "bad" : "warn"}
        detail={brokerStatusMessage}
      />
      )}
      {brokerToolsEnabled && (
      <HealthRow
        theme={theme}
        label="Token Persistence"
        value={tokenPersisted ? "Refresh token persisted" : "Persistence not confirmed"}
        status={tokenPersisted ? "ok" : "warn"}
        detail={`Expiry: ${formatExpiry(tokenStatus, brokerDetails)}.`}
      />
      )}
      {brokerToolsEnabled && (
      <HealthRow
        theme={theme}
        label="Last Broker Sync"
        value={formatDateTime(brokerSyncMeta?.lastSuccessAt || platformHealth?.broker?.sync?.lastSuccessAt)}
        status={brokerSyncMeta?.lastError || platformHealth?.broker?.sync?.lastError ? "bad" : "ok"}
        detail={brokerSyncMessage}
      />
      )}

      {((brokerToolsEnabled && (brokerWarnings.length > 0 || brokerError)) || scannerWarning) && (
        <div
          style={{
            ...cardStyle,
            color: theme.amber,
            fontSize: "10px",
            lineHeight: "1.45",
          }}
        >
          <div style={{ color: theme.text, fontWeight: 950, marginBottom: "4px" }}>API Warnings</div>
          {[...(brokerToolsEnabled ? brokerWarnings.slice(0, 3) : []), scannerWarning, brokerToolsEnabled ? brokerError : null]
            .filter(Boolean)
            .map((warning, index) => (
              <div
                key={`${warning}-${index}`}
                style={{ marginTop: index ? "5px" : 0 }}
              >
                {getCleanProviderMessage(warning)}
              </div>
            ))}
        </div>
      )}

      <button
        type="button"
        onClick={refreshBroker}
        style={{ ...(buttonStyle ? buttonStyle(false) : {}), width: "100%" }}
      >
        {brokerToolsEnabled ? "Retry Broker + Health" : "Retry Health"}
      </button>
    </div>
  );
}
