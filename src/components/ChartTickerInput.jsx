import { useCallback, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { terminalMonoFont } from "../config/terminalConfig";

export default function ChartTickerInput({ value, onCommit, theme, label, compact = false }) {
  const cleanValue = String(value || "").trim().toUpperCase();
  const [draftState, setDraftState] = useState(() => ({
    sourceValue: cleanValue,
    draft: cleanValue,
  }));
  const draft = draftState.sourceValue === cleanValue ? draftState.draft : cleanValue;
  const cleanDraft = draft.trim().toUpperCase();
  const [commitErrorSource, setCommitErrorSource] = useState("");
  const showCommitError = commitErrorSource === cleanValue;
  const isValidDraft = useMemo(
    () => /^[A-Z0-9][A-Z0-9./:-]{0,13}$/.test(cleanDraft),
    [cleanDraft]
  );

  const commit = useCallback(() => {
    const clean = draft.trim().toUpperCase();

    if (!clean || !/^[A-Z0-9][A-Z0-9./:-]{0,13}$/.test(clean)) {
      setDraftState({ sourceValue: cleanValue, draft: cleanValue });
      setCommitErrorSource(clean ? cleanValue : "");
      return;
    }

    try {
      if (clean !== cleanValue) {
        onCommit(clean);
      }

      setDraftState({ sourceValue: clean, draft: clean });
      setCommitErrorSource("");
    } catch {
      setDraftState({ sourceValue: cleanValue, draft: cleanValue });
      setCommitErrorSource(cleanValue);
    }
  }, [cleanValue, draft, onCommit]);

  return (
    <label
      style={{
        position: "relative",
        display: "block",
        width: compact ? "128px" : "168px",
        flex: compact ? "0 0 128px" : "0 0 168px",
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
          setDraftState({ sourceValue: cleanValue, draft: next.slice(0, 14) });
          setCommitErrorSource("");
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
            event.currentTarget.blur();
          }

          if (event.key === "Escape") {
            setDraftState({ sourceValue: cleanValue, draft: cleanValue });
            event.currentTarget.blur();
          }
        }}
        placeholder="Ticker"
        title={showCommitError ? "Ticker change was rejected. Try a valid listed symbol." : isValidDraft || !cleanDraft ? "Chart ticker" : "Use letters, numbers, dot, slash, colon, or dash."}
        style={{
          width: "100%",
          height: "26px",
          padding: "0 9px 0 28px",
          background: theme.panel,
          border: `1px solid ${showCommitError || (!isValidDraft && cleanDraft) ? theme.red : theme.borderSoft || theme.border}`,
          borderRadius: "6px",
          color: theme.text,
          outline: "none",
          fontFamily: terminalMonoFont,
          fontVariantNumeric: "tabular-nums",
          fontSize: "12px",
          fontWeight: 850,
          textTransform: "uppercase",
        }}
      />
    </label>
  );
}
