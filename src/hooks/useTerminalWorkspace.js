import { useCallback, useEffect, useState } from "react";
import { loadSetting, saveSetting } from "../utils/storage";

const defaultLeftSectionsOpen = {
  account: true,
  watchlist: true,
  scanner: true,
  movers: false,
};

export function useTerminalWorkspace({
  layoutPresets,
  requestedPreset,
  requestedPresetId,
  requestedMobileDockTab,
  setReplayMode,
  setReplayPlaying,
}) {
  const [activeWorkspace, setActiveWorkspace] = useState(() =>
    requestedPreset?.activeWorkspace || loadSetting("sb_active_workspace", "intelligence")
  );
  const [layoutMode, setLayoutMode] = useState(() =>
    requestedPreset?.layoutMode || loadSetting("sb_layout_mode", "2")
  );
  const [gridMode, setGridMode] = useState(() =>
    requestedPreset?.gridMode || loadSetting("sb_grid_mode", "2")
  );
  const [syncCharts, setSyncCharts] = useState(() =>
    requestedPreset?.syncCharts ?? loadSetting("sb_sync_charts", false)
  );
  const [leftSectionsOpen, setLeftSectionsOpen] = useState(() => ({
    ...defaultLeftSectionsOpen,
    ...loadSetting("sb_left_sections_open", {}),
  }));
  const [rightTab, setRightTab] = useState(() =>
    requestedMobileDockTab || requestedPreset?.rightTab || loadSetting("sb_right_tab", "order")
  );
  const [activePreset, setActivePreset] = useState(() =>
    requestedPresetId || loadSetting("sb_active_preset", "intelligence")
  );
  const [mobileDockOpen, setMobileDockOpen] = useState(Boolean(requestedMobileDockTab));

  const applyLayoutPreset = useCallback(
    (presetId) => {
      const preset = layoutPresets[presetId];
      if (!preset) return;

      setActivePreset(presetId);
      setActiveWorkspace(preset.activeWorkspace);
      setLayoutMode(preset.layoutMode);
      setGridMode(preset.gridMode);
      setSyncCharts(preset.syncCharts);
      setReplayMode(preset.replayMode);
      setRightTab(preset.rightTab);

      if (presetId === "replay") {
        setReplayPlaying(false);
      }
    },
    [layoutPresets, setReplayMode, setReplayPlaying]
  );

  const applyWorkspaceLayout = useCallback((data) => {
    if (!data) return;

    if (data.activePreset) setActivePreset(data.activePreset);
    if (data.activeWorkspace) setActiveWorkspace(data.activeWorkspace);
    if (data.layoutMode) setLayoutMode(data.layoutMode);
    if (data.gridMode) setGridMode(data.gridMode);
    if (typeof data.syncCharts === "boolean") setSyncCharts(data.syncCharts);
    if (data.rightTab) setRightTab(data.rightTab);
    if (data.leftSectionsOpen) {
      setLeftSectionsOpen((prev) => ({
        ...prev,
        ...data.leftSectionsOpen,
      }));
    }
  }, []);

  const resetWorkspaceLayout = useCallback(() => {
    setActiveWorkspace("intelligence");
    setLayoutMode("1");
    setGridMode("2");
    setActivePreset("intelligence");
    setSyncCharts(false);
    setRightTab("order");
    setLeftSectionsOpen(defaultLeftSectionsOpen);
    setMobileDockOpen(false);
  }, []);

  const toggleLeftSection = useCallback((id) => {
    setLeftSectionsOpen((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const openMobileDockTab = useCallback((tabId) => {
    setRightTab(tabId);
    setMobileDockOpen(true);
  }, []);

  useEffect(() => {
    saveSetting("sb_layout_mode", layoutMode);
    saveSetting("sb_grid_mode", gridMode);
    saveSetting("sb_active_preset", activePreset);
    saveSetting("sb_sync_charts", syncCharts);
    saveSetting("sb_active_workspace", activeWorkspace);
    saveSetting("sb_right_tab", rightTab);
    saveSetting("sb_left_sections_open", leftSectionsOpen);
  }, [
    activePreset,
    activeWorkspace,
    gridMode,
    layoutMode,
    leftSectionsOpen,
    rightTab,
    syncCharts,
  ]);

  return {
    activeWorkspace,
    setActiveWorkspace,
    layoutMode,
    setLayoutMode,
    gridMode,
    setGridMode,
    syncCharts,
    setSyncCharts,
    leftSectionsOpen,
    setLeftSectionsOpen,
    rightTab,
    setRightTab,
    activePreset,
    setActivePreset,
    mobileDockOpen,
    setMobileDockOpen,
    applyLayoutPreset,
    applyWorkspaceLayout,
    resetWorkspaceLayout,
    toggleLeftSection,
    openMobileDockTab,
  };
}
