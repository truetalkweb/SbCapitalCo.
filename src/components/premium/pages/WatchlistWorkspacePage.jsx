import { Edit3, Star, X } from "lucide-react";
import { hasNumericValue, nullableMoveOf, num, pct, toneColor } from "../premiumWorkspaceData";
import { ActionButton, FilterBar, PremiumCard, PremiumTable, PremiumTabs, SectionTitle } from "../PremiumWorkspacePrimitives";

export default function WatchlistWorkspacePage({
  addSymbolToWatchlist,
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
    return (
      <div style={page}>
        <div style={mainTwoCol}>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme}>
              <div style={{ padding: 20, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}>
                <SectionTitle theme={theme} title="Watchlist" subtitle="Track symbols, monitor moves, and organize trade ideas." action={<ActionButton theme={theme} onClick={() => addSymbolToWatchlist?.(selected.symbol)}><Edit3 size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Add Selected</ActionButton>} />
                <PremiumTabs theme={theme} tabs={["Main Watchlist", "Momentum", "ETFs", "Earnings"]} active={watchlistView} onChange={setWatchlistView} />
                <div style={{ marginTop: 14 }}><FilterBar theme={theme} search="Search symbol..." value={watchlistSearch} onSearchChange={setWatchlistSearch} items={["All Sectors", "Price Any", "Change % Any"]} /></div>
              </div>
              <PremiumTable
                theme={theme}
                columns={[
                  { key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true, render: (row) => <><Star size={14} color={row.symbol === selected.symbol ? theme.blue : theme.muted} fill={row.symbol === selected.symbol ? theme.blue : "none"} style={{ verticalAlign: "-2px", marginRight: 10 }} />{row.symbol}</> },
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
                rows={watchlistRows.slice(0, 20)}
                selectedKey={selected.symbol}
                emptyMessage={`No ${watchlistView.toLowerCase()} symbols match the current search.`}
                onSelect={(row) => selectMainSymbol?.(row.symbol, row, "watchlist-row")}
              />
            </PremiumCard>
            <PremiumCard theme={theme} title="Watchlist Notes & Activity">
              <PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "140px" }, { key: "type", label: "Type", width: "180px" }, { key: "symbol", label: "Symbol", width: "100px", mono: true }, { key: "note", label: "Note / Activity", width: "1fr" }, { key: "user", label: "Updated By", width: "120px" }]} rows={[...alertRows.map((row) => ({ time: row.created, type: "Alert", symbol: row.symbol, note: row.condition, user: "You" })), ...journalRows.map((row) => ({ time: row.date, type: "Journal", symbol: row.symbol, note: row.notes, user: "You" }))].slice(0, 8)} emptyMessage="No watchlist activity recorded" />
            </PremiumCard>
          </div>
          {selectedRail(<><PremiumCard theme={theme} title="Watchlist Context"><div style={{ padding: 14, display: "grid", gap: 9 }}>{[["Relative volume", selected.rvol || "Unavailable"], ["Volume", selected.volume || "Unavailable"], ["Catalyst", selected.catalyst || selected.setup || "Unconfirmed"], ["Risk", selected.risk || "Context"]].map(([label, value]) => <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>{label}</span><b>{value}</b></div>)}</div></PremiumCard><PremiumCard theme={theme} title="Upcoming Alerts"><div style={{ padding: 14, display: "grid", gap: 12 }}>{alertRows.filter((row) => row.status === "Active").length ? alertRows.filter((row) => row.status === "Active").map((row) => <div key={row.id} style={{ color: theme.text }}>{row.symbol} {row.condition}</div>) : <span style={{ color: theme.muted }}>No active alerts</span>}</div></PremiumCard></>)}
        </div>
      </div>
    );
  
}

