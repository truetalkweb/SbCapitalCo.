import { useMemo, useState } from 'react';
import { journalCalendarDays } from '../../../utils/journalCalendar.js';
import { sumKnown } from '../../../utils/portfolioAccounting.js';
import { money } from '../premiumWorkspaceData';
import { ActionButton, PremiumCard, PremiumTable } from '../PremiumWorkspacePrimitives';
import './journalCalendar.css';

const monthName = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function JournalCalendar({ records, reportingDay, theme }) {
  const [month, setMonth] = useState(() => reportingDay.dayKey(Date.now()).slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(null);
  const { days, unknownDateCount } = useMemo(() => journalCalendarDays(records, reportingDay.dayKey), [records, reportingDay]);
  const first = new Date(month + '-01T00:00:00Z');
  const next = new Date(first);
  next.setUTCMonth(next.getUTCMonth() + 1, 0);
  const dayCount = next.getUTCDate();
  const monthDays = [...days].filter(([day]) => day.startsWith(month + '-'));
  const monthNet = monthDays.length ? sumKnown(monthDays.flatMap(([, day]) => day.trades.map(trade => trade.pnl))) : null;
  const selected = days.get(selectedDay);

  function moveMonth(offset) {
    const target = new Date(first);
    target.setUTCMonth(target.getUTCMonth() + offset);
    setMonth(target.toISOString().slice(0, 7));
    setSelectedDay(null);
  }

  return (
    <PremiumCard theme={theme} title="P&L Calendar">
      <div className="journal-calendar" style={{ '--calendar-border': theme.border, '--calendar-panel': theme.panel2, '--calendar-muted': theme.muted }}>
        <div className="journal-calendar-toolbar">
          <ActionButton theme={theme} onClick={() => moveMonth(-1)}>Previous month</ActionButton>
          <strong>{monthName.format(first)}</strong>
          <ActionButton theme={theme} onClick={() => moveMonth(1)}>Next month</ActionButton>
          <ActionButton theme={theme} onClick={() => { setMonth(reportingDay.dayKey(Date.now()).slice(0, 7)); setSelectedDay(null); }}>This month</ActionButton>
        </div>
        <p>Net realized USD P&L by close date in {reportingDay.timeZone}. Each paper exit counts on its own close date. Legacy records can use their recorded date.</p>
        <p aria-live="polite">{monthDays.length ? `${money(monthNet)} net · ${monthDays.length} trading days` : 'No realized USD P&L for this month.'}{unknownDateCount > 0 && ` · ${unknownDateCount} realized records have no date`}</p>
        <div className="journal-calendar-grid">
          {weekdays.map(day => <span key={day} className="journal-calendar-weekday">{day}</span>)}
          {Array.from({ length: first.getUTCDay() }, (_, index) => <span key={`blank-${index}`} />)}
          {Array.from({ length: dayCount }, (_, index) => {
            const date = index + 1;
            const key = month + '-' + String(date).padStart(2, '0');
            const day = days.get(key);
            if (!day) return <div className="journal-calendar-cell journal-calendar-empty" key={key}>{date}</div>;
            const netLabel = money(day.net);
            const count = `${day.trades.length} ${day.trades.length === 1 ? 'trade' : 'trades'}`;
            const color = day.net > 0 ? theme.green : day.net < 0 ? theme.red : theme.text;
            return (
              <button type="button" key={key} className="journal-calendar-cell" aria-label={`${key}, ${netLabel}, ${count}`} aria-pressed={selectedDay === key} onClick={() => setSelectedDay(key)} style={{ color, background: `color-mix(in srgb, ${color} 12%, ${theme.panel2})` }}>
                <span>{date}</span><strong>{netLabel}</strong><small>{count}</small>
              </button>
            );
          })}
        </div>
        {selected && <section aria-label={`Trades closed on ${selectedDay}`}>
          <h3>{selectedDay} · {money(selected.net)} net</h3>
          <PremiumTable theme={theme} keyField="id" rows={selected.trades} columns={[
            { key: 'symbol', label: 'Symbol', width: '95px', strong: true },
            { key: 'setup', label: 'Setup', width: '1fr' },
            { key: 'source', label: 'Source', width: '135px' },
            { key: 'fees', label: 'Fees', width: '100px', render: row => money(row.fees) },
            { key: 'pnl', label: 'Net P&L', width: '100px', render: row => money(row.pnl) },
          ]} />
        </section>}
      </div>
    </PremiumCard>
  );
}
