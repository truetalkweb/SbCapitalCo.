import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '../services/authenticatedRequest.js';
import { BROKER_API_URL } from '../config/terminalConfig.js';
import { prepareAlertCommand, acknowledgeAlertCommand, readPendingAlertCommand } from '../services/alertCommandRecovery.js';

// Server mode is opt-in. Local workspace alerts remain usable while it is off.
export function useBackgroundAlerts({ userId, enabled, alerts, setAlerts, controllerRef, onState, activityEnabled = true }) {
  const [connection, setConnection] = useState({ ready: false, enabled: false, error: '' });
  const [saving, setSaving] = useState(false);
  const owner = useRef(null), revision = useRef(-1), busy = useRef(null), lastError = useRef('');
  useLayoutEffect(() => {
    const session = { id: userId, enabled };
    owner.current = session; revision.current = -1; lastError.current = '';
    busy.current?.abort(); busy.current = null;
    return () => { if (owner.current === session) { owner.current = null; busy.current?.abort(); busy.current = null; } };
  }, [userId, enabled]);
  const fail = useCallback((message, session, persistent = true) => {
    if (owner.current !== session) return;
    if (persistent) lastError.current = message;
    setConnection(current => ({ ...current, error: message }));
    onState(current => ({ ...current, error: message }));
  }, [onState]);
  const apply = useCallback((payload, session, copyDisabled = false) => {
    if (owner.current !== session) return;
    if (!Array.isArray(payload.alerts) || !Number.isSafeInteger(payload.revision) || payload.revision < 0 || typeof payload.enabled !== 'boolean') throw new Error('Invalid background alert response.');
    if (payload.revision < revision.current) return;
    revision.current = payload.revision;
    const next = { ...payload, userId: session.id, ready: true, error: lastError.current };
    setConnection(next); onState(next);
    if (payload.enabled || copyDisabled) setAlerts(payload.alerts);
  }, [onState, setAlerts]);
  const command = useCallback(async (request, options = {}) => {
    const session = owner.current;
    if (!session?.enabled || !session.id || busy.current) return { error: 'Background alert connection is not ready.' };
    const abort = new AbortController(); busy.current = abort; setSaving(true);
    let prepared;
    try {
      prepared = options.recover ? readPendingAlertCommand(session.id)?.command : prepareAlertCommand(request, session.id, options);
      if (!prepared) return null;
      const response = await authenticatedFetch(`${BROKER_API_URL}/api/alerts/commands`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
        body: JSON.stringify({ command: prepared }),
      });
      const payload = await response.json();
      if (!response.ok) {
        // Validation/auth rejection confirms no mutation; server/network failures remain uncertain.
        if ([400, 401, 403, 404, 422].includes(response.status)) acknowledgeAlertCommand(prepared, session.id);
        throw new Error(payload.error || 'Alert change failed.');
      }
      if (owner.current !== session) return { error: 'Alert account changed; refresh to confirm the original change.' };
      lastError.current = ''; apply(payload, session, true);
      acknowledgeAlertCommand(prepared, session.id);
      return payload;
    } catch (error) {
      fail(error.message, session); return { error: error.message };
    } finally {
      if (busy.current === abort) { busy.current = null; setSaving(false); }
    }
  }, [apply, setAlerts, fail]);
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
    const session = owner.current;
    let stopped = false, timer; const abort = new AbortController();
    const refresh = async () => {
      try {
        await command(null, { recover: true });
        if (stopped) return;
        const response = await authenticatedFetch(`${BROKER_API_URL}/api/alerts/account`, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]) });
        const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Background alerts unavailable.');
        if (!stopped) apply(payload, session);
      } catch (error) { if (!stopped) fail(error.message, session, false); }
      finally { if (!stopped) timer = setTimeout(refresh, 15000); }
    };
    void refresh();
    return () => { stopped = true; clearTimeout(timer); abort.abort(); };
  }, [enabled, userId, apply, command, fail]);
  return { ...(connection.userId === userId && enabled ? connection : { enabled: false, ready: false }), saving, setEnabled: value => command({ kind: 'monitoring', enabled: value, paused: !activityEnabled, ...(value ? { alerts } : {}) }) };
}
