import { RefreshCw } from "lucide-react";
import { formatHealthTime, getCleanProviderMessage, getHealthLabelStatus } from "../utils/healthStatus";
import { formatTerminalStatusLabel, getStatusColor } from "../utils/marketUtils";

function statusDotColor(status, theme) {
  if (status === "ok") return theme.green;
  if (status === "bad") return theme.red;
  if (status === "warn") return theme.amber;

  return theme.blue;
}

function HealthCell({ theme, terminalMonoFont, label, value, detail, status }) {
  const resolvedStatus = status || getHealthLabelStatus(value);
  const dotColor = statusDotColor(resolvedStatus, theme);
  const valueWidth = label === "Updated" ? "62px" : label === "Data" ? "92px" : "82px";
  const displayValue = formatTerminalStatusLabel(value);

  return (
    <span
      title={detail}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        minHeight: "19px",
        padding: "0 9px",
        borderRight: `1px solid ${theme.borderSoft || theme.border}`,
        whiteSpace: "nowrap",
        minWidth: 0,
        flex: "0 1 auto",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "999px",
          background: dotColor,
          boxShadow: "none",
          flexShrink: 0,
        }}
      />
      <span style={{ color: theme.faint || theme.muted, fontWeight: 850 }}>
        {label}:
      </span>
      <span
        style={{
          color: getStatusColor(value, theme),
          fontFamily: terminalMonoFont,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 900,
          width: valueWidth,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={String(value || "")}
      >
        {displayValue}
      </span>
    </span>
  );
}

function resolveDataLabel(scannerLabel, newsLabel) {
  const statusText = `${scannerLabel || ""} ${newsLabel || ""}`.toUpperCase();

  if (statusText.includes("ERROR") || statusText.includes("FAILED")) return "Data Limited";
  if (statusText.includes("LIMITED") || statusText.includes("CACHED") || statusText.includes("FALLBACK")) return "Data Limited";
  if (statusText.includes("LIVE")) return "Data Live";

  return "Data Pending";
}

export default function ProductionHealthStrip({
  theme,
  terminalMonoFont,
  backendLabel,
  qtrdHealth,
  scannerLabel,
  scannerMessage,
  newsLabel,
  newsMessage,
  aiLabel,
  aiMessage,
  lastCheckedAt,
  onRefresh,
  refreshing = false,
  brokerToolsEnabled = true,
}) {
  const checkedLabel = formatHealthTime(lastCheckedAt);
  const dataLabel = resolveDataLabel(scannerLabel, newsLabel);
  const detailsTitle = [
    `Backend: ${formatTerminalStatusLabel(backendLabel)}`,
    `${brokerToolsEnabled ? "Questrade" : "Market Data"}: ${formatTerminalStatusLabel(qtrdHealth.label)}`,
    `Scanner: ${formatTerminalStatusLabel(scannerLabel)}`,
    getCleanProviderMessage(scannerMessage, ""),
    `News: ${formatTerminalStatusLabel(newsLabel)}`,
    getCleanProviderMessage(newsMessage, ""),
    aiLabel ? `AI: ${formatTerminalStatusLabel(aiLabel)}` : null,
    aiMessage ? getCleanProviderMessage(aiMessage, "") : null,
    `Checked: ${checkedLabel}`,
  ].filter(Boolean).join(" | ");

  return (
    <div
      title={detailsTitle}
      style={{
        minHeight: "23px",
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "0 7px",
        background: theme.panel,
        borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
        overflow: "hidden",
        whiteSpace: "nowrap",
        fontSize: "9px",
      }}
    >
      <HealthCell
        theme={theme}
        terminalMonoFont={terminalMonoFont}
        label="Backend"
        value={backendLabel}
        detail="Railway backend health endpoint."
      />
      <HealthCell
        theme={theme}
        terminalMonoFont={terminalMonoFont}
        label={brokerToolsEnabled ? "QTRD" : "Market"}
        value={qtrdHealth.label}
        detail={qtrdHealth.rawMessage || qtrdHealth.message}
        status={qtrdHealth.status}
      />
      <HealthCell
        theme={theme}
        terminalMonoFont={terminalMonoFont}
        label="Data"
        value={dataLabel}
        detail={[
          `Scanner: ${formatTerminalStatusLabel(scannerLabel)}`,
          getCleanProviderMessage(scannerMessage, ""),
          `News: ${formatTerminalStatusLabel(newsLabel)}`,
          getCleanProviderMessage(newsMessage, ""),
        ].filter(Boolean).join(" | ")}
      />
      <HealthCell
        theme={theme}
        terminalMonoFont={terminalMonoFont}
        label="Updated"
        value={checkedLabel}
        detail="Last manual or automatic health check."
        status={lastCheckedAt ? "ok" : "info"}
      />
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        title={brokerToolsEnabled ? "Refresh backend, Questrade, scanner, and news status" : "Refresh backend, market data, scanner, and news status"}
        style={{
          marginLeft: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          height: "19px",
          padding: "0 8px",
          borderRadius: "5px",
          border: `1px solid ${theme.borderSoft || theme.border}`,
          background: refreshing ? theme.panel3 : theme.panel,
          color: refreshing ? theme.muted : theme.text,
          fontSize: "9px",
          fontWeight: 900,
          cursor: refreshing ? "wait" : "pointer",
          flexShrink: 0,
        }}
      >
        <RefreshCw size={12} />
        {refreshing ? "Refreshing" : "Retry"}
      </button>
    </div>
  );
}
