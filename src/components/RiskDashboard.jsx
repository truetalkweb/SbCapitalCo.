import { formatPacificTime } from "../utils/timeFormatters";

const PAPER_STARTING_EQUITY = 100000;

function money(value, fallback = "$0.00") {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return number.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function percent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "0.0%";

  return `${number.toFixed(1)}%`;
}

function numberValue(...values) {
  for (const value of values) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

function brokerPositionSymbol(position) {
  return position.symbol || position.underlyingSymbol || position.ticker || "Position";
}

export default function RiskDashboard({
  theme,
  positions,
  allSymbols,
  orders,
  realizedPnL,
  totalUnrealizedPnL,
  dailyLossLimit,
  maxOrderValue,
  riskPerTrade,
  primaryBrokerBalance,
  brokerPositions = [],
  brokerConnected = false,
  brokerSyncMeta = {},
  brokerToolsEnabled = true,
}) {
  const maxOrder = Number(maxOrderValue || 0);
  const riskCap = Number(riskPerTrade || 0);
  const lossLimit = Number(dailyLossLimit || 0);
  const paperPositions = Object.entries(positions).map(([symbol, position]) => {
    const livePrice = Number(allSymbols.find((item) => item.symbol === symbol)?.price || position.average || 0);
    const quantity = Number(position.quantity || 0);
    const average = Number(position.average || 0);
    const exposure = livePrice * quantity;
    const costBasis = average * quantity;
    const unrealized = (livePrice - average) * quantity;
    const stopOrder = orders.find(
      (order) => order.symbol === symbol && Number(order.stopLoss || 0) > 0
    );
    const stopLoss = Number(stopOrder?.stopLoss || 0);
    const openRisk = stopLoss > 0 ? Math.abs(livePrice - stopLoss) * quantity : 0;
    const limitUsage = maxOrder > 0 ? (exposure / maxOrder) * 100 : 0;
    const riskUsage = riskCap > 0 ? (openRisk / riskCap) * 100 : 0;

    return {
      symbol,
      quantity,
      average,
      livePrice,
      exposure,
      costBasis,
      unrealized,
      openRisk,
      stopLoss,
      limitUsage,
      riskUsage,
    };
  });
  const paperCostBasis = paperPositions.reduce((total, item) => total + item.costBasis, 0);
  const paperExposure = paperPositions.reduce((total, item) => total + item.exposure, 0);
  const paperOpenRisk = paperPositions.reduce((total, item) => total + item.openRisk, 0);
  const paperUnrealized = Number.isFinite(Number(totalUnrealizedPnL))
    ? Number(totalUnrealizedPnL)
    : paperPositions.reduce((total, item) => total + item.unrealized, 0);
  const paperRealized = Number(realizedPnL || 0);
  const paperEquity = PAPER_STARTING_EQUITY + paperRealized + paperUnrealized;
  const paperCash = PAPER_STARTING_EQUITY + paperRealized - paperCostBasis;
  const paperBuyingPower = paperCash;
  const dailyLoss = Math.max(0, -paperRealized);
  const lossProgress = lossLimit > 0 ? Math.min(100, (dailyLoss / lossLimit) * 100) : 0;
  const riskUsageTotal = riskCap > 0 ? Math.min(999, (paperOpenRisk / riskCap) * 100) : 0;
  const brokerEquity = primaryBrokerBalance ? Number(primaryBrokerBalance.totalEquity || 0) : null;
  const brokerCash = primaryBrokerBalance ? Number(primaryBrokerBalance.cash || 0) : null;
  const brokerBuyingPower = primaryBrokerBalance ? Number(primaryBrokerBalance.buyingPower || 0) : null;
  const brokerExposure = brokerPositions.reduce((total, position) => {
    const marketValue = numberValue(
      position.currentMarketValue,
      position.marketValue,
      Number(position.openQuantity || position.quantity || 0) * Number(position.currentPrice || position.averageEntryPrice || 0)
    );

    return total + Math.abs(marketValue);
  }, 0);
  const lastSync = formatPacificTime(brokerSyncMeta?.lastSuccessAt, { fallback: "Not synced" });
  const warnings = [
    lossLimit > 0 && dailyLoss >= lossLimit ? "Daily loss lockout is active." : null,
    paperPositions.some((item) => item.stopLoss <= 0) ? "One or more paper positions has no stop reference." : null,
    maxOrder > 0 && paperPositions.some((item) => item.exposure > maxOrder) ? "A paper position exceeds the max order value guardrail." : null,
    riskCap > 0 && paperPositions.some((item) => item.openRisk > riskCap) ? "A paper position exceeds the risk/trade cap." : null,
    brokerToolsEnabled && brokerConnected && !primaryBrokerBalance ? "Broker connected but balances are not synced yet." : null,
  ].filter(Boolean);
  const metricStyle = {
    background: `linear-gradient(180deg, ${theme.panel3 || theme.panel2}, ${theme.panel2})`,
    border: `1px solid ${theme.borderSoft || theme.border}`,
    borderRadius: "8px",
    padding: "8px",
    minWidth: 0,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
  };
  const labelStyle = {
    color: theme.muted,
    fontSize: "9px",
    fontWeight: 950,
    textTransform: "uppercase",
  };
  const valueStyle = {
    color: theme.text,
    fontSize: "13px",
    fontWeight: 950,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  const sectionTitleStyle = {
    color: theme.text,
    fontSize: "11px",
    fontWeight: 950,
  };

  function metric(label, value, color = theme.text) {
    return (
      <div style={metricStyle}>
        <div style={labelStyle}>{label}</div>
        <div style={{ ...valueStyle, color }}>{value}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "9px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 950 }}>Portfolio Risk</h3>
          <div style={{ color: theme.muted, fontSize: "10px", marginTop: "2px" }}>
            {brokerToolsEnabled ? "Paper portfolio + broker balance view" : "Paper portfolio risk view"}
          </div>
        </div>
        <span
          style={{
            color: warnings.length ? theme.amber : theme.green,
            border: `1px solid ${warnings.length ? "rgba(245,184,75,0.35)" : "rgba(0,200,150,0.35)"}`,
            background: warnings.length ? "rgba(245,184,75,0.08)" : "rgba(0,200,150,0.08)",
            borderRadius: "999px",
            padding: "4px 8px",
            fontSize: "9px",
            fontWeight: 950,
            whiteSpace: "nowrap",
          }}
        >
          {warnings.length ? `${warnings.length} Watch` : "Clear"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "6px" }}>
        {metric("Account Equity", primaryBrokerBalance ? money(brokerEquity) : money(paperEquity), primaryBrokerBalance ? theme.green : theme.text)}
        {metric("Cash", primaryBrokerBalance ? money(brokerCash) : money(paperCash), theme.text)}
        {metric("Buying Power", primaryBrokerBalance ? money(brokerBuyingPower) : money(paperBuyingPower), theme.blue)}
        {brokerToolsEnabled
          ? metric("Broker Exposure", money(brokerExposure), brokerExposure > 0 ? theme.amber : theme.text)
          : metric("Mode", "Paper Only", theme.blue)}
      </div>

      <div style={{ ...metricStyle, display: "grid", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <div style={sectionTitleStyle}>Paper P&L</div>
          <div style={{ color: theme.muted, fontSize: "10px" }}>{paperPositions.length} open</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "6px" }}>
          {metric("Realized", money(paperRealized), paperRealized >= 0 ? theme.green : theme.red)}
          {metric("Unrealized", money(paperUnrealized), paperUnrealized >= 0 ? theme.green : theme.red)}
          {metric("Exposure", money(paperExposure), paperExposure > maxOrder && maxOrder > 0 ? theme.amber : theme.text)}
        </div>
      </div>

      {brokerToolsEnabled && (
      <div style={metricStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "6px", flexWrap: "wrap", fontSize: "10px" }}>
          <span style={{ color: theme.muted, fontWeight: 950 }}>Daily Loss Lockout</span>
          <span style={{ color: dailyLoss >= lossLimit && lossLimit > 0 ? theme.red : theme.text, fontWeight: 950 }}>
            {money(dailyLoss)} / {money(lossLimit)}
          </span>
        </div>
        <div
          style={{
            height: "8px",
            marginTop: "7px",
            background: theme.panel,
            border: `1px solid ${theme.borderSoft || theme.border}`,
            borderRadius: "999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${lossProgress}%`,
              height: "100%",
              background: lossProgress >= 90 ? theme.red : lossProgress >= 60 ? theme.amber : theme.green,
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginTop: "7px", fontSize: "10px" }}>
          <span style={{ color: theme.muted }}>Risk/trade usage</span>
          <b style={{ color: riskUsageTotal > 100 ? theme.red : riskUsageTotal > 70 ? theme.amber : theme.green }}>
            {percent(riskUsageTotal)}
          </b>
        </div>
      </div>
      )}

      <div style={metricStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
          <div style={sectionTitleStyle}>Open Paper Positions</div>
          <div style={{ color: theme.muted, fontSize: "10px", whiteSpace: "nowrap" }}>Max {money(maxOrder)}</div>
        </div>

        {paperPositions.length === 0 ? (
          <div style={{ color: theme.muted, fontSize: "10px", lineHeight: "1.45" }}>
            No open paper positions. New paper fills will populate exposure and risk usage here.
          </div>
        ) : (
          paperPositions.map((item) => (
            <div
              key={item.symbol}
              style={{
                display: "grid",
                gridTemplateColumns: "0.7fr 0.75fr 1fr",
                gap: "6px",
                padding: "6px 0",
                borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
                fontSize: "10px",
                alignItems: "center",
              }}
            >
              <div>
                <b style={{ color: theme.text }}>{item.symbol}</b>
                <div style={{ color: theme.muted }}>Qty {item.quantity}</div>
              </div>
              <div>
                <div style={{ color: theme.text, fontWeight: 900 }}>{money(item.exposure)}</div>
                <div style={{ color: item.limitUsage > 100 ? theme.red : theme.muted }}>
                  {percent(item.limitUsage)} limit
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: item.unrealized >= 0 ? theme.green : theme.red, fontWeight: 950 }}>
                  {money(item.unrealized)}
                </div>
                <div style={{ color: item.openRisk > riskCap && riskCap > 0 ? theme.red : theme.muted }}>
                  Risk {money(item.openRisk)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={metricStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
          <div style={sectionTitleStyle}>Live Broker Positions</div>
          <div style={{ color: brokerConnected ? theme.green : theme.muted, fontSize: "10px", fontWeight: 900 }}>
            {brokerConnected ? `Synced ${lastSync}` : "Broker offline"}
          </div>
        </div>

        {brokerPositions.length === 0 ? (
          <div style={{ color: theme.muted, fontSize: "10px", lineHeight: "1.45" }}>
            No live broker positions loaded. Account numbers are intentionally hidden.
          </div>
        ) : (
          brokerPositions.slice(0, 5).map((position, index) => {
            const symbol = brokerPositionSymbol(position);
            const quantity = numberValue(position.openQuantity, position.quantity);
            const marketValue = numberValue(
              position.currentMarketValue,
              position.marketValue,
              quantity * numberValue(position.currentPrice, position.averageEntryPrice)
            );
            const pnl = numberValue(position.openPnl, position.unrealizedPnl, position.unrealizedPnL);

            return (
              <div
                key={`${symbol}-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "0.8fr 0.8fr 1fr",
                  gap: "6px",
                  padding: "6px 0",
                  borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
                  fontSize: "10px",
                }}
              >
                <b style={{ color: theme.text }}>{symbol}</b>
                <span style={{ color: theme.muted }}>Qty {quantity}</span>
                <span style={{ color: pnl >= 0 ? theme.green : theme.red, textAlign: "right", fontWeight: 900 }}>
                  {money(marketValue)}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div style={metricStyle}>
        <div style={sectionTitleStyle}>Portfolio Risk Warnings</div>
        {warnings.length === 0 ? (
          <div style={{ color: theme.green, fontSize: "10px", fontWeight: 900, marginTop: "6px" }}>
            {brokerToolsEnabled ? "Paper and broker risk checks are clear." : "Paper risk checks are clear."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "4px", marginTop: "6px" }}>
            {warnings.map((warning) => (
              <div key={warning} style={{ color: theme.amber, fontSize: "10px", lineHeight: "1.35" }}>
                {warning}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
