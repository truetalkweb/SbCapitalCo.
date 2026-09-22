import { price, signed, valueClass } from './workstationFormat.js';

export default function PaperActivityView({ trading, tab }) {
  const fills = trading.orders.filter(row => row.engine === 'paper-v1' && row.status === 'FILLED');
  if (tab === 'pnl') return <table aria-label="Paper account P&L"><thead><tr><th>Metric</th><th>USD</th></tr></thead><tbody>{[
    ['Today realized', trading.dailyRealized], ['Total realized', trading.balances.realizedPnl],
    ['Open unrealized', trading.balances.unrealizedPnl], ['Equity', trading.balances.equity],
  ].map(([label, value]) => <tr key={label}><td>{label}</td><td className={valueClass(value)}>{value == null ? 'Unavailable' : signed(value)}</td></tr>)}</tbody></table>;
  if (tab === 'log') return <table aria-label="Paper realized exits"><thead><tr><th>Symbol</th><th>Side</th><th>Closed qty</th><th>Exit</th><th>Realized P&L</th></tr></thead><tbody>{trading.history.map(row => <tr key={row.id}><td>{row.symbol}</td><td>{row.bias}</td><td>{row.quantity}</td><td>{price(row.exitPrice)}</td><td className={valueClass(row.pnl)}>{signed(row.pnl)}</td></tr>)}{!trading.history.length && <tr><td colSpan={5}>No realized paper exits.</td></tr>}</tbody></table>;
  return <table aria-label="Paper executions"><thead><tr><th>Time (ET)</th><th>Symbol</th><th>Action</th><th>Filled</th><th>Price</th><th>Quote source</th></tr></thead><tbody>{fills.map(row => <tr key={row.id}><td>{new Date(row.filledAt).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false })}</td><td>{row.symbol}</td><td>{(row.action || row.side).replaceAll('_', ' ')}</td><td>{row.filled}</td><td>{price(row.price)}</td><td>{row.quoteSource} · {row.quoteQuality}</td></tr>)}{!fills.length && <tr><td colSpan={6}>No paper executions.</td></tr>}</tbody></table>;
}
