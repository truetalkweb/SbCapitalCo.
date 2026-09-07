export function replayJumpIndex(candles, index, target) {
  if (!candles.length) return 0;
  if (target === "open") return 0;
  if (target === "close") return candles.length - 1;
  const current = Math.max(0, Math.min(index, candles.length - 1));
  if (!Number.isFinite(target) || target <= 0) return current;
  const boundary = candles[current].time + target * 60;
  const next = candles.findIndex((row, candidate) => candidate > current && row.time >= boundary);
  return next < 0 ? candles.length - 1 : next;
}

export function replayBookmarkIndex(bookmark, session, candles) {
  if (!session?.fingerprint || bookmark.fingerprint !== session.fingerprint
    || bookmark.symbol !== session.symbol || bookmark.interval !== session.interval) return null;
  const index = candles.findIndex(row => row.time === bookmark.time);
  return index >= 0 ? index : null;
}
