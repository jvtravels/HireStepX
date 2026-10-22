"use client";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { REJECT_NOTIFY_NOTE } from "./requirementFormat";

/** Confirms a bulk reject by naming every candidate it will act on, so nothing is rejected out of sight. */
export default function BulkRejectDialog({
  open,
  names,
  skipped,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  names: readonly string[];
  /** Selected candidates this move doesn't apply to, left as they are. */
  skipped: number;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const noun = names.length === 1 ? "candidate" : "candidates";
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Reject ${names.length} ${noun}?`}</AlertDialogTitle>
          <AlertDialogDescription>{REJECT_NOTIFY_NOTE}</AlertDialogDescription>
        </AlertDialogHeader>
        <ul aria-label="Candidates to reject" className="m-0 max-h-44 list-none overflow-y-auto rounded-lg border border-hx-line bg-hx-row p-2 text-[14px] text-hx-coal">
          {names.map((name, i) => (
            <li key={`${name}-${i}`} className="truncate px-1 py-0.5">{name}</li>
          ))}
        </ul>
        {skipped > 0 && (
          <p className="m-0 text-[13px] text-hx-ink-soft">
            {skipped} other selected {skipped === 1 ? "candidate" : "candidates"} can&apos;t be rejected from their stage and will be left as they are.
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); onConfirm(); }} disabled={busy || names.length === 0}>
            {busy ? "Saving…" : `Reject ${names.length} ${noun}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
