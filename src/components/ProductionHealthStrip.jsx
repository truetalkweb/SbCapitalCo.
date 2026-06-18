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
  const valueWidth = label === "Checked" ? "66px" : "128px";
  const displayValue = formatTerminalStatusLabel(value);

  return (
    <span
      title={detail}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        minHeight: "19px",
        padding: "0 7px",
        borderRight: `1px solid ${theme.borderSoft || theme.border}`,
        whiteSpace: "nowrap",
        minWidth: label === "Checked" ? "138px" : "196px",
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
        {label}
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
}) {
  const checkedLabel = formatHealthTime(lastCheckedAt);

  return (
    <div
      style={{
        minHeight: "23px",
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "0 7px",
        background: theme.panel,
        borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
        overflowX: "auto",
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
        label="Questrade"
        value={qtrdHealth.label}
        detail={qtrdHealth.rawMessage || qtrdHealth.message}
        status={qtrdHealth.status}
      />
      <HealthCell
        theme={theme}
        terminalMonoFont={terminalMonoFont}
        label="Scanner"
        value={scannerLabel}
        detail={getCleanProviderMessage(scannerMessage, "Provider limited. Cached/fallback data active.")}
      />
      <HealthCell
        theme={theme}
        terminalMonoFont={terminalMonoFont}
        label="News"
        value={newsLabel}
        detail={getCleanProviderMessage(newsMessage, "News provider limited. Showing available headlines.")}
      />
      <HealthCell
        theme={theme}
        terminalMonoFont={terminalMonoFont}
        label="AI"
        value={aiLabel || "AI PENDING"}
        detail={getCleanProviderMessage(aiMessage, "Gemini intelligence status.")}
      />
      <HealthCell
        theme={theme}
        terminalMonoFont={terminalMonoFont}
        label="Checked"
        value={checkedLabel}
        detail="Last manual or automatic health check."
        status={lastCheckedAt ? "ok" : "info"}
      />
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        title="Refresh backend, Questrade, scanner, and news status"
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
