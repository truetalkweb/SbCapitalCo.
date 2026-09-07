/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ChartPanel from "/src/components/ChartPanel.jsx";
import ReplayPanel from "/src/components/ReplayPanel.jsx";
import DashboardMarketIntelligence from "/src/components/premium/DashboardMarketIntelligence.jsx";
import ChartsWorkspacePage from "/src/components/premium/pages/ChartsWorkspacePage.jsx";
import WorkspaceGrid from "/src/components/WorkspaceGrid.jsx";
import { useReplayEngine } from "/src/hooks/useReplayEngine.js";
import { useTerminalWorkspace } from "/src/hooks/useTerminalWorkspace.js";
import { MarketDataProvider } from "/src/context/MarketDataContext.jsx";
import { useMarketData } from "/src/hooks/useMarketData.js";
import { captureChartCanvas } from "/src/utils/chartCapture.js";

const dark = { bg: "#07090d", page: "#07090d", panel: "#101319", panel2: "#171c24", border: "#353e49", borderSoft: "#29323d", text: "#eef1f5", muted: "#a1adbd", faint: "#8793a5", blue: "#278cff", cyan: "#13c6d5", green: "#00c896", red: "#f45b60", amber: "#efb549" };
const light = { ...dark, bg: "#edf1f5", page: "#edf1f5", panel: "#fff", panel2: "#f4f6f9", border: "#9ba9ba", borderSoft: "#c3ccd8", text: "#18212e", muted: "#4a596b", green: "#007e5c", red: "#b52335", amber: "#8b5900" };

function QuoteAgeProbe() {
  const { liveQuotes, updateLiveQuote } = useMarketData();
  return <div>
    <button onClick={() => updateLiveQuote("AAPL", 123, { source: "Recorded quote provider", asOf: Date.now() - 29000 })}>Inject aging quote</button>
    <output data-testid="quote-quality">{liveQuotes.AAPL?.quality || "unavailable"}</output>
    <output data-testid="quote-asof">{liveQuotes.AAPL?.asOf ?? ""}</output>
  </div>;
}

function Fixture() {
  const [isDark, setDark] = useState(true);
  const [symbol, setSymbol] = useState("AAPL");
  const [interval, setInterval] = useState("1m");
  const [secondarySymbol, setSecondarySymbol] = useState("TSLA");
  const [secondaryInterval, setSecondaryInterval] = useState("5m");
  const [count, setCount] = useState("1");
  const [quantity, setQuantity] = useState(100);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("LOADING");
  const [secondaryStatus, setSecondaryStatus] = useState("LOADING");
  const [indicators, setIndicators] = useState({ ema9: true, ema20: true, volume: true });
  const [width, setWidth] = useState(window.innerWidth);
  const area = useRef(null);
  const engine = useReplayEngine({ quantity, initialReplayMode: true });
  const { additionalCharts: additional, setAdditionalCharts: setAdditional, syncCharts: sync, setSyncCharts: setSync } = useTerminalWorkspace({
    layoutPresets: {}, setReplayMode: engine.setReplayMode, setReplayPlaying: engine.setReplayPlaying,
  });
  const { setReplayContext } = engine;
  const theme = isDark ? dark : light;
  useEffect(() => { setReplayContext({ symbol, interval }); }, [symbol, interval, setReplayContext]);
  useEffect(() => { const resize = () => setWidth(window.innerWidth); window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize); }, []);
  const button = active => ({ color: theme.text, background: active ? theme.blue : theme.panel2, border: `1px solid ${theme.border}`, borderRadius: 4, padding: "5px 8px" });
  const capture = (element, selected, frame) => {
    const canvas = captureChartCanvas(element);
    const link = document.createElement("a");
    link.download = `${selected}-${frame}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };
  if (new URLSearchParams(window.location.search).has("chartsSample")) return <ChartsWorkspacePage
    theme={theme} page={{ height: 900 }} viewportHeight={1080} layoutMode="1" gridMode="2"
    chartIndicators={{}} selected={{ symbol: "AAPL" }} selectedActions={[]} dashboard={{ watchlistRows: [] }} stocks={[
      { symbol: "AAPL", price: 100, changePercent: 1, source: "Recorded quote provider", quality: "cached" },
      { symbol: "SPY", price: 300, changePercent: 0, source: "Recorded quote provider", quality: "cached" },
      { symbol: "FAKE", price: 100, changePercent: -99, source: "Recorded quote provider", isSynthetic: true },
      { symbol: "UNKNOWN", price: null, changePercent: null },
    ]} />;
  return <main style={{ height: "100dvh", display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto", background: theme.bg, color: theme.text, fontFamily: "Arial,sans-serif" }}>
    <header style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 8 }}>
      {new URLSearchParams(window.location.search).has("quoteAging") && <MarketDataProvider><QuoteAgeProbe /></MarketDataProvider>}
      <button onClick={() => setDark(value => !value)}>Theme</button>
      <label>Layout <select aria-label="Chart count" value={count} onChange={event => setCount(event.target.value)}>{[1,2,3,4].map(value => <option key={value}>{value}</option>)}</select></label>
      <label><input type="checkbox" checked={sync} onChange={event => setSync(event.target.checked)} />Sync</label>
      <label><input type="checkbox" checked={engine.replayMode} onChange={event => engine.setReplayMode(event.target.checked)} />Replay</label>
      <button onClick={engine.stepReplay}>Step</button>
      <input aria-label="Replay index" type="range" min="0" max={Math.max(0, engine.mainReplayData.length - 1)} value={engine.replayIndex} onChange={event => engine.setReplayIndex(Number(event.target.value))} />
      <button onClick={() => engine.setReplayPlaying(value => !value)}>{engine.replayPlaying ? "Pause" : "Play"}</button>
      <button onClick={() => engine.setReplayIndex(0)}>Rewind</button>
      <button onClick={engine.resetReplay}>Reset replay</button>
      <button onClick={() => localStorage.setItem("qa-replay", JSON.stringify(engine.replaySession))}>Save replay</button>
      <button onClick={() => engine.restoreReplaySession(JSON.parse(localStorage.getItem("qa-replay")))}>Restore replay</button>
      <label>Shares <input aria-label="Shares" type="number" style={{ width: 65 }} value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
      <button onClick={() => engine.replayBuy(symbol)}>Simulate buy</button>
      <button onClick={() => engine.replaySell(symbol)}>Simulate sell</button>
      <input aria-label="Replay notes" value={notes} onChange={event => setNotes(event.target.value)} />
      <span role="status">{status}</span>
    </header>
    <section style={{ minHeight: 0, minWidth: 0, padding: 6, overflow: "auto" }}>
      {new URLSearchParams(window.location.search).has("marketPulse") && <DashboardMarketIntelligence theme={theme}
        selected={{ symbol: "AAPL" }} brokerApiUrl="http://127.0.0.1:4999" marketIndexes={[
          { symbol: "SPY", price: 321, changePercent: 1, source: "Recorded quote provider", quality: "delayed" },
        ]} breadthRows={[
          { symbol: "AAPL", price: 100, changePercent: 1, source: "Recorded quote provider", quality: "cached" },
          { symbol: "FAKE", price: 100, changePercent: -99, source: "Recorded quote provider", isSynthetic: true },
        ]} />}
      {new URLSearchParams(window.location.search).has("compactReplay") && <aside aria-label="Compact replay">
        <ReplayPanel {...engine} theme={theme} buttonStyle={button} selectedStock={symbol}
          replayBuy={() => engine.replayBuy(symbol)} replaySell={() => engine.replaySell(symbol)} openReplayJournal={() => {}} />
      </aside>}
      <WorkspaceGrid theme={theme} layoutMode={count === "1" ? "1" : "2"} gridMode={count} viewportWidth={width}
        selectedStock={symbol} setMainSymbol={setSymbol} timeframe={interval} setMainTimeframe={setInterval}
        secondarySymbol={secondarySymbol} setSecondarySymbol={setSecondarySymbol} secondaryTimeframe={secondaryInterval} setSecondaryTimeframe={setSecondaryInterval}
        additionalCharts={additional} setAdditionalCharts={setAdditional} syncCharts={sync} allSymbols={[]}
        mainChartStatus={status} setMainChartStatus={setStatus} secondaryChartStatus={secondaryStatus} setSecondaryChartStatus={setSecondaryStatus}
        renderChartPanel={props => <ChartPanel {...props} theme={theme} isDark={isDark} allSymbols={[]} viewportWidth={width}
          panelStyle={style => style} buttonStyle={button} timeframeButtonStyle={button} indicators={indicators} setIndicators={setIndicators}
          chartAreaRef={area} takeScreenshot={capture} toggleFullscreen={element => element.requestFullscreen()}
          replayMode={engine.replayMode} replayIndex={engine.replayIndex} replayCandle={engine.replayCandle} replayTrades={engine.replayTrades}
          setMainReplayData={engine.setMainReplayData} brokerApiUrl="http://127.0.0.1:4999" />}
      />
    </section>
    <output data-testid="ledger" style={{ padding: 6, fontSize: 11, overflowWrap: "anywhere" }}>{JSON.stringify({ index: engine.replayIndex, mark: engine.replayCandle?.close ?? null, positions: engine.replayStats.positions, cash: engine.replayStats.cash, equity: engine.replayStats.equity, events: engine.replaySession.events, archives: engine.replaySession.archives?.length, message: engine.replayStats.message })}</output>
  </main>;
}

createRoot(document.getElementById("root")).render(<Fixture />);
