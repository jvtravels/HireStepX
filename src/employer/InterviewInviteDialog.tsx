"use client";

import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OutlineCta, PrimaryCta } from "@/employer/_atoms";
import { openDatePicker } from "@/employer/DateField";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import type { CandidateStatus } from "@/employer/mockData";

/** The one rule for who can be invited. Every surface that offers "Invite to
 *  interview" (candidates table, candidate page, messages) asks this, so the
 *  action can't drift between screens. */
export function canInviteToInterview(status: CandidateStatus): boolean {
  return status === "shortlisted";
}

/* Server-supplied copy wins; these cover the structured codes the status
   endpoint returns so each failure says what to do next. */
export function statusErrorCopy(err: { error: string; status?: number; code?: string }): string {
  if (err.code === "unlock_required" || err.status === 402) return "Unlock this candidate before changing their status.";
  if (err.code === "candidate_withdrew") return "This candidate has withdrawn from employer contact, so you can't invite them.";
  if (err.status === 409) return "This candidate has declined contact, so their status can't be changed.";
  if (err.status === 404) return "This candidate is no longer available.";
  if (err.status === 403 || err.code === "suspended") return "Your account is suspended. Contact support to restore access.";
  return err.error || "Couldn't update the candidate. Please try again.";
}

export interface InviteValues {
  /** Written to the candidate: it is posted in their conversation with the invite. */
  message?: string;
  scheduledAt?: string;
}

export type InviteResult = { ok: true } | { ok: false; message?: string };

/** Single interview-invite dialog shared by every screen. The caller owns the
 *  network call (so each screen can refresh its own data); the dialog owns the
 *  form, the in-flight state and the inline error. */
export default function InterviewInviteDialog({
  open,
  onOpenChange,
  displayName,
  requirementTitle,
  onSubmit,
  notice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName: string;
  requirementTitle: string;
  onSubmit: (values: InviteValues) => Promise<InviteResult>;
  /** Extra context shown above the fields (e.g. an unlock-required banner). */
  notice?: ReactNode;
}) {
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (next: boolean) => {
    if (!next) setError(null);
    onOpenChange(next);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const res = await onSubmit({ message: message.trim() || undefined, scheduledAt: date || undefined });
    setSubmitting(false);
    if (res.ok) {
      setMessage("");
      setDate("");
      onOpenChange(false);
    } else if (res.message) {
      setError(res.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send interview invite</DialogTitle>
          <DialogDescription>Marks {displayName} as invited to interview for {requirementTitle}.</DialogDescription>
        </DialogHeader>
        {notice}
        <div style={{ display: "grid", gap: 14, padding: "4px 0" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <Label htmlFor="invite-scheduled-at">Scheduled date (optional)</Label>
            <Input id="invite-scheduled-at" type="date" value={date} onClick={openDatePicker} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <Label htmlFor="invite-message">Message to candidate (optional)</Label>
            <Textarea id="invite-message" rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} aria-describedby="invite-message-hint" placeholder="Venue, what to prepare, who they will meet…" />
            <p id="invite-message-hint" className="m-0 text-xs text-muted-foreground">The candidate sees this with your invite.</p>
          </div>
          {error && (
            <p role="alert" style={{ margin: 0, padding: "8px 10px", borderRadius: 8, background: t.error100, border: `1px solid ${t.errorLine}`, color: t.errorInk, fontFamily: f.sans, fontSize: 13, lineHeight: 1.5 }}>
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <OutlineCta onClick={() => close(false)}>Cancel</OutlineCta>
          <PrimaryCta onClick={submit} loading={submitting}>
            {submitting ? "Sending…" : "Send invite"}
          </PrimaryCta>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
