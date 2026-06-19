import LoadingPanel from "./LoadingPanel";
import { getNewsStatusLabel } from "../hooks/useMarketNews";
import { terminalSansFont } from "../config/terminalConfig";
import { getCleanProviderMessage } from "../utils/healthStatus";
import { formatTerminalStatusLabel } from "../utils/marketUtils";

function getStatusColor(label, theme) {
  const value = String(label || "").toUpperCase();

  if (value.includes("FALLBACK") || value.includes("LIMITED") || value.includes("PENDING")) return theme.amber;
  if (value.includes("LIVE") || value.includes("CACHED")) return theme.green;

  return theme.muted;
}

function getArticleType(item) {
  if (item.sourceType) return formatTerminalStatusLabel(item.sourceType);
  if (item.fallback) return "Scanner Catalyst";
  if (item.url) return "Real Article";

  return "Market News";
}

function getArticleTypeColor(type, theme) {
  if (type === "Real Article" || type === "Article" || type === "Market News") return theme.green;
  if (type === "Fallback Context" || type === "Scanner Catalyst") return theme.amber;

  return theme.muted;
}

function EmptyNewsState({ theme, terminalMonoFont, selectedStock }) {
  return (
    <div
      style={{
        height: "100%",
        minHeight: "72px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "5px",
        color: theme.muted,
        textAlign: "center",
        border: `1px dashed ${theme.borderSoft || theme.border}`,
        borderRadius: "7px",
        background: "rgba(255,255,255,0.015)",
      }}
    >
      <div style={{ color: theme.text, fontSize: "11px", fontWeight: 800, fontFamily: terminalSansFont }}>
        News feed pending
      </div>
      <div style={{ color: theme.muted, fontSize: "10px", fontFamily: terminalSansFont }}>
        Backend headlines for <span style={{ fontFamily: terminalMonoFont }}>{selectedStock || "MARKET"}</span> will appear here.
      </div>
    </div>
  );
}

export default function MarketNewsPanel({
  news,
  newsLoading,
  newsMeta,
  selectedStock,
  dataConfidence,
  theme,
  terminalMonoFont,
}) {
  const statusLabel = getNewsStatusLabel(newsMeta);
  const displayStatusLabel = formatTerminalStatusLabel(statusLabel);
  const statusColor = getStatusColor(statusLabel, theme);
  const rawVisibleMessage = newsMeta.userMessage || newsMeta.userWarnings?.[0] || null;
  const visibleMessage = rawVisibleMessage
    ? getCleanProviderMessage(rawVisibleMessage, "Provider limited. Showing available headlines.")
    : null;
  const diagnosticsTitle = [
    visibleMessage,
    newsMeta.warning,
    ...(newsMeta.providerWarnings || []),
  ].filter(Boolean).join("; ") || newsMeta.source;
  const confidenceColor =
    dataConfidence?.confidence === "High"
      ? theme.green
      : dataConfidence?.confidence === "Medium"
        ? theme.amber
        : theme.red;
  const updatedLabel = dataConfidence?.lastUpdatedLabel || "Pending";
  const providerMessage = visibleMessage || formatTerminalStatusLabel(newsMeta.source || "Backend News");
  const rowCountLabel = `${news.length} ${news.length === 1 ? "row" : "rows"}`;

  function confidencePill(label, value, confidence) {
    const color = confidence === "High" ? theme.green : confidence === "Medium" ? theme.amber : theme.red;

    return (
      <span
        title={`${label}: ${value || "Pending"} / ${confidence || "Limited"}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          minWidth: 0,
          color: theme.text,
          background: "rgba(255,255,255,0.02)",
          borderRadius: "999px",
          padding: "3px 7px",
          fontSize: "9px",
          fontWeight: 800,
          fontFamily: terminalSansFont,
        }}
      >
        <span style={{ color: theme.muted }}>{label}</span>
        <span
          style={{
            color,
            fontFamily: terminalMonoFont,
            fontVariantNumeric: "tabular-nums",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "92px",
          }}
        >
          {confidence || "Limited"}
        </span>
      </span>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        gap: "7px",
        background: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: "8px",
        padding: "9px",
        fontFamily: terminalSansFont,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(160px, 1fr) auto",
          alignItems: "start",
          gap: "12px",
          borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
          paddingBottom: "7px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ color: theme.text, fontSize: "11px", fontWeight: 900, textTransform: "uppercase" }}>
            Market News
          </div>
          <div
            style={{
              marginTop: "2px",
              color: theme.muted,
              fontSize: "9px",
              fontWeight: 750,
              fontFamily: terminalMonoFont,
              fontVariantNumeric: "tabular-nums",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selectedStock || "MARKET"} / backend feed / {rowCountLabel}
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto minmax(0, 1fr)",
            alignItems: "center",
            gap: "7px",
            minWidth: 0,
            justifySelf: "end",
            maxWidth: "520px",
          }}
          title={diagnosticsTitle}
        >
          <span
            style={{
              fontFamily: terminalMonoFont,
              fontVariantNumeric: "tabular-nums",
              color: statusColor,
              border: `1px solid ${statusColor}42`,
              borderRadius: "999px",
              padding: "3px 7px",
              background: `${statusColor}10`,
              fontSize: "9px",
              fontWeight: 850,
              whiteSpace: "nowrap",
            }}
          >
            {displayStatusLabel}
          </span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: theme.muted,
              fontSize: "9.5px",
              fontWeight: 700,
            }}
          >
            {providerMessage}
          </span>
        </div>
      </div>

      {dataConfidence && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            minWidth: 0,
            overflow: "hidden",
            padding: "1px 0 5px",
            borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
          }}
        >
          <span
            title={`Selected ticker data confidence: ${dataConfidence.confidence}`}
            style={{
              color: confidenceColor,
              fontFamily: terminalMonoFont,
              fontVariantNumeric: "tabular-nums",
              fontSize: "9px",
              fontWeight: 950,
              whiteSpace: "nowrap",
            }}
          >
            {dataConfidence.symbol} DATA {dataConfidence.confidence.toUpperCase()}
          </span>
          {confidencePill("Quote", dataConfidence.quote?.label, dataConfidence.quote?.confidence)}
          {confidencePill("News", dataConfidence.news?.label, dataConfidence.news?.confidence)}
          {confidencePill("Scan", dataConfidence.scanner?.label, dataConfidence.scanner?.confidence)}
          <span
            style={{
              marginLeft: "auto",
              color: theme.muted,
              fontFamily: terminalMonoFont,
              fontVariantNumeric: "tabular-nums",
              fontSize: "9px",
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            Updated {updatedLabel}
          </span>
        </div>
      )}

      {newsLoading ? (
        <LoadingPanel theme={theme} label="Loading news" height="100%" />
      ) : news.length === 0 ? (
        <EmptyNewsState theme={theme} terminalMonoFont={terminalMonoFont} selectedStock={selectedStock} />
      ) : (
        <div style={{ minHeight: 0, overflowY: "auto", display: "grid", alignContent: "start", gap: "0" }}>
          {news.map((item, index) => {
            const NewsRow = item.url ? "a" : "div";
            const sourceLabel = formatTerminalStatusLabel(item.fallback ? item.source || "Fallback" : item.source || "Market News");
            const sourceType = getArticleType(item);
            const sourceColor = getArticleTypeColor(sourceType, theme);
            const ticker = String(item.relatedTicker || selectedStock || "MARKET").toUpperCase();
            const headline = String(item.text || item.headline || "Market context update").trim();
            const summary = String(item.summary || "").trim();

            return (
              <NewsRow
                key={item.id}
                href={item.url || undefined}
                target={item.url ? "_blank" : undefined}
                rel={item.url ? "noreferrer" : undefined}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(54px, 72px) minmax(72px, 102px) minmax(76px, 108px) minmax(0, 1fr) minmax(42px, 66px)",
                  gap: "9px",
                  alignItems: "start",
                  color: theme.text,
                  textDecoration: "none",
                  borderBottom: index === news.length - 1 ? "none" : `1px solid ${theme.borderSoft || theme.border}`,
                  padding: "8px 6px",
                  fontSize: "11px",
                  lineHeight: 1.38,
                  cursor: item.url ? "pointer" : "default",
                  transition: "background 0.15s ease",
                  borderRadius: item.url ? "5px" : 0,
                }}
                onMouseEnter={(event) => {
                  if (item.url) event.currentTarget.style.background = "rgba(45,140,255,0.06)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = "transparent";
                }}
              >
                <div
                  style={{
                    fontFamily: terminalMonoFont,
                    fontVariantNumeric: "tabular-nums",
                    color: theme.faint || theme.muted,
                    fontSize: "9.5px",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.time}
                </div>
                <div
                  style={{
                    fontFamily: terminalMonoFont,
                    fontVariantNumeric: "tabular-nums",
                    color: item.fallback ? theme.amber : theme.faint || theme.muted,
                    fontSize: "9.5px",
                    fontWeight: item.fallback ? 850 : 750,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={sourceLabel}
                >
                  {sourceLabel}
                </div>
                <div
                  style={{
                    justifySelf: "start",
                    color: sourceColor,
                    border: `1px solid ${sourceColor}40`,
                    background: `${sourceColor}12`,
                    borderRadius: "999px",
                    padding: "2px 6px",
                    fontSize: "8.5px",
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                    fontFamily: terminalMonoFont,
                  }}
                  title={sourceType}
                >
                  {sourceType}
                </div>
                <div
                  style={{
                    color: item.url ? theme.text : theme.muted,
                    fontFamily: terminalSansFont,
                    fontSize: "11.5px",
                    fontWeight: item.url ? 750 : 650,
                    whiteSpace: "normal",
                    overflowWrap: "break-word",
                    minWidth: 0,
                  }}
                  title={summary || headline}
                >
                  {headline}
                  {item.url && (
                    <span style={{ color: theme.blue, fontSize: "9px", fontWeight: 850, whiteSpace: "nowrap" }}>
                      {" "}OPEN
                    </span>
                  )}
                  {!item.url && sourceType === "Scanner Catalyst" && (
                    <span style={{ color: theme.amber, fontSize: "9px", fontWeight: 800 }}>
                      {" "}CONTEXT
                    </span>
                  )}
                </div>
                <div
                  style={{
                    justifySelf: "end",
                    fontFamily: terminalMonoFont,
                    fontVariantNumeric: "tabular-nums",
                    color: theme.cyan || theme.blue,
                    fontSize: "9.5px",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  {ticker}
                </div>
              </NewsRow>
            );
          })}
        </div>
      )}
    </div>
  );
}
