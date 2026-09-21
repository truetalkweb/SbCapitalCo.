export function getTradingActionMode({ brokerConnected = false, brokerToolsEnabled = false, liveTradingEnabled = false, requestedMode = 'paper' } = {}) {
  if (requestedMode === 'paper') return 'paper';
  if (requestedMode === 'live' && brokerToolsEnabled && brokerConnected && liveTradingEnabled) return 'live';
  return 'review-only';
}
