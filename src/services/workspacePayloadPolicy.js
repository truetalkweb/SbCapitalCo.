export const MAX_WORKSPACE_BYTES = 2 * 1024 * 1024;

export function getWorkspacePayloadSize(payload) {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function isValidWorkspacePayload(payload) {
  return Boolean(
    payload
    && typeof payload === "object"
    && !Array.isArray(payload)
    && getWorkspacePayloadSize(payload) <= MAX_WORKSPACE_BYTES
  );
}
