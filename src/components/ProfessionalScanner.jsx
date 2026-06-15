import { useState } from "react";
import StockDetailCard from "./StockDetailCard";
import { getCleanProviderMessage } from "../utils/healthStatus";

const monoFont = '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace';

export default function ProfessionalScanner({
  theme,
  scannerTab,
  setScannerTab,
  scannerStocks = [],
  scannerMeta = {},
  selectMainSymbol,
  selectedScannerStock,
  addSymbolToWatchlist,
}) {
  const tabs = ["Gainers", "Losers", "Active", "Momentum", "Relative Volume", "AI Movers"];
  const [scannerQuery, setScannerQuery] = useState("");
  const [minMove, setMinMove] = useState("0");
  const [minVolume, setMinVolume] = useState("0");
  const [priceBand, setPriceBand] = useState("Any");
  const [minRvol, setMinRvol] = useState("0");
  const [riskFilter, setRiskFilter] = useState("Any");
  const [renderedAt] = useState(() => Date.now());
  const monoStyle = {
    fontFamily: monoFont,
    fontVariantNumeric: "tabular-nums",
  };

  function parseSignedMove(stock) {
    return parseFloat(String(stock.changePercent ?? stock.change ?? "0").replace("%", "")) || 0;
  }

  function parseVolume(stock) {
    const volumeRaw = String(stock.volume || "0").replace(/,/g, "").toUpperCase();
    const parsed = parseFloat(volumeRaw) || 0;

    if (volumeRaw.includes("B")) return parsed * 1_000_000_000;
    if (volumeRaw.includes("M")) return parsed * 1_000_000;
    if (volumeRaw.includes("K")) return parsed * 1_000;

    return parsed;
  }

  function parseNumericField(...values) {
    for (const value of values) {
      const cleanValue = String(value ?? "").replace(/[$,%x]/gi, "").replace(/,/g, "").trim();
      const parsed = parseFloat(cleanValue);

      if (Number.isFinite(parsed) && parsed !== 0) return parsed;
    }

    return 0;
  }

  function normalizePercent(value, fallback) {
    const parsed = parseNumericField(value);

    if (Math.abs(parsed) >= 0.05) return parsed;

    return Math.abs(fallback) >= 0.05 ? fallback : 0.35;
  }

  function formatCompactNumber(value) {
    const number = Number(value || 0);

    if (number >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(1)}B`;
    if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
    if (number >= 1_000) return `${(number / 1_000).toFixed(1)}K`;

    return String(Math.max(1, Math.round(number)));
  }

  function formatFreshness(value) {
    const parsed = value ? new Date(value).getTime() : 0;

    if (!parsed || Number.isNaN(parsed)) return "sync pending";

    const ageMs = Math.max(0, renderedAt - parsed);

    if (ageMs < 60_000) return "live";
    if (ageMs < 3_600_000) return `${Math.round(ageMs / 60_000)}m ago`;

    return `${Math.round(ageMs / 3_600_000)}h ago`;
  }

  function formatCacheAge(value) {
    const ageMs = Number(value || 0);

    if (!Number.isFinite(ageMs) || ageMs <= 0) return null;
    if (ageMs < 60_000) return `${Math.round(ageMs / 1000)}s cache`;
    if (ageMs < 3_600_000) return `${Math.round(ageMs / 60_000)}m cache`;

    return `${Math.round(ageMs / 3_600_000)}h cache`;
  }

  function getFloatEstimate(stock, volume, move) {
    const suppliedFloat = parseNumericField(
      stock.float,
      stock.sharesFloat,
      stock.freeFloat,
      stock.floatShares
    );

    if (suppliedFloat) return suppliedFloat;

    const marketCap = parseNumericField(stock.marketCap, stock.mktCap);
    const price = parseNumericField(stock.price);

    if (marketCap && price) return marketCap / price;
    if (!volume) return 0;
    if (move >= 10) return volume * 1.7;
    if (move >= 5) return volume * 2.6;
    if (move >= 2) return volume * 4.2;

    return volume * 7.5;
  }

  function getFloatBucket(floatValue) {
    if (!floatValue) return "Active Float";
    if (floatValue <= 20_000_000) return "Low Float";
    if (floatValue <= 75_000_000) return "Mid Float";
    if (floatValue <= 300_000_000) return "Liquid";
    return "Mega Float";
  }

  function getPriceRange(price) {
    if (!price) return "Active Range";
    if (price < 5) return "Sub $5";
    if (price < 20) return "$5-$20";
    if (price < 100) return "$20-$100";
    return "Large Cap";
  }

  function getRiskProfile({ move, relativeVolume, floatValue, price }) {
    const lowFloat = floatValue > 0 && floatValue <= 25_000_000;
    const cheapMomentum = price > 0 && price < 5 && move >= 5;

    if ((move >= 12 && relativeVolume >= 4) || (lowFloat && move >= 7) || cheapMomentum) {
      return { label: "High", color: theme.red };
    }

    if (move >= 5 || relativeVolume >= 2 || lowFloat) {
      return { label: "Elevated", color: theme.amber };
    }

    return { label: "Controlled", color: theme.green };
  }

  function getRowSourceType(stock) {
    const source = String(stock.source || stock.provider || stock.catalystType || "").toLowerCase();

    if (stock.fallback || stock.degraded || source.includes("fallback") || source.includes("local")) return "Context";
    if (source.includes("fmp") || source.includes("yahoo") || source.includes("questrade") || source.includes("scanner")) return "Provider";

    return "Ranked";
  }

  function cleanWhyText(text, symbol) {
    return String(text || "")
      .replace(new RegExp(`^${symbol}\\s+ranks\\s+because\\s+of\\s+`, "i"), `${symbol} is active on `)
      .replace(new RegExp(`^${symbol}\\s+ranks\\s+because\\s+`, "i"), `${symbol} is active because `)
      .replace(/\s+/g, " ")
      .trim();
  }

  function getCatalystProfile(stock, move, relativeVolume, volume, gap) {
    const suppliedCatalyst = String(stock.catalyst || stock.news || stock.reason || stock.headline || "").trim();

    if (suppliedCatalyst) {
      return {
        label: stock.catalystType || "Catalyst",
        text: suppliedCatalyst,
      };
    }

    if (move >= 8 && relativeVolume >= 3) {
      return {
        label: "Momentum",
        text: `${stock.symbol} is moving on confirmed momentum and elevated relative volume.`,
      };
    }

    if (Math.abs(gap) >= 2 && relativeVolume >= 1.5) {
      return {
        label: "Gap",
        text: `${stock.symbol} is holding a notable session gap with above-baseline participation.`,
      };
    }

    if (move >= 3 && volume >= 1_000_000) {
      return {
        label: "Volume",
        text: `${stock.symbol} is moving on institutional-level tape activity.`,
      };
    }

    if (relativeVolume >= 2) {
      return {
        label: "RVOL",
        text: `${stock.symbol} is showing above-normal participation versus its baseline.`,
      };
    }

    return {
      label: "Watch",
      text: `${stock.symbol} is on watch after a measurable scanner signal.`,
    };
  }

  function getWhyMoving(stock, analysis) {
    if (stock.whyMoving) return stock.whyMoving;

    const drivers = [];

    if (analysis.move >= 5) drivers.push(`${analysis.signedMove > 0 ? "up" : "down"} ${analysis.move.toFixed(1)}% intraday`);
    if (Math.abs(analysis.gap) >= 1) drivers.push(`${analysis.gap > 0 ? "positive" : "negative"} ${Math.abs(analysis.gap).toFixed(1)}% gap`);
    if (analysis.relativeVolume >= 1.5) drivers.push(`${analysis.relativeVolume.toFixed(1)}x relative volume`);
    if (analysis.volume >= 1_000_000) drivers.push(`${formatCompactNumber(analysis.volume)} shares traded`);
    if (analysis.floatBucket === "Low Float") drivers.push("low-float profile");

    if (drivers.length) {
      return `${stock.symbol} is active on ${drivers.slice(0, 3).join(", ")}.`;
    }

    return `${stock.symbol} is on watch from a balanced scanner profile with valid price, volume, and movement data.`;
  }

  function analyzeStock(stock) {
    const signedMove = normalizePercent(stock.intradayMovePercent ?? stock.changePercent ?? stock.change, parseSignedMove(stock));
    const move = Math.abs(signedMove);
    const volume = parseVolume(stock);
    const avgVolume = parseNumericField(stock.avgVolume, stock.averageVolume, stock.volumeAvg);
    const price = parseNumericField(stock.price);
    const previousClose = parseNumericField(stock.previousClose, stock.prevClose, stock.open);
    const gap = normalizePercent(
      stock.gapPercent ?? stock.gap,
      previousClose && price ? ((price - previousClose) / previousClose) * 100 : signedMove * 0.38
    );
    const floatValue = getFloatEstimate(stock, volume, move);
    const relativeVolume = Math.max(
      0.72,
      parseNumericField(stock.relativeVolume, stock.rvol) ||
        (avgVolume ? volume / avgVolume : floatValue ? volume / Math.max(floatValue / 8, 1) : volume / 12_000_000 || 1.08)
    );
    const backendRisk = stock.riskLabel
      ? {
          label: stock.riskLabel,
          color: stock.riskLabel === "High" ? theme.red : stock.riskLabel === "Elevated" ? theme.amber : theme.green,
        }
      : null;
    const risk = backendRisk || getRiskProfile({ move, relativeVolume, floatValue, price });
    const catalyst = getCatalystProfile(stock, move, relativeVolume, volume, gap);
    const backendScore = Number(stock.scannerScore || 0);
    const calculatedScore = Math.min(
      99,
      Math.max(
        1,
        move * 4.8 +
          Math.min(relativeVolume, 8) * 6.5 +
          Math.min(volume / 1_000_000, 20) * 0.9 +
          Math.abs(gap) * 1.2 +
          (["Catalyst", "News"].includes(catalyst.label) ? 8 : 0) -
          (risk.label === "High" ? 4 : 0)
      )
    );
    const rankScore = backendScore > 0 ? Math.min(99, backendScore) : calculatedScore;
    const floatBucket = stock.floatBucket || getFloatBucket(floatValue);
    const analysis = {
      signedMove,
      move,
      volume,
      avgVolume,
      price,
      gap,
      floatValue,
      floatBucket,
      priceRange: stock.priceRange || getPriceRange(price),
      relativeVolume,
      risk,
      catalyst,
      score: rankScore.toFixed(1),
      score10: Math.min(10, Math.max(1, Math.round(rankScore / 10))),
      rankScore,
      tags: [
        move >= 5 ? "Momentum" : null,
        Math.abs(gap) >= 2 ? "Gap" : null,
        relativeVolume >= 2 ? "RVOL" : null,
        floatBucket === "Low Float" ? "Low Float" : null,
        ["Catalyst", "News"].includes(catalyst.label) ? "Catalyst" : null,
      ].filter(Boolean),
    };

    return {
      ...analysis,
      whyMoving: getWhyMoving(stock, analysis),
    };
  }

  const query = scannerQuery.trim().toUpperCase();
  const moveFloor = Number(minMove);
  const volumeFloor = Number(minVolume);
  const rvolFloor = Number(minRvol);
  const [priceFloor, priceCeiling] =
    priceBand === "Sub5"
      ? [0.01, 5]
      : priceBand === "FiveToTwenty"
      ? [5, 20]
      : priceBand === "TwentyToHundred"
      ? [20, 100]
      : priceBand === "HundredPlus"
      ? [100, Infinity]
      : [0.01, Infinity];
  const analyzedStocks = scannerStocks
    .filter((stock) => stock?.symbol && parseNumericField(stock.price) > 0)
    .map((stock) => ({
      stock,
      analysis: analyzeStock(stock),
    }))
    .filter(({ stock, analysis }) => {
      if (query && !String(stock.symbol || "").includes(query)) return false;
      if (moveFloor && analysis.move < moveFloor) return false;
      if (volumeFloor && analysis.volume < volumeFloor) return false;
      if (rvolFloor && analysis.relativeVolume < rvolFloor) return false;
      if (analysis.price < priceFloor || analysis.price > priceCeiling) return false;
      if (riskFilter !== "Any" && analysis.risk.label !== riskFilter) return false;

      return true;
    })
    .sort((a, b) => b.analysis.rankScore - a.analysis.rankScore);
  const providerRowCount = analyzedStocks.filter(({ stock }) => getRowSourceType(stock) !== "Context").length;
  const contextRowCount = analyzedStocks.length - providerRowCount;

  function pickStock(stock) {
    selectMainSymbol(stock.symbol, stock);
  }

  const detailPair =
    analyzedStocks.find(({ stock }) => stock.symbol === selectedScannerStock?.symbol) ||
    analyzedStocks[0] ||
    null;
  const detailStock = detailPair?.stock || selectedScannerStock || null;
  const detailAnalysis = detailPair?.analysis || (detailStock ? analyzeStock(detailStock) : null);
  const rawSourceLabel = scannerMeta.provider || scannerMeta.source || detailStock?.source || "Scanner engine";
  const degraded = Boolean(scannerMeta.degraded || scannerMeta.fallback || detailStock?.degraded);
  const freshness = formatFreshness(scannerMeta.updatedAt || scannerMeta.lastSuccessAt);
  const cacheAge = formatCacheAge(scannerMeta.cacheAgeMs);
  const warnings = Array.isArray(scannerMeta.warnings)
    ? scannerMeta.warnings.filter(Boolean)
    : scannerMeta.lastWarning
      ? [scannerMeta.lastWarning]
      : [];
  const userWarnings = Array.isArray(scannerMeta.userWarnings) ? scannerMeta.userWarnings.filter(Boolean) : [];
  const scannerVisibleWarning = getCleanProviderMessage(
    scannerMeta.userMessage || userWarnings[0] || warnings[0],
    "Provider limited. Cached/fallback data active."
  );
  const providerLimited = Boolean(scannerMeta.providerStatus?.providerLimited) ||
    (degraded && warnings.some((warning) =>
      /429|rate|limit|fmp|restricted|subscription/i.test(String(warning))
    ));
  const normalizedSource = String(rawSourceLabel || "").toUpperCase();
  const sourceLabel = scannerMeta.statusLabel
    ? scannerMeta.statusLabel
    : providerLimited
    ? "SCANNER PROVIDER LIMITED"
    : degraded && normalizedSource.includes("LOCAL")
      ? "SCANNER FALLBACK"
      : degraded && normalizedSource.includes("FALLBACK")
        ? "SCANNER FALLBACK"
        : scannerMeta.cached
          ? "SCANNER CACHED"
          : normalizedSource.includes("FMP")
            ? "SCANNER LIVE"
            : degraded
              ? "SCANNER FALLBACK"
              : rawSourceLabel;
  const statusDetail = [
    sourceLabel,
    freshness,
    cacheAge,
    scannerMeta.counts?.movers ? `${scannerMeta.counts.movers} ranked` : null,
  ].filter(Boolean).join(" / ");
  const filterControlStyle = {
    height: "28px",
    minWidth: 0,
    background: theme.panel,
    border: `1px solid ${theme.borderSoft || theme.border}`,
    color: theme.text,
    borderRadius: "4px",
    fontSize: "10px",
    fontWeight: 850,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
  };
  const scannerGridStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(54px, 1fr) minmax(54px, 0.72fr) minmax(58px, 0.78fr) minmax(42px, 0.52fr) minmax(42px, 0.5fr) minmax(62px, 0.68fr)",
    gap: "6px",
    alignItems: "center",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "8px",
          alignItems: "center",
          background: `linear-gradient(180deg, ${theme.panel2}, ${theme.panel})`,
          border: `1px solid ${theme.borderSoft || theme.border}`,
          borderRadius: "7px",
          padding: "8px",
          marginBottom: "7px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ color: theme.text, fontSize: "11px", fontWeight: 950 }}>
            Scanner Engine
          </div>
          <div style={{ color: theme.muted, fontSize: "9px", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {statusDetail} / {providerRowCount} provider / {contextRowCount} context
          </div>
        </div>
        <div
          style={{
            color: degraded ? theme.amber : theme.green,
            border: `1px solid ${degraded ? "rgba(245,184,75,0.35)" : "rgba(0,200,150,0.35)"}`,
            background: degraded ? "rgba(245,184,75,0.08)" : "rgba(0,200,150,0.08)",
            borderRadius: "999px",
            padding: "3px 7px",
            fontSize: "9px",
            fontWeight: 950,
            whiteSpace: "nowrap",
          }}
        >
          {degraded ? "LIMITED, CACHED" : rawSourceLabel}
        </div>
      </div>

      <div style={{ display: "flex", gap: "5px", marginBottom: "6px", flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setScannerTab(tab)}
            style={{
              height: "24px",
              padding: "0 8px",
              borderRadius: "5px",
              border: `1px solid ${theme.borderSoft || theme.border}`,
              background: scannerTab === tab ? theme.blue : theme.panel2,
              color: scannerTab === tab ? "#fff" : theme.text,
              cursor: "pointer",
              fontSize: "10px",
              fontWeight: 850,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "5px",
          marginBottom: "6px",
          padding: "4px",
          background: theme.panel2,
          border: `1px solid ${theme.borderSoft || theme.border}`,
          borderRadius: "6px",
        }}
      >
        <input
          value={scannerQuery}
          onChange={(event) => setScannerQuery(event.target.value.toUpperCase())}
          placeholder="Filter"
          style={{
            ...filterControlStyle,
            padding: "0 8px",
            gridColumn: "1 / -1",
          }}
        />

        <select value={minMove} onChange={(event) => setMinMove(event.target.value)} title="Minimum move" style={filterControlStyle}>
          <option value="0">Any %</option>
          <option value="1">1%+</option>
          <option value="3">3%+</option>
          <option value="5">5%+</option>
          <option value="10">10%+</option>
        </select>

        <select value={minVolume} onChange={(event) => setMinVolume(event.target.value)} title="Minimum volume" style={filterControlStyle}>
          <option value="0">Any Vol</option>
          <option value="100000">100K+</option>
          <option value="1000000">1M+</option>
          <option value="5000000">5M+</option>
          <option value="10000000">10M+</option>
        </select>

        <select value={priceBand} onChange={(event) => setPriceBand(event.target.value)} title="Price range" style={filterControlStyle}>
          <option value="Any">Any Price</option>
          <option value="Sub5">Sub $5</option>
          <option value="FiveToTwenty">$5-$20</option>
          <option value="TwentyToHundred">$20-$100</option>
          <option value="HundredPlus">Over $100</option>
        </select>

        <select value={minRvol} onChange={(event) => setMinRvol(event.target.value)} title="Minimum relative volume" style={filterControlStyle}>
          <option value="0">Any RVOL</option>
          <option value="1.5">1.5x+</option>
          <option value="2">2x+</option>
          <option value="3">3x+</option>
          <option value="5">5x+</option>
        </select>

        <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} title="Risk profile" style={filterControlStyle}>
          <option value="Any">Any Risk</option>
          <option value="Controlled">Controlled</option>
          <option value="Elevated">Elevated</option>
          <option value="High">High</option>
        </select>
      </div>

      {degraded && (
        <div
          style={{
            color: theme.amber,
            background: "rgba(245,184,75,0.045)",
            border: "1px solid rgba(245,184,75,0.18)",
            borderRadius: "6px",
            padding: "6px 7px",
            marginBottom: "7px",
            fontSize: "9px",
            lineHeight: "1.35",
          }}
          title={warnings[0] || "Primary movers are limited; backend fallback ranking is active."}
        >
            {scannerVisibleWarning} Provider rows stay ranked first; context rows are labeled separately.
        </div>
      )}

      {detailStock && detailAnalysis && (
        <div style={{ marginBottom: "8px" }}>
          <StockDetailCard
            ticker={detailStock.symbol}
            stock={{
              ...detailStock,
              score10: detailAnalysis.score10,
              score: detailAnalysis.score10,
              gapPercent: detailAnalysis.gap,
              relativeVolume: detailAnalysis.relativeVolume,
              float: detailAnalysis.floatValue,
              floatBucket: detailAnalysis.floatBucket,
              priceRange: detailAnalysis.priceRange,
              riskLabel: detailAnalysis.risk.label,
              catalyst: detailAnalysis.catalyst.text,
              catalystType: detailAnalysis.catalyst.label,
              whyMoving: detailAnalysis.whyMoving,
              intradayMovePercent: detailAnalysis.signedMove,
              volumePercentOfAvg: detailAnalysis.relativeVolume * 100,
            }}
            theme={theme}
            watchStatus={Boolean(detailStock.watchStatus || detailStock.watched)}
            onOpenChart={() => pickStock(detailStock)}
            onToggleWatch={() => addSymbolToWatchlist(detailStock.symbol)}
          />
        </div>
      )}

      <div
        style={{
          display: "grid",
          ...scannerGridStyle,
          padding: "6px 7px",
          background: theme.panel,
          borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
          color: theme.muted,
          fontSize: "9px",
          fontWeight: 950,
          textTransform: "uppercase",
        }}
      >
        <div>Symbol</div>
        <div>Price</div>
        <div>Move</div>
        <div>RVOL</div>
        <div>Score</div>
        <div>Risk</div>
      </div>

      <div style={{ maxHeight: "235px", overflowY: "auto" }}>
        {analyzedStocks.length === 0 ? (
          <div
            style={{
              color: theme.muted,
              border: `1px dashed ${theme.borderSoft || theme.border}`,
              borderRadius: "6px",
              padding: "10px",
              fontSize: "11px",
              lineHeight: "1.45",
              background: theme.panel2,
            }}
          >
            <div style={{ color: theme.text, fontWeight: 900, marginBottom: "3px" }}>
              No scanner matches
            </div>
            <div>Relax the move, volume, or symbol filter to bring candidates back.</div>
          </div>
        ) : (
          analyzedStocks.map(({ stock, analysis }, index) => {
            const positive = analysis.signedMove >= 0;
            const isSelected = selectedScannerStock?.symbol === stock.symbol;
            const selectedBackground = "rgba(25,198,216,0.12)";
            const rowSourceType = getRowSourceType(stock);
            const isContextRow = rowSourceType === "Context";
            const cleanWhy = cleanWhyText(analysis.whyMoving, stock.symbol);

            return (
              <div
                key={`${stock.symbol}-${index}`}
                onClick={() => pickStock(stock)}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = isSelected
                    ? "rgba(25,198,216,0.16)"
                    : "rgba(255,255,255,0.025)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = isSelected ? selectedBackground : "transparent";
                }}
                title={cleanWhy}
                style={{
                  display: "grid",
                  gap: "5px",
                  padding: "8px 7px",
                  borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
                  cursor: "pointer",
                  fontSize: "10px",
                  transition: "all 0.15s ease",
                  background: isSelected ? selectedBackground : isContextRow ? "rgba(245,184,75,0.025)" : "transparent",
                  opacity: isContextRow ? 0.92 : 1,
                }}
              >
                <div style={scannerGridStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ ...monoStyle, fontWeight: 800, color: theme.text }}>{stock.symbol}</div>
                    <div style={{ color: theme.muted, fontSize: "8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {rowSourceType} / {analysis.tags.slice(0, 1).join(" / ") || analysis.catalyst.label}
                    </div>
                  </div>
                  <div style={{ ...monoStyle, color: theme.text, fontWeight: 650, textAlign: "right" }}>
                    ${Number(analysis.price || stock.price || 0).toFixed(2)}
                  </div>
                  <div
                    style={{
                      ...monoStyle,
                      justifySelf: "end",
                      padding: "2px 5px",
                      borderRadius: "4px",
                      background: positive ? "rgba(0,200,150,0.10)" : "rgba(239,83,80,0.10)",
                      color: positive ? theme.green : theme.red,
                      fontWeight: 800,
                    }}
                  >
                    {positive ? "+" : "-"}
                    {analysis.move.toFixed(2)}%
                  </div>
                  <div style={{ ...monoStyle, color: analysis.relativeVolume >= 2 ? theme.green : theme.muted, fontWeight: 800, textAlign: "right" }}>
                    {analysis.relativeVolume.toFixed(1)}x
                  </div>
                  <div style={{ ...monoStyle, color: theme.cyan || theme.blue, fontWeight: 850, textAlign: "right" }}>
                    {analysis.score}
                  </div>
                  <div
                    style={{
                      justifySelf: "end",
                      padding: "2px 5px",
                      borderRadius: "4px",
                      background: `${analysis.risk.color}1f`,
                      color: analysis.risk.color,
                      fontWeight: 950,
                    }}
                  >
                    {analysis.risk.label}
                  </div>
                </div>
                <div
                  style={{
                    color: theme.muted,
                    fontSize: "9px",
                    lineHeight: 1.35,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ color: theme.text, fontWeight: 850 }}>Why: </span>
                  {cleanWhy}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
