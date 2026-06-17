export const CHART_INDICATORS = [
  {
    id: "ema9",
    label: "EMA 9",
    shortLabel: "EMA9",
    color: "#2196f3",
    lineWidth: 2,
    defaultEnabled: true,
    calculate: (candles) => calculateEMA(candles, 9),
  },
  {
    id: "ema20",
    label: "EMA 20",
    shortLabel: "EMA20",
    color: "#f59e0b",
    lineWidth: 2,
    defaultEnabled: true,
    calculate: (candles) => calculateEMA(candles, 20),
  },
  {
    id: "vwap",
    label: "VWAP",
    shortLabel: "VWAP",
    color: "#a855f7",
    lineWidth: 2,
    defaultEnabled: false,
    calculate: calculateVWAP,
  },
];

export function getDefaultIndicatorState() {
  return CHART_INDICATORS.reduce((state, indicator) => {
    state[indicator.id] = indicator.defaultEnabled;
    return state;
  }, {});
}

export function normalizeIndicatorState(value) {
  const defaults = getDefaultIndicatorState();

  if (!value || typeof value !== "object") return defaults;

  return CHART_INDICATORS.reduce((state, indicator) => {
    state[indicator.id] =
      typeof value[indicator.id] === "boolean"
        ? value[indicator.id]
        : defaults[indicator.id];
    return state;
  }, {});
}

export function calculateEMA(data, period) {
  if (!Array.isArray(data) || !data.length) return [];

  const multiplier = 2 / (period + 1);
  let ema = Number(data[0].close);

  return data
    .filter((candle) => Number.isFinite(Number(candle.close)))
    .map((candle) => {
      const close = Number(candle.close);
      ema = (close - ema) * multiplier + ema;

      return {
        time: candle.time,
        value: Number(ema.toFixed(4)),
      };
    });
}

export function calculateVWAP(data) {
  if (!Array.isArray(data) || !data.length) return [];

  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  return data
    .filter((candle) =>
      Number.isFinite(Number(candle.high)) &&
      Number.isFinite(Number(candle.low)) &&
      Number.isFinite(Number(candle.close))
    )
    .map((candle) => {
      const high = Number(candle.high);
      const low = Number(candle.low);
      const close = Number(candle.close);
      const volume = Math.max(Number(candle.volume || 1), 1);
      const typicalPrice = (high + low + close) / 3;

      cumulativePriceVolume += typicalPrice * volume;
      cumulativeVolume += volume;

      return {
        time: candle.time,
        value: Number((cumulativePriceVolume / cumulativeVolume).toFixed(4)),
      };
    });
}
