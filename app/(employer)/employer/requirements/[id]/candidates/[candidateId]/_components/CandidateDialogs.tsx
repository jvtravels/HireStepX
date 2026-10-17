import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";
import { REJECT_REASONS, composeRejectNote } from "@/employer/_passReasons";
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
  const [reasons, setReasons] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (reason: string) => setReasons((cur) => (cur.includes(reason) ? cur.filter((r) => r !== reason) : [...cur, reason]));

  const submit = async () => {
    setSubmitting(true);
    const ok = await onSubmit({ note: composeRejectNote(reasons, note) });
    setSubmitting(false);
    if (ok) {
      onOpenChange(false);
      setNote("");
      setReasons([]);
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
        <div className="grid gap-4 py-1">
          <fieldset className="m-0 grid gap-2 border-0 p-0">
            <legend className="mb-2 p-0 text-sm font-medium text-hx-coal">Why? (optional, pick any)</legend>
            <div className="flex flex-wrap gap-1.5">
              {REJECT_REASONS.map((reason) => {
                const on = reasons.includes(reason);
                return (
                  <button
                    key={reason}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(reason)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[13px] pointer-coarse:min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo",
                      on ? "border-hx-indigo bg-hx-indigo-100 font-medium text-hx-indigo" : "border-hx-line bg-white text-hx-coal hover:bg-hx-row",
                    )}
                  >
                    {reason}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="grid gap-2">
            <Label htmlFor="reject-note">Add detail (optional)</Label>
            <Textarea id="reject-note" rows={3} maxLength={1500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else you want on record about this decision…" />
          </div>
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
