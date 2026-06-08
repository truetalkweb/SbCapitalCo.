import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

function matchesAction(action, query) {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return true;

  const haystack = [
    action.label,
    action.detail,
    action.group,
    action.keywords,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return cleanQuery
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export default function CommandPalette({
  theme,
  isOpen,
  onClose,
  actions = [],
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const filteredActions = useMemo(
    () => actions.filter((action) => matchesAction(action, query)).slice(0, 14),
    [actions, query]
  );

  useEffect(() => {
    if (!isOpen) return;

    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) =>
          Math.min(index + 1, Math.max(filteredActions.length - 1, 0))
        );
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const action = filteredActions[activeIndex];
        if (!action) return;
        action.onRun();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, filteredActions, isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(3,7,18,0.62)",
        display: "grid",
        placeItems: "start center",
        paddingTop: "9vh",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          width: "min(680px, calc(100vw - 28px))",
          background: theme.panel,
          border: `1px solid ${theme.border}`,
          borderRadius: "8px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "relative",
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <Search
            size={18}
            style={{
              position: "absolute",
              top: "15px",
              left: "14px",
              color: theme.muted,
              pointerEvents: "none",
            }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search symbols, presets, workspaces, commands..."
            style={{
              width: "100%",
              height: "48px",
              padding: "0 14px 0 42px",
              background: theme.panel2,
              border: "none",
              outline: "none",
              color: theme.text,
              fontSize: "14px",
              fontWeight: 800,
            }}
          />
        </div>

        <div style={{ maxHeight: "430px", overflowY: "auto", padding: "6px" }}>
          {filteredActions.length === 0 ? (
            <div
              style={{
                padding: "16px",
                color: theme.muted,
                fontSize: "12px",
                textAlign: "center",
              }}
            >
              No commands found.
            </div>
          ) : (
            filteredActions.map((action, index) => {
              const active = index === activeIndex;

              return (
                <button
                  key={action.id}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    action.onRun();
                    onClose();
                  }}
                  style={{
                    width: "100%",
                    minHeight: "46px",
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 10px",
                    background: active ? "rgba(33,150,243,0.15)" : "transparent",
                    border: `1px solid ${active ? theme.blue : "transparent"}`,
                    borderRadius: "6px",
                    color: theme.text,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: 900,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {action.label}
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: "2px",
                        color: theme.muted,
                        fontSize: "10px",
                        fontWeight: 800,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {action.detail}
                    </span>
                  </span>
                  <span
                    style={{
                      color: action.accent || theme.blue,
                      fontSize: "10px",
                      fontWeight: 900,
                    }}
                  >
                    {action.group}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: `1px solid ${theme.border}`,
            padding: "7px 10px",
            color: theme.muted,
            fontSize: "10px",
            fontWeight: 800,
          }}
        >
          <span>Enter to run</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
