import { useCallback, useEffect, useRef, useState } from "react";
import { loadSetting } from "../utils/storage.js";
import { normalizeMarketQuote } from "../utils/marketDataContract.js";

export { shouldTriggerPriceAlert } from '../utils/priceAlerts.js';
import { shouldTriggerPriceAlert } from '../utils/priceAlerts.js';

export function makePriceAlert({ symbol, trigger, direction = "above" }) {
  const cleanSymbol = String(symbol || "").trim().toUpperCase();
  const price = Number(trigger);
  if (!/^[A-Z0-9][A-Z0-9./:-]{0,13}$/.test(cleanSymbol) || !Number.isFinite(price) || price <= 0 || !["above", "below"].includes(direction)) return null;
  return { id: crypto.randomUUID(), symbol: cleanSymbol, trigger: price, direction,
    active: true, createdAt: new Date().toISOString(), triggeredAt: null, history: [] };
}

function playTerminalAlertSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 740;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.17);
    oscillator.addEventListener("ended", () => context.close().catch(() => {}), { once: true });
  } catch {
    // Sound is optional and can be blocked by browser autoplay policy.
  }
}

export function useTerminalAlerts({ selectedStock, selectedStockData, quotes = [], alertActivityEnabled = true, soundAlertsEnabled = false, serverController, serverState }) {
  const [alerts, setAlerts] = useState(() => loadSetting("sb_alerts", []));
  const [alertInput, setAlertInput] = useState("");
  const [alertDirection, setAlertDirection] = useState("above");
  const [alertNotifications, setAlertNotifications] = useState(false);
  const serverSeen = useRef(null);

  const createPriceAlert = useCallback(({ symbol = selectedStock, trigger, direction = "above" }) => {
    const next = makePriceAlert({ symbol, trigger, direction });
    if (!next) return false;
    if (serverState && (!serverState.ready || serverState.enabled && !serverController?.current)) return false;
    if (serverController?.current) {
      return serverController.current.command({ kind: 'upsert', alert: next }, { create: true }).then(result => !result.error);
    }
    setAlerts(prev => [next, ...prev]);
    return true;
  }, [selectedStock, serverController, serverState]);

  const addPriceAlert = useCallback(async () => {
    if (await createPriceAlert({ symbol: selectedStock, trigger: alertInput, direction: alertDirection })) setAlertInput("");
  }, [alertDirection, alertInput, createPriceAlert, selectedStock]);

  const updateAlert = useCallback((id, updates) => {
    if (serverState && (!serverState.ready || serverState.enabled && !serverController?.current)) return;
    if (serverController?.current) {
      const old = alerts.find(alert => alert.id === id);
      if (old) void serverController.current.command({ kind: 'upsert', alert: { ...old, ...updates } });
      return;
    }
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
  }, [serverController, serverState, alerts]);

  const toggleAlert = useCallback((id) => {
    if (serverState && (!serverState.ready || serverState.enabled && !serverController?.current)) return;
    if (serverController?.current) {
      const old = alerts.find(alert => alert.id === id);
      if (old) void serverController.current.command({ kind: 'upsert', alert: { ...old, active: !old.active } });
      return;
    }
    setAlerts((prev) => prev.map((alert) => alert.id === id
      ? {
          ...alert,
          active: !alert.active,
          triggeredAt: alert.active ? alert.triggeredAt : null,
          updatedAt: new Date().toISOString(),
        }
      : alert));
  }, [serverController, serverState, alerts]);

  const enableAlertNotifications = useCallback(async () => {
    if (!("Notification" in window)) {
      setAlertNotifications(false);
      return;
    }

    const permission = await Notification.requestPermission();
    setAlertNotifications(permission === "granted");
  }, []);

  const removeAlert = useCallback((id) => {
    if (serverState && (!serverState.ready || serverState.enabled && !serverController?.current)) return;
    if (serverController?.current) { void serverController.current.command({ kind: 'remove', alertId: id }); return; }
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  }, [serverController, serverState]);

  useEffect(() => {
    if (!serverState?.enabled) { serverSeen.current = null; return; }
    const events = alerts.flatMap(alert => (alert.history || []).map(event => ({ ...event, symbol: alert.symbol })));
    const keys = new Set(events.map(event => event.id));
    if (serverSeen.current?.userId === serverState.userId) {
      const fresh = events.filter(event => !serverSeen.current.keys.has(event.id));
      if (fresh.length && alertActivityEnabled) {
        if (soundAlertsEnabled) playTerminalAlertSound();
        if (alertNotifications && 'Notification' in window && Notification.permission === 'granted') {
          for (const event of fresh) new Notification(`${event.symbol} alert triggered`, { body: `${event.direction} $${Number(event.trigger).toFixed(2)}` });
        }
      }
    }
    serverSeen.current = { userId: serverState.userId, keys };
  }, [alerts, serverState?.enabled, serverState?.userId, alertActivityEnabled, soundAlertsEnabled, alertNotifications]);

  useEffect(() => {
    if (!alertActivityEnabled || serverState?.enabled || serverState && !serverState.ready) return undefined;

    const quoteMap = new Map(
      [...quotes, selectedStockData]
        .filter(Boolean)
        .map((quote) => normalizeMarketQuote(quote))
        .filter((quote) => quote.quality === "live")
        .sort((a, b) => a.asOf - b.asOf)
        .map((quote) => [quote.symbol, quote])
    );
    const now = new Date().toISOString();

    const timeout = window.setTimeout(() => {
      let changed = false;
      let shouldPlaySound = false;
      const nextAlerts = alerts.map((alert) => {
        const quote = quoteMap.get(String(alert.symbol || "").toUpperCase());
        if (!shouldTriggerPriceAlert(alert, quote, alertActivityEnabled)) return alert;
        const price = quote.price;

        changed = true;
        shouldPlaySound = shouldPlaySound || soundAlertsEnabled;
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
              source: quote.source,
              marketTimestamp: quote.asOf,
            },
            ...(Array.isArray(alert.history) ? alert.history : []),
          ],
        };
      });

      if (changed) setAlerts(nextAlerts);
      if (shouldPlaySound) playTerminalAlertSound();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [alertActivityEnabled, alertNotifications, alerts, quotes, selectedStockData, soundAlertsEnabled, serverState?.enabled, serverState?.ready, serverState]);

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
