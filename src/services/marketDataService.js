import { normalizeQuoteEvent } from "../utils/marketDataContract.js";

const DEFAULT_BROKER_API_URL = (
  import.meta.env.VITE_BROKER_API_URL || "http://localhost:4000"
).replace(/\/+$/, "");
const ENABLE_QUOTE_SSE = import.meta.env.VITE_ENABLE_QUOTE_SSE === "true";

const STREAM_RECONNECT_BASE_MS = 1000;
const STREAM_RECONNECT_MAX_MS = 15000;
const REST_QUOTE_POLL_MS = 10000;

function normalizeSymbol(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.:-]/g, "")
    .slice(0, 16);
}

function parseEventData(event) {
  try {
    return JSON.parse(event.data);
  } catch {
    return null;
  }
}

class MarketDataService {
  constructor() {
    this.eventSource = null;
    this.subscribers = new Map();
    this.subscribedSymbols = new Set();
    this.statusCallbacks = new Set();
    this.reconnectTimer = null;
    this.connectTimer = null;
    this.pollTimer = null;
    this.pollInFlight = false;
    this.pollAbortController = null;
    this.reconnectAttempt = 0;
    this.activeStreamKey = "";
    this.status = "BACKEND";
    this.handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        clearTimeout(this.connectTimer);
        this.connectTimer = null;
        this.closeEventSource();
        this.clearPollTimer();
        this.setStatus("BACKEND");
        return;
      }
      if (this.subscribedSymbols.size) this.scheduleConnect(0);
    };
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  setStatus(status) {
    if (this.status === status) return;

    this.status = status;
    this.statusCallbacks.forEach((callback) => callback(status));
  }

  onStatus(callback) {
    this.statusCallbacks.add(callback);
    callback(this.status);
    return () => this.statusCallbacks.delete(callback);
  }

  buildStreamUrl(symbols) {
    const url = new URL(`${DEFAULT_BROKER_API_URL}/api/questrade/quotes/stream`);
    url.searchParams.set("symbols", symbols.join(","));
    return url.toString();
  }

  closeEventSource() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  clearPollTimer() {
    clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.pollAbortController?.abort();
    this.pollAbortController = null;
    this.pollInFlight = false;
  }

  getSubscribedSymbolList() {
    return [...this.subscribedSymbols].sort();
  }

  scheduleConnect(delayMs = 100) {
    clearTimeout(this.connectTimer);

    this.connectTimer = window.setTimeout(() => {
      this.connectTimer = null;
      this.connect();
    }, delayMs);
  }

  connect() {
    if (document.visibilityState === "hidden") return;
    const symbols = this.getSubscribedSymbolList();

    if (!symbols.length) {
      this.activeStreamKey = "";
      this.closeEventSource();
      this.clearPollTimer();
      this.setStatus("BACKEND");
      return;
    }

    const streamKey = symbols.join(",");

    if (!ENABLE_QUOTE_SSE || symbols.length > 20) {
      this.activeStreamKey = streamKey;
      this.closeEventSource();

      if (!this.pollTimer && !this.pollInFlight) {
        this.startRestFallback();
      }

      return;
    }

    if (this.eventSource && this.activeStreamKey === streamKey) {
      return;
    }

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.clearPollTimer();
    this.closeEventSource();
    this.activeStreamKey = streamKey;
    this.setStatus("CONNECTING");

    const source = new EventSource(this.buildStreamUrl(symbols));
    this.eventSource = source;

    source.addEventListener("open", () => {
      this.reconnectAttempt = 0;
      this.setStatus("STREAM");
    });

    source.addEventListener("status", (event) => {
      const payload = parseEventData(event);

      if (!payload) return;

      if (payload.status === "ERROR") {
        this.setStatus("ERROR");
        return;
      }

      this.setStatus("STREAM");
    });

    source.addEventListener("quote", (event) => {
      const payload = parseEventData(event);
      this.handleQuotePayload(payload);
    });

    source.onmessage = (event) => {
      const payload = parseEventData(event);
      this.handleQuotePayload(payload);
    };

    source.onerror = () => {
      if (this.eventSource !== source) return;

      this.closeEventSource();
      this.startRestFallback();
    };
  }

  startRestFallback(delayMs = 0) {
    this.setStatus(this.reconnectAttempt ? "RECONNECTING" : "BACKEND");

    clearTimeout(this.pollTimer);
    if (document.visibilityState === "hidden") return;
    if (ENABLE_QUOTE_SSE && this.subscribedSymbols.size <= 20 && !this.reconnectTimer) {
      this.reconnectTimer = window.setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, STREAM_RECONNECT_MAX_MS);
    }
    this.pollTimer = window.setTimeout(() => {
      this.pollQuotes();
    }, delayMs);
  }

  async pollQuotes() {
    const symbols = this.getSubscribedSymbolList();

    if (!symbols.length || this.pollInFlight || document.visibilityState === "hidden") return;

    this.pollInFlight = true;
    const controller = new AbortController();
    this.pollAbortController = controller;
    const batches = Array.from({ length: Math.ceil(symbols.length / 20) }, (_, index) => symbols.slice(index * 20, (index + 1) * 20));
    let timedOut = false;
    const deadline = window.setTimeout(() => { timedOut = true; controller.abort(); }, 8000 * Math.ceil(batches.length / 3));

    try {
      let nextBatch = 0;
      let delayed = false;
      let failed = false;
      const worker = async () => {
        while (nextBatch < batches.length && !controller.signal.aborted) {
          const batch = batches[nextBatch++];
          try {
            const url = new URL(`${DEFAULT_BROKER_API_URL}/api/questrade/quotes`);
            url.searchParams.set("symbols", batch.join(","));
            const response = await fetch(url.toString(), { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            if (controller.signal.aborted) return;
            delayed ||= Boolean(payload.delayed);
            this.handleQuotePayload({ ...payload, stream: { transport: "rest", mode: "backend-poll" } });
          } catch {
            failed = true;
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, batches.length) }, worker));
      if (failed || controller.signal.aborted) throw new Error("Quote batch failed");
      this.setStatus(delayed ? "DELAYED" : "BACKEND");
      this.reconnectAttempt = 0;
    } catch {
      if (controller.signal.aborted && !timedOut) return;
      const attempt = Math.min(this.reconnectAttempt + 1, 8);
      this.reconnectAttempt = attempt;
      this.setStatus("RECONNECTING");
    } finally {
      window.clearTimeout(deadline);
      const isCurrentRequest = this.pollAbortController === controller;
      if (isCurrentRequest) this.pollAbortController = null;
      if (isCurrentRequest) this.pollInFlight = false;

      if (isCurrentRequest && document.visibilityState !== "hidden") {
        const retryDelay = Math.min(
          STREAM_RECONNECT_BASE_MS * 2 ** Math.max(this.reconnectAttempt - 1, 0),
          STREAM_RECONNECT_MAX_MS
        );
        this.startRestFallback(this.reconnectAttempt ? retryDelay : REST_QUOTE_POLL_MS);
      }
    }
  }

  handleQuotePayload(payload) {
    if (!payload) return;

    const quotes = Array.isArray(payload.quotes)
      ? payload.quotes
      : Array.isArray(payload.data)
        ? payload.data
        : payload.symbol || payload.s
          ? [payload]
          : [];

    if (!quotes.length) return;

    this.reconnectAttempt = 0;
    this.setStatus(payload.delayed ? "DELAYED" : payload.stream?.transport === "rest" ? "BACKEND" : "STREAM");

    quotes.forEach((quote) => this.emitQuote(quote, payload));
  }

  emitQuote(quote, payload = {}) {
    const trade = normalizeQuoteEvent(quote, payload);
    if (!trade.symbol) return;
    const callbacks = this.subscribers.get(trade.symbol);
    callbacks?.forEach(callback => callback(trade));
  }

  sendSubscribe(symbol) {
    const cleanSymbol = normalizeSymbol(symbol);

    if (!cleanSymbol) return;

    this.subscribedSymbols.add(cleanSymbol);
    this.scheduleConnect();
  }

  subscribe(symbol, callback) {
    const cleanSymbol = normalizeSymbol(symbol);
    if (!cleanSymbol) return () => {};

    if (!this.subscribers.has(cleanSymbol)) {
      this.subscribers.set(cleanSymbol, new Set());
    }

    this.subscribers.get(cleanSymbol).add(callback);
    this.subscribedSymbols.add(cleanSymbol);
    this.scheduleConnect();

    return () => {
      const callbacks = this.subscribers.get(cleanSymbol);
      if (!callbacks) return;

      callbacks.delete(callback);

      if (callbacks.size === 0) {
        this.subscribers.delete(cleanSymbol);
        this.subscribedSymbols.delete(cleanSymbol);
        this.scheduleConnect();
      }
    };
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.connectTimer);
    this.clearPollTimer();
    this.reconnectAttempt = 0;
    this.activeStreamKey = "";
    this.subscribedSymbols.clear();
    this.subscribers.clear();
    this.closeEventSource();
    this.setStatus("BACKEND");
  }
}

export const marketDataService = new MarketDataService();
