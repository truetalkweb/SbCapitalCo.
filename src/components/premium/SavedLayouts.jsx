import { useState } from 'react';
import { ActionButton, PremiumCard } from './PremiumWorkspacePrimitives';

export default function SavedLayouts({ layouts, activeId, unnamed, onChange, capture, apply, theme }) {
  const [name, setName] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const active = layouts.find(layout => layout.id === activeId);
  const label = name.trim();
  function save(duplicate = false) {
    const layout = { id: crypto.randomUUID(), name: label, snapshot: duplicate ? active.snapshot : capture() };
    onChange([...layouts, layout], layout.id, active ? undefined : layout.snapshot);
    if (duplicate) apply(layout.snapshot);
    setName('');
  }
  return <PremiumCard theme={theme} title="Saved Layouts">
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: 12 }}>
      <select aria-label="Saved layout" value={active?.id || ''} onChange={event => {
        const layout = layouts.find(item => item.id === event.target.value);
        setConfirmation(null);
        onChange(layouts, layout?.id || null, !active && layout ? capture() : undefined);
        if (layout) apply(layout.snapshot);
        else if (unnamed) apply(unnamed);
      }}>
        <option value="">Current workspace</option>
        {layouts.map(layout => <option key={layout.id} value={layout.id}>{layout.name}</option>)}
      </select>
      <input aria-label="Layout name" placeholder="Name this layout" maxLength={80} value={name} onChange={event => setName(event.target.value)} />
      <ActionButton theme={theme} disabled={!label || layouts.length >= 20} onClick={() => save()}>Save layout</ActionButton>
      <ActionButton theme={theme} disabled={!active || !label} onClick={() => {
        onChange(layouts.map(layout => layout.id === active.id ? { ...layout, name: label } : layout), active.id);
        setName('');
      }}>Rename layout</ActionButton>
      <ActionButton theme={theme} disabled={!active || !label || layouts.length >= 20} onClick={() => save(true)}>Duplicate layout</ActionButton>
      <ActionButton theme={theme} disabled={!active} onClick={() => setConfirmation('update')}>Update layout</ActionButton>
      <ActionButton theme={theme} disabled={!active} onClick={() => setConfirmation('delete')}>Delete layout</ActionButton>
      {active && <ActionButton theme={theme} onClick={() => apply(active.snapshot)}>Restore layout</ActionButton>}
      {confirmation && active && <div role="group" aria-label="Confirm layout change">
        <span>{confirmation === 'update' ? 'Replace the saved settings for ' : 'Delete the saved layout '}{active.name}? </span>
        <ActionButton theme={theme} onClick={() => {
          if (confirmation === 'update') onChange(layouts.map(layout => layout.id === active.id ? { ...layout, snapshot: capture() } : layout), active.id);
          else {
            onChange(layouts.filter(layout => layout.id !== active.id), null);
            if (unnamed) apply(unnamed);
          }
          setConfirmation(null);
        }}>Confirm {confirmation}</ActionButton>
        <ActionButton theme={theme} onClick={() => setConfirmation(null)}>Cancel</ActionButton>
      </div>}
      <small style={{ flexBasis: '100%', color: theme.muted }}>Try Market Overview with SPY and QQQ, Focused Chart with one chart, or Paper Trading with the order panel open.</small>
    </div>
  </PremiumCard>;
}
