import { journalStatistics, recordTimestamp } from './journalAccounting.js';

export function journalWeek(records, dayKey, today, offset = 0) {
  const start = new Date(today + 'T00:00:00Z');
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7) + offset * 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const from = start.toISOString().slice(0, 10);
  const through = end.toISOString().slice(0, 10);
  const stats = journalStatistics(records.filter(record => {
    const timestamp = recordTimestamp(record.closedAt || record.createdAt || record.date);
    if (timestamp === null) return false;
    const day = dayKey(timestamp);
    return day >= from && day <= through;
  }));
  const groups = new Map();
  let followed = 0, reviewed = 0;
  for (const trade of stats.trades) {
    const setup = trade.setup || 'Unspecified';
    if (!groups.has(setup)) groups.set(setup, []);
    groups.get(setup).push(trade);
    // Paper executions can represent several exits from one entry plan.
    if (trade.source === 'Paper simulation') continue;
    if (trade.planAdherence === 'Yes' || trade.planAdherence === 'No') reviewed++;
    if (trade.planAdherence === 'Yes') followed++;
  }
  const setups = [...groups].map(([setup, trades]) => {
    const { net, total } = journalStatistics(trades);
    return { setup, net, total };
  }).sort((a, b) => b.net - a.net);
  return { from, through, stats, setups, followed, reviewed };
}
