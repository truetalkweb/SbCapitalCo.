/** Fault-injection transport only. It never connects to a vendor or the internet. */
export class DevelopmentFeedHarness {
  constructor() { this.testOnly = true; this.callbacks = null; this.requests = []; this.opens = 0; this.closed = false; }
  async open(callbacks) { this.opens++; this.callbacks = callbacks; this.closed = false; callbacks.onOpen(); }
  subscribe(request) { this.requests.push({ type: 'subscribe', ...request }); }
  requestSnapshot(request) { this.requests.push({ type: 'resync', ...request }); }
  emit(event) { if (!this.closed) this.callbacks?.onEvent(event); }
  drop() { const callback = this.callbacks?.onClose; this.closed = true; callback?.(); }
  close() { this.closed = true; }
}
