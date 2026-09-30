import { sequence } from './events.js';
export class SequenceBuffer {
  constructor({ apply, onGap, now = Date.now, maxPending = 128, maxBytes = 2097152, gapTimeoutMs = 250 }) {
    this.apply = apply; this.onGap = onGap; this.now = now; this.maxPending = maxPending; this.maxBytes = maxBytes; this.gapTimeoutMs = gapTimeoutMs; this.reset();
  }
  reset() { this.last = null; this.pending = new Map(); this.pendingBytes = 0; this.waitingSince = null; this.blocked = false; }
  seed(seq) {
    this.last = BigInt(sequence(seq)); this.blocked = false;
    for (const key of this.pending.keys()) if (BigInt(key) <= this.last) { this.pendingBytes -= this.pending.get(key).bytes; this.pending.delete(key); }
    this.drain();
  }
  push(event) {
    if (this.blocked) return false;
    const seq = BigInt(event.sequence);
    if ((this.last !== null && seq <= this.last) || this.pending.has(event.sequence)) return false;
    const bytes = JSON.stringify(event).length * 2;
    this.pending.set(event.sequence, { event, bytes }); this.pendingBytes += bytes;
    if (this.pending.size > this.maxPending || this.pendingBytes > this.maxBytes) { this.fail('buffer-overflow'); return false; }
    this.drain(); return true;
  }
  drain() {
    while (this.last !== null && this.pending.has((this.last + 1n).toString())) {
      const key = (this.last + 1n).toString(), entry = this.pending.get(key);
      this.apply(entry.event); this.pending.delete(key); this.pendingBytes -= entry.bytes; this.last++;
    }
    if (this.pending.size) this.waitingSince ??= this.now(); else this.waitingSince = null;
  }
  check() { if (!this.blocked && this.waitingSince !== null && this.now() - this.waitingSince >= this.gapTimeoutMs) this.fail('sequence-gap'); }
  fail(reason) {
    this.blocked = true;
    const info = { reason, expected: this.last === null ? null : (this.last + 1n).toString(), buffered: this.pending.size,
      highest: [...this.pending.keys()].reduce((max, key) => BigInt(key) > BigInt(max) ? key : max, this.last?.toString() || '0') };
    this.pending.clear(); this.pendingBytes = 0; this.waitingSince = null; this.onGap(info);
  }
}
