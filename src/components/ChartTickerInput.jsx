import { useCallback, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { terminalMonoFont } from "../config/terminalConfig";

export default function ChartTickerInput({ value, onCommit, theme, label }) {
  const [draft, setDraft] = useState(value || "");
  const cleanValue = String(value || "").trim().toUpperCase();
  const cleanDraft = draft.trim().toUpperCase();
  const isValidDraft = useMemo(
    () => /^[A-Z0-9][A-Z0-9./:-]{0,13}$/.test(cleanDraft),
    [cleanDraft]
  );

  const commit = useCallback(() => {
    const clean = draft.trim().toUpperCase();

    if (!clean || !/^[A-Z0-9][A-Z0-9./:-]{0,13}$/.test(clean)) {
      setDraft(cleanValue);
      return;
    }

    if (clean !== cleanValue) {
      onCommit(clean);
    }

    setDraft(clean);
  }, [cleanValue, draft, onCommit]);

  return (
    <label
      style={{
        position: "relative",
        display: "block",
        width: "clamp(118px, 13vw, 180px)",
      }}
    >
      <Search
        size={13}
        style={{
          position: "absolute",
          left: "9px",
          top: "50%",
          transform: "translateY(-50%)",
          color: theme.muted,
          pointerEvents: "none",
        }}
      />
      <input
        aria-label={`${label} ticker`}
        value={draft}
        onChange={(event) => {
          const next = event.target.value.toUpperCase().replace(/[^A-Z0-9./:-]/g, "");
          setDraft(next.slice(0, 14));
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
            event.currentTarget.blur();
          }

          if (event.key === "Escape") {
            setDraft(cleanValue);
            event.currentTarget.blur();
          }
        }}
        placeholder="Ticker"
        title={isValidDraft || !cleanDraft ? "Chart ticker" : "Use letters, numbers, dot, slash, colon, or dash."}
        style={{
          width: "100%",
          height: "26px",
          padding: "0 9px 0 28px",
          background: theme.panel,
          border: `1px solid ${!isValidDraft && cleanDraft ? theme.red : theme.borderSoft || theme.border}`,
          borderRadius: "6px",
          color: theme.text,
          outline: "none",
          fontFamily: terminalMonoFont,
          fontSize: "12px",
          fontWeight: 850,
          textTransform: "uppercase",
        }}
      />
    </label>
  );
}
