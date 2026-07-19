import { useCallback, useEffect, useState } from "react";
import { loadSetting } from "../utils/storage";

export function useTerminalAlerts({ selectedStock, selectedStockData, quotes = [] }) {
  const [alerts, setAlerts] = useState(() => loadSetting("sb_alerts", []));
  const [alertInput, setAlertInput] = useState("");
  const [alertDirection, setAlertDirection] = useState("above");
  const [alertNotifications, setAlertNotifications] = useState(false);

  const addPriceAlert = useCallback(() => {
    const trigger = Number(alertInput);

    if (!trigger || trigger <= 0) return;

    const nextAlert = {
      id: Date.now(),
      symbol: selectedStock,
      trigger,
      direction: alertDirection,
      active: true,
      createdAt: new Date().toISOString(),
      triggeredAt: null,
      history: [],
    };

    setAlerts((prev) => [nextAlert, ...prev.slice(0, 8)]);
    setAlertInput("");
  }, [alertDirection, alertInput, selectedStock]);

  const createPriceAlert = useCallback(({ symbol = selectedStock, trigger, direction = "above" }) => {
    const cleanTrigger = Number(trigger);
    const cleanSymbol = String(symbol || "").trim().toUpperCase();
    if (!cleanSymbol || !Number.isFinite(cleanTrigger) || cleanTrigger <= 0) return false;
    setAlerts((prev) => [{
      id: crypto.randomUUID(),
      symbol: cleanSymbol,
      trigger: cleanTrigger,
      direction: direction === "below" ? "below" : "above",
      active: true,
      createdAt: new Date().toISOString(),
      triggeredAt: null,
      history: [],
    }, ...prev].slice(0, 100));
    return true;
  }, [selectedStock]);

  const updateAlert = useCallback((id, updates) => {
    setAlerts((prev) => prev.map((alert) => {
      if (alert.id !== id) return alert;
      const trigger = Number(updates?.trigger ?? alert.trigger);
      return {
        ...alert,
        ...updates,
        trigger: Number.isFinite(trigger) && trigger > 0 ? trigger : alert.trigger,
        symbol: String(updates?.symbol || alert.symbol).trim().toUpperCase(),
        updatedAt: new Date().toISOString(),
      };
    }));
  }, []);

  const toggleAlert = useCallback((id) => {
    setAlerts((prev) => prev.map((alert) => alert.id === id
      ? {
          ...alert,
          active: !alert.active,
          triggeredAt: alert.active ? alert.triggeredAt : null,
          updatedAt: new Date().toISOString(),
        }
      : alert));
  }, []);

  const enableAlertNotifications = useCallback(async () => {
    if (!("Notification" in window)) {
      setAlertNotifications(false);
      return;
    }

    const permission = await Notification.requestPermission();
    setAlertNotifications(permission === "granted");
  }, []);

  const removeAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  }, []);

  useEffect(() => {
    const quoteMap = new Map(
      [...quotes, selectedStockData]
        .filter(Boolean)
        .map((quote) => [
          String(quote.symbol || "").toUpperCase(),
          Number(quote.price ?? quote.last ?? quote.currentPrice),
        ])
        .filter(([symbol, price]) => symbol && Number.isFinite(price) && price > 0)
    );
    const now = new Date().toISOString();

    const timeout = window.setTimeout(() => {
      setAlerts((prev) => {
        let changed = false;
        const nextAlerts = prev.map((alert) => {
          if (!alert.active) return alert;
          const price = quoteMap.get(String(alert.symbol || "").toUpperCase());
          if (!Number.isFinite(price)) return alert;

          const triggered =
            alert.direction === "above"
              ? price >= alert.trigger
              : price <= alert.trigger;

          if (!triggered) return alert;

          changed = true;
          if (
            alertNotifications &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            new Notification(`${alert.symbol} alert triggered`, {
              body: `${alert.direction} $${Number(alert.trigger).toFixed(2)}`,
            });
          }

          return {
            ...alert,
            active: false,
            triggeredAt: now,
            lastTriggerPrice: price,
            history: [
              {
                id: crypto.randomUUID(),
                type: "triggered",
                price,
                trigger: alert.trigger,
                direction: alert.direction,
                occurredAt: now,
              },
              ...(Array.isArray(alert.history) ? alert.history : []),
            ].slice(0, 20),
          };
        });

        return changed ? nextAlerts : prev;
      });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [alertNotifications, alerts, quotes, selectedStockData]);

  return {
    alertDirection,
    alertInput,
    alertNotifications,
    alerts,
    addPriceAlert,
    createPriceAlert,
    enableAlertNotifications,
    removeAlert,
    setAlertDirection,
    setAlertInput,
    setAlerts,
    toggleAlert,
    updateAlert,
  };
}
