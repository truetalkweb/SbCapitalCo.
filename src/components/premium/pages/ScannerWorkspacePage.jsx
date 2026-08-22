import { ChevronRight, Search, Shield } from "lucide-react";
import { terminalMonoFont } from "../../../config/terminalConfig";
import { formatCompactNumber, formatMultiple } from "../../../utils/dashboardFormatters";
import { saveSetting } from "../../../utils/storage";
import { hasNumericValue } from "../premiumWorkspaceData";
import { ActionButton, PremiumCard, PremiumTabs, SectionTitle, StatusPill } from "../PremiumWorkspacePrimitives";

export default function ScannerWorkspacePage({
  activeScannerPreset,
      isNarrowWorkspace,
      mainTwoCol,
      page,
      relativeVolumeThreshold,
      resetScannerFilters,
      scannerAutoRefresh,
      scannerDisplayRows,
      scannerFilters,
      scannerMeta,
      scannerMinimumRvol,
      scannerPresets,
      scannerTab,
      scannerTable,
      scannerUniverseRows,
      selected,
      selectedRail,
      selectedStock,
      setActiveScannerPreset,
      setOrderMessage,
      setScannerPresets,
      setScannerTab,
      theme,
      updatePremiumPreference,
      updateScannerFilter
}) {
    const scannerSelected =
      scannerUniverseRows.find((row) => row.symbol === selectedStock) ||
      scannerDisplayRows[0] ||
      selected;
    return (
      <div style={page}>
        <div style={mainTwoCol}>
          <PremiumCard theme={theme}>
            <div style={{ padding: 20, borderBottom: `1px solid ${theme.borderSoft || theme.border}` }}>
              <SectionTitle theme={theme} title="Scanner" subtitle="Find high-quality trading opportunities" />
              <PremiumTabs theme={theme} tabs={["Gainers", "Losers", "Active", "Momentum", "High RVOL", "News Movers", "New Highs", "New Lows", "Premarket"]} active={scannerTab} onChange={setScannerTab} />
              <div style={{ marginTop: 18, display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
                <select aria-label="Scanner preset" value={activeScannerPreset} onChange={(event) => {
                  const id = event.target.value;
                  setActiveScannerPreset?.(id);
                  const preset = scannerPresets.find((item) => item.id === id);
                  if (preset) {
                    updatePremiumPreference("relativeVolumeThreshold", String(preset.minRvol ?? 0));
                    if (preset.filters) {
                      saveSetting("sb_scanner_filters", preset.filters);
                      updatePremiumPreference("scannerFilters", preset.filters);
                    }
                  }
                }} style={{ height: 36, minWidth: 150, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 10px" }}>
                  {scannerPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                </select>
                <select aria-label="Minimum relative volume" value={String(relativeVolumeThreshold)} onChange={(event) => updatePremiumPreference("relativeVolumeThreshold", event.target.value)} style={{ height: 36, minWidth: 120, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 10px" }}>
                  {["0", "1.25", "1.50", "2.00", "3.00"].map((value) => <option key={value} value={value}>RVOL {value === "0" ? "Any" : `>= ${value}x`}</option>)}
                </select>
                <ActionButton theme={theme} active onClick={() => {
                  const custom = { id: "custom", name: "Custom Scan", minRvol: scannerMinimumRvol, filters: scannerFilters };
                  setScannerPresets?.((current) => [...current.filter((preset) => preset.id !== "custom"), custom]);
                  setActiveScannerPreset?.("custom");
                  setOrderMessage?.("Scanner preset saved to your workspace.");
                }}>Save Preset</ActionButton>
                {activeScannerPreset === "custom" && <ActionButton theme={theme} danger onClick={() => { setScannerPresets?.((current) => current.filter((preset) => preset.id !== "custom")); setActiveScannerPreset?.("default"); updatePremiumPreference("relativeVolumeThreshold", "0"); }}>Delete</ActionButton>}
              </div>
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: isNarrowWorkspace ? "1fr 1fr" : "minmax(180px, 1.5fr) repeat(6, minmax(88px, 1fr)) auto", gap: 8 }}>
                <label style={{ position: "relative", minWidth: 0 }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: theme.muted }} />
                  <input aria-label="Filter scanner by symbol or company" value={scannerFilters.search} onChange={(event) => updateScannerFilter("search", event.target.value)} placeholder="Symbol or company" style={{ width: "100%", height: 34, boxSizing: "border-box", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 9px 0 30px" }} />
                </label>
                {[
                  ["minPrice", "Min price"],
                  ["maxPrice", "Max price"],
                  ["minVolume", "Min volume"],
                  ["minRvol", "Min RVOL"],
                  ["minMarketCap", "Min cap"],
                  ["maxFloat", "Max float"],
                ].map(([key, placeholder]) => (
                  <input key={key} aria-label={placeholder} type="number" min="0" step={key.includes("Price") || key === "minRvol" ? "0.01" : "1"} value={scannerFilters[key]} onChange={(event) => updateScannerFilter(key, event.target.value)} placeholder={placeholder} style={{ minWidth: 0, width: "100%", height: 34, boxSizing: "border-box", border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px", fontFamily: terminalMonoFont }} />
                ))}
                <ActionButton theme={theme} onClick={resetScannerFilters}>Reset</ActionButton>
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select aria-label="Risk filter" value={scannerFilters.risk} onChange={(event) => updateScannerFilter("risk", event.target.value)} style={{ width: 130, height: 34, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px" }}><option value="all">Any risk</option>{["low", "medium", "elevated", "high", "controlled", "context"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
                <select aria-label="Sector filter" value={scannerFilters.sector} onChange={(event) => updateScannerFilter("sector", event.target.value)} style={{ width: 170, height: 34, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px" }}><option value="all">Any sector</option>{[...new Set(scannerUniverseRows.map((row) => row.sector).filter((value) => value && value !== "Not reported"))].sort().map((value) => <option key={value} value={value}>{value}</option>)}</select>
                <select aria-label="Country filter" value={scannerFilters.country} onChange={(event) => updateScannerFilter("country", event.target.value)} style={{ width: 130, height: 34, border: `1px solid ${theme.borderSoft || theme.border}`, borderRadius: 6, background: theme.panel2, color: theme.text, padding: "0 8px" }}><option value="all">Any country</option>{[...new Set(scannerUniverseRows.map((row) => row.country).filter(Boolean))].sort().map((value) => <option key={value} value={String(value).toUpperCase()}>{value}</option>)}</select>
              </div>
            </div>
            {scannerTable(scannerDisplayRows.slice(0, 30))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 20px", color: theme.muted, fontSize: 12 }}>
              <span>
                Results: {scannerDisplayRows.length}
                {" · "}
                {scannerMeta.contractVersion || "legacy contract"}
                {" · "}
                {scannerMeta.cached ? "cached" : scannerMeta.degraded ? "limited context" : "provider data"}
              </span>
              <button
                type="button"
                aria-pressed={scannerAutoRefresh}
                onClick={() => updatePremiumPreference("scannerAutoRefresh", !scannerAutoRefresh)}
                style={{ border: 0, background: "transparent", color: theme.muted, cursor: "pointer", padding: 0 }}
              >
                Auto Refresh <StatusPill theme={theme} tone={scannerAutoRefresh ? "good" : "warn"}>{scannerAutoRefresh ? "On" : "Paused"}</StatusPill>
              </button>
            </div>
          </PremiumCard>
          {selectedRail(
            <>
              <PremiumCard theme={theme} title="Why Ranked"><div style={{ padding: 14, color: theme.text, lineHeight: 1.55 }}>{scannerSelected.whyRanked || scannerSelected.whyMoving || scannerSelected.catalyst || "No confirmed ranking evidence is available."}</div></PremiumCard>
              <PremiumCard theme={theme} title="Scanner Evidence"><div style={{ padding: 14, display: "grid", gap: 10 }}>{[
                ["Trust", scannerSelected.verified ? "Verified provider" : scannerSelected.isSynthetic ? "Synthetic context" : "Calculated context"],
                ["Freshness", scannerSelected.freshness || "Unavailable"],
                ["Relative volume", hasNumericValue(scannerSelected.relativeVolume) ? formatMultiple(scannerSelected.relativeVolume) : "Unavailable"],
                ["Volume", scannerSelected.volumeLabel || (hasNumericValue(scannerSelected.volume) ? formatCompactNumber(scannerSelected.volume, 1) : "Unavailable")],
                ["Score", hasNumericValue(scannerSelected.scannerScore ?? scannerSelected.score) ? scannerSelected.scannerScore ?? scannerSelected.score : "Unavailable"],
                ["Source", scannerSelected.source || "Scanner Engine"],
              ].map(([label, value]) => <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>{label}</span><b style={{ textAlign: "right" }}>{value}</b></div>)}</div></PremiumCard>
              {scannerSelected.scoreBreakdown && (
                <PremiumCard theme={theme} title="Score Breakdown">
                  <div style={{ padding: 14, display: "grid", gap: 9 }}>
                    {Object.entries(scannerSelected.scoreBreakdown).map(([label, value]) => (
                      <div key={label} style={{ display: "grid", gridTemplateColumns: "96px minmax(0, 1fr) 34px", alignItems: "center", gap: 8 }}>
                        <span style={{ color: theme.muted, fontSize: 11, textTransform: "capitalize" }}>{label.replace(/([A-Z])/g, " $1")}</span>
                        <span style={{ height: 5, borderRadius: 3, background: theme.panel2, overflow: "hidden" }}>
                          <span style={{ display: "block", width: `${Math.max(0, Math.min(100, Number(value) || 0))}%`, height: "100%", background: theme.blue }} />
                        </span>
                        <b style={{ color: theme.text, fontFamily: terminalMonoFont, fontSize: 10, textAlign: "right" }}>{Math.round(Number(value) || 0)}</b>
                      </div>
                    ))}
                  </div>
                </PremiumCard>
              )}
              <PremiumCard theme={theme}><div style={{ padding: 16, color: theme.amber, fontWeight: 900 }}><Shield size={18} style={{ verticalAlign: "-4px", marginRight: 8 }} />RISK: {scannerSelected.risk || "Context only"} <ChevronRight size={16} style={{ float: "right" }} /></div></PremiumCard>
            </>,
            scannerSelected
          )}
        </div>
      </div>
    );
  
}

