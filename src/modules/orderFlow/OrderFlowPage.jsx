import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Maximize2, Pause, Play, RotateCcw, Settings } from 'lucide-react';
import { DEFAULT_SETTINGS, inSession, INSTRUMENTS } from './analytics.js';
import { MockMarketDataProvider } from './MockMarketDataProvider.js';
import { CmeMarketDataProvider } from './data/CmeMarketDataProvider.js';
import { CME_ROOTS } from './data/instruments.js';
import { buildOrderFlowAnalysis, selectReplayBook, selectReplayBooks } from './data/analyticsPipeline.js';
import { FeedContext } from './data/FeedContext.js';
import FootprintChart from './FootprintChart.jsx';
import { DOMLadder, OrderFlowAnalytics, OrderFlowSignals, TimeAndSales } from './OrderFlowPanels.jsx';
import OrderFlowSettings from './OrderFlowSettings.jsx';
import './orderFlow.css';

function loadSettings() {
  try { const saved = JSON.parse(localStorage.getItem('sb_order_flow_settings_v1') || '{}');
    const next = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(next)) if (typeof saved[key] === typeof next[key] && (typeof next[key] !== 'number' || Number.isFinite(saved[key]))) next[key] = saved[key];
    for (const [key, min, max] of [['ratio', 1.5, 20], ['minVolume', 1, 10000], ['stacked', 2, 10], ['largeTrade', 1, 10000], ['depth', 10, 60], ['opacity', 0, 0.7], ['fontSize', 9, 16]]) next[key] = Math.max(min, Math.min(max, next[key]));
    for (const key of ['buyColor', 'sellColor', 'background']) if (!/^#[0-9a-f]{6}$/i.test(next[key])) next[key] = DEFAULT_SETTINGS[key];
    for (const key of ['sessionStart', 'sessionEnd']) if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(next[key])) next[key] = DEFAULT_SETTINGS[key];
    return next;
  } catch { return DEFAULT_SETTINGS; }
}
const createDefaultProvider = options => options.feed === 'cme' ? new CmeMarketDataProvider(options) : new MockMarketDataProvider(options);
export default function OrderFlowPage({ createProvider = createDefaultProvider }) {
  const [feed, setFeed] = useState('mock');
  const [symbol, setSymbol] = useState('ES'), [resetToken, setResetToken] = useState(0), [settings, setSettings] = useState(loadSettings);
  const [mode, setMode] = useState('simulation'), [paused, setPaused] = useState(false), [timeframe, setTimeframe] = useState(60000), [aggregation, setAggregation] = useState(2);
  const [chartMode, setChartMode] = useState('bidask'), [heatmap, setHeatmap] = useState(true), [session, setSession] = useState('all'), [layout, setLayout] = useState('full'), [drawer, setDrawer] = useState(false);
  const [replayIndex, setReplayIndex] = useState(null), [replayPlaying, setReplayPlaying] = useState(false), [replaySpeed, setReplaySpeed] = useState(1), [statusMessage, setStatusMessage] = useState('');
  const root = useRef(null), audio = useRef(null), lastAlert = useRef(0), replayCursor = useRef(null);
  const provider = useMemo(() => createProvider({ symbol, feed, seed: 17 + resetToken }), [symbol, feed, resetToken, createProvider]);
  const snapshot = useSyncExternalStore(provider.subscribe, provider.getSnapshot);
  const instrument = useMemo(() => ({ ...INSTRUMENTS[symbol], tick: snapshot.metadata?.tickSize || INSTRUMENTS[symbol].tick,
    decimals: snapshot.metadata?.pricePrecision ?? INSTRUMENTS[symbol].decimals, aggregation }), [symbol, aggregation, snapshot.metadata]);
  const simulated = snapshot.simulated, provenance = simulated ? 'SIM' : 'CME';
  useEffect(() => {
    provider.subscribeTrades(symbol); provider.subscribeOrderBook(symbol);
    if (mode === 'simulation' && !paused) provider.connect().catch(() => setStatusMessage('The market data connection failed. Pause and resume to retry.'));
    return () => provider.unsubscribe(symbol);
  }, [provider, mode, paused, symbol]);
  useEffect(() => { try { localStorage.setItem('sb_order_flow_settings_v1', JSON.stringify(settings)); } catch { /* Session-only settings if storage is unavailable. */ } }, [settings]);
  const replayComplete = replayIndex !== null && replayIndex >= snapshot.trades.length - 1;
  useEffect(() => { replayCursor.current = replayIndex; }, [replayIndex]);
  useEffect(() => {
    if (mode !== 'replay' || !replayPlaying || replayComplete || !snapshot.trades.length) return;
    const startIndex = replayCursor.current ?? 0, startTime = snapshot.trades[startIndex].timestamp, startedAt = performance.now();
    const timer = setInterval(() => {
      const target = startTime + (performance.now() - startedAt) * replaySpeed;
      let low = startIndex, high = snapshot.trades.length - 1;
      while (low < high) { const middle = Math.ceil((low + high) / 2); if (snapshot.trades[middle].timestamp <= target) low = middle; else high = middle - 1; }
      setReplayIndex(low);
    }, 100);
    return () => clearInterval(timer);
  }, [mode, replayPlaying, replaySpeed, snapshot.trades, replayComplete]);
  useEffect(() => () => { audio.current?.close(); }, []);
  const replayAt = mode === 'replay' ? replayIndex ?? snapshot.trades.length - 1 : snapshot.trades.length - 1;
  const trades = useMemo(() => snapshot.trades.slice(0, replayAt + 1).filter(t => session === 'all' || inSession(t.timestamp, settings.sessionStart, settings.sessionEnd)), [snapshot.trades, replayAt, session, settings.sessionStart, settings.sessionEnd]);
  const lastTime = mode === 'replay' ? trades.at(-1)?.timestamp ?? 0 : snapshot.timestamp ?? 0;
  const replayTrade = trades.at(-1);
  const books = useMemo(() => mode === 'replay' ? selectReplayBooks(snapshot.books, replayTrade) : snapshot.books.filter(book => book.timestamp <= lastTime), [snapshot.books, lastTime, mode, replayTrade]);
  const book = mode === 'replay' ? selectReplayBook(books, replayTrade)
    : Object.hasOwn(snapshot, 'currentBook') ? snapshot.currentBook : books.at(-1);
  const analysis = useMemo(() => buildOrderFlowAnalysis({ trades, tick: instrument.tick, timeframe, aggregation, settings, simulated, quality: snapshot.quality }), [trades, instrument.tick, timeframe, aggregation, settings, simulated, snapshot.quality]);
  const { flow, signals } = analysis;
  useEffect(() => {
    const latest = trades.at(-1);
    if (!settings.sounds || mode !== 'simulation' || paused || !latest || latest.id === lastAlert.current) return;
    lastAlert.current = latest.id;
    if (latest.size < settings.largeTrade || !audio.current) return;
    const ctx = audio.current; if (ctx.state !== 'running') return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain(); oscillator.frequency.value = latest.side === 'buy' ? 660 : 440;
    gain.gain.setValueAtTime(0.03, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + 0.13);
  }, [trades, settings.sounds, settings.largeTrade, mode, paused]);
  const update = useCallback((key, value) => {
    if (key === 'sounds' && value && !audio.current) { const Audio = window.AudioContext || window.webkitAudioContext; if (Audio) { audio.current = new Audio(); audio.current.resume(); } }
    setSettings(current => ({ ...current, [key]: value }));
  }, []);
  function reset() { setResetToken(value => value + 1); setSettings(DEFAULT_SETTINGS); setMode('simulation'); setPaused(false); setReplayPlaying(false); setReplayIndex(null); setAggregation(2); setTimeframe(60000); setSession('all'); setLayout('full'); setChartMode('bidask'); setHeatmap(true); }
  const chart = <section className="of-panel of-footprint" aria-label="Footprint workspace"><header><b>{symbol} · Footprint / Cluster</b><div className="of-chart-modes">{[['bidask', 'Bid × Ask'], ['delta', 'Delta'], ['volume', 'Volume'], ['profile', 'Profile'], ['candles', 'Candles']].map(([value, label]) => <button key={value} aria-pressed={chartMode === value} onClick={() => setChartMode(value)}>{label}</button>)}</div></header><FootprintChart key={`${feed}:${symbol}:${resetToken}`} flow={flow} books={books} signals={signals} settings={settings} instrument={instrument} heatmap={heatmap} mode={chartMode} resetToken={resetToken} /><footer>{simulated ? 'SIMULATED' : 'CME'} {symbol} · {instrument.tick} tick · Candle POC gold / Session POC dashed · {flow.candles.length} bars · {trades.length} trades</footer></section>;
  return <FeedContext value={{ simulated, status: snapshot.status, source: snapshot.source, metadata: snapshot.metadata, quality: analysis.quality }}><div className="of-workspace" ref={root} style={{ '--of-buy': settings.buyColor, '--of-sell': settings.sellColor }}>
    <div className="of-toolbar" role="toolbar" aria-label="Order flow toolbar">
      <label>Instrument<select aria-label="Order flow symbol" value={symbol} onChange={e => { setSymbol(e.target.value); setReplayIndex(null); setReplayPlaying(false); setPaused(false); setMode('simulation'); }}>{Object.keys(feed === 'cme' ? CME_ROOTS : INSTRUMENTS).map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Feed<select aria-label="Order flow provider" value={feed} onChange={e => { setFeed(e.target.value); if (e.target.value === 'cme' && !CME_ROOTS[symbol]) setSymbol('ES'); setMode('simulation'); setReplayPlaying(false); setReplayIndex(null); setPaused(false); }}><option value="mock">{instrument.exchange} · Simulator</option><option value="cme">CME bridge · not configured</option>{['Rithmic', 'CQG', 'CME direct', 'Interactive Brokers', 'Binance', 'Coinbase'].map(p => <option key={p} disabled>{p} — not connected</option>)}</select></label>
      <span className={`of-connection ${snapshot.status === 'connected' ? 'is-connected' : ''}`} role="status"><i />{mode === 'replay' ? `${provenance} REPLAY` : paused ? `${provenance} PAUSED` : simulated && snapshot.status === 'connected' ? 'SIM CONNECTED' : simulated ? 'SIM DISCONNECTED' : `${provenance} ${snapshot.status.toUpperCase()}`}</span>
      <label>Mode<select aria-label="Order flow mode" value={mode} onChange={e => { setMode(e.target.value); setReplayIndex(Math.max(0, snapshot.trades.length - 600)); setReplayPlaying(false); }}><option value="simulation">Stream · {provenance}</option><option value="replay" disabled={!snapshot.trades.length}>Replay · {provenance}</option><option disabled value="live">LIVE — feed required</option></select></label>
      <label>Timeframe<select aria-label="Footprint timeframe" value={timeframe} onChange={e => setTimeframe(Number(e.target.value))}>{[[15000, '15s'], [60000, '1m'], [300000, '5m']].map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
      <label>Aggregation<select aria-label="Tick aggregation" value={aggregation} onChange={e => setAggregation(Number(e.target.value))}>{[1, 2, 4, 8].map(n => <option key={n} value={n}>{n} tick{n > 1 ? 's' : ''}</option>)}</select></label>
      <label>Session<select aria-label="Order flow session" value={session} onChange={e => setSession(e.target.value)}><option value="all">Demo session · all</option><option value="custom">Custom · UTC</option></select></label>
      <label>Layout<select aria-label="Order flow layout" value={layout} onChange={e => setLayout(e.target.value)}><option value="full">Full workspace</option><option value="chart">Chart only</option><option value="tape">Chart + Tape</option></select></label>
      <button className="of-icon" aria-label={paused ? `Resume ${simulated ? 'simulated' : 'provider'} stream` : `Pause ${simulated ? 'simulated' : 'provider'} stream`} disabled={mode === 'replay'} onClick={() => setPaused(v => !v)}>{paused ? <Play size={15} /> : <Pause size={15} />}</button><button className="of-icon" aria-label="Order flow settings" onClick={() => setDrawer(true)}><Settings size={15} /></button><button className="of-icon" aria-label="Fullscreen order flow" onClick={async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.current.requestFullscreen(); } catch { setStatusMessage('Fullscreen is unavailable in this browser.'); } }}><Maximize2 size={15} /></button><button className="of-icon" aria-label="Reset order flow workspace" onClick={reset}><RotateCcw size={15} /></button>
    </div>
    <div className="of-subtoolbar"><span className="of-sim-badge">{simulated ? 'SIMULATED DATA' : snapshot.status === 'connected' ? 'PROVIDER DATA' : 'FEED UNAVAILABLE'}</span><span>{simulated ? 'Demo prices · no live market connection · execution disabled' : snapshot.message} {analysis.quality.reason || ''}</span><label><input type="checkbox" checked={heatmap} onChange={e => setHeatmap(e.target.checked)} />Liquidity Heatmap</label><small>{snapshot.timestamp ? `${new Date(snapshot.timestamp).toISOString().slice(0, 19).replace('T', ' ')} UTC · ${simulated ? 'demo clock' : 'exchange time'}` : 'No provider timestamp'}</small></div>
    {mode === 'replay' && <div className="of-replay"><button onClick={() => setReplayPlaying(v => !v)} disabled={replayAt >= snapshot.trades.length - 1}>{replayPlaying && replayAt < snapshot.trades.length - 1 ? 'Pause replay' : 'Play replay'}</button><button onClick={() => setReplayIndex(Math.min(snapshot.trades.length - 1, replayAt + 1))}>Step trade</button><input type="range" aria-label="Order flow replay position" min="0" max={Math.max(0, snapshot.trades.length - 1)} value={replayAt} onChange={e => { setReplayIndex(Number(e.target.value)); setReplayPlaying(false); }} /><select aria-label="Order flow replay speed" value={replaySpeed} onChange={e => setReplaySpeed(Number(e.target.value))}>{[1, 2, 4, 8].map(v => <option key={v} value={v}>{v}×</option>)}</select><span>{replayAt + 1} / {snapshot.trades.length}</span></div>}
    {statusMessage && <p role="status">{statusMessage}</p>}
    <div className="of-main">
      {layout === 'chart' ? chart : <PanelGroup direction="horizontal" key={layout}>
        <Panel defaultSize={layout === 'full' ? 64 : 76} minSize={35}>{chart}</Panel><PanelResizeHandle className="of-resizer" aria-label="Resize order flow panels" />
        <Panel defaultSize={layout === 'full' ? 36 : 24} minSize={23}><PanelGroup direction="vertical">
          {layout === 'full' && <><Panel defaultSize={62} minSize={25}><DOMLadder book={book} trades={trades} settings={settings} instrument={instrument} /></Panel><PanelResizeHandle className="of-resizer horizontal" aria-label="Resize DOM and tape" /></>}
          <Panel defaultSize={layout === 'full' ? 38 : 100} minSize={20}><TimeAndSales trades={trades} instrument={instrument} threshold={settings.largeTrade} /></Panel>
        </PanelGroup></Panel>
      </PanelGroup>}
    </div>
    <div className="of-bottom"><OrderFlowAnalytics flow={flow} book={book} trades={trades} settings={settings} instrument={instrument} /><OrderFlowSignals signals={signals} /></div>
    {drawer && <OrderFlowSettings settings={settings} update={update} close={() => setDrawer(false)} />}
  </div></FeedContext>;
}
