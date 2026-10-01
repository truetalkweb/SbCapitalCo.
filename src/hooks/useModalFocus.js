import { useLayoutEffect, useRef } from 'react';

const modalStack = [];
const focusable = 'button, a[href], input, select, textarea, [tabindex]';

// Own focus for the lifetime of an open dialog, independent of callback identity.
export function useModalFocus(open, onClose, initialSelector) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  useLayoutEffect(() => { close.current = onClose; });
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const opener = document.activeElement;
    const token = {};
    modalStack.push(token);
    const ownsFocus = () => modalStack.at(-1) === token;
    const controls = () => [...element.querySelectorAll(focusable)].filter(node =>
      node.tabIndex >= 0 && !node.matches(':disabled') && !node.closest('[inert]') && node.getClientRects().length > 0
    );
    const first = () => element.querySelector(initialSelector || '[data-modal-initial-focus]') || controls()[0] || element;
    first().focus();
    const focusIn = event => {
      if (ownsFocus() && !element.contains(event.target)) first().focus();
    };
    const keyDown = event => {
      if (!ownsFocus()) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); close.current?.();
      } else if (event.key === 'Tab') {
        const items = controls();
        const index = items.indexOf(document.activeElement);
        if (!items.length) { event.preventDefault(); element.focus(); }
        else if (index < 0 || (!event.shiftKey && index === items.length - 1) || (event.shiftKey && index === 0)) {
          event.preventDefault(); (event.shiftKey ? items.at(-1) : items[0]).focus();
        }
      }
    };
    document.addEventListener('focusin', focusIn);
    document.addEventListener('keydown', keyDown, true);
    return () => {
      const wasTop = ownsFocus();
      modalStack.splice(modalStack.indexOf(token), 1);
      document.removeEventListener('focusin', focusIn);
      document.removeEventListener('keydown', keyDown, true);
      if (wasTop && opener?.isConnected) opener.focus();
    };
  }, [open, initialSelector]);
  return dialog;
}
