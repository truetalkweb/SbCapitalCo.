import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Info, Maximize2, Plus } from "lucide-react";
import { terminalMonoFont } from "../../config/terminalConfig";
import {
  formatCompactNumber,
  formatPercent,
  formatPrice,
} from "../../utils/dashboardFormatters";
import { formatPacificTime } from "../../utils/timeFormatters";
import { createVisibilityAwarePoller } from "../../utils/visibilityScheduler";

const OPPORTUNITY_TABS = [
  "Gainers",
  "Losers",
  "Unusual Volume",
  "New Highs",
  "New Lows",
  "Most Active",
  "News Movers",
];

const PERIOD_FIELDS = {
  "1D": ["changePercent", "percentChange", "changesPercentage", "change"],
  "1W": ["weekChangePercent", "change1W", "performanceWeek"],
  "1M": ["monthChangePercent", "change1M", "performanceMonth"],
  YTD: ["ytdChangePercent", "changeYtd", "performanceYtd"],
};

function numberOrNull(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(String(value).replace(/[$,%+,x]/g, "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function valueFrom(row, fields) {
  for (const field of fields) {
    const value = numberOrNull(row?.[field]);
    if (value !== null) return value;
  }
  return null;
}

function symbolOf(row) {
  return String(row?.symbol || row?.ticker || "").trim().toUpperCase();
}

function uniqueRows(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const symbol = symbolOf(row);
    if (!symbol || seen.has(symbol)) return false;
    seen.add(symbol);
    return true;
  });
}

function useMarketPulseSeries(brokerApiUrl, rows) {
  const [seriesBySymbol, setSeriesBySymbol] = useState({});

  useEffect(() => {
    if (!brokerApiUrl) return undefined;
    let cancelled = false;
    let activeController = null;
    const symbols = ["SPY", "QQQ", "DIA", "IWM", "VIXM"];

    const load = async () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      const settled = await Promise.allSettled(symbols.map(async (symbol) => {
        const response = await fetch(`${brokerApiUrl}/api/questrade/candles/${symbol}?timeframe=5m`, {
          signal: controller.signal,
        });
        if (!response.ok) return null;
        const payload = await response.json();
        const sparkline = (Array.isArray(payload.candles) ? payload.candles : [])
          .map((candle) => numberOrNull(candle.close))
          .filter((value) => value !== null)
          .slice(-36);
        if (sparkline.length < 2 || payload.fallback || payload.degraded) return null;
        return {
          symbol,
          sparkline,
          source: payload.cached ? "Questrade cached" : payload.source || "Questrade",
          updatedAt: payload.updatedAt || null,
          cached: Boolean(payload.cached),
        };
      }));

      if (cancelled) return;
      const next = {};
      settled.forEach((result) => {
        if (result.status === "fulfilled" && result.value) next[result.value.symbol] = result.value;
      });
      setSeriesBySymbol(next);
    };

    const stopPolling = createVisibilityAwarePoller(() => load().catch(() => {
      if (!cancelled) setSeriesBySymbol({});
    }), 5 * 60_000, { immediate: true });
    return () => {
      cancelled = true;
      activeController?.abort();
      stopPolling();
    };
  }, [brokerApiUrl]);

  return useMemo(() => rows.map((row) => ({
    ...row,
    ...(seriesBySymbol[symbolOf(row)] || {}),
  })), [rows, seriesBySymbol]);
}

function dataMode(row = {}) {
  if (!row || row.dataMode === "unavailable") return "Unavailable";
  if (row.delayed) return "Delayed";
  if (row.cached) return "Cached";
  if (row.fallback || row.degraded) return "Fallback";
  return "Live";
}

function freshnessLabel(row = {}) {
  if (!row || row.dataMode === "unavailable") return "Unavailable";
  if (row.delayed) return "Delayed";
  if (row.cached) return "Cached";

  const rawTimestamp = row.lastTradeTime || row.updatedAt || row.timestamp;
  const timestamp = rawTimestamp ? new Date(rawTimestamp) : null;
  if (!timestamp || Number.isNaN(timestamp.getTime())) return "Freshness unavailable";

  return `Updated ${formatPacificTime(timestamp)} PT`;
}

function Card({ theme, title, action, children, style = {} }) {
  return (
    <section
      style={{
        minWidth: 0,
        minHeight: 0,
        border: `1px solid ${theme.borderSoft || theme.border}`,
        borderRadius: 8,
        background: theme.panel,
        overflow: "hidden",
        ...style,
      }}
    >
      {(title || action) && (
        <header
          style={{
            minHeight: 40,
            padding: "0 13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
          }}
        >
          <h2 style={{ margin: 0, color: theme.text, fontSize: 13, fontWeight: 850, textTransform: "uppercase" }}>{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

function EmptyState({ theme, children }) {
  return (
    <div role="status" style={{ minHeight: 92, padding: 18, display: "grid", placeItems: "center", color: theme.muted, textAlign: "center", fontSize: 12, lineHeight: 1.45 }}>
      {children}
    </div>
  );
}

function Sparkline({ theme, row }) {
  const values = (row?.sparkline || row?.intraday || row?.history || [])
    .map((value) => numberOrNull(typeof value === "object" ? value.close ?? value.value : value))
    .filter((value) => value !== null);
  const move = valueFrom(row, PERIOD_FIELDS["1D"]);
  const color = move === null ? theme.muted : move >= 0 ? theme.green : theme.red;

  if (values.length < 2) {
    return <span style={{ color: theme.muted, fontSize: 10 }}>No intraday series</span>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 116;
  const height = 34;
  const path = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - 4 - ((value - min) / range) * (height - 8);
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} aria-label={`${symbolOf(row)} intraday price series`} style={{ width: 116, height: 34, display: "block" }}>
      <path d={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function MarketPulseRow({ theme, rows = [], onSelect }) {
  const wanted = ["SPY", "QQQ", "DIA", "IWM", "VIXM"];
  const bySymbol = new Map(rows.map((row) => [symbolOf(row), row]));

  return (
    <section aria-label="Market pulse" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(150px, 1fr))", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 8, overflow: "auto", background: theme.panel }}>
      {wanted.map((symbol, index) => {
        const row = bySymbol.get(symbol) || { symbol, dataMode: "unavailable" };
        const price = numberOrNull(row.price ?? row.last);
        const move = valueFrom(row, PERIOD_FIELDS["1D"]);
        const tone = move === null ? theme.muted : move >= 0 ? theme.green : theme.red;
        const mode = dataMode(row);
        const freshness = freshnessLabel(row);

        return (
          <button
            key={symbol}
            type="button"
            onClick={() => onSelect?.(symbol)}
            aria-label={`Select ${symbol}`}
            style={{
              minWidth: 150,
              minHeight: 82,
              padding: "10px 12px",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              alignItems: "center",
              gap: 8,
              border: 0,
              borderRight: index === wanted.length - 1 ? 0 : `1px solid ${theme.borderSoft || theme.border}`,
              background: "transparent",
              color: theme.text,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", color: theme.muted, fontFamily: terminalMonoFont, fontSize: 11, fontWeight: 800 }}>{symbol}</span>
              <span style={{ display: "block", marginTop: 4, fontFamily: terminalMonoFont, fontSize: 17, fontWeight: 900 }}>{price === null || price <= 0 ? "Unavailable" : formatPrice(price)}</span>
              <span style={{ display: "block", marginTop: 3, color: tone, fontFamily: terminalMonoFont, fontSize: 11, fontWeight: 850 }}>{move === null ? mode : formatPercent(move)}</span>
              <span
                title={`${row.source || mode} · ${freshness}`}
                style={{ display: "block", marginTop: 3, color: theme.muted, fontSize: 9, textTransform: "uppercase" }}
              >
                {row.source || mode} · {freshness}
              </span>
            </span>
            <Sparkline theme={theme} row={row} />
          </button>
        );
      })}
    </section>
  );
}

function BreadthMetric({ theme, label, positiveLabel, negativeLabel, positive, negative }) {
  const total = positive + negative;
  const available = total > 0;
  const positivePercent = available ? (positive / total) * 100 : 0;

  return (
    <div style={{ minWidth: 0, padding: "10px 12px", borderRight: `1px solid ${theme.borderSoft || theme.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, color: theme.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>
        <span>{label}</span>
        <span title="Calculated only from rows containing the required provider fields"><Info size={12} /></span>
      </div>
      {available ? (
        <>
          <div style={{ marginTop: 7, display: "flex", justifyContent: "space-between", gap: 8, fontFamily: terminalMonoFont, fontSize: 11 }}>
            <span style={{ color: theme.green }}>{positiveLabel} {positive} ({positivePercent.toFixed(1)}%)</span>
            <span style={{ color: theme.red }}>{negativeLabel} {negative} ({(100 - positivePercent).toFixed(1)}%)</span>
          </div>
          <div style={{ marginTop: 7, height: 6, display: "flex", borderRadius: 99, overflow: "hidden", background: theme.panel2 }}>
            <span style={{ width: `${positivePercent}%`, background: theme.green }} />
            <span style={{ flex: 1, background: theme.red }} />
          </div>
        </>
      ) : (
        <div style={{ marginTop: 10, color: theme.muted, fontSize: 11 }}>Unavailable from current provider fields</div>
      )}
    </div>
  );
}

export function MarketBreadthStrip({ theme, rows = [] }) {
  const authoritative = uniqueRows(rows).filter((row) => !row.fallback && !row.degraded);
  const moves = authoritative.map((row) => valueFrom(row, PERIOD_FIELDS["1D"])).filter((value) => value !== null);
  const highs = authoritative.filter((row) => row.newHigh === true || /new high/i.test(String(row.signal || row.category || ""))).length;
  const lows = authoritative.filter((row) => row.newLow === true || /new low/i.test(String(row.signal || row.category || ""))).length;
  const sma50Above = authoritative.filter((row) => row.aboveSma50 === true || (numberOrNull(row.price) !== null && numberOrNull(row.sma50) !== null && numberOrNull(row.price) > numberOrNull(row.sma50))).length;
  const sma50Below = authoritative.filter((row) => row.aboveSma50 === false || (numberOrNull(row.price) !== null && numberOrNull(row.sma50) !== null && numberOrNull(row.price) < numberOrNull(row.sma50))).length;
  const sma200Above = authoritative.filter((row) => row.aboveSma200 === true || (numberOrNull(row.price) !== null && numberOrNull(row.sma200) !== null && numberOrNull(row.price) > numberOrNull(row.sma200))).length;
  const sma200Below = authoritative.filter((row) => row.aboveSma200 === false || (numberOrNull(row.price) !== null && numberOrNull(row.sma200) !== null && numberOrNull(row.price) < numberOrNull(row.sma200))).length;

  return (
    <section aria-label="Market breadth" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(220px, 1fr))", overflow: "auto", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 8, background: theme.panel }}>
      <BreadthMetric theme={theme} label="Market breadth" positiveLabel="Adv" negativeLabel="Dec" positive={moves.filter((value) => value > 0).length} negative={moves.filter((value) => value < 0).length} />
      <BreadthMetric theme={theme} label="52-week range" positiveLabel="High" negativeLabel="Low" positive={highs} negative={lows} />
      <BreadthMetric theme={theme} label="SMA 50" positiveLabel="Above" negativeLabel="Below" positive={sma50Above} negative={sma50Below} />
      <BreadthMetric theme={theme} label="SMA 200" positiveLabel="Above" negativeLabel="Below" positive={sma200Above} negative={sma200Below} />
    </section>
  );
}

function rowsForTab(tab, groups, news) {
  const all = uniqueRows(Object.values(groups).flat());
  const newsSymbols = new Set(news.filter((item) => !item.fallback).map((item) => symbolOf(item.relatedTicker ? { symbol: item.relatedTicker } : item)));
  if (tab === "Gainers") return groups.gainers || [];
  if (tab === "Losers") return groups.losers || [];
  if (tab === "Most Active") return groups.active || [];
  if (tab === "Unusual Volume") return [...(groups.relativeVolume || all)].sort((a, b) => (numberOrNull(b.relativeVolume ?? b.rvol) || 0) - (numberOrNull(a.relativeVolume ?? a.rvol) || 0));
  if (tab === "New Highs") return all.filter((row) => row.newHigh === true || /new high/i.test(String(row.signal || row.category || "")));
  if (tab === "New Lows") return all.filter((row) => row.newLow === true || /new low/i.test(String(row.signal || row.category || "")));
  if (tab === "News Movers") return all.filter((row) => newsSymbols.has(symbolOf(row)));
  return all;
}

function handleTabKey(event, values, select) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const currentIndex = values.indexOf(event.currentTarget.dataset.tabValue);
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? values.length - 1
      : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + values.length) % values.length;
  select(values[nextIndex]);
  const tabs = event.currentTarget.parentElement?.querySelectorAll('[role="tab"]');
  tabs?.[nextIndex]?.focus();
}

export function OpportunityBoard({ theme, groups = {}, news = [], selectedSymbol, onSelect, onOpenChart }) {
  const [tab, setTab] = useState("Gainers");
  const rows = uniqueRows(rowsForTab(tab, groups, news)).slice(0, 12);

  return (
    <Card
      theme={theme}
      title="Opportunity Board"
      action={<span style={{ color: theme.muted, fontSize: 10 }}>{rows.length} qualified rows</span>}
    >
      <div role="tablist" aria-label="Opportunity categories" style={{ padding: "9px 10px", display: "flex", gap: 5, overflowX: "auto", borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}>
        {OPPORTUNITY_TABS.map((item) => (
          <button key={item} type="button" role="tab" data-tab-value={item} aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} onClick={() => setTab(item)} onKeyDown={(event) => handleTabKey(event, OPPORTUNITY_TABS, setTab)} style={{ minHeight: 28, padding: "0 10px", borderRadius: 5, border: `1px solid ${tab === item ? theme.blue : theme.borderSoft || theme.border}`, background: tab === item ? `${theme.blue}25` : "transparent", color: tab === item ? theme.text : theme.muted, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap", cursor: "pointer" }}>{item}</button>
        ))}
      </div>
      <div style={{ overflow: "auto" }}>
        <div role="row" style={{ minWidth: 760, minHeight: 32, padding: "0 12px", display: "grid", gridTemplateColumns: "90px 90px 90px 90px 100px 1fr 70px", alignItems: "center", gap: 10, color: theme.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}>
          {["Symbol", "Price", "Move", "Gap", "RVOL", "Catalyst", "Score"].map((label) => <span key={label}>{label}</span>)}
        </div>
        {rows.length === 0 ? <EmptyState theme={theme}>No provider rows meet the selected category. Nothing has been synthesized.</EmptyState> : rows.map((row) => {
          const symbol = symbolOf(row);
          const move = valueFrom(row, PERIOD_FIELDS["1D"]);
          const gap = numberOrNull(row.gapPercent ?? row.gap);
          const rvol = numberOrNull(row.relativeVolume ?? row.rvol);
          return (
            <button key={symbol} type="button" onDoubleClick={() => onOpenChart?.(symbol)} onClick={() => onSelect?.(symbol, row)} style={{ width: "100%", minWidth: 760, minHeight: 42, padding: "0 12px", display: "grid", gridTemplateColumns: "90px 90px 90px 90px 100px 1fr 70px", alignItems: "center", gap: 10, border: 0, borderBottom: `1px solid ${theme.borderSoft || theme.border}`, background: selectedSymbol === symbol ? `${theme.blue}20` : "transparent", color: theme.text, textAlign: "left", cursor: "pointer" }}>
              <strong style={{ fontFamily: terminalMonoFont }}>{symbol}</strong>
              <span style={{ fontFamily: terminalMonoFont }}>{numberOrNull(row.price) === null ? "Unavailable" : formatPrice(row.price)}</span>
              <span style={{ color: move === null ? theme.muted : move >= 0 ? theme.green : theme.red, fontFamily: terminalMonoFont }}>{move === null ? "Unavailable" : formatPercent(move)}</span>
              <span style={{ fontFamily: terminalMonoFont }}>{gap === null ? "Unavailable" : formatPercent(gap)}</span>
              <span style={{ fontFamily: terminalMonoFont }}>{rvol === null ? "Unavailable" : `${rvol.toFixed(1)}x`}</span>
              <span title={row.catalyst || row.whyMoving} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: theme.muted }}>{row.catalyst || row.whyMoving || "No confirmed catalyst"}</span>
              <span style={{ fontFamily: terminalMonoFont, color: theme.blue }}>{numberOrNull(row.score) ?? "—"}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export function SectorHeatmap({ theme, rows = [], onSelect }) {
  const [period, setPeriod] = useState("1D");
  const heatmapRows = useMemo(() => uniqueRows(rows)
    .map((row) => ({
      ...row,
      symbol: symbolOf(row),
      sector: String(row.sector || "").trim(),
      marketCapValue: numberOrNull(row.marketCap),
      periodMove: valueFrom(row, PERIOD_FIELDS[period]),
    }))
    .filter((row) => !row.synthetic && !row.fallback && !row.degraded && row.symbol && row.sector && !/unknown|not reported|unavailable/i.test(row.sector) && row.periodMove !== null)
    .sort((a, b) => (b.marketCapValue || 0) - (a.marketCapValue || 0))
    .slice(0, 36), [period, rows]);
  const maxCap = Math.max(...heatmapRows.map((row) => row.marketCapValue || 0), 1);
  const sectorGroups = useMemo(() => {
    const groups = new Map();
    heatmapRows.forEach((row) => {
      if (!groups.has(row.sector)) groups.set(row.sector, []);
      groups.get(row.sector).push(row);
    });

    return [...groups.entries()].sort((a, b) => {
      const totalA = a[1].reduce((total, row) => total + (row.marketCapValue || 0), 0);
      const totalB = b[1].reduce((total, row) => total + (row.marketCapValue || 0), 0);
      return totalB - totalA;
    });
  }, [heatmapRows]);

  return (
    <Card
      theme={theme}
      title="Sector Heatmap"
      action={<div role="tablist" aria-label="Heatmap period" style={{ display: "flex", gap: 4 }}>{Object.keys(PERIOD_FIELDS).map((item) => <button key={item} type="button" role="tab" data-tab-value={item} aria-selected={period === item} tabIndex={period === item ? 0 : -1} onClick={() => setPeriod(item)} onKeyDown={(event) => handleTabKey(event, Object.keys(PERIOD_FIELDS), setPeriod)} style={{ height: 25, minWidth: 34, border: `1px solid ${period === item ? theme.blue : theme.borderSoft || theme.border}`, borderRadius: 5, background: period === item ? `${theme.blue}24` : "transparent", color: period === item ? theme.text : theme.muted, fontSize: 10, cursor: "pointer" }}>{item}</button>)}</div>}
    >
      {heatmapRows.length === 0 ? (
        <EmptyState theme={theme}>No sector rows include a valid {period} performance field. The heatmap will populate when the provider supplies sector and period data.</EmptyState>
      ) : (
        <div style={{ padding: 8, display: "grid", gap: 8 }}>
          {sectorGroups.map(([sector, sectorRows]) => (
            <section key={sector} style={{ minWidth: 0 }}>
              <header style={{ minHeight: 24, display: "flex", alignItems: "center", justifyContent: "space-between", color: theme.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>
                <span>{sector}</span>
                <span style={{ fontFamily: terminalMonoFont }}>{sectorRows.length}</span>
              </header>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoRows: 54, gap: 4 }}>
                {sectorRows.map((row) => {
                  const intensity = Math.min(Math.abs(row.periodMove) / 5, 1);
                  const positive = row.periodMove >= 0;
                  const color = positive ? theme.green : theme.red;
                  const capRatio = row.marketCapValue / maxCap;
                  const span = capRatio > 0.45 ? 6 : capRatio > 0.18 ? 4 : capRatio > 0.06 ? 3 : 2;
                  return (
                    <button
                      key={row.symbol}
                      type="button"
                      title={`${row.symbol} · ${row.name || row.symbol}\n${row.sector}\n${period}: ${formatPercent(row.periodMove)}\nMarket cap: ${row.marketCapValue === null ? "Unavailable" : formatCompactNumber(row.marketCapValue, 2)}`}
                      onClick={() => onSelect?.(row.symbol, row)}
                      style={{ gridColumn: `span ${span}`, minWidth: 0, padding: 6, border: `1px solid ${color}55`, borderRadius: 4, background: `color-mix(in srgb, ${color} ${Math.round(18 + intensity * 50)}%, ${theme.panel2})`, color: theme.text, cursor: "pointer", overflow: "hidden" }}
                    >
                      <strong style={{ display: "block", fontFamily: terminalMonoFont, fontSize: span > 2 ? 12 : 10 }}>{row.symbol}</strong>
                      <span style={{ display: "block", marginTop: 3, fontFamily: terminalMonoFont, fontSize: 10 }}>{formatPercent(row.periodMove)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}

export function MarketRegimeCard({ theme, rows = [], marketIndexes = [] }) {
  const authoritative = uniqueRows(rows).filter((row) => !row.fallback && !row.degraded);
  const moves = authoritative.map((row) => valueFrom(row, PERIOD_FIELDS["1D"])).filter((value) => value !== null);
  const advancing = moves.filter((value) => value > 0).length;
  const ratio = moves.length ? advancing / moves.length : null;
  const volatility = marketIndexes.find((row) => ["VIX", "VIXM"].includes(symbolOf(row)));
  const volatilityMove = valueFrom(volatility, PERIOD_FIELDS["1D"]);
  let regime = "Incomplete";
  let tone = theme.muted;
  if (volatilityMove !== null && volatilityMove >= 2) {
    regime = "High Volatility";
    tone = theme.amber;
  } else if (ratio !== null && ratio >= 0.62) {
    regime = "Bullish";
    tone = theme.green;
  } else if (ratio !== null && ratio <= 0.38) {
    regime = "Risk-Off";
    tone = theme.red;
  } else if (ratio !== null) {
    regime = "Mixed";
    tone = theme.blue;
  }
  const confidence = moves.length >= 40 ? "High" : moves.length >= 15 ? "Moderate" : moves.length ? "Limited" : "Unavailable";

  return (
    <Card theme={theme} title="Market Regime">
      <div style={{ padding: 14, display: "grid", gap: 11 }}>
        <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ color: tone, fontSize: 20, fontWeight: 900 }}>{regime}</div>
            <div style={{ marginTop: 3, color: theme.muted, fontSize: 11 }}>Confidence: {confidence}</div>
          </div>
          <span style={{ color: theme.muted, fontFamily: terminalMonoFont, fontSize: 11 }}>{moves.length} verified rows</span>
        </div>
        <div style={{ display: "grid", gap: 7, color: theme.text, fontSize: 12 }}>
          <div>• Breadth: {ratio === null ? "unavailable" : `${(ratio * 100).toFixed(1)}% advancing`}</div>
          <div>• Volatility: {volatilityMove === null ? "provider field unavailable" : formatPercent(volatilityMove)}</div>
          <div>• Scope: provider rows only; fallback rows excluded</div>
        </div>
      </div>
    </Card>
  );
}

export function MarketEventsPanel({ theme, news = [], onSelect }) {
  const eventPattern = /\b(earnings|fomc|federal reserve|fed\b|cpi|inflation|jobs|payroll|rates?|economic|guidance)\b/i;
  const rows = news.filter((item) => !item.fallback && eventPattern.test(`${item.headline || ""} ${item.summary || ""}`)).slice(0, 6);

  return (
    <Card theme={theme} title="Market Events" action={<CalendarDays size={15} color={theme.muted} />}>
      {rows.length === 0 ? <EmptyState theme={theme}>No verified economic, Fed, or earnings event headlines are available in the current feed.</EmptyState> : rows.map((item, index) => {
        const ticker = item.relatedTicker || item.symbol || "MARKET";
        const content = (
          <div style={{ minHeight: 44, padding: "8px 12px", display: "grid", gridTemplateColumns: "70px minmax(0, 1fr) auto", alignItems: "center", gap: 10, borderBottom: index === rows.length - 1 ? 0 : `1px solid ${theme.borderSoft || theme.border}` }}>
            <span style={{ color: theme.muted, fontFamily: terminalMonoFont, fontSize: 10 }}>{item.time || "Recent"}</span>
            <span style={{ color: theme.text, fontSize: 12, lineHeight: 1.35 }}>{item.headline}</span>
            <span style={{ color: theme.blue, fontFamily: terminalMonoFont, fontSize: 10 }}>{ticker}</span>
          </div>
        );
        return item.url ? <a key={item.id || index} href={item.url} target="_blank" rel="noreferrer" onClick={() => onSelect?.(ticker)} style={{ color: "inherit", textDecoration: "none" }}>{content}</a> : <button key={item.id || index} type="button" onClick={() => onSelect?.(ticker)} style={{ width: "100%", padding: 0, border: 0, background: "transparent", textAlign: "left", cursor: "pointer" }}>{content}</button>;
      })}
    </Card>
  );
}

export default function DashboardMarketIntelligence({
  theme,
  viewportWidth = 1440,
  chart,
  marketIndexes = [],
  brokerApiUrl = "",
  breadthRows = [],
  scannerGroups = {},
  scannerMeta = {},
  news = [],
  newsMeta = {},
  selected,
  watchlist = [],
  onSelect,
  onOpenChart,
  onAddWatch,
}) {
  const compact = viewportWidth < 1180;
  const pulseRows = useMarketPulseSeries(brokerApiUrl, marketIndexes);
  const allHeatmapRows = uniqueRows([...breadthRows, ...Object.values(scannerGroups).flat()]);
  const selectedMove = valueFrom(selected, PERIOD_FIELDS["1D"]);

  return (
    <div style={{ display: "grid", gridAutoRows: "max-content", alignContent: "start", gap: 9, minWidth: 0, paddingBottom: 10 }}>
      <MarketPulseRow theme={theme} rows={pulseRows} onSelect={onSelect} />
      <MarketBreadthStrip theme={theme} rows={breadthRows} />

      <div style={{ display: "grid", gridTemplateColumns: compact ? "minmax(0, 1fr)" : "minmax(0, 1fr) 330px", gap: 9, minHeight: 480 }}>
        <Card theme={theme} title="Primary Chart" action={<button type="button" onClick={() => onOpenChart?.(selected?.symbol)} aria-label="Open full chart" style={{ border: 0, background: "transparent", color: theme.muted, cursor: "pointer" }}><Maximize2 size={15} /></button>}>
          <div style={{ height: 440, minHeight: 0 }}>{chart}</div>
        </Card>
        <Card theme={theme} title="My Watchlist" action={<Plus size={15} color={theme.muted} />}>
          <div style={{ maxHeight: 250, overflow: "auto" }}>
            {watchlist.slice(0, 7).map((row) => {
              const move = valueFrom(row, PERIOD_FIELDS["1D"]);
              return <button key={symbolOf(row)} type="button" onClick={() => onSelect?.(symbolOf(row), row)} style={{ width: "100%", minHeight: 36, padding: "0 11px", display: "grid", gridTemplateColumns: "1fr 82px 72px", alignItems: "center", border: 0, borderBottom: `1px solid ${theme.borderSoft || theme.border}`, background: symbolOf(row) === selected?.symbol ? `${theme.blue}20` : "transparent", color: theme.text, textAlign: "left", cursor: "pointer" }}><strong style={{ fontFamily: terminalMonoFont }}>{symbolOf(row)}</strong><span style={{ textAlign: "right", fontFamily: terminalMonoFont }}>{numberOrNull(row.price) === null ? "Unavailable" : formatPrice(row.price)}</span><span style={{ textAlign: "right", color: move === null ? theme.muted : move >= 0 ? theme.green : theme.red, fontFamily: terminalMonoFont }}>{move === null ? "—" : formatPercent(move)}</span></button>;
            })}
          </div>
          <div style={{ padding: 13, display: "grid", gap: 10, borderTop: `1px solid ${theme.borderSoft || theme.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div><strong style={{ color: theme.text, fontFamily: terminalMonoFont, fontSize: 18 }}>{selected?.symbol}</strong><div style={{ color: theme.muted, fontSize: 11 }}>{selected?.name || "Selected market context"}</div></div>
              <div style={{ textAlign: "right" }}><strong style={{ color: theme.text, fontFamily: terminalMonoFont }}>{numberOrNull(selected?.price) === null ? "Unavailable" : formatPrice(selected.price)}</strong><div style={{ color: selectedMove === null ? theme.muted : selectedMove >= 0 ? theme.green : theme.red, fontFamily: terminalMonoFont, fontSize: 11 }}>{selectedMove === null ? dataMode(selected) : formatPercent(selectedMove)}</div></div>
            </div>
            <div style={{ color: theme.muted, fontSize: 12, lineHeight: 1.4 }}>{selected?.catalyst || selected?.whyMoving || "No verified catalyst is available for the selected symbol."}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              <button type="button" onClick={() => onOpenChart?.(selected?.symbol)} style={{ height: 32, border: `1px solid ${theme.blue}`, borderRadius: 6, background: `${theme.blue}24`, color: theme.text, fontWeight: 800, cursor: "pointer" }}>Open Chart</button>
              <button type="button" onClick={() => onAddWatch?.(selected?.symbol)} style={{ height: 32, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: "transparent", color: theme.text, fontWeight: 800, cursor: "pointer" }}>Add Watch</button>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: compact ? "minmax(0, 1fr)" : "minmax(0, 1fr) 330px", gap: 9 }}>
        <OpportunityBoard theme={theme} groups={scannerGroups} news={news} selectedSymbol={selected?.symbol} onSelect={onSelect} onOpenChart={onOpenChart} />
        <MarketRegimeCard theme={theme} rows={breadthRows} marketIndexes={marketIndexes} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: compact ? "minmax(0, 1fr)" : "minmax(0, 1.45fr) minmax(300px, 0.55fr)", gap: 9 }}>
        <SectorHeatmap theme={theme} rows={allHeatmapRows} onSelect={onSelect} />
        <Card theme={theme} title="Data Confidence">
          <div style={{ padding: 14, display: "grid", gap: 10, color: theme.text, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span>Scanner</span><strong>{scannerMeta.cached ? "Cached" : scannerMeta.degraded ? "Limited" : scannerMeta.source || "Unavailable"}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span>News</span><strong>{newsMeta.cached ? "Cached" : newsMeta.degraded ? "Limited" : newsMeta.source || "Unavailable"}</strong></div>
            <div style={{ color: theme.muted, lineHeight: 1.45 }}>Unavailable breadth and performance fields remain visibly unavailable. No live values are synthesized.</div>
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: compact ? "minmax(0, 1fr)" : "minmax(0, 1.45fr) minmax(300px, 0.55fr)", gap: 9 }}>
        <Card theme={theme} title="Catalyst Feed" action={<span style={{ color: theme.muted, fontSize: 10 }}>{news.length} rows</span>}>
          {news.length === 0 ? <EmptyState theme={theme}>No verified or fallback catalyst rows are currently available.</EmptyState> : news.slice(0, 7).map((item, index) => {
            const ticker = item.relatedTicker || item.symbol || "MARKET";
            const content = <div style={{ minHeight: 42, padding: "7px 12px", display: "grid", gridTemplateColumns: "68px 110px minmax(0, 1fr) 60px", alignItems: "center", gap: 10, borderBottom: index === Math.min(news.length, 7) - 1 ? 0 : `1px solid ${theme.borderSoft || theme.border}` }}><span style={{ color: theme.muted, fontFamily: terminalMonoFont, fontSize: 10 }}>{item.time || "Recent"}</span><span style={{ color: theme.muted, fontSize: 10 }}>{item.source || "Market News"}</span><span style={{ color: theme.text, fontSize: 12, lineHeight: 1.35 }}>{item.headline}</span><span style={{ color: theme.blue, fontFamily: terminalMonoFont, fontSize: 10, textAlign: "right" }}>{ticker}</span></div>;
            return item.url ? <a key={item.id || index} href={item.url} target="_blank" rel="noreferrer" onClick={() => onSelect?.(ticker)} style={{ color: "inherit", textDecoration: "none" }}>{content}</a> : <button key={item.id || index} type="button" onClick={() => onSelect?.(ticker)} style={{ width: "100%", padding: 0, border: 0, background: "transparent", textAlign: "left", cursor: "pointer" }}>{content}</button>;
          })}
        </Card>
        <MarketEventsPanel theme={theme} news={news} onSelect={onSelect} />
      </div>

      <button type="button" onClick={() => onOpenChart?.(selected?.symbol)} style={{ justifySelf: "end", height: 30, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: "transparent", color: theme.muted, cursor: "pointer" }}>Open full workspace <ChevronRight size={14} /></button>
    </div>
  );
}
