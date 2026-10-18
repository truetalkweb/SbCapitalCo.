import { getCleanProviderMessage } from './healthStatus.js';
export function scannerCoverage(meta = {}) {
  const limited = Boolean(meta.providerStatus?.providerLimited) || /plan|quota|restricted|rate.limit/i.test(
    [meta.userMessage, meta.lastWarning, ...(meta.warnings || [])].filter(Boolean).join(' '));
  const partial = Boolean(meta.degraded || meta.fallback || meta.pending || limited || meta.coverage === 'bounded-universe' || meta.coverage === 'unavailable');
  return {
    partial,
    label: partial ? 'Partial scanner coverage' : 'Provider-reported coverage',
    detail: meta.coverageLabel || 'Available provider symbols only; full-market coverage is unverified.',
    warning: limited ? 'Provider plan limit active. Available symbols are a subset, not full-market rankings.'
      : getCleanProviderMessage(meta.userMessage || meta.lastWarning || meta.warnings?.[0], ''),
    snapshot: meta.pending ? 'Waiting for initial provider results.' : meta.cached ? 'Cached snapshot; row timestamps show quote freshness.' : 'Row timestamps show quote freshness.',
  };
}
