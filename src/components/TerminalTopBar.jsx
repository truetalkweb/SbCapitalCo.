function getNyDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const value = (type) => parts.find((part) => part.type === type)?.value;

  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    weekday: value("weekday"),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

function formatDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function observedFixedHoliday(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();

  if (weekday === 0) return addUtcDays(date, 1);
  if (weekday === 6) return addUtcDays(date, -1);
  return date;
}

function nthWeekdayOfMonth(year, month, weekday, nth) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month - 1, 1 + offset + (nth - 1) * 7));
}

function lastWeekdayOfMonth(year, month, weekday) {
  const last = new Date(Date.UTC(year, month, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month - 1, last.getUTCDate() - offset));
}

function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
}

function toKey(date) {
  return formatDateKey(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
}

function getMarketHolidayKeys(year) {
  return new Set([
    toKey(observedFixedHoliday(year, 1, 1)),
    toKey(nthWeekdayOfMonth(year, 1, 1, 3)),
    toKey(nthWeekdayOfMonth(year, 2, 1, 3)),
    toKey(addUtcDays(getEasterSunday(year), -2)),
    toKey(lastWeekdayOfMonth(year, 5, 1)),
    toKey(observedFixedHoliday(year, 6, 19)),
    toKey(observedFixedHoliday(year, 7, 4)),
    toKey(nthWeekdayOfMonth(year, 9, 1, 1)),
    toKey(nthWeekdayOfMonth(year, 11, 4, 4)),
    toKey(observedFixedHoliday(year, 12, 25)),
  ]);
}

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
  marketDataStatusLabel,
  chartStatusLabel,
  brokerStateLabel,
  modeStatusLabel,
  brokerConnected,
  isDark,
  setThemeMode,
  saveWorkspaceToCloud,
  loadWorkspaceFromCloud,
  resetWorkspace,
  layoutPresets = {},
  activePreset,
  applyLayoutPreset,
  marketRegions = {},
  marketRegion,
  setMarketRegion,
  activeMarket,
  buttonStyle,
  user,
  compact = false,
  advancedMode = false,
  setAdvancedMode,
}) {
  const now = new Date();

  const nyTime = now.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour12: false,
  });

  const nyParts = getNyDateParts(now);
  const minuteOfDay = nyParts.hour * 60 + nyParts.minute;
  const todayKey = formatDateKey(nyParts.year, nyParts.month, nyParts.day);
  const isWeekend = nyParts.weekday === "Sat" || nyParts.weekday === "Sun";
  const isMarketHoliday = getMarketHolidayKeys(nyParts.year).has(todayKey);

  let marketStatus = "CLOSED";
  let marketColor = theme.red;

  if (!isWeekend && !isMarketHoliday && minuteOfDay >= 4 * 60 && minuteOfDay < 9 * 60 + 30) {
    marketStatus = "PREMARKET";
    marketColor = "#f59e0b";
  }

  if (!isWeekend && !isMarketHoliday && minuteOfDay >= 9 * 60 + 30 && minuteOfDay < 16 * 60) {
    marketStatus = "OPEN";
    marketColor = theme.green;
  }

  if (!isWeekend && !isMarketHoliday && minuteOfDay >= 16 * 60 && minuteOfDay < 20 * 60) {
    marketStatus = "AFTER HOURS";
    marketColor = theme.blue;
  }

  const compactButton = (active = false) => ({
    ...buttonStyle(active),
    height: "25px",
    padding: "0 8px",
    fontSize: "10px",
    flexShrink: 0,
    borderRadius: "5px",
    boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.12)" : "none",
  });
  const quietButton = {
    opacity: 0.78,
    background: "transparent",
    borderColor: theme.borderSoft || theme.border,
  };
  const monoFont = '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace';
  const isIntelligenceWorkspace = activeWorkspace === "intelligence";
  const showAdvancedControls = advancedMode && !compact;
  const showChartControls = !isIntelligenceWorkspace;
  const showUtilityControls = advancedMode && !isIntelligenceWorkspace;
  const resolvedMarketDataLabel =
    marketDataStatusLabel ||
    (wsStatus === "LIVE" ? "QTRD LIVE" : wsStatus === "BACKEND" ? "QTRD PENDING" : `QTRD ${wsStatus || "PENDING"}`);
  const resolvedChartLabel =
    chartStatusLabel ||
    (mainChartStatus === "QTRD" || mainChartStatus === "LIVE" ? "CHART QTRD" : mainChartStatus === "SIM" ? "CHART SIM" : `CHART ${mainChartStatus || "PENDING"}`);
  const resolvedBrokerLabel = brokerStateLabel || (brokerConnected ? "BROKER CONNECTED" : "BROKER DISCONNECTED");
  const resolvedModeLabel = modeStatusLabel || "PAPER MODE";

  function statusColor(label) {
    const value = String(label || "").toUpperCase();

    if (value.includes("DISCONNECTED") || value.includes("ERROR")) return theme.red;
    if (value.includes("DELAYED") || value.includes("FALLBACK") || value.includes("SIM") || value.includes("PENDING") || value.includes("DEGRADED") || value.includes("TIMEOUT") || value.includes("LIMITED")) {
      return theme.amber || "#f5b84b";
    }
    if (value.includes("LIVE") || value.includes("QTRD") || value.includes("CONNECTED") || value.includes("PAPER")) {
      return theme.green;
    }

    return theme.muted;
  }

  return (
    <div
      style={{
        minHeight: compact ? "52px" : "42px",
        background: `linear-gradient(180deg, ${theme.panel2}, ${theme.panel})`,
        borderBottom: `1px solid ${theme.border}`,
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        gap: "7px",
        flexWrap: compact ? "wrap" : "nowrap",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.025)",
        overflow: compact ? "visible" : "hidden",
      }}
    >
      <div
          style={{
          fontWeight: 900,
          fontSize: "15px",
          whiteSpace: "nowrap",
          flexShrink: 0,
          color: theme.text,
        }}
      >
        SbCapital<span style={{ color: theme.cyan || theme.blue }}>Co.</span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "3px 7px",
          borderRadius: "999px",
          background: theme.panel3 || "rgba(255,255,255,0.03)",
          border: `1px solid ${theme.border}`,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "999px",
            background: marketColor,
          boxShadow: "none",
          }}
        />
        <span style={{ fontSize: "10px", color: marketColor, fontWeight: 900 }}>
          NYSE {marketStatus}
        </span>
        <span style={{ fontSize: "10px", color: theme.muted, fontWeight: 700, fontFamily: monoFont, fontVariantNumeric: "tabular-nums" }}>
          {nyTime} ET
        </span>
      </div>

      <div style={{ display: "flex", gap: "5px", alignItems: "center", flexShrink: 0 }}>
        {workspaceViews
          .filter((view) => ["charts", "scanner", "watchlist", "intelligence"].includes(view.id))
          .map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveWorkspace(view.id)}
            style={compactButton(activeWorkspace === view.id)}
          >
            {view.label}
          </button>
        ))}
      </div>

      {advancedMode && !compact && (
      <div
        style={{
          width: "1px",
          height: "22px",
          background: theme.borderSoft || theme.border,
          flexShrink: 0,
        }}
      />
      )}

      {showAdvancedControls && (
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          color: theme.muted,
          fontSize: "10px",
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        Preset
        <select
          value={activePreset}
          onChange={(event) => applyLayoutPreset(event.target.value)}
          style={{
            height: "26px",
            maxWidth: "128px",
            minWidth: 0,
            background: theme.panel2,
            border: `1px solid ${theme.border}`,
            color: theme.text,
            borderRadius: "4px",
            padding: "0 6px",
            fontSize: "10px",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {Object.entries(layoutPresets).map(([id, preset]) => (
            <option key={id} value={id}>
              {preset.label}
            </option>
          ))}
        </select>
      </label>
      )}

      {showAdvancedControls && (
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          color: theme.muted,
          fontSize: "10px",
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        Market
        <select
          value={marketRegion}
          onChange={(event) => setMarketRegion(event.target.value)}
          style={{
            height: "26px",
            maxWidth: "112px",
            minWidth: 0,
            background: theme.panel2,
            border: `1px solid ${theme.border}`,
            color: theme.text,
            borderRadius: "4px",
            padding: "0 6px",
            fontSize: "10px",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {Object.entries(marketRegions).map(([id, region]) => (
            <option key={id} value={id}>
              {region.label}
            </option>
          ))}
        </select>
        <span style={{ color: theme.faint }}>{activeMarket?.currency}</span>
      </label>
      )}

      {showChartControls && (
      <div
        style={{
          display: "flex",
          gap: "5px",
          alignItems: "center",
          minWidth: 0,
          width: compact ? "100%" : "auto",
          flexWrap: compact ? "wrap" : "nowrap",
          overflow: compact ? "visible" : "hidden",
        }}
      >
        <button onClick={() => setLayoutMode("1")} style={compactButton(layoutMode === "1")}>
          1 Chart
        </button>

        <button onClick={() => setLayoutMode("2")} style={compactButton(layoutMode === "2")}>
          2 Charts
        </button>

        {showAdvancedControls && (
        <button
          onClick={() => {
            setLayoutMode("2");
            setGridMode("2");
          }}
          style={compactButton(layoutMode !== "1" && gridMode === "2")}
        >
          Grid 2
        </button>
        )}

        {showAdvancedControls && (
        <button
          onClick={() => {
            setLayoutMode("2");
            setGridMode("4");
          }}
          style={compactButton(layoutMode !== "1" && gridMode === "4")}
        >
          Grid 4
        </button>
        )}

        {showAdvancedControls && (
          <button onClick={() => setSyncCharts(!syncCharts)} style={compactButton(syncCharts)}>
            Sync {syncCharts ? "On" : "Off"}
          </button>
        )}

        {showAdvancedControls && (
          <button onClick={() => setReplayMode(!replayMode)} style={compactButton(replayMode)}>
            Replay {replayMode ? "On" : "Off"}
          </button>
        )}

        {showAdvancedControls && (
        <button onClick={resetReplay} style={compactButton(false)}>
          Reset Replay
        </button>
        )}
      </div>
      )}

      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: "7px",
          whiteSpace: "nowrap",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "10px",
            color: theme.muted,
            fontWeight: 700,
            flexShrink: 0,
            fontFamily: monoFont,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "999px",
              background: statusColor(resolvedMarketDataLabel),
              boxShadow: "none",
            }}
          />
          {resolvedMarketDataLabel}
        </span>

        {showAdvancedControls && (
        <span
          style={{
            fontSize: "10px",
            color: statusColor(resolvedChartLabel),
            fontWeight: 700,
            fontFamily: monoFont,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {resolvedChartLabel}
        </span>
        )}

        {showUtilityControls && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "10px",
            color: theme.muted,
            fontWeight: 700,
            fontFamily: monoFont,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "999px",
              background: statusColor(resolvedBrokerLabel),
              boxShadow: "none",
            }}
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: "132px" }}>
            {resolvedBrokerLabel}
          </span>
        </span>
        )}

        {!compact && setAdvancedMode && (
        <button
          onClick={() => setAdvancedMode(!advancedMode)}
          style={{
            ...compactButton(advancedMode),
            ...(!advancedMode ? quietButton : {}),
          }}
          title={advancedMode ? "Hide execution, replay, DOM, and workspace tools" : "Show advanced trading/replay/workspace tools"}
        >
          Advanced {advancedMode ? "On" : "Off"}
        </button>
        )}

        {showUtilityControls && (
        <span
          style={{
            fontSize: "10px",
            color: statusColor(resolvedModeLabel),
            fontWeight: 700,
            fontFamily: monoFont,
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
          }}
        >
          {resolvedModeLabel}
        </span>
        )}

        {showUtilityControls && (
        <button onClick={() => setThemeMode(isDark ? "light" : "dark")} style={{ ...compactButton(false), ...quietButton }}>
          {isDark ? "Light" : "Dark"}
        </button>
        )}

        {showUtilityControls && (
        <button onClick={saveWorkspaceToCloud} style={{ ...compactButton(Boolean(user)), ...(!user ? quietButton : {}) }}>
          Save
        </button>
        )}

        {showAdvancedControls && (
        <button onClick={loadWorkspaceFromCloud} style={{ ...compactButton(false), ...quietButton }}>
          Load
        </button>
        )}

        {showAdvancedControls && (
        <button onClick={resetWorkspace} style={{ ...compactButton(false), ...quietButton }}>
          Reset
        </button>
        )}
      </div>
    </div>
  );
}
