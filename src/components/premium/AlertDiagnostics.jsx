import { formatPacificDateTime } from '../../utils/timeFormatters.js';
import { money } from './premiumWorkspaceData.js';
import { useMarketClock } from '../../hooks/useMarketClock.js';
const time = value => value ? formatPacificDateTime(value) : 'Not recorded';
export default function AlertDiagnostics({ alert, background, theme, monitoringActive }) {
  const data = alert?.diagnostics;
  const now = useMarketClock();
  const overdue = data?.checkedAt && Number(now) - Date.parse(data.checkedAt) > 3 * (background?.worker?.intervalMs || 30000);
  const mode = !background?.enabled ? 'Browser monitoring' : background.paused || !monitoringActive ? 'Server paused' : alert?.status === 'Triggered' ? 'Triggered' : alert?.status === 'Paused' ? 'Rule paused' : !data ? 'Waiting for first server check' : overdue ? 'Awaiting next rule check' : data.state === 'watching' ? 'Watching target' : 'Waiting for fresh data';
  return <div aria-label="Selected alert diagnostics" style={{ color: theme.muted, display: 'grid', gap: 6, fontSize: 11 }}>
    <strong style={{ color: theme.text }}>{mode}</strong>
    {background?.enabled ? <>
      <span>Rule last checked (PT): {time(data?.checkedAt)}</span>
      <span>Last valid live quote (PT): {time(data?.lastValidQuoteAt)}{data?.lastValidPrice != null ? ` at ${money(data.lastValidPrice)}` : ''}</span>
      <span>Latest observed quote (PT): {time(data?.quoteTimestamp)} · {data?.quality || 'Unknown'} · {data?.source || 'Source unavailable'}</span>
      <span>{data?.reason || 'No evaluation recorded for this rule yet.'}</span>
      <span>Worker last scan (all accounts, PT): {time(background.worker?.lastScanAt)}</span>
      <span>Worker last scan without errors (PT): {time(background.worker?.lastSuccessAt)}</span>
      {background.worker?.error && <span>{background.worker.error}</span>}
      <span>Old scan/quote times are historical evidence, not proof monitoring is currently healthy. Rotating scans may check this rule later than the worker scan time.</span>
    </> : <span>Background diagnostics require server monitoring. Browser alerts require the terminal to stay open and visible.</span>}
  </div>;
}
