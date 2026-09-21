import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cancelPaperOrder, paperBalances, processPaperOrders, submitPaperOrder } from '../services/paperTradingEngine.js';
import { getUsMarketStatus } from '../utils/marketSession.js';

export function usePaperTrading({ state, setState, quotes, enabled, limits }) {
  const current = useRef({ state, quotes, enabled, limits });
  const [now, setNow] = useState(Date.now);
  useLayoutEffect(() => { current.current = { state, quotes, enabled, limits }; }, [state, quotes, enabled, limits]);
  const commit = useCallback(next => {
    if (next === current.current.state) return;
    current.current.state = next;
    setState(next);
  }, [setState]);
  useEffect(() => {
    const process = () => {
      const data = current.current;
      if (data.enabled && document.visibilityState !== 'hidden') commit(processPaperOrders(data.state, data.quotes, Date.now()));
    };
    process();
    const timer = setInterval(process, 1000);
    // Quote updates may arrive faster than the periodic clock; refresh the
    // valuation clock on each update so current quotes never look future-dated.
    const pendingClock = setTimeout(() => setNow(Date.now()), 0);
    const clock = setInterval(() => setNow(Date.now()), 15000);
    document.addEventListener('visibilitychange', process);
    return () => { clearInterval(timer); clearInterval(clock); clearTimeout(pendingClock); document.removeEventListener('visibilitychange', process); };
  }, [commit, quotes, enabled]);
  const submit = useCallback(draft => {
    const data = current.current;
    if (!data.enabled) return { error: 'Your workspace is still loading. Please try again when it is ready.' };
    const result = submitPaperOrder(data.state, draft, data.quotes, Date.now(), data.limits);
    if (!result.error) commit(result.state);
    return result;
  }, [commit]);
  const cancel = useCallback(id => {
    if (!current.current.enabled) return { error: 'Wait for your workspace to finish loading.' };
    const result = cancelPaperOrder(current.current.state, id);
    if (!result.error) commit(result.state);
    return result;
  }, [commit]);
  const balances = useMemo(() => paperBalances(state, quotes, now), [state, quotes, now]);
  return { submit, cancel, balances, ready: enabled, session: getUsMarketStatus(new Date(now)), orders: state.orders, positions: state.positions };
}
