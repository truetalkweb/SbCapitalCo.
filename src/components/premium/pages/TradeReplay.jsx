import { useEffect, useMemo, useState } from 'react';
import Chart from '../../Chart.jsx';
import { matchReplayFills } from '../../../utils/tradeReplay.js';
import { createDisplayClockFormatters } from '../../../utils/displayClock.js';
import { money } from '../premiumWorkspaceData';
import { ActionButton, PremiumCard } from '../PremiumWorkspacePrimitives';

const actions = { BUY: 'Buy', SELL: 'Sell', SELL_SHORT: 'Sell short', BUY_TO_COVER: 'Buy to cover' };

export default function TradeReplay({ trade, timeZone, theme, brokerApiUrl, onBack }) {
  const [dataset, setDataset] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [playing, setPlaying] = useState(false);
  const candles = useMemo(() => dataset?.candles || [], [dataset]);
  const firstFill = trade.fills[0].time;
  const firstBar = Math.floor(firstFill / trade.seconds) * trade.seconds;
  const entryIndex = candles.findIndex(bar => bar.time >= firstBar);
  const startIndex = entryIndex < 0 ? 0 : Math.max(0, entryIndex - 12);
  const index = cursor ?? startIndex;
  const lastIndex = Math.max(0, candles.length - 1);
  const reachedEnd = index >= lastIndex;
  const markers = useMemo(() => matchReplayFills(trade.fills, candles, trade.seconds).map(fill => ({
    ...fill, symbol: trade.symbol, label: actions[fill.action] + ' ' + fill.qty + ' @ ' + money(fill.price),
  })), [trade, candles]);
  const levels = useMemo(() => [
    { price: trade.tradePlan?.stopLoss, title: 'Original stop', color: '#ef5350' },
    { price: trade.tradePlan?.takeProfit, title: 'Original target', color: '#00a982' },
  ].filter(level => Number.isFinite(level.price) && level.price > 0), [trade]);
  const format = createDisplayClockFormatters(timeZone);
  const bar = candles[index];
  const dateLabel = timestamp => format.date.format(timestamp * 1000) + ' ' + format.time.format(timestamp * 1000);

  useEffect(() => {
    if (!playing || reachedEnd) return undefined;
    const timer = setTimeout(() => setCursor(index + 1), 350);
    return () => clearTimeout(timer);
  }, [index, playing, reachedEnd]);

  function receiveHistory(next) {
    setDataset(next);
    setCursor(null);
    setPlaying(false);
  }

  return <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
    <PremiumCard theme={theme} title={trade.symbol + ' · Trade Replay'} action={<ActionButton theme={theme} onClick={onBack}>Back to Journal</ActionButton>}>
      <div style={{ display: 'grid', gap: 10, padding: 12 }}>
        <div>Recorded paper trade · {trade.timeframe} historical candles{dataset?.source ? ' · ' + dataset.source + ' · ' + dataset.quality : ''}</div>
        <div>Original stop {money(trade.tradePlan?.stopLoss)} · Original target {money(trade.tradePlan?.takeProfit)}</div>
        {trade.tradePlan?.notes && <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{trade.tradePlan.notes}</div>}
        {trade.shortened && <div role="status">The trade exceeds the available request window. The chart shows the last 30 days of the requested period.</div>}
        {candles.length > 0 && markers.length < trade.fills.length && <div role="status">{trade.fills.length - markers.length} fills have no matching candle. Their recorded details are listed below.</div>}
        {candles.length > 0 && (entryIndex <= 0) && <div role="status">No pre-entry candles were returned for this window.</div>}
        {candles.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <ActionButton theme={theme} onClick={() => { setPlaying(false); setCursor(startIndex); }}>Restart</ActionButton>
          <ActionButton theme={theme} disabled={index === 0} onClick={() => { setPlaying(false); setCursor(index - 1); }}>Previous candle</ActionButton>
          <ActionButton theme={theme} disabled={reachedEnd} onClick={() => setPlaying(!playing)}>{playing && !reachedEnd ? 'Pause' : 'Play'}</ActionButton>
          <ActionButton theme={theme} disabled={reachedEnd} onClick={() => { setPlaying(false); setCursor(index + 1); }}>Next candle</ActionButton>
          <span>{bar ? dateLabel(bar.time) : 'Candle unavailable'} · {index + 1} / {candles.length}</span>
        </div>}
        <div style={{ height: 'clamp(320px, 55vh, 660px)', minWidth: 0 }}>
          <Chart symbol={trade.symbol} timeframe={trade.timeframe} brokerApiUrl={brokerApiUrl} timeZone={timeZone} isDark={theme.isDark}
            replayMode replayIndex={index} onReplayData={receiveHistory} replayTrades={markers}
            replayPriceLevels={levels} historyStart={trade.start} historyEnd={trade.end} />
        </div>
      </div>
    </PremiumCard>
    <PremiumCard theme={theme} title="Recorded fills">
      <ul style={{ margin: 0, padding: '12px 32px' }}>
        {trade.fills.map(fill => <li key={fill.id}>{dateLabel(fill.time)} · {actions[fill.action] || fill.action} {fill.qty} @ {money(fill.price)}</li>)}
      </ul>
    </PremiumCard>
  </div>;
}
