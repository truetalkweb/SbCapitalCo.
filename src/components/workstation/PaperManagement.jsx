import { useRef, useState } from 'react';
import { isWorkingPaperOrder } from '../../services/paperTradingEngine.js';
import './paperTrading.css';

export default function PaperManagement({ trading, symbol, orderId }) {
  const [mode, setMode] = useState('');
  const [feedback, setFeedback] = useState('');
  const request = useRef(null);
  const order = trading.orders.find(row => row.id === orderId);
  const position = trading.positions[symbol];
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [tif, setTif] = useState('DAY');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const choose = value => {
    setMode(value); setFeedback(''); request.current = null;
    setQuantity(order?.quantity ?? ''); setLimitPrice(order?.limitPrice ?? ''); setStopPrice(order?.stopPrice ?? ''); setTif(order?.tif || 'DAY');
  };
  const execute = async event => {
    event.preventDefault();
    const command = { kind: mode, symbol, orderId };
    if (mode === 'amend') command.changes = { quantity, limitPrice, stopPrice, tif };
    if (mode === 'protect') Object.assign(command, { stopLoss, takeProfit });
    if (mode === 'cancel-all') delete command.symbol;
    const fingerprint = JSON.stringify(command);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    const result = await trading.command({ ...command, id: request.current.id });
    setFeedback(result.error || (['close', 'flatten'].includes(mode) ? 'Close orders accepted. Check Orders for fill or queued status.' : 'Paper account updated.'));
    if (!result.error) setMode('');
  };
  const field = (label, value, setter) => <label className="ws-paper-field">{label}<input type="number" min="0" step="any" aria-label={label} value={value} onChange={event => setter(event.target.value)} /></label>;
  const description = {
    cancel: 'Cancel the selected working paper order.',
    'cancel-all': 'Cancel every working paper order, including protective exits. Positions stay open.',
    close: `Cancel working ${symbol} orders and submit a market close for all ${Math.abs(position?.quantity || 0)} shares.`,
    flatten: 'Cancel all working paper orders and submit market closes for every open paper position.',
    amend: 'Replace the selected working order. The original is cancelled only if the replacement is valid.',
    protect: `Replace linked exits for all ${Math.abs(position?.quantity || 0)} ${symbol} shares.`,
  };
  return <section className="ws-paper-management" aria-label="Paper account management">
    <div className="ws-paper-management-actions">
      <button disabled={!trading.ready || trading.busy || !isWorkingPaperOrder(order)} onClick={() => choose('cancel')}>Cancel selected</button>
      <button disabled={!trading.ready || trading.busy || !isWorkingPaperOrder(order) || Boolean(order?.triggeredAt)} onClick={() => choose('amend')}>Edit order</button>
      <button disabled={!trading.ready || trading.busy || !position?.quantity} onClick={() => choose('protect')}>Edit protection</button>
      <button disabled={!trading.ready || trading.busy || !position?.quantity} onClick={() => choose('close')}>Close {symbol}</button>
      <button disabled={!trading.ready || trading.busy || !trading.orders.some(isWorkingPaperOrder)} onClick={() => choose('cancel-all')}>Cancel all orders</button>
      <button disabled={!trading.ready || trading.busy || !Object.keys(trading.positions).length} onClick={() => choose('flatten')}>Flatten paper account</button>
    </div>
    {mode && <form onSubmit={execute} className="ws-paper-management-form">
      <p>{description[mode]} {['close', 'flatten'].includes(mode) && 'Outside regular hours, closes wait for the next session and a fresh quote.'}</p>
      {mode === 'amend' && <div className="ws-paper-grid">
        {!order?.parentId && field('Edited quantity', quantity, setQuantity)}
        {['LIMIT', 'STOP_LIMIT'].includes(order?.type) && field('Edited limit price', limitPrice, setLimitPrice)}
        {['STOP', 'STOP_LIMIT'].includes(order?.type) && field('Edited stop trigger', stopPrice, setStopPrice)}
        <label className="ws-paper-field">Duration<select aria-label="Edited duration" value={tif} onChange={event => setTif(event.target.value)}><option>DAY</option><option>GTC</option></select></label>
      </div>}
      {mode === 'protect' && <div className="ws-paper-grid">{field('Position stop loss', stopLoss, setStopLoss)}{field('Position take profit', takeProfit, setTakeProfit)}</div>}
      <div className="ws-paper-management-actions"><button type="submit" disabled={!trading.ready || trading.busy}>Confirm paper action</button><button type="button" disabled={trading.busy} onClick={() => setMode('')}>Dismiss</button></div>
    </form>}
    {(feedback || trading.error) && <p role="status">{feedback || trading.error}</p>}
    <small>Today’s realized P&amp;L: ${trading.dailyRealized?.toFixed(2)} · Total realized: ${trading.balances.realizedPnl?.toFixed(2)}</small>
  </section>;
}
