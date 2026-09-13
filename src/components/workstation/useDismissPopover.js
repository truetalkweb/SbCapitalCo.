import { useEffect, useRef } from "react";

export function useDismissPopover(open, setOpen) {
  const container = useRef(null);
  useEffect(() => {
    if (!open) return;
    const pointerDown = event => {
      if (!container.current?.contains(event.target)) setOpen(false);
    };
    const keyDown = event => {
      if (event.key !== "Escape") return;
      setOpen(false);
      container.current?.querySelector("button")?.focus();
    };
    document.addEventListener("pointerdown", pointerDown);
    document.addEventListener("keydown", keyDown);
    return () => {
      document.removeEventListener("pointerdown", pointerDown);
      document.removeEventListener("keydown", keyDown);
    };
  }, [open, setOpen]);
  return container;
}
