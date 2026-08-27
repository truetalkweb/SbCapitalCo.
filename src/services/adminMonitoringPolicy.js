const DEFAULT_ADMIN_MESSAGE = "Admin monitoring is temporarily unavailable.";

export function adminMonitoringMessage(status) {
  if (status === 401 || status === 403) {
    return "Admin access could not be verified. Sign in again and retry.";
  }
  return DEFAULT_ADMIN_MESSAGE;
}

export function adminMonitoringErrorMessage(error) {
  const message = String(error?.message || "");
  return message === adminMonitoringMessage(401)
    ? message
    : DEFAULT_ADMIN_MESSAGE;
}

export async function readAdminJsonResponse(response) {
  if (!response?.ok) {
    throw new Error(adminMonitoringMessage(response?.status));
  }

  const contentType = response.headers?.get?.("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(DEFAULT_ADMIN_MESSAGE);
  }

  try {
    return await response.json();
  } catch {
    throw new Error(DEFAULT_ADMIN_MESSAGE);
  }
}
