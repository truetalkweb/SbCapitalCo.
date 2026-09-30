import { memo, useState } from 'react';
import { formatFlow } from './analytics.js';
import { useFeedContext } from './data/FeedContext.js';

export const DOMLadder = memo(function DOMLadder({ book, trades, settings, instrument }) {
  const { simulated } = useFeedContext();
  const available = Boolean(book);
  book ||= { levels: [], bestAsk: null, bestBid: null };
  const middle = (book.bestAsk + book.bestBid) / 2, max = Math.max(1, ...book.levels.map(row => row.bidSize + row.askSize));
  const volume = new Map();
  for (const t of trades) { const v = volume.get(t.price) || { buy: 0, sell: 0 }; if (t.side === 'buy') v.buy += t.size; else if (t.side === 'sell') v.sell += t.size; volume.set(t.price, v); }
  const rows = book.levels.slice().sort((a, b) => Math.abs(a.price - middle) - Math.abs(b.price - middle)).slice(0, settings.depth).sort((a, b) => b.price - a.price);
  return <section className="of-panel of-dom" aria-label={simulated ? 'Simulated DOM ladder' : 'Provider DOM ladder'}><header><b>DOM / Price Ladder</b><small>{simulated ? 'SIM' : 'CME'} · {available ? `${rows.length} levels` : 'depth unavailable'}</small></header>
    <div className="of-table-scroll"><table><thead><tr>{['Bid', 'Orders', 'Price', 'Orders', 'Ask', 'T.Bid', 'T.Ask'].map((text, i) => <th key={i}>{text}</th>)}</tr></thead><tbody>{rows.map(row => {
      const last = trades.at(-1)?.price === row.price, traded = volume.get(row.price);
      return <tr key={row.price} className={last ? 'of-last-price' : ''} title={`Added ${row.added} · Pulled ${row.pulled} · ${row.bidSize + row.askSize >= max * 0.8 ? 'Large liquidity' : 'Depth'}`}>
        <td className={row.price === book.bestBid ? 'of-best-bid' : 'of-buy'} style={{ background: `linear-gradient(to left, ${settings.buyColor}28 ${row.bidSize / max * 100}%, transparent 0)` }}>{row.bidSize || '—'}</td><td>{row.bidOrders || '—'}</td><td className="of-price">{row.price.toFixed(instrument.decimals)}<i className={row.added > row.pulled ? 'of-added' : 'of-pulled'} aria-label={row.added > row.pulled ? 'Liquidity added' : 'Liquidity pulled'} /></td><td>{row.askOrders || '—'}</td><td className={row.price === book.bestAsk ? 'of-best-ask' : 'of-sell'} style={{ background: `linear-gradient(to right, ${settings.sellColor}28 ${row.askSize / max * 100}%, transparent 0)` }}>{row.askSize || '—'}</td><td className="of-sell">{formatFlow(traded?.sell || 0, settings.compact)}</td><td className="of-buy">{formatFlow(traded?.buy || 0, settings.compact)}</td>
      </tr>;
    })}</tbody></table>{!available && <p className="of-empty">No valid depth snapshot. Waiting for provider synchronization.</p>}</div><footer>● added / amber pulled · net size changes · execution disconnected</footer>
  </section>;
});

export const TimeAndSales = memo(function TimeAndSales({ trades, instrument, threshold }) {
  const { simulated } = useFeedContext();
  const [filter, setFilter] = useState('all'), [minimum, setMinimum] = useState(1);
  const cutoff = filter === 'all' ? 0 : filter === 'minimum' ? minimum : filter === 'large' ? threshold : threshold * 3;
  const rows = trades.filter(t => t.size >= cutoff).slice(-80).reverse();
  return <section className="of-panel of-tape" aria-label={simulated ? 'Simulated Time and Sales' : 'Provider Time and Sales'}><header><b>Time & Sales</b><small>{simulated ? 'SIM' : 'CME'} · exchange trades</small></header>
    <div className="of-tape-filters"><select aria-label="Tape filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All trades</option><option value="minimum">Minimum size</option><option value="large">Large trades</option><option value="block">Block-size trades</option></select><input aria-label="Minimum trade size" type="number" min="1" max="100000" value={minimum} onChange={e => { setMinimum(Math.max(1, Number(e.target.value))); setFilter('minimum'); }} /><small>Block-size ≥ {threshold * 3}; not a venue designation</small></div>
    <div className="of-table-scroll"><table><thead><tr><th>Time UTC</th><th>Price</th><th>Size</th><th>Side</th></tr></thead><tbody>{rows.map(t => <tr key={t.id} className={t.side === 'buy' ? 'of-buy' : t.side === 'sell' ? 'of-sell' : ''}><td>{new Date(t.timestamp).toISOString().slice(11, 19)}</td><td>{t.price.toFixed(instrument.decimals)}</td><td>{formatFlow(t.size, false)}</td><td>{t.side.toUpperCase()}</td></tr>)}</tbody></table>{!rows.length && <p className="of-empty">No trades meet the selected size.</p>}</div>
  </section>;
});

export const OrderFlowSignals = memo(function OrderFlowSignals({ signals }) {
  const { simulated } = useFeedContext();
  return <section className="of-panel of-signals" aria-label="Order flow signals"><header><b>Signal Engine</b><small>{simulated ? 'SIM' : 'CME'} · heuristic candidates</small></header><div className="of-signal-list">{signals.slice(0, 30).map(signal => <div key={signal.id} className="of-signal" title={signal.description}><time>{new Date(signal.timestamp).toISOString().slice(11, 19)}</time><b>{signal.type}</b><strong>{signal.strength}</strong><span>{signal.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span><p>{signal.description}</p></div>)}{!signals.length && <p className="of-empty">No events meet the configured thresholds.</p>}</div></section>;
});

function CumulativeDeltaChart({ points, buyColor, sellColor }) {
  const { simulated } = useFeedContext();
  const lo = Math.min(0, ...points.map(p => p.delta)), hi = Math.max(0, ...points.map(p => p.delta)), range = Math.max(1, hi - lo);
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${i / Math.max(1, points.length - 1) * 800} ${75 - (p.delta - lo) / range * 65}`).join(' ');
  return <svg className="of-cumulative" viewBox="0 0 800 90" preserveAspectRatio="none" role="img" aria-label={simulated ? 'Simulated cumulative delta line chart' : 'Provider cumulative delta line chart'}><line x1="0" x2="800" y1={75 - (0 - lo) / range * 65} y2={75 - (0 - lo) / range * 65} stroke="#273440" /><path d={path} fill="none" stroke={points.at(-1)?.delta >= 0 ? buyColor : sellColor} strokeWidth="1.7" vectorEffect="non-scaling-stroke" /></svg>;
}
export const OrderFlowAnalytics = memo(function OrderFlowAnalytics({ flow, book, trades, settings, instrument }) {
  const { simulated, metadata, quality } = useFeedContext();
  const m = flow.metrics, bids = book?.levels.reduce((n, r) => n + r.bidSize, 0) || 0, asks = book?.levels.reduce((n, r) => n + r.askSize, 0) || 0;
  const metrics = [['Current Delta', flow.candles.at(-1)?.delta ?? 0], ['Cumulative Delta', m.delta], ['Window Volume', m.volume], ['Buy Volume', m.buy], ['Sell Volume', m.sell], ['Delta %', `${m.deltaPercent.toFixed(1)}%`], ['POC', m.poc?.toFixed(instrument.decimals) ?? '—'], ['VWAP', m.vwap?.toFixed(instrument.decimals) ?? '—'], ['Open Interest', 'Unavailable'], ['Large Trades', trades.filter(t => t.size >= settings.largeTrade).length], ['Bid/Ask Ratio', asks ? `${(bids / asks).toFixed(2)}:1` : '—']];
  return <details className="of-panel of-analytics" open><summary>Order Flow Analytics <small>Retained {simulated ? 'simulated ' : ''}session window · volume in {metadata?.quantityUnit || 'units'} · {quality?.complete === false ? 'PARTIAL DELTA' : '70% value area'}</small></summary><div className="of-metrics">{metrics.map(([label, value]) => <div key={label}><span>{label}</span><strong>{!simulated && !trades.length ? '—' : typeof value === 'number' ? formatFlow(value, settings.compact) : value}</strong></div>)}</div><div className="of-delta-chart"><span>CUMULATIVE DELTA</span><CumulativeDeltaChart points={flow.cumulative} buyColor={settings.buyColor} sellColor={settings.sellColor} /><small>{flow.cumulative.length} bars · {trades.length.toLocaleString()} retained trades</small></div></details>;
});
