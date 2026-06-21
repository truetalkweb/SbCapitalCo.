import {
  createCardStyle,
  createInputStyle,
  createLabelStyle,
  sectionTitleStyle as createSectionTitleStyle,
} from "./uiPrimitives";
import { getCleanProviderMessage } from "../utils/healthStatus";

export default function OrderTicket({
  theme,
  buttonStyle,
  orderSide,
  setOrderSide,
  orderType,
  setOrderType,
  quantity,
  setQuantity,
  limitPrice,
  setLimitPrice,
  stopLoss,
  setStopLoss,
  takeProfit,
  setTakeProfit,
  selectedStock,
  selectedStockData,
  orderEntryPrice,
  estimatedValue,
  riskReward,
  orderRisk,
  orderReward,
  tradingMode,
  setTradingMode,
  orderConfirmed,
  setOrderConfirmed,
  maxOrderValue,
  setMaxOrderValue,
  dailyLossLimit,
  setDailyLossLimit,
  riskPerTrade,
  setRiskPerTrade,
  orderPreview,
  riskGuard = null,
  liveReadiness = null,
  liveOrderPreview = null,
  liveOrderLoading = false,
  orderConfirmationKey,
  safetyIssues = [],
  previewLiveOrderTicket,
  submitOrderTicket,
  orderMessage,
  liveTradingEnabled = false,
  compact = false,
}) {
  const effectiveTradingMode = liveTradingEnabled ? tradingMode : "paper";
  const canSubmit = safetyIssues.length === 0;
  const visibleSafetyIssues = safetyIssues.slice(0, 3);
  const liveBlockingReasons = Array.isArray(liveReadiness?.blockingReasons)
    ? liveReadiness.blockingReasons
    : [];
  const liveWarnings = Array.isArray(liveReadiness?.warnings)
    ? liveReadiness.warnings
    : [];
  const previewErrors = Array.isArray(liveOrderPreview?.validationErrors)
    ? liveOrderPreview.validationErrors
    : [];
  const liveCheckRows = [
    ["Broker", liveReadiness?.brokerConnected, "Broker connection is not ready."],
    ["Account", liveReadiness?.selectedAccountValid, "No valid broker account is selected."],
    ["Permission", liveReadiness?.orderPermissionDetected, "Live order permission is not confirmed."],
    ["Risk", liveReadiness?.riskControlsEnabled, "Risk controls are not fully configured."],
    ["Audit", liveReadiness?.auditLoggingEnabled, "Audit logging is not confirmed."],
    ["Live Env", liveReadiness?.liveTradingEnabled, "Live trading environment is disabled."],
  ];
  const derivedLiveBlocks = liveReadiness
    ? liveCheckRows
        .filter(([, ok]) => !ok)
        .map(([, , reason]) => reason)
    : ["Live readiness has not loaded yet."];
  const visibleLiveBlocks = Array.from(new Set([...liveBlockingReasons, ...derivedLiveBlocks]))
    .map((reason) => getCleanProviderMessage(reason, "Live readiness check is temporarily limited. Retry shortly."));
  const visibleLiveWarnings = liveWarnings
    .map((warning) => getCleanProviderMessage(warning, "Live readiness warning is active."));
  const visiblePreviewErrors = previewErrors
    .map((error) => getCleanProviderMessage(error, "Live order preview is temporarily limited. Retry shortly."));
  const liveReady =
    Boolean(liveReadiness) &&
    liveBlockingReasons.length === 0 &&
    liveCheckRows.every(([, ok]) => ok === true);
  const liveStatusLabel =
    effectiveTradingMode === "paper"
      ? "PAPER MODE"
      : liveReady
      ? "LIVE READY"
      : liveReadiness
      ? "LIVE BLOCKED"
      : "LIVE CHECKING";
  const liveStatusColor =
    effectiveTradingMode === "paper"
      ? theme.green
      : !liveReady
      ? theme.amber
      : theme.green;
  const entry = Number(orderEntryPrice || 0);
  const stop = Number(stopLoss || 0);
  const target = Number(takeProfit || 0);
  const stopDistance = stop > 0 && entry > 0 ? Math.abs(entry - stop) : 0;
  const targetDistance = target > 0 && entry > 0 ? Math.abs(target - entry) : 0;
  const suggestedRiskQty = stopDistance > 0
    ? Math.max(1, Math.floor(Number(riskPerTrade || 0) / stopDistance))
    : 0;
  const currentPosition = Number(orderPreview.positionQuantity || 0);
  const positionAverage = Number(orderPreview.positionAverage || 0);
  const checklist = [
    ["Symbol", Boolean(selectedStock)],
    ["Size", riskGuard?.quantityValid ?? Number(quantity || 0) > 0],
    ["Stop", stopDistance > 0],
    ["Target", targetDistance > 0],
    ["R:R", Number(riskReward) >= 1.5],
    ["Guardrails", safetyIssues.length === 0],
  ];
  const guardStatus = riskGuard?.status || (canSubmit ? "ready" : "blocked");
  const guardColor = guardStatus === "ready" ? theme.green : theme.amber;
  const guardRows = [
    ["Mode", riskGuard?.mode || (effectiveTradingMode === "paper" ? "Paper Mode" : "Live Mode")],
    ["Broker", riskGuard?.brokerStatus || (effectiveTradingMode === "paper" ? "Paper execution" : "Broker locked")],
    ["Session", riskGuard?.marketSession || "Checking"],
    ["Max Order", `$${Number(riskGuard?.maxOrderValue ?? maxOrderValue ?? 0).toFixed(0)}`],
    ["Risk/Trade", `$${Number(riskGuard?.riskPerTrade ?? riskPerTrade ?? 0).toFixed(0)}`],
    ["Daily Loss", `$${Number(riskGuard?.dailyLossLimit ?? dailyLossLimit ?? 0).toFixed(0)}`],
  ];

  function applyStopPreset(percent) {
    if (!entry) return;
    const direction = orderSide === "BUY" ? -1 : 1;
    setStopLoss((entry * (1 + direction * percent / 100)).toFixed(2));
  }

  function applyTargetPreset(multiplier) {
    if (!entry || !stopDistance) return;
    const direction = orderSide === "BUY" ? 1 : -1;
    setTakeProfit((entry + direction * stopDistance * multiplier).toFixed(2));
  }
  const inputStyle = (enabled = true) => createInputStyle(theme, enabled);
  const labelStyle = createLabelStyle(theme);
  const cardStyle = createCardStyle(theme);
  const sectionTitleStyle = createSectionTitleStyle(theme);

  return (
    <>
      <div style={{ margin: "2px 0 8px", display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 950 }}>Execution Ticket</h3>
          <div style={{ color: theme.muted, fontSize: "10px", marginTop: "2px" }}>
            {selectedStock} order controls
          </div>
        </div>
        <span
          style={{
            color: liveStatusColor,
            background: effectiveTradingMode === "paper" || liveReady ? "rgba(0,200,150,0.10)" : "rgba(245,184,75,0.10)",
            border: `1px solid ${effectiveTradingMode === "paper" || liveReady ? "rgba(0,200,150,0.35)" : "rgba(245,184,75,0.40)"}`,
            borderRadius: "999px",
            padding: "4px 8px",
            fontSize: "9px",
            fontWeight: 950,
            whiteSpace: "nowrap",
          }}
        >
          {liveStatusLabel}
        </span>
      </div>

      <div
        style={{
          background: `linear-gradient(180deg, ${theme.panel2}, ${theme.panel})`,
          border: `1px solid ${theme.borderSoft || theme.border}`,
          borderRadius: "8px",
          padding: "10px",
          display: "grid",
          gap: "10px",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px" }}>
          {[
            ["Entry", `$${Number(orderEntryPrice || 0).toFixed(2)}`, theme.text],
            ["Value", `$${estimatedValue}`, theme.blue],
            ["R:R", riskReward, Number(riskReward) >= 1.5 ? theme.green : theme.amber],
          ].map(([label, value, color]) => (
            <div
              key={label}
              style={{
                background: theme.panel,
                border: `1px solid ${theme.borderSoft || theme.border}`,
                borderRadius: "6px",
                padding: "7px",
                minWidth: 0,
              }}
            >
              <div style={{ color: theme.muted, fontSize: "9px", fontWeight: 950, textTransform: "uppercase" }}>{label}</div>
              <div style={{ color, fontSize: "12px", fontWeight: 950, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            ...cardStyle,
            border: `1px solid ${guardStatus === "ready" ? "rgba(0,200,150,0.38)" : "rgba(245,184,75,0.42)"}`,
            background: guardStatus === "ready" ? "rgba(0,200,150,0.045)" : "rgba(245,184,75,0.055)",
            display: "grid",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <div>
              <div style={{ color: theme.text, fontSize: "11px", fontWeight: 950 }}>Risk Guard</div>
              <div style={{ color: theme.muted, fontSize: "9px", marginTop: "2px" }}>
                Execution safety before any paper/live submit
              </div>
            </div>
            <span
              style={{
                color: guardColor,
                border: `1px solid ${guardColor}55`,
                background: `${guardColor}12`,
                borderRadius: "999px",
                padding: "3px 7px",
                fontSize: "8.5px",
                fontWeight: 950,
                whiteSpace: "nowrap",
              }}
            >
              {riskGuard?.statusLabel || (canSubmit ? "Guard Ready" : "Guard Blocked")}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "5px" }}>
            {guardRows.map(([label, value]) => (
              <div
                key={label}
                style={{
                  background: theme.panel,
                  border: `1px solid ${theme.borderSoft || theme.border}`,
                  borderRadius: "6px",
                  padding: "6px",
                  minWidth: 0,
                }}
              >
                <div style={{ color: theme.muted, fontSize: "8px", fontWeight: 950, textTransform: "uppercase" }}>{label}</div>
                <div style={{ color: theme.text, fontSize: "10px", fontWeight: 900, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {riskGuard?.primaryBlockingReason && (
            <div style={{ color: theme.amber, fontSize: "10px", lineHeight: 1.45, fontWeight: 800 }}>
              {riskGuard.primaryBlockingReason}
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
          }}
        >
          <button
            onClick={() => setTradingMode("paper")}
            style={{
              ...buttonStyle(effectiveTradingMode === "paper"),
              background: effectiveTradingMode === "paper" ? theme.blue : theme.panel3 || theme.panel,
            }}
          >
            Paper
          </button>

          <button
            onClick={() => liveTradingEnabled && setTradingMode("live")}
            disabled={!liveTradingEnabled}
            title="Open live readiness and backend broker execution checks"
            style={{
              ...buttonStyle(effectiveTradingMode !== "paper"),
              background: effectiveTradingMode !== "paper" ? theme.amber : theme.panel3 || theme.panel,
              border: effectiveTradingMode !== "paper" ? "none" : `1px solid rgba(245,184,75,0.42)`,
              color: effectiveTradingMode !== "paper" ? "#061018" : theme.amber,
              opacity: liveTradingEnabled ? 1 : 0.48,
              cursor: liveTradingEnabled ? "pointer" : "not-allowed",
            }}
          >
            {liveTradingEnabled ? (compact ? "Live" : "Live Readiness") : "Paper Only"}
          </button>
        </div>

        {effectiveTradingMode !== "paper" && (
          <div
            style={{
              ...cardStyle,
              border: `1px solid ${liveReady ? "rgba(0,200,150,0.42)" : "rgba(245,184,75,0.42)"}`,
              background: liveReady ? "rgba(0,200,150,0.055)" : "rgba(245,184,75,0.055)",
              display: "grid",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
              <div>
                <div style={{ color: theme.text, fontWeight: 950, fontSize: "11px" }}>Live Readiness</div>
                <div style={{ color: theme.muted, fontSize: "9px", marginTop: "2px" }}>
                  Backend-controlled broker execution gate
                </div>
              </div>
              <div style={{ color: liveStatusColor, fontSize: "9px", fontWeight: 950 }}>
                {liveReady ? "READY" : "SUBMIT DISABLED"}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "5px" }}>
              {liveCheckRows.map(([label, ok]) => (
                <div
                  key={label}
                  style={{
                    border: `1px solid ${ok ? "rgba(0,200,150,0.34)" : theme.borderSoft || theme.border}`,
                    background: ok ? "rgba(0,200,150,0.07)" : theme.panel,
                    borderRadius: "6px",
                    padding: "6px",
                  }}
                >
                  <div style={{ color: theme.muted, fontSize: "8px", fontWeight: 950, textTransform: "uppercase" }}>{label}</div>
                  <div style={{ color: ok ? theme.green : theme.amber, fontSize: "10px", fontWeight: 950, marginTop: "2px" }}>
                    {ok ? "OK" : "Blocked"}
                  </div>
                </div>
              ))}
            </div>

            {(visibleLiveBlocks.length > 0 || visibleLiveWarnings.length > 0) && (
              <div style={{ display: "grid", gap: "4px", fontSize: "10px", lineHeight: "1.45" }}>
                {[...visibleLiveBlocks.slice(0, 3), ...visibleLiveWarnings.slice(0, 1)].map((item) => (
                  <div key={item} style={{ color: visibleLiveBlocks.includes(item) ? theme.amber : theme.muted }}>
                    {item}
                  </div>
                ))}
              </div>
            )}

            {liveOrderPreview && (
              <div
                style={{
                  borderTop: `1px solid ${theme.borderSoft || theme.border}`,
                  paddingTop: "7px",
                  display: "grid",
                  gap: "4px",
                  fontSize: "10px",
                  color: theme.muted,
                }}
              >
                <div style={{ color: theme.text, fontWeight: 950 }}>Backend Preview</div>
                <div>
                  Request: <b style={{ color: theme.blue, fontFamily: "'JetBrains Mono', monospace" }}>{liveOrderPreview.requestId || "Pending"}</b>
                </div>
                <div>
                  Value: <b style={{ color: theme.text, fontFamily: "'JetBrains Mono', monospace" }}>
                    {liveOrderPreview.estimatedValue ? `$${Number(liveOrderPreview.estimatedValue).toFixed(2)}` : "Pending"}
                  </b>
                </div>
                <div>
                  Impact: <b style={{ color: liveOrderPreview.impact?.ok ? theme.green : theme.amber }}>
                    {liveOrderPreview.impact?.attempted
                      ? liveOrderPreview.impact.ok
                        ? "Confirmed"
                        : "Rejected"
                      : "Not run"}
                  </b>
                </div>
                {visiblePreviewErrors.slice(0, 2).map((item) => (
                  <div key={item} style={{ color: theme.amber }}>{item}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <button
            onClick={() => setOrderSide("BUY")}
            style={{
              ...buttonStyle(orderSide === "BUY"),
              background: orderSide === "BUY" ? theme.green : theme.panel,
              border: orderSide === "BUY" ? "none" : `1px solid ${theme.border}`,
            }}
          >
            BUY
          </button>

          <button
            onClick={() => setOrderSide("SELL")}
            style={{
              ...buttonStyle(orderSide === "SELL"),
              background: orderSide === "SELL" ? theme.red : theme.panel,
              border: orderSide === "SELL" ? "none" : `1px solid ${theme.border}`,
            }}
          >
            SELL
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <button
            onClick={() => setOrderType("MARKET")}
            style={buttonStyle(orderType === "MARKET")}
          >
            Market
          </button>

          <button
            onClick={() => setOrderType("LIMIT")}
            style={buttonStyle(orderType === "LIMIT")}
          >
            Limit
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <label style={labelStyle}>
            Quantity
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={inputStyle()}
            />
          </label>

          <label style={labelStyle}>
            Limit Price
            <input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              disabled={orderType !== "LIMIT"}
              placeholder={String(selectedStockData?.price || "")}
              style={inputStyle(orderType === "LIMIT")}
            />
          </label>
        </div>

        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "10px" }}>
            <span style={sectionTitleStyle}>Position Aware Sizing</span>
            <span style={{ color: theme.muted }}>
              Position {currentPosition} @ ${positionAverage.toFixed(2)}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <label style={labelStyle}>
              Risk / Trade $
              <input
                type="number"
                value={riskPerTrade}
                onChange={(e) => setRiskPerTrade(e.target.value)}
                style={inputStyle()}
              />
            </label>
            <button
              onClick={() => suggestedRiskQty && setQuantity(String(suggestedRiskQty))}
              disabled={!suggestedRiskQty}
              style={{
                ...buttonStyle(Boolean(suggestedRiskQty)),
                marginTop: "20px",
                opacity: suggestedRiskQty ? 1 : 0.55,
              }}
            >
              {suggestedRiskQty ? `Use ${suggestedRiskQty} Sh` : compact ? "Set Stop" : "Set Stop First"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "5px" }}>
            {[0.5, 1, 2].map((preset) => (
              <button key={preset} onClick={() => applyStopPreset(preset)} style={buttonStyle(false)}>
                Stop {preset}%
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "5px" }}>
            {[1.5, 2, 3].map((preset) => (
              <button key={preset} onClick={() => applyTargetPreset(preset)} style={buttonStyle(false)}>
                Target {preset}R
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <label style={labelStyle}>
            Max Order $
            <input
              type="number"
              value={maxOrderValue}
              onChange={(e) => setMaxOrderValue(e.target.value)}
              style={inputStyle()}
            />
          </label>

          <label style={labelStyle}>
            Loss Lockout $
            <input
              type="number"
              value={dailyLossLimit}
              onChange={(e) => setDailyLossLimit(e.target.value)}
              style={inputStyle()}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <label style={labelStyle}>
            Stop Loss
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="Optional"
              style={inputStyle()}
            />
          </label>

          <label style={labelStyle}>
            Take Profit
            <input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="Optional"
              style={inputStyle()}
            />
          </label>
        </div>

        <div style={{ ...cardStyle, gridTemplateColumns: "1fr 1fr", fontSize: "10px", lineHeight: "1.5", color: theme.muted }}>
          <div style={{ gridColumn: "1 / -1", ...sectionTitleStyle }}>Order Math</div>
          <div>
            Symbol: <b style={{ color: theme.text }}>{selectedStock}</b>
          </div>
          <div>
            Entry: <b style={{ color: theme.text }}>${Number(orderEntryPrice || 0).toFixed(2)}</b>
          </div>
          <div>
            Est. Value: <b style={{ color: theme.text }}>${estimatedValue}</b>
          </div>
          <div>
            R:R: <b style={{ color: theme.blue }}>{riskReward}</b>
          </div>
          <div>
            Risk: <b style={{ color: orderRisk > 0 ? theme.red : theme.text }}>${orderRisk.toFixed(2)}</b>
          </div>
          <div>
            Reward: <b style={{ color: orderReward > 0 ? theme.green : theme.text }}>${orderReward.toFixed(2)}</b>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "5px",
          }}
        >
          {checklist.map(([label, ok]) => (
            <div
              key={label}
              style={{
                padding: "5px",
                borderRadius: "5px",
                border: `1px solid ${ok ? "rgba(0,200,150,0.35)" : theme.border}`,
                background: ok ? "rgba(0,200,150,0.08)" : theme.panel3 || theme.panel,
                color: ok ? theme.green : theme.muted,
                fontSize: "9px",
                fontWeight: 900,
                textAlign: "center",
              }}
            >
              {ok ? "OK " : "Check "}
              {label}
            </div>
          ))}
        </div>

        <div
          style={{
            ...cardStyle,
            border: `1px solid ${canSubmit ? "rgba(0,200,150,0.45)" : "rgba(239,83,80,0.50)"}`,
            fontSize: "10px",
            lineHeight: "1.55",
            color: theme.muted,
          }}
        >
          <div style={{ color: theme.text, fontWeight: 900, marginBottom: "4px" }}>
            Order Preview
          </div>
          <div>
            {orderPreview.mode.toUpperCase()} {orderPreview.side} {orderPreview.quantity}{" "}
            {orderPreview.symbol} @ ${orderPreview.entryPrice.toFixed(2)}
          </div>
          <div>Value: ${orderPreview.value.toFixed(2)}</div>
          <div>
            Guardrails: max ${orderPreview.maxOrderValue.toFixed(2)} / loss lockout $
            {orderPreview.dailyLossLimit.toFixed(2)}
          </div>
          <div>
            Risk cap: ${orderPreview.riskPerTrade.toFixed(2)} / order risk ${orderRisk.toFixed(2)}
          </div>
          <div>Realized loss today: ${orderPreview.dailyRealizedLoss.toFixed(2)}</div>

          {visibleSafetyIssues.length > 0 && (
            <div style={{ display: "grid", gap: "3px", marginTop: "5px" }}>
              {visibleSafetyIssues.map((issue) => (
                <div key={issue} style={{ color: theme.red, fontWeight: 850 }}>
                  {issue}
                </div>
              ))}
            </div>
          )}
        </div>

        <label
          style={{
            display: "flex",
            gap: "7px",
            alignItems: "flex-start",
            fontSize: "10px",
            color: theme.text,
            lineHeight: "1.35",
          }}
        >
          <input
            type="checkbox"
            checked={orderConfirmed === orderConfirmationKey}
            onChange={(e) =>
              setOrderConfirmed(e.target.checked ? orderConfirmationKey : "")
            }
          />
          <span>I reviewed the symbol, side, quantity, price, and guardrails.</span>
        </label>

        {effectiveTradingMode !== "paper" && (
          <button
            onClick={() => previewLiveOrderTicket?.(orderSide)}
            disabled={liveOrderLoading}
            style={{
              ...buttonStyle(true),
              width: "100%",
              background: theme.blue,
              opacity: liveOrderLoading ? 0.7 : 1,
              cursor: liveOrderLoading ? "wait" : "pointer",
            }}
          >
            {liveOrderLoading ? "Checking Backend..." : "Preview Live Order"}
          </button>
        )}

        <button
          onClick={() => submitOrderTicket?.(orderSide)}
          aria-disabled={!canSubmit}
          title={!canSubmit ? riskGuard?.primaryBlockingReason || visibleSafetyIssues[0] || "Risk guard blocked this order." : "Submit guarded order"}
          style={{
            ...buttonStyle(true),
            width: "100%",
            background: canSubmit
              ? orderSide === "BUY"
                ? theme.green
                : theme.red
              : theme.panel2,
            border: canSubmit ? "none" : `1px solid ${theme.border}`,
            color: canSubmit ? "#ffffff" : theme.muted,
            opacity: 1,
            cursor: "pointer",
          }}
        >
          Submit {effectiveTradingMode === "paper" ? "Paper" : "Live"} {orderSide}
        </button>

        <div style={{ fontSize: "10px", color: theme.muted, lineHeight: "1.4" }}>
          {orderMessage ||
            "Paper execution only. Real broker routing can be connected later through the Questrade order API."}
        </div>
      </div>
    </>
  );
}
