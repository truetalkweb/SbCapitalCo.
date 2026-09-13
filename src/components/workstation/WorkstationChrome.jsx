import { useEffect, useState } from "react";
import { Activity, Bell, BookOpen, BriefcaseBusiness, CalendarDays, ChartNoAxesCombined, ChevronDown, CircleHelp, House, ListFilter, LogOut, Search, Settings, ShieldCheck, SlidersHorizontal, Wrench } from "lucide-react";
import "./workstation.css";
import { useDismissPopover } from "./useDismissPopover";

export function Brand() {
  return <div className="ws-brand"><span className="ws-logo-window"><img src="/sb-terminal-logo.png" alt="SB logo" /></span><span><strong>TERMINAL</strong><small>TRADE&nbsp; ANALYZE&nbsp; EXECUTE&nbsp; EVOLVE</small></span></div>;
}

export function WorkstationHeader({ selectedSymbol, selectedSymbolContext, onSymbolCommit, quotes = [], setActiveWorkspace, handleLogout, onOpenHelp, saveWorkspaceToCloud, loadWorkspaceFromCloud, advancedMode, setAdvancedMode, syncCharts, setSyncCharts, marketRegion, marketRegions = {}, setMarketRegion }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [profile, setProfile] = useState(false);
  const profileControl = useDismissPopover(profile, setProfile);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  const matches = [...new Map(quotes.map(row => [row.symbol, row])).values()].filter(row => `${row.symbol} ${row.name || ""}`.toLowerCase().includes(query.toLowerCase())).slice(0, 7);
  const pick = symbol => { if (/^[A-Z0-9][A-Z0-9./:-]{0,13}$/.test(symbol)) { onSymbolCommit?.(symbol, null, "global-search"); setQuery(""); setFocused(false); } };
  return <header className="ws-header terminal-top-bar" data-selected-symbol={selectedSymbolContext?.symbol || selectedSymbol} data-selection-source={selectedSymbolContext?.selectionSource || "terminal"}>
    <Brand />
    <div className="ws-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <Search size={18} /><input aria-label="Global ticker search" placeholder="Search symbol, asset, or news..." value={query} onFocus={() => setFocused(true)} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") pick(matches[0]?.symbol || query.trim().toUpperCase()); if (event.key === "Escape") setFocused(false); }} />
      {focused && query && <div className="ws-search-results">{matches.map(row => <button key={row.symbol} onClick={() => pick(row.symbol)}><b>{row.symbol}</b><span>{row.name || "Select instrument"}</span></button>)}<button onClick={() => pick(query.trim().toUpperCase())}>Open {query.toUpperCase()}</button></div>}
    </div>
    <div className="ws-market-ticker" aria-label="Market ticker">{["SPY", "QQQ", "NVDA", "TSLA"].map(symbol => {
      const row = quotes.find(item => item.symbol === symbol); const move = Number.parseFloat(row?.changePercent ?? row?.change);
      return <button key={symbol} onClick={() => pick(symbol)}>{symbol}<span className={Number.isFinite(move) ? move < 0 ? "ws-negative" : "ws-positive" : ""}>{Number.isFinite(move) ? `${move >= 0 ? "+" : ""}${move.toFixed(2)}%` : "—"}</span></button>;
    })}</div>
    <time className="ws-clock" dateTime={now.toISOString()}>{now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })}<br />{now.toLocaleTimeString("en-US", { hour12: false, timeZone: "America/New_York" })} ET</time>
    <button className="ws-icon" aria-label="Notifications and alerts" onClick={() => setActiveWorkspace?.("alerts")}><Bell size={20} /></button>
    <div className="ws-profile" ref={profileControl}><button aria-label="Account menu" aria-expanded={profile} onClick={() => setProfile(value => !value)}><span>SB</span><ChevronDown size={13} /></button>{profile && <div className="ws-profile-menu"><small>SB TERMINAL</small>
      {saveWorkspaceToCloud && <button onClick={() => { saveWorkspaceToCloud(); setProfile(false); }}>Save workspace</button>}
      {loadWorkspaceFromCloud && <button onClick={() => { loadWorkspaceFromCloud(); setProfile(false); }}>Load workspace</button>}
      {setSyncCharts && <button aria-pressed={syncCharts} onClick={() => setSyncCharts(!syncCharts)}>Sync charts: {syncCharts ? "On" : "Off"}</button>}
      {setAdvancedMode && <button aria-pressed={advancedMode} onClick={() => setAdvancedMode(!advancedMode)}>Advanced controls: {advancedMode ? "On" : "Off"}</button>}
      {setMarketRegion && <label className="ws-menu-field">Market region<select aria-label="Market region" value={marketRegion} onChange={event => setMarketRegion(event.target.value)}>{Object.entries(marketRegions).map(([id, region]) => <option key={id} value={id}>{region.label || region.name || id}</option>)}</select></label>}
      <button onClick={() => { setActiveWorkspace?.("settings"); setProfile(false); }}><Settings size={15} />Settings</button><button onClick={() => { onOpenHelp?.(); setProfile(false); }}><CircleHelp size={15} />Help & shortcuts</button>{handleLogout && <button onClick={handleLogout}><LogOut size={15} />Sign out</button>}</div>}</div>
  </header>;
}

const navigation = [
  ["dashboard", "Dashboard", House], ["watchlist", "Watchlist", ListFilter], ["chart-analysis", "Charts", ChartNoAxesCombined],
  ["scanner", "Market Scanner", Search], ["news", "News & Calendar", CalendarDays], ["options", "Options Flow", Activity],
  ["positions", "Positions", BriefcaseBusiness], ["orders", "Orders", SlidersHorizontal], ["journal", "Trade Journal", BookOpen],
  ["performance", "Performance", ChartNoAxesCombined], ["risk", "Risk Manager", ShieldCheck], ["tools", "Tools", Wrench], ["settings", "Settings", Settings],
];
export function WorkstationSidebar({ activeWorkspace, setActiveWorkspace, expanded = true }) {
  return <aside className={`ws-sidebar ${expanded ? "" : "ws-sidebar-collapsed"}`}><nav aria-label="Terminal workspaces">{navigation.map(([id, label, Icon]) => <button key={id} aria-label={label} title={id === "options" ? "Options data is not connected" : label} disabled={id === "options"} aria-current={id === activeWorkspace || (id === "chart-analysis" && activeWorkspace === "charts" || id === "tools" && activeWorkspace === "replay") ? "page" : undefined} onClick={() => setActiveWorkspace(id === "tools" ? "replay" : id)}><Icon size={19} /><span>{label}</span></button>)}</nav><div className="ws-sidebar-quote">“Discipline compounds<br />faster than luck.”<small>SB TERMINAL</small></div></aside>;
}

export function WorkstationFooter() {
  return <footer className="ws-footer"><span>SB TERMINAL V1.0.0&nbsp; | &nbsp;BUILT FOR A CLEARER MIND</span><span>MARKETS MOVE FAST. YOU MOVE SMARTER.<i /></span></footer>;
}
