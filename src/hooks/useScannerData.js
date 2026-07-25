import { useCallback, useEffect, useState } from "react";
import { fetchWithTimeout } from "../utils/marketUtils";
import { cleanConfidenceLabel, normalizeScannerGroups } from "../utils/scannerNewsAdapters";
import { loadSetting, saveSetting } from "../utils/storage";

const emptyScannerGroups = {
  gainers: [],
  losers: [],
  active: [],
  momentum: [],
  relativeVolume: [],
  unusualVolume: [],
  newsMovers: [],
  newHighs: [],
  newLows: [],
  premarket: [],
  aiMovers: [],
  smallCaps: [],
  verifiedMovers: [],
  contextMovers: [],
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
  contractVersion: null,
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
  const confidenceLabel = cleanConfidenceLabel(data);

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
    userWarnings: data.userWarnings || [],
    userMessage: data.userMessage || null,
    statusLabel: data.statusLabel || null,
    providerStatus: data.providerStatus || null,
    backendTime: data.backendTime || null,
    confidenceLabel,
    lastWarning: data.lastWarning || data.warning || data.primaryScannerError || null,
    contractVersion: data.contractVersion || null,
    marketSession: data.marketSession || null,
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

export function useScannerData({ brokerApiUrl, onActivity, autoRefresh = true }) {
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
      const nextMeta = buildScannerMeta(data);
      const normalizedGroups = normalizeScannerGroups({
        gainers: data.gainers || [],
        losers: data.losers || [],
        active: data.active || [],
        momentum: data.momentum || [],
        relativeVolume: data.relativeVolume || [],
        unusualVolume: data.unusualVolume || [],
        newsMovers: data.newsMovers || [],
        newHighs: data.newHighs || [],
        newLows: data.newLows || [],
        premarket: data.premarket || [],
        aiMovers: data.aiMovers || [],
        smallCaps: data.smallCaps || [],
        verifiedMovers: data.verifiedMovers || [],
        contextMovers: data.contextMovers || [],
      }, nextMeta);

      setScannerGroups(normalizedGroups);
      setScannerMeta(nextMeta);
      onActivity?.({
        type: "scanner",
        status: data.degraded ? "degraded" : "success",
        title: "Scanner Refreshed",
        detail: `${data.source || "FMP SCANNER"} returned ${getScannerRowCount(data)} ranked rows.`,
      });
    } catch {
      setScannerGroups(normalizeScannerGroups(emptyScannerGroups, scannerUnavailableMeta));
      setScannerMeta({
        ...scannerUnavailableMeta,
        confidenceLabel: "Fallback Context",
      });
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
    const interval = autoRefresh ? setInterval(loadScanner, 5 * 60 * 1000) : null;

    return () => {
      window.clearTimeout(initialLoad);
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, loadScanner]);

  useEffect(() => {
    saveSetting("sb_selected_scanner_stock", selectedScannerStock);
  }, [selectedScannerStock]);

  return {
    fmpGainers: scannerGroups.gainers,
    fmpLosers: scannerGroups.losers,
    fmpActive: scannerGroups.active,
    fmpMomentum: scannerGroups.momentum,
    fmpRelativeVolume: scannerGroups.relativeVolume,
    fmpUnusualVolume: scannerGroups.unusualVolume,
    fmpNewsMovers: scannerGroups.newsMovers,
    fmpNewHighs: scannerGroups.newHighs,
    fmpNewLows: scannerGroups.newLows,
    fmpPremarket: scannerGroups.premarket,
    fmpAiMovers: scannerGroups.aiMovers,
    fmpSmallCaps: scannerGroups.smallCaps,
    verifiedScannerMovers: scannerGroups.verifiedMovers,
    contextScannerMovers: scannerGroups.contextMovers,
    scannerLoading,
    scannerMeta,
    selectedScannerStock,
    setSelectedScannerStock,
    refreshScanner: loadScanner,
  };
}
