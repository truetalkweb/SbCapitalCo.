import { formatTerminalStatusLabel } from "../utils/marketUtils";

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
  brokerToolsEnabled = true,
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
  handleLogout,
  compact = false,
  advancedMode = false,
  setAdvancedMode,
  selectedSymbol,
  onSymbolCommit,
  onOpenHelp,
  premiumShell = false,
}) {
  const now = new Date();

  const pacificTime = now.toLocaleTimeString("en-US", {
    timeZone: "America/Los_Angeles",
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
  const chromeBackground = isDark
    ? "linear-gradient(180deg, #07090d 0%, #090d14 100%)"
    : "linear-gradient(180deg, #ffffff 0%, #f5f8fc 100%)";
  const controlClusterBackground = isDark ? "rgba(255,255,255,0.03)" : theme.panel2;
  const searchBackground = isDark ? "rgba(255,255,255,0.045)" : theme.panel;
  const logoTextColor = isDark ? "#f8fafc" : theme.text;
  const monoFont = '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace';
  const isIntelligenceWorkspace = activeWorkspace === "intelligence";
  const showAdvancedControls = advancedMode && !compact;
  const showChartControls = !isIntelligenceWorkspace && !premiumShell;
  const showUtilityControls = advancedMode && !isIntelligenceWorkspace;
  const showBrokerStatus = showUtilityControls && brokerToolsEnabled;
  const showModeStatus = showUtilityControls && brokerToolsEnabled;
  const resolvedMarketDataLabel =
    marketDataStatusLabel ||
    (wsStatus === "LIVE" ? "QTRD LIVE" : wsStatus === "BACKEND" ? "QTRD PENDING" : `QTRD ${wsStatus || "PENDING"}`);
  const resolvedChartLabel =
    chartStatusLabel ||
    (mainChartStatus === "QTRD" || mainChartStatus === "LIVE" ? "CHART QTRD" : mainChartStatus === "SIM" ? "CHART SIM" : `CHART ${mainChartStatus || "PENDING"}`);
  const resolvedBrokerLabel = brokerStateLabel || (brokerConnected ? "BROKER CONNECTED" : "BROKER DISCONNECTED");
  const resolvedModeLabel = modeStatusLabel || "PAPER MODE";
  const marketDataDisplayLabel = formatTerminalStatusLabel(resolvedMarketDataLabel);
  const chartDisplayLabel = formatTerminalStatusLabel(resolvedChartLabel);
  const brokerDisplayLabel = formatTerminalStatusLabel(resolvedBrokerLabel);
  const modeDisplayLabel = formatTerminalStatusLabel(resolvedModeLabel);
  const marketDateLabel = now.toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const topStatusLaneStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    height: "18px",
    minWidth: "118px",
    maxWidth: "156px",
    fontSize: "10px",
    color: theme.muted,
    fontWeight: 750,
    flexShrink: 0,
    fontFamily: monoFont,
    fontVariantNumeric: "tabular-nums",
    overflow: "hidden",
  };
  const topRightDockStyle = {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "4px",
    rowGap: "5px",
    whiteSpace: "nowrap",
    minWidth: "260px",
    maxWidth: compact ? "100%" : "min(100%, 680px)",
    flex: "1 1 620px",
    flexWrap: "wrap",
    overflow: "visible",
  };
  const topStatusValueStyle = {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

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

  function commitSymbol(value) {
    const cleanSymbol = String(value || "").trim().toUpperCase();

    if (!/^[A-Z0-9][A-Z0-9./:-]{0,13}$/.test(cleanSymbol)) {
      return false;
    }

    onSymbolCommit?.(cleanSymbol);
    return true;
  }

  return (
    <div
      style={{
        minHeight: compact ? "66px" : premiumShell ? "64px" : "78px",
        background: chromeBackground,
        borderBottom: `1px solid ${theme.borderSoft || theme.border}`,
        display: "flex",
        alignItems: "center",
        padding: compact ? "14px 8px 16px" : premiumShell ? "8px 14px" : "4px 12px 3px",
        gap: compact ? "8px" : "10px",
        flexWrap: "wrap",
        alignContent: compact ? "flex-start" : "center",
        boxShadow: isDark
          ? "inset 0 1px 0 rgba(255,255,255,0.035), 0 10px 28px rgba(0,0,0,0.22)"
          : "0 1px 8px rgba(15,23,42,0.06)",
        overflow: "visible",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          whiteSpace: "nowrap",
          flexShrink: 0,
          minWidth: compact ? "100%" : premiumShell ? "160px" : "154px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ color: logoTextColor, fontWeight: 900, fontSize: "20px", lineHeight: 1.15, letterSpacing: "-0.01em" }}>
            SB <span style={{ color: theme.cyan || theme.blue }}>Terminal</span>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          width: compact ? "100%" : premiumShell ? "330px" : "238px",
          minWidth: compact ? "190px" : premiumShell ? "280px" : "214px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            left: "13px",
            top: "50%",
            transform: "translateY(-50%)",
            color: theme.muted,
            fontSize: "14px",
            pointerEvents: "none",
          }}
        >
          &#8981;
        </span>
        <input
          key={selectedSymbol}
          defaultValue={selectedSymbol || ""}
          onChange={(event) => {
            event.currentTarget.value = event.currentTarget.value.toUpperCase();
          }}
          onBlur={(event) => {
            if (!commitSymbol(event.currentTarget.value)) {
              event.currentTarget.value = selectedSymbol || "";
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              if (!commitSymbol(event.currentTarget.value)) {
                event.currentTarget.value = selectedSymbol || "";
              }
              event.currentTarget.blur();
            }
          }}
          aria-label="Global ticker search"
          placeholder="Search ticker"
          style={{
            width: "100%",
            height: premiumShell ? "40px" : "46px",
            background: searchBackground,
            border: `1px solid ${theme.borderSoft || theme.border}`,
            color: theme.text,
            borderRadius: premiumShell ? "9px" : "12px",
            padding: "0 14px 0 37px",
            fontFamily: monoFont,
            fontSize: "13px",
            fontWeight: 850,
            outline: "none",
            boxShadow: isDark ? "inset 0 1px 0 rgba(255,255,255,0.04)" : "0 1px 4px rgba(15,23,42,0.04)",
          }}
        />
      </div>

      {!compact && (
      <div
        style={{
          height: premiumShell ? "40px" : "46px",
          display: "flex",
          alignItems: "center",
          gap: "9px",
          padding: "0 10px",
          borderRadius: premiumShell ? "9px" : "12px",
          background: controlClusterBackground,
          border: `1px solid ${theme.borderSoft || theme.border}`,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "999px",
            display: "grid",
            placeItems: "center",
            color: "#04100c",
            fontSize: "13px",
            fontWeight: 950,
            background: marketColor,
            boxShadow: `0 0 22px ${marketColor}35`,
          }}
        />
        <div>
          <div style={{ fontSize: "12px", color: marketColor, fontWeight: 950 }}>
            Market {marketStatus.toLowerCase()}
          </div>
          <div style={{ fontSize: "11px", color: theme.muted, fontWeight: 800, marginTop: "2px" }}>
            {marketDateLabel} - <span style={{ display: "inline-block", minWidth: "74px", fontFamily: monoFont, fontVariantNumeric: "tabular-nums" }}>{pacificTime} PT</span>
          </div>
        </div>
      </div>
      )}

      {!premiumShell && !compact && (
      <div
        style={{
          display: "flex",
          gap: "6px",
          alignItems: "center",
          flexShrink: 0,
          padding: "4px",
          background: controlClusterBackground,
          border: `1px solid ${theme.borderSoft || theme.border}`,
          borderRadius: "10px",
        }}
      >
        {workspaceViews
          .filter((view) => ["charts", "scanner", "watchlist", "intelligence"].includes(view.id))
          .map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => setActiveWorkspace(view.id)}
            style={compactButton(activeWorkspace === view.id)}
          >
            {view.label}
          </button>
        ))}
      </div>
      )}

      {advancedMode && !compact && !premiumShell && (
      <div
        style={{
          width: "1px",
          height: "22px",
          background: theme.borderSoft || theme.border,
          flexShrink: 0,
        }}
      />
      )}

      {showAdvancedControls && !premiumShell && (
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

      {showAdvancedControls && !premiumShell && (
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
          ...topRightDockStyle,
        }}
      >
        <span
          style={{
            ...topStatusLaneStyle,
            minWidth: premiumShell ? "110px" : "64px",
            maxWidth: premiumShell ? "142px" : "88px",
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
          <span style={topStatusValueStyle} title={resolvedMarketDataLabel}>{marketDataDisplayLabel}</span>
        </span>

        {showAdvancedControls && (
        <span
          style={{
            ...topStatusLaneStyle,
            minWidth: "64px",
            maxWidth: "88px",
            fontSize: "10px",
            color: statusColor(resolvedChartLabel),
          }}
        >
          <span style={topStatusValueStyle} title={resolvedChartLabel}>{chartDisplayLabel}</span>
        </span>
        )}

        {showBrokerStatus && (
        <span
          style={{
            ...topStatusLaneStyle,
            minWidth: "96px",
            maxWidth: "120px",
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
          <span style={{ ...topStatusValueStyle, maxWidth: "132px" }} title={resolvedBrokerLabel}>
            {brokerDisplayLabel}
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
          title={
            brokerToolsEnabled
              ? advancedMode
                ? "Hide execution, replay, DOM, and workspace tools"
                : "Show advanced trading/replay/workspace tools"
              : advancedMode
                ? "Hide advanced workspace tools"
                : "Show advanced workspace tools"
          }
        >
          Advanced {advancedMode ? "On" : "Off"}
        </button>
        )}

        {!compact && onOpenHelp && (
        <button
          onClick={onOpenHelp}
          aria-label="Open help and data sources"
          style={{
            ...compactButton(false),
            ...quietButton,
          }}
          title="How the terminal works"
        >
          Help
        </button>
        )}

        {showModeStatus && (
        <span
          style={{
            ...topStatusLaneStyle,
            minWidth: "58px",
            maxWidth: "82px",
            fontSize: "10px",
            color: statusColor(resolvedModeLabel),
          }}
        >
          <span style={topStatusValueStyle} title={resolvedModeLabel}>{modeDisplayLabel}</span>
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

        {user && (
          <span style={{ ...topStatusLaneStyle, maxWidth: 150 }} title={user.email || "Authenticated user"}>
            <span style={{ ...topStatusValueStyle, textTransform: "none", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email || "Signed in"}</span>
          </span>
        )}

        {user && (
          <button onClick={handleLogout} style={{ ...compactButton(false), ...quietButton }} title="Sign out of this workspace">
            Sign out
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
