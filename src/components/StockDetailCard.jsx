import { useMemo } from "react";

const monoFont = '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace';
const sansFont = '"Roboto", Arial, sans-serif';

const tickerProfiles = {
  AAPL: {
    basePrice: 214,
    beta: 1.18,
    catalysts: ["Services revenue acceleration", "Product launch cycle gaining traction", "Analyst target raised after channel checks"],
    sector: "Consumer Technology",
  },
  AMD: {
    basePrice: 168,
    beta: 1.72,
    catalysts: ["AI accelerator demand update", "Data center revenue momentum", "Upgrade to Buy on margin recovery"],
    sector: "Semiconductors",
  },
  MSFT: {
    basePrice: 432,
    beta: 0.94,
    catalysts: ["Azure AI workload growth", "Enterprise cloud demand remains firm", "Copilot adoption note from analysts"],
    sector: "Cloud Software",
  },
  NVDA: {
    basePrice: 211,
    beta: 1.65,
    catalysts: ["AI chip demand ahead of earnings", "Analyst upgrade on data center demand", "Large cloud customer order chatter"],
    sector: "AI Semiconductors",
  },
  TSLA: {
    basePrice: 251,
    beta: 2.08,
    catalysts: ["Delivery data due this week", "EV margin commentary in focus", "China sales tracker shows improving demand"],
    sector: "Electric Vehicles",
  },
};

const fallbackCatalysts = [
  "Relative strength versus sector peers",
  "Unusual call flow and expanding tape activity",
  "Institutional volume building above baseline",
  "Fresh momentum scan signal after opening range break",
  "News-driven watchlist activity with elevated participation",
];

function seededHash(value) {
  return String(value || "STOCK")
    .toUpperCase()
    .split("")
    .reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 1000003, 17);
}

function seededRange(seed, index, min, max) {
  const raw = Math.sin(seed * (index + 3.17)) * 10000;
  const fraction = raw - Math.floor(raw);
  return min + fraction * (max - min);
}

function parseNumber(...values) {
  for (const value of values) {
    const cleanValue = String(value ?? "")
      .replace(/[$,%x]/gi, "")
      .replace(/,/g, "")
      .trim();
    const parsed = Number.parseFloat(cleanValue);

    if (Number.isFinite(parsed) && parsed !== 0) return parsed;
  }

  return null;
}

function parseVolume(value) {
  const rawValue = String(value || "").replace(/,/g, "").trim().toUpperCase();
  const parsed = Number.parseFloat(rawValue);

  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  if (rawValue.includes("B")) return parsed * 1_000_000_000;
  if (rawValue.includes("M")) return parsed * 1_000_000;
  if (rawValue.includes("K")) return parsed * 1_000;

  return parsed;
}

function formatVolume(value) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;

  return String(Math.max(1, Math.round(value)));
}

function formatMoney(value) {
  return `$${Number(value).toFixed(2)}`;
}

function nonZeroPercent(value, fallback) {
  const parsed = Number(value);
  const nextValue = Number.isFinite(parsed) && Math.abs(parsed) >= 0.05 ? parsed : fallback;

  return Number(nextValue.toFixed(2));
}

function buildStockDetailData(ticker, source = {}) {
  const symbol = String(ticker || source.symbol || "AAPL").trim().toUpperCase() || "AAPL";
  const seed = seededHash(symbol);
  const profile = tickerProfiles[symbol] || {
    basePrice: seededRange(seed, 1, 18, 420),
    beta: seededRange(seed, 2, 0.82, 2.15),
    catalysts: fallbackCatalysts,
    sector: "Active Equity",
  };
  const currentPrice = Number(
    (parseNumber(source.currentPrice, source.price, source.last) || seededRange(seed, 3, profile.basePrice * 0.96, profile.basePrice * 1.04)).toFixed(2)
  );
  const changePercent = nonZeroPercent(
    parseNumber(source.changePercent, source.change),
    seededRange(seed, 4, -2.85, 3.65)
  );
  const previousClose = Number((currentPrice / (1 + changePercent / 100)).toFixed(2));
  const openDrift = seededRange(seed, 5, -1.8, 2.2);
  const intradayMovePercent = nonZeroPercent(
    parseNumber(source.intradayMovePercent, source.movePercent),
    openDrift
  );
  const openPrice = currentPrice / (1 + intradayMovePercent / 100);
  const gapPercent = nonZeroPercent(
    parseNumber(source.gapPercent, source.gap),
    ((openPrice - previousClose) / previousClose) * 100 || seededRange(seed, 6, -1.7, 2.4)
  );
  const rawVolume =
    parseVolume(source.volume) ||
    Math.round(seededRange(seed, 7, 1_850_000, symbol.length <= 4 ? 68_000_000 : 19_500_000));
  const relativeVolume = Number(
    Math.max(0.72, parseNumber(source.relativeVolume, source.rvol) || seededRange(seed, 8, 0.82, 3.75)).toFixed(2)
  );
  const volumePercentOfAvg = Number(
    Math.max(34.5, parseNumber(source.volumePercentOfAvg) || relativeVolume * 100).toFixed(1)
  );
  const rangeSpread = Math.max(currentPrice * seededRange(seed, 9, 0.012, 0.045), 0.28);
  const rangeLow = Number(Math.min(openPrice, currentPrice - rangeSpread * 0.45).toFixed(2));
  const rangeHigh = Number(Math.max(currentPrice, openPrice + rangeSpread * 0.55).toFixed(2));
  const volatilityValue = Number(
    Math.max(0.18, parseNumber(source.atr, source.volatilityValue) || currentPrice * seededRange(seed, 10, 0.009, 0.031)).toFixed(2)
  );
  const catalystOptions = profile.catalysts.length ? profile.catalysts : fallbackCatalysts;
  const catalyst =
    String(source.catalyst || source.news || source.reason || catalystOptions[Math.floor(seededRange(seed, 11, 0, catalystOptions.length))] || fallbackCatalysts[0]).trim();
  const suppliedScore = parseNumber(source.score10, source.score);
  const riskScore =
    Math.abs(changePercent) * 0.9 +
    Math.abs(gapPercent) * 0.7 +
    relativeVolume * 1.2 +
    profile.beta;
  const score = suppliedScore
    ? Math.min(10, Math.max(1, Math.round(suppliedScore > 10 ? suppliedScore / 10 : suppliedScore)))
    : Math.min(10, Math.max(1, Math.round(riskScore)));
  const watchStatus = Boolean(source.watchStatus || source.watched);
  const whyMoving = String(
    source.whyMoving ||
      `${symbol} is active because price movement, relative volume, and session range are visible in the scanner data.`
  ).trim();

  return {
    ticker: symbol,
    currentPrice,
    changePercent,
    volume: rawVolume,
    formattedVolume: formatVolume(rawVolume),
    volumePercentOfAvg,
    intradayMovePercent,
    score,
    gapPercent,
    relativeVolume,
    intradayRangeLow: Math.min(rangeLow, rangeHigh - 0.01),
    intradayRangeHigh: Math.max(rangeHigh, rangeLow + 0.01),
    volatilityMetric: `ATR ${formatMoney(volatilityValue)}`,
    catalyst: catalyst || fallbackCatalysts[0],
    whyMoving,
    watchStatus,
    sector: profile.sector,
    riskLabel: riskScore >= 8 ? "High" : riskScore >= 5 ? "Elevated" : "Controlled",
    sourceType: source.sourceType || "Market Context",
    sourceConfidence: source.sourceConfidence || "Limited",
    sourceLabel: source.sourceLabel || source.source || "Scanner",
  };
}

export default function StockDetailCard({
  ticker,
  stock,
  theme,
  watchStatus = false,
  onOpenChart,
  onToggleWatch,
}) {
  const data = useMemo(
    () => buildStockDetailData(ticker, { ...stock, watchStatus }),
    [stock, ticker, watchStatus]
  );
  const palette = {
    bg: theme?.bg || "#05070d",
    panel: theme?.panel || "#0d121c",
    panel2: theme?.panel2 || "#111827",
    border: theme?.border || "#263142",
    text: theme?.text || "#e7ecf3",
    muted: theme?.muted || "#8a95a8",
    blue: theme?.blue || "#2d8cff",
    cyan: theme?.cyan || "#19c6d8",
    green: theme?.green || "#00c896",
    red: theme?.red || "#ef5350",
    amber: theme?.amber || "#f5b84b",
  };
  const positive = data.changePercent > 0;
  const riskColor =
    data.riskLabel === "High" ? palette.red : data.riskLabel === "Elevated" ? palette.amber : palette.green;
  const sourceConfidenceColor =
    data.sourceConfidence === "High" ? palette.green : data.sourceConfidence === "Medium" ? palette.amber : palette.red;
  const keyDrivers = [
    Math.abs(data.intradayMovePercent) >= 0.05
      ? `${data.intradayMovePercent > 0 ? "Up" : "Down"} ${Math.abs(data.intradayMovePercent).toFixed(2)}% intraday`
      : null,
    Math.abs(data.gapPercent) >= 0.05
      ? `${data.gapPercent > 0 ? "Positive" : "Negative"} ${Math.abs(data.gapPercent).toFixed(2)}% gap`
      : null,
    data.relativeVolume >= 1.2 ? `${data.relativeVolume.toFixed(2)}x RVOL` : "Normal RVOL",
    `${data.formattedVolume} volume`,
  ].filter(Boolean);
  const metricStyle = {
    background: "rgba(255,255,255,0.018)",
    border: `1px solid ${theme?.borderSoft || palette.border}`,
    borderRadius: "5px",
    padding: "8px 9px",
    minWidth: 0,
  };
  const monoStyle = {
    fontFamily: monoFont,
    fontVariantNumeric: "tabular-nums",
  };

  function metric(label, value, color = palette.text, compact = false) {
    return (
      <div className="rounded-md border p-2" style={metricStyle}>
        <div style={{ color: palette.muted, fontSize: "9px", fontWeight: 850, textTransform: "uppercase", letterSpacing: 0 }}>
          {label}
        </div>
        <div
          style={{
            marginTop: "3px",
            color,
            fontSize: compact ? "10.5px" : "12px",
            fontWeight: 700,
            ...monoStyle,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: compact ? "normal" : "nowrap",
            lineHeight: compact ? 1.3 : 1.1,
          }}
        >
          {value}
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid gap-2 rounded-lg border p-3"
      style={{
        background: `linear-gradient(180deg, ${palette.panel2}, ${palette.panel})`,
        border: `1px solid ${palette.border}`,
        borderRadius: "8px",
        padding: "10px",
        display: "grid",
        gap: "9px",
        color: palette.text,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        fontFamily: sansFont,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
            <div style={{ ...monoStyle, color: palette.text, fontSize: "17px", lineHeight: 1, fontWeight: 700 }}>
              {data.ticker}
            </div>
            <span
              style={{
                border: `1px solid ${palette.border}`,
                color: palette.cyan,
                background: "rgba(25,198,216,0.1)",
                borderRadius: "999px",
                padding: "2px 6px",
                fontSize: "9px",
                fontWeight: 950,
              }}
            >
              {data.watchStatus ? "WATCHING" : "SCAN"}
            </span>
            <span
              title={`${data.sourceType} / ${data.sourceLabel}`}
              style={{
                border: `1px solid ${sourceConfidenceColor}55`,
                color: sourceConfidenceColor,
                background: `${sourceConfidenceColor}12`,
                borderRadius: "999px",
                padding: "2px 6px",
                fontSize: "9px",
                fontWeight: 950,
              }}
            >
              {data.sourceConfidence}
            </span>
          </div>
          <div style={{ marginTop: "5px", color: palette.muted, fontSize: "10.5px", fontWeight: 750 }}>
            {data.sector} detail
          </div>
        </div>
        <div style={{ textAlign: "right", minWidth: "78px" }}>
          <div style={{ ...monoStyle, color: palette.text, fontSize: "15px", lineHeight: 1, fontWeight: 700 }}>
            {formatMoney(data.currentPrice)}
          </div>
          <div
            style={{
              display: "inline-block",
              marginTop: "4px",
              padding: "2px 6px",
              borderRadius: "5px",
              color: positive ? palette.green : palette.red,
              background: positive ? "rgba(0,200,150,0.12)" : "rgba(239,83,80,0.12)",
              fontSize: "11px",
              fontWeight: 700,
              ...monoStyle,
            }}
          >
            {positive ? "+" : ""}
            {data.changePercent.toFixed(2)}%
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px" }}>
        {metric("Volume", data.formattedVolume)}
        {metric("RVOL", `${data.relativeVolume.toFixed(2)}x`, data.relativeVolume >= 1.5 ? palette.green : palette.text)}
        {metric("Score", `${data.score}/10`, palette.blue)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px" }}>
        {metric("Move", `${data.intradayMovePercent > 0 ? "+" : ""}${data.intradayMovePercent.toFixed(2)}%`, data.intradayMovePercent > 0 ? palette.green : palette.red)}
        {metric("Gap", `${data.gapPercent > 0 ? "+" : ""}${data.gapPercent.toFixed(2)}%`, data.gapPercent > 0 ? palette.green : palette.red)}
        {metric("Range", `${data.intradayRangeLow.toFixed(2)}-${data.intradayRangeHigh.toFixed(2)}`, palette.text, true)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px" }}>
        {metric("Avg Vol", `${data.volumePercentOfAvg.toFixed(1)}%`)}
        {metric("Volatility", data.volatilityMetric, palette.cyan)}
        {metric("Risk", data.riskLabel, riskColor)}
      </div>

      <div
        style={{
          background: "rgba(7,18,29,0.62)",
          border: `1px solid ${theme?.borderSoft || palette.border}`,
          borderRadius: "6px",
          padding: "9px",
          fontSize: "11px",
          lineHeight: 1.45,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
          <b style={{ color: palette.text, fontSize: "10px", fontWeight: 950, textTransform: "uppercase" }}>
            Signal Brief
          </b>
          <span style={{ ...monoStyle, color: riskColor, fontSize: "10px", fontWeight: 800 }}>
            Risk {data.riskLabel}
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "8px" }}>
          {keyDrivers.slice(0, 4).map((driver) => (
            <span
              key={driver}
              style={{
                ...monoStyle,
                color: palette.text,
                background: "rgba(255,255,255,0.035)",
                border: `1px solid ${theme?.borderSoft || palette.border}`,
                borderRadius: "999px",
                padding: "3px 6px",
                fontSize: "9px",
                fontWeight: 800,
              }}
            >
              {driver}
            </span>
          ))}
        </div>
        <div style={{ display: "grid", gap: "7px", marginTop: "8px" }}>
          <div>
            <div style={{ color: palette.blue, fontSize: "9px", fontWeight: 900, textTransform: "uppercase" }}>
              Catalyst
            </div>
            <div style={{ marginTop: "3px", color: palette.text }}>{data.catalyst}</div>
          </div>
          <div>
            <div style={{ color: palette.green, fontSize: "9px", fontWeight: 900, textTransform: "uppercase" }}>
              Observed Drivers
            </div>
            <div style={{ marginTop: "3px", color: palette.muted }}>{data.whyMoving}</div>
          </div>
          <div style={{ color: palette.muted, fontSize: "9.5px" }}>
            Source: <span style={{ color: sourceConfidenceColor, ...monoStyle }}>{data.sourceType}</span>. Treat limited signals as context until a real article, quote, and tape confirmation line up.
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px" }}>
        <button
          type="button"
          onClick={() => onOpenChart?.(data.ticker, data)}
          style={{
            height: "31px",
            borderRadius: "5px",
            border: "none",
            background: palette.blue,
            color: "#fff",
            cursor: "pointer",
            fontSize: "10px",
            fontWeight: 950,
          }}
        >
          Open Chart
        </button>
        <button
          type="button"
          onClick={() => onToggleWatch?.(data.ticker, data)}
          style={{
            height: "31px",
            borderRadius: "5px",
            border: `1px solid ${palette.border}`,
            background: data.watchStatus ? "rgba(0,200,150,0.13)" : palette.panel,
            color: data.watchStatus ? palette.green : palette.text,
            cursor: "pointer",
            fontSize: "10px",
            fontWeight: 950,
          }}
        >
          {data.watchStatus ? "Watching" : "Watch"}
        </button>
      </div>
    </div>
  );
}
