const MAX_DIAGNOSTICS = 25;
const MAX_TEXT_LENGTH = 1200;

const diagnostics = [];
let installed = false;

const SENSITIVE_PATTERNS = [
  [/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]"],
  [/([?&#](?:access_token|refresh_token|token|api_key|apikey|key)=)[^&#\s]+/gi, "$1[REDACTED]"],
  [/(\b(?:password|secret|token|api[_-]?key|private[_-]?key|service[_-]?role[_-]?key)\b\s*[:=]\s*)[^\s,;}]+/gi, "$1[REDACTED]"],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]"],
];

export function redactSensitiveText(value) {
  let text = String(value ?? "");
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text.slice(0, MAX_TEXT_LENGTH);
}

function safeLocation(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value), typeof window === "undefined" ? "https://terminal.invalid" : window.location.origin);
    return url.origin === "https://terminal.invalid" || (typeof window !== "undefined" && url.origin === window.location.origin)
      ? url.pathname
      : url.hostname;
  } catch {
    return null;
  }
}

export function normalizeDiagnosticEvent(event = {}) {
  const error = event.error instanceof Error ? event.error : null;
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: ["runtime", "promise", "render", "manual"].includes(event.type) ? event.type : "runtime",
    message: redactSensitiveText(event.message || error?.message || "Unexpected application error"),
    source: safeLocation(event.source),
    line: Number.isFinite(Number(event.line)) ? Number(event.line) : null,
    column: Number.isFinite(Number(event.column)) ? Number(event.column) : null,
    stack: redactSensitiveText(event.stack || error?.stack || "") || null,
    occurredAt: event.occurredAt || new Date().toISOString(),
  };
}

export function captureRuntimeDiagnostic(event) {
  const diagnostic = normalizeDiagnosticEvent(event);
  diagnostics.unshift(diagnostic);
  diagnostics.splice(MAX_DIAGNOSTICS);
  return diagnostic;
}

export function getRuntimeDiagnostics(limit = 10) {
  return diagnostics.slice(0, Math.max(0, Math.min(Number(limit) || 10, MAX_DIAGNOSTICS)));
}

export function installRuntimeDiagnostics(windowRef = typeof window === "undefined" ? null : window) {
  if (!windowRef || installed) return () => {};
  installed = true;

  const onError = (event) => captureRuntimeDiagnostic({
    type: "runtime",
    message: event.message,
    error: event.error,
    source: event.filename,
    line: event.lineno,
    column: event.colno,
  });
  const onRejection = (event) => captureRuntimeDiagnostic({
    type: "promise",
    message: event.reason?.message || event.reason,
    error: event.reason instanceof Error ? event.reason : null,
    stack: event.reason?.stack,
  });

  windowRef.addEventListener("error", onError);
  windowRef.addEventListener("unhandledrejection", onRejection);
  return () => {
    windowRef.removeEventListener("error", onError);
    windowRef.removeEventListener("unhandledrejection", onRejection);
    installed = false;
  };
}
