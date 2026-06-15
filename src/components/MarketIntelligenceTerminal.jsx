import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, RefreshCw, Search, Star } from "lucide-react";

const monoFont = '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace';

function parsePercent(value) {
  return Number(String(value || "0").replace("%", "")) || 0;
}

function formatTime(value) {
  if (!value) return "Pending";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "Pending";

  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAgeMs(value) {
  const ageMs = Number(value || 0);

  if (!Number.isFinite(ageMs) || ageMs <= 0) return "fresh";
  if (ageMs < 60_000) return `${Math.round(ageMs / 1000)}s old`;
  if (ageMs < 3_600_000) return `${Math.round(ageMs / 60_000)}m old`;

  return `${Math.round(ageMs / 3_600_000)}h old`;
}

function formatCompactNumber(value) {
  const number = Number(value || 0);

  if (number >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(1)}B`;
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1)}K`;

  return String(Math.max(1, Math.round(number)));
}

function sentimentColor(theme, sentiment) {
  if (sentiment === "bullish") return theme.green;
  if (sentiment === "bearish") return theme.red;
  return theme.amber;
}

function normalizeNews(news) {
  return Array.isArray(news) ? news.filter((item) => item?.headline) : [];
}

function makeHeaders(user) {
  return {
    "Content-Type": "application/json",
    "x-sbc-user-id": user?.uid || "local",
  };
}

function LoadingBlock({ theme, label }) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "120px",
        color: theme.muted,
        background: theme.panel2,
        border: `1px solid ${theme.borderSoft || theme.border}`,
        borderRadius: "8px",
        fontSize: "11px",
        fontWeight: 900,
      }}
    >
      {label}
    </div>
  );
}

function EmptyBlock({ theme, title, detail }) {
  return (
    <div
      style={{
        padding: "14px",
        color: theme.muted,
        background: theme.panel2,
        border: `1px dashed ${theme.borderSoft || theme.border}`,
        borderRadius: "8px",
        fontSize: "11px",
        lineHeight: "1.45",
      }}
    >
      <div style={{ color: theme.text, fontWeight: 950, marginBottom: "4px" }}>{title}</div>
      <div>{detail}</div>
    </div>
  );
}

export default function MarketIntelligenceTerminal({
  theme,
  brokerApiUrl,
  user,
  localWatchlist = [],
  addSymbolToWatchlist,
  removeWatchlistSymbol,
  selectMainSymbol,
  selectedStock,
}) {
  const [movers, setMovers] = useState(null);
  const [news, setNews] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [watchlist, setWatchlist] = useState([]);
  const [watchlistIntelligence, setWatchlistIntelligence] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState("NVDA");
  const [tickerDetail, setTickerDetail] = useState(null);
  const [tickerIntelligence, setTickerIntelligence] = useState(null);
  const [activeMoverTab, setActiveMoverTab] = useState("gainers");
  const [tickerFilter, setTickerFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const detailRequestRef = useRef(0);
  const compactLayout = viewportWidth < 760;
  const phoneLayout = viewportWidth < 520;
  const moverGridColumns = compactLayout
    ? phoneLayout
      ? "0.9fr 0.9fr 0.75fr"
      : "0.8fr 0.85fr 0.85fr 0.75fr"
    : "0.8fr 0.75fr 0.75fr 0.9fr 0.75fr 1.35fr";
  const moverTabs = [
    ["gainers", "Top Gainers"],
    ["losers", "Top Losers"],
    ["active", "Most Active"],
    ["premarket", "Premarket"],
  ];
  const panelStyle = {
    background: `linear-gradient(180deg, ${theme.panel2}, ${theme.panel})`,
    border: `1px solid ${theme.borderSoft || theme.border}`,
    borderRadius: "8px",
    minHeight: 0,
    overflow: "hidden",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  };
  const headerStyle = {
    padding: "10px",
    borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: compactLayout ? "wrap" : "nowrap",
    gap: "8px",
  };
  const buttonBase = {
    height: "28px",
    borderRadius: "6px",
    border: `1px solid ${theme.borderSoft || theme.border}`,
    background: theme.panel3 || theme.panel,
    color: theme.text,
    fontSize: "10px",
    fontWeight: 700,
    cursor: "pointer",
  };
  const monoStyle = {
    fontFamily: monoFont,
    fontVariantNumeric: "tabular-nums",
  };

  const applyOptimisticTickerDetail = useCallback((symbol, stock = null) => {
    const cleanSymbol = String(symbol || stock?.symbol || "").trim().toUpperCase();
    if (!cleanSymbol || !stock) return;

    const scannerSummary =
      stock.whyMoving ||
      stock.catalyst ||
      `${cleanSymbol} was selected from the live mover tape. Loading backend catalyst intelligence.`;

    setTickerDetail({
      symbol: cleanSymbol,
      price: stock.price || null,
      change: stock.change || stock.changePercent || null,
      companyName: stock.companyName || stock.name || stock.sector || "Scanner Selection",
      catalyst: scannerSummary,
      normalized: {
        symbol: cleanSymbol,
        price: stock.price || null,
        change: stock.change || stock.changePercent || null,
        source: stock.source || "scanner",
        catalyst: scannerSummary,
      },
      news: [],
      optimistic: true,
    });
    setTickerIntelligence({
      symbol: cleanSymbol,
      source: "scanner",
      sentiment: "neutral",
      attentionScore: Number(stock.scannerScore || stock.score || 0) || 50,
      summary: scannerSummary,
      whyMoving: [scannerSummary],
      possibleImpact: "Backend AI catalyst intelligence is loading for this ticker.",
      riskWarning: "Confirm the live chart, news freshness, liquidity, and risk before entry.",
      confidence: "scanner context",
    });
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [moversResponse, newsResponse, watchlistResponse] = await Promise.all([
        fetch(`${brokerApiUrl}/api/movers`),
        fetch(`${brokerApiUrl}/api/news?limit=18`),
        fetch(`${brokerApiUrl}/api/watchlist/intelligence?limit=12&newsLimit=4`, {
          headers: makeHeaders(user),
        }),
      ]);

      if (!moversResponse.ok) throw new Error("Movers API unavailable");
      if (!newsResponse.ok) throw new Error("News API unavailable");

      const moversData = await moversResponse.json();
      const newsData = await newsResponse.json();
      const watchlistData = watchlistResponse.ok ? await watchlistResponse.json() : null;
      const nextNews = normalizeNews(newsData.news);

      setMovers(moversData);
      setNews(nextNews);
      setWatchlist(watchlistData?.items || []);
      setWatchlistIntelligence(watchlistData?.items || []);
      setLastUpdated(new Date().toISOString());

      const summaryPairs = await Promise.all(
        nextNews.slice(0, 8).map(async (item) => {
          try {
            const response = await fetch(`${brokerApiUrl}/api/ai/summarize-news`, {
              method: "POST",
              headers: makeHeaders(user),
              body: JSON.stringify({ newsItem: item }),
            });

            if (!response.ok) return [item.id, null];

            const data = await response.json();
            return [item.id, data.summary || null];
          } catch {
            return [item.id, null];
          }
        })
      );

      setSummaries((prev) => ({
        ...prev,
        ...Object.fromEntries(summaryPairs.filter(([, summary]) => summary)),
      }));
    } catch (loadError) {
      setError(loadError.message || "Market intelligence failed to load.");
    }

    setLoading(false);
  }, [brokerApiUrl, user]);

  const loadTickerDetail = useCallback(
    async (symbol) => {
      const cleanSymbol = String(symbol || "").trim().toUpperCase();
      if (!cleanSymbol) return;
      const requestId = detailRequestRef.current + 1;
      detailRequestRef.current = requestId;

      setDetailLoading(true);

      try {
        const response = await fetch(`${brokerApiUrl}/api/ticker/${encodeURIComponent(cleanSymbol)}?includeAi=true`);
        if (!response.ok) throw new Error("Ticker detail unavailable");
        const detail = await response.json();

        if (requestId !== detailRequestRef.current) return;

        setTickerDetail(detail);
        setTickerIntelligence(detail.normalized?.intelligence || detail.catalystIntelligence || detail.aiSummary || null);
      } catch {
        if (requestId !== detailRequestRef.current) return;

        setTickerDetail(null);
        setTickerIntelligence(null);
      }

      if (requestId === detailRequestRef.current) {
        setDetailLoading(false);
      }
    },
    [brokerApiUrl]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadTickerDetail(selectedTicker);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadTickerDetail, selectedTicker]);

  useEffect(() => {
    const cleanSymbol = String(selectedStock || "").trim().toUpperCase();

    if (cleanSymbol && cleanSymbol !== selectedTicker) {
      const timer = window.setTimeout(() => {
        setSelectedTicker(cleanSymbol);
      }, 0);

      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [selectedStock, selectedTicker]);

  const activeRows = useMemo(() => {
    const rows = movers?.[activeMoverTab] || [];
    const query = tickerFilter.trim().toUpperCase();

    return rows
      .filter((row) => !query || String(row.symbol || "").includes(query))
      .slice(0, 24);
  }, [activeMoverTab, movers, tickerFilter]);

  const selectedNews = useMemo(() => {
    const detailNews = Array.isArray(tickerDetail?.news) ? tickerDetail.news : [];

    return [...detailNews, ...news]
      .filter((item) => !selectedTicker || item.relatedTicker === selectedTicker)
      .slice(0, 8);
  }, [news, selectedTicker, tickerDetail]);
  const normalizedTicker = tickerDetail?.normalized || null;
  const activeIntelligence = tickerIntelligence || normalizedTicker?.intelligence || tickerDetail?.catalystIntelligence || tickerDetail?.aiSummary || null;
  const watchlistRows = watchlistIntelligence.length ? watchlistIntelligence : watchlist;

  async function addWatch(symbol) {
    const cleanSymbol = String(symbol || selectedTicker || "").trim().toUpperCase();
    if (!cleanSymbol) return;

    await fetch(`${brokerApiUrl}/api/watchlist`, {
      method: "POST",
      headers: makeHeaders(user),
      body: JSON.stringify({ symbol: cleanSymbol }),
    }).catch(() => null);

    addSymbolToWatchlist?.(cleanSymbol);
    await loadDashboard();
  }

  async function removeWatch(symbol) {
    const cleanSymbol = String(symbol || "").trim().toUpperCase();
    if (!cleanSymbol) return;

    await fetch(`${brokerApiUrl}/api/watchlist/${encodeURIComponent(cleanSymbol)}`, {
      method: "DELETE",
      headers: makeHeaders(user),
    }).catch(() => null);

    removeWatchlistSymbol?.(cleanSymbol);
    await loadDashboard();
  }

  function openTicker(symbol, stock = null) {
    const cleanSymbol = String(symbol || stock?.symbol || "").trim().toUpperCase();
    if (!cleanSymbol) return;

    applyOptimisticTickerDetail(cleanSymbol, stock);
    setSelectedTicker(cleanSymbol);
    selectMainSymbol?.(cleanSymbol, stock || null);
  }

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: compactLayout ? "minmax(0, 1fr)" : "minmax(430px, 1.35fr) minmax(330px, 0.85fr)",
        gap: "8px",
        overflow: compactLayout ? "auto" : "hidden",
      }}
    >
      <section style={{ ...panelStyle, display: "grid", gridTemplateRows: "auto auto 1fr", minWidth: 0 }}>
        <div style={headerStyle}>
          <div>
            <div style={{ color: theme.text, fontSize: "15px", fontWeight: 700 }}>AI Market Intelligence</div>
            <div style={{ color: theme.muted, fontSize: "10px", marginTop: "2px" }}>
              {movers?.provider || movers?.source || "Scanner engine"} / {movers?.fallback || movers?.degraded ? "Fallback ranking" : "Primary feed"} / {movers?.counts?.movers || 0} ranked
            </div>
          </div>
          <button
            type="button"
            onClick={loadDashboard}
            style={{
              ...buttonBase,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "0 10px",
            }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: compactLayout ? "1fr" : "1fr auto",
            gap: "8px",
            padding: "8px 10px",
            borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
            background: theme.panel,
          }}
        >
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", minWidth: 0 }}>
            {moverTabs
              .filter(([id]) => !phoneLayout || id !== "premarket")
              .map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveMoverTab(id)}
                style={{
                  ...buttonBase,
                  padding: "0 9px",
                  background: activeMoverTab === id ? theme.blue : theme.panel2,
                  color: activeMoverTab === id ? "#fff" : theme.text,
                  border: `1px solid ${activeMoverTab === id ? "rgba(45,140,255,0.7)" : theme.borderSoft || theme.border}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ position: "relative", width: compactLayout ? "100%" : "170px" }}>
            <Search size={13} style={{ position: "absolute", left: "8px", top: "8px", color: theme.muted }} />
            <input
              value={tickerFilter}
              onChange={(event) => setTickerFilter(event.target.value.toUpperCase())}
              placeholder="Filter ticker"
              style={{
                width: "100%",
                height: "28px",
                padding: "0 8px 0 26px",
                background: theme.panel2,
                border: `1px solid ${theme.borderSoft || theme.border}`,
                color: theme.text,
                borderRadius: "6px",
                fontSize: "10px",
                fontWeight: 500,
              }}
            />
          </div>
        </div>

        <div style={{ overflow: "auto", minHeight: 0, padding: "0 10px 10px" }}>
          {loading ? (
            <LoadingBlock theme={theme} label="Loading market intelligence" />
          ) : error ? (
            <EmptyBlock theme={theme} title="Market intelligence unavailable" detail={error} />
          ) : activeRows.length === 0 ? (
            <EmptyBlock theme={theme} title="No movers found" detail="Change tab or filter to restore scanner rows." />
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: moverGridColumns,
                  gap: "8px",
                  color: theme.muted,
                  fontSize: "9px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "9px 0 7px",
                  borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
                  position: "sticky",
                  top: 0,
                  background: theme.panel,
                  zIndex: 2,
                }}
              >
                <div>Ticker</div>
                {!compactLayout && <div>Price</div>}
                <div>Move</div>
                {!phoneLayout && <div>Volume</div>}
                <div>RVOL</div>
                {!compactLayout && <div>Why Attention</div>}
              </div>

              {activeRows.map((row) => {
                const move = parsePercent(row.change);
                const positive = move >= 0;
                const selected = row.symbol === selectedTicker;
                const estimatedVolume = Math.max(
                  1_000_000,
                  Number(row.avgVolume || row.averageVolume || 0) * Math.max(Number(row.relativeVolume || 1), 1)
                );
                const volumeDisplay = row.volume || formatCompactNumber(estimatedVolume);

                return (
                  <button
                    key={`${activeMoverTab}-${row.symbol}`}
                    type="button"
                    data-market-mover-symbol={row.symbol}
                    data-market-mover-selected={selected ? "true" : "false"}
                    onClick={() => openTicker(row.symbol, row)}
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: moverGridColumns,
                      gap: "8px",
                      alignItems: "center",
                      padding: "9px 0",
                      border: "none",
                      borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
                      background: selected ? "rgba(25,198,216,0.10)" : "transparent",
                      color: theme.text,
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "10px",
                    }}
                  >
                    <div style={{ ...monoStyle, fontWeight: 700, color: selected ? theme.cyan || theme.blue : theme.text }}>
                      {row.symbol}
                    </div>
                    {!compactLayout && <div style={{ ...monoStyle, fontWeight: 700 }}>${Number(row.price || 0).toFixed(2)}</div>}
                    <div
                      style={{
                        ...monoStyle,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                        color: positive ? theme.green : theme.red,
                        fontWeight: 700,
                      }}
                    >
                      {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {row.change}
                    </div>
                    {!phoneLayout && <div style={{ ...monoStyle, color: theme.muted, fontWeight: 500 }}>{volumeDisplay}</div>}
                    <div style={{ ...monoStyle, color: Number(row.relativeVolume || 0) >= 1.5 ? theme.green : theme.muted, fontWeight: 700 }}>
                      {row.relativeVolume ? `${Number(row.relativeVolume).toFixed(2)}x` : "1.00x"}
                    </div>
                    {!compactLayout && (
                      <div style={{ color: theme.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.whyMoving || row.catalyst || "Scanner activity requires confirmation."}
                      </div>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </section>

      <aside style={{ display: "grid", gridTemplateRows: "minmax(220px, 0.9fr) minmax(180px, 0.65fr)", gap: "8px", minHeight: 0 }}>
        <section style={{ ...panelStyle, display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
          <div style={headerStyle}>
            <div>
              <div style={{ color: theme.text, fontSize: "13px", fontWeight: 700 }}>
                Catalyst Intelligence
              </div>
              <div style={{ color: theme.muted, fontSize: "10px", marginTop: "2px" }}>
                {selectedTicker} news, AI summary, impact, and risk.
              </div>
            </div>
            <button
              type="button"
              onClick={() => addWatch(selectedTicker)}
              style={{ ...buttonBase, padding: "0 9px", display: "inline-flex", alignItems: "center", gap: "5px" }}
            >
              <Star size={13} />
              Watch
            </button>
          </div>

          <div style={{ overflow: "auto", minHeight: 0, padding: "10px", display: "grid", gap: "8px", alignContent: "start" }}>
            {detailLoading ? (
              <LoadingBlock theme={theme} label={`Loading ${selectedTicker} detail`} />
            ) : (
              <div
                style={{
                  background: theme.panel3 || theme.panel2,
                  border: `1px solid ${theme.borderSoft || theme.border}`,
                  borderRadius: "8px",
                  padding: "9px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    flexDirection: phoneLayout ? "column" : "row",
                    gap: "8px",
                  }}
                >
                  <div>
                    <div style={{ ...monoStyle, color: theme.text, fontSize: "21px", fontWeight: 700, lineHeight: 1 }}>
                      {selectedTicker}
                    </div>
                    <div style={{ color: theme.muted, fontSize: "10px", marginTop: "4px" }}>
                      {tickerDetail?.companyName || normalizedTicker?.source || "Active Equity"}
                    </div>
                  </div>
                  <div style={{ textAlign: phoneLayout ? "left" : "right" }}>
                    <div style={{ ...monoStyle, color: theme.text, fontSize: "14px", fontWeight: 700 }}>
                      {normalizedTicker?.price || tickerDetail?.price ? `$${Number(normalizedTicker?.price || tickerDetail.price).toFixed(2)}` : "Pending"}
                    </div>
                    <div style={{ ...monoStyle, color: parsePercent(normalizedTicker?.change || tickerDetail?.change) >= 0 ? theme.green : theme.red, fontSize: "11px", fontWeight: 700 }}>
                      {normalizedTicker?.change || tickerDetail?.change || "Pending"}
                    </div>
                  </div>
                </div>
                <div style={{ color: theme.muted, fontSize: "10px", lineHeight: "1.45", marginTop: "8px" }}>
                  {activeIntelligence?.summary || normalizedTicker?.catalyst || tickerDetail?.catalyst || "Waiting for a confirmed catalyst."}
                </div>
                {activeIntelligence && (
                  <div
                    style={{
                      marginTop: "9px",
                      display: "grid",
                      gridTemplateColumns: phoneLayout ? "1fr" : "0.5fr 0.5fr 1fr",
                      gap: "7px",
                    }}
                  >
                    <div
                      style={{
                        background: theme.panel,
                        border: `1px solid ${theme.borderSoft || theme.border}`,
                        borderRadius: "7px",
                        padding: "7px",
                      }}
                    >
                      <div style={{ color: theme.muted, fontSize: "8px", fontWeight: 900, textTransform: "uppercase" }}>Sentiment</div>
                      <div style={{ color: sentimentColor(theme, activeIntelligence.sentiment), fontSize: "11px", fontWeight: 900, textTransform: "uppercase" }}>
                        {activeIntelligence.sentiment || "neutral"}
                      </div>
                    </div>
                    <div
                      style={{
                        background: theme.panel,
                        border: `1px solid ${theme.borderSoft || theme.border}`,
                        borderRadius: "7px",
                        padding: "7px",
                      }}
                    >
                      <div style={{ color: theme.muted, fontSize: "8px", fontWeight: 900, textTransform: "uppercase" }}>Attention</div>
                      <div style={{ ...monoStyle, color: theme.text, fontSize: "11px", fontWeight: 900 }}>
                        {Math.round(Number(activeIntelligence.attentionScore || 0))}/100
                      </div>
                    </div>
                    <div
                      style={{
                        background: theme.panel,
                        border: `1px solid ${theme.borderSoft || theme.border}`,
                        borderRadius: "7px",
                        padding: "7px",
                      }}
                    >
                      <div style={{ color: theme.muted, fontSize: "8px", fontWeight: 900, textTransform: "uppercase" }}>Impact</div>
                      <div style={{ color: theme.text, fontSize: "10px", lineHeight: 1.35 }}>
                        {activeIntelligence.possibleImpact}
                      </div>
                    </div>
                  </div>
                )}
                {Array.isArray(activeIntelligence?.whyMoving) && activeIntelligence.whyMoving.length > 0 && (
                  <div style={{ marginTop: "8px", display: "grid", gap: "4px" }}>
                    {activeIntelligence.whyMoving.slice(0, 3).map((reason, index) => (
                      <div key={`${selectedTicker}-why-${index}`} style={{ color: theme.muted, fontSize: "10px", lineHeight: 1.35 }}>
                        <span style={{ color: theme.cyan || theme.blue, fontWeight: 900 }}>Why:</span> {reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(selectedNews.length ? selectedNews : news.slice(0, 8)).map((item) => {
              const summary = summaries[item.id] || item.aiSummary;
              const color = sentimentColor(theme, summary?.sentiment);

              return (
                <article
                  key={item.id}
                  style={{
                    background: theme.panel3 || theme.panel2,
                    border: `1px solid ${theme.borderSoft || theme.border}`,
                    borderRadius: "8px",
                    padding: "9px",
                    display: "grid",
                    gap: "7px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => openTicker(item.relatedTicker)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: theme.blue,
                        fontSize: "10px",
                        fontWeight: 700,
                        fontFamily: monoFont,
                        fontVariantNumeric: "tabular-nums",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      {item.relatedTicker || "MARKET"}
                    </button>
                    <span style={{ ...monoStyle, color: theme.muted, fontSize: "9px", fontWeight: 500 }}>
                      {formatTime(item.timestamp)} / {item.source}
                    </span>
                  </div>
                  <div style={{ color: theme.text, fontSize: "11px", fontWeight: 700, lineHeight: "1.35" }}>
                    {item.headline}
                  </div>
                  {summary ? (
                    <div style={{ display: "grid", gap: "5px", color: theme.muted, fontSize: "10px", lineHeight: "1.42" }}>
                      <div>
                        <span style={{ color, fontWeight: 700, textTransform: "uppercase" }}>
                          {summary.sentiment || "neutral"}
                        </span>{" "}
                        {summary.summary}
                      </div>
                      <div style={{ color: theme.text }}>{summary.marketImpact}</div>
                      <div style={{ display: "flex", gap: "5px", color: theme.amber }}>
                        <AlertTriangle size={12} />
                        <span>{summary.riskWarning}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: theme.muted, fontSize: "10px" }}>
                      AI catalyst summary pending.
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section style={{ ...panelStyle, display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
          <div style={headerStyle}>
            <div>
              <div style={{ color: theme.text, fontSize: "13px", fontWeight: 700 }}>Watchlist Catalysts</div>
              <div style={{ color: theme.muted, fontSize: "10px", marginTop: "2px" }}>
                Saved locally/server-side per user where available.
              </div>
            </div>
            <span style={{ ...monoStyle, color: theme.cyan || theme.blue, fontSize: "10px", fontWeight: 700 }}>
              {watchlistRows.length || localWatchlist.length}
            </span>
          </div>

          <div style={{ overflow: "auto", minHeight: 0, padding: "10px", display: "grid", gap: "7px", alignContent: "start" }}>
            {(watchlistRows.length ? watchlistRows : localWatchlist).length === 0 ? (
              <EmptyBlock theme={theme} title="Watchlist empty" detail="Add tickers from the scanner to monitor catalyst flow." />
            ) : (
              (watchlistRows.length ? watchlistRows : localWatchlist).slice(0, 14).map((item) => {
                const symbol = item.symbol;
                const intel = item.intelligence || null;
                const catalyst =
                  intel?.summary ||
                  item.latestCatalyst?.headline ||
                  item.catalyst ||
                  "Latest catalyst pending.";
                const stock = item.stock || item;

                return (
                  <div
                    key={symbol}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: "7px",
                      alignItems: "center",
                      padding: "7px",
                      background: theme.panel3 || theme.panel2,
                      border: `1px solid ${theme.borderSoft || theme.border}`,
                      borderRadius: "7px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => openTicker(symbol)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: theme.text,
                        padding: 0,
                        textAlign: "left",
                        cursor: "pointer",
                        minWidth: 0,
                      }}
                    >
                      <div style={{ ...monoStyle, fontSize: "11px", fontWeight: 700 }}>{symbol}</div>
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          alignItems: "center",
                          flexWrap: "wrap",
                          marginTop: "2px",
                          ...monoStyle,
                          color: theme.muted,
                          fontSize: "9px",
                        }}
                      >
                        {stock.price && <span>${Number(stock.price).toFixed(2)}</span>}
                        {stock.change && (
                          <span style={{ color: parsePercent(stock.change) >= 0 ? theme.green : theme.red }}>
                            {stock.change}
                          </span>
                        )}
                        {intel?.sentiment && (
                          <span style={{ color: sentimentColor(theme, intel.sentiment), textTransform: "uppercase" }}>
                            {intel.sentiment}
                          </span>
                        )}
                        {intel?.attentionScore && <span>{Math.round(Number(intel.attentionScore))}/100</span>}
                      </div>
                      <div style={{ color: theme.muted, fontSize: "9px", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {catalyst}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeWatch(symbol)}
                      style={{ ...buttonBase, height: "24px", padding: "0 7px", fontSize: "9px" }}
                    >
                      Remove
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <div style={{ color: movers?.degraded || movers?.fallback ? theme.amber : theme.muted, fontSize: "9px", fontWeight: 850 }}>
          Source: {movers?.provider || movers?.source || "Pending"} / {movers?.fallback || movers?.degraded ? "Fallback mode" : "Primary feed"} / {formatAgeMs(movers?.cacheAgeMs)} / Updated {formatTime(movers?.updatedAt || lastUpdated)}
        </div>
      </aside>
    </div>
  );
}
