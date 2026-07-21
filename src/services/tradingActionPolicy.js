export function getTradingActionMode({
  brokerConnected = false,
  brokerToolsEnabled = false,
  liveTradingEnabled = false,
  requestedMode = "paper",
} = {}) {
  if (!brokerToolsEnabled || !brokerConnected) return "review-only";
  if (requestedMode === "live" && liveTradingEnabled) return "live";
  return "paper";
}
