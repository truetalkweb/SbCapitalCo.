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
