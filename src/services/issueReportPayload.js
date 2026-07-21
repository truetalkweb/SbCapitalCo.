import { getRuntimeDiagnostics, redactSensitiveText } from "./runtimeDiagnostics.js";

export function buildIssueReportPayload({ category, description, workspace, includeDiagnostics = true }) {
  return {
    category: String(category || "general").toLowerCase(),
    description: redactSensitiveText(description).slice(0, 2000),
    workspace: String(workspace || "unknown").slice(0, 64),
    page: typeof window === "undefined" ? "/" : window.location.pathname,
    viewport: typeof window === "undefined" ? null : {
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: window.devicePixelRatio,
    },
    userAgent: typeof navigator === "undefined" ? null : redactSensitiveText(navigator.userAgent).slice(0, 320),
    diagnostics: includeDiagnostics ? getRuntimeDiagnostics(10) : [],
  };
}

