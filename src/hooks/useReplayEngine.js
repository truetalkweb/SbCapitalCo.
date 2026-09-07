import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { createVisibilityAwarePoller } from "../utils/visibilityScheduler";
import { replaySnapshot } from "../utils/replayLedger.js";
import { createReplayState, replayReducer, serializeReplayState } from "../utils/replayState.js";

export function useReplayEngine({ initialReplayMode = false, quantity }) {
  const [replayMode, setReplayMode] = useState(initialReplayMode);
  const [state, dispatch] = useReducer(replayReducer, undefined, createReplayState);
  const snapshot = useMemo(() => replaySnapshot({ events: state.events, candles: state.candles,
    index: state.index, symbol: state.symbol }), [state.events, state.candles, state.index, state.symbol]);
  const replaySession = useMemo(() => serializeReplayState(state), [state]);
  const replayStats = useMemo(() => ({ ...snapshot, source: state.metadata?.source || null,
    dataQuality: state.metadata?.quality || "unavailable", message: state.message }), [snapshot, state.metadata, state.message]);
  const setReplayContext = useCallback(context => dispatch({ type: "CONTEXT", ...context }), []);
  const setMainReplayData = useCallback(dataset => dispatch({ type: "DATASET", dataset }), []);
  const setReplayIndex = useCallback(index => dispatch({ type: "SEEK", index }), []);
  const setReplayPlaying = useCallback(value => dispatch({ type: "PLAY", value }), []);
  const setReplaySpeed = useCallback(value => dispatch({ type: "SPEED", value }), []);
  const restoreReplaySession = useCallback(session => dispatch({ type: "RESTORE", session }), []);
  const stepReplay = useCallback(() => dispatch({ type: "SEEK", index: current => current + 1, step: true }), []);
  const resetReplay = useCallback(() => dispatch({ type: "RESET" }), []);
  const fill = useCallback((side, symbol) => dispatch({ type: "FILL", side, symbol, quantity, id: crypto.randomUUID() }), [quantity]);
  const replayBuy = useCallback(symbol => fill("BUY", symbol), [fill]);
  const replaySell = useCallback(symbol => fill("SELL", symbol), [fill]);

  useEffect(() => {
    if (!state.playing) return undefined;
    let previous = performance.now();
    let remainder = 0;
    return createVisibilityAwarePoller(() => {
      const now = performance.now();
      const elapsed = now - previous;
      previous = now;
      // Hidden-tab suspension is not elapsed simulation time.
      remainder += (elapsed > 1000 ? 50 : elapsed) * state.speed / 900;
      const steps = Math.floor(remainder);
      remainder -= steps;
      if (steps) dispatch({ type: "SEEK", index: current => current + steps, step: true });
    }, 50, { immediate: false, resumeImmediately: false });
  }, [state.playing, state.speed]);

  return {
    mainReplayData: state.candles, replayCandle: snapshot.candle, replayEquity: snapshot.equitySeries,
    replayIndex: state.index, replayMode, replayPlaying: state.playing, replaySpeed: state.speed,
    replayStats, replayTrades: snapshot.fills, replaySession,
    replayBuy, replaySell, resetReplay, setMainReplayData, setReplayContext, restoreReplaySession,
    setReplayIndex, setReplayMode, setReplayPlaying, setReplaySpeed, stepReplay,
  };
}
