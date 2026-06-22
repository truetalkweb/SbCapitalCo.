/**
 * Dashboard-only fallback data.
 * Real API/hook data must be preferred before anything in this file is used.
 */

export const dashboardMockMarketIndexes = [
  { symbol: "SPY", name: "S&P 500 ETF", price: 532.48, changePercent: 0.24, sparkline: [51, 52, 52.4, 53, 52.7, 53.6, 54.1, 54.8] },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", price: 451.12, changePercent: 0.38, sparkline: [42, 42.2, 43, 42.8, 44.1, 44.6, 45.2, 46] },
  { symbol: "DIA", name: "Dow Jones ETF", price: 398.41, changePercent: 0.2, sparkline: [36, 36.4, 36.8, 37.2, 37, 37.8, 38.4, 39] },
  { symbol: "IWM", name: "Russell 2000 ETF", price: 205.78, changePercent: -0.07, sparkline: [24, 23.8, 23.9, 23.5, 23.3, 23.1, 22.8, 22.5] },
  { symbol: "VIX", name: "Volatility Index", price: 15.62, changePercent: -2.19, sparkline: [19, 18.7, 18.1, 18.4, 17.9, 17.2, 16.8, 16.2] },
];

export const dashboardMockWatchlist = [
  { symbol: "AAPL", name: "Apple Inc.", price: 298.01, changePercent: 1.74, volume: 55210000, relativeVolume: 3.7, floatShares: 15760000000, sector: "Technology", catalyst: "News", score: 72, risk: "Low" },
  { symbol: "NVDA", name: "NVIDIA Corp.", price: 1071.89, changePercent: 0.68, volume: 25430000, relativeVolume: 4, floatShares: 24110000000, sector: "Technology", catalyst: "AI Strength", score: 72, risk: "Low" },
  { symbol: "MSFT", name: "Microsoft Corp.", price: 415.32, changePercent: 0.45, volume: 18770000, relativeVolume: 1.5, floatShares: 7430000000, sector: "Technology", catalyst: "Cloud Strength", score: 66, risk: "Low" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", price: 181.9, changePercent: 1.23, volume: 22110000, relativeVolume: 1.4, floatShares: 10450000000, sector: "Consumer Cyclical", catalyst: "Market Context", score: 57, risk: "Low" },
  { symbol: "TSLA", name: "Tesla, Inc.", price: 186.32, changePercent: -0.58, volume: 85420000, relativeVolume: 1.6, floatShares: 3210000000, sector: "Consumer Cyclical", catalyst: "Pullback", score: 61, risk: "Medium" },
  { symbol: "COIN", name: "Coinbase Global, Inc.", price: 240.75, changePercent: 2.15, volume: 9340000, relativeVolume: 2.3, floatShares: 392500000, sector: "Financial Services", catalyst: "Crypto Strength", score: 72, risk: "Low" },
  { symbol: "SOFI", name: "SoFi Technologies, Inc.", price: 7.91, changePercent: 3, volume: 20220000, relativeVolume: 2.3, floatShares: 867000000, sector: "Financial Services", catalyst: "AI Momentum", score: 61, risk: "Medium" },
];

export const dashboardMockScannerRows = [
  { symbol: "AAPL", name: "Apple Inc.", price: 298.01, changePercent: 1.74, gapPercent: 2.41, relativeVolume: 3.7, volume: 55210000, floatShares: 15760000000, catalyst: "News", score: 72, risk: "Low" },
  { symbol: "COIN", name: "Coinbase Global, Inc.", price: 240.75, changePercent: 2.15, gapPercent: 1.9, relativeVolume: 4, volume: 9340000, floatShares: 2180000000, catalyst: "Crypto Strength", score: 72, risk: "Low" },
  { symbol: "SOUN", name: "SoundHound AI, Inc.", price: 7.12, changePercent: 5.74, gapPercent: 5.74, relativeVolume: 2.4, volume: 8120000, floatShares: 213000000, catalyst: "AI Momentum", score: 69, risk: "Medium" },
  { symbol: "SOFI", name: "SoFi Technologies, Inc.", price: 7.91, changePercent: 3, gapPercent: 2.41, relativeVolume: 2.3, volume: 20220000, floatShares: 867000000, catalyst: "Market Context", score: 61, risk: "Medium" },
  { symbol: "AMD", name: "Advanced Micro Devices", price: 169.32, changePercent: 0.62, gapPercent: 1.23, relativeVolume: 1.8, volume: 12430000, floatShares: 1630000000, catalyst: "Tech Strength", score: 58, risk: "Medium" },
];

export const dashboardMockSymbolDetails = {
  symbol: "AAPL",
  name: "Apple Inc.",
  exchange: "NASDAQ",
  price: 298.01,
  change: 5.12,
  changePercent: 1.74,
  dayHigh: 298.22,
  dayLow: 293.41,
  open: 294.12,
  previousClose: 292.89,
  volume: 55210000,
  averageVolume: 45670000,
  marketCap: 2960000000000,
  floatShares: 15760000000,
  peRatio: 28.41,
  eps: 10.49,
  beta: 1.23,
  dividend: "0.96 (0.32%)",
  yearRangeLow: 199.62,
  yearRangeHigh: 298.22,
};

export const dashboardMockNews = [
  { id: "mock-news-1", timestamp: "2026-06-21T15:32:00.000Z", source: "Bloomberg", headline: "Apple stock climbs on strong iPhone demand and AI optimism", relatedTicker: "AAPL", sentiment: "Bullish", impact: "High", url: "https://www.bloomberg.com/" },
  { id: "mock-news-2", timestamp: "2026-06-21T15:18:00.000Z", source: "CNBC", headline: "Nvidia AI momentum boosts semiconductor sector", relatedTicker: "NVDA", sentiment: "Bullish", impact: "High", url: "https://www.cnbc.com/" },
  { id: "mock-news-3", timestamp: "2026-06-21T14:55:00.000Z", source: "Reuters", headline: "Markets open higher as tech stocks lead gains", relatedTicker: "SPY", sentiment: "Bullish", impact: "Medium", url: "https://www.reuters.com/" },
];

export const dashboardMockPositions = [
  { symbol: "AAPL", side: "LONG", quantity: 50, averagePrice: 292.78, lastPrice: 298.01, pnl: 261.5, pnlPercent: 1.79, dayPnl: 261.5 },
];

export const dashboardMockAccountSummary = {
  buyingPower: 24850.45,
  dailyPnl: 362.18,
  dailyPnlPercent: 0.87,
  netLiquidation: 102653.21,
  marginUsed: 17842.1,
};

export const dashboardMockRiskOverview = [
  { label: "Max Risk/Trade", value: "1.00%", tone: "good", percent: 28 },
  { label: "Daily Loss Limit", value: "3.00%", tone: "good", percent: 36 },
  { label: "Margin Usage", value: "34.6%", tone: "warn", percent: 35 },
  { label: "Buying Power", value: "$24,850.45", tone: "neutral", percent: 64 },
];
