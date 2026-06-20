import { useMemo } from "react";

function getUsMarketSession(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Vancouver",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const getPart = (type) => parts.find((item) => item.type === type)?.value || "";
  const weekday = getPart("weekday");
  const minutes = Number(getPart("hour")) * 60 + Number(getPart("minute"));
  const isWeekday = !["Sat", "Sun"].includes(weekday);
  const regularOpen = 6 * 60 + 30;
  const regularClose = 13 * 60;

  if (!isWeekday) return { label: "Closed", isRegular: false };
  if (minutes < regularOpen) return { label: "Premarket", isRegular: false };
  if (minutes <= regularClose) return { label: "Regular", isRegular: true };
  return { label: "After Hours", isRegular: false };
}

export function useOrderRisk({
  brokerConnected,
  dailyLossLimit,
  limitPrice,
  liveReadiness,
  maxOrderValue,
  orderConfirmed,
  orderSide,
  orderType,
  positions,
  quantity,
  realizedPnL,
  riskPerTrade,
  selectedBrokerAccount,
  selectedStock,
  selectedStockData,
  stopLoss,
  takeProfit,
  tradingMode,
}) {
  const estimatedValue = (
    Number(selectedStockData?.price || 0) * Number(quantity || 0)
  ).toFixed(2);

  const orderEntryPrice =
    orderType === "LIMIT" && Number(limitPrice) > 0
      ? Number(limitPrice)
      : Number(selectedStockData?.price || 0);

  const orderRisk =
    Number(stopLoss) > 0 && orderEntryPrice > 0
      ? Math.abs(orderEntryPrice - Number(stopLoss)) * Number(quantity || 0)
      : 0;

  const orderReward =
    Number(takeProfit) > 0 && orderEntryPrice > 0
      ? Math.abs(Number(takeProfit) - orderEntryPrice) * Number(quantity || 0)
      : 0;

  const riskReward =
    orderRisk > 0 && orderReward > 0
      ? (orderReward / orderRisk).toFixed(2)
      : "N/A";

  const orderValue = Number(orderEntryPrice || 0) * Number(quantity || 0);
  const quantityValue = Number(quantity || 0);
  const marketSession = getUsMarketSession();
  const dailyRealizedLoss = Math.max(0, -Number(realizedPnL || 0));
  const positionQuantity = Number(positions[selectedStock]?.quantity || 0);
  const positionAverage = Number(positions[selectedStock]?.average || 0);
  const orderPreview = {
    mode: tradingMode,
    side: orderSide,
    symbol: selectedStock,
    quantity: Number(quantity || 0),
    entryPrice: Number(orderEntryPrice || 0),
    value: orderValue,
    stopLoss: Number(stopLoss || 0),
    takeProfit: Number(takeProfit || 0),
    maxOrderValue: Number(maxOrderValue || 0),
    dailyLossLimit: Number(dailyLossLimit || 0),
    dailyRealizedLoss,
    riskPerTrade: Number(riskPerTrade || 0),
    positionQuantity,
    positionAverage,
  };

  const orderConfirmationKey = [
    tradingMode,
    orderSide,
    orderType,
    selectedStock,
    quantity,
    orderEntryPrice,
    stopLoss,
    takeProfit,
    maxOrderValue,
    dailyLossLimit,
    riskPerTrade,
  ].join("|");

  const safetyIssues = useMemo(() => {
    const issues = [];
    const maxValue = Number(maxOrderValue || 0);
    const lossLimit = Number(dailyLossLimit || 0);
    const riskCap = Number(riskPerTrade || 0);
    const entry = Number(orderEntryPrice || 0);
    const stop = Number(stopLoss || 0);
    const target = Number(takeProfit || 0);
    const limit = Number(limitPrice || 0);
    const qty = Number(quantity || 0);

    if (!selectedStock) {
      issues.push("Select a symbol before submitting.");
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      issues.push("Enter a valid quantity greater than zero.");
    }

    if (Number.isFinite(qty) && qty > 0 && !Number.isInteger(qty)) {
      issues.push("Quantity must be a whole-share value.");
    }

    if (!entry || entry <= 0) {
      issues.push("Entry price is not valid yet.");
    }

    if (orderType === "LIMIT" && (!limit || limit <= 0)) {
      issues.push("Limit orders require a valid limit price.");
    }

    if (orderType === "MARKET" && !marketSession.isRegular) {
      issues.push(`Market orders are blocked during ${marketSession.label.toLowerCase()} session.`);
    }

    if (tradingMode !== "paper") {
      if (!brokerConnected || !selectedBrokerAccount) {
        issues.push("Live routing requires a connected Questrade account.");
      }

      if (!liveReadiness) {
        issues.push("Live readiness has not loaded yet.");
      } else {
        issues.push(...(Array.isArray(liveReadiness.blockingReasons) ? liveReadiness.blockingReasons : []));
      }
    }

    if (orderConfirmed !== orderConfirmationKey) {
      issues.push("Confirm the order preview before submitting.");
    }

    if (!stop || stop <= 0) {
      issues.push("Stop loss is required before submitting.");
    }

    if (!target || target <= 0) {
      issues.push("Take profit is required before submitting.");
    }

    if (entry > 0 && stop > 0 && orderSide === "BUY" && stop >= entry) {
      issues.push("BUY stop loss must be below entry.");
    }

    if (entry > 0 && stop > 0 && orderSide === "SELL" && stop <= entry) {
      issues.push("SELL stop loss must be above entry.");
    }

    if (entry > 0 && target > 0 && orderSide === "BUY" && target <= entry) {
      issues.push("BUY take profit must be above entry.");
    }

    if (entry > 0 && target > 0 && orderSide === "SELL" && target >= entry) {
      issues.push("SELL take profit must be below entry.");
    }

    if (maxValue > 0 && orderValue > maxValue) {
      issues.push(`Order value exceeds max order limit of $${maxValue.toFixed(2)}.`);
    }

    if (riskCap > 0 && orderRisk > riskCap) {
      issues.push(`Order risk exceeds risk/trade cap of $${riskCap.toFixed(2)}.`);
    }

    if (lossLimit > 0 && dailyRealizedLoss >= lossLimit) {
      issues.push(`Daily loss lockout is active at $${lossLimit.toFixed(2)}.`);
    }

    if (tradingMode === "paper" && orderSide === "SELL" && positionQuantity <= 0) {
      issues.push(`No ${selectedStock} paper position available to sell.`);
    }

    if (orderRisk > 0 && orderReward > 0 && Number(riskReward) < 1.5) {
      issues.push("R:R is below 1.5. Adjust stop, target, or size before submitting.");
    }

    return issues;
  }, [
    brokerConnected,
    dailyLossLimit,
    dailyRealizedLoss,
    limitPrice,
    liveReadiness,
    marketSession.isRegular,
    marketSession.label,
    maxOrderValue,
    orderConfirmationKey,
    orderConfirmed,
    orderEntryPrice,
    orderReward,
    orderRisk,
    orderSide,
    orderType,
    orderValue,
    positionQuantity,
    quantity,
    riskPerTrade,
    riskReward,
    selectedBrokerAccount,
    selectedStock,
    stopLoss,
    takeProfit,
    tradingMode,
  ]);
  const primaryBlockingReason = safetyIssues[0] || null;
  const riskGuard = {
    statusLabel: primaryBlockingReason ? "Guard Blocked" : "Guard Ready",
    status: primaryBlockingReason ? "blocked" : "ready",
    primaryBlockingReason,
    mode: tradingMode === "paper" ? "Paper Mode" : "Live Mode",
    brokerStatus: tradingMode === "paper"
      ? "Paper execution"
      : brokerConnected && selectedBrokerAccount
        ? "Broker connected"
        : "Broker locked",
    marketSession: marketSession.label,
    marketOrderAllowed: orderType !== "MARKET" || marketSession.isRegular,
    quantityValid: Number.isFinite(quantityValue) && quantityValue > 0 && Number.isInteger(quantityValue),
    entryValid: Number(orderEntryPrice || 0) > 0,
    maxOrderValue: Number(maxOrderValue || 0),
    riskPerTrade: Number(riskPerTrade || 0),
    dailyLossLimit: Number(dailyLossLimit || 0),
    orderValue,
    orderRisk,
    orderConfirmed: orderConfirmed === orderConfirmationKey,
  };

  return {
    dailyRealizedLoss,
    estimatedValue,
    orderConfirmationKey,
    orderEntryPrice,
    orderPreview,
    orderReward,
    orderRisk,
    orderValue,
    positionAverage,
    positionQuantity,
    riskReward,
    riskGuard,
    safetyIssues,
  };
}
