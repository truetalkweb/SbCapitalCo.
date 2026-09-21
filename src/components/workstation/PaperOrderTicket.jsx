import { useEffect, useId, useRef, useState } from 'react';
import { paperQuote } from '../../services/paperTradingEngine.js';
import { currency } from './workstationFormat.js';
import './paperTrading.css';

export default function PaperOrderTicket({ symbol, quote, quantity, setQuantity, trading, initialDraft = {}, defaultType = 'MARKET', onTypeChange, onMessage }) {
  const prefix = useId();
  const [side, setSide] = useState(initialDraft.side || 'BUY');
  const [type, setType] = useState(initialDraft.type || defaultType);
  const [limit, setLimit] = useState(initialDraft.limitPrice ?? (initialDraft.type === 'LIMIT' ? initialDraft.price : '') ?? '');
  const [stop, setStop] = useState(initialDraft.stopPrice ?? (initialDraft.type === 'STOP' ? initialDraft.price : '') ?? '');
  const [tif, setTif] = useState('DAY');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [feedback, setFeedback] = useState(null);
  const request = useRef(null);
  const receipt = useRef(null);
  const clear = () => { setFeedback(null); request.current = null; };
  const update = (setter, event) => { clear(); setter(event.target.value); };
  const fresh = paperQuote(quote);
  const draft = { symbol, side, type, quantity, limitPrice: limit, stopPrice: stop, stopLoss: side === 'BUY' ? stopLoss : '', takeProfit: side === 'BUY' ? takeProfit : '', tif };
  const fingerprint = JSON.stringify(draft);
  const currentOrder = feedback?.id ? trading.orders.find(order => order.id === feedback.id) : null;
  useEffect(() => { receipt.current?.scrollIntoView({ block: 'nearest' }); }, [feedback, currentOrder?.status]);
  const submit = event => {
    event.preventDefault();
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    const result = trading.submit({ ...draft, id: request.current.id });
    setFeedback(result.error ? { error: result.error } : { id: result.order.id });
    onMessage?.(result.error || `Paper ${result.order.status.toLowerCase()}: ${symbol}. ${result.order.reason || ''}`);
  };
  const field = (label, value, setter, required = false) => <label className="ws-paper-field">{label}<input aria-label={label} type="number" step="any" min="0.000001" value={value} required={required} onChange={event => update(setter, event)} /></label>;
  return <section className="ws-panel ws-ticket ws-paper-ticket" aria-label="Paper trade ticket">
    <div className="ws-paper-title"><strong>Paper Trade</strong><span>{symbol} · {trading.session === 'OPEN' ? 'Market open' : 'Session closed'}</span></div>
    <form onSubmit={submit} className="ws-paper-form">
      <div className="ws-side-toggle">{['BUY','SELL'].map(value => <button key={value} type="button" className={side === value ? value === 'BUY' ? 'is-buy' : 'is-sell' : ''} aria-pressed={side === value} onClick={() => { clear(); setSide(value); }}>{value === 'BUY' ? 'Buy' : 'Sell'}</button>)}</div>
      <div className="ws-paper-grid">
        <label className="ws-paper-field">Order type<select aria-label="Paper order type" value={type} onChange={event => { clear(); setType(event.target.value); onTypeChange?.(event.target.value); }}><option value="MARKET">Market</option><option value="LIMIT">Limit</option><option value="STOP">Stop market</option><option value="STOP_LIMIT">Stop limit</option></select></label>
        <label className="ws-paper-field" htmlFor={prefix}>Quantity<input id={prefix} aria-label="Paper quantity" type="number" step="1" min="1" required value={quantity ?? ''} onChange={event => { clear(); setQuantity?.(event.target.value); }} /></label>
        {['LIMIT','STOP_LIMIT'].includes(type) && field('Limit price', limit, setLimit, true)}
        {['STOP','STOP_LIMIT'].includes(type) && field('Stop trigger', stop, setStop, true)}
      </div>
      <details className="ws-paper-options"><summary>Duration & protection</summary><div className="ws-paper-grid">
        <label className="ws-paper-field">Duration<select aria-label="Paper duration" value={tif} onChange={event => update(setTif, event)}><option value="DAY">DAY</option><option value="GTC">GTC</option></select></label>
        {side === 'BUY' && <>{field('Stop loss', stopLoss, setStopLoss)}{field('Take profit', takeProfit, setTakeProfit)}</>}
      </div><small>{side === 'BUY' ? 'Optional linked exits activate after the buy fills. One exit cancels the other.' : 'Sells reduce your paper holdings. Short selling is not enabled.'}</small></details>
      <div className="ws-paper-meta">Buying power <b>{currency(trading.balances.buyingPower)}</b></div>
      <button type="submit" className={`ws-order-button ${side === 'SELL' ? 'is-sell' : ''}`} disabled={!trading.ready || Boolean(currentOrder)}>Place Paper {side === 'BUY' ? 'Buy' : 'Sell'}</button>
      {(feedback?.error || currentOrder) && <div ref={receipt} role="status" className="ws-paper-feedback">{feedback?.error || <><strong>{currentOrder.status.replaceAll('_',' ')}</strong> · {currentOrder.side} {currentOrder.filled || currentOrder.quantity} {currentOrder.symbol}{currentOrder.price ? ` @ ${currency(currentOrder.price)}` : ''}<br />{currentOrder.reason}</>}</div>}
      {currentOrder && <button type="button" className="ws-paper-new" onClick={clear}>New order</button>}
      <small className="ws-paper-note">Simulated fills · {fresh ? `${fresh.quality} quotes` : 'waiting for a fresh quote'}. Runs while this terminal is open and visible.</small>
    </form>
  </section>;
}
