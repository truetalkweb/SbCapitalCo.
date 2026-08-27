import {
  MAX_WORKSPACE_BYTES,
  PERSISTED_WORKSPACE_FIELDS,
  isValidWorkspacePayload,
} from "./workspacePayloadPolicy.js";

export const WORKSPACE_BACKUP_MARKER = "sb-terminal-workspace-backup";
export const WORKSPACE_BACKUP_VERSION = 1;

const MAX_BACKUP_BYTES = MAX_WORKSPACE_BYTES + 64 * 1024;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function getUtf8Size(value) {
  try {
    return new TextEncoder().encode(value).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function sanitizeImportedWorkspace(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

  const sanitized = {};
  PERSISTED_WORKSPACE_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      sanitized[field] = cloneJson(payload[field]);
    }
  });

  return Object.keys(sanitized).length > 0 && isValidWorkspacePayload(sanitized)
    ? sanitized
    : null;
}

export function createWorkspaceBackup(payload, metadata = {}) {
  const sanitized = sanitizeImportedWorkspace(payload);
  if (!sanitized) return null;

  return {
    marker: WORKSPACE_BACKUP_MARKER,
    version: WORKSPACE_BACKUP_VERSION,
    exportedAt: metadata.exportedAt || new Date().toISOString(),
    product: "SbCapitalCo Terminal",
    payload: sanitized,
  };
}

export function serializeWorkspaceBackup(payload, metadata = {}) {
  const backup = createWorkspaceBackup(payload, metadata);
  return backup ? JSON.stringify(backup, null, 2) : null;
}

export function parseWorkspaceBackup(rawValue) {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return { ok: false, error: "Select a non-empty SbCapitalCo workspace backup." };
  }
  if (getUtf8Size(rawValue) > MAX_BACKUP_BYTES) {
    return { ok: false, error: "The workspace backup is larger than the supported 2 MB limit." };
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed?.marker !== WORKSPACE_BACKUP_MARKER) {
      return { ok: false, error: "This file is not an SbCapitalCo workspace backup." };
    }
    if (parsed?.version !== WORKSPACE_BACKUP_VERSION) {
      return { ok: false, error: "This workspace backup version is not supported." };
    }

    const payload = sanitizeImportedWorkspace(parsed.payload);
    if (!payload) {
      return { ok: false, error: "The workspace backup does not contain valid terminal data." };
    }

    return {
      ok: true,
      exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : null,
      fieldCount: Object.keys(payload).length,
      payload,
    };
  } catch {
    return { ok: false, error: "The workspace backup contains invalid JSON." };
  }
}
