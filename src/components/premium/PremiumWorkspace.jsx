import { useRef, useState } from "react";
import {
  ChevronRight,
  Download,
  Edit3,
  Lock,
  MoreVertical,
  Plus,
  Search,
  Shield,
  Star,
  X,
} from "lucide-react";
import AdminMonitoringPanel from "../AdminMonitoringPanel";
import { terminalMonoFont, terminalSansFont } from "../../config/terminalConfig";
import { useDashboardData } from "../../hooks/useDashboardData";
import { CHART_INDICATOR_OPTIONS } from "../../indicators/chartIndicators";
import DashboardMarketIntelligence from "./DashboardMarketIntelligence";
import {
  formatCompactNumber,
  formatMultiple,
  formatPercent,
  formatPrice,
} from "../../utils/dashboardFormatters";
import {
  createNormalizedNewsFallback,
  normalizeNewsRow,
  normalizeScannerRow,
  rankScannerRows,
} from "../../utils/scannerNewsAdapters";
import { loadSetting, saveSetting } from "../../utils/storage";
import {
  DEFAULT_ENTITLEMENTS,
  PLAN_LABELS,
  WORKSPACE_FEATURES,
  canUseWorkspace,
  getFeatureMinPlan,
  normalizePlan,
} from "../../services/entitlements";

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

function hasNumericValue(value) {
  if (value === null || typeof value === "undefined" || value === "") return false;
  return Number.isFinite(Number(String(value).replace(/[$,%+,x]/g, "").trim()));
}

function nullableMoveOf(row) {
  const value = row?.changePercent ?? row?.change ?? row?.changesPercentage ?? row?.percentChange;
  return hasNumericValue(value) ? num(value) : null;
}

function toneColor(theme, value) {
  return num(value) >= 0 ? theme.green : theme.red;
}

function formatDetailValue(label, value) {
  if (value === null || typeof value === "undefined" || value === "") return "Unavailable";
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

function SeriesSparkline({ theme, values = [], height = 240 }) {
  if (!values.length) return <div style={{ height, display: "grid", placeItems: "center", color: theme.muted }}>No recorded series</div>;
  const points = [0, ...values.reduce((series, value) => [...series, series[series.length - 1] + Number(value || 0)], [0]).slice(1)];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 800;
  const d = points.map((point, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * width;
    const y = height - 12 - ((point - min) / range) * (height - 24);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const positive = points[points.length - 1] >= 0;
  const color = positive ? theme.green : theme.red;
  return <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }} aria-label="Recorded cumulative performance"><path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" /><path d={`${d} L${width} ${height} L0 ${height} Z`} fill={color} opacity="0.1" /></svg>;
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

function LockedWorkspace({ theme, activeWorkspace, entitlements, status }) {
  const feature = WORKSPACE_FEATURES[activeWorkspace] || activeWorkspace;
  const requiredPlan = getFeatureMinPlan(feature);
  const currentPlan = normalizePlan(entitlements?.plan);
  const title = PLAN_LABELS[requiredPlan] || "Premium";

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100%",
        padding: 20,
      }}
    >
      <PremiumCard
        theme={theme}
        style={{
          width: "min(560px, 100%)",
          background: `linear-gradient(180deg, ${theme.panel}, ${theme.bg})`,
        }}
      >
        <div style={{ padding: 22, display: "grid", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
                background: `${theme.blue}20`,
                border: `1px solid ${theme.blue}55`,
                color: theme.blue,
              }}
            >
              <Lock size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, color: theme.text, fontSize: 18 }}>Upgrade required</h2>
              <div style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>
                This workspace is part of the {title} plan.
              </div>
            </div>
          </div>
          <div style={{ color: theme.muted, lineHeight: 1.55, fontSize: 13 }}>
            Your current plan is <b style={{ color: theme.text }}>{PLAN_LABELS[currentPlan] || "Free"}</b>.
            Core market intelligence, scanner, charts, watchlist, news, alerts, and settings remain available.
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            {[
              ["Current plan", PLAN_LABELS[currentPlan] || "Free"],
              ["Required plan", title],
              ["Feature", feature],
              ["Access check", status === "loading" ? "Checking" : "Locked"],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: `1px solid ${theme.borderSoft || theme.border}`,
                  borderRadius: 7,
                  background: theme.panel2,
                  padding: "10px 12px",
                }}
              >
                <div style={{ color: theme.muted, fontSize: 10, textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
                <div style={{ color: theme.text, fontFamily: terminalMonoFont, fontSize: 12 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <ActionButton theme={theme} active disabled title="Stripe checkout will be connected in the payments phase">
              View Pro
            </ActionButton>
            <ActionButton theme={theme} disabled title="Stripe checkout will be connected in the payments phase">
              View Premium
            </ActionButton>
          </div>
          <div style={{ color: theme.muted, fontSize: 12 }}>
            Upgrade checkout is not connected yet. Access is controlled by Supabase entitlements or admin app metadata. No broker execution is enabled by this lock.
          </div>
        </div>
      </PremiumCard>
    </div>
  );
}

function PremiumTabs({ theme, tabs, active, onChange }) {
  const interactive = typeof onChange === "function";
  if (!interactive) {
    const activeTab = tabs.find((tab) => {
      const id = typeof tab === "string" ? tab : tab.id;
      const label = typeof tab === "string" ? tab : tab.label;
      return active === id || active === label;
    });
    const label = typeof activeTab === "string" ? activeTab : activeTab?.label || active;
    return (
      <div aria-label="Current view" style={{ display: "flex", alignItems: "center", minHeight: 30 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 30,
            padding: "0 13px",
            borderRadius: 6,
            border: "1px solid rgba(45,140,255,0.75)",
            background: "linear-gradient(180deg, #176fd7, #0c4f9e)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {label}
        </span>
      </div>
    );
  }
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
              opacity: 1,
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

function FilterBar({ theme, items = [], search = "Search...", value = "", onSearchChange }) {
  const searchable = typeof onSearchChange === "function";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {searchable && (
        <label style={{ position: "relative", flex: "1 1 220px", maxWidth: 300 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: 10, color: theme.muted }} />
          <input
            value={value}
            onChange={(event) => onSearchChange(event.target.value)}
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
      )}
      {items.map((item) => (
        <span
          key={item}
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 32,
            padding: "0 10px",
            border: `1px solid ${theme.borderSoft || theme.border}`,
            borderRadius: 6,
            color: theme.muted,
            background: "rgba(255,255,255,0.018)",
            fontSize: 11,
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function PremiumTable({ theme, columns, rows = [], selectedKey, onSelect, keyField = "symbol", style = {}, rowMinHeight = 42, headerMinHeight = 36, cellPadding = "0 14px", columnGap = 12, emptyMessage = "No records available" }) {
  return (
    <div role="table" aria-rowcount={rows.length + 1} aria-colcount={columns.length} style={{ minWidth: 0, overflow: "auto", ...style }}>
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
          <div key={column.key} role="columnheader" style={{ textAlign: column.align || "left" }}>
            {column.label}
          </div>
        ))}
      </div>
      {rows.length === 0 && (
        <div role="status" style={{ minHeight: Math.max(rowMinHeight * 2, 72), display: "grid", placeItems: "center", padding: 16, color: theme.muted, fontSize: 12, textAlign: "center" }}>
          {emptyMessage}
        </div>
      )}
      {rows.map((row, index) => {
        const rowValue = row[keyField] || row.id || index;
        const rowKey = `${rowValue}-${index}`;
        const selected = rowValue === selectedKey;
        return (
          <div
            key={rowKey}
            role="row"
            tabIndex={onSelect ? 0 : undefined}
            data-premium-row="true"
            data-row-key={String(rowValue)}
            data-symbol={row.symbol || undefined}
            data-url={row.url || undefined}
            aria-selected={selected}
            aria-label={`Select ${row.symbol || row.headline || rowValue}`}
            onClick={() => onSelect?.(row)}
            onKeyDown={(event) => {
              if (onSelect && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                onSelect(row);
              }
            }}
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
                role="cell"
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
          </div>
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

function EmptyWorkspace({ theme, title, detail, action }) {
  return (
    <PremiumCard theme={theme}>
      <div role="status" style={{ minHeight: 260, display: "grid", placeItems: "center", padding: 32, textAlign: "center" }}>
        <div style={{ maxWidth: 520 }}>
          <h2 style={{ margin: 0, color: theme.text, fontSize: 18 }}>{title}</h2>
          <p style={{ margin: "10px 0 18px", color: theme.muted, lineHeight: 1.55 }}>{detail}</p>
          {action}
        </div>
      </div>
    </PremiumCard>
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
    ["Day High", selected.dayHigh ?? selected.high],
    ["Day Low", selected.dayLow ?? selected.low],
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
            <span style={{ color: theme.text, fontSize: compact ? 24 : 30, fontWeight: 900, fontFamily: terminalMonoFont }}>{hasNumericValue(selected.price) ? num(selected.price).toFixed(2) : "Unavailable"}</span>
            <span style={{ color: nullableMoveOf(selected) === null ? theme.muted : toneColor(theme, nullableMoveOf(selected)), fontSize: compact ? 12 : 16, fontWeight: 900, fontFamily: terminalMonoFont }}>
              {nullableMoveOf(selected) === null ? "Unavailable" : pct(nullableMoveOf(selected))}
            </span>
          </div>
          <div style={{ color: selected.dataMode === "provider" ? theme.green : theme.muted, fontSize: compact ? 10 : 12, fontWeight: 850, marginTop: compact ? 4 : 6 }}>
            {selected.dataMode === "provider" ? "Provider data" : selected.dataMode === "cached" ? "Cached data" : selected.dataMode === "fallback" || selected.dataMode === "degraded" ? "Fallback context" : "Market data unavailable"}
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
                  {formatDetailValue(label, value)}
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

function buildStocks(liveStocks, scannerStocks, selectedStockData, selectedStock) {
  const bySymbol = new Map();
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
      name: stock.name || stock.company || bySymbol.get(symbol)?.name || symbol,
      price: num(stock.price, bySymbol.get(symbol)?.price || 0),
      change: stock.changePercent ?? stock.change ?? bySymbol.get(symbol)?.change ?? 0,
      volume: stock.volume ?? bySymbol.get(symbol)?.volume ?? null,
      rvol: stock.rvol ?? stock.relativeVolume ?? bySymbol.get(symbol)?.rvol ?? null,
      float: stock.float ?? bySymbol.get(symbol)?.float ?? null,
      sector: stock.sector || bySymbol.get(symbol)?.sector || "Not reported",
      setup: stock.catalyst || stock.setup || bySymbol.get(symbol)?.setup || "No confirmed catalyst",
      score: stock.scannerScore ?? stock.score ?? stock.score10 ?? bySymbol.get(symbol)?.score ?? null,
      risk: stock.risk || stock.riskLabel || bySymbol.get(symbol)?.risk || "Context",
      gapPercent: stock.gapPercent,
      catalyst: stock.catalyst,
      whyMoving: stock.whyMoving,
      dataMode: stock.isSynthetic
        ? "synthetic"
        : stock.isFallback || stock.fallback
          ? "fallback"
          : stock.isCached
            ? "cached"
            : stock.degraded
              ? "degraded"
              : "provider",
    });
  });
  const requestedSymbol = String(selectedStock || selectedStockData?.symbol || "AAPL").toUpperCase();
  if (!bySymbol.has(requestedSymbol)) {
    const rawPrice = selectedStockData?.price ?? selectedStockData?.last ?? selectedStockData?.currentPrice;
    const rawChange = selectedStockData?.changePercent ?? selectedStockData?.change ?? selectedStockData?.percentChange;
    bySymbol.set(requestedSymbol, {
      ...(selectedStockData || {}),
      symbol: requestedSymbol,
      name: selectedStockData?.name || selectedStockData?.company || requestedSymbol,
      price: hasNumericValue(rawPrice) ? num(rawPrice) : null,
      change: hasNumericValue(rawChange) ? num(rawChange) : null,
      changePercent: hasNumericValue(rawChange) ? num(rawChange) : null,
      volume: selectedStockData?.volume ?? null,
      rvol: selectedStockData?.rvol ?? selectedStockData?.relativeVolume ?? null,
      float: selectedStockData?.float ?? selectedStockData?.floatShares ?? null,
      sector: selectedStockData?.sector || "Not reported",
      setup: selectedStockData?.catalyst || "Data unavailable",
      score: selectedStockData?.score ?? null,
      risk: selectedStockData?.risk || "Context",
      dataMode: selectedStockData?.dataMode || (selectedStockData?.fallback
        ? "fallback"
        : selectedStockData?.cached
          ? "cached"
          : selectedStockData?.degraded
            ? "degraded"
            : selectedStockData
              ? "provider"
              : "unavailable"),
    });
  }
  return Array.from(bySymbol.values()).slice(0, 16);
}

function makeNews(news, selectedSymbol) {
  const real = (news || []).map((item, index) => ({
    ...normalizeNewsRow(item, index, selectedSymbol),
  })).filter((item) => item?.headline);
  const fallback = createNormalizedNewsFallback(selectedSymbol);

  return (real.length ? real : fallback).slice(0, 12);
}

function makeJournalTrades(entries) {
  const real = (entries || []).map((entry) => {
    const pnl = num(entry.pnl ?? entry.netPnl ?? entry.resultAmount, 0);
    return {
      id: entry.id,
      date: entry.createdAt ? new Date(entry.createdAt).toLocaleString() : entry.date || "Not recorded",
      symbol: entry.symbol || "Unspecified",
      setup: entry.setup || entry.tags || "Review",
      side: entry.bias || entry.side || "Long",
      qty: entry.quantity || entry.qty || 0,
      entry: entry.entryPrice || entry.entry || "Not recorded",
      exit: entry.exitPrice || entry.exit || "Not recorded",
      pnl,
      pnlPct: entry.pnlPct || "Not recorded",
      r: entry.rMultiple || entry.r || "Not recorded",
      hold: entry.holdTime || "Not recorded",
      outcome: entry.result || entry.outcome || "Review",
      tag: entry.tags || entry.setup || "Review",
      notes: entry.notes || entry.review || "No notes",
    };
  });
  return real.slice(0, 12);
}

function makeReplayTrades(replayTrades, selectedSymbol) {
  const real = (replayTrades || []).map((trade, index) => ({
    time: trade.time || trade.timestamp?.slice(11, 19) || `Step ${index + 1}`,
    symbol: trade.symbol || selectedSymbol,
    side: trade.type || trade.side || "Buy",
    qty: trade.quantity || trade.qty || 0,
    price: trade.price || trade.fillPrice || "Pending",
    pnl: trade.pnl ? money(trade.pnl) : "Pending",
  }));
  return real.slice(0, 10);
}

export default function PremiumWorkspace({
  activeWorkspace,
  setActiveWorkspace,
  viewportWidth = 1440,
  viewportHeight = 900,
  theme,
  renderChartGrid,
  selectedStock,
  selectedStockData,
  liveStocks,
  scannerStocks,
  scannerGroups = {},
  scannerMeta = {},
  news,
  newsMeta = {},
  marketIndexes = [],
  brokerApiUrl = "",
  alerts,
  createPriceAlert,
  toggleAlert,
  updateAlert,
  removeAlert,
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
  removeWatchlistSymbol,
  scannerTab,
  setScannerTab,
  scannerPresets = [],
  setScannerPresets,
  activeScannerPreset = "default",
  setActiveScannerPreset,
  timeframe,
  setTimeframe,
  layoutMode = "1",
  setLayoutMode,
  gridMode = "2",
  setGridMode,
  chartIndicators,
  setChartIndicators,
  themeMode,
  setThemeMode,
  timeZone = "America/Vancouver",
  setTimeZone,
  premiumPreferences = {},
  setPremiumPreferences,
  user,
  saveWorkspaceToCloud,
  loadWorkspaceFromCloud,
  requestPasswordReset,
  resetWorkspace,
  brokerConnected,
  journalEntries,
  replayPlaying,
  replaySpeed,
  replayStats,
  replayTrades,
  replayEquity = [],
  replayIndex = 0,
  replayDataLength = 0,
  replayBookmarks = [],
  setReplayBookmarks,
  replayNotes = "",
  setReplayNotes,
  setReplayPlaying,
  setReplaySpeed,
  setReplayIndex,
  stepReplay,
  resetReplay,
  takeScreenshot,
  toggleFullscreen,
  openReplayJournal,
  journalDraft,
  setJournalDraft,
  addJournalEntry,
  removeJournalEntry,
  exportJournalCsv,
  exportTradeSummaryCsv,
  entitlements = DEFAULT_ENTITLEMENTS,
  entitlementsStatus = "idle",
  onOpenIssueReport,
}) {
  const isNarrowWorkspace = viewportWidth <= 900;
  const stocks = buildStocks(liveStocks, scannerStocks, selectedStockData, selectedStock);
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
  const orderRows = (orders || []).map((order, index) => ({
    time: order.time || order.createdAt?.slice(11, 19) || "Pending",
    symbol: order.symbol || selectedStock,
    side: order.side || order.orderSide || "BUY",
    type: order.type || order.orderType || "LIMIT",
    qty: order.qty || order.quantity || quantity,
    price: order.price || order.limitPrice || num(selected.price).toFixed(2),
    status: order.status || "REVIEW",
    filled: order.filled || 0,
    remaining: order.remaining || 0,
    tif: order.tif || "DAY",
    id: order.id || `LOCAL-${index + 1}`,
  }));
  const positionRows = Object.keys(positions || {}).length
    ? Object.entries(positions).map(([symbol, pos]) => ({
        symbol,
        side: Number(pos.quantity || 0) >= 0 ? "LONG" : "SHORT",
        qty: Math.abs(Number(pos.quantity || 0)),
        avg: Number(pos.average || pos.avgPrice || 0),
        last: num(allSymbols?.find((row) => row.symbol === symbol)?.price, Number(pos.average || 0)),
        exposure: "Not calculated",
        risk: pos.riskScore || "Context",
        beta: pos.beta ?? null,
        var1d: pos.var1d ?? null,
        dayPnl: Number(pos.dayPnl ?? pos.unrealizedPnl ?? 0),
        totalPnl: Number(pos.totalPnl ?? pos.unrealizedPnl ?? 0),
      }))
    : [];
  const alertRows = alerts?.length
    ? alerts.map((alert) => ({
        id: alert.id,
        symbol: alert.symbol || selectedStock,
        type: alert.direction ? `Price ${alert.direction}` : "Price Above",
        condition: alert.trigger ? `Price ${alert.direction || "above"} ${money(alert.trigger)}` : "No trigger configured",
        last: num(allSymbols?.find((row) => row.symbol === alert.symbol)?.price, 0),
        target: alert.trigger || "Not set",
        status: alert.triggeredAt ? "Triggered" : alert.active === false ? "Paused" : "Active",
        created: alert.createdAt || "Not recorded",
        next: alert.triggeredAt || "Not triggered",
        history: Array.isArray(alert.history) ? alert.history : [],
      }))
    : [];
  const journalRows = makeJournalTrades(journalEntries);
  const replayRows = makeReplayTrades(replayTrades, selectedStock);
  const journalNet = journalRows.reduce((total, row) => total + num(row.pnl), 0);
  const replayNet = num(replayStats?.netPnL, 0);
  const replayWinRate = replayStats?.winRate || "0.00";
  const [selectedNewsId, setSelectedNewsId] = useState(null);
  const [selectedAlertSymbol, setSelectedAlertSymbol] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedPositionSymbol, setSelectedPositionSymbol] = useState(null);
  const [alertDraftPrice, setAlertDraftPrice] = useState("");
  const [alertDraftDirection, setAlertDraftDirection] = useState("above");
  const [alertView, setAlertView] = useState("Active Alerts");
  const defaultLandingTab = premiumPreferences.defaultLandingTab || activeWorkspace || "dashboard";
  const compactMode = Boolean(premiumPreferences.compactMode);
  const scannerAutoRefresh = premiumPreferences.scannerAutoRefresh !== false;
  const relativeVolumeThreshold = String(premiumPreferences.relativeVolumeThreshold ?? "1.50");
  const riskWarnings = premiumPreferences.riskWarnings !== false;
  const notificationPreferences = {
    priceAlerts: true,
    newsCatalysts: false,
    soundAlerts: false,
    ...(premiumPreferences.notificationPreferences || {}),
  };
  const updatePremiumPreference = (key, value) => {
    setPremiumPreferences?.((current) => ({ ...current, [key]: value }));
  };
  const updateNotificationPreference = (key, value) => {
    setPremiumPreferences?.((current) => ({
      ...current,
      notificationPreferences: {
        ...(current.notificationPreferences || {}),
        [key]: value,
      },
    }));
  };
  const scannerFilters = {
    search: "",
    minPrice: "",
    maxPrice: "",
    minVolume: "",
    minRvol: "",
    minMarketCap: "",
    maxFloat: "",
    risk: "all",
    sector: "all",
    country: "all",
    ...loadSetting("sb_scanner_filters", {}),
    ...(premiumPreferences.scannerFilters || {}),
  };
  const [replayIndicatorMenuOpen, setReplayIndicatorMenuOpen] = useState(false);
  const [replaySettingsOpen, setReplaySettingsOpen] = useState(false);
  const [replayActionStatus, setReplayActionStatus] = useState("");
  const [settingsTab, setSettingsTab] = useState("General");
  const [passwordResetStatus, setPasswordResetStatus] = useState("idle");
  const replayChartRef = useRef(null);

  const captureReplayScreenshot = () => {
    const canvas = replayChartRef.current?.querySelector("canvas");
    if (!canvas) {
      setReplayActionStatus("Chart image is not ready yet.");
      takeScreenshot?.();
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${selectedStock}-replay-chart.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setReplayActionStatus("Replay chart image saved.");
    }, "image/png");
  };

  const enterReplayFullscreen = async () => {
    const replayChart = replayChartRef.current;
    if (!replayChart?.requestFullscreen) {
      toggleFullscreen?.();
      return;
    }

    await replayChart.requestFullscreen();
    setReplayActionStatus("Replay chart opened fullscreen.");
  };

  const jumpReplay = (target) => {
    if (!replayDataLength || !setReplayIndex) return;
    if (target === "open") {
      setReplayIndex(Math.min(80, replayDataLength - 1));
      return;
    }
    if (target === "close") {
      setReplayIndex(replayDataLength - 1);
      return;
    }
    const candleMinutes = {
      "1m": 1,
      "5m": 5,
      "15m": 15,
      "1H": 60,
      "1D": 390,
    }[timeframe] || 5;
    const candleSteps = Math.max(1, Math.round(target / candleMinutes));
    setReplayIndex((current) => Math.min(current + candleSteps, replayDataLength - 1));
  };

  const addReplayBookmark = () => {
    const bookmark = {
      id: `${selectedStock}-${replayIndex}-${Date.now()}`,
      symbol: selectedStock,
      index: replayIndex,
      label: `${selectedStock} step ${replayIndex + 1}`,
    };
    setReplayBookmarks((current) => {
      const next = [bookmark, ...current.filter((item) => item.symbol !== bookmark.symbol || item.index !== bookmark.index)].slice(0, 12);
      saveSetting("sb_replay_bookmarks", next);
      return next;
    });
  };

  const removeReplayBookmark = (bookmarkId) => {
    setReplayBookmarks((current) => {
      const next = current.filter((item) => item.id !== bookmarkId);
      saveSetting("sb_replay_bookmarks", next);
      return next;
    });
  };

  const sendPasswordReset = async () => {
    setPasswordResetStatus("sending");
    try {
      const sent = await requestPasswordReset?.();
      setPasswordResetStatus(sent ? "sent" : "failed");
    } catch {
      setPasswordResetStatus("failed");
    }
  };
  const activePresetConfig = scannerPresets.find((preset) => preset.id === activeScannerPreset);
  const scannerMinimumRvol = Number(scannerFilters.minRvol || relativeVolumeThreshold || activePresetConfig?.minRvol || 0);
  const scannerRowsByTab = {
    Gainers: scannerGroups.gainers,
    Losers: scannerGroups.losers,
    Active: scannerGroups.active,
    Momentum: scannerGroups.momentum,
    "High RVOL": scannerGroups.unusualVolume?.length
      ? scannerGroups.unusualVolume
      : scannerGroups.relativeVolume,
    "News Movers": scannerGroups.newsMovers,
    "New Highs": scannerGroups.newHighs,
    "New Lows": scannerGroups.newLows,
    Premarket: scannerGroups.premarket,
  };
  const activeScannerRows = scannerRowsByTab[scannerTab] || scannerGroups.gainers || scannerStocks;
  const scannerUniverseRows = activeScannerRows?.length
    ? buildStocks([], activeScannerRows, selectedStockData, selectedStock)
    : scannerStocks?.length
      ? buildStocks([], scannerStocks, selectedStockData, selectedStock)
      : stocks;
  const scannerDisplayRows = scannerUniverseRows.filter((row) => {
    if (row.dataMode === "unavailable") return false;
    const search = String(scannerFilters.search || "").trim().toUpperCase();
    const price = num(row.price, Number.NaN);
    const volume = num(row.volume, Number.NaN);
    const rvol = num(row.relativeVolume ?? row.rvol, Number.NaN);
    const marketCap = num(row.marketCap, Number.NaN);
    const floatShares = num(row.floatShares ?? row.float, Number.NaN);
    if (search && !String(row.symbol || "").toUpperCase().includes(search) && !String(row.name || "").toUpperCase().includes(search)) return false;
    if (scannerFilters.minPrice && (!Number.isFinite(price) || price < Number(scannerFilters.minPrice))) return false;
    if (scannerFilters.maxPrice && (!Number.isFinite(price) || price > Number(scannerFilters.maxPrice))) return false;
    if (scannerFilters.minVolume && (!Number.isFinite(volume) || volume < Number(scannerFilters.minVolume))) return false;
    if (scannerMinimumRvol && (!Number.isFinite(rvol) || rvol < scannerMinimumRvol)) return false;
    if (scannerFilters.minMarketCap && (!Number.isFinite(marketCap) || marketCap < Number(scannerFilters.minMarketCap))) return false;
    if (scannerFilters.maxFloat && (!Number.isFinite(floatShares) || floatShares > Number(scannerFilters.maxFloat))) return false;
    if (scannerFilters.risk !== "all" && String(row.risk || "").toLowerCase() !== scannerFilters.risk) return false;
    if (scannerFilters.sector !== "all" && String(row.sector || "") !== scannerFilters.sector) return false;
    if (scannerFilters.country !== "all" && String(row.country || "").toUpperCase() !== scannerFilters.country) return false;
    return true;
  });
  const updateScannerFilter = (key, value) => {
    const next = { ...scannerFilters, [key]: value };
    saveSetting("sb_scanner_filters", next);
    updatePremiumPreference("scannerFilters", next);
  };
  const resetScannerFilters = () => {
    const next = {
      search: "",
      minPrice: "",
      maxPrice: "",
      minVolume: "",
      minRvol: "",
      minMarketCap: "",
      maxFloat: "",
      risk: "all",
      sector: "all",
      country: "all",
    };
    updatePremiumPreference("relativeVolumeThreshold", "0");
    saveSetting("sb_scanner_filters", next);
    saveSetting("sb_relative_volume_threshold", "0");
    updatePremiumPreference("scannerFilters", next);
  };
  const selectedStory = headlines.find((item) => item.id === selectedNewsId) || headlines.find((item) => item.symbol === selected.symbol) || headlines[0];
  const selectedAlert = alertRows.find((row) => row.id === selectedAlertSymbol) || alertRows.find((row) => row.symbol === selected.symbol) || alertRows[0];
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
    padding: compactMode ? "8px" : "12px",
    color: theme.text,
    fontFamily: terminalSansFont,
  };
  if (activeWorkspace !== "settings" && !canUseWorkspace(entitlements, activeWorkspace)) {
    return (
      <div style={page}>
        <LockedWorkspace
          theme={theme}
          activeWorkspace={activeWorkspace}
          entitlements={entitlements}
          status={entitlementsStatus}
        />
      </div>
    );
  }

  const mainTwoCol = {
    display: "grid",
    gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "minmax(0, 1fr) 360px",
    gap: 10,
    minHeight: 0,
  };
  const bottomDock = (
    <PremiumCard theme={theme} style={{ height: 142, overflow: "hidden" }}>
      <PremiumTabs theme={theme} tabs={[`Positions (${positionRows.length})`, `Orders (${orderRows.length})`, `Alerts (${alertRows.length})`, "Executions", "Messages"]} active={`Positions (${positionRows.length})`} />
      <PremiumTable
        theme={theme}
        columns={[
          { key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true },
          { key: "side", label: "Side", width: "80px", color: () => theme.green, mono: true },
          { key: "qty", label: "Qty", width: "80px", align: "right", mono: true },
          { key: "avg", label: "Avg Price", width: "110px", align: "right", mono: true, render: (row) => row.avg.toFixed(2) },
          { key: "last", label: "Last Price", width: "110px", align: "right", mono: true, render: (row) => row.last.toFixed(2) },
          { key: "pnl", label: "P&L", width: "110px", align: "right", mono: true, color: (row) => (row.last - row.avg) * row.qty >= 0 ? theme.green : theme.red, render: (row) => money((row.last - row.avg) * row.qty) },
        ]}
        rows={positionRows.slice(0, 1)}
        emptyMessage="No connected account positions"
        style={{ height: "calc(100% - 40px)" }}
        rowMinHeight={32}
        headerMinHeight={30}
        cellPadding="0 12px"
        columnGap={10}
      />
    </PremiumCard>
  );
  const quickOrder = (
    <PremiumCard theme={theme} title="Quick Order" style={{ minWidth: 0, overflow: "hidden" }}>
      <div style={{ padding: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 62px 76px 82px", gap: 7, minWidth: 0 }}>
          {["Symbol", "Shares", "Order Type", "Limit Price"].map((label, index) => (
            <label key={label} style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 10, textTransform: "uppercase", minWidth: 0 }}>
              {label}
              <input
                value={index === 0 ? selectedStock : index === 1 ? quantity : index === 2 ? "LIMIT" : num(selected.price).toFixed(2)}
                onChange={(event) => index === 1 && setQuantity?.(Number(event.target.value) || 1)}
                readOnly={index !== 1}
                style={{ width: "100%", minWidth: 0, boxSizing: "border-box", height: 31, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 5, background: theme.panel2, color: theme.text, padding: "0 7px", fontFamily: terminalMonoFont }}
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
  function scannerTable(rows = stocks.slice(0, 8), selectedKey = selected.symbol, tableProps = {}) {
    return (
      <PremiumTable
        theme={theme}
        columns={[
          { key: "symbol", label: "Symbol", width: "1.5fr", mono: true, strong: true, render: (row) => <><Star size={14} color={theme.muted} style={{ verticalAlign: "-2px", marginRight: 10 }} />{row.symbol}<span style={{ display: "block", color: theme.muted, fontFamily: terminalSansFont, fontSize: 10, fontWeight: 500 }}>{row.name}</span></> },
          { key: "price", label: "Price", width: "90px", align: "right", mono: true, render: (row) => num(row.price).toFixed(2) },
          { key: "change", label: "Chg%", width: "90px", align: "right", mono: true, color: (row) => toneColor(theme, moveOf(row)), render: (row) => pct(moveOf(row)) },
          { key: "gap", label: "Gap%", width: "90px", align: "right", mono: true, color: (row) => hasNumericValue(row.gapPercent) ? toneColor(theme, row.gapPercent) : theme.muted, render: (row) => hasNumericValue(row.gapPercent) ? pct(row.gapPercent) : "Unavailable" },
          { key: "rvol", label: "RVOL", width: "70px", align: "right", mono: true, render: (row) => hasNumericValue(row.relativeVolume) ? formatMultiple(row.relativeVolume) : "Unavailable" },
          { key: "volume", label: "Volume", width: "95px", align: "right", mono: true, render: (row) => row.volumeLabel || (typeof row.volume === "string" ? row.volume : formatCompactNumber(row.volume, 1)) },
          { key: "float", label: "Float", width: "90px", align: "right", mono: true, render: (row) => row.floatLabel || (row.floatShares ? formatCompactNumber(row.floatShares, 2) : "Unavailable") },
          { key: "setup", label: "Catalyst", width: "130px", render: (row) => row.catalyst || row.setup },
          { key: "score", label: "Score", width: "70px", align: "center", render: (row) => <StatusPill theme={theme} tone={row.score >= 70 ? "good" : "warn"}>{row.score}</StatusPill> },
          { key: "risk", label: "Risk", width: "70px", align: "right", color: (row) => row.risk === "Low" ? theme.green : theme.amber },
        ]}
        rows={rows}
        selectedKey={selectedKey}
        onSelect={(row) => selectMainSymbol?.(row.symbol, row, "dashboard-watchlist")}
        {...tableProps}
      />
    );
  }

  function dashboardScannerTable(rows = dashboard.scannerRows.slice(0, 3), selectedKey = dashboard.selected.symbol) {
    return (
      <PremiumTable
        theme={theme}
        columns={[
          {
            key: "symbol",
            label: "Symbol",
            width: "1.15fr",
            mono: true,
            strong: true,
            render: (row) => (
              <>
                {row.symbol}
                <span style={{ display: "block", color: theme.muted, fontFamily: terminalSansFont, fontSize: 10, fontWeight: 500 }}>
                  {row.catalyst || row.setup || "Market context"}
                </span>
              </>
            ),
          },
          { key: "price", label: "Price", width: "78px", align: "right", mono: true, render: (row) => num(row.price).toFixed(2) },
          { key: "change", label: "Chg%", width: "76px", align: "right", mono: true, color: (row) => toneColor(theme, moveOf(row)), render: (row) => pct(moveOf(row)) },
          { key: "rvol", label: "RVOL", width: "58px", align: "right", mono: true, render: (row) => row.rvolLabel || row.rvol || formatMultiple(row.relativeVolume) },
          { key: "score", label: "Score", width: "58px", align: "center", render: (row) => <StatusPill theme={theme} tone={row.score >= 70 ? "good" : "warn"}>{row.score}</StatusPill> },
        ]}
        rows={rows}
        selectedKey={selectedKey}
        onSelect={(row) => selectMainSymbol?.(row.symbol, row, "dashboard-scanner")}
        style={{ height: "calc(100% - 51px)", overflowX: "hidden" }}
        rowMinHeight={34}
        headerMinHeight={28}
        cellPadding="0 10px"
        columnGap={8}
      />
    );
  }

  function selectedRail(extra = null, selectedOverride = selected) {
    return (
      <DetailRail theme={theme} selected={selectedOverride} actions={selectedActions}>
        {extra}
      </DetailRail>
    );
  }

  function renderTradingDesk() {
    const enabledIndicatorRows = CHART_INDICATOR_OPTIONS
      .filter((indicator) => Boolean(chartIndicators?.[indicator.id]))
      .map((indicator) => ({
        indicator: indicator.label,
        status: "Enabled",
        params: indicator.id.startsWith("ema") ? `Period: ${indicator.id.replace("ema", "")}` : "Chart-calculated",
        value: "See chart",
        signal: "Not classified",
      }));
    const activeChartLayout = layoutMode === "1" ? "1" : gridMode === "4" ? "4" : gridMode === "3" ? "3" : "2";
    const chartStageHeight = isNarrowWorkspace
      ? "auto"
      : Math.max(
          activeChartLayout === "1" ? 520 : 470,
          Math.min(
            activeChartLayout === "1" ? 680 : 620,
            viewportHeight - (activeChartLayout === "1" ? 300 : 190)
          )
        );
    const showChartIntelCards = activeChartLayout === "1" && !isNarrowWorkspace;
    const setDeskLayout = (nextLayout) => {
      setLayoutMode?.(nextLayout === "1" ? "1" : "2");
      setGridMode?.(nextLayout === "1" ? "2" : nextLayout);
      setOrderMessage?.(`${nextLayout} chart trading desk layout selected.`);
    };
    const chartStats = [
      ["Day High", selected.dayHigh ?? selected.high],
      ["Day Low", selected.dayLow ?? selected.low],
      ["Volume", selected.volume],
      ["Float", selected.floatShares ?? selected.float],
      ["Market Cap", selected.marketCap],
      ["Beta", selected.beta],
    ];
    const intelligenceCards = [
      {
        title: "AI Market Brief",
        body: selected.whyMoving || selected.catalyst || selected.setup || "No confirmed catalyst is available for this symbol yet.",
        footer: nullableMoveOf(selected) === null ? "Context pending" : `${pct(nullableMoveOf(selected))} selected move`,
        tone: nullableMoveOf(selected) === null ? "neutral" : nullableMoveOf(selected) >= 0 ? "good" : "bad",
      },
      {
        title: "Market Breadth",
        body: `${stocks.filter((row) => nullableMoveOf(row) !== null && nullableMoveOf(row) >= 0).length} advancing / ${stocks.filter((row) => nullableMoveOf(row) !== null && nullableMoveOf(row) < 0).length} declining symbols in the current workspace feed.`,
        footer: `${stocks.length} tracked symbols`,
        tone: "neutral",
      },
      {
        title: "AI Signals",
        body: enabledIndicatorRows.length
          ? `${enabledIndicatorRows.map((row) => row.indicator).join(", ")} enabled on charts.`
          : "No optional chart indicators are enabled. EMA overlays remain available on the chart.",
        footer: `${enabledIndicatorRows.length} enabled`,
        tone: enabledIndicatorRows.length ? "good" : "neutral",
      },
      {
        title: "Sector Pulse",
        body: `${selected.sector || "Sector context"} is the active context for ${selected.symbol}. Scanner rank and news context update when provider data is available.`,
        footer: selected.risk ? `Risk: ${selected.risk}` : "Risk context pending",
        tone: selected.risk === "Low" || selected.risk === "Controlled" ? "good" : "warn",
      },
    ];

    return (
      <div style={{ ...page, overflow: isNarrowWorkspace ? "auto" : "hidden" }}>
        <div
          style={{
            height: isNarrowWorkspace ? "auto" : "100%",
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "minmax(0, 1fr) clamp(300px, 20vw, 360px)",
            gridTemplateRows: isNarrowWorkspace
              ? "auto"
              : showChartIntelCards
                ? `minmax(0, ${chartStageHeight}px) minmax(108px, 118px)`
                : `minmax(0, ${chartStageHeight}px)`,
            gap: 10,
            overflow: "hidden",
          }}
        >
          <PremiumCard
            theme={theme}
            style={{
              minHeight: 0,
              display: "grid",
              gridTemplateRows: "auto minmax(0, 1fr)",
              gridColumn: isNarrowWorkspace ? "auto" : "1 / 2",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                minHeight: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "8px 12px",
                borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ color: theme.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>Charts</div>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginTop: 3 }}>
                  <strong style={{ color: theme.text, fontFamily: terminalMonoFont, fontSize: 18 }}>{selected.symbol}</strong>
                  <span style={{ color: hasNumericValue(selected.price) ? theme.text : theme.muted, fontFamily: terminalMonoFont, fontWeight: 900 }}>
                    {hasNumericValue(selected.price) ? money(selected.price) : "Price pending"}
                  </span>
                  <span style={{ color: nullableMoveOf(selected) === null ? theme.muted : toneColor(theme, nullableMoveOf(selected)), fontFamily: terminalMonoFont, fontWeight: 900 }}>
                    {nullableMoveOf(selected) === null ? "Move pending" : pct(nullableMoveOf(selected))}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <span style={{ color: theme.muted, fontSize: 11, fontWeight: 850 }}>Layout</span>
                {["1", "2", "3", "4"].map((item) => (
                  <ActionButton
                    key={item}
                    theme={theme}
                    active={activeChartLayout === item}
                    onClick={() => setDeskLayout(item)}
                    style={{ width: 38, height: 28, padding: 0 }}
                    aria-label={`${item} chart layout`}
                  >
                    {item}
                  </ActionButton>
                ))}
              </div>
            </div>
            <div style={{ minHeight: 0, padding: 8, overflow: "hidden" }}>
              {renderChartGrid?.({
                layoutMode: activeChartLayout === "1" ? "1" : "2",
                gridMode: activeChartLayout,
              })}
            </div>
          </PremiumCard>

          <div
            style={{
              gridColumn: isNarrowWorkspace ? "auto" : "2 / 3",
              gridRow: isNarrowWorkspace ? "auto" : "1 / 3",
              minHeight: 0,
              display: "grid",
              gap: 10,
              alignContent: "start",
              overflow: "hidden",
            }}
          >
            <DetailRail theme={theme} selected={selected} actions={selectedActions} compact detailStats={chartStats}>
              <PremiumCard theme={theme} title="Watchlist">
                <PremiumTable
                  theme={theme}
                  columns={[
                    { key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true },
                    { key: "price", label: "Last", width: "72px", align: "right", mono: true, render: (row) => hasNumericValue(row.price) ? formatPrice(row.price) : "Pending" },
                    { key: "change", label: "Chg%", width: "64px", align: "right", mono: true, color: (row) => nullableMoveOf(row) === null ? theme.muted : toneColor(theme, nullableMoveOf(row)), render: (row) => nullableMoveOf(row) === null ? "Pending" : formatPercent(nullableMoveOf(row)) },
                  ]}
                  rows={dashboard.watchlistRows.slice(0, 7)}
                  selectedKey={selected.symbol}
                  onSelect={(row) => selectMainSymbol?.(row.symbol, row, "scanner-row")}
                  rowMinHeight={30}
                  headerMinHeight={28}
                  cellPadding="0 9px"
                  columnGap={7}
                  style={{ maxHeight: 260 }}
                />
              </PremiumCard>
              <PremiumCard theme={theme} title="Chart Context">
                <div style={{ padding: 12, display: "grid", gap: 9, color: theme.muted, fontSize: 12, lineHeight: 1.45 }}>
                  <div><b style={{ color: theme.text }}>Catalyst:</b> {selected.catalyst || selected.setup || "No verified catalyst available"}</div>
                  <div><b style={{ color: theme.text }}>Data:</b> {selected.dataMode === "provider" ? "Provider data" : selected.dataMode === "cached" ? "Cached data" : "Fallback context"}</div>
                  <div><b style={{ color: theme.text }}>Trade:</b> Review-only shortcuts. No live broker execution from this workspace.</div>
                </div>
              </PremiumCard>
            </DetailRail>
          </div>

          {showChartIntelCards && (
            <div
              style={{
                gridColumn: isNarrowWorkspace ? "auto" : "1 / 2",
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 10,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {intelligenceCards.map((card) => {
                const tone = card.tone === "good" ? theme.green : card.tone === "bad" ? theme.red : card.tone === "warn" ? theme.amber : theme.blue;
                return (
                  <PremiumCard key={card.title} theme={theme} style={{ overflow: "hidden" }}>
                    <div style={{ padding: 12, display: "grid", gap: 6, minHeight: 0 }}>
                      <div style={{ color: theme.text, fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>{card.title}</div>
                      <div style={{ color: theme.muted, fontSize: 11, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{card.body}</div>
                      <div style={{ marginTop: "auto", color: tone, fontFamily: terminalMonoFont, fontSize: 10, fontWeight: 900 }}>{card.footer}</div>
                    </div>
                  </PremiumCard>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeWorkspace === "charts" || activeWorkspace === "chart-analysis") {
    return renderTradingDesk();
  }

  if (activeWorkspace === "scanner") {
    const scannerSelected =
      scannerUniverseRows.find((row) => row.symbol === selectedStock) ||
      scannerDisplayRows[0] ||
      selected;
    return (
      <div style={page}>
        <div style={mainTwoCol}>
          <PremiumCard theme={theme}>
            <div style={{ padding: 20, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}>
              <SectionTitle theme={theme} title="Scanner" subtitle="Find high-quality trading opportunities" />
              <PremiumTabs theme={theme} tabs={["Gainers", "Losers", "Active", "Momentum", "High RVOL", "News Movers", "New Highs", "New Lows", "Premarket"]} active={scannerTab} onChange={setScannerTab} />
              <div style={{ marginTop: 18, display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
                <select aria-label="Scanner preset" value={activeScannerPreset} onChange={(event) => {
                  const id = event.target.value;
                  setActiveScannerPreset?.(id);
                  const preset = scannerPresets.find((item) => item.id === id);
                  if (preset) {
                    updatePremiumPreference("relativeVolumeThreshold", String(preset.minRvol ?? 0));
                    if (preset.filters) {
                      saveSetting("sb_scanner_filters", preset.filters);
                      updatePremiumPreference("scannerFilters", preset.filters);
                    }
                  }
                }} style={{ height: 36, minWidth: 150, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 10px" }}>
                  {scannerPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                </select>
                <select aria-label="Minimum relative volume" value={String(relativeVolumeThreshold)} onChange={(event) => updatePremiumPreference("relativeVolumeThreshold", event.target.value)} style={{ height: 36, minWidth: 120, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 10px" }}>
                  {["0", "1.25", "1.50", "2.00", "3.00"].map((value) => <option key={value} value={value}>RVOL {value === "0" ? "Any" : `>= ${value}x`}</option>)}
                </select>
                <ActionButton theme={theme} active onClick={() => {
                  const custom = { id: "custom", name: "Custom Scan", minRvol: scannerMinimumRvol, filters: scannerFilters };
                  setScannerPresets?.((current) => [...current.filter((preset) => preset.id !== "custom"), custom]);
                  setActiveScannerPreset?.("custom");
                  setOrderMessage?.("Scanner preset saved to your workspace.");
                }}>Save Preset</ActionButton>
                {activeScannerPreset === "custom" && <ActionButton theme={theme} danger onClick={() => { setScannerPresets?.((current) => current.filter((preset) => preset.id !== "custom")); setActiveScannerPreset?.("default"); updatePremiumPreference("relativeVolumeThreshold", "0"); }}>Delete</ActionButton>}
              </div>
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: isNarrowWorkspace ? "1fr 1fr" : "minmax(180px, 1.5fr) repeat(6, minmax(88px, 1fr)) auto", gap: 8 }}>
                <label style={{ position: "relative", minWidth: 0 }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: theme.muted }} />
                  <input aria-label="Filter scanner by symbol or company" value={scannerFilters.search} onChange={(event) => updateScannerFilter("search", event.target.value)} placeholder="Symbol or company" style={{ width: "100%", height: 34, boxSizing: "border-box", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 9px 0 30px" }} />
                </label>
                {[
                  ["minPrice", "Min price"],
                  ["maxPrice", "Max price"],
                  ["minVolume", "Min volume"],
                  ["minRvol", "Min RVOL"],
                  ["minMarketCap", "Min cap"],
                  ["maxFloat", "Max float"],
                ].map(([key, placeholder]) => (
                  <input key={key} aria-label={placeholder} type="number" min="0" step={key.includes("Price") || key === "minRvol" ? "0.01" : "1"} value={scannerFilters[key]} onChange={(event) => updateScannerFilter(key, event.target.value)} placeholder={placeholder} style={{ minWidth: 0, width: "100%", height: 34, boxSizing: "border-box", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px", fontFamily: terminalMonoFont }} />
                ))}
                <ActionButton theme={theme} onClick={resetScannerFilters}>Reset</ActionButton>
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select aria-label="Risk filter" value={scannerFilters.risk} onChange={(event) => updateScannerFilter("risk", event.target.value)} style={{ width: 130, height: 34, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px" }}><option value="all">Any risk</option>{["low", "medium", "elevated", "high", "controlled", "context"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
                <select aria-label="Sector filter" value={scannerFilters.sector} onChange={(event) => updateScannerFilter("sector", event.target.value)} style={{ width: 170, height: 34, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px" }}><option value="all">Any sector</option>{[...new Set(scannerUniverseRows.map((row) => row.sector).filter((value) => value && value !== "Not reported"))].sort().map((value) => <option key={value} value={value}>{value}</option>)}</select>
                <select aria-label="Country filter" value={scannerFilters.country} onChange={(event) => updateScannerFilter("country", event.target.value)} style={{ width: 130, height: 34, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px" }}><option value="all">Any country</option>{[...new Set(scannerUniverseRows.map((row) => row.country).filter(Boolean))].sort().map((value) => <option key={value} value={String(value).toUpperCase()}>{value}</option>)}</select>
              </div>
            </div>
            {scannerTable(scannerDisplayRows.slice(0, 30))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 20px", color: theme.muted, fontSize: 12 }}>
              <span>
                Results: {scannerDisplayRows.length}
                {" · "}
                {scannerMeta.contractVersion || "legacy contract"}
                {" · "}
                {scannerMeta.cached ? "cached" : scannerMeta.degraded ? "limited context" : "provider data"}
              </span>
              <button
                type="button"
                aria-pressed={scannerAutoRefresh}
                onClick={() => updatePremiumPreference("scannerAutoRefresh", !scannerAutoRefresh)}
                style={{ border: 0, background: "transparent", color: theme.muted, cursor: "pointer", padding: 0 }}
              >
                Auto Refresh <StatusPill theme={theme} tone={scannerAutoRefresh ? "good" : "warn"}>{scannerAutoRefresh ? "On" : "Paused"}</StatusPill>
              </button>
            </div>
          </PremiumCard>
          {selectedRail(
            <>
              <PremiumCard theme={theme} title="Why Ranked"><div style={{ padding: 14, color: theme.text, lineHeight: 1.55 }}>{scannerSelected.whyRanked || scannerSelected.whyMoving || scannerSelected.catalyst || "No confirmed ranking evidence is available."}</div></PremiumCard>
              <PremiumCard theme={theme} title="Scanner Evidence"><div style={{ padding: 14, display: "grid", gap: 10 }}>{[
                ["Trust", scannerSelected.verified ? "Verified provider" : scannerSelected.isSynthetic ? "Synthetic context" : "Calculated context"],
                ["Freshness", scannerSelected.freshness || "Unavailable"],
                ["Relative volume", hasNumericValue(scannerSelected.relativeVolume) ? formatMultiple(scannerSelected.relativeVolume) : "Unavailable"],
                ["Volume", scannerSelected.volumeLabel || (hasNumericValue(scannerSelected.volume) ? formatCompactNumber(scannerSelected.volume, 1) : "Unavailable")],
                ["Score", hasNumericValue(scannerSelected.scannerScore ?? scannerSelected.score) ? scannerSelected.scannerScore ?? scannerSelected.score : "Unavailable"],
                ["Source", scannerSelected.source || "Scanner Engine"],
              ].map(([label, value]) => <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>{label}</span><b style={{ textAlign: "right" }}>{value}</b></div>)}</div></PremiumCard>
              {scannerSelected.scoreBreakdown && (
                <PremiumCard theme={theme} title="Score Breakdown">
                  <div style={{ padding: 14, display: "grid", gap: 9 }}>
                    {Object.entries(scannerSelected.scoreBreakdown).map(([label, value]) => (
                      <div key={label} style={{ display: "grid", gridTemplateColumns: "96px minmax(0, 1fr) 34px", alignItems: "center", gap: 8 }}>
                        <span style={{ color: theme.muted, fontSize: 11, textTransform: "capitalize" }}>{label.replace(/([A-Z])/g, " $1")}</span>
                        <span style={{ height: 5, borderRadius: 3, background: theme.panel2, overflow: "hidden" }}>
                          <span style={{ display: "block", width: `${Math.max(0, Math.min(100, Number(value) || 0))}%`, height: "100%", background: theme.blue }} />
                        </span>
                        <b style={{ color: theme.text, fontFamily: terminalMonoFont, fontSize: 10, textAlign: "right" }}>{Math.round(Number(value) || 0)}</b>
                      </div>
                    ))}
                  </div>
                </PremiumCard>
              )}
              <PremiumCard theme={theme}><div style={{ padding: 16, color: theme.amber, fontWeight: 900 }}><Shield size={18} style={{ verticalAlign: "-4px", marginRight: 8 }} />RISK: {scannerSelected.risk || "Context only"} <ChevronRight size={16} style={{ float: "right" }} /></div></PremiumCard>
            </>,
            scannerSelected
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
                  { key: "price", label: "Last", width: "90px", align: "right", mono: true, render: (row) => hasNumericValue(row.price) ? num(row.price).toFixed(2) : "Unavailable" },
                  { key: "change", label: "Chg%", width: "90px", align: "right", mono: true, color: (row) => nullableMoveOf(row) === null ? theme.muted : toneColor(theme, nullableMoveOf(row)), render: (row) => nullableMoveOf(row) === null ? "Unavailable" : pct(nullableMoveOf(row)) },
                  { key: "volumeLabel", label: "Volume", width: "100px", align: "right", mono: true },
                  { key: "rvolLabel", label: "RVOL", width: "80px", align: "right", mono: true },
                  { key: "floatLabel", label: "Float", width: "90px", align: "right", mono: true },
                  { key: "sector", label: "Sector", width: "150px" },
                  { key: "catalyst", label: "Context", width: "1fr", render: (row) => row.catalyst || "No confirmed catalyst" },
                  { key: "remove", label: "", width: "42px", align: "center", render: (row) => <button type="button" aria-label={`Remove ${row.symbol} from watchlist`} title={`Remove ${row.symbol}`} onClick={(event) => { event.stopPropagation(); removeWatchlistSymbol?.(row.symbol); }} style={{ width: 28, height: 28, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 5, background: "transparent", color: theme.muted, cursor: "pointer" }}><X size={13} /></button> },
                ]}
                rows={dashboard.watchlistRows.slice(0, 20)}
                selectedKey={selected.symbol}
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
                        {row.headline}<span style={{ color: theme.blue, fontSize: 10, marginLeft: 5 }}>OPEN</span>
                      </a>
                    ) : row.headline,
                  },
                  { key: "symbol", label: "Symbol", width: "80px", mono: true },
                  { key: "source", label: "Source", width: "120px" },
                  { key: "impact", label: "Impact", width: "90px", render: (row) => <StatusPill theme={theme} tone={row.impact === "High" ? "bad" : "warn"}>{row.impact}</StatusPill> },
                  { key: "sentiment", label: "Sentiment", width: "100px", color: (row) => row.sentiment === "Bearish" ? theme.red : theme.green },
                ]}
                rows={headlines}
                selectedKey={selectedStory?.id}
                keyField="id"
                onSelect={(row) => {
                  setSelectedNewsId(row.id);
                  if (row.symbol) selectMainSymbol?.(row.symbol, row, "news-row");
                  if (row.url) window.open(row.url, "_blank", "noopener,noreferrer");
                }}
              />
            </PremiumCard>
            <PremiumCard theme={theme} title="Watchlist News">{scannerTable(stocks.slice(0, 4))}</PremiumCard>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme} title="Selected Story" action={<Star size={18} color={theme.blue} fill={theme.blue} />}>
              <div style={{ padding: 18 }}>
                <h2 style={{ margin: 0, fontSize: 22 }}>{selectedStory?.headline || "No story selected"}</h2>
                <div style={{ color: theme.muted, marginTop: 10 }}>{selectedStory ? `${selectedStory.source} / ${selectedStory.time}` : "Provider feed unavailable"}</div>
                <div style={{ marginTop: 16, lineHeight: 1.55, color: theme.text }}>{selectedStory?.summary || "No provider summary is available for this headline."}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
                  <ActionButton theme={theme} active onClick={() => selectMainSymbol?.(selectedStory?.symbol || selected.symbol)}>Open Chart</ActionButton>
                  <ActionButton theme={theme} onClick={() => prepareReviewAction("News alert review", selectedStory?.symbol || selected.symbol)}>Alert Review</ActionButton>
                  <ActionButton theme={theme} good onClick={() => addSymbolToWatchlist?.(selectedStory?.symbol || selected.symbol)}>Watch Symbol</ActionButton>
                </div>
              </div>
            </PremiumCard>
            <PremiumCard theme={theme} title="News Classification"><div style={{ padding: 14, display: "grid", gap: 9 }}>{[["Impact", selectedStory?.impact || "Not classified"], ["Sentiment", selectedStory?.sentiment || "Not classified"], ["Source", selectedStory?.source || "Unavailable"], ["Data mode", selectedStory?.fallback ? "Fallback context" : selectedStory ? "Provider article" : "Unavailable"]].map(([a, b]) => <div key={a} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>{a}</span><b>{b}</b></div>)}</div></PremiumCard>
            <PremiumCard theme={theme} title="Upcoming Events"><PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "90px" }, { key: "event", label: "Event", width: "1fr" }, { key: "impact", label: "Impact", width: "70px" }]} rows={[]} emptyMessage="Economic calendar is not connected" /></PremiumCard>
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
              <div style={{ padding: 16, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}>
                <SectionTitle theme={theme} title="Alerts" subtitle="Manage price alerts saved to your private workspace." action={(
                  <div style={{ display: "flex", gap: 8 }}>
                    <input aria-label="Alert trigger price" type="number" min="0.01" step="0.01" value={alertDraftPrice} onChange={(event) => setAlertDraftPrice(event.target.value)} placeholder={num(selected.price) ? num(selected.price).toFixed(2) : "Trigger price"} style={{ width: 130, height: 34, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 10px", fontFamily: terminalMonoFont }} />
                    <select aria-label="Alert direction" value={alertDraftDirection} onChange={(event) => setAlertDraftDirection(event.target.value)} style={{ height: 34, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px" }}><option value="above">Above</option><option value="below">Below</option></select>
                    <ActionButton theme={theme} active onClick={() => {
                      const created = createPriceAlert?.({ symbol: selected.symbol, trigger: alertDraftPrice, direction: alertDraftDirection });
                      if (created) { setAlertDraftPrice(""); setOrderMessage?.(`Alert created for ${selected.symbol}.`); }
                    }}>Create <Plus size={14} style={{ verticalAlign: "-2px", marginLeft: 6 }} /></ActionButton>
                  </div>
                )} />
                <PremiumTabs theme={theme} tabs={["Active Alerts", "Paused", "Triggered", "All Alerts"]} active={alertView} onChange={setAlertView} />
              </div>
              <PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true, render: (row) => <><Star size={14} color={theme.amber} fill={theme.amber} style={{ verticalAlign: "-2px", marginRight: 10 }} />{row.symbol}</> }, { key: "type", label: "Alert Type", width: "130px" }, { key: "condition", label: "Condition", width: "1.4fr" }, { key: "last", label: "Last Price", width: "100px", align: "right", mono: true, render: (row) => num(row.last) ? num(row.last).toFixed(2) : "Unavailable" }, { key: "target", label: "Target", width: "90px", align: "right", mono: true }, { key: "status", label: "Status", width: "100px", render: (row) => <StatusPill theme={theme} tone={row.status === "Triggered" ? "bad" : row.status === "Paused" ? "warn" : "good"}>{row.status}</StatusPill> }, { key: "created", label: "Created", width: "150px", render: (row) => row.created && row.created !== "Not recorded" ? new Date(row.created).toLocaleString() : row.created }]} rows={alertRows.filter((row) => alertView === "All Alerts" || (alertView === "Active Alerts" ? row.status === "Active" : row.status === alertView))} selectedKey={selectedAlert?.id} keyField="id" emptyMessage={`No ${alertView.toLowerCase()} available.`} onSelect={(row) => { setSelectedAlertSymbol(row.id); selectMainSymbol?.(row.symbol, row, "alert-row"); }} />
            </PremiumCard>
            <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "1fr 390px", gap: 10 }}>{bottomDock}{quickOrder}</div>
          </div>
          {selectedRail(<><PremiumCard theme={theme} title="Selected Alert"><div style={{ padding: 14, display: "grid", gap: 9 }}>{selectedAlert ? <><b>{selectedAlert.symbol} {selectedAlert.type}</b><span>{selectedAlert.condition}</span><StatusPill theme={theme} tone={selectedAlert.status === "Triggered" ? "bad" : selectedAlert.status === "Paused" ? "warn" : "good"}>{selectedAlert.status}</StatusPill><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><ActionButton theme={theme} onClick={() => toggleAlert?.(selectedAlert.id)}>{selectedAlert.status === "Active" ? "Pause" : "Resume"}</ActionButton><ActionButton theme={theme} danger onClick={() => { removeAlert?.(selectedAlert.id); setSelectedAlertSymbol(null); }}>Delete</ActionButton></div><ActionButton theme={theme} disabled={!Number(alertDraftPrice)} title={!Number(alertDraftPrice) ? "Enter a positive trigger price before updating the alert" : "Update the trigger and reactivate this alert"} onClick={() => { const next = Number(alertDraftPrice); if (next > 0) { updateAlert?.(selectedAlert.id, { trigger: next, direction: alertDraftDirection, active: true, triggeredAt: null }); setAlertDraftPrice(""); } }}>Update & Reactivate</ActionButton></> : <span style={{ color: theme.muted }}>Create an alert to manage it here.</span>}</div></PremiumCard><PremiumCard theme={theme} title="Alert Activity"><div style={{ padding: 14, display: "grid", gap: 8 }}>{selectedAlert?.history?.length ? selectedAlert.history.map((event) => <div key={event.id} style={{ borderBottom: `1px solid ${theme.borderSoft || theme.border}`, paddingBottom: 8 }}><div style={{ color: theme.text }}>{selectedAlert.symbol} triggered {event.direction} {money(event.trigger)}</div><div style={{ color: theme.muted, fontSize: 11, marginTop: 3 }}>{new Date(event.occurredAt).toLocaleString()} at {money(event.price)}</div></div>) : <span style={{ color: theme.muted }}>No trigger activity yet. Alerts evaluate only while the terminal is open.</span>}</div></PremiumCard></>)}
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
              <div style={{ padding: 16, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}><PremiumTabs theme={theme} tabs={["Orders", "All Orders", "Working", "Filled", "Cancelled", "Rejected"]} active="Orders" /><div style={{ marginTop: 14 }}><FilterBar theme={theme} search="All Symbols" items={["All dates"]} /></div></div>
              <PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "90px", mono: true }, { key: "symbol", label: "Symbol", width: "90px", mono: true, strong: true }, { key: "side", label: "Side", width: "70px", color: (row) => row.side === "BUY" ? theme.green : theme.red, strong: true }, { key: "type", label: "Type", width: "90px" }, { key: "qty", label: "Qty", width: "70px", align: "right", mono: true }, { key: "price", label: "Price", width: "100px", align: "right", mono: true }, { key: "status", label: "Status", width: "140px", render: (row) => <StatusPill theme={theme} tone={row.status === "REJECTED" ? "bad" : row.status.includes("WORK") ? "neutral" : row.status.includes("PART") ? "warn" : "good"}>{row.status}</StatusPill> }, { key: "filled", label: "Filled", width: "80px", align: "right", mono: true }, { key: "remaining", label: "Remaining", width: "100px", align: "right", mono: true }, { key: "tif", label: "TIF", width: "70px" }, { key: "id", label: "Order ID", width: "110px", mono: true }]} rows={orderRows} selectedKey={selectedOrder?.id} keyField="id" onSelect={(row) => { setSelectedOrderId(row.id); selectMainSymbol?.(row.symbol, row, "order-row"); }} />
            </PremiumCard>
            <PremiumCard theme={theme} title="Order Activity"><PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "100px" }, { key: "event", label: "Event", width: "1fr" }, { key: "status", label: "Status", width: "140px", color: () => theme.green }]} rows={orderRows.slice(0, 5).map((row) => ({ time: row.time, event: `${row.symbol} ${row.side} ${row.qty} @ ${row.price}`, status: row.status }))} /></PremiumCard>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme} title="Place New Order"><div style={{ padding: 16 }}>{quickOrder.props.children}</div></PremiumCard>
            <PremiumCard theme={theme} title="Order Summary"><div style={{ padding: 14, display: "grid", gap: 10 }}>{[["Selected Order", selectedOrder ? `${selectedOrder.side} ${selectedOrder.qty} ${selectedOrder.symbol}` : "No order selected"], ["Order Value", money(num(selectedOrder?.price, selected.price) * num(selectedOrder?.qty, quantity))], ["Mode", "Review only"], ["Status", selectedOrder?.status || "No rows yet"]].map(([a, b]) => <div key={a} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>{a}</span><b style={{ textAlign: "right" }}>{b}</b></div>)}</div></PremiumCard>
            <PremiumCard theme={theme} title="Quick Actions">
              <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                <ActionButton theme={theme} danger title="Prepare a cancel-orders review" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, minWidth: 0, padding: "0 7px", whiteSpace: "nowrap", fontSize: 11 }} onClick={() => prepareReviewAction("Cancel orders review", selectedOrder?.symbol || selected.symbol)}><X size={13} />Cancel</ActionButton>
                <ActionButton theme={theme} title="Prepare a close-positions review" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, minWidth: 0, padding: "0 7px", whiteSpace: "nowrap", fontSize: 11 }} onClick={() => prepareReviewAction("Close positions review", selected.symbol)}><Lock size={13} />Close</ActionButton>
                <ActionButton theme={theme} title="Prepare a flatten-day review" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, minWidth: 0, padding: "0 7px", whiteSpace: "nowrap", fontSize: 11 }} onClick={() => prepareReviewAction("Flatten day review", selected.symbol)}><Shield size={13} />Flatten</ActionButton>
              </div>
            </PremiumCard>
          </div>
        </div>
      </div>
    );
  }

  if (activeWorkspace === "positions") {
    if (positionRows.length === 0) {
      return <div style={page}><SectionTitle theme={theme} title="Positions" /><EmptyWorkspace theme={theme} title="No connected positions" detail="Portfolio positions appear here only after an authenticated broker account supplies account data. No sample holdings are shown." /></div>;
    }
    const enriched = positionRows.map((row) => ({
      ...row,
      marketValue: row.last * row.qty,
      dayPnl: Number.isFinite(row.dayPnl) ? row.dayPnl : (row.last - row.avg) * row.qty,
      totalPnl: Number.isFinite(row.totalPnl) ? row.totalPnl : (row.last - row.avg) * row.qty,
    }));
    const portfolioValue = enriched.reduce((total, row) => total + row.marketValue, 0);
    const positionAllocation = enriched.map((row) => ({
      symbol: row.symbol,
      percent: portfolioValue > 0 ? (row.marketValue / portfolioValue) * 100 : null,
    }));
    const selectedPositionContext = stocks.find((row) => row.symbol === selectedPosition?.symbol);
    return (
      <div style={page}>
        <div style={mainTwoCol}>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme}>
              <div style={{ padding: 16, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}><SectionTitle theme={theme} title="Positions" /><PremiumTabs theme={theme} tabs={["Open Positions", "Closed Positions", "Holdings", "Allocations"]} active="Open Positions" /><div style={{ marginTop: 14 }}><FilterBar theme={theme} search="All Symbols" items={["All Accounts", "All Sectors", "Sort: P&L %"]} /></div></div>
              <PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true }, { key: "side", label: "Side", width: "80px", color: () => theme.green }, { key: "qty", label: "Qty", width: "70px", align: "right" }, { key: "avg", label: "Avg Price", width: "100px", align: "right", mono: true, render: (row) => row.avg.toFixed(2) }, { key: "last", label: "Last Price", width: "100px", align: "right", mono: true, render: (row) => row.last.toFixed(2) }, { key: "marketValue", label: "Market Value", width: "120px", align: "right", mono: true, render: (row) => money(row.marketValue) }, { key: "dayPnl", label: "Day P&L", width: "100px", align: "right", mono: true, color: (row) => row.dayPnl >= 0 ? theme.green : theme.red, render: (row) => money(row.dayPnl) }, { key: "totalPnl", label: "Total P&L", width: "100px", align: "right", mono: true, color: (row) => row.totalPnl >= 0 ? theme.green : theme.red, render: (row) => money(row.totalPnl) }, { key: "exposure", label: "Exposure", width: "90px", align: "right" }, { key: "risk", label: "Risk", width: "70px", align: "center", render: (row) => <StatusPill theme={theme} tone="warn">{row.risk}</StatusPill> }]} rows={enriched} selectedKey={selectedPosition?.symbol} onSelect={(row) => { setSelectedPositionSymbol(row.symbol); selectMainSymbol?.(row.symbol, row, "position-row"); }} />
            </PremiumCard>
            <PremiumCard theme={theme} title="Position Activity"><PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "120px" }, { key: "symbol", label: "Symbol", width: "100px", mono: true }, { key: "action", label: "Action", width: "120px" }, { key: "side", label: "Side", width: "90px" }, { key: "qty", label: "Qty", width: "80px" }, { key: "note", label: "Status", width: "1fr" }]} rows={orderRows.filter((row) => enriched.some((position) => position.symbol === row.symbol)).slice(0, 5).map((row) => ({ time: row.time, symbol: row.symbol, action: row.status, side: row.side, qty: row.qty, note: "Authenticated order record" }))} emptyMessage="No authenticated position activity" /></PremiumCard>
          </div>
          {selectedRail(<><PremiumCard theme={theme} title="Position Context"><div style={{ padding: 14, display: "grid", gap: 10, color: theme.muted }}><div><b style={{ color: theme.text }}>Catalyst:</b> {selectedPositionContext?.catalyst || "No verified catalyst available"}</div><div><b style={{ color: theme.text }}>Risk:</b> {selectedPosition?.risk || "Unavailable"}</div><div><b style={{ color: theme.text }}>Technical insight:</b> Unavailable without a verified analysis feed</div></div></PremiumCard><PremiumCard theme={theme} title="Position Allocation"><div style={{ padding: 14, display: "grid", gap: 12 }}>{positionAllocation.map((row) => <div key={row.symbol} style={{ color: theme.text }}><span style={{ fontFamily: terminalMonoFont }}>{row.symbol}</span> {row.percent === null ? "Unavailable" : `${row.percent.toFixed(1)}%`}<div style={{ height: 5, background: theme.panel2, borderRadius: 99, marginTop: 5 }}><div style={{ width: row.percent === null ? "0%" : `${Math.min(row.percent, 100)}%`, height: "100%", background: theme.blue, borderRadius: 99 }} /></div></div>)}</div></PremiumCard></>)}
        </div>
      </div>
    );
  }

  if (activeWorkspace === "risk") {
    if (positionRows.length === 0) {
      return <div style={page}><SectionTitle theme={theme} title="Risk" /><EmptyWorkspace theme={theme} title="Risk data unavailable" detail="Risk, exposure, beta, and VaR require authenticated portfolio positions. The terminal will not manufacture portfolio metrics when no account data exists." /></div>;
    }
    const totalMarketValue = positionRows.reduce((sum, row) => sum + row.last * row.qty, 0);
    const largestPosition = positionRows.reduce((largest, row) => Math.max(largest, row.last * row.qty), 0);
    const riskEvents = alertRows.filter((row) => row.status !== "Active").map((row) => ({
      time: row.created,
      type: row.type,
      severity: "Review",
      message: row.condition,
      symbol: row.symbol,
      status: row.status,
    }));
    return (
      <div style={page}>
        <div style={mainTwoCol}>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme}>
              <div style={{ padding: 16, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}><SectionTitle theme={theme} title="Risk" /><PremiumTabs theme={theme} tabs={["Overview", "Limits", "Exposure", "Stress Test", "Margin"]} active="Overview" /><div style={{ marginTop: 14 }}><FilterBar theme={theme} search="All Accounts" items={["All Symbols", "Risk Model: Standard"]} /></div></div>
              <PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true, strong: true }, { key: "side", label: "Side", width: "80px", color: () => theme.green }, { key: "qty", label: "Qty", width: "70px" }, { key: "last", label: "Last Price", width: "100px", align: "right", mono: true, render: (row) => row.last.toFixed(2) }, { key: "market", label: "Market Value", width: "120px", align: "right", mono: true, render: (row) => money(row.last * row.qty) }, { key: "day", label: "Day P&L", width: "100px", align: "right", color: (row) => row.dayPnl >= 0 ? theme.green : theme.red, render: (row) => money(row.dayPnl) }, { key: "exposure", label: "Exposure %", width: "90px", align: "right", render: (row) => totalMarketValue ? `${(((row.last * row.qty) / totalMarketValue) * 100).toFixed(1)}%` : "Unavailable" }, { key: "beta", label: "Beta", width: "70px", render: (row) => row.beta ?? "Unavailable" }, { key: "var", label: "VaR (1D)", width: "100px", align: "right", render: (row) => row.var1d === null ? "Unavailable" : money(row.var1d) }, { key: "risk", label: "Risk", width: "90px", render: (row) => <StatusPill theme={theme} tone="warn">{row.risk}</StatusPill> }]} rows={positionRows} selectedKey={selectedPosition?.symbol} onSelect={(row) => { setSelectedPositionSymbol(row.symbol); selectMainSymbol?.(row.symbol, row, "risk-row"); }} />
            </PremiumCard>
            <PremiumCard theme={theme} title="Risk Events & Limits"><PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "140px" }, { key: "type", label: "Type", width: "180px" }, { key: "severity", label: "Severity", width: "100px", render: (row) => <StatusPill theme={theme} tone="warn">{row.severity}</StatusPill> }, { key: "message", label: "Message", width: "1fr" }, { key: "symbol", label: "Symbol", width: "90px", mono: true }, { key: "status", label: "Status", width: "100px" }]} rows={riskEvents} emptyMessage="No risk events recorded" /></PremiumCard>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme} title="Portfolio Risk Overview">
              <div style={{ padding: 14, display: "grid", gap: 12, minWidth: 0 }}>
                {[
                  ["Gross Exposure", money(totalMarketValue)],
                  ["Portfolio Beta", "Unavailable"],
                  ["VaR (1D)", "Unavailable"],
                  ["Largest Position", totalMarketValue ? `${((largestPosition / totalMarketValue) * 100).toFixed(1)}%` : "Unavailable"],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, color: theme.muted, fontSize: 12 }}>
                    <span>{label}</span>
                    <b style={{ color: String(value).startsWith("-") ? theme.red : theme.text, fontFamily: terminalMonoFont }}>{value}</b>
                  </div>
                ))}
              </div>
            </PremiumCard>
            <PremiumCard theme={theme} title="Risk Insight"><div style={{ padding: 14, color: theme.muted, lineHeight: 1.6 }}>Position exposure is calculated from authenticated holdings. Beta, VaR, and sector analytics remain unavailable until the broker supplies those fields.</div></PremiumCard>
          </div>
        </div>
      </div>
    );
  }

  if (activeWorkspace === "performance") {
    const net = Number(realizedPnL || 0) + Number(totalUnrealizedPnL || 0);
    if (!journalRows.length && !positionRows.length && net === 0) {
      return <div style={page}><SectionTitle theme={theme} title="Performance" /><EmptyWorkspace theme={theme} title="No performance history" detail="Performance statistics will appear after confirmed journal entries or authenticated account activity exists. Sample P&L is intentionally disabled." /></div>;
    }
    const performanceValues = journalRows.map((row) => num(row.pnl));
    const grossProfit = performanceValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
    const grossLoss = Math.abs(performanceValues.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
    const wins = performanceValues.filter((value) => value > 0);
    const losses = performanceValues.filter((value) => value < 0);
    const winRate = performanceValues.length ? (wins.length / performanceValues.length) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;
    const avgWin = wins.length ? grossProfit / wins.length : 0;
    const avgLoss = losses.length ? grossLoss / losses.length : 0;
    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    performanceValues.forEach((value) => { equity += value; peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, peak - equity); });
    const bySymbol = Array.from(journalRows.reduce((map, row) => {
      const current = map.get(row.symbol) || { symbol: row.symbol, pnl: 0, trades: 0, wins: 0 };
      current.pnl += num(row.pnl);
      current.trades += 1;
      if (num(row.pnl) > 0) current.wins += 1;
      map.set(row.symbol, current);
      return map;
    }, new Map()).values()).map((row) => ({ ...row, ret: "Not calculated", win: `${((row.wins / row.trades) * 100).toFixed(1)}%` }));
    return (
      <div style={page}>
        <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "minmax(0, 1fr) 320px", gap: 10 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <SectionTitle theme={theme} title="Performance" />
            <PremiumCard theme={theme}><div style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0,1fr))" }}>{[["Net P&L", money(performanceValues.length ? performanceValues.reduce((a, b) => a + b, 0) : net), net >= 0 ? "good" : "bad"], ["Gross Profit", money(grossProfit), "good"], ["Gross Loss", money(-grossLoss), "bad"], ["Win Rate", `${winRate.toFixed(1)}%`, "neutral"], ["Profit Factor", profitFactor === null ? "Unavailable" : profitFactor.toFixed(2), "neutral"], ["Max Drawdown", money(-maxDrawdown), "bad"], ["Total Trades", String(performanceValues.length)], ["Avg Win", money(avgWin), "good"]].map(([a, b, tone]) => <MetricTile key={a} theme={theme} label={a} value={b} tone={tone} />)}</div></PremiumCard>
            <PremiumCard theme={theme} title="Recorded P&L Curve"><div style={{ height: 270, padding: 16 }}><SeriesSparkline theme={theme} values={performanceValues} height={240} /></div></PremiumCard>
            <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "0.9fr 1.1fr", gap: 10 }}>
              <PremiumCard theme={theme} title="P&L Breakdown"><div style={{ padding: 22, display: "grid", placeItems: "center", minHeight: 220 }}><div style={{ width: 150, height: 150, borderRadius: "50%", background: grossProfit + grossLoss > 0 ? `conic-gradient(${theme.green} 0 ${(grossProfit / (grossProfit + grossLoss)) * 100}%, ${theme.red} ${(grossProfit / (grossProfit + grossLoss)) * 100}% 100%)` : theme.panel2, display: "grid", placeItems: "center" }}><div style={{ width: 90, height: 90, borderRadius: "50%", background: theme.bg, display: "grid", placeItems: "center", textAlign: "center" }}>{money(performanceValues.reduce((a, b) => a + b, 0))}<br /><span style={{ color: theme.muted, fontSize: 11 }}>Recorded P&L</span></div></div></div></PremiumCard>
              <PremiumCard theme={theme} title="Performance By Symbol"><PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true }, { key: "pnl", label: "Net P&L", width: "100px", align: "right", render: (row) => money(row.pnl), color: (row) => row.pnl >= 0 ? theme.green : theme.red }, { key: "ret", label: "Return", width: "100px", align: "right" }, { key: "trades", label: "Trades", width: "70px" }, { key: "win", label: "Win Rate", width: "90px" }]} rows={bySymbol} emptyMessage="No journal performance by symbol" /></PremiumCard>
            </div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme} title="Performance Summary"><div style={{ padding: 14, display: "grid", gap: 12 }}>{[["Recorded Net P&L", money(performanceValues.reduce((a, b) => a + b, 0))], ["Average Win", money(avgWin)], ["Average Loss", money(-avgLoss)], ["Profit Factor", profitFactor === null ? "Unavailable" : profitFactor.toFixed(2)], ["Account Return", "Unavailable"], ["Alpha", "Unavailable"], ["Sharpe Ratio", "Unavailable"]].map(([a, b]) => <div key={a} style={{ display: "flex", justifyContent: "space-between" }}><span>{a}</span><b>{b}</b></div>)}</div></PremiumCard>
            <PremiumCard theme={theme} title="Risk Metrics"><div style={{ padding: 14, display: "grid", gap: 12 }}><div>Max drawdown {money(-maxDrawdown)}</div><div>Best trade {money(Math.max(0, ...performanceValues))}</div><div>Worst trade {money(Math.min(0, ...performanceValues))}</div></div></PremiumCard>
            <PremiumCard theme={theme} title="Export Reports"><div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><ActionButton theme={theme} disabled title="PDF report export is not wired yet">PDF <Download size={14} /></ActionButton><ActionButton theme={theme} onClick={exportTradeSummaryCsv}>CSV <Download size={14} /></ActionButton></div></PremiumCard>
          </div>
        </div>
      </div>
    );
  }

  if (activeWorkspace === "journal") {
    const wins = journalRows.filter((row) => row.outcome === "Win").length;
    const losses = journalRows.filter((row) => row.outcome === "Loss").length;
    const tradeCount = journalRows.length;
    const winRate = `${((wins / Math.max(tradeCount, 1)) * 100).toFixed(2)}%`;
    const journalPnls = journalRows.map((row) => num(row.pnl));
    const journalGrossProfit = journalPnls.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
    const journalGrossLoss = Math.abs(journalPnls.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
    const journalAvgWin = wins ? journalGrossProfit / wins : 0;
    const journalAvgLoss = losses ? journalGrossLoss / losses : 0;
    const journalProfitFactor = journalGrossLoss ? (journalGrossProfit / journalGrossLoss).toFixed(2) : "Unavailable";
    const breakeven = journalRows.filter((row) => num(row.pnl) === 0).length;
    return (
      <div style={page}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 16 }}>
            <SectionTitle theme={theme} title="Journal" subtitle="Track, review and improve your trading performance." />
            <div style={{ display: "flex", gap: 8 }}>
              <ActionButton theme={theme} onClick={() => setJournalDraft?.((current) => ({ ...current, symbol: selectedStock, setup: "", review: "", result: "Review", grade: "B" }))}>Clear Draft</ActionButton>
              <ActionButton theme={theme} active disabled={!journalDraft?.setup?.trim()} title={!journalDraft?.setup?.trim() ? "Enter a setup before saving" : "Save this journal draft"} onClick={addJournalEntry}>Save Trade</ActionButton>
              <ActionButton theme={theme} onClick={exportJournalCsv}>Export CSV</ActionButton>
            </div>
          </div>
          <PremiumCard theme={theme}>
            <div style={{ padding: 12, display: "grid", gap: 12 }}>
            <PremiumTabs theme={theme} tabs={["Overview", "Trades", "Setups", "Daily Log", "Notes", "Lessons", "Statistics", "Exports"]} active="Overview" />
              <FilterBar theme={theme} items={["All recorded dates", "All Symbols", "All Setups", "All Tags", "All Outcomes"]} />
            </div>
          </PremiumCard>
          <PremiumCard theme={theme} title="Prepared Journal Draft">
              <div style={{ padding: 14, display: "grid", gridTemplateColumns: isNarrowWorkspace ? "1fr" : "120px 180px 100px 130px minmax(220px, 1fr)", gap: 12, alignItems: "end" }}>
                {[
                  ["Symbol", "symbol", journalDraft.symbol || selectedStock],
                  ["Setup", "setup", journalDraft.setup],
                ].map(([label, key, value]) => (
                  <label key={key} style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 10, fontWeight: 850, textTransform: "uppercase" }}>
                    {label}
                    <input
                      aria-label={`Journal ${label.toLowerCase()}`}
                      value={value}
                      onChange={(event) => setJournalDraft?.((current) => ({ ...current, [key]: key === "symbol" ? event.target.value.toUpperCase() : event.target.value }))}
                      style={{ height: 34, minWidth: 0, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 9px", fontFamily: key === "symbol" ? terminalMonoFont : terminalSansFont }}
                    />
                  </label>
                ))}
                <label style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 10, fontWeight: 850, textTransform: "uppercase" }}>
                  Grade
                  <select aria-label="Journal grade" value={journalDraft.grade || "B"} onChange={(event) => setJournalDraft?.((current) => ({ ...current, grade: event.target.value }))} style={{ height: 34, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px" }}>
                    {["A", "B", "C", "D"].map((grade) => <option key={grade}>{grade}</option>)}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 10, fontWeight: 850, textTransform: "uppercase" }}>
                  Outcome
                  <select aria-label="Journal outcome" value={journalDraft.result || "Review"} onChange={(event) => setJournalDraft?.((current) => ({ ...current, result: event.target.value }))} style={{ height: 34, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px" }}>
                    {["Review", "Win", "Loss", "Breakeven"].map((result) => <option key={result}>{result}</option>)}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 10, fontWeight: 850, textTransform: "uppercase" }}>
                  Review
                  <input aria-label="Journal review" value={journalDraft.review || ""} placeholder="What happened and what will you improve?" onChange={(event) => setJournalDraft?.((current) => ({ ...current, review: event.target.value }))} style={{ height: 34, minWidth: 0, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 9px" }} />
                </label>
              </div>
            </PremiumCard>
            <PremiumCard theme={theme}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10, minmax(0, 1fr))" }}>
                {[
                  ["Net P&L", money(journalNet), journalNet >= 0 ? "good" : "bad"],
                  ["Total Trades", String(tradeCount), "neutral"],
                  ["Win Rate", winRate, "good"],
                  ["Profit Factor", journalProfitFactor, "neutral"],
                  ["Avg Win", money(journalAvgWin), "good"],
                  ["Avg Loss", money(-journalAvgLoss), "bad"],
                  ["Expectancy", tradeCount ? money(journalNet / tradeCount) : "Unavailable", "neutral"],
                  ["Best Trade", tradeCount ? money(Math.max(...journalPnls)) : "Unavailable", "good"],
                  ["Worst Trade", tradeCount ? money(Math.min(...journalPnls)) : "Unavailable", "bad"],
                  ["Avg Hold Time", "Not calculated", "neutral"],
                ].map(([label, value, tone, detail]) => (
                  <MetricTile key={label} theme={theme} label={label} value={value} tone={tone} detail={detail} />
                ))}
              </div>
            </PremiumCard>
            <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "minmax(0, 1.35fr) 300px 0.85fr", gap: 10 }}>
              <PremiumCard theme={theme} title="Equity Curve">
                <div style={{ padding: 16, height: 310 }}>
                  <div style={{ width: 170, marginBottom: 12 }}>
                    <ActionButton theme={theme} disabled title="Journal equity metric switching is not wired in this pass">Net Liquidation</ActionButton>
                  </div>
                  <div style={{ height: 220, borderLeft: `1px solid ${theme.borderSoft || theme.border}`, borderBottom: `1px solid ${theme.borderSoft || theme.border}`, paddingTop: 12 }}>
                    <SeriesSparkline theme={theme} values={journalPnls} height={190} />
                  </div>
                  <div style={{ textAlign: "center", color: theme.muted, fontSize: 12, marginTop: 8 }}>Net Liquidation</div>
                </div>
              </PremiumCard>
              <PremiumCard theme={theme} title="Trades By Outcome">
                <div style={{ padding: 18, display: "grid", gridTemplateColumns: "150px 1fr", gap: 18, alignItems: "center", minHeight: 310 }}>
                  <div style={{ width: 138, height: 138, borderRadius: "50%", background: tradeCount ? `conic-gradient(${theme.green} 0 ${(wins / tradeCount) * 100}%, ${theme.red} ${(wins / tradeCount) * 100}% ${((wins + losses) / tradeCount) * 100}%, ${theme.muted} ${((wins + losses) / tradeCount) * 100}% 100%)` : theme.panel2, display: "grid", placeItems: "center" }}>
                    <div style={{ width: 76, height: 76, borderRadius: "50%", background: theme.bg, display: "grid", placeItems: "center", textAlign: "center", color: theme.text, fontFamily: terminalMonoFont }}>
                      <b>{tradeCount}</b>
                      <span style={{ color: theme.muted, fontSize: 10 }}>Total Trades</span>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 10, fontSize: 12 }}>
                    <span style={{ color: theme.green }}>Won {wins}</span>
                    <span style={{ color: theme.red }}>Lost {losses}</span>
                    <span style={{ color: theme.muted }}>Breakeven {breakeven}</span>
                  </div>
                </div>
              </PremiumCard>
              <PremiumCard theme={theme} title="P&L Distribution">
                <div style={{ padding: 18, height: 310, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", alignItems: "end", gap: 14 }}>
                  {(journalPnls.length ? journalPnls.slice(-7) : [0]).map((value, index) => {
                    const maxAbs = Math.max(1, ...journalPnls.map(Math.abs));
                    return (
                    <div key={index} style={{ display: "grid", gap: 8, alignItems: "end" }}>
                      <div style={{ height: Math.max(3, (Math.abs(value) / maxAbs) * 150), background: value >= 0 ? theme.green : theme.red, opacity: 0.86, borderRadius: "4px 4px 0 0" }} />
                      <span style={{ color: theme.muted, fontSize: 10, textAlign: "center" }}>{money(value)}</span>
                    </div>
                    );
                  })}
                </div>
              </PremiumCard>
            </div>
            <PremiumCard theme={theme} title="Recent Trades" action={<ActionButton theme={theme} active disabled={!journalDraft?.setup?.trim()} title={!journalDraft?.setup?.trim() ? "Enter a setup before saving" : "Save this journal draft"} onClick={addJournalEntry}>Save Draft</ActionButton>}>
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
                  { key: "actions", label: "", width: "54px", align: "center", render: (row) => <button type="button" aria-label={`Delete journal entry ${row.symbol}`} title="Delete journal entry" onClick={(event) => { event.stopPropagation(); removeJournalEntry?.(row.id); }} style={{ width: 28, height: 28, display: "grid", placeItems: "center", margin: "0 auto", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 5, background: "transparent", color: theme.muted, cursor: "pointer" }}><X size={13} /></button> },
                ]}
                rows={journalRows}
              />
              <div style={{ padding: "12px 16px", color: theme.muted, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                <span>{journalRows.length ? `Showing 1 to ${Math.min(journalRows.length, 8)} of ${journalRows.length} trades` : "No recorded trades"}</span>
                {journalRows.length > 8 ? <span style={{ fontFamily: terminalMonoFont }}>1 2 3 4 5 ...</span> : null}
              </div>
            </PremiumCard>
        </div>
      </div>
    );
  }

  if (activeWorkspace === "replay") {
    const replayStartingCash = 100000;
    const replayNetLiquidation = num(replayStats?.equity, replayEquity.at(-1) ?? replayStartingCash);
    const replayPeak = replayEquity.length ? Math.max(...replayEquity.map((value) => num(value, replayStartingCash))) : replayStartingCash;
    const replayMaxDrawdown = replayEquity.length
      ? Math.min(...replayEquity.map((value) => num(value, replayStartingCash) - replayPeak))
      : 0;
    const replayPositionsBySymbol = (replayTrades || []).reduce((positionsBySymbol, trade) => {
      const symbol = String(trade.symbol || selectedStock || "").toUpperCase();
      if (!symbol) return positionsBySymbol;
      const quantityValue = Math.abs(num(trade.quantity ?? trade.qty, 0));
      const priceValue = num(trade.price ?? trade.fillPrice, 0);
      const direction = String(trade.side || trade.type || "").toUpperCase();
      const quantityDelta = direction === "SELL" || direction === "SHORT" ? -quantityValue : quantityValue;
      const existing = positionsBySymbol[symbol] || { symbol, quantity: 0, cost: 0 };
      if (quantityDelta > 0) existing.cost += quantityDelta * priceValue;
      existing.quantity += quantityDelta;
      if (existing.quantity <= 0) existing.cost = 0;
      positionsBySymbol[symbol] = existing;
      return positionsBySymbol;
    }, {});
    const replayPositions = Object.values(replayPositionsBySymbol)
      .filter((position) => position.quantity !== 0)
      .map((position) => {
        const averagePrice = position.quantity > 0 ? position.cost / position.quantity : 0;
        const lastPrice = num(allSymbols?.find((row) => row.symbol === position.symbol)?.price, averagePrice);
        const unrealizedPnl = (lastPrice - averagePrice) * position.quantity;
        return {
          symbol: position.symbol,
          side: position.quantity > 0 ? "Long" : "Short",
          qty: Math.abs(position.quantity),
          avg: averagePrice ? money(averagePrice) : "Unavailable",
          last: lastPrice ? money(lastPrice) : "Unavailable",
          pnl: money(unrealizedPnl),
          pct: averagePrice ? `${((lastPrice - averagePrice) / averagePrice * 100).toFixed(2)}%` : "Unavailable",
        };
      });
    const replaySymbolData = allSymbols?.find((row) => row.symbol === selectedStock) || selected;
    const replayPrice = num(replaySymbolData?.price ?? selected?.price, 0);
    const replayMove = nullableMoveOf(replaySymbolData) ?? nullableMoveOf(selected) ?? 0;
    const replayStatus = replayPlaying ? "Running" : "Paused";
    const replaySummaryRows = [
      ["Starting Cash", money(replayStartingCash)],
      ["Net Liquidation", money(replayNetLiquidation)],
      ["Total P&L", money(replayNet)],
      ["Realized P&L", money(replayNet)],
      ["Unrealized P&L", replayPositions.length ? money(replayPositions.reduce((total, row) => total + num(row.pnl), 0)) : money(0)],
      ["Total Trades", replayRows.length],
      ["Win Rate", `${replayWinRate}%`],
      ["Profit Factor", replayRows.length ? "Review" : "Unavailable"],
      ["Max Drawdown", money(replayMaxDrawdown)],
    ];
    const replayStatusRows = [
      ["Replay Session", "Current"],
      ["Data Speed", `${replaySpeed || 1}x`],
      ["Data Source", "Historical simulation"],
      ["Status", replayStatus],
    ];
    const replayMetric = (label, value) => (
      <label key={label} style={{ display: "grid", gap: 6, minWidth: 0 }}>
        <span style={{ color: theme.muted, fontSize: 10, fontWeight: 850, letterSpacing: 0.2, textTransform: "uppercase" }}>{label}</span>
        <span
          style={{
            minHeight: 34,
            display: "flex",
            alignItems: "center",
            borderTop: `1px solid ${theme.borderSoft || theme.border}`,
            color: theme.text,
            fontFamily: terminalMonoFont,
            fontSize: 13,
            fontWeight: 850,
          }}
        >
          {value}
        </span>
      </label>
    );
    const valueRow = ([label, value]) => {
      const parsed = num(String(value).replace(/[^0-9.-]/g, ""), 0);
      const color = String(value).includes("Unavailable") ? theme.muted : parsed < 0 ? theme.red : label.includes("P&L") && parsed > 0 ? theme.green : theme.text;
      return (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16, color: theme.muted, fontSize: 13 }}>
          <span>{label}</span>
          <b style={{ color, fontFamily: terminalMonoFont, fontWeight: 850 }}>{value}</b>
        </div>
      );
    };
    return (
      <div style={page}>
        <div style={{ display: "grid", gap: 12, minHeight: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
            <SectionTitle theme={theme} title="REPLAY" subtitle="Practice trading with historical market data. All orders are simulated." />
            <ActionButton theme={theme} active={replaySettingsOpen} onClick={() => setReplaySettingsOpen((current) => !current)}>Replay Settings</ActionButton>
          </div>
          {replaySettingsOpen && (
            <PremiumCard theme={theme} title="Replay Settings">
              <div style={{ padding: 14, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "grid", gap: 5, color: theme.muted, fontSize: 11 }}>Default timeframe
                  <select value={timeframe} onChange={(event) => setTimeframe?.(event.target.value)} style={{ height: 34, minWidth: 120, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px" }}>{["1m", "5m", "15m", "1H", "1D"].map((frame) => <option key={frame}>{frame}</option>)}</select>
                </label>
                <div style={{ color: theme.muted, fontSize: 12, lineHeight: 1.45 }}>Playback and orders remain local simulations. Changing timeframe reloads the chart view; it never submits to a broker.</div>
              </div>
            </PremiumCard>
          )}
          <PremiumCard theme={theme}>
            <div
              style={{
                padding: 14,
                display: "grid",
                gridTemplateColumns: isNarrowWorkspace ? "repeat(2, minmax(0, 1fr))" : "150px 170px 140px 140px 110px minmax(220px, 1fr)",
                gap: 14,
                alignItems: "end",
              }}
            >
              {[
                ["Market", "Stocks (US)"],
                ["Date", "Current replay session"],
                ["Start Time", "Market open"],
                ["End Time", "Market close"],
                ["Speed", `${replaySpeed || 1}x`],
              ].map(([label, value]) => replayMetric(label, value))}
              <div style={{ display: "flex", gap: 8, justifyContent: "end", flexWrap: "wrap", gridColumn: isNarrowWorkspace ? "1 / -1" : "auto" }}>
                <ActionButton theme={theme} onClick={() => jumpReplay("open")}>Skip to Open</ActionButton>
                <ActionButton theme={theme} onClick={() => stepReplay?.()}>Step</ActionButton>
                <ActionButton theme={theme} good onClick={() => setReplayPlaying?.(!replayPlaying)}>
                  {replayPlaying ? "Pause Replay" : "Start Replay"}
                </ActionButton>
              </div>
            </div>
          </PremiumCard>

          <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "250px minmax(0, 1fr) 320px", gap: 10, alignItems: "stretch" }}>
            <PremiumCard theme={theme} title="Replay Controls">
              <div style={{ padding: 14, display: "grid", gap: 20 }}>
                <div>
                  <div style={{ color: theme.muted, fontSize: 12, marginBottom: 9 }}>Speed</div>
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
                  <div style={{ color: theme.muted, fontSize: 12, marginBottom: 9 }}>Jump to Time</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      ["Market Open", "open"],
                      ["+ 1 Hour", 60],
                      ["+ 2 Hours", 120],
                      ["+ 3 Hours", 180],
                      ["Market Close", "close"],
                    ].map(([label, target]) => (
                      <ActionButton
                        key={label}
                        theme={theme}
                        onClick={() => jumpReplay(target)}
                      >
                        {label}
                      </ActionButton>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: theme.muted, fontSize: 12, marginBottom: 8 }}>
                    <span>Bookmarks</span>
                    <ActionButton theme={theme} onClick={addReplayBookmark}>+ Add</ActionButton>
                  </div>
                  <div style={{ minHeight: 86, border: `1px dashed ${theme.borderSoft || theme.border}`, borderRadius: 8, padding: 8, color: theme.muted, fontSize: 12, lineHeight: 1.5, display: "grid", gap: 4, alignContent: "start" }}>
                    {replayBookmarks.length
                      ? replayBookmarks.slice(0, 5).map((bookmark) => (
                          <div key={bookmark.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 28px", gap: 4, alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => setReplayIndex?.(bookmark.index)}
                              style={{ minWidth: 0, border: 0, background: "transparent", color: theme.text, padding: "4px 3px", textAlign: "left", cursor: "pointer", fontFamily: terminalMonoFont, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            >
                              {bookmark.label}
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete replay bookmark ${bookmark.label}`}
                              title="Delete bookmark"
                              onClick={() => removeReplayBookmark(bookmark.id)}
                              style={{ width: 28, height: 28, display: "grid", placeItems: "center", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 5, background: "transparent", color: theme.muted, cursor: "pointer" }}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))
                      : "No bookmarks saved for this replay session."}
                  </div>
                </div>
              </div>
            </PremiumCard>

            <div style={{ display: "grid", gridTemplateRows: "minmax(480px, 1fr) 78px", gap: 10, minHeight: 0 }}>
              <div ref={replayChartRef} style={{ minHeight: 0, background: theme.page }}>
                <PremiumCard
                  theme={theme}
                  title={`${selectedStock} Replay Chart`}
                  action={<span style={{ color: theme.muted, fontFamily: terminalMonoFont }}>Historical simulation</span>}
                  style={{ display: "grid", gridTemplateRows: "auto auto minmax(420px, 1fr) auto", minHeight: 560, height: "100%" }}
                >
                <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${theme.borderSoft || theme.border}`, display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
                        <span style={{ color: theme.text, fontSize: 28, fontWeight: 950, fontFamily: terminalMonoFont }}>{selectedStock}</span>
                        <span style={{ color: theme.text, fontSize: 16, fontWeight: 850, fontFamily: terminalMonoFont }}>{replayPrice ? money(replayPrice) : "Unavailable"}</span>
                        <span style={{ color: toneColor(theme, replayMove), fontSize: 13, fontWeight: 900, fontFamily: terminalMonoFont }}>{pct(replayMove)}</span>
                      </div>
                      <div style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>{replaySymbolData?.company || `${selectedStock} INC.`} · {timeframe} · NASDAQ</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ height: 32, minWidth: 180, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 7, background: theme.panel2, display: "flex", alignItems: "center", gap: 8, padding: "0 10px", color: theme.muted }}>
                        <Search size={14} />
                        <span style={{ color: theme.text, fontFamily: terminalMonoFont, fontWeight: 850 }}>{selectedStock}</span>
                      </div>
                      {["1m", "5m", "15m", "1H", "1D"].map((frame) => (
                        <ActionButton key={frame} theme={theme} active={frame === timeframe} onClick={() => setTimeframe?.(frame)}>{frame}</ActionButton>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <ActionButton theme={theme} active={replayIndicatorMenuOpen} onClick={() => setReplayIndicatorMenuOpen((current) => !current)}>Indicators</ActionButton>
                    <ActionButton theme={theme} onClick={captureReplayScreenshot}>Screenshot</ActionButton>
                    <ActionButton theme={theme} onClick={enterReplayFullscreen}>Fullscreen</ActionButton>
                    {replayActionStatus && (
                      <span role="status" style={{ alignSelf: "center", color: theme.green, fontSize: 11, fontWeight: 800 }}>
                        {replayActionStatus}
                      </span>
                    )}
                  </div>
                  {replayIndicatorMenuOpen && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {CHART_INDICATOR_OPTIONS.map((indicator) => (
                        <ActionButton key={indicator.id} theme={theme} active={Boolean(chartIndicators?.[indicator.id])} onClick={() => setChartIndicators?.((current) => ({ ...current, [indicator.id]: !current?.[indicator.id] }))}>
                          {indicator.label}
                        </ActionButton>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ minHeight: 420, height: "100%" }}>{renderChartGrid?.({ layoutMode: "1", compact: true, embeddedChart: true })}</div>
                <div style={{ borderTop: `1px solid ${theme.borderSoft || theme.border}`, padding: "10px 14px", color: theme.muted, fontSize: 12 }}>
                  Replay indicators are shown only when calculated by the chart. No synthetic RSI series is generated.
                </div>
                </PremiumCard>
              </div>
              <PremiumCard theme={theme}>
                <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 16 }}>
                  <div>
                    <div style={{ height: 4, background: theme.panel2, borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ width: replayRows.length ? "36%" : "0%", height: "100%", background: `linear-gradient(90deg, ${theme.blue}, ${theme.green})` }} />
                    </div>
                    <div style={{ color: theme.text, marginTop: 12, fontFamily: terminalMonoFont, fontWeight: 850 }}>Replay {replayStatus.toLowerCase()}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "end" }}>
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
              <PremiumCard theme={theme} title="Simulation Summary">
                <div style={{ padding: 14, display: "grid", gap: 11 }}>{replaySummaryRows.map(valueRow)}</div>
              </PremiumCard>
              <PremiumCard theme={theme} title="Market Replay Status">
                <div style={{ padding: 14, display: "grid", gap: 11 }}>
                  {replayStatusRows.map(([label, value]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16, color: theme.muted, fontSize: 13 }}>
                      <span>{label}</span>
                      <b style={{ color: value === "Running" ? theme.green : theme.text, fontFamily: terminalMonoFont }}>{value}</b>
                    </div>
                  ))}
                </div>
              </PremiumCard>
              <PremiumCard theme={theme} title="Market Events">
                <div style={{ padding: 14, color: theme.muted, fontSize: 12, lineHeight: 1.6 }}>No verified events are attached to this replay session.</div>
              </PremiumCard>
              <PremiumCard theme={theme} title="Replay Notes">
                <div style={{ padding: 14, display: "grid", gap: 10 }}>
                  <textarea
                    aria-label="Replay session notes"
                    placeholder="Add notes for this replay session..."
                    maxLength={1000}
                    value={replayNotes}
                    onChange={(event) => setReplayNotes?.(event.target.value)}
                    style={{ minHeight: 96, resize: "vertical", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 7, background: theme.panel2, color: theme.text, padding: 12, fontFamily: terminalSansFont }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: theme.muted, fontSize: 11 }}>
                    <span>{replayNotes.length} / 1000</span>
                    <ActionButton theme={theme} onClick={() => openReplayJournal?.()}>Send to Journal</ActionButton>
                  </div>
                </div>
              </PremiumCard>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "minmax(0, 0.95fr) minmax(0, 1.45fr)", gap: 10 }}>
            <PremiumCard theme={theme} title="Open Positions (Replay)">
              <PremiumTable theme={theme} columns={[{ key: "symbol", label: "Symbol", width: "1fr", mono: true }, { key: "side", label: "Side", width: "70px", color: (row) => row.side === "Short" ? theme.red : theme.green }, { key: "qty", label: "Qty", width: "60px" }, { key: "avg", label: "Avg Price", width: "90px" }, { key: "last", label: "Last", width: "80px" }, { key: "pnl", label: "Unrealized P&L", width: "120px", color: () => theme.green }, { key: "pct", label: "P&L (%)", width: "80px", color: () => theme.green }]} rows={replayPositions} />
            </PremiumCard>
            <PremiumCard theme={theme} title="Trade History (Replay)">
              <PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "90px" }, { key: "symbol", label: "Symbol", width: "90px", mono: true }, { key: "side", label: "Side", width: "80px", color: (row) => row.side === "Sell" || row.side === "Short" ? theme.red : theme.green }, { key: "qty", label: "Qty", width: "70px" }, { key: "price", label: "Price", width: "90px" }, { key: "pnl", label: "P&L", width: "90px", color: (row) => String(row.pnl).startsWith("+") ? theme.green : theme.muted }]} rows={replayRows} />
            </PremiumCard>
            </div>
        </div>
      </div>
    );
  }

  if (activeWorkspace === "settings") {
    const selectStyle = {
      width: 170,
      height: 30,
      background: theme.panel2,
      border: `1px solid ${theme.borderSoft || theme.border}`,
      borderRadius: 5,
      color: theme.text,
      padding: "0 8px",
      fontFamily: terminalSansFont,
    };
    const landingOptions = [
      ["dashboard", "Dashboard"],
      ["scanner", "Scanner"],
      ["chart-analysis", "Charts"],
      ["watchlist", "Watchlist"],
      ["news", "News"],
      ["alerts", "Alerts"],
      ["orders", "Orders"],
      ["positions", "Positions"],
      ["risk", "Risk"],
      ["performance", "Performance"],
      ["journal", "Journal"],
      ["replay", "Replay"],
      ["settings", "Settings"],
    ];
    const settingSelect = (label, value, options, onChange, disabled = false) => (
      <select
        aria-label={label}
        title={disabled ? `${label} is not available in the current public terminal` : undefined}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        style={{ ...selectStyle, opacity: disabled ? 0.55 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
      >
        {options.map((option) => {
          const [optionValue, optionLabel] = Array.isArray(option) ? option : [option, option];
          return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
        })}
      </select>
    );
    const settingToggle = (on = true, onChange, disabled = false, label = "Toggle setting") => (
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-pressed={Boolean(on)}
        onClick={() => !disabled && onChange?.(!on)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 99,
          border: `1px solid ${on ? theme.blue : theme.borderSoft || theme.border}`,
          background: on ? theme.blue : theme.border,
          display: "inline-flex",
          justifyContent: on ? "flex-end" : "flex-start",
          alignItems: "center",
          padding: 2,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff" }} />
      </button>
    );
    const disabledSetting = (text = "Coming later") => <span style={{ color: theme.muted, fontSize: 11 }}>{text}</span>;
    const accountPlan = normalizePlan(entitlements?.plan);
    const entitlementSource = entitlements?.source || "default";
    const planPill = (plan, active = false) => (
      <div
        key={plan}
        style={{
          border: `1px solid ${active ? theme.blue : theme.borderSoft || theme.border}`,
          background: active ? `${theme.blue}22` : theme.panel2,
          color: active ? theme.text : theme.muted,
          borderRadius: 7,
          padding: "10px 12px",
          minHeight: 62,
        }}
      >
        <div style={{ fontWeight: 900, color: active ? theme.blue : theme.text }}>{PLAN_LABELS[plan]}</div>
        <div style={{ fontSize: 11, marginTop: 5, lineHeight: 1.35 }}>
          {plan === "free" && "Core market terminal access."}
          {plan === "pro" && "AI summaries, replay, and journal."}
          {plan === "premium" && "Risk, performance, and supported broker data."}
          {plan === "admin" && "Internal entitlement administration."}
        </div>
      </div>
    );
    const comingLaterButton = (label, title) => (
      <ActionButton key={label} theme={theme} disabled title={title || `${label} requires backend/account support`}>
        {label}
      </ActionButton>
    );
    const group = (title, rows, tab = "General") => settingsTab === tab ? (
      <PremiumCard theme={theme} title={title}>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          {rows.map(([label, control]) => (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", alignItems: "center", color: theme.muted, fontSize: 12, gap: 12 }}>
              <span>{label}</span>
              <span>{control}</span>
            </div>
          ))}
        </div>
      </PremiumCard>
    ) : null;
    return (
      <div style={page}>
        <SectionTitle theme={theme} title="Settings" />
        <PremiumTabs theme={theme} tabs={["General", "Trading", "Layout", "Notifications", "Data & Connections", "Security"]} active={settingsTab} onChange={setSettingsTab} />
        <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "minmax(0, 1.05fr) minmax(360px, 0.9fr)", gap: 10, marginTop: 12 }}>
          <div style={{ display: "grid", gap: 10 }}>
            {settingsTab === "General" && <PremiumCard theme={theme} title="Account & Plan">
              <div style={{ padding: 16, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ color: theme.text, fontSize: 15, fontWeight: 900 }}>{user?.email || "Authenticated workspace"}</div>
                    <div style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>Plan source: {entitlementSource === "user_entitlements" ? "Supabase entitlement table" : entitlementSource === "app_metadata" ? "Supabase app metadata" : "Default free access"}</div>
                  </div>
                  <StatusPill theme={theme} tone={accountPlan === "free" ? "neutral" : "good"}>{PLAN_LABELS[accountPlan] || "Free"}</StatusPill>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "1fr" : "repeat(4, 1fr)", gap: 8 }}>
                  {["free", "pro", "premium", "admin"].map((plan) => planPill(plan, plan === accountPlan))}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionButton theme={theme} disabled title="Stripe checkout will be connected in the payments phase">Upgrade to Pro</ActionButton>
                  <ActionButton theme={theme} disabled title="Stripe checkout will be connected in the payments phase">Upgrade to Premium</ActionButton>
                </div>
                <div style={{ color: theme.muted, fontSize: 12, lineHeight: 1.5 }}>
                  Market data can be delayed, cached, or provider-limited. SbCapitalCo is an information and review workspace, not financial advice. Confirm liquidity, risk, and broker state before acting.
                </div>
              </div>
            </PremiumCard>}
            {group("Workspace Preferences", [
              ["Theme", settingSelect("Theme", themeMode || "dark", [["dark", "Dark"], ["light", "Light"]], (value) => setThemeMode?.(value))],
              ["Compact mode", settingToggle(compactMode, (value) => updatePremiumPreference("compactMode", value), false, "Toggle compact mode")],
              ["Default landing tab", settingSelect("Default landing tab", defaultLandingTab, landingOptions, (value) => { updatePremiumPreference("defaultLandingTab", value); saveSetting("sb_default_landing_tab", value); setOrderMessage?.(`Default landing tab saved: ${landingOptions.find(([id]) => id === value)?.[1] || value}.`); })],
              ["Time zone", settingSelect("Time zone", timeZone, [["America/Vancouver", "Pacific (PT)"], ["America/New_York", "Eastern (ET)"], ["Europe/London", "London"], ["UTC", "UTC"]], (value) => setTimeZone?.(value))],
              ["Currency display", settingSelect("Currency display", "USD", ["USD"], null, true)],
            ])}
            {group("Trading Preferences", [
              ["Default order type", disabledSetting("Review-only until broker execution is enabled")],
              ["Confirm before order", settingToggle(true, null, true, "Confirm before order")],
              ["Default TIF", disabledSetting("Review-only")],
              ["Hotkeys enabled", disabledSetting()],
              ["Risk warnings enabled", settingToggle(riskWarnings, (value) => updatePremiumPreference("riskWarnings", value), false, "Toggle risk warnings")],
            ], "Trading")}
            {group("Chart & Scanner Defaults", [
              ["Default chart timeframe", settingSelect("Default chart timeframe", timeframe || "15m", ["1m", "5m", "15m", "1H", "1D"], (value) => setTimeframe?.(value))],
              ["Show volume", settingToggle(Boolean(chartIndicators?.volume), (value) => setChartIndicators?.((current) => ({ ...current, volume: value })), false, "Toggle chart volume")],
              ["Scanner auto refresh", settingToggle(scannerAutoRefresh, (value) => { updatePremiumPreference("scannerAutoRefresh", value); setOrderMessage?.(`Scanner auto refresh ${value ? "enabled" : "paused"} locally.`); }, false, "Toggle scanner auto refresh")],
              ["Default universe", disabledSetting("US stocks only in this MVP")],
              ["Relative volume threshold", settingSelect("Relative volume threshold", relativeVolumeThreshold, ["1.25", "1.50", "2.00", "3.00"], (value) => updatePremiumPreference("relativeVolumeThreshold", value))],
            ], "Trading")}
            {settingsTab === "Layout" && <PremiumCard theme={theme} title="Layout Presets"><div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>{[
              ["Trader", "1", "2"],
              ["Research", "2", "2"],
              ["Minimal", "1", "2"],
              ["Risk", "2", "4"],
            ].map(([label, nextLayout, nextGrid]) => <button key={label} type="button" onClick={() => { setLayoutMode?.(nextLayout); setGridMode?.(nextGrid); setOrderMessage?.(`${label} layout applied.`); }} style={{ minHeight: 72, border: `1px solid ${layoutMode === nextLayout && gridMode === nextGrid ? theme.blue : theme.borderSoft || theme.border}`, borderRadius: 7, background: theme.panel2, color: theme.text, textAlign: "left", padding: 12, cursor: "pointer" }}>{label}<div style={{ color: theme.muted, fontSize: 11, marginTop: 5 }}>{nextLayout === "1" ? "Single chart workspace" : `${nextGrid}-chart workspace`}</div></button>)}</div></PremiumCard>}
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {group("Broker & Data Connections", [["Broker status", <StatusPill key="b" theme={theme} tone={brokerConnected ? "good" : "warn"}>{brokerConnected ? "Connected" : "Review-only"}</StatusPill>], ["Market data status", <StatusPill key="d" theme={theme} tone="neutral">Current workspace feed</StatusPill>], ["Connection management", disabledSetting("Managed by the private backend; credentials are never exposed here")], ["Refresh guidance", <span key="a">Use the terminal Retry control to refresh provider health.</span>]], "Data & Connections")}
            {group("Notification Settings", [["Price alert activity", settingToggle(notificationPreferences.priceAlerts, (value) => updateNotificationPreference("priceAlerts", value), false, "Toggle price alert activity")], ["News catalyst highlights", settingToggle(notificationPreferences.newsCatalysts, (value) => updateNotificationPreference("newsCatalysts", value), false, "Toggle news catalyst highlights")], ["Sound alerts", settingToggle(notificationPreferences.soundAlerts, (value) => updateNotificationPreference("soundAlerts", value), false, "Toggle sound alerts")], ["Delivery scope", disabledSetting("In-app while the terminal is open; no email or push delivery")]], "Notifications")}
            {group("Security", [["Authentication", <StatusPill key="auth" theme={theme} tone="good">Supabase session</StatusPill>], ["Two-factor authentication", disabledSetting("Configure in Supabase Auth when required")], ["Device management", comingLaterButton("Unavailable", "Device management is not available in this MVP")], ["Password", <div key="password" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><ActionButton theme={theme} onClick={sendPasswordReset} disabled={passwordResetStatus === "sending"}>{passwordResetStatus === "sending" ? "Sending..." : "Send reset email"}</ActionButton>{passwordResetStatus === "sent" && <span role="status" style={{ color: theme.green, fontSize: 11 }}>Reset email sent</span>}{passwordResetStatus === "failed" && <span role="status" style={{ color: theme.amber, fontSize: 11 }}>Reset email could not be sent</span>}</div>]], "Security")}
            {group("Backup & Sync", [["Cloud sync", <StatusPill key="c" theme={theme} tone={user ? "good" : "warn"}>{user ? "Enabled" : "Local"}</StatusPill>], ["Last backup", user ? "Use Save to update cloud workspace" : "Local browser storage only"], ["Actions", <span key="sync"><ActionButton theme={theme} onClick={saveWorkspaceToCloud}>Save</ActionButton> <ActionButton theme={theme} onClick={loadWorkspaceFromCloud}>Load</ActionButton> <ActionButton theme={theme} onClick={resetWorkspace}>Reset</ActionButton></span>]], "Data & Connections")}
            {settingsTab === "General" && <PremiumCard theme={theme} title="Current Preferences">
              <div style={{ padding: 14, display: "grid", gap: 10 }}>
                {[
                  `Theme: ${themeMode || "dark"}`,
                  `Time zone: ${timeZone}`,
                  `Default landing: ${landingOptions.find(([id]) => id === defaultLandingTab)?.[1] || defaultLandingTab}`,
                  `Chart timeframe: ${timeframe || "15m"}`,
                  `Scanner auto refresh: ${scannerAutoRefresh ? "On" : "Paused"}`,
                ].map((x) => (
                  <div key={x} style={{ color: theme.text }}>
                    <span style={{ color: theme.green }}>*</span> {x}
                  </div>
                ))}
              </div>
            </PremiumCard>}
            {settingsTab === "General" && <PremiumCard theme={theme} title="Support & Diagnostics">
              <div style={{ padding: 14, display: "grid", gap: 10 }}>
                <div style={{ color: theme.muted, fontSize: 12, lineHeight: 1.5 }}>
                  Send a privacy-safe issue report with optional redacted runtime diagnostics. Credentials, tokens, order details, and broker account data are excluded.
                </div>
                <div>
                  <ActionButton theme={theme} active onClick={onOpenIssueReport}>Report Issue</ActionButton>
                </div>
                {accountPlan === "admin" && <AdminMonitoringPanel brokerApiUrl={brokerApiUrl} theme={theme} />}
              </div>
            </PremiumCard>}
          </div>
        </div>
      </div>
    );
  }

  if (activeWorkspace === "chart-analysis") {
    const enabledIndicatorRows = CHART_INDICATOR_OPTIONS
      .filter((indicator) => Boolean(chartIndicators?.[indicator.id]))
      .map((indicator) => ({
        indicator: indicator.label,
        status: "Enabled",
        params: indicator.id.startsWith("ema") ? `Period: ${indicator.id.replace("ema", "")}` : "Chart-calculated",
        value: "See chart",
        signal: "Not classified",
      }));
    return (
      <div style={page}>
        <div style={mainTwoCol}>
          <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr) 220px", gap: 10, minHeight: 0 }}>
            <PremiumCard theme={theme} style={{ minHeight: 520 }}>{renderChartGrid?.({ layoutMode: "1" })}</PremiumCard>
            <PremiumCard theme={theme} style={{ minHeight: 0, overflow: "hidden" }}>
              <PremiumTabs theme={theme} tabs={["Watchlist", "Indicators", "Alerts", "Notes"]} active="Indicators" />
              <PremiumTable
                theme={theme}
                columns={[{ key: "indicator", label: "Indicator", width: "1.4fr" }, { key: "status", label: "Status", width: "110px", color: () => theme.green }, { key: "params", label: "Parameters", width: "1fr" }, { key: "value", label: "Value", width: "90px", align: "right" }, { key: "signal", label: "Signal", width: "90px", color: () => theme.green }]}
                rows={enabledIndicatorRows}
                emptyMessage="No chart indicators enabled"
                style={{ height: "calc(100% - 40px)" }}
                rowMinHeight={34}
                headerMinHeight={30}
                cellPadding="0 12px"
                columnGap={10}
              />
            </PremiumCard>
          </div>
          <div style={{ display: "grid", gap: 10 }}>{selectedRail(<PremiumCard theme={theme} title="Chart Context"><div style={{ padding: 14, display: "grid", gap: 10, color: theme.muted }}><div><b style={{ color: theme.text }}>Catalyst:</b> {selected.catalyst || "No verified catalyst available"}</div><div><b style={{ color: theme.text }}>Data mode:</b> {selected.dataMode === "provider" ? "Provider data" : "Unavailable"}</div><div><b style={{ color: theme.text }}>Technical classification:</b> Not available from the current data feed</div></div></PremiumCard>)}</div>
        </div>
      </div>
    );
  }

  if (activeWorkspace === "dashboard") {
    return (
      <div
        onWheelCapture={(event) => {
          const target = event.target;
          if (
            target instanceof Element &&
            target.closest("canvas") &&
            Math.abs(event.deltaY) > Math.abs(event.deltaX)
          ) {
            event.preventDefault();
            event.currentTarget.scrollTop += event.deltaY;
          }
        }}
        style={{
          ...page,
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <DashboardMarketIntelligence
          theme={theme}
          viewportWidth={viewportWidth}
          chart={renderChartGrid?.({ layoutMode: "1" })}
          marketIndexes={marketIndexes}
          brokerApiUrl={brokerApiUrl}
          breadthRows={allSymbols}
          scannerGroups={scannerGroups}
          scannerMeta={scannerMeta}
          news={dashboard.newsRows.length ? dashboard.newsRows : headlines}
          newsMeta={newsMeta}
          selected={dashboard.selected}
          watchlist={dashboard.watchlistRows}
          onSelect={(symbol, row) =>
            selectMainSymbol?.(symbol, row || null, "dashboard-intelligence")
          }
          onOpenChart={(symbol) => {
            selectMainSymbol?.(symbol);
            setActiveWorkspace?.("charts");
          }}
          onAddWatch={addSymbolToWatchlist}
        />
      </div>
    );
  }

  const selectedDetailStats = [
    ["Open", dashboard.selected.open],
    ["Day High", dashboard.selected.dayHigh],
    ["Day Low", dashboard.selected.dayLow],
    ["Volume", dashboard.selected.volume],
    ["Avg Vol", dashboard.selected.averageVolume],
    ["Market Cap", dashboard.selected.marketCap],
    ["P/E", dashboard.selected.peRatio],
    ["Dividend", Number(dashboard.selected.dividend) > 0 ? dashboard.selected.dividend : "None reported"],
    [
      "Yield",
      Number.isFinite(Number(dashboard.selected.dividend)) && Number(dashboard.selected.price) > 0
        ? `${((Number(dashboard.selected.dividend) / Number(dashboard.selected.price)) * 100).toFixed(2)}%`
        : "None reported",
    ],
  ];

  const commandCenterMetrics = [
    ["Quotes", dashboard.status?.hasLiveQuotes ? "Live feed" : "Market data pending", dashboard.status?.hasLiveQuotes ? "good" : "warn"],
    ["Scanner", dashboard.status?.hasScannerRows ? `${dashboard.scannerRows.length} rows` : "Fallback context", dashboard.status?.hasScannerRows ? "good" : "warn"],
    ["News", dashboard.status?.hasNews ? `${dashboard.newsRows.length} headlines` : "Provider limited", dashboard.status?.hasNews ? "good" : "warn"],
    ["Account", dashboard.status?.hasAccountData ? "Connected" : "Review-only", dashboard.status?.hasAccountData ? "good" : "neutral"],
  ];
  const topMoverRows = [...dashboard.scannerRows]
    .filter((row) => nullableMoveOf(row) !== null)
    .sort((a, b) => Math.abs(nullableMoveOf(b)) - Math.abs(nullableMoveOf(a)))
    .slice(0, 6);
  const dashboardNewsRows = dashboard.newsRows.length ? dashboard.newsRows : headlines.slice(0, 8);
  const advancingCount = stocks.filter((row) => nullableMoveOf(row) !== null && nullableMoveOf(row) >= 0).length;
  const decliningCount = stocks.filter((row) => nullableMoveOf(row) !== null && nullableMoveOf(row) < 0).length;
  const marketBreadthTotal = Math.max(advancingCount + decliningCount, 1);
  const marketPulseRows = [
    ["Advancing", advancingCount, "good"],
    ["Declining", decliningCount, "bad"],
    ["Watchlist", dashboard.watchlistRows.length, "neutral"],
    ["Alerts", dashboard.alerts?.length || 0, "neutral"],
  ];
  const openDashboardChart = (symbol = dashboard.selected.symbol) => {
    selectMainSymbol?.(symbol);
    setActiveWorkspace?.("charts");
  };

  return (
    <div style={page}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "minmax(0, 1fr) clamp(330px, 22vw, 390px)",
          gridTemplateRows: isNarrowWorkspace ? "auto" : "minmax(500px, 1fr) minmax(168px, 188px) 148px",
          gap: 9,
          height: isNarrowWorkspace ? "auto" : "100%",
          minHeight: isNarrowWorkspace ? 0 : 900,
        }}
      >
        <PremiumCard theme={theme} style={{ gridColumn: isNarrowWorkspace ? "auto" : "1 / 2", gridRow: isNarrowWorkspace ? "auto" : "1 / 2", minHeight: isNarrowWorkspace ? 440 : 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${theme.borderSoft || theme.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: theme.muted, fontSize: 11, fontWeight: 850, textTransform: "uppercase" }}>Market Command Center</div>
              <h2 style={{ margin: "4px 0 0", color: theme.text, fontSize: 22, fontWeight: 900 }}>What deserves attention now</h2>
            </div>
            <ActionButton theme={theme} active onClick={() => openDashboardChart(dashboard.selected.symbol)}>
              Open Chart
            </ActionButton>
          </div>
          <div style={{ padding: 10, display: "grid", gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "repeat(4, minmax(0, 1fr))", gap: 8, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}>
            {commandCenterMetrics.map(([label, value, tone]) => (
              <MetricTile key={label} theme={theme} label={label} value={value} tone={tone} />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "minmax(0, 1.35fr) minmax(280px, 0.65fr)", minHeight: 0 }}>
            <div style={{ minWidth: 0, borderRight: isNarrowWorkspace ? "none" : `1px solid ${theme.borderSoft || theme.border}` }}>
              <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <PremiumTabs theme={theme} tabs={["Top Movers", "Gainers", "Losers", "Active", "Momentum"]} active="Top Movers" />
                <StatusPill theme={theme} tone={dashboard.status?.hasScannerRows ? "good" : "warn"}>
                  {dashboard.status?.hasScannerRows ? "Scanner live" : "Fallback context"}
                </StatusPill>
              </div>
              {dashboardScannerTable(topMoverRows.length ? topMoverRows : dashboard.scannerRows.slice(0, 6), dashboard.selected.symbol)}
            </div>
            <div style={{ padding: 14, display: "grid", gap: 12, alignContent: "start", minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: theme.muted, fontSize: 11, textTransform: "uppercase", fontWeight: 850 }}>Selected Symbol</div>
                  <div style={{ color: theme.text, fontFamily: terminalMonoFont, fontSize: 28, fontWeight: 900, lineHeight: 1.1 }}>{dashboard.selected.symbol}</div>
                  <div style={{ color: theme.muted, fontSize: 12, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dashboard.selected.name || "Market context"}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ color: theme.text, fontFamily: terminalMonoFont, fontSize: 20, fontWeight: 900 }}>{formatPrice(dashboard.selected.price)}</div>
                  <div style={{ color: nullableMoveOf(dashboard.selected) === null ? theme.muted : toneColor(theme, nullableMoveOf(dashboard.selected)), fontFamily: terminalMonoFont, fontSize: 13, fontWeight: 900 }}>
                    {nullableMoveOf(dashboard.selected) === null ? "Pending" : formatPercent(nullableMoveOf(dashboard.selected))}
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {selectedDetailStats.slice(0, 6).map(([label, value]) => (
                  <div key={label} style={{ padding: "9px 10px", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 7, background: theme.panel2, minWidth: 0 }}>
                    <div style={{ color: theme.muted, fontSize: 10, textTransform: "uppercase", fontWeight: 850 }}>{label}</div>
                    <div style={{ color: theme.text, fontFamily: terminalMonoFont, fontSize: 12, fontWeight: 850, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatDetailValue(label, value)}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: 12, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 8, background: "rgba(45,140,255,0.055)" }}>
                <div style={{ color: theme.blue, fontSize: 11, fontWeight: 900, textTransform: "uppercase", marginBottom: 6 }}>Why it matters</div>
                <div style={{ color: theme.text, fontSize: 13, lineHeight: 1.45 }}>
                  {dashboard.selected.catalyst || dashboard.selected.reason || `${dashboard.selected.symbol} is on the dashboard because scanner, watchlist, or headline context flagged it.`}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <ActionButton theme={theme} active onClick={() => openDashboardChart(dashboard.selected.symbol)}>Open Chart</ActionButton>
                <ActionButton theme={theme} onClick={() => prepareReviewAction("Alert review", dashboard.selected.symbol)}>Alert Review</ActionButton>
              </div>
            </div>
          </div>
        </PremiumCard>
        <div
          style={{
            gridColumn: isNarrowWorkspace ? "auto" : "2 / 3",
            gridRow: isNarrowWorkspace ? "auto" : "1 / 4",
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
                { key: "price", label: "Last", width: "76px", align: "right", mono: true, render: (row) => hasNumericValue(row.price) ? formatPrice(row.price) : "Unavailable" },
                { key: "change", label: "Chg%", width: "70px", align: "right", mono: true, color: (row) => nullableMoveOf(row) === null ? theme.muted : toneColor(theme, nullableMoveOf(row)), render: (row) => nullableMoveOf(row) === null ? "Unavailable" : formatPercent(nullableMoveOf(row)) },
                { key: "volume", label: "Vol", width: "64px", align: "right", mono: true, render: (row) => row.volumeLabel || formatCompactNumber(row.volume, 2) },
              ]}
              rows={dashboard.watchlistRows.slice(0, 5)}
              selectedKey={dashboard.selected.symbol}
              onSelect={(row) => selectMainSymbol?.(row.symbol, row, "dashboard-watchlist")}
              rowMinHeight={36}
              headerMinHeight={32}
              cellPadding="0 10px"
              columnGap={8}
            />
          </PremiumCard>
          <PremiumCard theme={theme} title="Market Pulse">
            <div style={{ padding: 12, display: "grid", gap: 10 }}>
              {marketPulseRows.map(([label, value, tone]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <span style={{ color: theme.muted, fontSize: 12 }}>{label}</span>
                  <span style={{ color: tone === "good" ? theme.green : tone === "bad" ? theme.red : theme.text, fontFamily: terminalMonoFont, fontSize: 13, fontWeight: 900 }}>{value}</span>
                </div>
              ))}
              <div style={{ height: 6, borderRadius: 99, background: theme.panel2, overflow: "hidden" }}>
                <div style={{ width: `${Math.round((advancingCount / marketBreadthTotal) * 100)}%`, height: "100%", background: theme.green }} />
              </div>
            </div>
          </PremiumCard>
          <PremiumCard theme={theme} title="AI Brief">
            <div style={{ padding: 14, display: "grid", gap: 10, color: theme.text, fontSize: 13, lineHeight: 1.5 }}>
              <div><b style={{ color: theme.green }}>Focus:</b> {dashboard.selected.symbol} is the active dashboard context.</div>
              <div><b style={{ color: theme.blue }}>Signal:</b> scanner score {dashboard.selected.score || "limited"} with {dashboard.selected.rvolLabel || dashboard.selected.rvol || "context"} RVOL.</div>
              <div><b style={{ color: theme.amber }}>Risk:</b> verify liquidity and data freshness before acting.</div>
            </div>
          </PremiumCard>
        </div>
        <div style={{ gridColumn: isNarrowWorkspace ? "auto" : "1 / 2", gridRow: isNarrowWorkspace ? "auto" : "2 / 4", display: "grid", gridTemplateColumns: isNarrowWorkspace ? "minmax(0, 1fr)" : "minmax(0, 1.45fr) minmax(300px, 0.55fr)", gap: 9, minHeight: 0 }}>
          <PremiumCard theme={theme} style={{ minHeight: 0, overflow: "hidden" }}>
            <div style={{ padding: "11px 14px", borderBottom: `1px solid ${theme.borderSoft || theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, color: theme.text, fontSize: 14, fontWeight: 900, textTransform: "uppercase" }}>Catalyst Feed</h2>
                <div style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>{dashboard.selected.symbol} / backend feed / {dashboardNewsRows.length} rows</div>
              </div>
              <StatusPill theme={theme} tone={dashboard.status?.hasNews ? "good" : "warn"}>{dashboard.status?.hasNews ? "News live" : "Provider limited"}</StatusPill>
            </div>
            <div style={{ maxHeight: isNarrowWorkspace ? 340 : 260, overflow: "auto" }}>
              {dashboardNewsRows.slice(0, 8).map((item, index) => {
                const ticker = item.relatedTicker || item.symbol || dashboard.selected.symbol;
                const row = (
                  <div style={{ display: "grid", gridTemplateColumns: isNarrowWorkspace ? "64px minmax(0, 1fr)" : "76px 130px minmax(0, 1fr) 66px", gap: 12, alignItems: "center", minHeight: 44, padding: "8px 14px", borderBottom: `1px solid ${theme.borderSoft || theme.border}`, background: index % 2 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                    <span style={{ color: theme.muted, fontFamily: terminalMonoFont, fontSize: 11 }}>{item.time || "Recent"}</span>
                    {!isNarrowWorkspace && <span style={{ color: theme.muted, fontSize: 11 }}>{item.source || "Market News"}</span>}
                    <span style={{ color: theme.text, fontSize: 13, lineHeight: 1.35, fontWeight: 760, minWidth: 0 }}>{item.headline}</span>
                    {!isNarrowWorkspace && <span style={{ color: theme.blue, fontFamily: terminalMonoFont, fontSize: 11, fontWeight: 900, textAlign: "right" }}>{ticker}</span>}
                  </div>
                );
                return item.url ? (
                  <a key={item.id || `${ticker}-${index}`} href={item.url} target="_blank" rel="noreferrer" onClick={() => selectMainSymbol?.(ticker)} style={{ display: "block", textDecoration: "none", outlineOffset: 3 }}>{row}</a>
                ) : (
                  <button key={item.id || `${ticker}-${index}`} type="button" onClick={() => selectMainSymbol?.(ticker)} style={{ width: "100%", padding: 0, border: 0, background: "transparent", textAlign: "left", cursor: "pointer" }}>{row}</button>
                );
              })}
            </div>
          </PremiumCard>
          <PremiumCard theme={theme} title="Risk / Status" style={{ minHeight: 0, overflow: "hidden" }}>
            <div style={{ height: "calc(100% - 40px)", boxSizing: "border-box", padding: 12, display: "grid", gap: 9, overflow: "auto" }}>
              {dashboard.riskOverview.slice(0, 4).map((row) => (
                <div key={row.label} style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, color: theme.text, fontSize: 12 }}>
                    <span>{row.label}</span>
                    <span style={{ color: row.tone === "good" ? theme.green : row.tone === "warn" ? theme.amber : theme.text, fontFamily: terminalMonoFont }}>{row.value}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 99, background: theme.panel2 }}>
                    <div style={{ width: `${row.percent}%`, height: "100%", borderRadius: 99, background: row.tone === "warn" ? theme.amber : theme.green }} />
                  </div>
                </div>
              ))}
              <div style={{ padding: 10, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 7, color: theme.muted, fontSize: 12, lineHeight: 1.4 }}>Dashboard is informational. Order and broker actions remain review-only from this workspace.</div>
            </div>
          </PremiumCard>
        </div>
      </div>
    </div>
  );
}
