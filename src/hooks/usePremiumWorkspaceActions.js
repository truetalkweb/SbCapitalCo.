import { useCallback } from "react";

export function usePremiumWorkspaceActions({
  selectedSymbol,
  selectMainSymbol,
  setActiveWorkspace,
  setOrderConfirmed,
  setOrderMessage,
  setOrderSide,
  setPremiumDockTab,
}) {
  const openChart = useCallback((symbol = selectedSymbol) => {
    selectMainSymbol?.(symbol);
    setActiveWorkspace?.("charts");
  }, [selectMainSymbol, selectedSymbol, setActiveWorkspace]);

  const prepareReviewAction = useCallback((label, symbol = selectedSymbol) => {
    setPremiumDockTab?.("orders");
    setOrderConfirmed?.(false);
    setOrderMessage?.(`${label} prepared for ${symbol}. This premium shortcut is review-only.`);
  }, [selectedSymbol, setOrderConfirmed, setOrderMessage, setPremiumDockTab]);

  const prepareOrderReview = useCallback((side, symbol = selectedSymbol) => {
    setOrderSide?.(side);
    setOrderConfirmed?.(false);
    setPremiumDockTab?.("orders");
    setOrderMessage?.(`${side} review prepared for ${symbol}. Use the full order ticket before any paper/live submission.`);
  }, [
    selectedSymbol,
    setOrderConfirmed,
    setOrderMessage,
    setOrderSide,
    setPremiumDockTab,
  ]);

  return { openChart, prepareOrderReview, prepareReviewAction };
}
