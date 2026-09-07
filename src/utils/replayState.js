import { appendReplayFill, calculateReplayLedger, REPLAY_LEDGER_VERSION } from "./replayLedger.js";

export const REPLAY_SPEEDS = Object.freeze([0.25, 0.5, 1, 2, 5, 10, 20, 50, 100]);

export function createReplayState() {
  return { symbol: "", interval: "", candles: [], fingerprint: "", metadata: null, events: [], index: 0,
    playing: false, speed: 1, archives: [], pendingRestore: null, message: "Historical replay data is unavailable" };
}

export function serializeReplayState(state) {
  if (state.pendingRestore) return { ...state.pendingRestore,
    archives: mergeArchives(state.archives, state.pendingRestore.archives) };
  return { version: REPLAY_LEDGER_VERSION, symbol: state.symbol, interval: state.interval,
    fingerprint: state.fingerprint, events: state.events, index: state.index, archives: state.archives };
}

function mergeArchives(current, saved) {
  const records = [...current, ...(Array.isArray(saved) ? saved : [])];
  const seen = new Set();
  return records.filter(record => {
    const key = JSON.stringify(record);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function archive(state, reason) {
  if (!state.events.length) return state.archives;
  return [...state.archives, { version: REPLAY_LEDGER_VERSION, symbol: state.symbol, interval: state.interval,
    fingerprint: state.fingerprint, events: state.events, index: state.index, reason }];
}

function restorePending(state) {
  const saved = state.pendingRestore;
  if (!saved || !state.fingerprint) return state;
  // Workspace restoration and chart context updates are separate React updates.
  if (saved.version === REPLAY_LEDGER_VERSION && saved.symbol && saved.interval
    && (saved.symbol !== state.symbol || saved.interval !== state.interval)) return state;
  try {
    if (saved.version !== REPLAY_LEDGER_VERSION || saved.fingerprint !== state.fingerprint
      || saved.symbol !== state.symbol || saved.interval !== state.interval) throw new Error("Saved replay does not match the verified historical dataset");
    if (!Number.isInteger(saved.index) || saved.index < 0 || saved.index >= state.candles.length || !Array.isArray(saved.events)) throw new Error("Saved replay boundary is invalid");
    const visible = new Map(state.candles.slice(0, saved.index + 1).map(row => [row.time, row]));
    for (const fill of saved.events) {
      if (fill.version !== REPLAY_LEDGER_VERSION || fill.symbol !== state.symbol || !visible.has(fill.time)
        || fill.price !== visible.get(fill.time).close) throw new Error("Saved replay fill is outside its historical boundary");
    }
    calculateReplayLedger({ events: saved.events });
    return { ...state, index: saved.index, events: saved.events.map(fill => ({ ...fill })), pendingRestore: null, playing: false,
      archives: mergeArchives(state.archives, saved.archives), message: "Replay restored against matching historical data; paused" };
  } catch (error) {
    return { ...state, pendingRestore: null, events: [], index: 0, playing: false,
      archives: [...state.archives, { ...saved, reason: error.message }], message: `${error.message}. Previous records archived; a new replay starts at the first bar.` };
  }
}

export function replayReducer(state, action) {
  switch (action.type) {
    case "CONTEXT": {
      if (state.symbol === action.symbol && state.interval === action.interval) return state;
      return { ...state, symbol: action.symbol, interval: action.interval, candles: [], fingerprint: "", metadata: null,
        events: [], index: 0, playing: false, archives: archive(state, "Instrument or interval changed"),
        message: state.events.length ? "Instrument or interval changed. Previous trades archived; waiting for historical data." : "Waiting for historical data" };
    }
    case "DATASET": {
      const data = action.dataset;
      if (state.symbol && (data.symbol !== state.symbol || data.interval !== state.interval)) return state;
      const usable = ["historical", "cached", "delayed"].includes(data.quality) && !data.isSynthetic && data.candles?.length;
      if (!usable) return { ...state, candles: [], metadata: data, playing: false, message: data.reason || "Verified historical replay data is unavailable" };
      const fingerprint = JSON.stringify([data.symbol, data.interval, data.source, data.session, data.candles]);
      const changed = state.fingerprint && fingerprint !== state.fingerprint;
      const next = { ...state, symbol: data.symbol, interval: data.interval, metadata: data, candles: data.candles, fingerprint,
        index: changed ? 0 : Math.min(state.index, data.candles.length - 1), events: changed ? [] : state.events,
        archives: changed ? archive(state, "Historical dataset changed") : state.archives,
        playing: changed ? false : state.playing,
        message: changed ? "Historical dataset changed. Previous trades archived; replay reset to the first bar." : "Historical data ready; all orders are simulated" };
      return restorePending(next);
    }
    case "RESTORE": {
      const saved = action.session;
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
        return { ...state, playing: false, message: "Saved replay is invalid; existing records preserved" };
      }
      const sameEvents = saved.fingerprint === state.fingerprint
        && JSON.stringify(saved.events) === JSON.stringify(state.events);
      const archives = sameEvents ? state.archives : archive(state, "Replaced by restored replay");
      return restorePending({ ...state, events: [], archives, playing: false, pendingRestore: saved,
        message: "Verifying saved replay against historical data" });
    }
    case "SEEK": {
      const requested = typeof action.index === "function" ? action.index(state.index) : action.index;
      if (!Number.isInteger(requested) || !state.candles.length) return state;
      const index = Math.max(0, Math.min(requested, state.candles.length - 1));
      const rewind = index < state.index && state.events.length > 0;
      return { ...state, index, events: rewind ? [] : state.events, archives: rewind ? archive(state, "Rewound replay") : state.archives,
        playing: action.step && index < state.candles.length - 1 ? state.playing : false,
        message: rewind ? "Replay rewound. Previous trades archived; a new simulation begins here." : state.message };
    }
    case "PLAY": {
      const playing = typeof action.value === "function" ? action.value(state.playing) : action.value;
      return { ...state, playing: Boolean(playing && state.candles.length && state.index < state.candles.length - 1 && !state.pendingRestore) };
    }
    case "SPEED":
      return REPLAY_SPEEDS.includes(Number(action.value)) ? { ...state, speed: Number(action.value) } : state;
    case "FILL": {
      try {
        if (action.symbol !== state.symbol || state.pendingRestore) throw new Error("Replay instrument is not ready");
        const events = appendReplayFill({ events: state.events, candles: state.candles, index: state.index,
          symbol: state.symbol, side: action.side, quantity: action.quantity, fee: action.fee, orderType: action.orderType, id: action.id });
        return { ...state, events, message: `Simulated ${action.side.toLowerCase()} recorded at the replay candle close` };
      } catch (error) {
        return { ...state, playing: false, message: error.message };
      }
    }
    case "RESET":
      return { ...state, index: 0, events: [], playing: false, pendingRestore: null,
        archives: [...archive(state, "Replay reset"), ...(state.pendingRestore ? [{ ...state.pendingRestore, reason: "Pending restore cancelled by reset" }] : [])],
        message: "Replay reset. Previous trades archived; notes preserved." };
    default:
      return state;
  }
}
