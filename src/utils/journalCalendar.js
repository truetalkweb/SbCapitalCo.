import { normalizeJournalRecord } from './journalAccounting.js';
import { sumKnown } from './portfolioAccounting.js';

export function createJournalDayFormatter(timeZone = 'America/New_York') {
  const options = { calendar: 'gregory', year: 'numeric', month: '2-digit', day: '2-digit' };
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone });
  } catch {
    formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'America/New_York' });
  }
  return {
    timeZone: formatter.resolvedOptions().timeZone,
    dayKey(timestamp) {
      const parts = formatter.formatToParts(timestamp);
      const value = type => parts.find(part => part.type === type).value;
      return [value('year').padStart(4, '0'), value('month'), value('day')].join('-');
    },
  };
}

export function journalCalendarDays(records, dayKey) {
  const byDay = new Map();
  let unknownDateCount = 0;
  for (const entry of records) {
    const trade = normalizeJournalRecord(entry);
    if (!trade.eligible || trade.currency !== 'USD') continue;
    if (trade.timestamp === null) {
      unknownDateCount += 1;
      continue;
    }
    const day = dayKey(trade.timestamp);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(trade);
  }
  const days = new Map([...byDay].map(([day, trades]) => {
    trades.sort((a, b) => b.timestamp - a.timestamp);
    return [day, { trades, net: sumKnown(trades.map(trade => trade.pnl)) }];
  }));
  return { days, unknownDateCount };
}
