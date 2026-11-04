export default function TradePlanEditor({ symbol, draft = {}, onChange, theme }) {
  if (!onChange) return null;
  const update = (key, value) => onChange({ ...draft, symbol, [key]: value });
  const input = { width: '100%', minWidth: 0, boxSizing: 'border-box', background: theme.panel2, color: theme.text,
    border: `1px solid ${theme.border}`, borderRadius: 5, padding: 7, font: 'inherit' };
  const label = { display: 'grid', gap: 4, minWidth: 0 };
  return <section aria-label={`Trade plan for ${symbol}`} style={{ padding: 12, display: 'grid', gap: 10, fontSize: 11, color: theme.muted }}>
    <strong style={{ color: theme.text }}>Trade plan · {symbol}</strong>
    <label style={label}>Direction<select aria-label="Plan direction" style={input} value={draft.side === 'SELL_SHORT' ? 'SELL_SHORT' : 'BUY'} onChange={event => update('side', event.target.value)}><option value="BUY">Buy</option><option value="SELL_SHORT">Sell Short</option></select></label>
    <label style={label}>Setup<input aria-label="Plan setup" style={input} value={draft.setup || ''} maxLength={100} onChange={event => update('setup', event.target.value)} /></label>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {[['stopLoss', 'Plan stop loss'], ['takeProfit', 'Plan take profit']].map(([key, title]) => <label key={key} style={label}>{key === 'stopLoss' ? 'Stop loss' : 'Take profit'}<input aria-label={title} type="number" min="0.000001" step="any" style={input} value={draft[key] ?? ''} onChange={event => update(key, event.target.value)} /></label>)}
    </div>
    <label style={label}>Plan notes<textarea aria-label="Plan notes" style={{ ...input, resize: 'vertical' }} rows={3} maxLength={2000} value={draft.notes || ''} onChange={event => update('notes', event.target.value)} /></label>
    <small>Draft follows this symbol in this session. Review Order opens the paper ticket; it does not submit an order.</small>
  </section>;
}
