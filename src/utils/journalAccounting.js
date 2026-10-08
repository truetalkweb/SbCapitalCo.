import { parseNullableMarketNumber as number } from "./marketNumbers.js";
import { sumKnown } from "./portfolioAccounting.js";
import { getUsEquitySession, getNyDateParts } from './marketSession.js';

// Only explicit position identities are grouped. Legacy exits are never guessed
// together by symbol/date, since a trader may reopen a symbol many times.
export function groupJournalTrades(records = []) {
  const groups = new Map(), result = [];
  for (const raw of records) {
    const row = normalizeJournalRecord(raw);
    if (!row.eligible || !row.tradeGroupId || row.source !== 'Paper simulation' || row.groupedPosition === true) { result.push(row); continue; }
    const key = JSON.stringify([row.tradeGroupId, row.symbol, row.bias || row.side, row.currency]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  for (const exits of groups.values()) {
    exits.sort((a, b) => (a.timestamp ?? Infinity) - (b.timestamp ?? Infinity) || String(a.id).localeCompare(String(b.id)));
    const last = exits.at(-1), closed = exits.some(row => row.closesPosition);
    const quantity = exits.reduce((sum, row) => sum + (row.quantity || 0), 0);
    const weighted = key => quantity > 0 && exits.every(row => row[key] !== null)
      ? exits.reduce((sum, row) => sum + row[key] * row.quantity, 0) / quantity : null;
    result.push({ ...last, id: `group-${last.tradeGroupId}`, status: closed ? 'closed' : 'open',
      eligible: closed, pnl: sumKnown(exits.map(row => row.pnl)), fees: sumKnown(exits.map(row => row.fees)),
      quantity, entryPrice: weighted('entryPrice'), exitPrice: weighted('exitPrice'),
      groupedPosition: true, exitCount: exits.length,
      plannedRiskAmount: exits.every(row => number(row.plannedRiskAmount) > 0) ? Math.round(exits.reduce((sum, row) => sum + number(row.plannedRiskAmount), 0) * 1e6) / 1e6 : null,
      entryChecklistStatus: exits.some(row => row.entryChecklistStatus === 'incomplete') ? 'incomplete' : exits.every(row => row.entryChecklistStatus === 'complete') ? 'complete' : 'unknown',
      mistakeTags: [...new Set(exits.flatMap(row => String(row.mistakeTags || '').split(/[;,]/).map(tag => tag.trim()).filter(Boolean)))].join(', '),
      searchText: exits.map(row => [row.notes, row.review, row.tags, row.tag].join(' ')).join(' '),
      notes: `${exits.length} realized exit${exits.length === 1 ? '' : 's'} · ${closed ? 'Position closed' : 'Position still open'}`,
      openedAt: exits[0].openedAt || null, setup: exits[0].setup || 'Unspecified',
    });
  }
  return result;
}

export function journalBreakdowns(records = [], currency = 'USD') {
  const trades = groupJournalTrades(records).map(normalizeJournalRecord).filter(row => row.eligible && row.currency === currency);
  const buckets = dimension => {
    const groups = new Map();
    for (const trade of trades) {
      const label = dimension(trade);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(trade);
    }
    return [...groups].map(([label, rows]) => ({ label, ...journalStatistics(rows, currency) }));
  };
  // Analysis attributes the whole position to its initial entry, not each exit.
  const entryDate = row => { const timestamp = recordTimestamp(row.openedAt); return timestamp === null ? null : new Date(timestamp); };
  return {
    setup: buckets(row => String(row.setup || 'Unspecified').trim() || 'Unspecified'),
    time: buckets(row => {
      const date = entryDate(row); if (!date) return 'Entry time unknown';
      const { hour } = getNyDateParts(date);
      return `${String(hour).padStart(2, '0')}:00–${String(hour).padStart(2, '0')}:59 ET`;
    }),
    session: buckets(row => { const date = entryDate(row); return date ? getUsEquitySession(date).label : 'Entry session unknown'; }),
  };
}

export function recordTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : null;
}

export function normalizeJournalRecord(entry) {
  const explicit = number(entry.pnl ?? entry.netPnl ?? entry.resultAmount);
  const quantity = number(entry.quantity ?? entry.qty);
  const entryPrice = number(entry.entryPrice ?? entry.entry);
  const exitPrice = number(entry.exitPrice ?? entry.exit);
  const fees = number(entry.fees);
  const side = String(entry.bias || entry.side || "Long").toLowerCase();
  const kind = entry.recordType || (explicit !== null ? "trade" : "note");
  const status = entry.status || (kind === "trade" && explicit !== null ? "closed" : kind === "trade" ? "open" : "note");
  const canCalculate = kind === "trade" && status === "closed" && quantity > 0 && entryPrice > 0 && exitPrice > 0 && fees !== null && fees >= 0 && ["long", "short"].includes(side);
  const pnl = explicit ?? (canCalculate ? Math.round(((exitPrice - entryPrice) * quantity * (side === "short" ? -1 : 1) - fees) * 1e6) / 1e6 : null);
  return { ...entry, recordType: kind, status, pnl,
    plannedRiskAmount: number(entry.plannedRiskAmount) > 0 ? number(entry.plannedRiskAmount) : null,
    entryChecklistStatus: ['complete', 'incomplete'].includes(entry.entryChecklistStatus) ? entry.entryChecklistStatus : 'unknown',
    timestamp: recordTimestamp(entry.closedAt || entry.createdAt || entry.date),
    eligible: kind === "trade" && status === "closed" && pnl !== null,
    currency: String(entry.currency || "USD").toUpperCase(),
    source: entry.source || "Manual journal", quantity, entryPrice, exitPrice, fees,
  };
}

// All records participate before pagination; notes and open trades never affect returns.
export function journalStatistics(records = [], currency = "USD") {
  const normalized = records.map(normalizeJournalRecord);
  const trades = normalized.filter(row => row.eligible && row.currency === currency);
  const chronologyKnown = trades.every(row => row.timestamp !== null);
  const chronological = [...trades].sort((a, b) => a.timestamp - b.timestamp || String(a.id).localeCompare(String(b.id)));
  const values = chronological.map(row => row.pnl);
  const wins = values.filter(value => value > 0);
  const losses = values.filter(value => value < 0);
  const grossProfit = sumKnown(wins), grossLoss = -sumKnown(losses);
  let equity = 0, peak = 0, maxDrawdown = 0;
  const curve = chronologyKnown && trades.length ? [0, ...values.map(value => {
    equity = sumKnown([equity, value]); peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity); return equity;
  })] : [];
  const net = trades.length ? sumKnown(values) : null;
  const holdTimes = trades.map(row => {
    const opened = recordTimestamp(row.openedAt);
    return opened !== null && row.timestamp !== null && row.timestamp >= opened ? row.timestamp - opened : null;
  }).filter(value => value !== null);
  return { trades, values, curve, currency, total: trades.length,
    excluded: records.length - trades.length, wins: wins.length, losses: losses.length,
    breakeven: values.filter(value => value === 0).length, net,
    grossProfit: trades.length ? grossProfit : null, grossLoss: trades.length ? grossLoss : null,
    winRate: trades.length ? wins.length / trades.length * 100 : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    averageWin: wins.length ? grossProfit / wins.length : null,
    averageLoss: losses.length ? grossLoss / losses.length : null,
    expectancy: trades.length ? net / trades.length : null,
    best: trades.length ? Math.max(...values) : null, worst: trades.length ? Math.min(...values) : null,
    maxDrawdown: chronologyKnown && trades.length ? maxDrawdown : null,
    averageHoldMs: holdTimes.length ? sumKnown(holdTimes) / holdTimes.length : null, knownHoldCount: holdTimes.length,
  };
}
