import { Component } from "react";
import { captureRuntimeDiagnostic } from "../services/runtimeDiagnostics";

export default class RuntimeErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    captureRuntimeDiagnostic({
      type: "render",
      error,
      message: error?.message,
      stack: `${error?.stack || ""}\n${info?.componentStack || ""}`,
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="runtime-error-fallback" role="alert">
        <section>
          <div className="runtime-error-kicker">SB Terminal</div>
          <h1>Workspace recovery required</h1>
          <p>The terminal encountered an unexpected display error. Your broker credentials and order execution were not accessed.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload terminal</button>
        </section>
      </main>
    );
  }
}

