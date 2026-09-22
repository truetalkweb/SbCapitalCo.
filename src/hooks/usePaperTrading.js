import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { paperBalances } from '../services/paperTradingEngine.js';
import { paperTradeHistory } from '../services/paperOrderCommands.js';
import { authenticatedFetch } from '../services/authenticatedRequest.js';
import { BROKER_API_URL } from '../config/terminalConfig.js';
import { getUsMarketStatus } from '../utils/marketSession.js';

export function usePaperTrading({ state, setState, quotes, enabled, limits, userId }) {
  const current = useRef({ enabled, userId, limits });
  const version = useRef({ userId, revision: -1 });
  const inFlight = useRef(false);
  const [connection, setConnection] = useState({ userId: null, ready: false, error: '' });
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  useLayoutEffect(() => { current.current = { enabled, userId, limits }; }, [enabled, userId, limits]);
  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(timer);
  }, [quotes]);
  const apply = useCallback((payload, owner) => {
    if (!current.current.enabled || current.current.userId !== owner) return;
    if (!payload.state || !Number.isSafeInteger(payload.revision)) throw new Error('Invalid paper account response.');
    if (version.current.userId !== owner) version.current = { userId: owner, revision: -1 };
    if (payload.revision >= version.current.revision) {
      version.current.revision = payload.revision;
      setState(payload.state);
    }
    setConnection({ userId: owner, ready: true, error: '', worker: payload.worker });
    setNow(Date.now());
  }, [setState]);
  useEffect(() => {
    if (!enabled || !userId) return;
    let stopped = false, timer;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await authenticatedFetch(`${BROKER_API_URL}/api/paper/account`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Paper account unavailable.');
        if (!stopped) apply(payload, userId);
      } catch (error) {
        if (!stopped) setConnection({ userId, ready: false, error: error.name === 'TimeoutError' ? 'Paper account connection timed out. Reconnecting…' : error.message });
      } finally { if (!stopped) timer = setTimeout(refresh, 5000); }
    }
    void refresh();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [enabled, userId, apply]);
  const command = useCallback(async request => {
    const data = current.current;
    if (!data.enabled) return { error: 'Wait for your workspace to finish loading.' };
    if (inFlight.current) return { error: 'An order request is still pending.' };
    inFlight.current = true; setBusy(true);
    const id = request.id || crypto.randomUUID();
    try {
      const response = await authenticatedFetch(`${BROKER_API_URL}/api/paper/commands`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ command: { ...request, id }, limits: data.limits }),
      });
      const payload = await response.json();
      if (payload.state) apply(payload, data.userId);
      if (!response.ok) return { error: payload.error || 'Paper command could not be completed.' };
      return payload;
    } catch {
      return { error: 'Response not received. Check Orders before retrying; retrying the same request will not duplicate it.', uncertain: true };
    } finally { inFlight.current = false; setBusy(false); }
  }, [apply]);
  const submit = useCallback(draft => command({ kind: 'submit', id: draft.id, draft }), [command]);
  const cancel = useCallback(orderId => command({ kind: 'cancel', orderId }), [command]);
  const balances = useMemo(() => paperBalances(state, quotes, now), [state, quotes, now]);
  const history = useMemo(() => paperTradeHistory(state), [state]);
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const dailyRealized = history.filter(row => new Date(row.closedAt).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) === today).reduce((sum, row) => sum + row.pnl, 0);
  return { submit, cancel, command, busy, balances, history, dailyRealized,
    ready: enabled && connection.userId === userId && connection.ready,
    error: connection.userId === userId ? connection.error : '', worker: connection.worker,
    session: getUsMarketStatus(new Date(now)), orders: state.orders, positions: state.positions };
}
