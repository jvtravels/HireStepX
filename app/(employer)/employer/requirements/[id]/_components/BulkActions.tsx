"use client";

import { useState } from "react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, OutlineCta } from "@/employer/_atoms";
import { InlineNotice, LinkCta } from "@/employer/_requirementAtoms";
import { failureMessage, setCandidateStatus } from "@/employer/_requirementCalls";
import type { Candidate } from "@/employer/mockData";
import { canReject } from "./requirementFormat";

type Outcome = { tone: "success" | "warning" | "error"; title: string; lines: string[] };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Selection bar, Compare link and bulk reject. Rejection is final on the
    server (rejected is terminal), so there is deliberately no Undo: the
    confirm dialog says so instead. */
export default function BulkActions({
  requirementId,
  requirementTitle,
  selected,
  suspended,
  onClearSelection,
  onRejected,
}: {
  requirementId: string;
  requirementTitle: string;
  selected: Candidate[];
  suspended: boolean;
  onClearSelection: () => void;
  onRejected: (matchIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const eligible = selected.filter(canReject);
  const skipped = selected.length - eligible.length;
  const [first, second] = selected;

  const submit = async () => {
    setSubmitting(true);
    const trimmed = note.trim() || undefined;
    const results = await Promise.all(eligible.map((c) => setCandidateStatus(c.id, { candidateStatus: "rejected", note: trimmed })));
    setSubmitting(false);
    setOpen(false);
    setNote("");

    const done: string[] = [];
    const failures = new Map<string, number>();
    results.forEach((r, i) => {
      if (r.ok) done.push(eligible[i].id);
      else {
        const msg = failureMessage("status", r);
        failures.set(msg, (failures.get(msg) ?? 0) + 1);
      }
    });
    if (done.length > 0) onRejected(done);

    const failed = eligible.length - done.length;
    const lines = Array.from(failures, ([msg, n]) => (failures.size > 1 ? `${plural(n, "candidate", "candidates")}: ${msg}` : msg));
    const skippedNote = skipped > 0 ? `${plural(skipped, "candidate was", "candidates were")} skipped because they can't be rejected from their current status.` : null;
    if (skippedNote) lines.push(skippedNote);

    if (failed === 0) {
      setOutcome({ tone: skipped > 0 ? "warning" : "success", title: `${plural(done.length, "candidate", "candidates")} rejected.`, lines: skippedNote ? [skippedNote] : [] });
    } else if (done.length === 0) {
      setOutcome({ tone: "error", title: "No candidates were rejected.", lines });
    } else {
      setOutcome({ tone: "warning", title: `${done.length} rejected, ${failed} failed. The failed ones are still selected.`, lines });
    }
  };

  return (
    <>
      {/* Always mounted so the result is announced after the bar disappears. */}
      <div aria-live="polite" style={{ marginBottom: outcome ? 16 : 0 }}>
        {outcome && (
          <InlineNotice
            tone={outcome.tone === "success" ? "success" : outcome.tone}
            title={outcome.title}
            action={
              <Button type="button" variant="link" onClick={() => setOutcome(null)} className="pointer-coarse:min-h-11" style={{ fontFamily: f.sans, fontSize: textSize.base, fontWeight: 600, height: "auto", padding: 0, color: "inherit" }}>
                Dismiss
              </Button>
            }
            live={false}
          >
            {outcome.lines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </InlineNotice>
        )}
      </div>

      {selected.length > 0 && (
        <Card aria-label="Selected candidates" style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "10px 16px" }}>
          <span aria-live="polite" style={{ fontFamily: f.sans, fontSize: textSize.base, fontWeight: 600, color: t.coal }}>
            {plural(selected.length, "candidate", "candidates")} selected
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Button type="button" variant="link" onClick={onClearSelection} className="pointer-coarse:min-h-11" style={{ fontFamily: f.sans, fontSize: textSize.base, fontWeight: 600, height: "auto", padding: 0 }}>
              Clear selection
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={suspended || eligible.length === 0}
              onClick={() => setOpen(true)}
              className="pointer-coarse:h-11"
              title={suspended ? "Turned off while your account is suspended" : eligible.length === 0 ? "None of the selected candidates can be rejected from their current status" : undefined}
            >
              Reject selected
            </Button>
            {selected.length === 2 && (
              <LinkCta size="sm" href={`/employer/requirements/${requirementId}/compare?a=${encodeURIComponent(first.id)}&b=${encodeURIComponent(second.id)}`}>
                Compare selected candidates
              </LinkCta>
            )}
          </div>
        </Card>
      )}

      <Dialog open={open} onOpenChange={(next) => { if (!submitting) setOpen(next); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject {plural(eligible.length, "candidate", "candidates")}?</DialogTitle>
            <DialogDescription>
              Marks them as rejected for {requirementTitle}. This can&apos;t be undone from here.
              {skipped > 0 && ` ${plural(skipped, "selected candidate is", "selected candidates are")} already hired, rejected or closed out, so they will be skipped.`}
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: "grid", gap: 8, padding: "4px 0" }}>
            <Label htmlFor="bulk-reject-note">Reason (optional, applied to all)</Label>
            <Textarea id="bulk-reject-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything you want on record about this decision." />
          </div>
          <DialogFooter>
            <OutlineCta onClick={() => setOpen(false)} disabled={submitting}>Cancel</OutlineCta>
            <Button type="button" variant="destructive" onClick={submit} disabled={submitting || eligible.length === 0} className="pointer-coarse:h-11">
              {submitting ? "Rejecting…" : "Reject candidates"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
