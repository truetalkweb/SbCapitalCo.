import LoadingPanel from "./LoadingPanel";
import { getNewsStatusLabel } from "../hooks/useMarketNews";
import { getCleanProviderMessage } from "../utils/healthStatus";

function getStatusColor(label, theme) {
  if (String(label).includes("FALLBACK") || String(label).includes("LIMITED") || String(label).includes("PENDING")) return theme.amber;
  if (label === "NEWS LIVE" || label === "NEWS CACHED") return theme.green;

  return theme.muted;
}

function EmptyNewsState({ theme }) {
  return (
    <div
      style={{
        height: "100%",
        minHeight: "72px",
        display: "grid",
        placeItems: "center",
        color: theme.muted,
        fontSize: "11px",
        textAlign: "center",
      }}
    >
      Market headlines will appear here when the backend returns articles.
    </div>
  );
}

export default function MarketNewsPanel({
  news,
  newsLoading,
  newsMeta,
  selectedStock,
  theme,
  terminalMonoFont,
}) {
  const statusLabel = getNewsStatusLabel(newsMeta);
  const statusColor = getStatusColor(statusLabel, theme);
  const rawVisibleMessage = newsMeta.userMessage || newsMeta.userWarnings?.[0] || null;
  const visibleMessage = rawVisibleMessage
    ? getCleanProviderMessage(rawVisibleMessage, "News provider limited. Showing available headlines.")
    : null;
  const diagnosticsTitle = [
    visibleMessage,
    newsMeta.warning,
    ...(newsMeta.providerWarnings || []),
  ].filter(Boolean).join("; ") || newsMeta.source;

  return (
    <div
      style={{
        height: "100%",
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        gap: "6px",
        background: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: "8px",
        padding: "9px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
          paddingBottom: "6px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ color: theme.text, fontSize: "11px", fontWeight: 950, textTransform: "uppercase" }}>
            Market News
          </div>
          <div
            style={{
              marginTop: "2px",
              color: theme.muted,
              fontSize: "9px",
              fontWeight: 800,
              fontFamily: terminalMonoFont,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {selectedStock || "MARKET"} / backend feed
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minWidth: 0,
            color: statusColor,
            fontSize: "9px",
            fontWeight: 850,
          }}
          title={diagnosticsTitle}
        >
          <span
            style={{
              fontFamily: terminalMonoFont,
              fontVariantNumeric: "tabular-nums",
              color: theme.faint || theme.muted,
            }}
          >
            {news.length} rows
          </span>
          <span style={{ fontFamily: terminalMonoFont, whiteSpace: "nowrap" }}>
            {statusLabel}
          </span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: theme.muted, maxWidth: "240px" }}>
            {visibleMessage || newsMeta.source || "Backend News"}
          </span>
        </div>
      </div>

      {newsLoading ? (
        <LoadingPanel theme={theme} label="Loading news" height="100%" />
      ) : news.length === 0 ? (
        <EmptyNewsState theme={theme} />
      ) : (
        <div style={{ minHeight: 0, overflowY: "auto", display: "grid", alignContent: "start" }}>
          {news.map((item) => {
            const NewsRow = item.url ? "a" : "div";
            const sourceLabel = item.fallback ? item.source || "Fallback" : item.source;

            return (
              <NewsRow
                key={item.id}
                href={item.url || undefined}
                target={item.url ? "_blank" : undefined}
                rel={item.url ? "noreferrer" : undefined}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(58px, 74px) minmax(70px, 104px) minmax(0, 1fr) minmax(46px, 70px)",
                  gap: "10px",
                  alignItems: "start",
                  color: theme.text,
                  textDecoration: "none",
                  borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
                  padding: "9px 5px",
                  fontSize: "12px",
                  lineHeight: "1.42",
                  cursor: item.url ? "pointer" : "default",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(event) => {
                  if (item.url) event.currentTarget.style.background = "rgba(45,140,255,0.055)";
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
                    fontSize: "10px",
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
                    fontSize: "10px",
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
                    color: item.url ? theme.text : theme.muted,
                    fontFamily: '"Roboto", system-ui, sans-serif',
                    fontSize: "12px",
                    fontWeight: item.url ? 700 : 650,
                    whiteSpace: "normal",
                    overflowWrap: "anywhere",
                  }}
                  title={item.summary || item.text}
                >
                  {item.text}
                  {item.url && (
                    <span style={{ color: theme.blue, fontSize: "10px", fontWeight: 800 }}>
                      {" "}OPEN
                    </span>
                  )}
                </div>
                <div
                  style={{
                    justifySelf: "end",
                    fontFamily: terminalMonoFont,
                    fontVariantNumeric: "tabular-nums",
                    color: theme.cyan || theme.blue,
                    fontSize: "10px",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.relatedTicker || selectedStock}
                </div>
              </NewsRow>
            );
          })}
        </div>
      )}
    </div>
  );
}
