import { Lock, MoreVertical, Search, Star } from "lucide-react";

import { Component } from "react";
import { terminalMonoFont, terminalSansFont } from "../../config/terminalConfig";
import { captureRuntimeDiagnostic } from "../../services/runtimeDiagnostics";
import {
  PLAN_LABELS,
  WORKSPACE_FEATURES,
  getFeatureMinPlan,
  normalizePlan,
} from "../../services/entitlements";
import {
  formatDetailValue,
  hasNumericValue,
  nullableMoveOf,
  num,
  pct,
  toneColor,
} from "./premiumWorkspaceData";

export function SeriesSparkline({ theme, values = [], height = 240 }) {
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

class CardContentErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    captureRuntimeDiagnostic({
      type: "render",
      error,
      message: "Terminal panel render failed",
      stack: `${error?.stack || ""}\n${info?.componentStack || ""}`,
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { theme } = this.props;
    return (
      <div role="alert" style={{ minHeight: 96, display: "grid", placeItems: "center", gap: 8, padding: 16, color: theme.muted, textAlign: "center" }}>
        <span>This panel is temporarily unavailable.</span>
        <button type="button" onClick={() => this.setState({ failed: false })} style={{ minHeight: 30, padding: "0 12px", border: `1px solid ${theme.border}`, borderRadius: 5, background: theme.panel2, color: theme.text, cursor: "pointer" }}>
          Retry panel
        </button>
      </div>
    );
  }
}

export function PremiumCard({ theme, children, style = {}, title, action }) {
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
      <CardContentErrorBoundary theme={theme}>{children}</CardContentErrorBoundary>
    </section>
  );
}

export function LockedWorkspace({ theme, activeWorkspace, entitlements, status }) {
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

export function PremiumTabs({ theme, tabs, active, onChange }) {
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

export function StatusPill({ theme, children, tone = "neutral" }) {
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

export function ActionButton({ theme, children, active = false, danger = false, good = false, disabled = false, style = {}, ...props }) {
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

export function FilterBar({ theme, items = [], search = "Search...", value = "", onSearchChange }) {
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

export function PremiumTable({ theme, columns, rows = [], selectedKey, onSelect, keyField = "symbol", style = {}, rowMinHeight = 42, headerMinHeight = 36, cellPadding = "0 14px", columnGap = 12, emptyMessage = "No records available" }) {
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

export function MetricTile({ theme, label, value, tone = "neutral", detail }) {
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

export function SectionTitle({ theme, title, subtitle, action }) {
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

export function EmptyWorkspace({ theme, title, detail, action }) {
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

export function SymbolBadge({ theme, symbol }) {
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

export function DetailRail({ theme, selected, children, title = "Selected Symbol", actions, compact = false, detailStats }) {
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
