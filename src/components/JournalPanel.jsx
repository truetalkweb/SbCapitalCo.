const gradeColors = {
  A: "#00c896",
  B: "#22c55e",
  C: "#f59e0b",
  D: "#ef5350",
};

export default function JournalPanel({
  theme,
  buttonStyle,
  draft,
  setDraft,
  entries,
  addEntry,
  deleteEntry,
  selectedStock,
  realizedPnL,
  totalUnrealizedPnL,
  orders,
  exportJournalCsv,
  exportTradeSummaryCsv,
  exportDailyReport,
  exportWeeklyReport,
  exportScreenshotJournalLink,
}) {
  const closedOrders = orders.filter((order) => order.realizedPnL !== null);
  const winners = closedOrders.filter((order) => Number(order.realizedPnL) > 0);
  const winRate = closedOrders.length
    ? ((winners.length / closedOrders.length) * 100).toFixed(1)
    : "0.0";
  const setupStats = entries.reduce((stats, entry) => {
    stats[entry.setup] ||= { total: 0, wins: 0 };
    stats[entry.setup].total += 1;
    if (entry.grade === "A" || entry.grade === "B" || entry.result === "Win") {
      stats[entry.setup].wins += 1;
    }
    return stats;
  }, {});
  const symbolPnl = closedOrders.reduce((stats, order) => {
    stats[order.symbol] = (stats[order.symbol] || 0) + Number(order.realizedPnL || 0);
    return stats;
  }, {});
  const gradeCounts = entries.reduce((stats, entry) => {
    stats[entry.grade] = (stats[entry.grade] || 0) + 1;
    return stats;
  }, {});
  const tagCounts = countTags(entries, "tags");
  const mistakeCounts = countTags(entries, "mistakeTags");
  const followedPlanCount = entries.filter((entry) => entry.followedPlan === "Yes").length;
  const planRate = entries.length ? (followedPlanCount / entries.length) * 100 : 0;
  const dailyScore = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        Number(winRate || 0) * 0.35 +
          planRate * 0.45 +
          Math.max(-20, Math.min(20, Number(realizedPnL || 0) / 25)) +
          20
      )
    )
  );
  const bestSetup = Object.entries(setupStats).sort(
    (a, b) => b[1].wins / b[1].total - a[1].wins / a[1].total
  )[0];
  const worstSetup = Object.entries(setupStats).sort(
    (a, b) => a[1].wins / a[1].total - b[1].wins / b[1].total
  )[0];
  const maxGradeCount = Math.max(...Object.values(gradeCounts), 1);
  const maxSymbolPnl = Math.max(...Object.values(symbolPnl).map((value) => Math.abs(value)), 1);

  const updateDraft = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const inputStyle = {
    width: "100%",
    padding: "8px",
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    color: theme.text,
    borderRadius: "5px",
    fontSize: "11px",
  };
  const premiumCardStyle = {
    background: `linear-gradient(180deg, ${theme.panel3 || theme.panel2}, ${theme.panel2})`,
    border: `1px solid ${theme.border}`,
    borderRadius: "7px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
  };
  const labelStyle = {
    display: "grid",
    gap: "4px",
    color: theme.muted,
    fontSize: "10px",
    fontWeight: 800,
  };

  function countTags(sourceEntries, field) {
    return sourceEntries.reduce((stats, entry) => {
      String(entry[field] || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .forEach((tag) => {
          stats[tag] = (stats[tag] || 0) + 1;
        });
      return stats;
    }, {});
  }

  function miniBar(label, value, rawValue, max, color = theme.blue) {
    const numericValue = Number(rawValue) || 0;
    const width = max > 0 ? Math.max(6, Math.min(100, (Math.abs(numericValue) / max) * 100)) : 0;

    return (
      <div key={label} style={{ display: "grid", gap: "3px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "10px" }}>
          <span style={{ color: theme.text, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {label}
          </span>
          <span style={{ color: theme.muted, fontWeight: 800, flexShrink: 0 }}>{value}</span>
        </div>
        <div style={{ height: "6px", borderRadius: "999px", background: theme.panel, overflow: "hidden" }}>
          <div style={{ width: `${width}%`, height: "100%", background: color }} />
        </div>
      </div>
    );
  }

  function tagCloud(counts, color) {
    return (
      <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
        {Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([tag, count]) => (
            <span
              key={tag}
              style={{
                padding: "3px 6px",
                borderRadius: "999px",
                background: color === theme.red ? "rgba(239,83,80,0.10)" : theme.panel,
                border: `1px solid ${theme.border}`,
                color,
                fontSize: "9px",
                fontWeight: 900,
              }}
            >
              {tag} {count}
            </span>
          ))}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "10px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))", gap: "6px" }}>
        {[
          ["Realized", `$${Number(realizedPnL || 0).toFixed(2)}`, Number(realizedPnL) >= 0 ? theme.green : theme.red],
          ["Open P&L", `$${Number(totalUnrealizedPnL || 0).toFixed(2)}`, Number(totalUnrealizedPnL) >= 0 ? theme.green : theme.red],
          ["Win Rate", `${winRate}%`, theme.blue],
          ["Daily Score", `${dailyScore}/100`, dailyScore >= 70 ? theme.green : dailyScore >= 45 ? theme.amber : theme.red],
        ].map(([label, value, color]) => (
          <div key={label} style={{ ...premiumCardStyle, padding: "8px", minWidth: 0 }}>
            <div style={{ color: theme.muted, fontSize: "9px", fontWeight: 900 }}>{label}</div>
            <div style={{ color, fontSize: "13px", fontWeight: 900 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ ...premiumCardStyle, padding: "9px", display: "grid", gap: "8px" }}>
        <div style={{ fontSize: "13px", fontWeight: 900, color: theme.text }}>Exports + Reports</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: "6px" }}>
          <button onClick={exportJournalCsv} style={buttonStyle(false)}>Journal CSV</button>
          <button onClick={exportTradeSummaryCsv} style={buttonStyle(false)}>Trade Summary</button>
          <button onClick={exportDailyReport} style={buttonStyle(false)}>Daily Report</button>
          <button onClick={exportWeeklyReport} style={buttonStyle(false)}>Weekly Review</button>
          <button onClick={exportScreenshotJournalLink} style={buttonStyle(false)}>Screenshot Link</button>
        </div>
      </div>

      <div style={{ ...premiumCardStyle, padding: "9px", display: "grid", gap: "9px" }}>
        <div style={{ fontSize: "13px", fontWeight: 900, color: theme.text }}>Review Center</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px" }}>
          <div style={{ display: "grid", gap: "6px" }}>
            <div style={{ color: theme.muted, fontSize: "10px", fontWeight: 900 }}>Win Rate By Setup</div>
            {Object.entries(setupStats).length === 0 ? (
              <div style={{ color: theme.muted, fontSize: "10px" }}>No setup data.</div>
            ) : (
              Object.entries(setupStats)
                .slice(0, 5)
                .map(([setup, stat]) =>
                  miniBar(setup, `${((stat.wins / stat.total) * 100).toFixed(0)}%`, (stat.wins / stat.total) * 100, 100, theme.green)
                )
            )}
          </div>
          <div style={{ display: "grid", gap: "6px" }}>
            <div style={{ color: theme.muted, fontSize: "10px", fontWeight: 900 }}>Grade Distribution</div>
            {["A", "B", "C", "D"].map((grade) =>
              miniBar(grade, gradeCounts[grade] || 0, gradeCounts[grade] || 0, maxGradeCount, gradeColors[grade])
            )}
          </div>
        </div>
        <div style={{ display: "grid", gap: "6px" }}>
          <div style={{ color: theme.muted, fontSize: "10px", fontWeight: 900 }}>P&L By Symbol</div>
          {Object.entries(symbolPnl).length === 0 ? (
            <div style={{ color: theme.muted, fontSize: "10px" }}>No closed trade P&L yet.</div>
          ) : (
            Object.entries(symbolPnl)
              .slice(0, 5)
              .map(([symbol, pnl]) => miniBar(symbol, `$${pnl.toFixed(2)}`, pnl, maxSymbolPnl, pnl >= 0 ? theme.green : theme.red))
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "10px" }}>
          <div style={{ color: theme.muted }}>Best Setup<div style={{ color: theme.green, fontWeight: 900 }}>{bestSetup ? bestSetup[0] : "-"}</div></div>
          <div style={{ color: theme.muted }}>Needs Work<div style={{ color: theme.red, fontWeight: 900 }}>{worstSetup ? worstSetup[0] : "-"}</div></div>
        </div>
        {Object.entries(tagCounts).length > 0 && tagCloud(tagCounts, theme.blue)}
        {Object.entries(mistakeCounts).length > 0 && (
          <div style={{ display: "grid", gap: "6px" }}>
            <div style={{ color: theme.muted, fontSize: "10px", fontWeight: 900 }}>Mistake Tags</div>
            {tagCloud(mistakeCounts, theme.red)}
          </div>
        )}
      </div>

      <div style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderRadius: "6px", padding: "9px", display: "grid", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 900, color: theme.text }}>New Trade Review</div>
            <div style={{ fontSize: "10px", color: theme.muted }}>Setup, process, mistake tags, screenshot, lesson.</div>
          </div>
          <button onClick={() => updateDraft("symbol", selectedStock)} style={{ ...buttonStyle(false), height: "26px" }}>Use {selectedStock}</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <label style={labelStyle}>Symbol<input value={draft.symbol} onChange={(event) => updateDraft("symbol", event.target.value.toUpperCase())} style={inputStyle} /></label>
          <label style={labelStyle}>Bias<select value={draft.bias} onChange={(event) => updateDraft("bias", event.target.value)} style={inputStyle}><option>Long</option><option>Short</option><option>Neutral</option><option>Review</option></select></label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <label style={labelStyle}>Setup<select value={draft.setup} onChange={(event) => updateDraft("setup", event.target.value)} style={inputStyle}><option>Breakout</option><option>Pullback</option><option>Reversal</option><option>VWAP Reclaim</option><option>Range Trade</option><option>News Momentum</option></select></label>
          <label style={labelStyle}>Grade<select value={draft.grade} onChange={(event) => updateDraft("grade", event.target.value)} style={inputStyle}><option>A</option><option>B</option><option>C</option><option>D</option></select></label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <label style={labelStyle}>Result<select value={draft.result || "Review"} onChange={(event) => updateDraft("result", event.target.value)} style={inputStyle}><option>Win</option><option>Loss</option><option>Breakeven</option><option>Review</option></select></label>
          <label style={labelStyle}>Followed Plan<select value={draft.followedPlan || "Yes"} onChange={(event) => updateDraft("followedPlan", event.target.value)} style={inputStyle}><option>Yes</option><option>Mostly</option><option>No</option></select></label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <label style={labelStyle}>Emotion<select value={draft.emotion || "Calm"} onChange={(event) => updateDraft("emotion", event.target.value)} style={inputStyle}><option>Calm</option><option>Focused</option><option>FOMO</option><option>Hesitant</option><option>Revenge</option></select></label>
          <label style={labelStyle}>Screenshot URL<input value={draft.screenshotUrl || ""} onChange={(event) => updateDraft("screenshotUrl", event.target.value)} placeholder="Chart image or note link" style={inputStyle} /></label>
        </div>

        <label style={labelStyle}>Tags<input value={draft.tags} onChange={(event) => updateDraft("tags", event.target.value)} placeholder="discipline, patience, A+ setup..." style={inputStyle} /></label>
        <label style={labelStyle}>Mistake Tags<input value={draft.mistakeTags || ""} onChange={(event) => updateDraft("mistakeTags", event.target.value)} placeholder="chase, early exit, oversized, no stop..." style={inputStyle} /></label>
        <label style={labelStyle}>Trade Plan<textarea value={draft.plan} onChange={(event) => updateDraft("plan", event.target.value)} placeholder="Thesis, invalidation, target, and planned size." rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: "1.45" }} /></label>
        <label style={labelStyle}>Execution Review<textarea value={draft.review} onChange={(event) => updateDraft("review", event.target.value)} placeholder="Did you follow the plan? What repeats, what gets removed?" rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: "1.45" }} /></label>
        <button onClick={addEntry} style={{ ...buttonStyle(true), width: "100%" }}>Save Trade Review</button>
      </div>

      <div style={{ display: "grid", gap: "7px" }}>
        {entries.length === 0 ? (
          <div style={{ color: theme.muted, border: `1px dashed ${theme.border}`, borderRadius: "6px", padding: "10px", fontSize: "11px", lineHeight: "1.45" }}>
            No journal entries yet. Save your first review after a setup, replay, or paper trade.
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} style={{ background: theme.panel2, border: `1px solid ${theme.border}`, borderLeft: `3px solid ${gradeColors[entry.grade] || theme.blue}`, borderRadius: "6px", padding: "8px", display: "grid", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                <div>
                  <div style={{ color: theme.text, fontWeight: 900, fontSize: "12px" }}>{entry.symbol} / {entry.setup}</div>
                  <div style={{ color: theme.muted, fontSize: "9px" }}>{entry.createdAt} / {entry.bias} / Grade {entry.grade} / {entry.result || "Review"}</div>
                </div>
                <button onClick={() => deleteEntry(entry.id)} title="Delete entry" style={{ width: "24px", height: "24px", background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: "4px", cursor: "pointer" }}>x</button>
              </div>
              {entry.tags && <div style={{ color: theme.blue, fontSize: "10px", fontWeight: 800 }}>{entry.tags}</div>}
              {entry.mistakeTags && <div style={{ color: theme.red, fontSize: "10px", fontWeight: 800 }}>Mistakes: {entry.mistakeTags}</div>}
              <div style={{ color: theme.muted, fontSize: "10px" }}>Plan followed: <b style={{ color: theme.text }}>{entry.followedPlan || "-"}</b> / Emotion: <b style={{ color: theme.text }}>{entry.emotion || "-"}</b></div>
              {entry.screenshotUrl && <div style={{ color: theme.blue, fontSize: "10px", fontWeight: 800, overflowWrap: "anywhere" }}>Screenshot: {entry.screenshotUrl}</div>}
              <div style={{ color: theme.text, fontSize: "10px", lineHeight: "1.45" }}><b>Plan:</b> {entry.plan || "No plan recorded."}</div>
              <div style={{ color: theme.muted, fontSize: "10px", lineHeight: "1.45" }}><b style={{ color: theme.text }}>Review:</b> {entry.review || "No review recorded."}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
