import { useState } from "react";
import { Bug, Send, X } from "lucide-react";
import { submitIssueReport } from "../services/issueReports";

export default function IssueReportDialog({ brokerApiUrl, onClose, theme, workspace }) {
  const [category, setCategory] = useState("functionality");
  const [description, setDescription] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (description.trim().length < 10) {
      setMessage("Add a short description of what happened.");
      return;
    }
    setStatus("sending");
    setMessage("");
    try {
      const result = await submitIssueReport(brokerApiUrl, { category, description, workspace, includeDiagnostics });
      setStatus("sent");
      setMessage(`Report ${result.reportId} received.`);
    } catch (error) {
      setStatus("failed");
      setMessage(error.message || "Report could not be submitted.");
    }
  };

  return (
    <div className="issue-report-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="issue-report-dialog" role="dialog" aria-modal="true" aria-labelledby="issue-report-title" style={{ background: theme.panel, borderColor: theme.border, color: theme.text }}>
        <header>
          <div><Bug size={17} /><h2 id="issue-report-title">Report an issue</h2></div>
          <button type="button" aria-label="Close issue report" title="Close" onClick={onClose}><X size={17} /></button>
        </header>
        {status === "sent" ? (
          <div className="issue-report-success" role="status">
            <strong>Thank you. The report is ready for review.</strong>
            <span>{message}</span>
            <button type="button" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="functionality">Functionality</option><option value="data">Market data</option><option value="layout">Layout</option><option value="performance">Performance</option><option value="accessibility">Accessibility</option></select></label>
            <label>Description<textarea autoFocus value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} placeholder="What were you doing, and what did you expect to happen?" /></label>
            <label className="issue-report-consent"><input type="checkbox" checked={includeDiagnostics} onChange={(event) => setIncludeDiagnostics(event.target.checked)} /> Include recent redacted application errors</label>
            <p>Reports include the current workspace, viewport, and browser type. Passwords, tokens, broker credentials, and order details are never included.</p>
            {message && <div className="issue-report-message" role="alert">{message}</div>}
            <button className="issue-report-submit" type="submit" disabled={status === "sending"}><Send size={15} />{status === "sending" ? "Sending..." : "Send report"}</button>
          </form>
        )}
      </section>
    </div>
  );
}
