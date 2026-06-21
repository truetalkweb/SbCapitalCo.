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
              cursor: "pointer",
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

function ActionButton({ theme, children, active = false, danger = false, good = false, style = {}, ...props }) {
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
      {...props}
      style={{
        height: 34,
        border: `1px solid ${active || danger || good ? "rgba(255,255,255,0.12)" : theme.borderSoft || theme.border}`,
        borderRadius: 6,
        background: bg,
        color: active || danger || good ? "#fff" : theme.text,
        padding: "0 13px",
        fontSize: 12,
        fontWeight: 850,
        cursor: "pointer",
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
        <ActionButton key={item} theme={theme} style={{ minWidth: 116, justifyContent: "space-between" }}>
          {item}
        </ActionButton>
      ))}
      <ActionButton theme={theme}>
        <Filter size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
        Filters
      </ActionButton>
    </div>
  );
}

function PremiumTable({ theme, columns, rows, selectedKey, onSelect, keyField = "symbol", style = {} }) {
  return (
    <div style={{ minWidth: 0, overflow: "auto", ...style }}>
      <div
        role="row"
        style={{
          display: "grid",
          gridTemplateColumns: columns.map((column) => column.width || "1fr").join(" "),
          gap: 12,
          minHeight: 36,
          alignItems: "center",
          padding: "0 14px",
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
        const rowKey = row[keyField] || row.id || index;
        const selected = rowKey === selectedKey;
        return (
          <button
            key={rowKey}
            type="button"
            onClick={() => onSelect?.(row)}
            style={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: columns.map((column) => column.width || "1fr").join(" "),
              gap: 12,
              minHeight: 42,
              alignItems: "center",
              padding: "0 14px",
              border: "none",
              borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
              background: selected ? "linear-gradient(90deg, rgba(45,140,255,0.30), rgba(45,140,255,0.04))" : "transparent",
              color: theme.text,
              cursor: "pointer",
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

function DetailRail({ theme, selected, children, title = "Selected Symbol", actions }) {
  return (
    <div style={{ display: "grid", gap: 10, minWidth: 0, minHeight: 0 }}>
      <PremiumCard theme={theme} title={title} action={<MoreVertical size={16} color={theme.muted} />}>
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
              <SymbolBadge theme={theme} symbol={selected.symbol} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: theme.text, fontFamily: terminalMonoFont }}>
                  {selected.symbol}
                </div>
                <div style={{ color: theme.muted, fontSize: 12 }}>{selected.name || selected.company || "Selected equity"}</div>
              </div>
            </div>
            <Star size={18} color={theme.blue} fill={theme.blue} />
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ color: theme.text, fontSize: 30, fontWeight: 900, fontFamily: terminalMonoFont }}>{num(selected.price) ? num(selected.price).toFixed(2) : "Quote"}</span>
            <span style={{ color: toneColor(theme, moveOf(selected)), fontSize: 16, fontWeight: 900, fontFamily: terminalMonoFont }}>
              {pct(moveOf(selected))}
            </span>
          </div>
          <div style={{ color: theme.green, fontSize: 12, fontWeight: 850, marginTop: 6 }}>
            Market Context Active
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 14 }}>
            {[
              ["Day High", "298.22"],
              ["Day Low", "293.41"],
              ["Volume", selected.volume || "55.21M"],
              ["Float", selected.float || "15.76B"],
              ["P/E", "28.41"],
              ["Beta", "1.23"],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8, color: theme.muted, fontSize: 12 }}>
                <span>{label}</span>
                <span style={{ color: theme.text, fontFamily: terminalMonoFont }}>{value}</span>
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
    { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", price: 532.48, change: "+0.24%", volume: "62.74M", rvol: "0.9x", float: "-", sector: "ETF", setup: "Neutral", score: 52, risk: "Low" },
  ];
  const bySymbol = new Map(base.map((row) => [row.symbol, row]));
  [...(liveStocks || []), ...(scannerStocks || []), selectedStockData].filter(Boolean).forEach((stock) => {
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
    });
  });
  return Array.from(bySymbol.values()).slice(0, 16);
}

function makeNews(news, selectedSymbol) {
  const fallback = [
    ["09:32 AM", "Apple unveils AI-powered upgrades across iPhone, Mac, and iOS", "AAPL", "Bloomberg", "High", "Bullish"],
    ["09:21 AM", "Nvidia reports record data center demand; raises Q2 guidance", "NVDA", "CNBC", "High", "Bullish"],
    ["09:10 AM", "Tesla delivers upbeat Q1 update; reiterates 2025 growth targets", "TSLA", "Reuters", "High", "Bullish"],
    ["08:58 AM", "Coinbase to join S&P 500 effective May 19", "COIN", "WSJ", "High", "Bullish"],
    ["08:45 AM", "SoFi Technologies posts strong member growth in Q1", "SOFI", "Benzinga", "Medium", "Bullish"],
    ["08:34 AM", "AMD announces MI300X shipments ramp; AI demand surging", "AMD", "CNBC", "High", "Bullish"],
    ["08:22 AM", "Fed's Williams: inflation progress slower, rates must stay higher", "-", "Reuters", "High", "Bearish"],
  ].map(([time, headline, symbol, source, impact, sentiment], index) => ({ id: `fallback-news-${index}`, time, headline, symbol, source, impact, sentiment }));
  const real = (news || []).map((item, index) => ({
    id: item.id || `news-${index}`,
    time: item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : item.time || "Market",
    headline: item.headline || item.summary || "Market headline",
    symbol: item.relatedTicker || item.symbol || selectedSymbol,
    source: item.source || "Market News",
    impact: item.impact || (index % 3 === 0 ? "High" : "Medium"),
    sentiment: item.sentiment || (index % 5 === 0 ? "Bearish" : "Bullish"),
    url: item.url,
  }));
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
}) {
  const stocks = buildStocks(liveStocks, scannerStocks, selectedStockData);
  const selected = stocks.find((row) => row.symbol === selectedStock) || stocks[0];
  const headlines = makeNews(news, selectedStock);
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
      <ActionButton theme={theme}>Add Alert</ActionButton>
      <ActionButton theme={theme} good onClick={() => addSymbolToWatchlist?.(selected.symbol)}>
        Trade
      </ActionButton>
    </div>
  );

  function scannerTable(rows = stocks.slice(0, 8)) {
    return (
      <PremiumTable
        theme={theme}
        columns={[
          { key: "symbol", label: "Symbol", width: "1.5fr", mono: true, strong: true, render: (row) => <><Star size={14} color={theme.muted} style={{ verticalAlign: "-2px", marginRight: 10 }} />{row.symbol}<span style={{ display: "block", color: theme.muted, fontFamily: terminalSansFont, fontSize: 10, fontWeight: 500 }}>{row.name}</span></> },
          { key: "price", label: "Price", width: "90px", align: "right", mono: true, render: (row) => num(row.price).toFixed(2) },
          { key: "change", label: "Chg%", width: "90px", align: "right", mono: true, color: (row) => toneColor(theme, moveOf(row)), render: (row) => pct(moveOf(row)) },
          { key: "gap", label: "Gap%", width: "90px", align: "right", mono: true, color: () => theme.green, render: (_, i) => pct(2.41 - i * 0.17) },
          { key: "rvol", label: "RVOL", width: "70px", align: "right", mono: true },
          { key: "volume", label: "Volume", width: "95px", align: "right", mono: true },
          { key: "float", label: "Float", width: "90px", align: "right", mono: true },
          { key: "setup", label: "Catalyst", width: "130px" },
          { key: "score", label: "Score", width: "70px", align: "center", render: (row) => <StatusPill theme={theme} tone={row.score >= 70 ? "good" : "warn"}>{row.score}</StatusPill> },
          { key: "risk", label: "Risk", width: "70px", align: "right", color: (row) => row.risk === "Low" ? theme.green : theme.amber },
        ]}
        rows={rows}
        selectedKey={selected.symbol}
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
                <SectionTitle theme={theme} title="Watchlist" subtitle="Track symbols, monitor moves, and organize trade ideas." action={<ActionButton theme={theme}><Edit3 size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Edit</ActionButton>} />
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
    const selectedStory = headlines.find((item) => item.symbol === selected.symbol) || headlines[0];
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
              <PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "90px", mono: true }, { key: "headline", label: "Headline", width: "2fr", strong: true }, { key: "symbol", label: "Symbol", width: "80px", mono: true }, { key: "source", label: "Source", width: "120px" }, { key: "impact", label: "Impact", width: "90px", render: (row) => <StatusPill theme={theme} tone={row.impact === "High" ? "bad" : "warn"}>{row.impact}</StatusPill> }, { key: "sentiment", label: "Sentiment", width: "100px", color: (row) => row.sentiment === "Bearish" ? theme.red : theme.green }]} rows={headlines} selectedKey={selectedStory.id} keyField="id" />
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}><ActionButton theme={theme} active>Open Chart</ActionButton><ActionButton theme={theme}>Add Alert</ActionButton><ActionButton theme={theme} good>Save Story</ActionButton></div>
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
              <div style={{ padding: 16, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}><SectionTitle theme={theme} title="Alerts" subtitle="Manage price, volume, technical, and risk alerts." action={<ActionButton theme={theme} active>Create Alert <Plus size={14} style={{ verticalAlign: "-2px", marginLeft: 6 }} /></ActionButton>} /><PremiumTabs theme={theme} tabs={["Active Alerts", "Triggered", "Create Alert", "Watchlist Alerts", "Risk Alerts"]} active="Active Alerts" /><div style={{ marginTop: 12 }}><FilterBar theme={theme} search="Search alerts..." items={["All Categories", "All Priorities", "All Channels"]} /></div></div>
              <PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true, render: (row) => <><Star size={14} color={theme.amber} fill={theme.amber} style={{ verticalAlign: "-2px", marginRight: 10 }} />{row.symbol}</> }, { key: "type", label: "Alert Type", width: "130px" }, { key: "condition", label: "Condition", width: "1.4fr" }, { key: "last", label: "Last Price", width: "100px", align: "right", mono: true, render: (row) => num(row.last).toFixed(2) }, { key: "target", label: "Target", width: "90px", align: "right", mono: true }, { key: "status", label: "Status", width: "100px", render: (row) => <StatusPill theme={theme} tone={row.status === "Triggered" ? "bad" : row.status === "Snoozed" ? "warn" : "good"}>{row.status}</StatusPill> }, { key: "created", label: "Created", width: "150px" }, { key: "next", label: "Last Trigger / Next", width: "150px" }]} rows={alertRows} selectedKey={selected.symbol} />
            </PremiumCard>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 390px", gap: 10 }}>{bottomDock}{quickOrder}</div>
          </div>
          {selectedRail(<><PremiumCard theme={theme} title="Alert Logic / AI Insight"><div style={{ padding: 14, lineHeight: 1.6 }}>{selected.symbol} is approaching a key psychological resistance level with supportive momentum and above-average volume.</div></PremiumCard><PremiumCard theme={theme} title="Recent Alert Activity"><div style={{ padding: 14, display: "grid", gap: 12 }}>{alertRows.slice(0, 3).map((row) => <div key={row.symbol} style={{ display: "flex", justifyContent: "space-between" }}><span>{row.symbol} {row.type}</span><span style={{ color: theme.red }}>{row.status}</span></div>)}</div></PremiumCard></>)}
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
              <PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "90px", mono: true }, { key: "symbol", label: "Symbol", width: "90px", mono: true, strong: true }, { key: "side", label: "Side", width: "70px", color: (row) => row.side === "BUY" ? theme.green : theme.red, strong: true }, { key: "type", label: "Type", width: "90px" }, { key: "qty", label: "Qty", width: "70px", align: "right", mono: true }, { key: "price", label: "Price", width: "100px", align: "right", mono: true }, { key: "status", label: "Status", width: "140px", render: (row) => <StatusPill theme={theme} tone={row.status === "REJECTED" ? "bad" : row.status.includes("WORK") ? "neutral" : row.status.includes("PART") ? "warn" : "good"}>{row.status}</StatusPill> }, { key: "filled", label: "Filled", width: "80px", align: "right", mono: true }, { key: "remaining", label: "Remaining", width: "100px", align: "right", mono: true }, { key: "tif", label: "TIF", width: "70px" }, { key: "id", label: "Order ID", width: "110px", mono: true }]} rows={orderRows} />
            </PremiumCard>
            <PremiumCard theme={theme} title="Order Activity"><PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "100px" }, { key: "event", label: "Event", width: "1fr" }, { key: "status", label: "Status", width: "140px", color: () => theme.green }]} rows={orderRows.slice(0, 5).map((row) => ({ time: row.time, event: `${row.symbol} ${row.side} ${row.qty} @ ${row.price}`, status: row.status }))} /></PremiumCard>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme} title="Place New Order"><div style={{ padding: 16 }}>{quickOrder.props.children}</div></PremiumCard>
            <PremiumCard theme={theme} title="Order Summary"><div style={{ padding: 14, display: "grid", gap: 10 }}>{[["Order Value", "$29,810.00"], ["Buying Power Impact", "$29,810.00"], ["Commission (Est.)", "$1.00"], ["Total (Est.)", "$29,811.00"]].map(([a, b]) => <div key={a} style={{ display: "flex", justifyContent: "space-between" }}><span>{a}</span><b>{b}</b></div>)}</div></PremiumCard>
            <PremiumCard theme={theme} title="Quick Actions"><div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}><ActionButton theme={theme} danger><X size={14} /><br />Cancel All</ActionButton><ActionButton theme={theme}><Lock size={14} /><br />Close All</ActionButton><ActionButton theme={theme}><Shield size={14} /><br />Flatten Day</ActionButton></div></PremiumCard>
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
              <PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true }, { key: "side", label: "Side", width: "80px", color: () => theme.green }, { key: "qty", label: "Qty", width: "70px", align: "right" }, { key: "avg", label: "Avg Price", width: "100px", align: "right", mono: true, render: (row) => row.avg.toFixed(2) }, { key: "last", label: "Last Price", width: "100px", align: "right", mono: true, render: (row) => row.last.toFixed(2) }, { key: "marketValue", label: "Market Value", width: "120px", align: "right", mono: true, render: (row) => money(row.marketValue) }, { key: "dayPnl", label: "Day P&L", width: "100px", align: "right", mono: true, color: (row) => row.dayPnl >= 0 ? theme.green : theme.red, render: (row) => money(row.dayPnl) }, { key: "totalPnl", label: "Total P&L", width: "100px", align: "right", mono: true, color: (row) => row.totalPnl >= 0 ? theme.green : theme.red, render: (row) => money(row.totalPnl) }, { key: "exposure", label: "Exposure", width: "90px", align: "right" }, { key: "risk", label: "Risk", width: "70px", align: "center", render: (row) => <StatusPill theme={theme} tone="warn">{row.risk}</StatusPill> }]} rows={enriched} selectedKey={selected.symbol} />
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
              <PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true }, { key: "side", label: "Side", width: "80px", color: () => theme.green }, { key: "qty", label: "Qty", width: "70px" }, { key: "last", label: "Last Price", width: "100px", align: "right", mono: true, render: (row) => row.last.toFixed(2) }, { key: "market", label: "Market Value", width: "120px", align: "right", mono: true, render: (row) => money(row.last * row.qty) }, { key: "day", label: "Day P&L", width: "100px", align: "right", color: () => theme.green, render: (row) => money((row.last - row.avg) * row.qty) }, { key: "exposure", label: "Exposure %", width: "90px", align: "right" }, { key: "beta", label: "Beta", width: "70px", render: (_, i) => (1.23 + i * 0.08).toFixed(2) }, { key: "var", label: "VaR (1D)", width: "100px", align: "right", color: () => theme.red, render: (_, i) => `-$${(742 + i * 83).toFixed(2)}` }, { key: "risk", label: "Risk Score", width: "90px", render: (row) => <StatusPill theme={theme} tone={row.risk > 70 ? "good" : "warn"}>{row.risk}</StatusPill> }]} rows={positionRows} />
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
            <PremiumCard theme={theme} title="Export Reports"><div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><ActionButton theme={theme}>PDF <Download size={14} /></ActionButton><ActionButton theme={theme}>CSV <Download size={14} /></ActionButton></div></PremiumCard>
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
            <PremiumCard theme={theme} title="Layout Presets"><div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>{["Trader", "Research", "Minimal", "Risk"].map((x, i) => <button key={x} type="button" style={{ minHeight: 72, border: `1px solid ${i === 0 ? theme.blue : theme.borderSoft}`, borderRadius: 7, background: theme.panel2, color: theme.text, textAlign: "left", padding: 12 }}>{x}<div style={{ color: theme.muted, fontSize: 11, marginTop: 5 }}>Chart, Watchlist, Orders</div></button>)}</div></PremiumCard>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {group("Broker & Data Connections", [["Broker status", <StatusPill key="b" theme={theme} tone={brokerConnected ? "good" : "warn"}>{brokerConnected ? "Connected" : "Review-only"}</StatusPill>], ["Market data status", <StatusPill key="d" theme={theme} tone="good">Live</StatusPill>], ["Actions", <span key="a"><ActionButton theme={theme} active>Manage Connection</ActionButton> <ActionButton theme={theme}><RefreshCw size={14} /></ActionButton></span>]])}
            {group("Notification Settings", [["Price alerts", settingToggle(true)], ["Order fills", settingToggle(true)], ["News catalyst alerts", settingToggle(true)], ["Daily summary email", settingToggle(true)], ["Sound alerts", settingToggle(true)]])}
            {group("Security", [["Two-factor authentication", <StatusPill key="s" theme={theme} tone="good">Enabled</StatusPill>], ["Login session timeout", settingSelect("30 minutes")], ["Device management", <ActionButton key="m" theme={theme}>Manage Devices</ActionButton>], ["Password", <ActionButton key="p" theme={theme}>Change Password</ActionButton>]])}
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

  return (
    <div style={page}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gridTemplateRows: "minmax(0, 1fr) 250px 116px", gap: 10, height: "100%" }}>
        <PremiumCard theme={theme} style={{ gridColumn: "1 / 2", gridRow: "1 / 2" }}>{renderChartGrid?.({ layoutMode: "1" })}</PremiumCard>
        <div style={{ gridColumn: "2 / 3", gridRow: "1 / 4", display: "grid", gap: 10, minHeight: 0 }}>
          <PremiumCard theme={theme} title="My Watchlist" action={<Plus size={16} color={theme.muted} />}>
          <PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true }, { key: "price", label: "Last", width: "90px", align: "right", mono: true, render: (row) => num(row.price).toFixed(2) }, { key: "change", label: "Chg%", width: "80px", align: "right", mono: true, color: (row) => toneColor(theme, moveOf(row)), render: (row) => pct(moveOf(row)) }, { key: "volume", label: "Vol", width: "80px", align: "right", mono: true }]} rows={stocks.slice(0, 7)} selectedKey={selected.symbol} onSelect={(row) => selectMainSymbol?.(row.symbol)} />
          </PremiumCard>
          {selectedRail()}
          <PremiumCard theme={theme} title="Latest News"><div style={{ padding: 14, display: "grid", gap: 12 }}>{headlines.slice(0, 3).map((item) => <div key={item.id}><div style={{ color: theme.muted, fontSize: 11 }}>{item.source}</div><div style={{ color: theme.text, fontSize: 12, lineHeight: 1.4 }}>{item.headline}</div></div>)}</div></PremiumCard>
          {quickOrder}
        </div>
        <PremiumCard theme={theme} style={{ gridColumn: "1 / 2", gridRow: "2 / 3" }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${theme.borderSoft || theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <PremiumTabs theme={theme} tabs={["Scanner", "Gainers", "Losers", "Active", "Momentum", "High RVOL", "News", "Earnings"]} active="Gainers" />
            <ActionButton theme={theme}>Save Scan</ActionButton>
          </div>
          {scannerTable(stocks.slice(0, 5))}
        </PremiumCard>
        <div style={{ gridColumn: "1 / 2", gridRow: "3 / 4", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 240px", gap: 10 }}>
          {bottomDock}
          <PremiumCard theme={theme} title="Risk Overview"><div style={{ padding: 12, display: "grid", gap: 10 }}>{["Max Risk/Trade 1.00%", "Daily Loss Limit 3.00%", "Margin Usage 34.6%", "Buying Power $24,850.45"].map((x) => <div key={x} style={{ color: theme.text, fontSize: 12 }}>{x}</div>)}</div></PremiumCard>
        </div>
      </div>
    </div>
  );
}
