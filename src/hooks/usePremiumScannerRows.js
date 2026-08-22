import { useMemo } from "react";
import { loadSetting } from "../utils/storage";
import {
  filterScannerRows,
  mergeScannerFilters,
  selectScannerUniverse,
} from "../utils/premiumScanner";

export function usePremiumScannerRows({
  activeScannerPreset,
  fallbackStocks,
  premiumPreferences,
  relativeVolumeThreshold,
  scannerGroups,
  scannerPresets,
  scannerStocks,
  scannerTab,
  selectedStock,
  selectedStockData,
}) {
  const storedFilters = useMemo(() => loadSetting("sb_scanner_filters", {}), []);
  const scannerFilters = useMemo(
    () => mergeScannerFilters(storedFilters, premiumPreferences.scannerFilters),
    [premiumPreferences.scannerFilters, storedFilters],
  );
  const activePreset = scannerPresets.find((preset) => preset.id === activeScannerPreset);
  const minimumRvol = Number(
    scannerFilters.minRvol || relativeVolumeThreshold || activePreset?.minRvol || 0,
  );
  const universeRows = useMemo(
    () => selectScannerUniverse({
      scannerTab,
      scannerGroups,
      scannerStocks,
      selectedStockData,
      selectedStock,
      fallbackStocks,
    }),
    [
      fallbackStocks,
      scannerGroups,
      scannerStocks,
      scannerTab,
      selectedStock,
      selectedStockData,
    ],
  );
  const displayRows = useMemo(
    () => filterScannerRows(universeRows, scannerFilters, minimumRvol),
    [minimumRvol, scannerFilters, universeRows],
  );

  return {
    scannerDisplayRows: displayRows,
    scannerFilters,
    scannerMinimumRvol: minimumRvol,
    scannerUniverseRows: universeRows,
  };
}
