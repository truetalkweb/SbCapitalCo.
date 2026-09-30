import { memo, useEffect, useRef, useState } from 'react';
import { formatFlow } from './analytics.js';
import { useFeedContext } from './data/FeedContext.js';

function LiquidityHeatmap(ctx, books, candles, xFor, yFor, rowHeight, opacity, timeframe) {
  if (!books.length) return;
  let max = 1;
  for (const book of books) for (const level of book.levels) max = Math.max(max, level.bidSize + level.askSize);
  candles.forEach((candle, index) => {
    const nextTime = candles[index + 1]?.timestamp || candle.timestamp + timeframe;
    if (books.some(item => item.validUntil !== undefined && item.validUntil >= candle.timestamp && item.validUntil < nextTime)) return;
    const book = books.findLast(item => item.timestamp < nextTime);
    if (!book || (book.validUntil !== undefined && candle.timestamp >= book.validUntil)) return;
    for (const level of book.levels) {
      const size = level.bidSize + level.askSize;
      ctx.fillStyle = `rgba(${level.bidSize ? '20,155,128' : '204,133,46'},${Math.min(0.75, size / max * opacity)})`;
      ctx.fillRect(xFor(index) - 62, yFor(level.price) - rowHeight / 2, 124, rowHeight);
    }
  });
}

function FootprintCandle(ctx, candle, x, yFor, rowHeight, options) {
  const { mode, settings, width, decimals } = options;
  const positive = candle.close >= candle.open, color = positive ? settings.buyColor : settings.sellColor;
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x - width / 2 + 7, yFor(candle.high)); ctx.lineTo(x - width / 2 + 7, yFor(candle.low)); ctx.stroke();
  ctx.fillRect(x - width / 2 + 4, Math.min(yFor(candle.open), yFor(candle.close)), 6, Math.max(2, Math.abs(yFor(candle.open) - yFor(candle.close))));
  if (mode === 'candles') {
    ctx.fillRect(x - 12, Math.min(yFor(candle.open), yFor(candle.close)), 24, Math.max(2, Math.abs(yFor(candle.open) - yFor(candle.close))));
  } else {
    const maxVolume = Math.max(1, ...candle.levels.map(level => level.bidVolume + level.askVolume + (level.unknownVolume || 0)));
    candle.levels.forEach(level => {
      const y = yFor(level.price), volume = level.bidVolume + level.askVolume + (level.unknownVolume || 0);
      if (mode === 'profile') { ctx.fillStyle = `${color}70`; ctx.fillRect(x - width / 2 + 15, y - rowHeight / 2 + 1, volume / maxVolume * (width - 26), Math.max(1, rowHeight - 2)); }
      if (level.buyImbalance || level.sellImbalance) {
        ctx.fillStyle = `${level.buyImbalance ? settings.buyColor : settings.sellColor}20`;
        ctx.fillRect(x - width / 2 + 14, y - rowHeight / 2, width - 20, rowHeight);
      }
      if (Math.abs(level.price - candle.poc) < 0.000001) { ctx.strokeStyle = '#c8ac6b'; ctx.strokeRect(x - width / 2 + 14, y - rowHeight / 2 + 1, width - 20, Math.max(2, rowHeight - 2)); }
      if (rowHeight < settings.fontSize + 2) return;
      ctx.textAlign = 'center';
      if (mode === 'bidask') {
        ctx.fillStyle = level.sellImbalance ? settings.sellColor : '#b7c2cc'; ctx.fillText(formatFlow(level.bidVolume, settings.compact), x - 20, y + 4);
        ctx.fillStyle = '#526574'; ctx.fillText('×', x + 5, y + 4);
        ctx.fillStyle = level.buyImbalance ? settings.buyColor : '#b7c2cc'; ctx.fillText(formatFlow(level.askVolume, settings.compact), x + 30, y + 4);
      } else { ctx.fillStyle = mode === 'delta' ? level.delta >= 0 ? settings.buyColor : settings.sellColor : '#d3dce4'; ctx.fillText(formatFlow(mode === 'delta' ? level.delta : volume, settings.compact), x + 5, y + 4); }
    });
  }
  ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#8794a3';
  ctx.fillText(`V ${formatFlow(candle.volume)}`, x, options.height - 45);
  ctx.fillStyle = candle.delta >= 0 ? settings.buyColor : settings.sellColor; ctx.fillText(`Δ ${formatFlow(candle.delta)}`, x, options.height - 29);
  ctx.fillStyle = '#8794a3'; ctx.fillText(new Date(candle.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }), x, options.height - 12);
  ctx.font = `${settings.fontSize}px ui-monospace, monospace`;
  if (candle.unfinishedHigh || candle.unfinishedLow) { ctx.fillStyle = '#c8ac6b'; ctx.fillText('○', x + 48, yFor(candle.unfinishedHigh ? candle.high : candle.low) + 4); }
  if (candle.stackedBuy || candle.stackedSell) { ctx.fillStyle = candle.stackedBuy ? settings.buyColor : settings.sellColor; ctx.fillText(candle.stackedBuy ? '▲' : '▼', x, yFor(candle.high) - 9); }
  ctx.fillStyle = '#8794a3'; ctx.font = '9px ui-monospace, monospace'; ctx.fillText(candle.poc?.toFixed(decimals) || '', x, options.height - 62);
}

function FootprintChart({ flow, books, signals, settings, instrument, heatmap, mode, resetToken }) {
  const { simulated } = useFeedContext();
  const canvas = useRef(null), wrapper = useRef(null), geometry = useRef(null), pointer = useRef(null), dragging = useRef(null);
  const [size, setSize] = useState({ width: 900, height: 520 }), [view, setView] = useState({ count: 7, offset: 0, shift: 0 }), [hover, setHover] = useState(null);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(wrapper.current); return () => observer.disconnect();
  }, []);
  // The key on the parent resets pan/zoom when instrument or workspace is reset.
  useEffect(() => {
    const element = wrapper.current;
    const wheel = event => { event.preventDefault(); setView(current => ({ ...current, count: Math.max(3, Math.min(40, current.count + (event.deltaY > 0 ? 1 : -1))) })); };
    element.addEventListener('wheel', wheel, { passive: false }); return () => element.removeEventListener('wheel', wheel);
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const element = canvas.current, ctx = element.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = size; element.width = width * dpr; element.height = height * dpr; ctx.scale(dpr, dpr);
      ctx.fillStyle = settings.background; ctx.fillRect(0, 0, width, height);
      const end = Math.max(1, flow.candles.length - Math.round(view.offset)), candles = flow.candles.slice(Math.max(0, end - view.count), end);
      if (!candles.length) return;
      const step = instrument.tick * instrument.aggregation, plotHeight = height - 92, plotWidth = width - 150;
      const low = Math.min(...candles.map(c => c.low)) - step * 3 + view.shift * step;
      const high = Math.max(...candles.map(c => c.high)) + step * 3 + view.shift * step;
      const rowHeight = plotHeight / ((high - low) / step), yFor = price => 15 + (high - price) / (high - low) * plotHeight;
      const candleWidth = plotWidth / candles.length, xFor = index => candleWidth * (index + 0.5);
      geometry.current = { candles, yFor, xFor, high, low, plotHeight, candleWidth };
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, width, height - 73); ctx.clip();
      if (flow.metrics.valueHigh !== null) { ctx.fillStyle = '#8193a30b'; ctx.fillRect(0, yFor(flow.metrics.valueHigh), plotWidth, Math.max(1, yFor(flow.metrics.valueLow) - yFor(flow.metrics.valueHigh))); }
      ctx.font = '10px ui-monospace, monospace';
      const stride = Math.max(1, Math.ceil(24 / rowHeight));
      for (let key = Math.ceil(low / step); key <= high / step; key += stride) {
        const price = key * step, y = yFor(price);
        if (settings.grid) { ctx.strokeStyle = '#18242c'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
        ctx.textAlign = 'right'; ctx.fillStyle = '#8794a3'; ctx.fillText(price.toFixed(instrument.decimals), width - 8, y + 4);
      }
      if (heatmap) LiquidityHeatmap(ctx, books, candles, xFor, yFor, rowHeight, settings.opacity, flow.timeframe);
      ctx.font = `${settings.fontSize}px ui-monospace, monospace`;
      candles.forEach((c, i) => FootprintCandle(ctx, c, xFor(i), yFor, rowHeight, { mode, settings, width: Math.min(145, candleWidth - 6), decimals: instrument.decimals, height }));
      candles.forEach((c, i) => {
        const event = signals.find(s => s.timestamp === c.timestamp && /Absorption|Exhaustion/.test(s.type));
        if (event) { ctx.fillStyle = '#d6b56a'; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(event.type.includes('Absorption') ? 'A' : 'E', xFor(i) - 35, yFor(c.high) - 9); }
      });
      const maxProfile = Math.max(1, ...flow.profile.map(row => row.volume));
      for (const row of flow.profile) { ctx.fillStyle = row.price === flow.metrics.poc ? '#c8ac6b80' : '#53667750'; ctx.fillRect(plotWidth + 5, yFor(row.price) - rowHeight / 2, row.volume / maxProfile * 68, Math.max(1, rowHeight - 1)); }
      [[flow.metrics.poc, '#c8ac6b', 'SESSION POC'], [flow.metrics.vwap, '#3ca7d5', 'VWAP']].forEach(([price, color, label]) => {
        if (price == null) return; const y = yFor(price); ctx.strokeStyle = color; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(plotWidth, y); ctx.stroke(); ctx.setLineDash([]); ctx.textAlign = 'left'; ctx.fillStyle = color; ctx.font = '9px ui-monospace, monospace'; ctx.fillText(`${label} ${price.toFixed(instrument.decimals)}`, 7, y - 5);
      });
      if (pointer.current) { const { x, y } = pointer.current; ctx.strokeStyle = '#8193a3'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height - 73); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
      ctx.restore();
      // Candle totals and time scale sit outside the clipped price plot.
      candles.forEach((c, i) => { ctx.textAlign = 'center'; ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = '#8794a3'; ctx.fillText(`V ${formatFlow(c.volume)}`, xFor(i), height - 45); ctx.fillStyle = c.delta >= 0 ? settings.buyColor : settings.sellColor; ctx.fillText(`Δ ${formatFlow(c.delta)}`, xFor(i), height - 29); ctx.fillStyle = '#8794a3'; ctx.fillText(new Date(c.timestamp).toISOString().slice(11, 16), xFor(i), height - 12); });
    });
    return () => cancelAnimationFrame(frame);
  }, [flow, books, signals, settings, instrument, heatmap, mode, size, view, hover, resetToken]);
  function move(event) {
    const rect = wrapper.current.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
    if (dragging.current) { const dx = event.clientX - dragging.current.x, dy = event.clientY - dragging.current.y; dragging.current = { x: event.clientX, y: event.clientY }; setView(current => ({ ...current, offset: Math.min(Math.max(0, flow.candles.length - 3), Math.max(0, current.offset - dx / 80)), shift: current.shift + dy / 20 })); }
    pointer.current = { x, y }; const g = geometry.current;
    const c = g?.candles[Math.floor(x / g.candleWidth)];
    const price = g ? g.high - (y - 15) / g.plotHeight * (g.high - g.low) : 0;
    const level = c?.levels.find(row => Math.abs(row.price - price) <= instrument.tick * instrument.aggregation / 2);
    setHover(c ? { x, y, candle: c, price, level } : null);
  }
  return <div className="of-chart-wrap" ref={wrapper} onPointerMove={move} onPointerLeave={() => { pointer.current = null; setHover(null); }}
    onPointerDown={event => { dragging.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }}>
    <canvas ref={canvas} aria-label={simulated ? 'Simulated footprint chart' : 'Provider footprint chart'} role="img" />
    <div className="of-chart-tools"><button aria-label="Zoom in footprint" onPointerDown={event => event.stopPropagation()} onClick={() => setView(v => ({ ...v, count: Math.max(3, v.count - 1) }))}>+</button><button aria-label="Zoom out footprint" onPointerDown={event => event.stopPropagation()} onClick={() => setView(v => ({ ...v, count: Math.min(40, v.count + 1) }))}>−</button><button onPointerDown={event => event.stopPropagation()} onClick={() => setView({ count: 7, offset: 0, shift: 0 })}>Fit</button></div>
    {hover && <div className="of-tooltip" style={{ left: Math.max(0, Math.min(hover.x + 15, size.width - 240)), top: Math.max(0, Math.min(hover.y + 15, size.height - 170)) }}><b>{new Date(hover.candle.timestamp).toISOString().slice(11, 19)} UTC · {hover.price.toFixed(instrument.decimals)}</b><span>O {hover.candle.open.toFixed(instrument.decimals)} · C {hover.candle.close.toFixed(instrument.decimals)}</span><span>Volume {formatFlow(hover.candle.volume)} · Delta {formatFlow(hover.candle.delta)}</span><span>POC {hover.candle.poc.toFixed(instrument.decimals)}</span>{hover.level && <span>Bid {hover.level.bidVolume} × Ask {hover.level.askVolume} · Δ {hover.level.delta}</span>}{hover.candle.unfinishedHigh || hover.candle.unfinishedLow ? <span>○ Unfinished auction candidate</span> : null}</div>}
    <div className="of-chart-hint">Wheel zoom · drag pan · ○ unfinished auction · ▲/▼ stacked imbalance · A absorption / E exhaustion</div>
  </div>;
}
export default memo(FootprintChart);
