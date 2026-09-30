export type AggressorSide = 'buy' | 'sell' | 'unknown';
export interface Trade { id: number; timestamp: number; price: number; size: number; side: AggressorSide }
export interface DOMLevel { price: number; bidSize: number; askSize: number; bidOrders?: number; askOrders?: number; added: number; pulled: number }
export interface OrderBookUpdate { timestamp: number; levels: DOMLevel[]; bestBid: number; bestAsk: number }
export interface FootprintLevel { price: number; bidVolume: number; askVolume: number; delta: number; buyImbalance: boolean; sellImbalance: boolean }
export interface FootprintCandle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; delta: number; poc: number; levels: FootprintLevel[]; stackedBuy: boolean; stackedSell: boolean; unfinishedHigh: boolean; unfinishedLow: boolean }
export interface OrderFlowSignal { id: string; timestamp: number; price: number; type: string; strength: 'High' | 'Medium'; description: string; simulated: boolean }
export interface DeltaMetrics { volume: number; buy: number; sell: number; delta: number; deltaPercent: number; vwap: number | null; poc: number | null; valueLow: number | null; valueHigh: number | null; openInterest: number | null }
export interface MarketSnapshot { symbol: string; trades: Trade[]; books: OrderBookUpdate[]; timestamp: number; simulated: boolean; status: 'connected' | 'disconnected'; openInterest: number | null }
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
