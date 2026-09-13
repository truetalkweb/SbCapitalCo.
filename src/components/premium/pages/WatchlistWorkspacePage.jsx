import { useState } from "react";
import RecordPagination from "../RecordPagination";
import { useRecordPage } from "../../../hooks/useRecordPage.js";
import { Edit3, Star, X } from "lucide-react";
import { hasNumericValue, nullableMoveOf, num, pct, toneColor } from "../premiumWorkspaceData";
import { ActionButton, FilterBar, PremiumCard, PremiumTable, PremiumTabs, SectionTitle } from "../PremiumWorkspacePrimitives";

export default function WatchlistWorkspacePage({
  addSymbolToWatchlist,
  collections,
      alertRows,
      journalRows,
      mainTwoCol,
      page,
      removeWatchlistSymbol,
      selectMainSymbol,
      selected,
      selectedRail,
      setWatchlistSearch,
      setWatchlistView,
      theme,
      watchlistRows,
      watchlistSearch,
      watchlistView
}) {
    const [listName,setListName] = useState("");
    const [symbolInput,setSymbolInput] = useState("");
    const pagination = useRecordPage(watchlistRows,25,watchlistSearch+watchlistView+(collections?.active.id||""));
    const member = symbol => collections ? collections.active.symbols.includes(symbol) : watchlistRows.some(row=>row.symbol===symbol);
    const listAlerts = alertRows.filter(row=>member(row.symbol));
    const listJournal = journalRows.filter(row=>member(row.symbol));
    return (
      <div className="terminal-page" style={page}>
        <div style={mainTwoCol}>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme}>
              <div style={{ padding: 20, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}>
                <SectionTitle theme={theme} title="Watchlist" subtitle="Track symbols, monitor moves, and organize trade ideas." action={<ActionButton theme={theme} onClick={() => addSymbolToWatchlist?.(selected.symbol)}><Edit3 size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Add Selected</ActionButton>} />
                {collections && <div style={{display:"flex",flexWrap:"wrap",gap:10,padding:"12px 0"}}>
                  <select aria-label="Active watchlist" value={collections.active.id} onChange={event=>collections.select(event.target.value)}>{collections.lists.map(list=><option key={list.id} value={list.id}>{list.name}</option>)}</select>
                  <input aria-label="Watchlist name" placeholder="Watchlist name" maxLength={80} value={listName} onChange={event=>setListName(event.target.value)} />
                  <ActionButton theme={theme} disabled={!listName.trim()} onClick={()=>{if(collections.create(listName))setListName("");}}>New List</ActionButton>
                  <ActionButton theme={theme} disabled={!listName.trim()} onClick={()=>{collections.rename(listName);setListName("");}}>Rename</ActionButton>
                  <ActionButton theme={theme} disabled={collections.lists.length<2} onClick={collections.removeList}>Remove List</ActionButton>
                  <input aria-label="Watchlist symbol" placeholder="Add symbol" value={symbolInput} onChange={event=>setSymbolInput(event.target.value.toUpperCase())} />
                  <ActionButton theme={theme} disabled={!/^[A-Z0-9][A-Z0-9./:-]{0,13}$/.test(symbolInput)} onClick={()=>{addSymbolToWatchlist?.(symbolInput);setSymbolInput("");}}>Add Symbol</ActionButton>
                </div>}
                <PremiumTabs theme={theme} tabs={["Main Watchlist", "Momentum", "ETFs", "Earnings"]} active={watchlistView} onChange={setWatchlistView} />
                <div style={{ marginTop: 14 }}><FilterBar theme={theme} search="Search symbol..." value={watchlistSearch} onSearchChange={setWatchlistSearch} items={[]} /></div>
              </div>
              <PremiumTable
                theme={theme}
                columns={[
                  { key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true, render: (row) => <><Star size={14} aria-label="Watchlist member" color={theme.blue} fill={theme.blue} style={{ verticalAlign: "-2px", marginRight: 10 }} />{row.symbol}</> },
                  { key: "name", label: "Company", width: "1.4fr" },
                  { key: "price", label: "Last", width: "90px", align: "right", mono: true, render: (row) => hasNumericValue(row.price) ? num(row.price).toFixed(2) : "Unavailable" },
                  { key: "change", label: "Chg%", width: "90px", align: "right", mono: true, color: (row) => nullableMoveOf(row) === null ? theme.muted : toneColor(theme, nullableMoveOf(row)), render: (row) => nullableMoveOf(row) === null ? "Unavailable" : pct(nullableMoveOf(row)) },
                  { key: "volumeLabel", label: "Volume", width: "100px", align: "right", mono: true },
                  { key: "rvolLabel", label: "RVOL", width: "80px", align: "right", mono: true },
                  { key: "floatLabel", label: "Float", width: "90px", align: "right", mono: true },
                  { key: "sector", label: "Sector", width: "150px" },
                  { key: "catalyst", label: "Context", width: "1fr", render: (row) => row.catalyst || "No confirmed catalyst" },
                  { key: "remove", label: "", width: "42px", align: "center", render: (row) => <button type="button" aria-label={`Remove ${row.symbol} from watchlist`} title={`Remove ${row.symbol}`} onClick={(event) => { event.stopPropagation(); removeWatchlistSymbol?.(row.symbol); }} style={{ width: 28, height: 28, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 5, background: "transparent", color: theme.muted, cursor: "pointer" }}><X size={13} /></button> },
                ]}
                rows={pagination.rows}
                selectedKey={selected.symbol}
                emptyMessage={`No ${watchlistView.toLowerCase()} symbols match the current search.`}
                onSelect={(row) => selectMainSymbol?.(row.symbol, row, "watchlist-row")}
              />
            </PremiumCard>
            <RecordPagination theme={theme} state={pagination} label="watchlist symbols" />
            <PremiumCard theme={theme} title="Watchlist Notes & Activity">
              <PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "140px" }, { key: "type", label: "Type", width: "180px" }, { key: "symbol", label: "Symbol", width: "100px", mono: true }, { key: "note", label: "Note / Activity", width: "1fr" }, { key: "user", label: "Updated By", width: "120px" }]} rows={[...listAlerts.map((row) => ({ time: row.created, type: "Alert", symbol: row.symbol, note: row.condition, user: "You" })), ...listJournal.map((row) => ({ time: row.date, type: "Journal", symbol: row.symbol, note: row.notes, user: "You" }))].slice(0, 8)} emptyMessage="No watchlist activity recorded" />
            </PremiumCard>
          </div>
          {selectedRail(<><PremiumCard theme={theme} title="Watchlist Context"><div style={{ padding: 14, display: "grid", gap: 9 }}>{[["Relative volume", selected.rvol || "Unavailable"], ["Volume", selected.volume || "Unavailable"], ["Catalyst", selected.catalyst || selected.setup || "Unconfirmed"], ["Risk", selected.risk || "Context"]].map(([label, value]) => <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>{label}</span><b>{value}</b></div>)}</div></PremiumCard><PremiumCard theme={theme} title="Upcoming Alerts"><div style={{ padding: 14, display: "grid", gap: 12 }}>{listAlerts.filter((row) => row.status === "Active").length ? listAlerts.filter((row) => row.status === "Active").map((row) => <div key={row.id} style={{ color: theme.text }}>{row.symbol} {row.condition}</div>) : <span style={{ color: theme.muted }}>No active alerts</span>}</div></PremiumCard></>)}
        </div>
      </div>
    );
  
}

