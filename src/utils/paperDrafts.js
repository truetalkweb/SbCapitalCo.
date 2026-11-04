export function normalizePaperDraft(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
  const symbol = String(draft.symbol || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.^-]{0,19}$/.test(symbol)) return null;
  const result = { symbol };
  for (const key of ['limitPrice', 'stopPrice', 'stopLoss', 'takeProfit', 'quantity', 'price']) {
    if (draft[key] === '') result[key] = '';
    else if (draft[key] != null && Number.isFinite(Number(draft[key])) && Number(draft[key]) >= 0 && Number(draft[key]) <= 1e9) result[key] = draft[key];
    else if (Object.hasOwn(draft, key)) result[key] = '';
  }
  for (const [key, max] of [['setup', 100], ['notes', 2000], ['id', 100]]) {
    if (draft[key] != null) result[key] = String(draft[key]).slice(0, max);
  }
  if (['BUY', 'SELL', 'SELL_SHORT', 'BUY_TO_COVER'].includes(draft.side)) result.side = draft.side;
  if (['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'].includes(draft.type)) result.type = draft.type;
  if (['DAY', 'GTC'].includes(draft.tif)) result.tif = draft.tif;
  return result;
}

export function updatePaperDrafts(drafts, incoming) {
  const normalized = normalizePaperDraft(incoming);
  if (!normalized) return drafts;
  const next = { ...drafts, [normalized.symbol]: { ...drafts[normalized.symbol], ...normalized } };
  const entries = Object.entries(next).filter(([symbol]) => symbol !== normalized.symbol).slice(-99);
  return Object.fromEntries([...entries, [normalized.symbol, next[normalized.symbol]]]);
}
