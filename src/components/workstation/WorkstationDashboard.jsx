import PaperOrderTicket from "./PaperOrderTicket";
import { currency, price, signed, valueClass } from "./workstationFormat";
import { useEffect, useRef, useState } from "react";
import { BellPlus, Camera, CandlestickChart, ChartNoAxesCombined, ChevronDown, Crosshair, Maximize2, MoreHorizontal, MousePointer2, RotateCcw, Settings, Star, TrendingUp } from "lucide-react";
import { getUsMarketStatus } from "../../utils/marketSession";
import { CHART_INDICATOR_OPTIONS } from "../../indicators/chartIndicators";
import { formatCompactNumber } from "../../utils/dashboardFormatters";
import { parseNullableMarketNumber as number } from "../../utils/marketNumbers";
import { DashboardNews, OrderBook, PortfolioTable, TradeTicket } from "./WorkstationPanels";
import "./workstation.css";
import NewsPreview from "./NewsPreview";
import { useDismissPopover } from "./useDismissPopover";

export default function WorkstationDashboard({ selected = {}, chart, account = {}, marketIndexes = [], positions = [], orders = [], rawOrders = [], news = [], alerts = [], quantity, setQuantity, onReview, paperTrading, onSelect, onNavigate, onAddWatch, watched, timeframe, setTimeframe, indicators = {}, setIndicators, takeScreenshot, toggleAlert, preferences = {}, setPreference, marketStatus: providedMarketStatus }) {
  const [indicatorMenu, setIndicatorMenu] = useState(false);
  const [story, setStory] = useState(null);
  const indicatorControl = useDismissPopover(indicatorMenu, setIndicatorMenu);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 30000); return () => clearInterval(timer); }, []);
  const marketStatus = providedMarketStatus ?? getUsMarketStatus(clock);
  const chartPanel = useRef(null);
  const move = number(selected.changePercent);
  const accountRows = new Map((account?.rows || []).map(row => [row.label, number(row.value)]));
  const accountEquity = accountRows.get("Net Liquidation") ?? accountRows.get("Account Equity");
  const dayPnl = accountRows.get("Day P&L") ?? null;
  const today = clock.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const todaysTrades = rawOrders.filter(row => row.status?.toUpperCase() === "FILLED" && (row.filledAt || row.createdAt) && new Date(row.filledAt || row.createdAt).toLocaleDateString("en-CA", { timeZone: "America/New_York" }) === today).length;

  return <div className="ws-dashboard" data-testid="sb-main-dashboard">
    <div className="ws-account-strip" aria-label="Account metrics">
      <section className="ws-panel ws-metric ws-equity"><span>Account Equity</span><strong>{currency(accountEquity)}</strong><small>{account?.source || "Workspace account"}</small></section>
      <section className="ws-panel ws-metric"><span>Day P&L</span><strong className={valueClass(dayPnl)}>{currency(dayPnl)}</strong><small>{dayPnl === null ? "Not reported" : "Reported by account"}</small></section>
      <section className="ws-panel ws-metric"><span>Buying Power</span><strong>{currency(accountRows.get("Buying Power"))}</strong></section>
      <section className="ws-panel ws-metric"><span>Open Positions</span><strong>{positions.length}</strong></section>
      <section className="ws-panel ws-metric"><span>Today's Trades</span><strong>{todaysTrades}</strong><small>Recorded fills</small></section>
      <section className="ws-panel ws-metric ws-market-status"><span>Market Status</span><strong><i className={`ws-status-dot ${marketStatus === "OPEN" ? "ws-open" : ""}`} />{marketStatus === "OPEN" ? "Market Open" : marketStatus === "CLOSED" ? "Market Closed" : marketStatus}</strong><small>US equities · Eastern time</small></section>
      <section className="ws-panel ws-indices" aria-label="Market indices">{(["DIA", "SPY", "QQQ"].map(symbol => marketIndexes.find(row => row.symbol === symbol) || { symbol })).map(row => <button key={row.symbol} onClick={() => onSelect?.(row.symbol)}><span>{row.symbol}</span><b>{price(row.price)}</b><span className={valueClass(row.changePercent ?? row.change)}>{number(row.changePercent ?? row.change) === null ? "—" : `${signed(row.changePercent ?? row.change)}%`}</span></button>)}</section>
    </div>
    <div className="ws-main-grid">
      <section className="ws-panel ws-chart-panel" ref={chartPanel} aria-label="Primary trading chart">
        <div className="ws-symbol-header"><div className="ws-instrument"><h1>{selected.symbol}<TrendingUp size={12} /></h1><span>{selected.name || selected.symbol}</span></div><div className="ws-symbol-price"><strong>{price(selected.price)}</strong><b className={valueClass(move)}>{number(selected.changeAmount) !== null ? `${signed(selected.changeAmount)} ` : ""}{move === null ? number(selected.price) === null ? "Quote unavailable" : "Change unavailable" : `(${signed(move)}%)`}</b></div><div className="ws-symbol-stats">{[["Open", selected.open], ["High", selected.high ?? selected.dayHigh], ["Low", selected.low ?? selected.dayLow], ["Vol", selected.volume], ["Mkt Cap", selected.marketCap]].map(([label, value]) => <div key={label}><span>{label}</span><b>{["Vol", "Mkt Cap"].includes(label) ? number(value) === null ? "—" : formatCompactNumber(value) : price(value)}</b></div>)}</div><span className="ws-classification">{[selected.sector, selected.industry, selected.exchange].filter(value => value && value !== "Not reported").join(" | ")}</span><button className="ws-icon" aria-label={watched ? "Symbol is on watchlist" : "Add symbol to watchlist"} aria-pressed={watched} onClick={() => onAddWatch?.(selected.symbol)}><Star size={18} fill={watched ? "currentColor" : "none"} /></button><button className="ws-icon" aria-label="Open chart workspace" onClick={() => onNavigate("charts")}><MoreHorizontal size={18} /></button></div>
        <div className="ws-chart-toolbar"><div className="ws-timeframes">{[["1m", "1m"], ["5m", "5m"], ["15m", "15m"], ["1H", "1h"], ["4H", "4h"], ["1D", "D"], ["1W", "W"], ["1M", "M"]].map(([value, label]) => <button key={value} aria-label={`Chart timeframe ${label}`} aria-pressed={timeframe === value} disabled={["4H", "1W", "1M"].includes(value)} title={["4H", "1W", "1M"].includes(value) ? "Interval not supported by the current chart provider" : label} onClick={() => setTimeframe?.(value)}>{label}</button>)}</div><CandlestickChart size={19} className="ws-candle-icon" /><div className="ws-indicator-control" ref={indicatorControl}><button aria-expanded={indicatorMenu} onClick={() => setIndicatorMenu(value => !value)}><ChartNoAxesCombined size={16} />Indicators<ChevronDown size={11} /></button>{indicatorMenu && <div className="ws-indicator-menu">{CHART_INDICATOR_OPTIONS.map(item => <label key={item.id}><input type="checkbox" checked={Boolean(indicators[item.id])} onChange={event => setIndicators?.(current => ({ ...current, [item.id]: event.target.checked }))} />{item.label}</label>)}</div>}</div><button onClick={() => onNavigate("alerts")}><BellPlus size={16} />Alert</button><button onClick={() => onNavigate("replay")}><RotateCcw size={16} />Replay</button><span className="ws-toolbar-spacer" /><button className="ws-icon" aria-label="Chart settings" onClick={() => onNavigate("charts")}><Settings size={18} /></button><button className="ws-icon" aria-label="Capture dashboard chart" onClick={takeScreenshot}><Camera size={19} /></button><button className="ws-icon" aria-label="Fullscreen dashboard chart" onClick={() => { if (document.fullscreenElement) document.exitFullscreen?.(); else chartPanel.current?.requestFullscreen?.(); }}><Maximize2 size={18} /></button></div>
        <div className="ws-chart-body"><div className="ws-drawing-rail"><span title="Crosshair"><Crosshair size={19} /></span><span title="Drag to pan; scroll to zoom"><MousePointer2 size={19} /></span><button className="ws-icon" aria-label="Open trend tools" title="Open trend tools in Charts" onClick={() => onNavigate("charts")}><TrendingUp size={19} /></button></div><div className="ws-live-chart">{chart}</div></div>
      </section>
      <div className="ws-execution-stack"><OrderBook quote={selected} />{paperTrading ? <PaperOrderTicket key={selected.symbol} symbol={selected.symbol} quote={selected} quantity={quantity} setQuantity={setQuantity} trading={paperTrading} defaultType={preferences.defaultOrderType || "MARKET"} onTypeChange={value => setPreference?.("defaultOrderType", value)} /> : <TradeTicket key={selected.symbol} symbol={selected.symbol} quote={selected} quantity={quantity} setQuantity={setQuantity} onReview={onReview} defaultType={preferences.defaultOrderType || "LIMIT"} setDefaultType={value => setPreference?.("defaultOrderType", value)} />}</div>
    </div>
    <div className="ws-bottom-grid"><PortfolioTable positions={positions} orders={orders} onSelect={onSelect} onOrders={() => onNavigate("orders")} onPositions={() => onNavigate("positions")} onJournal={() => onNavigate("journal")} notes={preferences.dashboardNotes} setNotes={value => setPreference?.("dashboardNotes", value)} /><DashboardNews news={news} alerts={alerts} toggleAlert={toggleAlert} openNews={row => setStory(row)} openAlerts={() => onNavigate("alerts")} /></div>
    {story && <NewsPreview story={story} onClose={() => setStory(null)} />}
  </div>;
}
