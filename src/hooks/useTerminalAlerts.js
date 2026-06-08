import { useCallback, useEffect, useState } from "react";
import { loadSetting } from "../utils/storage";

export function useTerminalAlerts({ selectedStock, selectedStockData }) {
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
      createdAt: new Date().toLocaleTimeString(),
    };

    setAlerts((prev) => [nextAlert, ...prev.slice(0, 8)]);
    setAlertInput("");
  }, [alertDirection, alertInput, selectedStock]);

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
    const price = Number(selectedStockData?.price || 0);
    const now = new Date().toLocaleTimeString();

    const timeout = window.setTimeout(() => {
      setAlerts((prev) => {
        let changed = false;
        const nextAlerts = prev.map((alert) => {
          if (!alert.active || alert.symbol !== selectedStock) return alert;

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
          };
        });

        return changed ? nextAlerts : prev;
      });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [alertNotifications, selectedStock, selectedStockData]);

  return {
    alertDirection,
    alertInput,
    alertNotifications,
    alerts,
    addPriceAlert,
    enableAlertNotifications,
    removeAlert,
    setAlertDirection,
    setAlertInput,
    setAlerts,
  };
}
