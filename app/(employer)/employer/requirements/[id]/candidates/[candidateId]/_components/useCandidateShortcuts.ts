import { useEffect } from "react";

type Handlers = { onNext: () => void; onPrev: () => void; onTab: (index: number) => void; onUndo: () => void };

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return true;
  return target.closest('[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]') !== null;
}

/** J/K step through the shortlist, 1 to 3 switch tabs, Z runs the Undo on a visible toast. Ignored while typing, in a dialog or with a modifier held. */
export function useCandidateShortcuts({ onNext, onPrev, onTab, onUndo }: Handlers, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTypingTarget(e.target)) return;
      if (e.key === "j") onNext();
      else if (e.key === "k") onPrev();
      else if (e.key === "z") onUndo();
      else if (e.key >= "1" && e.key <= "3") onTab(Number(e.key) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onNext, onPrev, onTab, onUndo]);
}
