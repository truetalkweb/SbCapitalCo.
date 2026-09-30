export function getNewsStatusLabel(meta = {}) {
  if (meta.degraded) return 'NEWS FALLBACK';
  if (meta.cached) return 'NEWS CACHED';
  if (meta.providerStatus?.providerLimited || (meta.providerWarnings || []).length || meta.warning) return 'NEWS PROVIDER LIMITED';
  if (!(Number(meta.rowCount) > 0)) return 'NEWS PENDING';
  if (!meta.updatedAt || !Number.isFinite(Date.parse(meta.updatedAt))) return 'NEWS FRESHNESS UNKNOWN';
  const declared = meta.statusLabel || meta.providerStatus?.label;
  if (declared && !/\blive\b/i.test(declared)) return String(declared).startsWith('NEWS ') ? declared : `NEWS ${String(declared).toUpperCase()}`;
  return 'NEWS LIVE';
}

export function buildNewsMeta(meta, rows, now = Date.now()) {
  const fallbackRows = rows.filter(item => item.fallback).length;
  const parsed = typeof meta.updatedAt === 'string' ? Date.parse(meta.updatedAt) : NaN;
  const updatedAt = Number.isFinite(parsed) && parsed > 0 && parsed <= now + 5000 ? new Date(parsed).toISOString() : null;
  const result = { ...meta, source: meta.source || 'Backend News',
    degraded: Boolean(meta.degraded) || (rows.length > 0 && fallbackRows === rows.length), cached: Boolean(meta.cached), updatedAt,
    providerWarnings: Array.isArray(meta.providerWarnings) ? meta.providerWarnings : [],
    userWarnings: Array.isArray(meta.userWarnings) ? meta.userWarnings : [],
    fallbackRows, rowCount: rows.length };
  result.warning = meta.warning || result.providerWarnings[0] || null;
  result.userMessage = meta.userMessage || result.userWarnings[0] || null;
  const status = getNewsStatusLabel(result);
  result.confidenceLabel = status === 'NEWS LIVE' ? 'Live' : status === 'NEWS FRESHNESS UNKNOWN' ? 'Freshness unknown'
    : status === 'NEWS PENDING' ? 'Pending' : status === 'NEWS FALLBACK' ? 'Fallback Context' : status.replace(/^NEWS /, '');
  return result;
}
