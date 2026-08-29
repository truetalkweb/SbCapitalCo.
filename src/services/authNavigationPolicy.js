const AUTH_QUERY_KEYS = [
  "access_token",
  "error",
  "error_code",
  "error_description",
  "refresh_token",
  "type",
];

export const AUTH_RECOVERY_MESSAGES = Object.freeze({
  expiredLink: "This authentication link is invalid or expired. Request a new link and try again.",
  restoreFailed: "The saved session could not be restored. Sign in again.",
  sessionEnded: "Your session ended. Sign in to continue.",
});

export function getSafeAuthErrorMessage(error, fallback = "Authentication failed. Try again.") {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("invalid login")) return "Email or password is incorrect.";
  if (message.includes("email not confirmed")) return "Confirm your email before signing in.";
  if (message.includes("password")) return "Use a password with at least 8 characters.";
  if (message.includes("rate limit")) return "Too many attempts. Wait briefly and try again.";
  return fallback;
}

export function getAuthEventRecovery(event, options = {}) {
  const initialized = Boolean(options.initialized);
  return {
    passwordRecovery: event === "PASSWORD_RECOVERY",
    restoreDestination: event === "SIGNED_IN",
    message: event === "SIGNED_OUT" && initialized ? AUTH_RECOVERY_MESSAGES.sessionEnded : "",
  };
}

export function getSafeAuthReturnPath(href, fallback = "/") {
  try {
    const url = new URL(href, "https://terminal.invalid");
    AUTH_QUERY_KEYS.forEach((key) => url.searchParams.delete(key));
    const hash = url.hash && !url.hash.includes("access_token") ? url.hash : "";
    return `${url.pathname}${url.search}${hash}` || fallback;
  } catch {
    return fallback;
  }
}

export function isSafeInternalReturnPath(destination) {
  return typeof destination === "string"
    && destination.startsWith("/")
    && !destination.startsWith("//");
}
