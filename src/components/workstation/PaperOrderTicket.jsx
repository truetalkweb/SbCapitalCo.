import { useEffect, useId, useRef, useState } from 'react';
import { paperQuote, paperSellAvailability, paperCoverAvailability } from '../../services/paperTradingEngine.js';
import { currency } from './workstationFormat.js';
import './paperTrading.css';
const labels = { BUY: 'Buy', SELL: 'Sell', SELL_SHORT: 'Sell Short', BUY_TO_COVER: 'Buy to Cover' };

export default function PaperOrderTicket({ symbol, quote, quantity, setQuantity, trading, initialDraft = {}, defaultType = 'MARKET', onTypeChange, onMessage }) {
  const prefix = useId();
  const [side, setSide] = useState(initialDraft.action || initialDraft.side || (trading.positions?.[symbol]?.quantity < 0 ? 'BUY_TO_COVER' : 'BUY'));
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
  const isOpening = ['BUY', 'SELL_SHORT'].includes(side), isSell = ['SELL', 'SELL_SHORT'].includes(side);
  const available = side === 'BUY_TO_COVER' ? paperCoverAvailability(trading, symbol) : paperSellAvailability(trading, symbol);
  const draft = { symbol, side, type, quantity, limitPrice: limit, stopPrice: stop, stopLoss: isOpening ? stopLoss : '', takeProfit: isOpening ? takeProfit : '', tif };
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
      <div className="ws-side-toggle">{Object.entries(labels).map(([value, label]) => <button key={value} type="button" className={side === value ? ['BUY','BUY_TO_COVER'].includes(value) ? 'is-buy' : 'is-sell' : ''} aria-pressed={side === value} onClick={() => { clear(); setSide(value); }}>{label}</button>)}</div>
      <div className="ws-paper-fields">
      <div className="ws-paper-grid">
        <label className="ws-paper-field">Order type<select aria-label="Paper order type" value={type} onChange={event => { clear(); setType(event.target.value); onTypeChange?.(event.target.value); }}><option value="MARKET">Market</option><option value="LIMIT">Limit</option><option value="STOP">Stop market</option><option value="STOP_LIMIT">Stop limit</option></select></label>
        <label className="ws-paper-field" htmlFor={prefix}>Quantity<input id={prefix} aria-label="Paper quantity" type="number" step="1" min="1" required value={quantity ?? ''} onChange={event => { clear(); setQuantity?.(event.target.value); }} /></label>
        {['LIMIT','STOP_LIMIT'].includes(type) && field('Limit price', limit, setLimit, true)}
        {['STOP','STOP_LIMIT'].includes(type) && field('Stop trigger', stop, setStop, true)}
      </div>
      <details className="ws-paper-options"><summary>Duration & protection</summary><div className="ws-paper-grid">
        <label className="ws-paper-field">Duration<select aria-label="Paper duration" value={tif} onChange={event => update(setTif, event)}><option value="DAY">DAY</option><option value="GTC">GTC</option></select></label>
        {isOpening && <>{field('Stop loss', stopLoss, setStopLoss)}{field('Take profit', takeProfit, setTakeProfit)}</>}
      </div><small>{side === 'SELL_SHORT' ? 'Short stop above entry; target below. Entry value is reserved as paper collateral; short proceeds are restricted.' : side === 'BUY' ? 'Optional linked exits activate after entry. One exit cancels the other.' : side === 'BUY_TO_COVER' ? 'Closes short shares only. Cannot open a long position.' : 'Closes long shares only. Use Sell Short to open a short position.'}</small></details>
      <div className="ws-paper-meta">{!isOpening ? <>Available to {side === 'SELL' ? 'sell' : 'cover'} <b>{available.available} / {available.held} {symbol}</b></> : <>Buying power <b>{currency(trading.balances.buyingPower)}</b></>}</div>
      {side === 'SELL' && available.held === 0 && <div className="ws-paper-position-help">No {symbol} shares owned. <button type="button" onClick={() => { clear(); setSide('BUY'); }}>Switch to Buy</button></div>}
      {!isOpening && available.available > 0 && Number(quantity) > available.available && <button className="ws-paper-new" type="button" onClick={() => { clear(); setQuantity(available.available); }}>Use available quantity ({available.available})</button>}
      {(feedback?.error || currentOrder) && <div ref={receipt} role="status" className="ws-paper-feedback">{feedback?.error || <><strong>{currentOrder.status.replaceAll('_',' ')}</strong> · {(currentOrder.action || currentOrder.side).replaceAll('_',' ')} {currentOrder.filled || currentOrder.quantity} {currentOrder.symbol}{currentOrder.price ? ` @ ${currency(currentOrder.price)}` : ''}<br />{currentOrder.reason}</>}</div>}
      {currentOrder && <button type="button" className="ws-paper-new" onClick={clear}>New order</button>}
      </div>
      <button type="submit" className={`ws-order-button ${isSell ? 'is-sell' : ''}`} disabled={!trading.ready || Boolean(currentOrder)}>Place Paper {labels[side]}</button>
      <small className="ws-paper-note">Simulated fills · {fresh ? `${fresh.quality} quotes` : 'waiting for a fresh quote'}. Runs while this terminal is open and visible.</small>
    </form>
  </section>;
}
