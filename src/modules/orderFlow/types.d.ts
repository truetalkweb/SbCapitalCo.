export type AggressorSide = 'buy' | 'sell' | 'unknown';
export type FeedStatus = 'unavailable' | 'connecting' | 'synchronizing' | 'connected' | 'degraded' | 'delayed' | 'historical' | 'disconnected' | 'error';
export interface InstrumentMetadata { root: string; contractId: string | null; expiry: string | null; exchange: string; tickSize: number; pricePrecision: number; contractMultiplier: number; currency: string; quantityUnit: string; timezone: string }
export interface EventEnvelope { version: 1; symbol: string; contractId: string; epoch: string; timestampNs: string; timestamp?: number; receivedAt?: number }
export interface SessionEvent extends EventEnvelope { type: 'session'; tradeSequence: string; marketDataMode: 'realtime' | 'delayed' | 'historical' }
export interface TradeEvent extends EventEnvelope { type: 'trade'; sequence: string; tradeId: string; price: number; size: number; side: AggressorSide }
export interface DepthEntry { side: 'bid' | 'ask'; price: number; size: number; orders?: number }
export interface BookSnapshotEvent extends EventEnvelope { type: 'book-snapshot'; sequence: string; levels: DepthEntry[] }
export interface DepthUpdateEvent extends EventEnvelope { type: 'depth-update'; sequence: string; changes: DepthEntry[] }
export interface HeartbeatEvent extends EventEnvelope { type: 'heartbeat' }
export interface ReconnectNotice { type: 'reconnect'; attempt: number; reason: string; receivedAt: number; previousEpoch: string | null }
export type MarketEvent = SessionEvent | TradeEvent | BookSnapshotEvent | DepthUpdateEvent | HeartbeatEvent;
export interface LocalRecordingFile { format: 'sb-order-flow-recording'; version: 1; provenance: 'historical' | 'simulated'; source: string; instrument: Pick<InstrumentMetadata, 'root' | 'contractId' | 'expiry' | 'tickSize' | 'pricePrecision' | 'contractMultiplier'>; events: MarketEvent[] }
export interface RecordingMetadata { name: string; provenance: 'historical' | 'simulated'; sourceVerified: false; eventCount: number; depthStates: number; sessionOnly: true }
export interface NormalizedFeedTransport { open(callbacks: { onOpen(): void; onEvent(event: MarketEvent): void; onClose(): void; onError(): void }): Promise<void>; close(): void; subscribe(request: { contractId: string; symbol: string; streams: string[]; sinceTimestampNs: string | null }): void; requestSnapshot(request: { contractId: string; epoch: string; minimumSequence: string }): void }
export interface Trade { id: number | string; timestamp: number; timestampNs?: string; receivedAt?: number; sequence?: string; epoch?: string; price: number; size: number; side: AggressorSide }
export interface DOMLevel { price: number; bidSize: number; askSize: number; bidOrders?: number; askOrders?: number; added: number; pulled: number }
export interface OrderBookUpdate { timestamp: number; timestampNs?: string; receivedAt?: number; epoch?: string; sequence?: string; validUntil?: number | null; validUntilNs?: string | null; levels: DOMLevel[]; bestBid: number | null; bestAsk: number | null }
export interface FootprintLevel { price: number; bidVolume: number; askVolume: number; unknownVolume: number; delta: number; buyImbalance: boolean; sellImbalance: boolean }
export interface FootprintCandle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; delta: number; poc: number; levels: FootprintLevel[]; stackedBuy: boolean; stackedSell: boolean; unfinishedHigh: boolean; unfinishedLow: boolean }
export interface OrderFlowSignal { id: string; timestamp: number; price: number; type: string; strength: 'High' | 'Medium'; description: string; simulated: boolean }
export interface DeltaMetrics { volume: number; buy: number; sell: number; unknown: number; sideCoverage: number; delta: number; deltaPercent: number; vwap: number | null; poc: number | null; valueLow: number | null; valueHigh: number | null; openInterest: number | null }
export interface DataGap { stream: string; reason: string; detectedAt: number; epoch: string | null }
export interface MarketSnapshot { symbol: string; metadata?: InstrumentMetadata; trades: Trade[]; books: OrderBookUpdate[]; currentBook?: OrderBookUpdate | null; timestamp: number | null; receivedAt?: number | null; simulated: boolean; source?: string; message?: string; status: FeedStatus; openInterest: number | null; quality?: { complete: boolean; gaps: DataGap[]; bookValid: boolean; rejected: number; duplicates: number; retainedTrades: number; tradeSequence: string | null; bookSequence: string | null } }
export interface MarketDataProvider {
  connect(): Promise<void>;
  disconnect(): void;
  subscribeTrades(symbol: string): void;
  subscribeOrderBook(symbol: string): void;
  unsubscribe(symbol: string): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): MarketSnapshot;
}
export interface OrderFlowExecutionAdapter {
  connected: boolean;
  submit(order: { symbol: string; side: 'buy' | 'sell'; size: number; type: 'market' | 'limit' | 'stop'; price?: number }): Promise<{ id: string }>;
  cancel(orderId: string): Promise<void>;
  flatten(symbol: string): Promise<void>;
  reverse(symbol: string): Promise<void>;
}
