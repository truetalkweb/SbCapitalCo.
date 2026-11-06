import { ActionButton } from './PremiumWorkspacePrimitives';
import { useState } from 'react';

export default function WatchlistDestination({ collections, symbol, theme, sourceId }) {
  const [destination, setDestination] = useState('');
  const [message, setMessage] = useState('');
  const lists = collections.lists.filter(list => list.id !== sourceId);
  const target = lists.find(list => list.id === destination) || lists[0];
  const disabled = !target || !symbol;
  function add(move = false) {
    const alreadyPresent = target.symbols.includes(symbol);
    collections.transfer(symbol, target.id, move ? sourceId : null);
    setMessage(move ? symbol + ' moved to ' + target.name
      : symbol + (alreadyPresent ? ' is already in ' : ' added to ') + target.name);
  }
  return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
    <select aria-label="Destination watchlist" disabled={!target} value={target?.id || ''} onChange={event => { setDestination(event.target.value); setMessage(''); }}>
      {lists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
    </select>
    <ActionButton theme={theme} disabled={disabled} onClick={() => add()}>{sourceId ? 'Copy symbol' : 'Add to group'}</ActionButton>
    {sourceId && <ActionButton theme={theme} disabled={disabled} onClick={() => add(true)}>Move symbol</ActionButton>}
    {message && <span role="status">{message}</span>}
  </div>;
}
