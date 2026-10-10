import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActionNoticeAlert } from "./Notices";
import type { ActionNotice } from "./useCandidateDetail";

type Common = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName: string;
  requirementTitle: string;
  notice: ActionNotice | null;
  shortlistHref: string;
};

export function RejectDialog({
  open,
  onOpenChange,
  displayName,
  requirementTitle,
  notice,
  shortlistHref,
  onSubmit,
}: Common & { onSubmit: (v: { note?: string }) => Promise<boolean> }) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    const ok = await onSubmit({ note: note.trim() || undefined });
    setSubmitting(false);
    if (ok) {
      onOpenChange(false);
      setNote("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this candidate?</DialogTitle>
          <DialogDescription>Marks {displayName} as rejected for {requirementTitle}. This can't be undone from here.</DialogDescription>
        </DialogHeader>
        {notice && <ActionNoticeAlert notice={notice} shortlistHref={shortlistHref} />}
        <div className="grid gap-2 py-1">
          <Label htmlFor="reject-note">Reason (optional)</Label>
          <Textarea id="reject-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything you want on record about this decision…" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="pointer-coarse:h-11">Cancel</Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={submitting} aria-busy={submitting || undefined} className="pointer-coarse:h-11">
            {submitting ? "Rejecting…" : "Reject candidate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
