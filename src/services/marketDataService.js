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

function getQuoteTimestamp(quote) {
  const explicitTimestamp = Number(quote.timestamp || quote.t || 0);

  if (Number.isFinite(explicitTimestamp) && explicitTimestamp > 0) {
    return explicitTimestamp > 10_000_000_000
      ? Math.floor(explicitTimestamp / 1000)
      : Math.floor(explicitTimestamp);
  }

  const tradeTime = quote.lastTradeTime || quote.updatedAt;
  const tradeTimeMs = tradeTime ? new Date(tradeTime).getTime() : 0;

  return Number.isFinite(tradeTimeMs) && tradeTimeMs > 0
    ? Math.floor(tradeTimeMs / 1000)
    : Math.floor(Date.now() / 1000);
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
    this.reconnectAttempt = 0;
    this.activeStreamKey = "";
    this.status = "BACKEND";
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
    const symbols = this.getSubscribedSymbolList();

    if (!symbols.length) {
      this.activeStreamKey = "";
      this.closeEventSource();
      this.clearPollTimer();
      this.setStatus("BACKEND");
      return;
    }

    const streamKey = symbols.join(",");

    if (!ENABLE_QUOTE_SSE) {
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
    clearTimeout(this.reconnectTimer);
    this.setStatus("BACKEND");

    clearTimeout(this.pollTimer);
    this.pollTimer = window.setTimeout(() => {
      this.pollQuotes();
    }, delayMs);
  }

  async pollQuotes() {
    const symbols = this.getSubscribedSymbolList();

    if (!symbols.length || this.pollInFlight) return;

    this.pollInFlight = true;

    try {
      const url = new URL(`${DEFAULT_BROKER_API_URL}/api/questrade/quotes`);
      url.searchParams.set("symbols", symbols.join(","));
      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      this.handleQuotePayload({
        ...payload,
        stream: {
          transport: "rest",
          mode: "backend-poll",
        },
      });
      this.setStatus(payload.delayed ? "DELAYED" : "BACKEND");
      this.reconnectAttempt = 0;
    } catch {
      const attempt = Math.min(this.reconnectAttempt + 1, 8);
      this.reconnectAttempt = attempt;
      this.setStatus("RECONNECTING");
    } finally {
      this.pollInFlight = false;

      const retryDelay = Math.min(
        STREAM_RECONNECT_BASE_MS * 2 ** Math.max(this.reconnectAttempt - 1, 0),
        STREAM_RECONNECT_MAX_MS
      );
      this.startRestFallback(this.reconnectAttempt ? retryDelay : REST_QUOTE_POLL_MS);
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
    this.setStatus(payload.delayed ? "DELAYED" : "STREAM");

    quotes.forEach((quote) => this.emitQuote(quote, payload));
  }

  emitQuote(quote, payload = {}) {
    const symbol = normalizeSymbol(quote.symbol || quote.s);
    const price = Number(
      quote.price ||
        quote.p ||
        quote.lastTradePrice ||
        quote.lastTradePriceTrHrs ||
        quote.bidPrice ||
        quote.askPrice ||
        0
    );

    if (!symbol || !Number.isFinite(price) || price <= 0) return;

    const callbacks = this.subscribers.get(symbol);
    if (!callbacks?.size) return;

    const delayed = Boolean(quote.delayed || payload.delayed);
    const transport = payload.stream?.transport;
    const trade = {
      s: symbol,
      p: price,
      v: quote.volume || quote.v || null,
      t: getQuoteTimestamp(quote),
      bidPrice: quote.bidPrice ?? null,
      askPrice: quote.askPrice ?? null,
      lastTradeSize: quote.lastTradeSize ?? null,
      lastTradeTime: quote.lastTradeTime || payload.updatedAt || null,
      delayed,
      realtime: quote.realtime !== false && payload.realtime !== false && !delayed,
      source: delayed
        ? "QTRD DELAYED"
        : transport === "sse"
          ? "QTRD STREAM"
          : "QTRD REST",
    };

    callbacks.forEach((callback) => callback(trade));
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
