export function marketEvidenceLabel({ source, quality, asOf } = {}) {
  const timestamp = typeof asOf === 'number' && Number.isFinite(asOf) ? new Date(asOf * 1000) : null;
  const verified = timestamp && Number.isFinite(timestamp.getTime())
    ? timestamp.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
    : 'Timestamp unavailable';
  return [source || 'Source unavailable', quality || 'Unavailable', verified].join(' · ');
}
