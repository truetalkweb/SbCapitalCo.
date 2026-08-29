import { formatPacificDateTime } from "../utils/timeFormatters";

function formatMoney(value, fallback = "Pending") {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return number.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumber(value, fallback = "Pending") {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return number.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

function formatDateTime(value) {
  return formatPacificDateTime(value, { fallback: "Not synced" });
}

function getPositionValue(position) {
  return Number(
    position.currentMarketValue ??
      position.marketValue ??
      position.value ??
      Number(position.currentPrice || 0) * Number(position.openQuantity || 0)
  );
}

function getPositionPnl(position) {
  return Number(position.openPnl ?? position.unrealizedPnl ?? position.unrealizedPnL ?? 0);
}

function getOrderSide(order) {
  return String(order.action || order.side || order.orderAction || "ORDER").toUpperCase();
}

function getOrderQuantity(order) {
  return Number(order.totalQuantity ?? order.quantity ?? order.openQuantity ?? order.filledQuantity ?? 0);
}

function SummaryCard({ theme, label, value, color }) {
  return (
    <div
      style={{
        background: theme.panel3 || theme.panel,
        border: `1px solid ${theme.borderSoft || theme.border}`,
        borderRadius: "7px",
        padding: "7px",
        minWidth: 0,
      }}
    >
      <div style={{ color: theme.muted, fontSize: "9px", fontWeight: 950, textTransform: "uppercase" }}>
        {label}
      </div>
      <div
        style={{
          color: color || theme.text,
          fontSize: "12px",
          fontWeight: 950,
          marginTop: "2px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function BrokerPositions({
  theme,
  brokerPositions,
  brokerOrders,
  brokerConnected,
  brokerSyncMeta,
}) {
  const positions = Array.isArray(brokerPositions) ? brokerPositions : [];
  const orders = Array.isArray(brokerOrders) ? brokerOrders : [];
  const exposure = positions.reduce((total, position) => total + Math.abs(getPositionValue(position) || 0), 0);
  const openPnl = positions.reduce((total, position) => total + getPositionPnl(position), 0);
  const openOrders = orders.filter((order) =>
    ["Accepted", "Queued", "Pending", "Open", "Partial", "Executed"].includes(String(order.state || ""))
  );
  const lastSync = brokerSyncMeta?.lastSuccessAt || brokerSyncMeta?.lastAttemptAt || null;
  const cardStyle = {
    background: `linear-gradient(180deg, ${theme.panel2}, ${theme.panel})`,
    border: `1px solid ${theme.borderSoft || theme.border}`,
    borderRadius: "8px",
    padding: "9px",
    marginTop: "9px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  };
  const tableHeaderStyle = {
    display: "grid",
    gridTemplateColumns: "1fr 0.7fr 0.85fr 0.9fr",
    gap: "6px",
    color: theme.muted,
    fontSize: "9px",
    fontWeight: 950,
    textTransform: "uppercase",
    padding: "6px 0",
    borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
  };
  const rowStyle = {
    display: "grid",
    gridTemplateColumns: "1fr 0.7fr 0.85fr 0.9fr",
    gap: "6px",
    alignItems: "center",
    padding: "7px 0",
    borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
    fontSize: "10px",
  };

  return (
    <>
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
          <div>
            <div style={{ color: theme.text, fontSize: "12px", fontWeight: 950 }}>Broker Activity</div>
            <div style={{ color: theme.muted, fontSize: "10px", marginTop: "2px" }}>
              Last sync: {formatDateTime(lastSync)}
            </div>
          </div>
          <span
            style={{
              color: brokerConnected ? theme.green : theme.amber,
              border: `1px solid ${brokerConnected ? "rgba(0,200,150,0.35)" : "rgba(245,184,75,0.35)"}`,
              background: brokerConnected ? "rgba(0,200,150,0.08)" : "rgba(245,184,75,0.08)",
              borderRadius: "999px",
              padding: "3px 7px",
              fontSize: "9px",
              fontWeight: 950,
              whiteSpace: "nowrap",
            }}
          >
            {brokerConnected ? "SYNC READY" : "AWAITING LINK"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px", marginTop: "8px" }}>
          <SummaryCard theme={theme} label="Positions" value={positions.length} />
          <SummaryCard theme={theme} label="Exposure" value={formatMoney(exposure)} color={theme.blue} />
          <SummaryCard
            theme={theme}
            label="Open P&L"
            value={formatMoney(openPnl)}
            color={openPnl >= 0 ? theme.green : theme.red}
          />
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
          <div style={{ color: theme.text, fontSize: "12px", fontWeight: 950 }}>Live Positions</div>
          <div style={{ color: theme.muted, fontSize: "10px" }}>{positions.length} rows</div>
        </div>

        {positions.length === 0 ? (
          <div
            style={{
              color: theme.muted,
              border: `1px dashed ${theme.borderSoft || theme.border}`,
              borderRadius: "7px",
              background: theme.panel3 || theme.panel2,
              padding: "9px",
              marginTop: "8px",
              fontSize: "10px",
              lineHeight: "1.45",
            }}
          >
            <div style={{ color: theme.text, fontWeight: 950, marginBottom: "2px" }}>
              No live positions loaded
            </div>
            <div>Sync the selected account to populate current broker positions.</div>
          </div>
        ) : (
          <>
            <div style={tableHeaderStyle}>
              <div>Symbol</div>
              <div>Qty</div>
              <div>Value</div>
              <div style={{ textAlign: "right" }}>P&L</div>
            </div>
            {positions.slice(0, 8).map((position, index) => {
              const pnl = getPositionPnl(position);

              return (
                <div key={`${position.symbol || "position"}-${index}`} style={rowStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: theme.text, fontWeight: 950 }}>{position.symbol || "SYMBOL"}</div>
                    <div style={{ color: theme.muted, fontSize: "9px", marginTop: "2px" }}>
                      Last {formatMoney(position.currentPrice, "Pending")}
                    </div>
                  </div>
                  <div style={{ color: theme.text, fontWeight: 850 }}>
                    {formatNumber(position.openQuantity ?? position.quantity)}
                  </div>
                  <div style={{ color: theme.text, fontWeight: 850 }}>
                    {formatMoney(getPositionValue(position))}
                  </div>
                  <div style={{ color: pnl >= 0 ? theme.green : theme.red, fontWeight: 950, textAlign: "right" }}>
                    {formatMoney(pnl)}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
          <div style={{ color: theme.text, fontSize: "12px", fontWeight: 950 }}>Open / Recent Orders</div>
          <div style={{ color: theme.muted, fontSize: "10px" }}>
            {openOrders.length || orders.length} visible
          </div>
        </div>

        {orders.length === 0 ? (
          <div
            style={{
              color: theme.muted,
              border: `1px dashed ${theme.borderSoft || theme.border}`,
              borderRadius: "7px",
              background: theme.panel3 || theme.panel2,
              padding: "9px",
              marginTop: "8px",
              fontSize: "10px",
              lineHeight: "1.45",
            }}
          >
            <div style={{ color: theme.text, fontWeight: 950, marginBottom: "2px" }}>
              No live broker orders
            </div>
            <div>Recent Questrade orders will appear after account sync. Live submission remains locked.</div>
          </div>
        ) : (
          orders.slice(0, 7).map((order, index) => {
            const side = getOrderSide(order);
            const sideColor = side.includes("BUY") ? theme.green : side.includes("SELL") ? theme.red : theme.text;
            const quantity = getOrderQuantity(order);
            const state = order.state || order.status || "Status pending";

            return (
              <div
                key={`${order.id || order.orderId || index}`}
                style={{
                  padding: "8px 0",
                  borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
                  fontSize: "10px",
                  lineHeight: "1.35",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ color: sideColor, fontWeight: 950 }}>{side}</span>{" "}
                    <span style={{ color: theme.text, fontWeight: 950 }}>{order.symbol || "SYMBOL"}</span>
                  </div>
                  <div style={{ color: theme.muted, fontWeight: 850, whiteSpace: "nowrap" }}>
                    Qty {formatNumber(quantity)}
                  </div>
                </div>
                <div style={{ color: theme.muted, marginTop: "3px" }}>
                  {order.orderType || order.type || "Order"} / {state}
                </div>
                <div style={{ color: theme.faint || theme.muted, marginTop: "3px" }}>
                  Updated {formatDateTime(order.updateTime || order.creationTime || order.time)}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div
        style={{
          color: theme.amber,
          border: "1px solid rgba(245,184,75,0.32)",
          background: "rgba(245,184,75,0.07)",
          borderRadius: "8px",
          padding: "8px",
          marginTop: "9px",
          fontSize: "10px",
          lineHeight: "1.45",
        }}
      >
        <div style={{ color: theme.text, fontWeight: 950, marginBottom: "2px" }}>
          Live Trading Locked
        </div>
        <div>Broker data can sync, but live order routing is disabled until server-side safety checks and audit review are implemented.</div>
      </div>
    </>
  );
}
