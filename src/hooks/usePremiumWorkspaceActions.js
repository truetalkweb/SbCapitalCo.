import { useCallback, useState } from "react";

export function usePremiumWorkspaceActions({
  selectedSymbol,
  selectMainSymbol,
  setActiveWorkspace,
  setOrderConfirmed,
  setOrderMessage,
  setOrderSide,
  setPremiumDockTab,
  orderRows = [],
  positionRows = [],
  quantity,
  referencePrice,
  review: externalReview,
  setReview: externalSetReview,
  setPaperDraft,
  paperDraft,
  setQuantity,
}) {
  const [localReview, setLocalReview] = useState(null);
  const review = externalReview === undefined ? localReview : externalReview;
  const setReview = externalSetReview || setLocalReview;
  const openChart = useCallback((symbol = selectedSymbol) => {
    selectMainSymbol?.(symbol);
    setActiveWorkspace?.("charts");
  }, [selectMainSymbol, selectedSymbol, setActiveWorkspace]);

  const prepareReviewAction = useCallback((label, symbol = selectedSymbol) => {
    if (/alert/i.test(label)) {
      selectMainSymbol?.(symbol);
      setActiveWorkspace?.("alerts");
      return;
    }
    const all = /flatten/i.test(label);
    const targets = /cancel|flatten/i.test(label) ? orderRows.filter(row => (all || row.symbol === symbol) && /WORK|OPEN|PENDING|PART/i.test(row.status)).map(row=>({id:row.id,symbol:row.symbol,quantity:row.remaining ?? row.qty,kind:"Working order",source:row.source || "Workspace"})) : [];
    const positions = /close|flatten/i.test(label) ? positionRows.filter(row=>all || row.symbol===symbol).map(row=>({id:row.symbol,symbol:row.symbol,quantity:row.qty,kind:"Position",source:row.source})) : [];
    setReview({ label, symbol:all ? "All workspace symbols" : symbol, createdAt:new Date().toISOString(), targets:[...targets,...positions] });
    setActiveWorkspace?.("orders");
    setPremiumDockTab?.("orders");
    setOrderConfirmed?.(false);
    setOrderMessage?.(`${label} prepared for ${symbol}. This premium shortcut is review-only.`);
  }, [selectedSymbol, setOrderConfirmed, setOrderMessage, setPremiumDockTab, selectMainSymbol, setActiveWorkspace, orderRows, positionRows, setReview]);

  const prepareOrderReview = useCallback((side, symbol = selectedSymbol, draft = {}) => {
    const saved = paperDraft?.symbol === symbol ? paperDraft : {};
    const prepared = { ...saved, ...draft, side, symbol, id: crypto.randomUUID() };
    const reviewQuantity = prepared.quantity ?? quantity;
    const plannedPrice = ['LIMIT', 'STOP_LIMIT'].includes(prepared.type) ? Number(prepared.limitPrice || prepared.price)
      : prepared.type === 'STOP' ? Number(prepared.stopPrice || prepared.price) : null;
    setPaperDraft?.(prepared);
    if (Number(prepared.quantity) > 0) setQuantity?.(prepared.quantity);
    selectMainSymbol?.(symbol);
    setActiveWorkspace?.("orders");
    setReview({ label:`${side}${prepared.type ? ` ${prepared.type}` : ""} order review`,symbol,createdAt:new Date().toISOString(),quantity:reviewQuantity,referencePrice: plannedPrice > 0 ? plannedPrice : symbol === selectedSymbol ? referencePrice : null,
      targets:[{id:"draft",symbol,quantity:reviewQuantity,kind:`${side} draft`,source:"Workspace / review"}] });
    setOrderSide?.(side);
    setOrderConfirmed?.(false);
    setPremiumDockTab?.("orders");
    setOrderMessage?.(`${side} review prepared for ${symbol}. This shortcut is review-only; no order is submitted.`);
  }, [
    selectedSymbol,
    setOrderConfirmed,
    setOrderMessage,
    setOrderSide,
    setPremiumDockTab,
    selectMainSymbol,
    quantity,
    referencePrice,
    setActiveWorkspace,
    setReview,
    setPaperDraft,
    paperDraft,
    setQuantity,
  ]);

  return { openChart, prepareOrderReview, prepareReviewAction, review, dismissReview: () => setReview(null) };
}
