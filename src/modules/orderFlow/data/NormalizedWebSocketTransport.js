/** Browser transport for a SAME-ORIGIN authenticated backend connector.
 * Vendor credentials never belong in a browser URL or message.
 */
export class NormalizedWebSocketTransport {
  constructor({ url, WebSocketImpl = globalThis.WebSocket, origin = globalThis.location?.origin, timeoutMs = 10000 } = {}) {
    this.url = url; this.WebSocketImpl = WebSocketImpl; this.origin = origin; this.timeoutMs = timeoutMs; this.socket = null; this.timer = null;
  }
  open(callbacks) {
    const url = new URL(this.url, this.origin), base = new URL(this.origin);
    if (!['ws:', 'wss:'].includes(url.protocol) || url.host !== base.host || (base.protocol === 'https:' && url.protocol !== 'wss:') || url.username || url.password || url.search || url.hash) throw new Error('Use a same-origin secure bridge URL without credentials or query parameters.');
    return new Promise((resolve, reject) => {
      const socket = new this.WebSocketImpl(url.href); this.socket = socket;
      this.rejectOpen = reject;
      this.timer = setTimeout(() => { socket.close(); reject(new Error('Bridge connection timed out.')); }, this.timeoutMs);
      socket.onopen = () => { clearTimeout(this.timer); try { callbacks.onOpen(); this.rejectOpen = null; resolve(); } catch { reject(new Error('Bridge subscription failed.')); callbacks.onError(); } };
      socket.onmessage = message => {
        try {
          if (typeof message.data !== 'string' || message.data.length > 1000000) throw new Error('Bridge frame rejected.');
          const payload = JSON.parse(message.data), events = Array.isArray(payload) ? payload : [payload];
          if (events.length > 1024) throw new Error('Bridge batch limit exceeded.');
          for (const event of events) callbacks.onEvent(event);
        } catch { callbacks.onError(); }
      };
      socket.onerror = () => { clearTimeout(this.timer); callbacks.onError(); reject(new Error('Bridge connection failed.')); };
      socket.onclose = () => { clearTimeout(this.timer); callbacks.onClose(); reject(new Error('Bridge closed.')); };
    });
  }
  send(message) { if (this.socket?.readyState !== 1) throw new Error('Bridge is not open.'); this.socket.send(JSON.stringify({ version: 1, ...message })); }
  subscribe(options) { this.send({ type: 'subscribe', ...options }); }
  requestSnapshot(options) { this.send({ type: 'resync', ...options }); }
  close() {
    clearTimeout(this.timer);
    this.rejectOpen?.(new Error('Bridge connection cancelled.')); this.rejectOpen = null;
    if (this.socket) { this.socket.onopen = this.socket.onmessage = this.socket.onerror = this.socket.onclose = null; this.socket.close(); this.socket = null; }
  }
}
