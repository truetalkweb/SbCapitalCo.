import { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Download,
  Edit3,
  Filter,
  Lock,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Star,
  X,
} from "lucide-react";
import { terminalMonoFont, terminalSansFont } from "../../config/terminalConfig";
import { useDashboardData } from "../../hooks/useDashboardData";
import {
  formatCompactNumber,
  formatMultiple,
  formatPercent,
  formatPrice,
  formatSignedCurrency,
} from "../../utils/dashboardFormatters";
import {
  createNormalizedNewsFallback,
  normalizeNewsRow,
  normalizeScannerRow,
  rankScannerRows,
} from "../../utils/scannerNewsAdapters";

function num(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/[$,%+,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value, digits = 2) {
  return `$${num(value).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function pct(value, digits = 2) {
  const parsed = num(value);
  return `${parsed >= 0 ? "+" : ""}${parsed.toFixed(digits)}%`;
}

function moveOf(row) {
  return num(row?.changePercent ?? row?.change ?? row?.changesPercentage ?? row?.percentChange);
}

function toneColor(theme, value) {
  return num(value) >= 0 ? theme.green : theme.red;
}

function formatDetailValue(label, value) {
  if (label === "Volume" || label === "Avg Vol") {
    return typeof value === "string" ? value : formatCompactNumber(value, 2);
  }
  if (label === "Market Cap" || label === "Float") {
    return typeof value === "string" ? value : formatCompactNumber(value, 2);
  }
  if (label === "P/E" || label === "Beta" || label === "EPS") {
    return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : String(value);
  }
  return Number.isFinite(Number(value)) ? formatPrice(value) : String(value);
}

function sparkPoints(seed = 1, negative = false) {
  return Array.from({ length: 22 }, (_, index) => {
    const wave = Math.sin((index + seed) / 2.2) * 4;
    const drift = negative ? -index * 0.9 : index * 0.85;
    return 42 + wave + drift + ((index * seed) % 5);
  });
}

function MiniSparkline({ theme, negative = false, seed = 1, height = 34 }) {
  const points = sparkPoints(seed, negative);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const d = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 112;
      const y = height - 4 - ((point - min) / range) * (height - 8);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const color = negative ? theme.red : theme.green;

  return (
    <svg viewBox={`0 0 112 ${height}`} style={{ width: "100%", height, display: "block" }} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d={`${d} L112 ${height} L0 ${height} Z`} fill={color} opacity="0.12" />
    </svg>
  );
}

function PremiumCard({ theme, children, style = {}, title, action }) {
  return (
    <section
      style={{
        minWidth: 0,
        minHeight: 0,
        background: `linear-gradient(180deg, ${theme.panel}, ${theme.bg})`,
        border: `1px solid ${theme.borderSoft || theme.border}`,
        borderRadius: 8,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
        overflow: "hidden",
        ...style,
      }}
    >
      {(title || action) && (
        <div
          style={{
            minHeight: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "0 14px",
            borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
          }}
        >
          <h2 style={{ margin: 0, color: theme.text, fontSize: 13, fontWeight: 900, textTransform: "uppercase" }}>
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function PremiumTabs({ theme, tabs, active, onChange }) {
  const interactive = typeof onChange === "function";
  return (
    <div role="tablist" style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {tabs.map((tab) => {
        const id = typeof tab === "string" ? tab : tab.id;
        const label = typeof tab === "string" ? tab : tab.label;
        const selected = active === id || active === label;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={!interactive}
            title={interactive ? "" : "Tab switching is visual in this premium pass"}
            onClick={() => onChange?.(id)}
            style={{
              height: 30,
              padding: "0 13px",
              borderRadius: 6,
              border: `1px solid ${selected ? "rgba(45,140,255,0.75)" : theme.borderSoft || theme.border}`,
              background: selected ? "linear-gradient(180deg, #176fd7, #0c4f9e)" : "rgba(255,255,255,0.018)",
              color: selected ? "#fff" : theme.muted,
              fontSize: 12,
              fontWeight: 800,
              cursor: interactive ? "pointer" : "not-allowed",
              opacity: interactive ? 1 : 0.72,
              outlineOffset: 2,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function StatusPill({ theme, children, tone = "neutral" }) {
  const color = tone === "good" ? theme.green : tone === "bad" ? theme.red : tone === "warn" ? theme.amber : theme.blue;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        minHeight: 22,
        padding: "0 8px",
        borderRadius: 6,
        border: `1px solid ${color}55`,
        background: `${color}18`,
        color,
        fontSize: 11,
        fontWeight: 850,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function ActionButton({ theme, children, active = false, danger = false, good = false, disabled = false, style = {}, ...props }) {
  const bg = danger
    ? "linear-gradient(180deg, #d43f3f, #a91f1f)"
    : good
      ? "linear-gradient(180deg, #129b72, #087250)"
      : active
        ? "linear-gradient(180deg, #247ee8, #0d58b5)"
        : "rgba(255,255,255,0.025)";
  return (
    <button
      type="button"
      disabled={disabled}
      {...props}
      style={{
        height: 34,
        border: `1px solid ${disabled ? theme.borderSoft || theme.border : active || danger || good ? "rgba(255,255,255,0.12)" : theme.borderSoft || theme.border}`,
        borderRadius: 6,
        background: disabled ? "rgba(255,255,255,0.015)" : bg,
        color: disabled ? theme.muted : active || danger || good ? "#fff" : theme.text,
        padding: "0 13px",
        fontSize: 12,
        fontWeight: 850,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.62 : 1,
        outlineOffset: 2,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function FilterBar({ theme, items = [], search = "Search..." }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <label style={{ position: "relative", flex: "1 1 220px", maxWidth: 300 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: 10, color: theme.muted }} />
        <input
          placeholder={search}
          aria-label={search}
          style={{
            width: "100%",
            height: 36,
            border: `1px solid ${theme.borderSoft || theme.border}`,
            borderRadius: 6,
            background: "rgba(255,255,255,0.02)",
            color: theme.text,
            padding: "0 12px 0 35px",
            outlineOffset: 2,
          }}
        />
      </label>
      {items.map((item) => (
        <ActionButton key={item} theme={theme} disabled title="Filter controls are visual in this premium pass" style={{ minWidth: 116, justifyContent: "space-between" }}>
          {item}
        </ActionButton>
      ))}
      <ActionButton theme={theme} disabled title="Advanced filters are visual in this premium pass">
        <Filter size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
        Filters
      </ActionButton>
    </div>
  );
}

function PremiumTable({ theme, columns, rows, selectedKey, onSelect, keyField = "symbol", style = {}, rowMinHeight = 42, headerMinHeight = 36, cellPadding = "0 14px", columnGap = 12 }) {
  return (
    <div style={{ minWidth: 0, overflow: "auto", ...style }}>
      <div
        role="row"
        style={{
          display: "grid",
          gridTemplateColumns: columns.map((column) => column.width || "1fr").join(" "),
          gap: columnGap,
          minHeight: headerMinHeight,
          alignItems: "center",
          padding: cellPadding,
          color: theme.muted,
          borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        {columns.map((column) => (
          <div key={column.key} style={{ textAlign: column.align || "left" }}>
            {column.label}
          </div>
        ))}
      </div>
      {rows.map((row, index) => {
        const rowValue = row[keyField] || row.id || index;
        const rowKey = `${rowValue}-${index}`;
        const selected = rowValue === selectedKey;
        return (
          <button
            key={rowKey}
            type="button"
            onClick={() => onSelect?.(row)}
            style={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: columns.map((column) => column.width || "1fr").join(" "),
              gap: columnGap,
              minHeight: rowMinHeight,
              alignItems: "center",
              padding: cellPadding,
              border: "none",
              borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
              background: selected ? "linear-gradient(90deg, rgba(45,140,255,0.30), rgba(45,140,255,0.04))" : "transparent",
              color: theme.text,
              cursor: onSelect ? "pointer" : "default",
              textAlign: "left",
              outlineOffset: -2,
            }}
          >
            {columns.map((column) => (
              <div
                key={column.key}
                style={{
                  minWidth: 0,
                  textAlign: column.align || "left",
                  fontFamily: column.mono ? terminalMonoFont : terminalSansFont,
                  fontSize: 12,
                  fontWeight: column.strong ? 850 : 650,
                  color: column.color ? column.color(row) : theme.text,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {column.render ? column.render(row, index) : row[column.key]}
              </div>
            ))}
          </button>
        );
      })}
    </div>
  );
}

function MetricTile({ theme, label, value, tone = "neutral", detail }) {
  return (
    <div style={{ padding: "13px 14px", borderRight: `1px solid ${theme.borderSoft || theme.border}`, minWidth: 0 }}>
      <div style={{ color: theme.muted, fontSize: 11, marginBottom: 7 }}>{label}</div>
      <div
        style={{
          color: tone === "good" ? theme.green : tone === "bad" ? theme.red : tone === "warn" ? theme.amber : theme.text,
          fontFamily: terminalMonoFont,
          fontSize: 16,
          fontWeight: 900,
        }}
      >
        {value}
      </div>
      {detail && <div style={{ color: theme.muted, fontSize: 10, marginTop: 4 }}>{detail}</div>}
    </div>
  );
}

function SectionTitle({ theme, title, subtitle, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
      <div>
        <h1 style={{ margin: 0, color: theme.text, fontSize: 24, letterSpacing: 0, fontWeight: 900, textTransform: "uppercase" }}>
          {title}
        </h1>
        {subtitle && <div style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

function SymbolBadge({ theme, symbol }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.03))",
          border: `1px solid ${theme.borderSoft || theme.border}`,
          display: "grid",
          placeItems: "center",
          fontFamily: terminalMonoFont,
          fontWeight: 900,
        }}
      >
        {String(symbol || "S").slice(0, 1)}
      </span>
    </span>
  );
}

function DetailRail({ theme, selected, children, title = "Selected Symbol", actions, compact = false, detailStats }) {
  const stats = detailStats || [
    ["Day High", selected.dayHigh ?? selected.high ?? selected.price],
    ["Day Low", selected.dayLow ?? selected.low ?? selected.price],
    ["Volume", selected.volume],
    ["Float", selected.floatShares ?? selected.float],
    ["P/E", selected.peRatio ?? selected.pe],
    ["Beta", selected.beta],
  ];

  return (
    <div style={{ display: "grid", gap: compact ? 9 : 10, minWidth: 0, minHeight: 0, alignContent: compact ? "start" : "stretch" }}>
      <PremiumCard theme={theme} title={title} action={<MoreVertical size={16} color={theme.muted} />}>
        <div style={{ padding: compact ? 10 : 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
              <SymbolBadge theme={theme} symbol={selected.symbol} />
              <div>
                <div style={{ fontSize: compact ? 21 : 22, fontWeight: 900, color: theme.text, fontFamily: terminalMonoFont }}>
                  {selected.symbol}
                </div>
                <div style={{ color: theme.muted, fontSize: compact ? 11 : 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selected.name || selected.company || "Selected equity"}
                </div>
              </div>
            </div>
            <Star size={18} color={theme.blue} fill={theme.blue} />
          </div>
          <div style={{ marginTop: compact ? 8 : 12, display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ color: theme.text, fontSize: compact ? 24 : 30, fontWeight: 900, fontFamily: terminalMonoFont }}>{num(selected.price) ? num(selected.price).toFixed(2) : "Quote"}</span>
            <span style={{ color: toneColor(theme, moveOf(selected)), fontSize: compact ? 12 : 16, fontWeight: 900, fontFamily: terminalMonoFont }}>
              {pct(moveOf(selected))}
            </span>
          </div>
          <div style={{ color: theme.green, fontSize: compact ? 10 : 12, fontWeight: 850, marginTop: compact ? 4 : 6 }}>
            Market Context Active
          </div>
          <div style={{ display: "grid", gridTemplateColumns: compact ? "repeat(3, minmax(0, 1fr))" : "1fr 1fr", gap: compact ? 5 : 9, marginTop: compact ? 8 : 14 }}>
            {stats.map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: compact ? "grid" : "flex",
                  justifyContent: compact ? "initial" : "space-between",
                  gap: compact ? 4 : 8,
                  color: theme.muted,
                  fontSize: compact ? 10 : 12,
                  minWidth: 0,
                  padding: compact ? "5px 6px" : 0,
                  borderRadius: compact ? 6 : 0,
                  border: compact ? `1px solid ${theme.borderSoft || theme.border}` : "none",
                  background: compact ? theme.panel2 : "transparent",
                }}
              >
                <span>{label}</span>
                <span style={{ color: theme.text, fontFamily: terminalMonoFont, fontSize: compact ? 10 : 12, fontWeight: compact ? 850 : 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {formatDetailValue(label, value ?? selected.price)}
                </span>
              </div>
            ))}
          </div>
          {actions}
        </div>
      </PremiumCard>
      {children}
    </div>
  );
}

function buildStocks(liveStocks, scannerStocks, selectedStockData) {
  const base = [
    { symbol: "AAPL", name: "Apple Inc.", price: 298.01, change: "+1.74%", volume: "55.21M", rvol: "3.7x", float: "15.76B", sector: "Technology", setup: "Breakout", score: 72, risk: "Low" },
    { symbol: "NVDA", name: "NVIDIA Corp.", price: 1071.89, change: "+0.68%", volume: "25.43M", rvol: "4.0x", float: "24.11B", sector: "Technology", setup: "Uptrend", score: 72, risk: "Low" },
    { symbol: "AMD", name: "Advanced Micro Devices", price: 169.32, change: "+0.62%", volume: "12.43M", rvol: "1.8x", float: "1.63B", sector: "Technology", setup: "Bullish", score: 58, risk: "Med" },
    { symbol: "TSLA", name: "Tesla, Inc.", price: 186.32, change: "-0.58%", volume: "85.42M", rvol: "1.6x", float: "3.21B", sector: "Consumer Cyclical", setup: "Pullback", score: 61, risk: "Med" },
    { symbol: "COIN", name: "Coinbase Global, Inc.", price: 240.75, change: "+2.15%", volume: "9.34M", rvol: "2.3x", float: "392.5M", sector: "Financial Services", setup: "Breakout", score: 72, risk: "Low" },
    { symbol: "SOFI", name: "SoFi Technologies, Inc.", price: 7.91, change: "+3.00%", volume: "20.22M", rvol: "2.3x", float: "867.0M", sector: "Financial Services", setup: "Bullish", score: 61, risk: "Med" },
    { symbol: "PLTR", name: "Palantir Technologies Inc.", price: 24.85, change: "+1.79%", volume: "38.16M", rvol: "2.9x", float: "2.09B", sector: "Technology", setup: "Uptrend", score: 69, risk: "Med" },
    { symbol: "META", name: "Meta Platforms, Inc.", price: 502.31, change: "+0.92%", volume: "13.58M", rvol: "1.2x", float: "2.61B", sector: "Communication Services", setup: "Trend", score: 58, risk: "Med" },
    { symbol: "AMZN", name: "Amazon.com, Inc.", price: 181.9, change: "+1.23%", volume: "22.11M", rvol: "1.4x", float: "10.45B", sector: "Consumer Cyclical", setup: "Bullish", score: 57, risk: "Low" },
    { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", price: 532.48, change: "+0.24%", volume: "62.74M", rvol: "0.9x", float: "ETF", sector: "ETF", setup: "Neutral", score: 52, risk: "Low" },
  ];
  const bySymbol = new Map(base.map((row) => [row.symbol, row]));
  const cleanScannerRows = rankScannerRows(
    [...(scannerStocks || []), ...(liveStocks || []), selectedStockData]
      .filter(Boolean)
      .map((stock, index) => normalizeScannerRow(stock, { source: stock.source || "Terminal Data", updatedAt: stock.lastUpdated }, index))
  );

  cleanScannerRows.forEach((stock) => {
    const symbol = String(stock.symbol || "").toUpperCase();
    if (!symbol) return;
    bySymbol.set(symbol, {
      ...(bySymbol.get(symbol) || {}),
      ...stock,
      symbol,
      name: stock.name || stock.company || bySymbol.get(symbol)?.name || `${symbol} Equity`,
      price: num(stock.price, bySymbol.get(symbol)?.price || 0),
      change: stock.changePercent || stock.change || bySymbol.get(symbol)?.change || "+0.24%",
      volume: stock.volume || bySymbol.get(symbol)?.volume || "Live",
      rvol: stock.rvol || stock.relativeVolume || bySymbol.get(symbol)?.rvol || "1.7x",
      float: stock.float || bySymbol.get(symbol)?.float || "Market",
      sector: stock.sector || bySymbol.get(symbol)?.sector || "Market Context",
      setup: stock.catalyst || stock.setup || bySymbol.get(symbol)?.setup || "News",
      score: stock.score10 || stock.score || bySymbol.get(symbol)?.score || 61,
      risk: stock.risk || stock.riskLabel || bySymbol.get(symbol)?.risk || "Context",
      gapPercent: stock.gapPercent,
      catalyst: stock.catalyst,
      whyMoving: stock.whyMoving,
    });
  });
  return Array.from(bySymbol.values()).slice(0, 16);
}

function makeNews(news, selectedSymbol) {
  const real = (news || []).map((item, index) => ({
    ...normalizeNewsRow(item, index, selectedSymbol),
  })).filter((item) => item?.headline);
  const fallback = createNormalizedNewsFallback(selectedSymbol);

  return (real.length ? real : fallback).slice(0, 12);
}

function makeOrders(selectedSymbol) {
  return [
    ["09:32:14", "AAPL", "BUY", "LIMIT", 100, "298.10", "FILLED", 100, 0, "DAY", "18273491"],
    ["09:31:02", "NVDA", "SELL", "LIMIT", 50, "1,075.00", "FILLED", 50, 0, "DAY", "18273490"],
    ["09:30:45", "TSLA", "BUY", "LIMIT", 25, "186.50", "WORKING", 0, 25, "DAY", "18273489"],
    ["09:30:12", "COIN", "BUY", "STOP", 40, "243.00", "WORKING", 0, 40, "GTC", "18273488"],
    ["09:29:58", "SOFI", "SELL", "LIMIT", 100, "7.95", "FILLED", 100, 0, "DAY", "18273487"],
    ["09:28:33", "AMZN", "BUY", "LIMIT", 10, "182.00", "PARTIALLY FILLED", 4, 6, "DAY", "18273486"],
    ["09:27:15", "MSFT", "SELL", "STOP", 15, "410.00", "CANCELLED", 0, 15, "DAY", "18273485"],
    ["09:26:44", selectedSymbol, "SELL", "LIMIT", 50, "297.50", "REJECTED", 0, 50, "DAY", "18273484"],
  ].map(([time, symbol, side, type, qty, price, status, filled, remaining, tif, id]) => ({ time, symbol, side, type, qty, price, status, filled, remaining, tif, id }));
}

function makeJournalTrades(entries, stocks) {
  const fallback = [
    ["Jun 7, 2024 10:15:30", "AAPL", "VWAP Bounce", "Long", 100, "189.12", "190.28", 116, "+0.61%", "+0.78R", "1h 05m", "Win", "A+ Setup", "Strong bounce at VWAP + volume"],
    ["Jun 7, 2024 09:34:12", "NVDA", "Breakout", "Long", 50, "1075.00", "1087.50", 625, "+1.16%", "+1.35R", "2h 10m", "Win", "News", "Earnings momentum continued"],
    ["Jun 6, 2024 14:12:05", "TSLA", "Pullback", "Long", 25, "178.00", "174.20", -95, "-2.13%", "-1.02R", "1h 40m", "Loss", "Choppy", "Market faded near EOD"],
    ["Jun 6, 2024 11:01:22", "AMD", "Breakout", "Long", 30, "168.50", "169.90", 42, "+0.83%", "+0.56R", "45m", "Win", "High RVOL", "Broader market strong"],
    ["Jun 5, 2024 10:03:44", "SOFI", "VWAP Reclaim", "Long", 100, "7.95", "8.23", 28, "+3.52%", "+1.11R", "1h 20m", "Win", "A+ Setup", "Reclaimed VWAP with volume"],
    ["Jun 5, 2024 09:45:18", "COIN", "Breakdown", "Short", 40, "243.00", "247.80", -192, "-1.98%", "-1.26R", "1h 15m", "Loss", "Weak Mkt", "Breakdown failed quickly"],
    ["Jun 4, 2024 13:22:10", "AMZN", "Range Fade", "Short", 10, "182.00", "180.50", 15, "+0.82%", "+0.41R", "30m", "Win", "Range", "Fade into resistance"],
    ["Jun 4, 2024 10:15:05", "META", "Breakout", "Long", 15, "503.00", "510.25", 108.75, "+1.44%", "+1.18R", "2h 05m", "Win", "News", "Strong news catalyst"],
  ];

  const real = (entries || []).map((entry, index) => {
    const stock = stocks[index % Math.max(stocks.length, 1)] || {};
    const pnl = num(entry.pnl ?? entry.netPnl ?? entry.resultAmount, index % 3 === 0 ? 116 : -95);
    return {
      date: entry.createdAt ? new Date(entry.createdAt).toLocaleString() : entry.date || `Jun ${7 - index}, 2024`,
      symbol: entry.symbol || stock.symbol || "AAPL",
      setup: entry.setup || entry.tags || "Review",
      side: entry.bias || entry.side || "Long",
      qty: entry.quantity || entry.qty || 100,
      entry: entry.entryPrice || entry.entry || num(stock.price, 189.12).toFixed(2),
      exit: entry.exitPrice || entry.exit || (num(stock.price, 190.28) + 1.12).toFixed(2),
      pnl,
      pnlPct: entry.pnlPct || `${pnl >= 0 ? "+" : ""}${(pnl / 190).toFixed(2)}%`,
      r: entry.rMultiple || entry.r || `${pnl >= 0 ? "+" : ""}${(pnl / 145).toFixed(2)}R`,
      hold: entry.holdTime || "1h 05m",
      outcome: entry.result || entry.outcome || (pnl >= 0 ? "Win" : "Loss"),
      notes: entry.notes || entry.review || "Reviewed trade setup",
    };
  });

  return (real.length ? real : fallback.map(([date, symbol, setup, side, qty, entry, exit, pnl, pnlPct, r, hold, outcome, tag, notes]) => ({
    date,
    symbol,
    setup,
    side,
    qty,
    entry,
    exit,
    pnl,
    pnlPct,
    r,
    hold,
    outcome,
    tag,
    notes,
  }))).slice(0, 12);
}

function makeReplayTrades(replayTrades, selectedSymbol) {
  const fallback = [
    ["09:45:12", selectedSymbol, "Buy", 100, "188.62", "Pending"],
    ["10:15:30", selectedSymbol, "Sell", 100, "189.35", "+$73.00"],
    ["10:22:05", "TSLA", "Buy", 50, "200.45", "Pending"],
    ["11:02:15", "TSLA", "Sell", 50, "201.92", "+$73.50"],
    ["12:45:10", "NVDA", "Short", 25, "916.30", "Pending"],
  ];
  const real = (replayTrades || []).map((trade, index) => ({
    time: trade.time || trade.timestamp?.slice(11, 19) || `10:${String(15 + index).padStart(2, "0")}:30`,
    symbol: trade.symbol || selectedSymbol,
    side: trade.type || trade.side || "Buy",
    qty: trade.quantity || trade.qty || 100,
    price: trade.price || trade.fillPrice || "188.62",
    pnl: trade.pnl ? money(trade.pnl) : "Pending",
  }));
  return (real.length ? real : fallback.map(([time, symbol, side, qty, price, pnl]) => ({ time, symbol, side, qty, price, pnl }))).slice(0, 10);
}

export default function PremiumWorkspace({
  activeWorkspace,
  theme,
  renderChartGrid,
  selectedStock,
  selectedStockData,
  liveStocks,
  scannerStocks,
  news,
  alerts,
  orders,
  positions,
  allSymbols,
  accountSummary,
  realizedPnL,
  totalUnrealizedPnL,
  quantity,
  setQuantity,
  setOrderSide,
  setOrderConfirmed,
  setOrderMessage,
  setPremiumDockTab,
  selectMainSymbol,
  addSymbolToWatchlist,
  scannerTab,
  setScannerTab,
  themeMode,
  user,
  saveWorkspaceToCloud,
  loadWorkspaceFromCloud,
  resetWorkspace,
  brokerConnected,
  journalEntries,
  replayPlaying,
  replaySpeed,
  replayStats,
  replayTrades,
  setReplayPlaying,
  setReplaySpeed,
  stepReplay,
  resetReplay,
  openReplayJournal,
  journalDraft,
  addJournalEntry,
  exportJournalCsv,
  exportTradeSummaryCsv,
}) {
  const stocks = buildStocks(liveStocks, scannerStocks, selectedStockData);
  const selected = stocks.find((row) => row.symbol === selectedStock) || stocks[0];
  const headlines = makeNews(news, selectedStock);
  const dashboard = useDashboardData({
    selectedStock,
    selectedStockData,
    liveStocks,
    scannerStocks,
    news,
    positions,
    orders,
    alerts,
    allSymbols,
    accountSummary,
    realizedPnL,
    totalUnrealizedPnL,
  });
  const orderRows = (orders?.length ? orders : makeOrders(selectedStock)).map((order, index) => ({
    time: order.time || order.createdAt?.slice(11, 19) || `09:${String(32 - index).padStart(2, "0")}:14`,
    symbol: order.symbol || selectedStock,
    side: order.side || order.orderSide || "BUY",
    type: order.type || order.orderType || "LIMIT",
    qty: order.qty || order.quantity || quantity,
    price: order.price || order.limitPrice || num(selected.price).toFixed(2),
    status: order.status || "FILLED",
    filled: order.filled || order.quantity || quantity,
    remaining: order.remaining || 0,
    tif: order.tif || "DAY",
    id: order.id || `182734${90 - index}`,
  }));
  const positionRows = Object.keys(positions || {}).length
    ? Object.entries(positions).map(([symbol, pos]) => ({
        symbol,
        side: Number(pos.quantity || 0) >= 0 ? "LONG" : "SHORT",
        qty: Math.abs(Number(pos.quantity || 0)),
        avg: Number(pos.average || pos.avgPrice || 0),
        last: num(allSymbols?.find((row) => row.symbol === symbol)?.price, Number(pos.average || 0)),
        exposure: "17.9%",
        risk: 72,
      }))
    : stocks.slice(0, 8).map((stock, index) => ({
        symbol: stock.symbol,
        side: "LONG",
        qty: [100, 50, 25, 40, 100, 30, 10, 4][index] || 10,
        avg: num(stock.price) * 0.997,
        last: num(stock.price),
        exposure: `${(17.9 - index * 2.1).toFixed(1)}%`,
        risk: stock.score || 58,
      }));
  const alertRows = alerts?.length
    ? alerts.map((alert, index) => ({
        symbol: alert.symbol || selectedStock,
        type: alert.direction ? `Price ${alert.direction}` : "Price Above",
        condition: alert.price ? `Price ${alert.direction || "above"} ${money(alert.price)}` : "Price above $300.00",
        last: num(selected.price, 298.01),
        target: alert.price || 300,
        status: alert.active === false ? "Paused" : "Active",
        created: alert.createdAt || "Jun 1, 2025 09:15 AM",
        next: index % 3 === 0 ? "Last Triggered" : "-",
      }))
    : stocks.slice(0, 8).map((stock, index) => ({
        symbol: stock.symbol,
        type: ["Price Above", "Breakout", "Price Above", "RVOL Spike", "VWAP Cross"][index % 5],
        condition: index % 2 ? "Breakout above resistance" : "Price above $300.00",
        last: stock.price,
        target: index % 3 ? 300 : "2.00x",
        status: ["Active", "Armed", "Snoozed", "Triggered"][index % 4],
        created: "Jun 1, 2025 09:15 AM",
        next: index === 6 ? "Triggered" : "-",
      }));
  const journalRows = makeJournalTrades(journalEntries, stocks);
  const replayRows = makeReplayTrades(replayTrades, selectedStock);
  const journalNet = journalRows.reduce((total, row) => total + num(row.pnl), 0) || 2814.72;
  const replayNet = num(replayStats?.netPnL, 2653.21);
  const replayWinRate = replayStats?.winRate || "66.67";
  const [selectedNewsId, setSelectedNewsId] = useState(null);
  const [selectedAlertSymbol, setSelectedAlertSymbol] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedPositionSymbol, setSelectedPositionSymbol] = useState(null);
  const selectedStory = headlines.find((item) => item.id === selectedNewsId) || headlines.find((item) => item.symbol === selected.symbol) || headlines[0];
  const selectedAlert = alertRows.find((row) => row.symbol === selectedAlertSymbol) || alertRows.find((row) => row.symbol === selected.symbol) || alertRows[0];
  const selectedOrder = orderRows.find((row) => row.id === selectedOrderId) || orderRows.find((row) => row.symbol === selected.symbol) || orderRows[0];
  const selectedPosition = positionRows.find((row) => row.symbol === selectedPositionSymbol) || positionRows.find((row) => row.symbol === selected.symbol) || positionRows[0];

  function prepareReviewAction(label, symbol = selected.symbol) {
    setPremiumDockTab?.("orders");
    setOrderConfirmed?.(false);
    setOrderMessage?.(`${label} prepared for ${symbol}. This premium shortcut is review-only.`);
  }

  function prepareOrderReview(side, symbol = selected.symbol) {
    setOrderSide?.(side);
    setOrderConfirmed?.(false);
    setPremiumDockTab?.("orders");
    setOrderMessage?.(`${side} review prepared for ${symbol}. Use the full order ticket before any paper/live submission.`);
  }

  const page = {
    minHeight: 0,
    height: "100%",
    overflow: "auto",
    padding: "12px",
    color: theme.text,
    fontFamily: terminalSansFont,
  };
  const mainTwoCol = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 360px",
    gap: 10,
    minHeight: 0,
  };
  const bottomDock = (
    <PremiumCard theme={theme} style={{ height: 116 }}>
      <PremiumTabs theme={theme} tabs={["Positions (3)", "Orders (1)", "Alerts (2)", "Executions", "Messages"]} active="Positions (3)" />
      <PremiumTable
        theme={theme}
        columns={[
          { key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true },
          { key: "side", label: "Side", width: "80px", color: () => theme.green, mono: true },
          { key: "qty", label: "Qty", width: "80px", align: "right", mono: true },
          { key: "avg", label: "Avg Price", width: "110px", align: "right", mono: true, render: (row) => row.avg.toFixed(2) },
          { key: "last", label: "Last Price", width: "110px", align: "right", mono: true, render: (row) => row.last.toFixed(2) },
          { key: "pnl", label: "P&L", width: "110px", align: "right", mono: true, color: () => theme.green, render: () => "+261.50" },
        ]}
        rows={positionRows.slice(0, 1)}
        style={{ maxHeight: 78 }}
      />
    </PremiumCard>
  );
  const quickOrder = (
    <PremiumCard theme={theme} title="Quick Order">
      <div style={{ padding: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 92px 88px", gap: 8 }}>
          {["Symbol", "Shares", "Order Type", "Limit Price"].map((label, index) => (
            <label key={label} style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 10, textTransform: "uppercase" }}>
              {label}
              <input
                value={index === 0 ? selectedStock : index === 1 ? quantity : index === 2 ? "LIMIT" : num(selected.price).toFixed(2)}
                onChange={(event) => index === 1 && setQuantity?.(Number(event.target.value) || 1)}
                readOnly={index !== 1}
                style={{ height: 31, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 5, background: theme.panel2, color: theme.text, padding: "0 8px", fontFamily: terminalMonoFont }}
              />
            </label>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
          {["BUY", "SELL"].map((side) => (
            <ActionButton
              key={side}
              theme={theme}
              good={side === "BUY"}
              danger={side === "SELL"}
              onClick={() => {
                setOrderSide?.(side);
                setOrderConfirmed?.(false);
                setPremiumDockTab?.("orders");
                setOrderMessage?.(`${side} review prepared for ${selectedStock}. This shortcut is review-only.`);
              }}
            >
              {side === "BUY" ? "Buy" : "Sell"}
            </ActionButton>
          ))}
        </div>
      </div>
    </PremiumCard>
  );
  const selectedActions = (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9, marginTop: 16 }}>
      <ActionButton theme={theme} active onClick={() => selectMainSymbol?.(selected.symbol)}>
        Open Chart
      </ActionButton>
      <ActionButton theme={theme} onClick={() => prepareReviewAction("Alert review", selected.symbol)}>
        Alert Review
      </ActionButton>
      <ActionButton theme={theme} good onClick={() => prepareOrderReview("BUY", selected.symbol)}>
        Review Order
      </ActionButton>
    </div>
  );
  function scannerTable(rows = stocks.slice(0, 8), selectedKey = selected.symbol) {
    return (
      <PremiumTable
        theme={theme}
        columns={[
          { key: "symbol", label: "Symbol", width: "1.5fr", mono: true, strong: true, render: (row) => <><Star size={14} color={theme.muted} style={{ verticalAlign: "-2px", marginRight: 10 }} />{row.symbol}<span style={{ display: "block", color: theme.muted, fontFamily: terminalSansFont, fontSize: 10, fontWeight: 500 }}>{row.name}</span></> },
          { key: "price", label: "Price", width: "90px", align: "right", mono: true, render: (row) => num(row.price).toFixed(2) },
          { key: "change", label: "Chg%", width: "90px", align: "right", mono: true, color: (row) => toneColor(theme, moveOf(row)), render: (row) => pct(moveOf(row)) },
          { key: "gap", label: "Gap%", width: "90px", align: "right", mono: true, color: (row) => toneColor(theme, row.gapPercent ?? moveOf(row)), render: (row) => pct(row.gapPercent ?? moveOf(row)) },
          { key: "rvol", label: "RVOL", width: "70px", align: "right", mono: true, render: (row) => row.rvolLabel || row.rvol || formatMultiple(row.relativeVolume) },
          { key: "volume", label: "Volume", width: "95px", align: "right", mono: true, render: (row) => row.volumeLabel || (typeof row.volume === "string" ? row.volume : formatCompactNumber(row.volume, 1)) },
          { key: "float", label: "Float", width: "90px", align: "right", mono: true, render: (row) => row.floatLabel || row.float || (row.floatShares ? formatCompactNumber(row.floatShares, 2) : "Context") },
          { key: "setup", label: "Catalyst", width: "130px", render: (row) => row.catalyst || row.setup },
          { key: "score", label: "Score", width: "70px", align: "center", render: (row) => <StatusPill theme={theme} tone={row.score >= 70 ? "good" : "warn"}>{row.score}</StatusPill> },
          { key: "risk", label: "Risk", width: "70px", align: "right", color: (row) => row.risk === "Low" ? theme.green : theme.amber },
        ]}
        rows={rows}
        selectedKey={selectedKey}
        onSelect={(row) => selectMainSymbol?.(row.symbol)}
      />
    );
  }

  function selectedRail(extra = null) {
    return (
      <DetailRail theme={theme} selected={selected} actions={selectedActions}>
        {extra}
      </DetailRail>
    );
  }

  if (activeWorkspace === "scanner") {
    return (
      <div style={page}>
        <div style={mainTwoCol}>
          <PremiumCard theme={theme}>
            <div style={{ padding: 20, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}>
              <SectionTitle theme={theme} title="Scanner" subtitle="Find high-quality trading opportunities" />
              <PremiumTabs theme={theme} tabs={["Gainers", "Losers", "Active", "Momentum", "High RVOL", "News", "Earnings", "Low Float"]} active={scannerTab} onChange={setScannerTab} />
              <div style={{ marginTop: 18 }}><FilterBar theme={theme} search="Search scanner..." items={["Market Cap > 300M", "Price > $1", "Volume > 100K", "RVOL > 2x", "Country: US"]} /></div>
            </div>
            {scannerTable(stocks.slice(0, 7))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px", color: theme.muted, fontSize: 12 }}>
              <span>Results: 126</span><span>Auto Refresh <StatusPill theme={theme} tone="good">On</StatusPill></span>
            </div>
          </PremiumCard>
          {selectedRail(
            <>
              <PremiumCard theme={theme} title="AI Summary"><div style={{ padding: 14, color: theme.text, lineHeight: 1.55 }}> {selected.symbol} is moving on strong news flow, elevated relative volume, and positive market context.</div></PremiumCard>
              <PremiumCard theme={theme} title="Scanner Logic"><div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{["News catalyst detected", "Above avg. volume", "Strong relative volume", "Tight spread / liquidity"].map((x) => <span key={x} style={{ color: theme.text, fontSize: 12 }}><CheckCircle2 size={14} color={theme.green} style={{ verticalAlign: "-2px", marginRight: 6 }} />{x}</span>)}</div></PremiumCard>
              <PremiumCard theme={theme}><div style={{ padding: 16, color: theme.green, fontWeight: 900 }}><Shield size={18} style={{ verticalAlign: "-4px", marginRight: 8 }} />LOW RISK <ChevronRight size={16} style={{ float: "right" }} /></div></PremiumCard>
            </>
          )}
        </div>
      </div>
    );
  }

  if (activeWorkspace === "watchlist") {
    return (
      <div style={page}>
        <div style={mainTwoCol}>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme}>
              <div style={{ padding: 20, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}>
                <SectionTitle theme={theme} title="Watchlist" subtitle="Track symbols, monitor moves, and organize trade ideas." action={<ActionButton theme={theme} onClick={() => addSymbolToWatchlist?.(selected.symbol)}><Edit3 size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Add Selected</ActionButton>} />
                <PremiumTabs theme={theme} tabs={["Main Watchlist", "Momentum", "Swing Ideas", "ETFs", "Earnings", "+"]} active="Main Watchlist" />
                <div style={{ marginTop: 14 }}><FilterBar theme={theme} search="Search symbol..." items={["All Sectors", "Price Any", "Change % Any"]} /></div>
              </div>
              <PremiumTable
                theme={theme}
                columns={[
                  { key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true, render: (row) => <><Star size={14} color={row.symbol === selected.symbol ? theme.blue : theme.muted} fill={row.symbol === selected.symbol ? theme.blue : "none"} style={{ verticalAlign: "-2px", marginRight: 10 }} />{row.symbol}</> },
                  { key: "name", label: "Company", width: "1.4fr" },
                  { key: "price", label: "Last", width: "90px", align: "right", mono: true, render: (row) => num(row.price).toFixed(2) },
                  { key: "change", label: "Chg%", width: "90px", align: "right", mono: true, color: (row) => toneColor(theme, moveOf(row)), render: (row) => pct(moveOf(row)) },
                  { key: "volume", label: "Volume", width: "100px", align: "right", mono: true },
                  { key: "rvol", label: "RVOL", width: "70px", align: "right", mono: true },
                  { key: "float", label: "Float", width: "90px", align: "right", mono: true },
                  { key: "sector", label: "Sector", width: "150px" },
                  { key: "setup", label: "Setup", width: "100px", render: (row) => <StatusPill theme={theme} tone={row.setup === "Pullback" ? "warn" : "good"}>{row.setup}</StatusPill> },
                ]}
                rows={stocks.slice(0, 10)}
                selectedKey={selected.symbol}
                onSelect={(row) => selectMainSymbol?.(row.symbol)}
              />
            </PremiumCard>
            <PremiumCard theme={theme} title="Watchlist Notes & Activity">
              <PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "140px" }, { key: "type", label: "Type", width: "180px" }, { key: "symbol", label: "Symbol", width: "100px", mono: true }, { key: "note", label: "Note / Activity", width: "1fr" }, { key: "user", label: "Updated By", width: "120px" }]} rows={[{ time: "Today 09:33 AM", type: "Alert Triggered", symbol: "AAPL", note: "Price crossed above 295.00", user: "System" }, { time: "Today 09:22 AM", type: "Note", symbol: "NVDA", note: "Earnings 5/22 - watching for continuation", user: "You" }, { time: "Yesterday 04:18 PM", type: "Note", symbol: "AMZN", note: "Strong close near highs - monitor tomorrow", user: "You" }]} />
            </PremiumCard>
          </div>
          {selectedRail(<><PremiumCard theme={theme} title="Watchlist Insights"><div style={{ padding: 14, display: "grid", gap: 9 }}>{["Strong relative volume", "Highly liquid large-cap", "Price above key moving averages", "Watch for breakout"].map((x, i) => <span key={x} style={{ color: theme.text, fontSize: 12 }}><CheckCircle2 size={14} color={i === 3 ? theme.amber : theme.green} style={{ verticalAlign: "-2px", marginRight: 6 }} />{x}</span>)}</div></PremiumCard><PremiumCard theme={theme} title="Upcoming Alerts"><div style={{ padding: 14, display: "grid", gap: 12 }}>{["TSLA Price above 190.00", "COIN Price above 250.00", "SOFI Price above 8.50"].map((x) => <div key={x} style={{ color: theme.text }}>{x}</div>)}</div></PremiumCard></>)}
        </div>
      </div>
    );
  }

  if (activeWorkspace === "news") {
    return (
      <div style={page}>
        <div style={mainTwoCol}>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme}>
              <div style={{ padding: 16, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}>
                <SectionTitle theme={theme} title="News" subtitle="Track market-moving headlines, catalysts, and company news." />
                <PremiumTabs theme={theme} tabs={["Top News", "Market", "Stocks", "Earnings", "Macro", "Analyst", "Crypto", "Watchlist", "+"]} active="Top News" />
                <div style={{ marginTop: 14 }}><FilterBar theme={theme} search="Search news..." items={["Impact: All", "Source: All", "Sector: All", "Time: Today"]} /></div>
              </div>
              <PremiumTable
                theme={theme}
                columns={[
                  { key: "time", label: "Time", width: "90px", mono: true },
                  { key: "headline", label: "Headline", width: "2fr", strong: true, render: (row) => <>{row.headline}{row.url && <span style={{ color: theme.blue, fontSize: 10, marginLeft: 5 }}>OPEN</span>}</> },
                  { key: "symbol", label: "Symbol", width: "80px", mono: true },
                  { key: "source", label: "Source", width: "120px" },
                  { key: "impact", label: "Impact", width: "90px", render: (row) => <StatusPill theme={theme} tone={row.impact === "High" ? "bad" : "warn"}>{row.impact}</StatusPill> },
                  { key: "sentiment", label: "Sentiment", width: "100px", color: (row) => row.sentiment === "Bearish" ? theme.red : theme.green },
                ]}
                rows={headlines}
                selectedKey={selectedStory.id}
                keyField="id"
                onSelect={(row) => {
                  setSelectedNewsId(row.id);
                  if (row.symbol) selectMainSymbol?.(row.symbol);
                  if (row.url) window.open(row.url, "_blank", "noopener,noreferrer");
                }}
              />
            </PremiumCard>
            <PremiumCard theme={theme} title="Watchlist News">{scannerTable(stocks.slice(0, 4))}</PremiumCard>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme} title="Selected Story" action={<Star size={18} color={theme.blue} fill={theme.blue} />}>
              <div style={{ padding: 18 }}>
                <h2 style={{ margin: 0, fontSize: 22 }}>{selectedStory.headline}</h2>
                <div style={{ color: theme.muted, marginTop: 10 }}>{selectedStory.source} / {selectedStory.time}</div>
                <div style={{ marginTop: 16, lineHeight: 1.55, color: theme.text }}>This catalyst is attracting active trader attention and may affect liquidity, sentiment, and near-term momentum.</div>
                <ul style={{ color: theme.green, lineHeight: 1.8 }}>{["Shares moving on catalyst flow", "Expected to attract momentum volume", "Institutional context improving"].map((x) => <li key={x}>{x}</li>)}</ul>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
                  <ActionButton theme={theme} active onClick={() => selectMainSymbol?.(selectedStory.symbol || selected.symbol)}>Open Chart</ActionButton>
                  <ActionButton theme={theme} onClick={() => prepareReviewAction("News alert review", selectedStory.symbol || selected.symbol)}>Alert Review</ActionButton>
                  <ActionButton theme={theme} good onClick={() => addSymbolToWatchlist?.(selectedStory.symbol || selected.symbol)}>Watch Symbol</ActionButton>
                </div>
              </div>
            </PremiumCard>
            <PremiumCard theme={theme} title="AI News Summary"><div style={{ padding: 14, display: "grid", gap: 9 }}>{[["Catalyst Strength", "High"], ["Sentiment", "Bullish"], ["Volume Reaction", "+8.6%"], ["Risk Level", "Medium"]].map(([a, b]) => <div key={a} style={{ display: "flex", justifyContent: "space-between" }}><span>{a}</span><b style={{ color: b === "Medium" ? theme.amber : theme.green }}>{b}</b></div>)}</div></PremiumCard>
            <PremiumCard theme={theme} title="Upcoming Events"><PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "90px" }, { key: "event", label: "Event", width: "1fr" }, { key: "impact", label: "Impact", width: "70px", color: () => theme.amber }]} rows={[{ time: "08:30 AM", event: "CPI (YoY)", impact: "High" }, { time: "10:30 AM", event: "EIA Crude Oil Inventories", impact: "Medium" }, { time: "04:30 PM", event: "AAPL Earnings", impact: "High" }]} /></PremiumCard>
          </div>
        </div>
      </div>
    );
  }

  if (activeWorkspace === "alerts") {
    return (
      <div style={page}>
        <div style={mainTwoCol}>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme}>
              <div style={{ padding: 16, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}><SectionTitle theme={theme} title="Alerts" subtitle="Manage price, volume, technical, and risk alerts." action={<ActionButton theme={theme} active onClick={() => prepareReviewAction("Create alert review", selected.symbol)}>Create Alert <Plus size={14} style={{ verticalAlign: "-2px", marginLeft: 6 }} /></ActionButton>} /><PremiumTabs theme={theme} tabs={["Active Alerts", "Triggered", "Create Alert", "Watchlist Alerts", "Risk Alerts"]} active="Active Alerts" /><div style={{ marginTop: 12 }}><FilterBar theme={theme} search="Search alerts..." items={["All Categories", "All Priorities", "All Channels"]} /></div></div>
              <PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true, render: (row) => <><Star size={14} color={theme.amber} fill={theme.amber} style={{ verticalAlign: "-2px", marginRight: 10 }} />{row.symbol}</> }, { key: "type", label: "Alert Type", width: "130px" }, { key: "condition", label: "Condition", width: "1.4fr" }, { key: "last", label: "Last Price", width: "100px", align: "right", mono: true, render: (row) => num(row.last).toFixed(2) }, { key: "target", label: "Target", width: "90px", align: "right", mono: true }, { key: "status", label: "Status", width: "100px", render: (row) => <StatusPill theme={theme} tone={row.status === "Triggered" ? "bad" : row.status === "Snoozed" ? "warn" : "good"}>{row.status}</StatusPill> }, { key: "created", label: "Created", width: "150px" }, { key: "next", label: "Last Trigger / Next", width: "150px" }]} rows={alertRows} selectedKey={selectedAlert?.symbol} onSelect={(row) => { setSelectedAlertSymbol(row.symbol); selectMainSymbol?.(row.symbol); }} />
            </PremiumCard>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 390px", gap: 10 }}>{bottomDock}{quickOrder}</div>
          </div>
          {selectedRail(<><PremiumCard theme={theme} title="Selected Alert"><div style={{ padding: 14, display: "grid", gap: 9 }}><b>{selectedAlert?.symbol} {selectedAlert?.type}</b><span>{selectedAlert?.condition}</span><StatusPill theme={theme} tone={selectedAlert?.status === "Triggered" ? "bad" : "good"}>{selectedAlert?.status}</StatusPill><ActionButton theme={theme} onClick={() => prepareReviewAction("Alert edit review", selectedAlert?.symbol || selected.symbol)}>Edit Review</ActionButton></div></PremiumCard><PremiumCard theme={theme} title="Alert Logic / AI Insight"><div style={{ padding: 14, lineHeight: 1.6 }}>{selectedAlert?.symbol || selected.symbol} is approaching a key monitored level with supportive momentum and above-average volume.</div></PremiumCard><PremiumCard theme={theme} title="Recent Alert Activity"><div style={{ padding: 14, display: "grid", gap: 12 }}>{alertRows.slice(0, 3).map((row, index) => <div key={`${row.symbol}-${index}`} style={{ display: "flex", justifyContent: "space-between" }}><span>{row.symbol} {row.type}</span><span style={{ color: row.status === "Triggered" ? theme.red : theme.green }}>{row.status}</span></div>)}</div></PremiumCard></>)}
        </div>
      </div>
    );
  }

  if (activeWorkspace === "orders") {
    return (
      <div style={page}>
        <div style={mainTwoCol}>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme}>
              <div style={{ padding: 16, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}><PremiumTabs theme={theme} tabs={["Orders", "All Orders", "Working", "Filled", "Cancelled", "Rejected"]} active="Orders" /><div style={{ marginTop: 14 }}><FilterBar theme={theme} search="All Symbols" items={["Jun 7 - Jun 8, 2024"]} /></div></div>
              <PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "90px", mono: true }, { key: "symbol", label: "Symbol", width: "90px", mono: true, strong: true }, { key: "side", label: "Side", width: "70px", color: (row) => row.side === "BUY" ? theme.green : theme.red, strong: true }, { key: "type", label: "Type", width: "90px" }, { key: "qty", label: "Qty", width: "70px", align: "right", mono: true }, { key: "price", label: "Price", width: "100px", align: "right", mono: true }, { key: "status", label: "Status", width: "140px", render: (row) => <StatusPill theme={theme} tone={row.status === "REJECTED" ? "bad" : row.status.includes("WORK") ? "neutral" : row.status.includes("PART") ? "warn" : "good"}>{row.status}</StatusPill> }, { key: "filled", label: "Filled", width: "80px", align: "right", mono: true }, { key: "remaining", label: "Remaining", width: "100px", align: "right", mono: true }, { key: "tif", label: "TIF", width: "70px" }, { key: "id", label: "Order ID", width: "110px", mono: true }]} rows={orderRows} selectedKey={selectedOrder?.id} keyField="id" onSelect={(row) => { setSelectedOrderId(row.id); selectMainSymbol?.(row.symbol); }} />
            </PremiumCard>
            <PremiumCard theme={theme} title="Order Activity"><PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "100px" }, { key: "event", label: "Event", width: "1fr" }, { key: "status", label: "Status", width: "140px", color: () => theme.green }]} rows={orderRows.slice(0, 5).map((row) => ({ time: row.time, event: `${row.symbol} ${row.side} ${row.qty} @ ${row.price}`, status: row.status }))} /></PremiumCard>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme} title="Place New Order"><div style={{ padding: 16 }}>{quickOrder.props.children}</div></PremiumCard>
            <PremiumCard theme={theme} title="Order Summary"><div style={{ padding: 14, display: "grid", gap: 10 }}>{[["Selected Order", selectedOrder ? `${selectedOrder.side} ${selectedOrder.qty} ${selectedOrder.symbol}` : "No order selected"], ["Order Value", money(num(selectedOrder?.price, selected.price) * num(selectedOrder?.qty, quantity))], ["Mode", "Review only"], ["Status", selectedOrder?.status || "No rows yet"]].map(([a, b]) => <div key={a} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>{a}</span><b style={{ textAlign: "right" }}>{b}</b></div>)}</div></PremiumCard>
            <PremiumCard theme={theme} title="Quick Actions"><div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}><ActionButton theme={theme} danger onClick={() => prepareReviewAction("Cancel orders review", selectedOrder?.symbol || selected.symbol)}><X size={14} /><br />Cancel Review</ActionButton><ActionButton theme={theme} onClick={() => prepareReviewAction("Close positions review", selected.symbol)}><Lock size={14} /><br />Close Review</ActionButton><ActionButton theme={theme} onClick={() => prepareReviewAction("Flatten day review", selected.symbol)}><Shield size={14} /><br />Flatten Review</ActionButton></div></PremiumCard>
          </div>
        </div>
      </div>
    );
  }

  if (activeWorkspace === "positions") {
    const enriched = positionRows.map((row) => ({ ...row, marketValue: row.last * row.qty, dayPnl: (row.last - row.avg) * row.qty, totalPnl: (row.last - row.avg) * row.qty * 0.38 }));
    return (
      <div style={page}>
        <div style={mainTwoCol}>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme}>
              <div style={{ padding: 16, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}><SectionTitle theme={theme} title="Positions" /><PremiumTabs theme={theme} tabs={["Open Positions", "Closed Positions", "Holdings", "Allocations"]} active="Open Positions" /><div style={{ marginTop: 14 }}><FilterBar theme={theme} search="All Symbols" items={["All Accounts", "All Sectors", "Sort: P&L %"]} /></div></div>
              <PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true }, { key: "side", label: "Side", width: "80px", color: () => theme.green }, { key: "qty", label: "Qty", width: "70px", align: "right" }, { key: "avg", label: "Avg Price", width: "100px", align: "right", mono: true, render: (row) => row.avg.toFixed(2) }, { key: "last", label: "Last Price", width: "100px", align: "right", mono: true, render: (row) => row.last.toFixed(2) }, { key: "marketValue", label: "Market Value", width: "120px", align: "right", mono: true, render: (row) => money(row.marketValue) }, { key: "dayPnl", label: "Day P&L", width: "100px", align: "right", mono: true, color: (row) => row.dayPnl >= 0 ? theme.green : theme.red, render: (row) => money(row.dayPnl) }, { key: "totalPnl", label: "Total P&L", width: "100px", align: "right", mono: true, color: (row) => row.totalPnl >= 0 ? theme.green : theme.red, render: (row) => money(row.totalPnl) }, { key: "exposure", label: "Exposure", width: "90px", align: "right" }, { key: "risk", label: "Risk", width: "70px", align: "center", render: (row) => <StatusPill theme={theme} tone="warn">{row.risk}</StatusPill> }]} rows={enriched} selectedKey={selectedPosition?.symbol} onSelect={(row) => { setSelectedPositionSymbol(row.symbol); selectMainSymbol?.(row.symbol); }} />
            </PremiumCard>
            <PremiumCard theme={theme} title="Position Activity"><PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "120px" }, { key: "symbol", label: "Symbol", width: "100px", mono: true }, { key: "action", label: "Action", width: "120px", color: () => theme.green }, { key: "side", label: "Side", width: "90px" }, { key: "qty", label: "Qty", width: "80px" }, { key: "note", label: "Reason / Note", width: "1fr" }]} rows={enriched.slice(0, 5).map((row, i) => ({ time: `09:${32 - i}:14`, symbol: row.symbol, action: i === 3 ? "Trimmed" : "Added", side: i === 3 ? "SELL" : "BUY", qty: row.qty, note: i === 3 ? "Reduce into strength" : "Breakout above resistance" }))} /></PremiumCard>
          </div>
          {selectedRail(<><PremiumCard theme={theme} title="AI Position Insight"><div style={{ padding: 14, display: "grid", gap: 10 }}>{["Trend: Uptrend", "Support: 293.00", "Risk Level: Moderate", "Setup Quality: High"].map((x) => <div key={x}>{x}</div>)}</div></PremiumCard><PremiumCard theme={theme} title="Portfolio Allocation"><div style={{ padding: 14, display: "grid", gap: 12 }}>{["Technology 52.1%", "Consumer 18.7%", "Financial 10.8%", "Cash 10.8%"].map((x) => <div key={x} style={{ color: theme.text }}>{x}<div style={{ height: 5, background: theme.panel2, borderRadius: 99, marginTop: 5 }}><div style={{ width: x.includes("Technology") ? "80%" : "35%", height: "100%", background: theme.blue, borderRadius: 99 }} /></div></div>)}</div></PremiumCard></>)}
        </div>
      </div>
    );
  }

  if (activeWorkspace === "risk") {
    return (
      <div style={page}>
        <div style={mainTwoCol}>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme}>
              <div style={{ padding: 16, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}><SectionTitle theme={theme} title="Risk" /><PremiumTabs theme={theme} tabs={["Overview", "Limits", "Exposure", "Stress Test", "Margin"]} active="Overview" /><div style={{ marginTop: 14 }}><FilterBar theme={theme} search="All Accounts" items={["All Symbols", "Risk Model: Standard"]} /></div></div>
              <PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true }, { key: "side", label: "Side", width: "80px", color: () => theme.green }, { key: "qty", label: "Qty", width: "70px" }, { key: "last", label: "Last Price", width: "100px", align: "right", mono: true, render: (row) => row.last.toFixed(2) }, { key: "market", label: "Market Value", width: "120px", align: "right", mono: true, render: (row) => money(row.last * row.qty) }, { key: "day", label: "Day P&L", width: "100px", align: "right", color: () => theme.green, render: (row) => money((row.last - row.avg) * row.qty) }, { key: "exposure", label: "Exposure %", width: "90px", align: "right" }, { key: "beta", label: "Beta", width: "70px", render: (_, i) => (1.23 + i * 0.08).toFixed(2) }, { key: "var", label: "VaR (1D)", width: "100px", align: "right", color: () => theme.red, render: (_, i) => `-$${(742 + i * 83).toFixed(2)}` }, { key: "risk", label: "Risk Score", width: "90px", render: (row) => <StatusPill theme={theme} tone={row.risk > 70 ? "good" : "warn"}>{row.risk}</StatusPill> }]} rows={positionRows} selectedKey={selectedPosition?.symbol} onSelect={(row) => { setSelectedPositionSymbol(row.symbol); selectMainSymbol?.(row.symbol); }} />
            </PremiumCard>
            <PremiumCard theme={theme} title="Risk Events & Limits"><PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "100px" }, { key: "type", label: "Type", width: "180px" }, { key: "severity", label: "Severity", width: "100px", render: (row) => <StatusPill theme={theme} tone={row.severity === "High" ? "bad" : "warn"}>{row.severity}</StatusPill> }, { key: "message", label: "Message", width: "1fr" }, { key: "symbol", label: "Symbol", width: "90px", mono: true }, { key: "status", label: "Status", width: "100px" }]} rows={[{ time: "09:32:14", type: "Concentration Warning", severity: "High", message: "NVDA concentration exceeds 20% of portfolio", symbol: "NVDA", status: "Active" }, { time: "09:28:41", type: "Margin Warning", severity: "Medium", message: "Margin usage above 30% threshold", symbol: "Portfolio", status: "Active" }, { time: "09:25:07", type: "Daily Loss Threshold", severity: "Medium", message: "Approaching daily loss limit", symbol: "Portfolio", status: "Active" }]} /></PremiumCard>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme} title="Portfolio Risk Overview"><div style={{ padding: 16 }}>{renderChartGrid?.({ layoutMode: "1", compact: true })}</div></PremiumCard>
            <PremiumCard theme={theme} title="AI Risk Insight"><div style={{ padding: 14, display: "grid", gap: 10 }}>{["Trend Risk: Moderate", "Concentration Risk: High", "Liquidity Risk: Low", "Float / Liquidity: Healthy"].map((x, i) => <div key={x} style={{ color: i === 1 ? theme.red : theme.text }}>{x}</div>)}</div></PremiumCard>
            <PremiumCard theme={theme} title="Sector / Position Exposure"><div style={{ padding: 14, display: "grid", gap: 12 }}>{["Technology 37.3%", "Financial Services 18.6%", "Consumer Discretionary 15.4%", "ETFs 10.8%", "Cash 17.9%"].map((x) => <div key={x}>{x}<div style={{ height: 5, background: theme.panel2, borderRadius: 99, marginTop: 5 }}><div style={{ width: x.includes("Technology") ? "72%" : "38%", height: "100%", background: theme.blue, borderRadius: 99 }} /></div></div>)}</div></PremiumCard>
          </div>
        </div>
      </div>
    );
  }

  if (activeWorkspace === "performance") {
    const net = Number(realizedPnL || 0) + Number(totalUnrealizedPnL || 0) || 2814.72;
    return (
      <div style={page}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 10 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <SectionTitle theme={theme} title="Performance" action={<FilterBar theme={theme} items={["May 10 - Jun 8, 2024"]} />} />
            <PremiumCard theme={theme}><div style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0,1fr))" }}>{[["Net P&L", money(net), "good"], ["Gross Profit", "$5,742.18", "good"], ["Gross Loss", "-$2,927.46", "bad"], ["Win Rate", "62.16%", "good"], ["Profit Factor", "1.96", "good"], ["Max Drawdown", "-$1,243.35", "bad"], ["Total Trades", "74"], ["Avg Win", "$154.92", "good"]].map(([a, b, tone]) => <MetricTile key={a} theme={theme} label={a} value={b} tone={tone} />)}</div></PremiumCard>
            <PremiumCard theme={theme} title="Equity Curve"><div style={{ height: 330, padding: 16 }}><MiniSparkline theme={theme} seed={8} height={300} /></div></PremiumCard>
            <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 10 }}>
              <PremiumCard theme={theme} title="P&L Breakdown"><div style={{ padding: 22, display: "grid", placeItems: "center", minHeight: 220 }}><div style={{ width: 150, height: 150, borderRadius: "50%", background: `conic-gradient(${theme.green} 0 67%, ${theme.red} 67% 100%)`, display: "grid", placeItems: "center" }}><div style={{ width: 90, height: 90, borderRadius: "50%", background: theme.bg, display: "grid", placeItems: "center", textAlign: "center" }}>{money(net)}<br /><span style={{ color: theme.muted, fontSize: 11 }}>Net P&L</span></div></div></div></PremiumCard>
              <PremiumCard theme={theme} title="Performance By Symbol"><PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true }, { key: "pnl", label: "Net P&L", width: "100px", align: "right", color: () => theme.green }, { key: "ret", label: "Return", width: "90px", align: "right", color: () => theme.green }, { key: "trades", label: "Trades", width: "70px" }, { key: "win", label: "Win Rate", width: "90px" }]} rows={stocks.slice(0, 6).map((row, i) => ({ symbol: row.symbol, pnl: `$${(1245 - i * 166).toFixed(2)}`, ret: `+${(3.42 - i * 0.48).toFixed(2)}%`, trades: 18 - i, win: `${(66 - i * 2).toFixed(2)}%` }))} /></PremiumCard>
            </div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme} title="Performance Summary"><div style={{ padding: 14, display: "grid", gap: 12 }}>{[["Starting Net Liquidation", "$99,838.49"], ["Ending Net Liquidation", "$102,653.21"], ["Change", money(net)], ["Return", "+2.81%"], ["Alpha", "+1.53%"], ["Beta", "0.92"], ["Sharpe Ratio", "1.78"]].map(([a, b]) => <div key={a} style={{ display: "flex", justifyContent: "space-between" }}><span>{a}</span><b style={{ color: String(b).startsWith("+") || String(b).startsWith("$2") ? theme.green : theme.text }}>{b}</b></div>)}</div></PremiumCard>
            <PremiumCard theme={theme} title="Risk Metrics"><div style={{ padding: 14, display: "grid", gap: 12 }}>{["Max Drawdown -$1,243.35", "Drawdown Duration 5d", "Best Day $1,152.36", "Worst Day -$842.17"].map((x) => <div key={x}>{x}</div>)}</div></PremiumCard>
            <PremiumCard theme={theme} title="Monthly Returns"><div style={{ padding: 16, height: 150, display: "flex", alignItems: "end", gap: 18 }}>{[36, -24, 28, 48, -18, 58].map((h, i) => <div key={i} style={{ width: 18, height: Math.abs(h), background: h > 0 ? theme.green : theme.red }} />)}</div></PremiumCard>
            <PremiumCard theme={theme} title="Export Reports"><div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><ActionButton theme={theme} disabled title="PDF report export is not wired yet">PDF <Download size={14} /></ActionButton><ActionButton theme={theme} onClick={exportTradeSummaryCsv}>CSV <Download size={14} /></ActionButton></div></PremiumCard>
          </div>
        </div>
      </div>
    );
  }

  if (activeWorkspace === "journal") {
    const wins = journalRows.filter((row) => row.outcome === "Win").length || 46;
    const losses = journalRows.filter((row) => row.outcome === "Loss").length || 26;
    const tradeCount = journalRows.length || 74;
    const winRate = `${((wins / Math.max(tradeCount, 1)) * 100).toFixed(2)}%`;
    return (
      <div style={page}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 16 }}>
            <SectionTitle theme={theme} title="Journal" subtitle="Track, review and improve your trading performance." />
            <div style={{ display: "flex", gap: 8 }}>
              <ActionButton theme={theme} onClick={() => setOrderMessage?.("Journal filters reset locally for this view.")}>Reset</ActionButton>
              <ActionButton theme={theme} active onClick={addJournalEntry}>+ Add Trade</ActionButton>
              <ActionButton theme={theme} onClick={exportJournalCsv}>Export CSV</ActionButton>
            </div>
          </div>
          <PremiumCard theme={theme}>
            <div style={{ padding: 12, display: "grid", gap: 12 }}>
            <PremiumTabs theme={theme} tabs={["Overview", "Trades", "Setups", "Daily Log", "Notes", "Lessons", "Statistics", "Exports"]} active="Overview" />
              <FilterBar theme={theme} items={["May 10 - Jun 8, 2024", "All Symbols", "All Setups", "All Tags", "All Outcomes"]} />
            </div>
          </PremiumCard>
          {journalDraft?.setup && (
            <PremiumCard theme={theme} title="Prepared Journal Draft">
              <div style={{ padding: 14, display: "grid", gridTemplateColumns: "120px 150px 90px 1fr", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ color: theme.muted, fontSize: 10, textTransform: "uppercase", fontWeight: 850 }}>Symbol</div>
                  <div style={{ color: theme.text, fontFamily: terminalMonoFont, fontWeight: 900 }}>{journalDraft.symbol || selectedStock}</div>
                </div>
                <div>
                  <div style={{ color: theme.muted, fontSize: 10, textTransform: "uppercase", fontWeight: 850 }}>Setup</div>
                  <div style={{ color: theme.text, fontWeight: 850 }}>{journalDraft.setup}</div>
                </div>
                <div>
                  <div style={{ color: theme.muted, fontSize: 10, textTransform: "uppercase", fontWeight: 850 }}>Grade</div>
                  <StatusPill theme={theme} tone={journalDraft.grade === "A" || journalDraft.grade === "B" ? "good" : "warn"}>
                    {journalDraft.grade || "Review"}
                  </StatusPill>
                </div>
                <div style={{ color: theme.muted, fontSize: 12, lineHeight: 1.45, minWidth: 0 }}>
                  {journalDraft.review || journalDraft.plan || "Draft prepared for review before saving."}
                </div>
              </div>
            </PremiumCard>
          )}
            <PremiumCard theme={theme}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10, minmax(0, 1fr))" }}>
                {[
                  ["Net P&L", money(journalNet), "good", "+2.81%"],
                  ["Total Trades", String(tradeCount), "neutral"],
                  ["Win Rate", winRate, "good"],
                  ["Profit Factor", "1.96", "good"],
                  ["Avg Win", "+$154.92", "good"],
                  ["Avg Loss", "-$89.92", "bad"],
                  ["Expectancy", "+$38.04", "good"],
                  ["Best Trade", "+$1,152.36", "good"],
                  ["Worst Trade", "-$842.17", "bad"],
                  ["Avg Hold Time", "2h 13m", "neutral"],
                ].map(([label, value, tone, detail]) => (
                  <MetricTile key={label} theme={theme} label={label} value={value} tone={tone} detail={detail} />
                ))}
              </div>
            </PremiumCard>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) 300px 0.85fr", gap: 10 }}>
              <PremiumCard theme={theme} title="Equity Curve">
                <div style={{ padding: 16, height: 310 }}>
                  <div style={{ width: 170, marginBottom: 12 }}>
                    <ActionButton theme={theme} disabled title="Journal equity metric switching is not wired in this pass">Net Liquidation</ActionButton>
                  </div>
                  <div style={{ height: 220, borderLeft: `1px solid ${theme.borderSoft || theme.border}`, borderBottom: `1px solid ${theme.borderSoft || theme.border}`, paddingTop: 12 }}>
                    <MiniSparkline theme={theme} seed={9} height={190} />
                  </div>
                  <div style={{ textAlign: "center", color: theme.muted, fontSize: 12, marginTop: 8 }}>Net Liquidation</div>
                </div>
              </PremiumCard>
              <PremiumCard theme={theme} title="Trades By Outcome">
                <div style={{ padding: 18, display: "grid", gridTemplateColumns: "150px 1fr", gap: 18, alignItems: "center", minHeight: 310 }}>
                  <div style={{ width: 138, height: 138, borderRadius: "50%", background: `conic-gradient(${theme.green} 0 62%, ${theme.red} 62% 97%, ${theme.muted} 97% 100%)`, display: "grid", placeItems: "center" }}>
                    <div style={{ width: 76, height: 76, borderRadius: "50%", background: theme.bg, display: "grid", placeItems: "center", textAlign: "center", color: theme.text, fontFamily: terminalMonoFont }}>
                      <b>{tradeCount}</b>
                      <span style={{ color: theme.muted, fontSize: 10 }}>Total Trades</span>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 10, fontSize: 12 }}>
                    <span style={{ color: theme.green }}>Won {wins}</span>
                    <span style={{ color: theme.red }}>Lost {losses}</span>
                    <span style={{ color: theme.muted }}>Breakeven 2</span>
                  </div>
                </div>
              </PremiumCard>
              <PremiumCard theme={theme} title="P&L Distribution">
                <div style={{ padding: 18, height: 310, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", alignItems: "end", gap: 14 }}>
                  {[-26, -54, -72, 138, 86, 52, 24].map((height, index) => (
                    <div key={index} style={{ display: "grid", gap: 8, alignItems: "end" }}>
                      <div style={{ height: Math.abs(height), background: height > 0 ? theme.green : theme.red, opacity: 0.86, borderRadius: "4px 4px 0 0" }} />
                      <span style={{ color: theme.muted, fontSize: 10, textAlign: "center" }}>{["< -400", "-400", "-200", "0-200", "200", "400", ">600"][index]}</span>
                    </div>
                  ))}
                </div>
              </PremiumCard>
            </div>
            <PremiumCard theme={theme} title="Recent Trades" action={<ActionButton theme={theme} active onClick={addJournalEntry}>+ Add Trade</ActionButton>}>
              <PremiumTable
                theme={theme}
                columns={[
                  { key: "date", label: "Date/Time", width: "150px" },
                  { key: "symbol", label: "Symbol", width: "90px", mono: true, strong: true },
                  { key: "setup", label: "Setup", width: "120px" },
                  { key: "side", label: "Side", width: "70px", color: (row) => row.side === "Short" ? theme.red : theme.green },
                  { key: "qty", label: "Qty", width: "70px", mono: true },
                  { key: "entry", label: "Entry", width: "85px", mono: true },
                  { key: "exit", label: "Exit", width: "85px", mono: true },
                  { key: "pnl", label: "P&L (USD)", width: "100px", mono: true, color: (row) => num(row.pnl) >= 0 ? theme.green : theme.red, render: (row) => money(row.pnl) },
                  { key: "pnlPct", label: "P&L (%)", width: "90px", mono: true, color: (row) => String(row.pnlPct).startsWith("-") ? theme.red : theme.green },
                  { key: "r", label: "R Multiple", width: "90px", mono: true, color: (row) => String(row.r).startsWith("-") ? theme.red : theme.green },
                  { key: "hold", label: "Hold Time", width: "90px" },
                  { key: "outcome", label: "Outcome", width: "80px", color: (row) => row.outcome === "Loss" ? theme.red : theme.green },
                  { key: "tag", label: "Notes", width: "90px", render: (row) => <StatusPill theme={theme} tone={row.outcome === "Loss" ? "warn" : "neutral"}>{row.tag || row.setup}</StatusPill> },
                  { key: "notes", label: "Review", width: "1fr" },
                ]}
                rows={journalRows}
              />
              <div style={{ padding: "12px 16px", color: theme.muted, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                <span>Showing 1 to {Math.min(journalRows.length, 8)} of {Math.max(74, journalRows.length)} trades</span>
                <span style={{ fontFamily: terminalMonoFont }}>1 2 3 4 5 ... 10</span>
              </div>
            </PremiumCard>
        </div>
      </div>
    );
  }

  if (activeWorkspace === "replay") {
    const replayPositions = [
      { symbol: "AAPL", side: "Long", qty: 100, avg: "189.12", last: "189.18", pnl: "+$6.00", pct: "+0.03%" },
      { symbol: "TSLA", side: "Long", qty: 50, avg: "200.45", last: "201.23", pnl: "+$39.00", pct: "+0.39%" },
      { symbol: "NVDA", side: "Short", qty: 25, avg: "916.30", last: "914.80", pnl: "+$37.50", pct: "+0.16%" },
    ];
    return (
      <div style={page}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
            <SectionTitle theme={theme} title="Replay" subtitle="Practice trading with historical market data. All orders are simulated." />
            <ActionButton theme={theme} disabled title="Replay settings editing is not wired in this pass">Replay Settings</ActionButton>
          </div>
            <PremiumCard theme={theme}>
              <div style={{ padding: 12, display: "grid", gridTemplateColumns: "160px 170px 160px 160px 120px 1fr", gap: 8, alignItems: "center" }}>
                {["Stocks (US)", "May 15, 2024", "09:30 AM", "04:00 PM", `${replaySpeed || 1}x`].map((value, index) => (
                  <label key={`${value}-${index}`} style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 10, textTransform: "uppercase" }}>
                    {["Market", "Date", "Start Time", "End Time", "Speed"][index]}
                    <input readOnly value={value} style={{ height: 32, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 10px", fontFamily: terminalMonoFont }} />
                  </label>
                ))}
                <div style={{ display: "flex", gap: 8, justifyContent: "end" }}>
                  <ActionButton theme={theme} onClick={() => resetReplay?.()}>Skip to Open</ActionButton>
                  <ActionButton theme={theme} onClick={() => stepReplay?.()}>Step</ActionButton>
                  <ActionButton theme={theme} good onClick={() => setReplayPlaying?.(!replayPlaying)}>
                    {replayPlaying ? "Pause Replay" : "Start Replay"}
                  </ActionButton>
                </div>
              </div>
            </PremiumCard>
            <div style={{ display: "grid", gridTemplateColumns: "250px minmax(0, 1fr) 310px", gap: 10 }}>
              <PremiumCard theme={theme} title="Replay Controls">
                <div style={{ padding: 14, display: "grid", gap: 18 }}>
                  <div>
                    <div style={{ color: theme.muted, fontSize: 12, marginBottom: 8 }}>Speed</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      {["0.25x", "0.5x", "1x", "2x", "5x", "10x", "20x", "50x", "100x"].map((speed) => (
                        <ActionButton
                          key={speed}
                          theme={theme}
                          active={Number(speed.replace("x", "")) === Number(replaySpeed || 1)}
                          onClick={() => setReplaySpeed?.(Number(speed.replace("x", "")))}
                        >
                          {speed}
                        </ActionButton>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: theme.muted, fontSize: 12, marginBottom: 8 }}>Jump to Time</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {["Market Open", "+ 1 Hour", "+ 2 Hours", "+ 3 Hours", "Market Close"].map((label) => (
                        <ActionButton
                          key={label}
                          theme={theme}
                          onClick={() => (label === "Market Open" ? resetReplay?.() : stepReplay?.())}
                        >
                          {label}
                        </ActionButton>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: theme.muted, fontSize: 12, marginBottom: 8 }}>
                      <span>Bookmarks</span><ActionButton theme={theme} onClick={() => setOrderMessage?.("Replay bookmark noted locally for review.")}>+ Add</ActionButton>
                    </div>
                    <div style={{ display: "grid", gap: 11 }}>
                      {["Opening Range Breakout 09:45", "AAPL Spike 10:15", "TSLA Breakout 11:02", "GOOG Pullback 12:45", "Power Hour 15:00"].map((bookmark) => (
                        <div key={bookmark} style={{ display: "flex", justifyContent: "space-between", color: theme.text, fontSize: 12 }}>
                          <span>{bookmark}</span><MoreVertical size={14} color={theme.muted} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </PremiumCard>
              <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr) 76px", gap: 10, minHeight: 0 }}>
                <PremiumCard theme={theme} title={`${selectedStock} Replay Chart`} action={<span style={{ color: theme.green, fontFamily: terminalMonoFont }}>O 189.15 H 189.22 L 189.10 C 189.18 +0.02%</span>}>
                  <div style={{ height: 260 }}>{renderChartGrid?.({ layoutMode: "1", compact: true })}</div>
                  <div style={{ height: 60, borderTop: `1px solid ${theme.borderSoft || theme.border}`, padding: 8 }}>
                    <div style={{ color: theme.muted, fontSize: 12 }}>RSI 14 <span style={{ color: "#a56dff" }}>55.37</span></div>
                    <MiniSparkline theme={theme} seed={12} negative={false} height={32} />
                  </div>
                </PremiumCard>
                <PremiumCard theme={theme}>
                  <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 16 }}>
                    <div>
                      <div style={{ height: 4, background: theme.panel2, borderRadius: 99 }}>
                        <div style={{ width: "38%", height: "100%", background: theme.blue, borderRadius: 99 }} />
                      </div>
                      <div style={{ color: theme.text, marginTop: 12, fontFamily: terminalMonoFont }}>10:15:30 / 16:00:00</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <ActionButton theme={theme} onClick={() => resetReplay?.()}>|&lt;</ActionButton>
                      <ActionButton theme={theme} onClick={() => stepReplay?.()}>&lt;</ActionButton>
                      <ActionButton theme={theme} active={replayPlaying} onClick={() => setReplayPlaying?.(!replayPlaying)}>
                        {replayPlaying ? "||" : ">"}
                      </ActionButton>
                      <ActionButton theme={theme} onClick={() => stepReplay?.()}>&gt;&gt;</ActionButton>
                      <ActionButton theme={theme} onClick={() => stepReplay?.()}>&gt;|</ActionButton>
                      <ActionButton theme={theme} onClick={() => resetReplay?.()}>Reset</ActionButton>
                    </div>
                  </div>
                </PremiumCard>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <PremiumCard theme={theme} title="Simulation Summary"><div style={{ padding: 14, display: "grid", gap: 11 }}>{[["Starting Cash", "$100,000.00"], ["Net Liquidation", "$102,653.21"], ["Total P&L", money(replayNet)], ["Realized P&L", "$1,842.15"], ["Unrealized P&L", "$811.06"], ["Total Trades", replayRows.length], ["Win Rate", `${replayWinRate}%`], ["Profit Factor", "2.35"], ["Max Drawdown", "-$1,243.35"]].map(([a, b]) => <div key={a} style={{ display: "flex", justifyContent: "space-between", color: theme.muted }}><span>{a}</span><b style={{ color: String(b).startsWith("-") ? theme.red : String(b).startsWith("$102") || String(b).startsWith("+") ? theme.green : theme.text }}>{b}</b></div>)}</div></PremiumCard>
                <PremiumCard theme={theme} title="Market Replay Status"><div style={{ padding: 14, display: "grid", gap: 11 }}>{[["Replay Date", "May 15, 2024"], ["Current Time", "10:15:30 ET"], ["Data Speed", `${replaySpeed || 1}x`], ["Data Source", "Historical"], ["Market Hours", "09:30 - 16:00 ET"], ["Status", "On Replay"]].map(([a, b]) => <div key={a} style={{ display: "flex", justifyContent: "space-between", color: theme.muted }}><span>{a}</span><b style={{ color: b === "On Replay" ? theme.green : theme.text }}>{b}</b></div>)}</div></PremiumCard>
                <PremiumCard theme={theme} title="Market Events"><div style={{ padding: 14, display: "grid", gap: 10 }}>{["09:30 Market Open", "10:15 High Volume Detected", "11:02 Breakout Above 200 MA", "12:30 Fed Speaker", "15:00 Power Hour Start", "16:00 Market Close"].map((event, index) => <div key={event} style={{ color: theme.text, fontSize: 12 }}><span style={{ color: [theme.green, theme.blue, theme.amber, theme.red][index % 4], marginRight: 8 }}>*</span>{event}</div>)}</div></PremiumCard>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1fr) 280px", gap: 10 }}>
              <PremiumCard theme={theme} title="Open Positions (Replay)"><PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true }, { key: "side", label: "Side", width: "70px", color: (row) => row.side === "Short" ? theme.red : theme.green }, { key: "qty", label: "Qty", width: "60px" }, { key: "avg", label: "Avg Price", width: "90px" }, { key: "last", label: "Last", width: "80px" }, { key: "pnl", label: "Unrealized P&L", width: "120px", color: () => theme.green }, { key: "pct", label: "P&L (%)", width: "80px", color: () => theme.green }]} rows={replayPositions} /></PremiumCard>
              <PremiumCard theme={theme} title="Trade History (Replay)"><PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "90px" }, { key: "symbol", label: "Symbol", width: "90px", mono: true }, { key: "side", label: "Side", width: "80px", color: (row) => row.side === "Sell" || row.side === "Short" ? theme.red : theme.green }, { key: "qty", label: "Qty", width: "70px" }, { key: "price", label: "Price", width: "90px" }, { key: "pnl", label: "P&L", width: "90px", color: (row) => String(row.pnl).startsWith("+") ? theme.green : theme.muted }]} rows={replayRows} /></PremiumCard>
              <PremiumCard theme={theme} title="Replay Notes"><div style={{ padding: 14, display: "grid", gap: 12 }}><textarea placeholder="Add notes for this replay session..." style={{ minHeight: 170, resize: "vertical", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 7, background: theme.panel2, color: theme.text, padding: 12 }} /><ActionButton theme={theme} onClick={() => openReplayJournal?.()}>Send to Journal</ActionButton></div></PremiumCard>
            </div>
        </div>
      </div>
    );
  }

  if (activeWorkspace === "settings") {
    const settingSelect = (value) => <select value={value} readOnly style={{ width: 160, height: 28, background: theme.panel2, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 5, color: theme.text, padding: "0 8px" }}><option>{value}</option></select>;
    const settingToggle = (on = true) => <span style={{ width: 32, height: 18, borderRadius: 99, background: on ? theme.blue : theme.border, display: "inline-flex", justifyContent: on ? "flex-end" : "flex-start", padding: 2 }}><span style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff" }} /></span>;
    const group = (title, rows) => <PremiumCard theme={theme} title={title}><div style={{ padding: 16, display: "grid", gap: 12 }}>{rows.map(([label, control]) => <div key={label} style={{ display: "grid", gridTemplateColumns: "220px 1fr", alignItems: "center", color: theme.muted, fontSize: 12 }}><span>{label}</span><span>{control}</span></div>)}</div></PremiumCard>;
    return (
      <div style={page}>
        <SectionTitle theme={theme} title="Settings" />
        <PremiumTabs theme={theme} tabs={["General", "Trading", "Layout", "Notifications", "Data & Connections", "Security"]} active="General" />
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(360px, 0.9fr)", gap: 10, marginTop: 12 }}>
          <div style={{ display: "grid", gap: 10 }}>
            {group("Workspace Preferences", [["Theme", settingSelect(themeMode === "dark" ? "Dark" : "Light")], ["Compact mode", settingToggle(false)], ["Default landing tab", settingSelect("Dashboard")], ["Time zone", settingSelect("Pacific (PT)")], ["Currency display", settingSelect("USD")]])}
            {group("Trading Preferences", [["Default order type", settingSelect("Limit")], ["Confirm before order", settingToggle(true)], ["Default TIF", settingSelect("Day")], ["Hotkeys enabled", settingToggle(true)], ["Risk warnings enabled", settingToggle(true)]])}
            {group("Chart & Scanner Defaults", [["Default chart timeframe", settingSelect("1D")], ["Show volume", settingToggle(true)], ["Scanner auto refresh", settingToggle(true)], ["Default universe", settingSelect("US Stocks")], ["Relative volume threshold", settingSelect("1.50")]])}
            <PremiumCard theme={theme} title="Layout Presets"><div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>{["Trader", "Research", "Minimal", "Risk"].map((x, i) => <button key={x} type="button" onClick={() => setOrderMessage?.(`${x} layout preset selected for local review.`)} style={{ minHeight: 72, border: `1px solid ${i === 0 ? theme.blue : theme.borderSoft}`, borderRadius: 7, background: theme.panel2, color: theme.text, textAlign: "left", padding: 12, cursor: "pointer" }}>{x}<div style={{ color: theme.muted, fontSize: 11, marginTop: 5 }}>Chart, Watchlist, Orders</div></button>)}</div></PremiumCard>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {group("Broker & Data Connections", [["Broker status", <StatusPill key="b" theme={theme} tone={brokerConnected ? "good" : "warn"}>{brokerConnected ? "Connected" : "Review-only"}</StatusPill>], ["Market data status", <StatusPill key="d" theme={theme} tone="good">Live</StatusPill>], ["Actions", <span key="a"><ActionButton theme={theme} disabled title="Connection management stays in backend/Railway settings">Manage Connection</ActionButton> <ActionButton theme={theme} onClick={() => setOrderMessage?.("Refresh backend status from the main health controls.")}><RefreshCw size={14} /></ActionButton></span>]])}
            {group("Notification Settings", [["Price alerts", settingToggle(true)], ["Order fills", settingToggle(true)], ["News catalyst alerts", settingToggle(true)], ["Daily summary email", settingToggle(true)], ["Sound alerts", settingToggle(true)]])}
            {group("Security", [["Two-factor authentication", <StatusPill key="s" theme={theme} tone="good">Enabled</StatusPill>], ["Login session timeout", settingSelect("30 minutes")], ["Device management", <ActionButton key="m" theme={theme} disabled title="Device management requires auth backend work">Manage Devices</ActionButton>], ["Password", <ActionButton key="p" theme={theme} disabled title="Password changes require auth backend work">Change Password</ActionButton>]])}
            {group("Backup & Sync", [["Cloud sync", <StatusPill key="c" theme={theme} tone={user ? "good" : "warn"}>{user ? "Enabled" : "Local"}</StatusPill>], ["Last backup", "June 8, 2024 05:12 AM ET"], ["Actions", <span key="sync"><ActionButton theme={theme} onClick={saveWorkspaceToCloud}>Save</ActionButton> <ActionButton theme={theme} onClick={loadWorkspaceFromCloud}>Load</ActionButton> <ActionButton theme={theme} onClick={resetWorkspace}>Reset</ActionButton></span>]])}
            <PremiumCard theme={theme} title="Recent Changes"><div style={{ padding: 14, display: "grid", gap: 10 }}>{["Daily summary email Enabled", "Default order type Limit", "Scanner auto refresh Enabled", "Layout preset Trader"].map((x) => <div key={x} style={{ color: theme.text }}><span style={{ color: theme.green }}>*</span> {x}</div>)}</div></PremiumCard>
          </div>
        </div>
      </div>
    );
  }

  if (activeWorkspace === "chart-analysis") {
    return (
      <div style={page}>
        <div style={mainTwoCol}>
          <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr) 220px", gap: 10, minHeight: 0 }}>
            <PremiumCard theme={theme} style={{ minHeight: 520 }}>{renderChartGrid?.({ layoutMode: "1" })}</PremiumCard>
            <PremiumCard theme={theme}><PremiumTabs theme={theme} tabs={["Watchlist", "Indicators", "Alerts", "Notes"]} active="Indicators" /><PremiumTable theme={theme} columns={[{ key: "indicator", label: "Indicator", width: "1.4fr" }, { key: "status", label: "Status", width: "120px", color: () => theme.green }, { key: "params", label: "Parameters", width: "1fr" }, { key: "value", label: "Value", width: "100px", align: "right" }, { key: "signal", label: "Signal", width: "100px", color: () => theme.green }]} rows={[{ indicator: "Moving Average (50)", status: "Active", params: "MA Type: SMA", value: "289.71", signal: "Bullish" }, { indicator: "Moving Average (200)", status: "Active", params: "MA Type: SMA", value: "268.42", signal: "Bullish" }, { indicator: "RSI (14)", status: "Active", params: "Overbought: 70 / Oversold: 30", value: "63.21", signal: "Neutral" }, { indicator: "MACD (12,26,9)", status: "Active", params: "Signal: 9", value: "2.41", signal: "Bullish" }, { indicator: "Volume (20)", status: "Active", params: "MA Type: SMA", value: "55.21M", signal: "Above Avg" }]} /></PremiumCard>
          </div>
          <div style={{ display: "grid", gap: 10 }}>{selectedRail(<PremiumCard theme={theme} title="AI Chart Insight"><div style={{ padding: 14, display: "grid", gap: 10 }}>{["Trend Bullish", "Support 293.41 - 287.20", "Resistance 305.40 - 315.00", "Volume Above Avg (20)", "Setup Quality High"].map((x) => <div key={x}>{x}</div>)}</div></PremiumCard>)}</div>
        </div>
      </div>
    );
  }

  const selectedDetailStats = [
    ["Open", dashboard.selected.open],
    ["Day High", dashboard.selected.dayHigh],
    ["Day Low", dashboard.selected.dayLow],
    ["Volume", dashboard.selected.volume],
    ["Avg Vol", dashboard.selected.avgVolume],
    ["Market Cap", dashboard.selected.marketCap],
    ["P/E", dashboard.selected.pe],
    ["Dividend", dashboard.selected.dividend ?? "Not reported"],
    [
      "Yield",
      Number.isFinite(Number(dashboard.selected.dividend)) && Number(dashboard.selected.price) > 0
        ? `${((Number(dashboard.selected.dividend) / Number(dashboard.selected.price)) * 100).toFixed(2)}%`
        : "Not reported",
    ],
  ];

  return (
    <div style={page}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) clamp(330px, 22vw, 390px)",
          gridTemplateRows: "minmax(500px, 1fr) minmax(168px, 188px) 148px",
          gap: 9,
          height: "100%",
          minHeight: 0,
        }}
      >
        <PremiumCard theme={theme} style={{ gridColumn: "1 / 2", gridRow: "1 / 2" }}>
          {renderChartGrid?.({ layoutMode: "1", compact: true })}
        </PremiumCard>
        <div
          style={{
            gridColumn: "2 / 3",
            gridRow: "1 / 4",
            display: "grid",
            gridTemplateRows: "auto minmax(0, 1fr) auto",
            gap: 9,
            minHeight: 0,
          }}
        >
          <PremiumCard theme={theme} title="My Watchlist" action={<Plus size={16} color={theme.muted} />}>
            <PremiumTable
              theme={theme}
              columns={[
                { key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true },
                { key: "price", label: "Last", width: "90px", align: "right", mono: true, render: (row) => formatPrice(row.price) },
                { key: "change", label: "Chg%", width: "80px", align: "right", mono: true, color: (row) => toneColor(theme, row.changePercent), render: (row) => formatPercent(row.changePercent) },
                { key: "volume", label: "Vol", width: "80px", align: "right", mono: true, render: (row) => row.volumeLabel || formatCompactNumber(row.volume, 2) },
              ]}
              rows={dashboard.watchlistRows.slice(0, 5)}
              selectedKey={dashboard.selected.symbol}
              onSelect={(row) => selectMainSymbol?.(row.symbol)}
              rowMinHeight={36}
              headerMinHeight={32}
              cellPadding="0 12px"
              columnGap={10}
            />
          </PremiumCard>
          <DetailRail theme={theme} selected={dashboard.selected} compact detailStats={selectedDetailStats}>
            <PremiumCard theme={theme} title="Latest News">
              <div style={{ padding: "11px 14px", display: "grid", gap: 10, overflow: "auto", maxHeight: 130 }}>
                {dashboard.newsRows.slice(0, 3).map((item) => {
                  const content = (
                    <>
                      <div style={{ color: theme.muted, fontSize: 10 }}>
                        <span style={{ fontFamily: terminalMonoFont }}>{item.time}</span> · {item.source}
                      </div>
                      <div style={{ color: theme.text, fontSize: 12, lineHeight: 1.35, fontWeight: 750 }}>{item.headline}</div>
                    </>
                  );
                  return item.url ? (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ textDecoration: "none", outlineOffset: 3 }}
                    >
                      {content}
                    </a>
                  ) : (
                    <div key={item.id}>{content}</div>
                  );
                })}
              </div>
            </PremiumCard>
          </DetailRail>
          <PremiumCard theme={theme} title="Quick Order">
            <div style={{ padding: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 76px 96px", gap: 8 }}>
                {["Symbol", "Shares", "Order Type"].map((label, index) => (
                  <label key={label} style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 10, textTransform: "uppercase" }}>
                    {label}
                    <input
                      value={index === 0 ? dashboard.selected.symbol : index === 1 ? quantity : "LIMIT"}
                      onChange={(event) => index === 1 && setQuantity?.(Number(event.target.value) || 1)}
                      readOnly={index !== 1}
                      style={{ height: 31, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 5, background: theme.panel2, color: theme.text, padding: "0 8px", fontFamily: terminalMonoFont }}
                    />
                  </label>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                {["BUY", "SELL"].map((side) => (
                  <ActionButton
                    key={side}
                    theme={theme}
                    good={side === "BUY"}
                    danger={side === "SELL"}
                    onClick={() => {
                      setOrderSide?.(side);
                      setOrderConfirmed?.(false);
                      setPremiumDockTab?.("orders");
                      setOrderMessage?.(`${side} review prepared for ${dashboard.selected.symbol}. This shortcut is review-only.`);
                    }}
                  >
                    {side === "BUY" ? "Buy" : "Sell"}
                  </ActionButton>
                ))}
              </div>
            </div>
          </PremiumCard>
        </div>
        <PremiumCard theme={theme} style={{ gridColumn: "1 / 2", gridRow: "2 / 3" }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${theme.borderSoft || theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <PremiumTabs theme={theme} tabs={["Scanner", "Gainers", "Losers", "Active", "Momentum", "High RVOL", "News", "Earnings"]} active="Gainers" />
            <ActionButton theme={theme} onClick={() => setOrderMessage?.(`Scanner view saved locally for ${selected.symbol}.`)}>Save Scan</ActionButton>
          </div>
          {scannerTable(dashboard.scannerRows.slice(0, 4), dashboard.selected.symbol)}
        </PremiumCard>
        <div style={{ gridColumn: "1 / 2", gridRow: "3 / 4", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(270px, 340px)", gap: 9, minHeight: 0 }}>
          <PremiumCard theme={theme} style={{ minHeight: 0 }}>
            <PremiumTabs
              theme={theme}
              tabs={[
                `Positions (${dashboard.positionRows.length})`,
                `Orders (${dashboard.orders?.length || 0})`,
                `Alerts (${dashboard.alerts?.length || 0})`,
                "Executions",
                "Messages",
              ]}
              active={`Positions (${dashboard.positionRows.length})`}
            />
            <PremiumTable
              theme={theme}
              columns={[
                { key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true },
                { key: "side", label: "Side", width: "80px", color: (row) => row.side === "SHORT" ? theme.red : theme.green, mono: true },
                { key: "quantity", label: "Qty", width: "80px", align: "right", mono: true },
                { key: "averagePrice", label: "Avg Price", width: "110px", align: "right", mono: true, render: (row) => formatPrice(row.averagePrice) },
                { key: "lastPrice", label: "Last Price", width: "110px", align: "right", mono: true, render: (row) => formatPrice(row.lastPrice) },
                { key: "pnl", label: "P&L", width: "110px", align: "right", mono: true, color: (row) => toneColor(theme, row.pnl), render: (row) => formatSignedCurrency(row.pnl) },
              ]}
              rows={dashboard.positionRows.slice(0, 1)}
              style={{ maxHeight: 86 }}
            />
          </PremiumCard>
          <PremiumCard theme={theme} title="Risk Overview">
            <div style={{ padding: 12, display: "grid", gap: 8 }}>
              {dashboard.riskOverview.map((row) => (
                <div key={row.label} style={{ display: "grid", gap: 5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, color: theme.text, fontSize: 12 }}>
                    <span>{row.label}</span>
                    <span style={{ color: row.tone === "good" ? theme.green : row.tone === "warn" ? theme.amber : theme.text, fontFamily: terminalMonoFont }}>
                      {row.value}
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 99, background: theme.panel2 }}>
                    <div style={{ width: `${row.percent}%`, height: "100%", borderRadius: 99, background: row.tone === "warn" ? theme.amber : theme.green }} />
                  </div>
                </div>
              ))}
            </div>
          </PremiumCard>
        </div>
      </div>
    </div>
  );
}
