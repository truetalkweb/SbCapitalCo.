import { parseNullableMarketNumber as number } from "./marketNumbers.js";
import { sumKnown } from "./portfolioAccounting.js";

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
  };
}
