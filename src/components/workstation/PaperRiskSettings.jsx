import { useState } from 'react';

export default function PaperRiskSettings({ trading }) {
  const [draft, setDraft] = useState(() => ({ maxOrderValue: 0, riskPerTrade: 0, dailyLossLimit: 0,
    requireStopLoss: false, checklistRequired: false, ...(trading?.riskPolicy || trading?.legacyLimits) }));
  const [message, setMessage] = useState('');
  const save = async () => {
    const policy = { ...draft };
    for (const key of ['maxOrderValue', 'riskPerTrade', 'dailyLossLimit']) policy[key] = draft[key] === '' ? 0 : Number(draft[key]);
    const result = await trading.command({ kind: 'risk-policy', policy });
    setMessage(result.error || 'Paper rules saved on the server.');
  };
  return <div className="ws-paper-risk-settings" style={{ display: 'grid', gap: 10, padding: 14 }}>
    <strong>Paper risk rules</strong>
    <small>Saved rules apply across devices and to waiting entries. Zero disables a numeric cap. Sells, covers and cancellations remain available. Risk per entry includes stop distance, configured adverse slippage and one entry plus one stop-fill commission. Gaps and multiple exit fills can exceed the estimate; a stop fill price is not guaranteed.</small>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {[['maxOrderValue', 'Maximum order value ($)'], ['riskPerTrade', 'Risk per trade ($)'], ['dailyLossLimit', 'Daily realized loss limit ($)']].map(([key, label]) => <label key={key} className="ws-paper-field">{label}<input aria-label={label} type="number" min="0" max="1000000000" step="any" value={draft[key]} onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))} /></label>)}
    </div>
    {[['requireStopLoss', 'Require an attached stop loss'], ['checklistRequired', 'Require pre-trade checklist']].map(([key, label]) => <label key={key}><input type="checkbox" aria-label={label} checked={draft[key]} onChange={event => setDraft(current => ({ ...current, [key]: event.target.checked }))} /> {label}</label>)}
    <button type="button" className="ws-order-button" disabled={!trading?.ready || trading.busy} onClick={save}>Save Paper Rules</button>
    <small role="status">{message || (trading?.riskPolicy ? 'Using saved server rules.' : 'No server policy saved yet. Existing ticket limits remain active until you save rules.')}</small>
  </div>;
}
