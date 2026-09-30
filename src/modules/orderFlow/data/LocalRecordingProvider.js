/** Read-only local archive. It cannot connect to a vendor or submit orders. */
export class LocalRecordingProvider {
  constructor(recording) { this.snapshot = Object.freeze(recording); }
  getSnapshot = () => this.snapshot;
  subscribe = () => () => {};
  async connect() {}
  disconnect() {}
  subscribeTrades(symbol) { if (symbol !== this.snapshot.symbol) throw new Error('Recording contract cannot be changed. Import a different recording.'); }
  subscribeOrderBook(symbol) { this.subscribeTrades(symbol); }
  unsubscribe() {}
}
