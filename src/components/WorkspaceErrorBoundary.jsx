import { Component } from "react";
import { captureRuntimeDiagnostic } from "../services/runtimeDiagnostics";

export default class WorkspaceErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    captureRuntimeDiagnostic({
      type: "render",
      error,
      message: "Workspace panel render failed",
      stack: `${error?.stack || ""}\n${info?.componentStack || ""}`,
    });
  }

  componentDidUpdate(previousProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;

    const { theme, onDashboard } = this.props;
    return (
      <section
        role="alert"
        aria-labelledby="workspace-recovery-title"
        style={{
          minHeight: 280,
          height: "100%",
          display: "grid",
          placeItems: "center",
          padding: 24,
          color: theme.text,
          background: theme.bg,
        }}
      >
        <div style={{ width: "min(460px, 100%)", padding: 20, border: `1px solid ${theme.border}`, borderRadius: 8, background: theme.panel }}>
          <div style={{ color: theme.blue, fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>Workspace recovery</div>
          <h2 id="workspace-recovery-title" style={{ margin: "8px 0 6px", fontSize: 18 }}>This workspace is temporarily unavailable</h2>
          <p style={{ margin: 0, color: theme.muted, fontSize: 13, lineHeight: 1.55 }}>
            The rest of the terminal is still available. Retry this panel or return to Dashboard while it recovers.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button type="button" onClick={() => this.setState({ failed: false })} style={{ minHeight: 36, padding: "0 14px", border: 0, borderRadius: 5, background: theme.blue, color: "#fff", fontWeight: 800, cursor: "pointer" }}>
              Retry workspace
            </button>
            <button type="button" onClick={onDashboard} style={{ minHeight: 36, padding: "0 14px", border: `1px solid ${theme.border}`, borderRadius: 5, background: theme.panel2, color: theme.text, fontWeight: 700, cursor: "pointer" }}>
              Open Dashboard
            </button>
          </div>
        </div>
      </section>
    );
  }
}
