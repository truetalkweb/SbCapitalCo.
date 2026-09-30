import { useEffect, useRef } from 'react';
export default function OrderFlowSettings({ settings, update, close }) {
  const dialog = useRef(null);
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close(); }, []);
  const fields = [['Imbalance ratio', 'ratio', 1.5, 20, 0.5], ['Minimum imbalance volume', 'minVolume', 1, 10000, 1], ['Stacked imbalance count', 'stacked', 2, 10, 1], ['Large trade threshold', 'largeTrade', 1, 10000, 1], ['DOM depth levels', 'depth', 10, 60, 2], ['Heatmap opacity', 'opacity', 0, 0.7, 0.05], ['Footprint font size', 'fontSize', 9, 16, 1]];
  return <dialog ref={dialog} className="of-settings" aria-labelledby="of-settings-title" onCancel={close}><header><h2 id="of-settings-title">Order Flow Settings</h2><button onClick={close} aria-label="Close order flow settings">×</button></header><p>Apply immediately to simulated analytics. Signals are heuristic candidates.</p>
    {fields.map(([label, key, min, max, step]) => <label key={key}>{label}<input type="number" aria-label={label} min={min} max={max} step={step} value={settings[key]} onChange={e => { const value = Number(e.target.value); if (Number.isFinite(value)) update(key, Math.min(max, Math.max(min, value))); }} /></label>)}
    {[['Buy / positive delta color', 'buyColor'], ['Sell / negative delta color', 'sellColor'], ['Chart background', 'background']].map(([label, key]) => <label key={key}>{label}<input type="color" value={settings[key]} onChange={e => update(key, e.target.value)} /></label>)}
    <label>Number formatting<select value={settings.compact ? 'compact' : 'full'} onChange={e => update('compact', e.target.value === 'compact')}><option value="compact">Compact</option><option value="full">Full numbers</option></select></label>
    <label>Session start UTC<input type="time" value={settings.sessionStart} onChange={e => update('sessionStart', e.target.value)} /></label><label>Session end UTC<input type="time" value={settings.sessionEnd} onChange={e => update('sessionEnd', e.target.value)} /></label><small>Custom session filters the retained demo timestamps; overnight windows are supported.</small>
    <label>Grid visible<input type="checkbox" checked={settings.grid} onChange={e => update('grid', e.target.checked)} /></label><label>Alert sounds<input type="checkbox" checked={settings.sounds} onChange={e => update('sounds', e.target.checked)} /></label><small>Sounds require enabling this switch. Large-trade candidates trigger a short tone while streaming.</small>
  </dialog>;
}
