import { groupJournalTrades, normalizeJournalRecord, journalStatistics } from './journalAccounting.js';
import { parseNullableMarketNumber } from './marketNumbers.js';
const knownRisk = row => { const risk = parseNullableMarketNumber(row.plannedRiskAmount); return risk > 0 ? risk : null; };
export function journalDiscipline(records = []) {
  const trades = groupJournalTrades(records).map(normalizeJournalRecord).filter(row => row.eligible && row.currency === 'USD');
  const summarize = (label, rows) => {
    const known = rows.filter(row => knownRisk(row) !== null);
    return { label, ...journalStatistics(rows), riskKnown: known.length,
      plannedRiskTotal: known.length ? known.reduce((sum, row) => sum + knownRisk(row), 0) : null,
      realizedLoss: known.length ? known.reduce((sum, row) => sum + Math.max(0, -row.pnl), 0) : null,
      exceededRisk: known.filter(row => -row.pnl > knownRisk(row) + 1e-6).length,
      averageR: known.length ? known.reduce((sum, row) => sum + row.pnl / knownRisk(row), 0) / known.length : null };
  };
  const buckets = labels => {
    const groups = new Map();
    for (const row of trades) for (const label of labels(row)) {
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(row);
    }
    return [...groups].map(([label, rows]) => summarize(label, rows));
  };
  return {
    risk: buckets(row => [knownRisk(row) === null ? 'Planned risk unknown' : -row.pnl > knownRisk(row) + 1e-6 ? 'Loss exceeded planned risk' : 'Within planned risk']),
    checklist: buckets(row => [row.entryChecklistStatus === 'complete' ? 'Recorded complete' : row.entryChecklistStatus === 'incomplete' ? 'Recorded incomplete' : 'Checklist unknown']),
    mistakes: buckets(row => { const tags = [...new Set(String(row.mistakeTags || '').split(/[;,]/).map(tag => tag.trim()).filter(Boolean))].slice(0, 50); return tags.length ? tags : ['No recorded mistake tags']; }),
  };
}
