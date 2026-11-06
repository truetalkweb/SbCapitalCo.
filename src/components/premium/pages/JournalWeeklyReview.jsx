import { useState } from 'react';
import { journalWeek } from '../../../utils/journalWeek.js';
import { money } from '../premiumWorkspaceData';
import { ActionButton, MetricTile, PremiumCard, PremiumTable } from '../PremiumWorkspacePrimitives';

export default function JournalWeeklyReview({ journalRows, reportingDay, theme }) {
  const [offset, setOffset] = useState(0);
  const [now] = useState(Date.now);
  const today = reportingDay.dayKey(now);
  const { from, through, stats, setups, followed, reviewed } = journalWeek(journalRows, reportingDay.dayKey, today, offset);

  return <PremiumCard theme={theme} title="Weekly trade review">
    <div style={{ display: 'grid', gap: 12, padding: 14, minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <ActionButton theme={theme} onClick={() => setOffset(value => value - 1)}>Previous week</ActionButton>
        <ActionButton theme={theme} disabled={offset === 0} onClick={() => setOffset(value => value + 1)}>Next week</ActionButton>
        <strong aria-live="polite">{from} through {through}</strong>
      </div>
      <p style={{ margin: 0 }}>USD results by close date in {reportingDay.timeZone}. Partial paper exits count individually. Drawdown measures the drop from the week's running peak in realized P&L.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <MetricTile theme={theme} label="Weekly net P&L" value={money(stats.net)} tone={stats.net < 0 ? 'bad' : 'neutral'} />
        <MetricTile theme={theme} label="Max realized drawdown" value={money(stats.maxDrawdown)} />
        <MetricTile theme={theme} label="Realized trades and exits" value={stats.total} />
        <MetricTile theme={theme} label="Plan followed" value={reviewed ? followed + ' of ' + reviewed : 'Unavailable'} detail="Trades with an explicit plan review" />
      </div>
      <PremiumTable theme={theme} rows={setups} keyField="setup" emptyMessage="No completed USD trades or exits for this week." columns={[
        { key: 'setup', label: 'Setup', width: '1fr' },
        { key: 'total', label: 'Trades and exits', width: '130px' },
        { key: 'net', label: 'Net P&L', width: '110px', render: row => money(row.net) },
      ]} />
    </div>
  </PremiumCard>;
}
