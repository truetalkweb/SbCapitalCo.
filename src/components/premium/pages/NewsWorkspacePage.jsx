import { useState } from "react";
import RecordPagination from "../RecordPagination";
import { useRecordPage } from "../../../hooks/useRecordPage.js";
import { Star } from "lucide-react";
import { ActionButton, FilterBar, PremiumCard, PremiumTable, PremiumTabs, SectionTitle, StatusPill } from "../PremiumWorkspacePrimitives";

export default function NewsWorkspacePage({
  addSymbolToWatchlist,
      mainTwoCol,
      newsCatalystHighlights,
      newsRows,
      newsSearch,
      newsView,
      page,
      prepareReviewAction,
      watchlistHeadlines = [],
      selectMainSymbol,
      selected,
      selectedStory: inputStory,
      setActiveWorkspace,
      setNewsSearch,
      setNewsView,
      setSelectedNewsId,

      theme
}) {
    const [source, setSource] = useState("all");
    const [impact, setImpact] = useState("all");
    const filtered = newsRows.filter(row => (source === "all" || row.source === source) && (impact === "all" || row.impact === impact));
    const selectedStory = filtered.find(row=>row.id===inputStory?.id) || filtered[0] || null;
    const pagination = useRecordPage(filtered, 25, newsSearch + newsView + source + impact);
    return (
      <div className="terminal-page" style={page}>
        <div style={mainTwoCol}>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme}>
              <div style={{ padding: 16, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}>
                <SectionTitle theme={theme} title="News" subtitle="Track market-moving headlines, catalysts, and company news." action={newsCatalystHighlights ? <StatusPill theme={theme} tone="good">Catalyst highlights on</StatusPill> : null} />
                <PremiumTabs theme={theme} tabs={["Top News", "Market", "Stocks", "Earnings", "Macro", "Analyst", "Crypto", "Watchlist"]} active={newsView} onChange={setNewsView} />
                <div style={{ marginTop: 14 }}><FilterBar theme={theme} search="Search news..." value={newsSearch} onSearchChange={setNewsSearch} items={[]} /></div>
              </div>
              <div style={{padding:12,display:"flex",gap:12,color:theme.muted}}>
                <label>Source <select aria-label="News source" value={source} onChange={event=>setSource(event.target.value)}><option value="all">All sources</option>{[...new Set(newsRows.map(row=>row.source))].map(value=><option key={value}>{value}</option>)}</select></label>
                <label>Impact <select aria-label="News impact" value={impact} onChange={event=>setImpact(event.target.value)}><option value="all">All impact</option>{[...new Set(newsRows.map(row=>row.impact))].map(value=><option key={value}>{value}</option>)}</select></label>
              </div>
              <PremiumTable
                theme={theme}
                columns={[
                  { key: "time", label: "Time", width: "90px", mono: true },
                  {
                    key: "headline",
                    label: "Headline",
                    width: "2fr",
                    strong: true,
                    render: (row) => row.url ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open article: ${row.headline}`}
                        onClick={(event) => event.stopPropagation()}
                        style={{
                          display: "block",
                          maxWidth: "100%",
                          overflow: "hidden",
                          color: "inherit",
                          textDecoration: "none",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          outlineOffset: 3,
                        }}
                      >
                        {newsCatalystHighlights && row.impact === "High" && <Star aria-label="Catalyst highlight" size={12} color={theme.amber} fill={theme.amber} style={{ verticalAlign: "-1px", marginRight: 7 }} />}{row.headline}<span style={{ color: theme.blue, fontSize: 10, marginLeft: 5 }}>OPEN</span>
                      </a>
                    ) : row.headline,
                  },
                  { key: "symbol", label: "Symbol", width: "80px", mono: true },
                  { key: "source", label: "Source", width: "120px" },
                  { key: "impact", label: "Impact", width: "90px", render: (row) => <StatusPill theme={theme} tone={row.impact === "High" ? "bad" : "warn"}>{row.impact}</StatusPill> },
                  { key: "sentiment", label: "Sentiment", width: "100px", color: (row) => row.sentiment === "Bearish" ? theme.red : theme.green },
                ]}
                rows={pagination.rows}
                selectedKey={selectedStory?.id}
                keyField="id"
                emptyMessage={`No ${newsView.toLowerCase()} headlines match the current search.`}
                onSelect={(row) => {
                  setSelectedNewsId(row.id);
                  if (row.symbol) selectMainSymbol?.(row.symbol, row, "news-row");

                }}
              />
            </PremiumCard>
            <RecordPagination theme={theme} state={pagination} label="headlines" />
            <PremiumCard theme={theme} title="Watchlist News"><PremiumTable theme={theme} keyField="id" columns={[
              {key:"symbol",label:"Symbol",width:"90px"},{key:"headline",label:"Headline",width:"2fr"},{key:"source",label:"Source",width:"120px"},
            ]} rows={watchlistHeadlines} onSelect={row=>{ setNewsView("Watchlist"); setNewsSearch(""); setSource("all"); setImpact("all"); setSelectedNewsId(row.id); if(row.symbol)selectMainSymbol?.(row.symbol,row,"news-row"); }} emptyMessage="No articles for this watchlist" /></PremiumCard>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme} title="Selected Story" action={<Star size={18} color={newsCatalystHighlights ? theme.blue : theme.muted} fill={newsCatalystHighlights ? theme.blue : "none"} />}>
              <div style={{ padding: 18 }}>
                <h2 style={{ margin: 0, fontSize: 22 }}>{selectedStory?.headline || "No story selected"}</h2>
                <div style={{ color: theme.muted, marginTop: 10 }}>{selectedStory ? `${selectedStory.source} / ${selectedStory.time}` : "Provider feed unavailable"}</div>
                <div style={{ marginTop: 16, lineHeight: 1.55, color: theme.text }}>{selectedStory?.summary || "No provider summary is available for this headline."}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
                  <ActionButton theme={theme} active onClick={() => {
                    selectMainSymbol?.(selectedStory?.symbol || selected.symbol);
                    setActiveWorkspace?.("charts");
                  }}>Open Chart</ActionButton>
                  <ActionButton theme={theme} onClick={() => prepareReviewAction("News alert review", selectedStory?.symbol || selected.symbol)}>Alert Review</ActionButton>
                  <ActionButton theme={theme} good onClick={() => addSymbolToWatchlist?.(selectedStory?.symbol || selected.symbol)}>Watch Symbol</ActionButton>
                </div>
              </div>
            </PremiumCard>
            <PremiumCard theme={theme} title="News Classification"><div style={{ padding: 14, display: "grid", gap: 9 }}>{[["Impact", selectedStory?.impact || "Not classified"], ["Sentiment", selectedStory?.sentiment || "Not classified"], ["Source", selectedStory?.source || "Unavailable"], ["Data mode", selectedStory?.fallback ? "Fallback context" : selectedStory ? "Provider article" : "Unavailable"]].map(([a, b]) => <div key={a} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>{a}</span><b>{b}</b></div>)}</div></PremiumCard>

          </div>
        </div>
      </div>
    );
  
}
