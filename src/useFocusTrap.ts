import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** WCAG 2.4.3 / ARIA dialog pattern: while `active`, Tab and Shift+Tab cycle
 *  inside `containerRef`, focus moves into the dialog on open (first form
 *  field, else first focusable, else the container), and returns to the
 *  element that opened it on close. Escape handling stays with the caller. */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    const initial = container.querySelector<HTMLElement>("input:not([disabled]), textarea:not([disabled]), select:not([disabled])") ?? items()[0];
    if (initial) initial.focus();
    else {
      if (!container.hasAttribute("tabindex")) container.setAttribute("tabindex", "-1");
      container.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = items();
      if (list.length === 0) { e.preventDefault(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      const current = document.activeElement;
      if (!container.contains(current)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && current === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && current === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [containerRef, active]);
}
