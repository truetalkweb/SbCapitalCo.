import {
  MAX_WORKSPACE_BYTES,
  PERSISTED_WORKSPACE_FIELDS,
  isValidWorkspacePayload,
} from "./workspacePayloadPolicy.js";

export const WORKSPACE_BACKUP_MARKER = "sb-terminal-workspace-backup";
export const WORKSPACE_BACKUP_VERSION = 1;

export const MAX_BACKUP_BYTES = MAX_WORKSPACE_BYTES + 64 * 1024;
export const SERVER_PAPER_FIELDS = Object.freeze(['orders', 'positions', 'paperLedger', 'realizedPnL', 'maxOrderValue', 'dailyLossLimit', 'riskPerTrade']);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const strings = new Set(['selectedStock', 'secondarySymbol', 'timeframe', 'secondaryTimeframe', 'layoutMode', 'gridMode', 'tradingMode', 'marketRegion', 'themeMode', 'timeZone', 'scannerTab', 'activeScannerPreset', 'replayNotes', 'activePreset', 'activeWorkspace', 'rightTab']);
const arrays = new Set(['liveStocks', 'orderAuditTrail', 'alerts', 'scannerPresets', 'replayTrades', 'replayEquity', 'replayBookmarks', 'journalEntries']);
const objects = new Set(['additionalCharts', 'premiumPreferences', 'chartIndicators', 'replaySession', 'journalDraft', 'leftSectionsOpen', 'selectedScannerStock']);
function safeTree(value, depth = 0) {
  if (depth > 64) return false;
  if (!value || typeof value !== 'object') return true;
  return Object.entries(value).every(([key, item]) => !['__proto__', 'prototype', 'constructor'].includes(key) && safeTree(item, depth + 1));
}
function validField(field, value) {
  // Legacy paper snapshots are excluded from restoration, never trusted as account state.
  if (SERVER_PAPER_FIELDS.includes(field)) return true;
  if (strings.has(field)) return typeof value === 'string';
  if (field === 'replayEquity') return Array.isArray(value) && value.every(item => item === null || typeof item === 'number' && Number.isFinite(item));
  if (arrays.has(field)) return Array.isArray(value) && value.every(item => object(item));
  if (objects.has(field)) return object(value) || value === null && ['selectedScannerStock', 'replaySession'].includes(field);
  if (['syncCharts', 'replayMode'].includes(field)) return typeof value === 'boolean';
  if (field === 'quantity') return ['string', 'number'].includes(typeof value) && (value === '' || Number.isFinite(Number(value)) && Number(value) >= 0);
  if (['replaySpeed', 'replayIndex'].includes(field)) return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  return true;
}
function validNestedFields(payload) {
  if (payload.timeZone) { try { new Intl.DateTimeFormat('en', { timeZone: payload.timeZone }); } catch { return false; } }
  if (payload.liveStocks?.some(row => typeof row.symbol !== 'string' || !/^[A-Z0-9][A-Z0-9./:-]{0,13}$/i.test(row.symbol))) return false;
  const alertRows = new Set(payload.alerts || []);
  for (const row of [...(payload.journalEntries || []), ...(payload.alerts || []), ...(payload.scannerPresets || [])]) {
    if (typeof row.id !== 'string' || !row.id) return false;
    for (const [key, value] of Object.entries(row)) {
      if (['symbol', 'setup', 'notes', 'bias', 'name', 'status', 'recordType', 'currency', 'grade', 'direction', 'result', 'tags', 'emotion', 'review', 'source', 'plan', 'screenshotUrl', 'mistakeTags', 'followedPlan'].includes(key) && typeof value !== 'string') return false;
      if (key === 'history' && (!Array.isArray(value) || value.some(event => !object(event) || typeof event.direction !== 'string'))) return false;
    }
    if (alertRows.has(row) && (typeof row.active !== 'boolean' || !Number.isFinite(Number(row.trigger)) || Number(row.trigger) <= 0 || !['above', 'below'].includes(row.direction))) return false;
  }
  const draft = payload.journalDraft;
  if (draft && Object.entries(draft).some(([key, value]) => ['symbol', 'setup', 'bias', 'grade', 'tags', 'mistakeTags', 'emotion', 'review', 'notes', 'recordType', 'status', 'currency'].includes(key) ? typeof value !== 'string' : value !== null && typeof value === 'object')) return false;
  const preferences = payload.premiumPreferences;
  if (preferences) {
    for (const [key, value] of Object.entries(preferences)) {
      if (['notificationPreferences', 'paperCosts', 'scannerFilters'].includes(key) && !object(value)) return false;
      if (['defaultLandingTab', 'defaultOrderType', 'defaultTif', 'relativeVolumeThreshold', 'activeWatchlistId'].includes(key) && !['string', 'number'].includes(typeof value)) return false;
      if (['compactMode', 'scannerAutoRefresh', 'riskWarnings', 'hotkeysEnabled'].includes(key) && typeof value !== 'boolean') return false;
      if (key === 'watchlists' && (!Array.isArray(value) || value.some(row => !object(row) || !Array.isArray(row.symbols) || row.symbols.some(symbol => typeof symbol !== 'string')))) return false;
    }
    if (preferences.notificationPreferences && Object.values(preferences.notificationPreferences).some(value => typeof value !== 'boolean')) return false;
  }
  return true;
}
const sectionFields = {
  'Charts and layout': ['selectedStock', 'secondarySymbol', 'timeframe', 'secondaryTimeframe', 'layoutMode', 'gridMode', 'additionalCharts', 'syncCharts', 'chartIndicators'],
  'Watchlist symbols': ['liveStocks'],
  'Journal records and draft': ['journalEntries', 'journalDraft'],
  'Replay sessions, bookmarks and notes': ['replayMode', 'replaySpeed', 'replayIndex', 'replayTrades', 'replayEquity', 'replaySession', 'replayBookmarks', 'replayNotes'],
  'Browser alert rules': ['alerts'],
  'Preferences and saved watchlist collections': ['premiumPreferences', 'themeMode', 'timeZone', 'marketRegion', 'quantity', 'tradingMode'],
  'Scanner presets and selection': ['scannerTab', 'scannerPresets', 'activeScannerPreset', 'selectedScannerStock'],
  'Navigation and panels': ['activePreset', 'activeWorkspace', 'rightTab', 'leftSectionsOpen'],
  'Local activity history': ['orderAuditTrail'],
};

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
    && safeTree(sanitized) && Object.entries(sanitized).every(([field, value]) => validField(field, value)) && validNestedFields(sanitized)
    ? sanitized
    : null;
}

export function createWorkspaceBackup(payload, metadata = {}) {
  const prepared = prepareWorkspaceRestore(payload, { backgroundEnabled: Boolean(metadata.backgroundEnabled) });
  const sanitized = sanitizeImportedWorkspace(prepared.payload);
  if (!sanitized) return null;

  return {
    marker: WORKSPACE_BACKUP_MARKER,
    version: WORKSPACE_BACKUP_VERSION,
    exportedAt: metadata.exportedAt || new Date().toISOString(),
    product: "SbCapitalCo Terminal",
    excluded: prepared.excluded,
    payload: sanitized,
  };
}

export function prepareWorkspaceRestore(payload, { backgroundEnabled = true } = {}) {
  const copy = cloneJson(payload || {}), excluded = [];
  for (const field of [...SERVER_PAPER_FIELDS, ...(backgroundEnabled ? ['alerts'] : [])]) {
    if (Object.hasOwn(copy, field)) { delete copy[field]; excluded.push(field); }
  }
  const notifications = copy.premiumPreferences?.notificationPreferences;
  if (object(notifications) && Object.hasOwn(notifications, 'priceAlerts')) {
    delete notifications.priceAlerts; excluded.push('premiumPreferences.notificationPreferences.priceAlerts');
  }
  return { payload: copy, excluded, fieldCount: Object.keys(copy).length };
}

export async function readWorkspaceBackup(file, options = {}) {
  if (!file || typeof file.text !== 'function') throw new Error('Select a valid JSON workspace backup.');
  if (file.size > MAX_BACKUP_BYTES) throw new Error('The workspace backup is larger than the supported 2 MB limit.');
  const parsed = parseWorkspaceBackup(await file.text());
  if (!parsed.ok) throw new Error(parsed.error);
  const plan = prepareWorkspaceRestore(parsed.payload, options);
  if (!plan.fieldCount) throw new Error('This backup contains no restorable workspace fields. Server accounts are managed separately.');
  return { ...parsed, ...plan, sourcePayload: parsed.payload, fields: Object.keys(plan.payload), sections: Object.entries(sectionFields).filter(([, fields]) => fields.some(field => Object.hasOwn(plan.payload, field))).map(([label]) => label),
    counts: { journal: plan.payload.journalEntries?.length, watchlist: plan.payload.liveStocks?.length, browserAlerts: plan.payload.alerts?.length } };
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
