import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithTimeout } from "../utils/marketUtils";
import { cleanConfidenceLabel, normalizeScannerGroups } from "../utils/scannerNewsAdapters";
import { loadSetting, saveSetting } from "../utils/storage";
import { createVisibilityAwarePoller } from "../utils/visibilityScheduler";

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
  persisted: false,
  restoredAt: null,
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
  persisted: false,
  restoredAt: null,
  updatedAt: null,
  cacheAgeMs: null,
  counts: null,
  warnings: ["Scanner data is temporarily unavailable."],
  lastWarning: "Scanner data is temporarily unavailable.",
};

function buildScannerMeta(data) {
  const confidenceLabel = cleanConfidenceLabel(data);

  return {
    source: data.source || "FMP SCANNER",
    provider: data.provider || data.source || "Scanner Engine",
    fallback: Boolean(data.fallback),
    degraded: Boolean(data.degraded),
    cached: Boolean(data.cached),
    persisted: Boolean(data.persisted),
    restoredAt: data.restoredAt || null,
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
  const scannerGroupsRef = useRef(emptyScannerGroups);
  const [selectedScannerStock, setSelectedScannerStock] = useState(() =>
    loadSetting("sb_selected_scanner_stock", null)
  );

  const loadScanner = useCallback(async (options = {}) => {
    const silent = Boolean(options?.silent);
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
      scannerGroupsRef.current = normalizedGroups;
      setScannerMeta(nextMeta);
      if (!silent) onActivity?.({
        type: "scanner",
        status: data.degraded ? "degraded" : "success",
        title: "Scanner Refreshed",
        detail: `${data.source || "FMP SCANNER"} returned ${getScannerRowCount(data)} ranked rows.`,
      });
    } catch {
      const hasPreviousRows = Object.values(scannerGroupsRef.current)
        .some((rows) => Array.isArray(rows) && rows.length > 0);
      if (!hasPreviousRows) {
        const unavailableGroups = normalizeScannerGroups(emptyScannerGroups, scannerUnavailableMeta);
        scannerGroupsRef.current = unavailableGroups;
        setScannerGroups(unavailableGroups);
        setScannerMeta({
          ...scannerUnavailableMeta,
          confidenceLabel: "Unavailable",
        });
      } else {
        setScannerMeta((current) => ({
          ...current,
          degraded: true,
          cached: true,
          warnings: ["The latest scanner refresh failed. Previously verified rows remain visible."],
          lastWarning: "The latest scanner refresh failed. Previously verified rows remain visible.",
          confidenceLabel: "Cached",
        }));
      }
      if (!silent) onActivity?.({
        type: "scanner",
        status: "failed",
        title: "Scanner Refresh Failed",
        detail: hasPreviousRows
          ? "Previously verified scanner rows remain available."
          : "Scanner data is temporarily unavailable.",
      });
    } finally {
      setScannerLoading(false);
    }
  }, [brokerApiUrl, onActivity]);

  useEffect(() => {
    if (!autoRefresh) return createVisibilityAwarePoller(
      () => loadScanner({ silent: true }),
      5 * 60 * 1000,
      { immediate: true, repeat: false }
    );
    return createVisibilityAwarePoller(
      () => loadScanner({ silent: true }),
      5 * 60 * 1000,
      { immediate: true }
    );
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
