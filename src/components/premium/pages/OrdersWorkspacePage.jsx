import OrderReviewPanel from "../OrderReviewPanel";
import { isWorkingPaperOrder } from "../../../services/paperTradingEngine.js";
import { Lock, Shield, X } from "lucide-react";
import { money } from "../premiumWorkspaceData";
import { ActionButton, FilterBar, PremiumCard, PremiumTable, PremiumTabs, StatusPill } from "../PremiumWorkspacePrimitives";

export default function OrdersWorkspacePage({
  paperTrading,
  mainTwoCol,
  review, dismissReview,
      orderSearch,
      orderMessage,
      orderView,
      page,
      prepareReviewAction,
      quickOrder,
      selectMainSymbol,
      selected,
      selectedOrder,
      setOrderSearch,
      setOrderView,
      setSelectedOrderId,
      theme,
      visibleOrderRows
}) {
    return (
      <div className="terminal-page" style={page}>
        <div style={mainTwoCol}>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme}>
              <div style={{ padding: 16, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}><PremiumTabs theme={theme} tabs={["All Orders", "Working", "Filled", "Cancelled", "Rejected"]} active={orderView} onChange={setOrderView} /><div style={{ marginTop: 14 }}><FilterBar theme={theme} search="Search symbol, side, or status..." value={orderSearch} onSearchChange={setOrderSearch} items={["All dates"]} /></div></div>
              <PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "90px", mono: true }, { key: "symbol", label: "Symbol", width: "90px", mono: true, strong: true }, { key: "actionLabel", label: "Action", width: "110px", color: (row) => row.side === "BUY" ? theme.green : theme.red, strong: true }, { key: "type", label: "Type", width: "90px" }, { key: "qty", label: "Qty", width: "70px", align: "right", mono: true }, { key: "price", label: "Price", width: "100px", align: "right", mono: true }, { key: "status", label: "Status", width: "140px", render: (row) => <StatusPill theme={theme} tone={row.status === "REJECTED" ? "bad" : row.status.includes("WORK") ? "neutral" : row.status.includes("PART") ? "warn" : "good"}>{row.status}</StatusPill> }, { key: "filled", label: "Filled", width: "80px", align: "right", mono: true }, { key: "remaining", label: "Remaining", width: "100px", align: "right", mono: true }, { key: "tif", label: "TIF", width: "70px" }, { key: "id", label: "Order ID", width: "110px", mono: true }]} rows={visibleOrderRows} selectedKey={selectedOrder?.id} keyField="id" emptyMessage={`No ${orderView.toLowerCase()} match the current search.`} onSelect={(row) => { setSelectedOrderId(row.id); selectMainSymbol?.(row.symbol, row, "order-row"); }} />
            </PremiumCard>
            <PremiumCard theme={theme} title="Order Activity"><PremiumTable theme={theme} columns={[{ key: "time", label: "Time", width: "100px" }, { key: "event", label: "Event", width: "1fr" }, { key: "status", label: "Status", width: "140px", color: () => theme.green }]} rows={visibleOrderRows.slice(0, 5).map((row) => ({ time: row.time, event: `${row.symbol} ${row.actionLabel} ${row.qty} @ ${row.price}`, status: row.status }))} emptyMessage="No order activity matches this view." /></PremiumCard>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <PremiumCard theme={theme} title={paperTrading ? "Paper order ticket" : "Order Review"}><div style={{ padding: paperTrading ? 0 : 16 }}>{quickOrder.props.children}</div></PremiumCard>
            <PremiumCard theme={theme} title="Order Summary"><div style={{ padding: 14, display: "grid", gap: 10 }}>{[["Selected Order", selectedOrder ? `${selectedOrder.actionLabel} ${selectedOrder.qty} ${selectedOrder.symbol}` : "No order selected"], ["Order Value", money(selectedOrder?.price !== null && selectedOrder?.price !== undefined && selectedOrder?.qty !== null ? selectedOrder.price * selectedOrder.qty : null)], ["Mode", paperTrading ? "Paper simulation" : "Review only"], ["Status", selectedOrder?.status || "No rows yet"]].map(([a, b]) => <div key={a} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>{a}</span><b style={{ textAlign: "right" }}>{b}</b></div>)}{orderMessage ? <div role="status" data-testid="order-review-status" style={{ marginTop: 2, padding: "9px 10px", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.muted, fontSize: 11, lineHeight: 1.45 }}>{orderMessage}</div> : null}</div></PremiumCard>
            {paperTrading && selectedOrder && <PremiumCard theme={theme} title="Selected paper order"><div style={{ padding: 14, display: "grid", gap: 10 }}><span>{selectedOrder.reason || selectedOrder.status}{selectedOrder.stopPrice ? ` · Stop ${selectedOrder.stopPrice}` : ""}</span><ActionButton theme={theme} danger disabled={!isWorkingPaperOrder(selectedOrder)} onClick={() => paperTrading.cancel(selectedOrder.id)}>Cancel selected paper order</ActionButton></div></PremiumCard>}
            <OrderReviewPanel theme={theme} review={review} dismissReview={dismissReview} />
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
