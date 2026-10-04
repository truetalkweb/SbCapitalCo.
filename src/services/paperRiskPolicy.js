export const PAPER_CHECKLIST = [
  ['plan', 'Setup and entry plan reviewed'],
  ['size', 'Position size and loss reviewed'],
  ['exit', 'Exit and stop plan reviewed'],
];
export function normalizePaperRiskPolicy(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid paper risk policy.');
  const policy = {};
  for (const key of ['maxOrderValue', 'riskPerTrade', 'dailyLossLimit']) {
    const value = raw[key] ?? 0;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e9) throw new Error('Paper risk limits must be numbers between zero and one billion.');
    policy[key] = value;
  }
  for (const key of ['requireStopLoss', 'checklistRequired']) {
    if (raw[key] !== undefined && typeof raw[key] !== 'boolean') throw new Error('Paper risk options must be true or false.');
    policy[key] = raw[key] ?? false;
  }
  return policy;
}
export function paperChecklistComplete(checklist) {
  return PAPER_CHECKLIST.every(([key]) => checklist?.[key] === true);
}
// Tightening a saved rule applies to waiting entries. Relaxing it cannot loosen
// the original order's accepted numeric caps. Closing commands remain allowed.
export function effectivePaperRisk(order = {}, policy = {}) {
  const result = { ...order, ...policy };
  for (const key of ['maxOrderValue', 'riskPerTrade', 'dailyLossLimit']) {
    const caps = [order[key], policy[key]].filter(value => value > 0);
    result[key] = caps.length ? Math.min(...caps) : 0;
  }
  return result;
}
