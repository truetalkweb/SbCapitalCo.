import { useEffect, useState } from "react";
import { formatCompactNumber, formatMultiple } from "../utils/dashboardFormatters.js";

export function useWatchlistDetails(apiUrl, rows) {
  const [details, setDetails] = useState(() => new Map());
  const symbols = [...new Set(rows.map(row => row.symbol).filter(symbol => /^[A-Z0-9][A-Z0-9.:-]{0,15}$/.test(symbol || "")))].sort().join(",");

  useEffect(() => {
    if (!apiUrl || !symbols) return undefined;
    const controller = new AbortController();
    const url = new URLSearchParams({ symbols });
    async function refresh() {
      try {
        const response = await fetch(apiUrl + "/api/watchlist/details?" + url, { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (controller.signal.aborted || !Array.isArray(data.rows)) return;
        setDetails(new Map(data.rows.map(row => [row.symbol, row])));
      } catch {
        // The quote table stays usable when fundamentals are unavailable.
      }
    }

    refresh();
    const timer = setInterval(refresh, 5 * 60 * 1000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [apiUrl, symbols]);

  return details;
}

export function applyWatchlistDetails(row, details) {
  if (!details) return row;
  const volume = row.volume;
  const relativeVolume = details.averageVolume > 0 && Number.isFinite(volume) && volume >= 0
    ? volume / details.averageVolume : row.relativeVolume ?? row.rvol;
  const floatShares = details.isFund ? "N/A" : details.floatShares ?? row.floatShares;
  return {
    ...row,
    name: details.name || row.name,
    sector: details.isFund ? "N/A" : details.sector || row.sector,
    industry: details.industry || row.industry,
    averageVolume: details.averageVolume ?? row.averageVolume,
    relativeVolume,
    rvol: relativeVolume,
    rvolLabel: relativeVolume == null ? row.rvolLabel : formatMultiple(relativeVolume, 1),
    floatShares,
    floatLabel: details.isFund ? "N/A" : details.floatShares ? formatCompactNumber(details.floatShares, 2) : row.floatLabel,
    floatAsOf: details.floatAsOf,
    peRatio: details.peRatio ?? row.peRatio,
    beta: details.beta ?? row.beta,
  };
}
