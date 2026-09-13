import { useEffect, useRef } from "react";

export default function NewsPreview({ story, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  return <dialog ref={dialog} className="ws-story-preview ws-panel" aria-label="News preview"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const targets = [...dialog.current.querySelectorAll("button, a[href]")];
      const first = targets[0];
      const last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div>
      <button autoFocus className="ws-icon" aria-label="Close news preview" onClick={onClose}>×</button>
      <small>{story.source}</small>
      <h2>{story.headline || story.title}</h2>
      <p>{story.summary || story.description || "Open the source article for the full report."}</p>
      {/^https?:\/\//i.test(story.url || "") && <a href={story.url} target="_blank" rel="noreferrer">Read source article ↗</a>}
    </div>
  </dialog>;
}
