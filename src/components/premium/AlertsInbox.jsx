import { useState } from 'react';
import { createDisplayClockFormatters } from '../../utils/displayClock.js';
import { collectAlertEvents } from '../../utils/alertInbox.js';
import { money } from './premiumWorkspaceData';
import { ActionButton, PremiumCard } from './PremiumWorkspacePrimitives';
import WatchlistDestination from './WatchlistDestination';

export default function AlertsInbox({ alerts, background, timeZone, archived, readIds, markRead, collections, openChart, theme }) {
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const format = createDisplayClockFormatters(timeZone);
  const read = new Set(readIds);
  const events = new Map([...archived, ...collectAlertEvents(alerts)]
    .filter(event => event?.id && Number.isFinite(event.timestamp))
    .map(event => [event.id, event]));
  const unread = [...events.values()].filter(event => !read.has(event.id)).length;
  const visible = [...events.values()].filter(event => (!unreadOnly || !read.has(event.id))
    && [event.symbol, event.direction, event.trigger].join(' ').toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => b.timestamp - a.timestamp);
  return <PremiumCard theme={theme} title="Alerts Inbox">
    <div style={{ padding: 14, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input aria-label="Search alert events" placeholder="Symbol or trigger" value={search} onChange={event => setSearch(event.target.value)} />
        <label><input type="checkbox" checked={unreadOnly} onChange={event => setUnreadOnly(event.target.checked)} /> Unread only</label>
        <span role="status">{unread} unread</span>
        <ActionButton theme={theme} disabled={!visible.some(event => !read.has(event.id))} onClick={() => markRead(visible.map(event => event.id))}>Mark visible as read</ActionButton>
      </div>
      {background?.error && <div role="status">Server alert history is unavailable. Previously loaded events remain visible.</div>}
      {!visible.length && <div>{events.size ? 'No matching alert events.' : background?.error ? 'No alert history available.' : 'No triggered alerts yet.'}</div>}
      {visible.map(event => <article key={event.id} style={{ borderTop: '1px solid ' + theme.border, paddingTop: 8 }}>
        <strong>{event.symbol} · Price {event.direction} {money(event.trigger)}</strong>
        <div>{format.date.format(event.timestamp)} {format.time.format(event.timestamp)} · Trigger price {money(event.price)} · {read.has(event.id) ? 'Read' : 'Unread'}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          <ActionButton theme={theme} disabled={read.has(event.id)} onClick={() => markRead([event.id])}>Mark as read</ActionButton>
          <ActionButton theme={theme} onClick={() => { markRead([event.id]); openChart(event); }}>Open Chart</ActionButton>
          <WatchlistDestination key={event.symbol} collections={collections} symbol={event.symbol} theme={theme} />
        </div>
      </article>)}
    </div>
  </PremiumCard>;
}
