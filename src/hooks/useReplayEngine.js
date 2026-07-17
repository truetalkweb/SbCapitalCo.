import { useCallback, useEffect, useMemo, useState } from "react";

export function useReplayEngine({
  initialReplayMode = false,
  quantity,
}) {
  const [replayMode, setReplayMode] = useState(initialReplayMode);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [replayIndex, setReplayIndex] = useState(80);
  const [mainReplayData, setMainReplayData] = useState([]);
  const [replayTrades, setReplayTrades] = useState([]);
  const [replayEquity, setReplayEquity] = useState([100000]);

  const replayCandle = mainReplayData[replayIndex] || null;

  const replayStats = useMemo(() => {
    const closedTrades = replayTrades.filter((trade) => trade.type === "SELL");
    const winners = closedTrades.filter((trade) => Number(trade.pnl) > 0);
    const losers = closedTrades.filter((trade) => Number(trade.pnl) < 0);
    const netPnL = closedTrades.reduce((total, trade) => total + Number(trade.pnl || 0), 0);
    const winRate = closedTrades.length
      ? ((winners.length / closedTrades.length) * 100).toFixed(1)
      : "0.0";

    const avgWin = winners.length
      ? winners.reduce((total, trade) => total + Number(trade.pnl), 0) / winners.length
      : 0;

    const avgLoss = losers.length
      ? losers.reduce((total, trade) => total + Number(trade.pnl), 0) / losers.length
      : 0;

    return {
      totalTrades: closedTrades.length,
      winners: winners.length,
      losers: losers.length,
      netPnL,
      winRate,
      avgWin,
      avgLoss,
      equity: replayEquity[replayEquity.length - 1] || 100000,
    };
  }, [replayTrades, replayEquity]);

  const stepReplay = useCallback(() => {
    setReplayIndex((prev) => {
      if (!mainReplayData.length) return prev;
      return Math.min(prev + 1, mainReplayData.length - 1);
    });
  }, [mainReplayData.length]);

  const replayBuy = useCallback((symbol) => {
    const candle = mainReplayData[replayIndex];
    if (!candle) return;

    const price = Number(candle.close);
    const qty = Number(quantity) || 1;

    setReplayTrades((prev) => [
      ...prev,
      {
        id: Date.now(),
        type: "BUY",
        symbol,
        qty,
        price,
        time: candle.time,
      },
    ]);
  }, [mainReplayData, quantity, replayIndex]);

  const replaySell = useCallback((symbol) => {
    const candle = mainReplayData[replayIndex];
    if (!candle) return;

    const price = Number(candle.close);
    const requestedQty = Number(quantity) || 1;

    const lastOpenBuy = [...replayTrades]
      .reverse()
      .find((trade) => trade.type === "BUY" && trade.symbol === symbol && !trade.closed);

    if (!lastOpenBuy) return;

    const sellQty = Math.min(requestedQty, Number(lastOpenBuy.qty || 0));

    if (sellQty <= 0) return;

    const remainingBuyQty = Number(lastOpenBuy.qty || 0) - sellQty;
    const pnl = (price - lastOpenBuy.price) * sellQty;
    const nextEquity = (replayEquity[replayEquity.length - 1] || 100000) + pnl;

    setReplayTrades((prev) =>
      prev
        .map((trade) =>
          trade.id === lastOpenBuy.id
            ? {
                ...trade,
                qty: remainingBuyQty,
                closed: remainingBuyQty <= 0,
              }
            : trade
        )
        .concat({
          id: Date.now(),
          type: "SELL",
          symbol,
          qty: sellQty,
          price,
          pnl,
          matchedBuyId: lastOpenBuy.id,
          time: candle.time,
        })
    );

    setReplayEquity((prev) => [...prev, nextEquity]);
  }, [mainReplayData, quantity, replayEquity, replayIndex, replayTrades]);

  const resetReplay = useCallback(() => {
    setReplayPlaying(false);
    setReplayIndex(80);
    setReplayTrades([]);
    setReplayEquity([100000]);
  }, []);

  useEffect(() => {
    if (!replayMode || !replayPlaying) return;

    const interval = setInterval(() => {
      setReplayIndex((prev) => {
        if (!mainReplayData.length) return prev;

        if (prev >= mainReplayData.length - 1) {
          setReplayPlaying(false);
          return prev;
        }

        return prev + 1;
      });
    }, Math.max(120, 900 / replaySpeed));

    return () => clearInterval(interval);
  }, [mainReplayData.length, replayMode, replayPlaying, replaySpeed]);

  return {
    mainReplayData,
    replayCandle,
    replayEquity,
    replayIndex,
    replayMode,
    replayPlaying,
    replaySell,
    replaySpeed,
    replayStats,
    replayTrades,
    replayBuy,
    resetReplay,
    setMainReplayData,
    setReplayEquity,
    setReplayIndex,
    setReplayMode,
    setReplayPlaying,
    setReplaySpeed,
    setReplayTrades,
    stepReplay,
  };
}
