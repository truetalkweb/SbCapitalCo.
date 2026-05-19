class MarketDataService {
  constructor() {
    this.socket = null;
    this.subscribers = new Map();
    this.subscribedSymbols = new Set();
    this.statusCallbacks = new Set();
    this.reconnectTimer = null;
    this.apiKey = import.meta.env.VITE_FINNHUB_API_KEY;
    this.status = "DISCONNECTED";
  }

  setStatus(status) {
    this.status = status;
    this.statusCallbacks.forEach((callback) => callback(status));
  }

  onStatus(callback) {
    this.statusCallbacks.add(callback);
    callback(this.status);
    return () => this.statusCallbacks.delete(callback);
  }

  connect() {
    if (!this.apiKey) {
      this.setStatus("NO_API_KEY");
      return;
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;

    this.setStatus("CONNECTING");

    this.socket = new WebSocket(`wss://ws.finnhub.io?token=${this.apiKey}`);

    this.socket.onopen = () => {
      this.setStatus("LIVE");
      this.subscribedSymbols.forEach((symbol) => this.sendSubscribe(symbol));
    };

    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type !== "trade" || !Array.isArray(message.data)) return;

      message.data.forEach((trade) => {
        const callbacks = this.subscribers.get(trade.s);
        if (!callbacks) return;

        callbacks.forEach((callback) => callback(trade));
      });
    };

    this.socket.onerror = () => {
      this.setStatus("ERROR");
    };

    this.socket.onclose = () => {
      this.setStatus("RECONNECTING");
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 2500);
    };
  }

  sendSubscribe(symbol) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    this.socket.send(
      JSON.stringify({
        type: "subscribe",
        symbol,
      })
    );
  }

  subscribe(symbol, callback) {
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) return () => {};

    if (!this.subscribers.has(cleanSymbol)) {
      this.subscribers.set(cleanSymbol, new Set());
    }

    this.subscribers.get(cleanSymbol).add(callback);
    this.subscribedSymbols.add(cleanSymbol);

    this.connect();
    this.sendSubscribe(cleanSymbol);

    return () => {
      const callbacks = this.subscribers.get(cleanSymbol);
      if (!callbacks) return;

      callbacks.delete(callback);

      if (callbacks.size === 0) {
        this.subscribers.delete(cleanSymbol);
      }
    };
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.setStatus("DISCONNECTED");
  }
}

export const marketDataService = new MarketDataService();