import { isValidWorkspacePayload } from "./workspacePayloadPolicy.js";

export const WORKSPACE_FALLBACK_VERSION = 1;

const FALLBACK_MARKER = "sb-terminal-workspace";

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeForSerialization(value) {
  if (Array.isArray(value)) return value.map(normalizeForSerialization);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = normalizeForSerialization(value[key]);
      return result;
    }, {});
}

export function serializeWorkspacePayload(payload) {
  if (!isValidWorkspacePayload(payload)) return null;
  return JSON.stringify(normalizeForSerialization(payload));
}

export function getWorkspaceFingerprint(payload) {
  return serializeWorkspacePayload(payload);
}

export function getWorkspaceFallbackKey(userId) {
  return `sb_workspace_fallback:${String(userId || "").trim()}`;
}

export function getWorkspaceConflictKey(userId) {
  return `sb_workspace_conflict:${String(userId || "").trim()}`;
}

export function createWorkspaceFallbackEnvelope(payload, metadata = {}) {
  if (!isValidWorkspacePayload(payload)) return null;
  return {
    marker: FALLBACK_MARKER,
    version: WORKSPACE_FALLBACK_VERSION,
    revision: Math.max(0, Number(metadata.revision) || 0),
    savedAt: metadata.savedAt || new Date().toISOString(),
    payload: cloneJson(payload),
  };
}

export function parseWorkspaceFallback(rawValue) {
  if (!rawValue) return null;
  try {
    const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    if (parsed?.marker === FALLBACK_MARKER) {
      if (
        parsed?.version !== WORKSPACE_FALLBACK_VERSION
        || !isValidWorkspacePayload(parsed.payload)
      ) {
        return null;
      }
      return {
        payload: parsed.payload,
        revision: Math.max(0, Number(parsed.revision) || 0),
        savedAt: parsed.savedAt || null,
        legacy: false,
      };
    }
    return isValidWorkspacePayload(parsed)
      ? { payload: parsed, revision: 0, savedAt: null, legacy: true }
      : null;
  } catch {
    return null;
  }
}

export function loadWorkspaceFallback(storage, userId) {
  if (!storage || !userId) return null;
  try {
    return parseWorkspaceFallback(storage.getItem(getWorkspaceFallbackKey(userId)));
  } catch {
    return null;
  }
}

export function saveWorkspaceFallback(storage, userId, payload, metadata = {}) {
  if (!storage || !userId) return false;
  const envelope = createWorkspaceFallbackEnvelope(payload, metadata);
  if (!envelope) return false;
  try {
    storage.setItem(getWorkspaceFallbackKey(userId), JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function saveWorkspaceConflict(storage, userId, payload, conflictKeys = []) {
  if (!storage || !userId || !isValidWorkspacePayload(payload)) return false;
  try {
    storage.setItem(getWorkspaceConflictKey(userId), JSON.stringify({
      marker: FALLBACK_MARKER,
      version: WORKSPACE_FALLBACK_VERSION,
      savedAt: new Date().toISOString(),
      conflictKeys: [...new Set(conflictKeys)].sort(),
      payload: cloneJson(payload),
    }));
    return true;
  } catch {
    return false;
  }
}

function valuesMatch(left, right) {
  return JSON.stringify(normalizeForSerialization(left))
    === JSON.stringify(normalizeForSerialization(right));
}

export function reconcileWorkspacePayloads({ base = {}, local = {}, remote = {} }) {
  const merged = {};
  const conflictKeys = [];
  const keys = new Set([
    ...Object.keys(base || {}),
    ...Object.keys(local || {}),
    ...Object.keys(remote || {}),
  ]);

  [...keys].sort().forEach((key) => {
    const baseValue = base?.[key];
    const localValue = local?.[key];
    const remoteValue = remote?.[key];

    if (valuesMatch(localValue, remoteValue)) {
      if (localValue !== undefined) merged[key] = cloneJson(localValue);
      return;
    }
    if (valuesMatch(localValue, baseValue)) {
      if (remoteValue !== undefined) merged[key] = cloneJson(remoteValue);
      return;
    }
    if (valuesMatch(remoteValue, baseValue)) {
      if (localValue !== undefined) merged[key] = cloneJson(localValue);
      return;
    }

    conflictKeys.push(key);
    if (remoteValue !== undefined) merged[key] = cloneJson(remoteValue);
  });

  return { merged, conflictKeys };
}

export function getCloudSyncPresentation(code) {
  const states = {
    auth_required: { label: "Sign in required", tone: "warn" },
    conflict: { label: "Conflict reconciled", tone: "warn" },
    error: { label: "Local fallback", tone: "warn" },
    local: { label: "Local only", tone: "warn" },
    new: { label: "Ready to sync", tone: "neutral" },
    offline: { label: "Saved locally", tone: "warn" },
    restoring: { label: "Restoring", tone: "neutral" },
    saving: { label: "Saving", tone: "neutral" },
    synced: { label: "Synced", tone: "good" },
  };
  return states[code] || states.local;
}
