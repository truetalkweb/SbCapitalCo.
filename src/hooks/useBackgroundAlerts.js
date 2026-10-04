import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '../services/authenticatedRequest.js';
import { BROKER_API_URL } from '../config/terminalConfig.js';

// Server mode is opt-in. Local workspace alerts remain usable while it is off.
export function useBackgroundAlerts({ userId, enabled, alerts, setAlerts, controllerRef, onState, activityEnabled = true }) {
  const [connection, setConnection] = useState({ ready: false, enabled: false, error: '' });
  const [saving, setSaving] = useState(false);
  const owner = useRef(userId), revision = useRef(-1), busy = useRef(false);
  const pendingCommand = useRef(null);
  useLayoutEffect(() => { owner.current = userId; revision.current = -1; }, [userId]);
  const apply = useCallback((payload, id) => {
    if (owner.current !== id) return;
    if (!Array.isArray(payload.alerts) || !Number.isSafeInteger(payload.revision)) throw new Error('Invalid background alert response.');
    if (payload.revision < revision.current) return;
    revision.current = payload.revision;
    const next = { ...payload, userId: id, ready: true, error: '' };
    setConnection(next); onState(next);
    if (payload.enabled) setAlerts(payload.alerts);
  }, [onState, setAlerts]);
  const command = useCallback(async request => {
    if (!enabled || !userId || busy.current) return { error: 'Background alert connection is not ready.' };
    busy.current = true; setSaving(true);
    try {
      const fingerprint = JSON.stringify([userId, request]);
      if (pendingCommand.current?.fingerprint !== fingerprint) pendingCommand.current = { fingerprint, id: crypto.randomUUID() };
      const response = await authenticatedFetch(`${BROKER_API_URL}/api/alerts/commands`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ command: { ...request, id: pendingCommand.current.id } }),
      });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Alert change failed.');
      apply(payload, userId);
      pendingCommand.current = null;
      // Disabling retains the latest server history in the local workspace.
      if (!payload.enabled && owner.current === userId) setAlerts(payload.alerts);
      return payload;
    } catch (error) {
      const next = { ...connection, error: error.message };
      if (owner.current === userId) { setConnection(next); onState(next); }
      return { error: error.message };
    } finally { busy.current = false; setSaving(false); }
  }, [enabled, userId, apply, setAlerts, connection, onState]);
  useLayoutEffect(() => {
    controllerRef.current = connection.userId === userId && connection.enabled && enabled && connection.ready ? { command } : null;
    return () => { controllerRef.current = null; };
  }, [controllerRef, command, connection.enabled, connection.ready, connection.userId, userId, enabled]);
  useEffect(() => {
    if (connection.userId === userId && connection.ready && connection.enabled && connection.paused === activityEnabled) {
      void command({ kind: 'pause', paused: !activityEnabled });
    }
  }, [activityEnabled, connection.paused, connection.ready, connection.enabled, connection.userId, userId, command]);
  useEffect(() => {
    if (!enabled || !userId) return;
    let stopped = false, timer; const abort = new AbortController();
    const refresh = async () => {
      try {
        const response = await authenticatedFetch(`${BROKER_API_URL}/api/alerts/account`, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]) });
        const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Background alerts unavailable.');
        if (!stopped) apply(payload, userId);
      } catch (error) {
        if (!stopped) setConnection(current => ({ ...current, userId, error: error.message }));
      } finally { if (!stopped) timer = setTimeout(refresh, 15000); }
    };
    void refresh();
    return () => { stopped = true; clearTimeout(timer); abort.abort(); };
  }, [enabled, userId, apply]);
  return { ...(connection.userId === userId && enabled ? connection : { enabled: false, ready: false }), saving, setEnabled: value => command({ kind: 'monitoring', enabled: value, paused: !activityEnabled, ...(value ? { alerts } : {}) }) };
}
