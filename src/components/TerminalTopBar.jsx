export default function TerminalTopBar({
  theme,
  workspaceViews = [],
  activeWorkspace,
  setActiveWorkspace,
  layoutMode,
  setLayoutMode,
  gridMode,
  setGridMode,
  syncCharts,
  setSyncCharts,
  replayMode,
  setReplayMode,
  resetReplay,
  wsStatus,
  mainChartStatus,
  brokerStatus,
  brokerConnected,
  isDark,
  setThemeMode,
  saveWorkspaceToCloud,
  loadWorkspaceFromCloud,
  resetWorkspace,
  buttonStyle,
  user,
}) {
  const now = new Date();

  const nyTime = now.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour12: false,
  });

  const hour = Number(
    now.toLocaleString("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      hour12: false,
    })
  );

  let marketStatus = "CLOSED";
  let marketColor = theme.red;

  if (hour >= 4 && hour < 9) {
    marketStatus = "PREMARKET";
    marketColor = "#f59e0b";
  }

  if (hour >= 9 && hour < 16) {
    marketStatus = "OPEN";
    marketColor = theme.green;
  }

  if (hour >= 16 && hour < 20) {
    marketStatus = "AFTER HOURS";
    marketColor = theme.blue;
  }

  const dataColor =
    wsStatus === "LIVE"
      ? theme.green
      : wsStatus === "CONNECTING" || wsStatus === "RECONNECTING"
      ? theme.blue
      : theme.red;

  const compactButton = (active = false) => ({
    ...buttonStyle(active),
    height: "26px",
    padding: "0 8px",
    fontSize: "10px",
  });

  return (
    <div
      style={{
        height: "46px",
        background: theme.panel,
        borderBottom: `1px solid ${theme.border}`,
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        gap: "8px",
        boxShadow: "0 1px 0 rgba(255,255,255,0.03)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: "16px",
          letterSpacing: "0.3px",
          whiteSpace: "nowrap",
        }}
      >
        SbCapital<span style={{ color: theme.blue }}>Co.</span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 8px",
          borderRadius: "999px",
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${theme.border}`,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "999px",
            background: marketColor,
            boxShadow: `0 0 10px ${marketColor}`,
          }}
        />
        <span style={{ fontSize: "10px", color: marketColor, fontWeight: 900 }}>
          NYSE {marketStatus}
        </span>
        <span style={{ fontSize: "10px", color: theme.muted, fontWeight: 800 }}>
          {nyTime} ET
        </span>
      </div>

      <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
        {workspaceViews.slice(0, 4).map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveWorkspace(view.id)}
            style={compactButton(activeWorkspace === view.id)}
          >
            {view.label}
          </button>
        ))}
      </div>

      <div
        style={{
          width: "1px",
          height: "22px",
          background: theme.border,
          flexShrink: 0,
        }}
      />

      <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
        <button onClick={() => setLayoutMode("1")} style={compactButton(layoutMode === "1")}>
          1 Chart
        </button>

        <button onClick={() => setLayoutMode("2")} style={compactButton(layoutMode === "2")}>
          2 Charts
        </button>

        <button
          onClick={() => {
            setLayoutMode("2");
            setGridMode("2");
          }}
          style={compactButton(layoutMode !== "1" && gridMode === "2")}
        >
          Grid 2
        </button>

        <button
          onClick={() => {
            setLayoutMode("2");
            setGridMode("4");
          }}
          style={compactButton(layoutMode !== "1" && gridMode === "4")}
        >
          Grid 4
        </button>

        <button onClick={() => setSyncCharts(!syncCharts)} style={compactButton(syncCharts)}>
          Sync {syncCharts ? "On" : "Off"}
        </button>

        <button onClick={() => setReplayMode(!replayMode)} style={compactButton(replayMode)}>
          Replay {replayMode ? "On" : "Off"}
        </button>

        <button onClick={resetReplay} style={compactButton(false)}>
          Reset Replay
        </button>
      </div>

      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "10px",
            color: theme.muted,
            fontWeight: 800,
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "999px",
              background: dataColor,
              boxShadow: `0 0 8px ${dataColor}`,
            }}
          />
          DATA {wsStatus}
        </span>

        <span style={{ fontSize: "10px", color: theme.muted, fontWeight: 800 }}>
          CHART {mainChartStatus}
        </span>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "10px",
            color: theme.muted,
            fontWeight: 800,
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "999px",
              background: brokerConnected ? theme.green : theme.red,
              boxShadow: `0 0 8px ${brokerConnected ? theme.green : theme.red}`,
            }}
          />
          BROKER {brokerStatus}
        </span>

        <button onClick={() => setThemeMode(isDark ? "light" : "dark")} style={compactButton(false)}>
          {isDark ? "Light" : "Dark"}
        </button>

        <button onClick={saveWorkspaceToCloud} style={compactButton(Boolean(user))}>
          Save
        </button>

        <button onClick={loadWorkspaceFromCloud} style={compactButton(false)}>
          Load
        </button>

        <button onClick={resetWorkspace} style={compactButton(false)}>
          Reset
        </button>
      </div>
    </div>
  );
}
