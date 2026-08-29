import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { authenticatedFetch } from "../services/authenticatedRequest";
import { adminMonitoringErrorMessage, readAdminJsonResponse } from "../services/adminMonitoringPolicy";

function titleCase(value) {
  return String(value || "unknown").replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFreshness(milliseconds) {
  if (!Number.isFinite(Number(milliseconds))) return "No successful update yet";
  const seconds = Math.max(0, Math.round(Number(milliseconds) / 1000));
  if (seconds < 60) return `${seconds}s old`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes}m old` : `${Math.round(minutes / 60)}h old`;
}

export default function AdminMonitoringPanel({ brokerApiUrl, theme }) {
  const [state, setState] = useState({ status: "loading", monitoring: null, reports: [], message: "" });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", message: "" }));
    try {
      const [monitoringResponse, issuesResponse] = await Promise.all([
        authenticatedFetch(`${brokerApiUrl}/api/admin/monitoring`),
        authenticatedFetch(`${brokerApiUrl}/api/admin/issues?limit=8`),
      ]);
      const [monitoring, issues] = await Promise.all([
        readAdminJsonResponse(monitoringResponse),
        readAdminJsonResponse(issuesResponse),
      ]);
      setState({ status: "ready", monitoring, reports: issues.reports || [], message: "" });
    } catch (error) {
      setState({ status: "failed", monitoring: null, reports: [], message: adminMonitoringErrorMessage(error) });
    }
  }, [brokerApiUrl]);

  const removeReport = async (reportId) => {
    if (!window.confirm("Remove this issue report? This cannot be undone.")) return;
    try {
      const response = await authenticatedFetch(`${brokerApiUrl}/api/admin/issues/${encodeURIComponent(reportId)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Issue report could not be removed.");
      setState((current) => ({
        ...current,
        reports: current.reports.filter((report) => report.id !== reportId),
        message: "",
      }));
    } catch {
      setState((current) => ({ ...current, message: "Issue report could not be removed." }));
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const services = Object.entries(state.monitoring?.services || {});
  const serviceDetails = state.monitoring?.serviceDetails || {};
  const efficiency = state.monitoring?.efficiency || {};
  const efficiencyMetrics = [
    ["API requests", efficiency.requests?.total ?? 0],
    ["API errors", efficiency.requests?.errors ?? 0],
    ["Cache hit rate", `${Math.round(Number(efficiency.caches?.hitRate || 0) * 100)}%`],
    ["Provider calls", efficiency.providers?.calls ?? 0],
  ];
  return (
    <section aria-labelledby="admin-monitoring-title" style={{ display: "grid", gap: 10, paddingTop: 12, borderTop: `1px solid ${theme.borderSoft || theme.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <strong id="admin-monitoring-title" style={{ color: theme.text }}>Admin Monitoring</strong>
          <div style={{ color: theme.muted, fontSize: 11, marginTop: 3 }}>Private operational status and recent issue reports.</div>
        </div>
        <button type="button" aria-label="Refresh admin monitoring" title="Refresh monitoring" onClick={load} disabled={state.status === "loading"} style={{ width: 32, height: 32, display: "grid", placeItems: "center", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 5, color: theme.text, background: theme.panel2, cursor: state.status === "loading" ? "wait" : "pointer" }}>
          <RefreshCw size={14} />
        </button>
      </div>
      {state.status === "loading" && <div role="status" style={{ color: theme.muted, fontSize: 12 }}>Loading monitoring status...</div>}
      {state.status === "failed" && <div role="alert" style={{ color: theme.amber, fontSize: 12 }}>{state.message}</div>}
      {state.status === "ready" && state.message && <div role="alert" style={{ color: theme.amber, fontSize: 12 }}>{state.message}</div>}
      {state.status === "ready" && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
          {services.map(([service, status]) => {
            const detail = serviceDetails[service] || {};
            return <div key={service} style={{ padding: "8px 9px", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 5, background: theme.panel2 }}><div style={{ color: theme.muted, fontSize: 9, textTransform: "uppercase" }}>{titleCase(service)}</div><div style={{ color: status === "available" || status === "online" ? theme.green : theme.amber, fontSize: 11, fontWeight: 800, marginTop: 3 }}>{detail.mode || titleCase(status)}</div><div style={{ color: theme.muted, fontSize: 9, marginTop: 3 }}>{formatFreshness(detail.freshnessMs)}</div></div>;
          })}
        </div>
        <div style={{ color: theme.muted, fontSize: 10 }}>Request ID: {state.monitoring?.requestId || "Unavailable"}</div>
        <section aria-label="Backend efficiency metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
          {efficiencyMetrics.map(([label, value]) => (
            <div key={label} style={{ padding: "8px 9px", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 5, background: theme.panel2 }}>
              <div style={{ color: theme.muted, fontSize: 9, textTransform: "uppercase" }}>{label}</div>
              <div style={{ color: theme.text, fontSize: 12, fontWeight: 800, marginTop: 3 }}>{value}</div>
            </div>
          ))}
        </section>
        <div style={{ color: theme.muted, fontSize: 11 }}>{state.monitoring?.incidents?.buffered || 0} reports buffered on this backend instance.</div>
        <div style={{ display: "grid", gap: 5 }}>
          {state.reports.length === 0 ? <div style={{ color: theme.muted, fontSize: 11 }}>No issue reports available.</div> : state.reports.slice(0, 5).map((report) => <div key={report.id} style={{ display: "grid", gridTemplateColumns: "90px 90px minmax(0, 1fr) 28px", gap: 8, alignItems: "center", color: theme.text, fontSize: 11, padding: "7px 0", borderTop: `1px solid ${theme.borderSoft || theme.border}` }}><span style={{ color: theme.blue }}>{titleCase(report.category)}</span><span style={{ color: theme.muted }}>{report.workspace || "Unknown"}</span><span title={report.description} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{report.description}</span><button type="button" aria-label={`Remove ${titleCase(report.category)} issue report`} title="Remove report" onClick={() => removeReport(report.id)} style={{ width: 28, height: 28, display: "grid", placeItems: "center", border: 0, borderRadius: 4, color: theme.red, background: "transparent", cursor: "pointer" }}><Trash2 size={13} /></button></div>)}
        </div>
      </>}
    </section>
  );
}
