import { useCallback, useEffect, useState } from "react";
import { fetchWithTimeout } from "../utils/marketUtils";
import { loadSetting, saveSetting } from "../utils/storage";

const emptyScannerGroups = {
  gainers: [],
  losers: [],
  active: [],
  momentum: [],
  relativeVolume: [],
  aiMovers: [],
  smallCaps: [],
};

const defaultScannerMeta = {
  source: "FMP SCANNER",
  provider: "Scanner Engine",
  fallback: false,
  degraded: false,
  cached: false,
  updatedAt: null,
  cacheAgeMs: null,
  counts: null,
  warnings: [],
  lastWarning: null,
};

const scannerUnavailableMeta = {
  source: "SCANNER UNAVAILABLE",
  provider: "Scanner Engine",
  fallback: true,
  degraded: true,
  cached: false,
  updatedAt: null,
  cacheAgeMs: null,
  counts: null,
  warnings: ["Backend FMP scanner bridge did not return usable rows."],
  lastWarning: "Backend FMP scanner bridge did not return usable rows.",
};

function buildScannerMeta(data) {
  return {
    source: data.source || "FMP SCANNER",
    provider: data.provider || data.source || "Scanner Engine",
    fallback: Boolean(data.fallback),
    degraded: Boolean(data.degraded),
    cached: Boolean(data.cached),
    updatedAt: data.updatedAt || new Date().toISOString(),
    cacheAgeMs: data.cacheAgeMs ?? null,
    counts: data.counts || null,
    fmpConfigured: Boolean(data.fmpConfigured),
    providerDiagnostics: data.providerDiagnostics || [],
    warnings: data.warnings || [],
    lastWarning: data.lastWarning || data.warning || data.primaryScannerError || null,
  };
}

function getScannerRowCount(data) {
  return [
    data.gainers,
    data.losers,
    data.active,
    data.momentum,
    data.relativeVolume,
  ].reduce((total, rows) => total + (Array.isArray(rows) ? rows.length : 0), 0);
}

export function useScannerData({ brokerApiUrl, onActivity }) {
  const [scannerGroups, setScannerGroups] = useState(emptyScannerGroups);
  const [scannerMeta, setScannerMeta] = useState(defaultScannerMeta);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [selectedScannerStock, setSelectedScannerStock] = useState(() =>
    loadSetting("sb_selected_scanner_stock", null)
  );

  const loadScanner = useCallback(async () => {
    setScannerLoading(true);

    try {
      const response = await fetchWithTimeout(`${brokerApiUrl}/api/scanner`);

      if (!response.ok) {
        throw new Error("Backend scanner unavailable");
      }

      const data = await response.json();

      setScannerGroups({
        gainers: data.gainers || [],
        losers: data.losers || [],
        active: data.active || [],
        momentum: data.momentum || [],
        relativeVolume: data.relativeVolume || [],
        aiMovers: data.aiMovers || [],
        smallCaps: data.smallCaps || [],
      });
      setScannerMeta(buildScannerMeta(data));
      onActivity?.({
        type: "scanner",
        status: data.degraded ? "degraded" : "success",
        title: "Scanner Refreshed",
        detail: `${data.source || "FMP SCANNER"} returned ${getScannerRowCount(data)} ranked rows.`,
      });
    } catch {
      setScannerGroups(emptyScannerGroups);
      setScannerMeta(scannerUnavailableMeta);
      onActivity?.({
        type: "scanner",
        status: "failed",
        title: "Scanner Refresh Failed",
        detail: "Backend FMP scanner bridge did not return usable rows.",
      });
    } finally {
      setScannerLoading(false);
    }
  }, [brokerApiUrl, onActivity]);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadScanner, 0);
    const interval = setInterval(loadScanner, 5 * 60 * 1000);

    return () => {
      window.clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [loadScanner]);

  useEffect(() => {
    saveSetting("sb_selected_scanner_stock", selectedScannerStock);
  }, [selectedScannerStock]);

  return {
    fmpGainers: scannerGroups.gainers,
    fmpLosers: scannerGroups.losers,
    fmpActive: scannerGroups.active,
    fmpMomentum: scannerGroups.momentum,
    fmpRelativeVolume: scannerGroups.relativeVolume,
    fmpAiMovers: scannerGroups.aiMovers,
    fmpSmallCaps: scannerGroups.smallCaps,
    scannerLoading,
    scannerMeta,
    selectedScannerStock,
    setSelectedScannerStock,
  };
}
