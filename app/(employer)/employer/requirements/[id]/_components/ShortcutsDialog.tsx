"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

export const SHORTLIST_SHORTCUTS: ReadonlyArray<{ keys: string; does: string }> = [
  { keys: "j", does: "Next candidate" },
  { keys: "k", does: "Previous candidate" },
  { keys: "x", does: "Select or deselect the candidate" },
  { keys: "e", does: "Open the candidate's profile" },
  { keys: "z", does: "Undo the last stage change while its notice is showing" },
  { keys: "Esc", does: "Clear the selection" },
  { keys: "?", does: "Show this list" },
];

export default function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Work through the shortlist without the mouse. Shortcuts pause while you type or a dialog is open.</DialogDescription>
        </DialogHeader>
        <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-[14px] text-hx-coal">
          {SHORTLIST_SHORTCUTS.map((s) => (
            <div key={s.keys} className="contents">
              <dt><Kbd>{s.keys}</Kbd></dt>
              <dd className="m-0">{s.does}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
