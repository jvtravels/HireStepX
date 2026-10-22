import { useEffect } from "react";
import { isTypingTarget } from "../candidates/[candidateId]/_components/useCandidateShortcuts";

export interface ShortlistShortcutHandlers {
  onNext: () => void;
  onPrev: () => void;
  onToggleSelect: () => void;
  onOpen: () => void;
  onHelp: () => void;
  onEscape: () => void;
  /** z: runs the Undo on a visible toast, if there is one. */
  onUndo: () => void;
}

/** j/k move through the visible rows, x selects, e opens, ? shows the list, Esc clears the selection, z undoes the last stage change while its toast is up.
    Ignored while typing, inside a dialog or menu, or with a modifier held, like the candidate-page shortcuts. */
export function useShortlistShortcuts(handlers: ShortlistShortcutHandlers, enabled: boolean) {
  const { onNext, onPrev, onToggleSelect, onOpen, onHelp, onEscape, onUndo } = handlers;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      // A held key would otherwise flip a selection on and off or fire Undo repeatedly.
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTypingTarget(e.target)) return;
      switch (e.key) {
        case "j": onNext(); break;
        case "k": onPrev(); break;
        case "x": onToggleSelect(); break;
        case "e": onOpen(); break;
        case "z": onUndo(); break;
        case "?": onHelp(); break;
        case "Escape": onEscape(); break;
        default: return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onNext, onPrev, onToggleSelect, onOpen, onHelp, onEscape, onUndo]);
}

/** The status line a screen reader hears after j/k/x. */
export function rowAnnouncement(name: string, position: number, total: number, selected: boolean): string {
  return `${name}, candidate ${position} of ${total}${selected ? ", selected" : ""}`;
}
