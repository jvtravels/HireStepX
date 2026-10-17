"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { HelpText, OutlineCta } from "@/employer/_atoms";
import { useEmployerData, type Requirement, type UnlockPurchase } from "@/employer/EmployerDataContext";
import type { ArchiveDisposition } from "@/employer/mockData";
import { InlineNotice } from "@/employer/_requirementAtoms";
import { formatPaise } from "../../../../../../server-handlers/_unlock-pricing";

function formatPrice(paise: number, creditPaise = 0): string {
  if (paise === 0) return creditPaise > 0 ? `${formatPaise(creditPaise)} credit` : "Complimentary";
  return creditPaise > 0 ? `${formatPaise(paise)} + ${formatPaise(creditPaise)} credit` : formatPaise(paise);
}

export function UnlockHistoryDialog({
  open,
  onOpenChange,
  requirement,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirement: Requirement;
}) {
  const { fetchUnlockHistory } = useEmployerData();
  const [purchases, setPurchases] = useState<UnlockPurchase[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setLoading(true);
    setFailed(false);
    fetchUnlockHistory().then((res) => {
      if (res == null) setFailed(true);
      else setPurchases(res);
      setLoading(false);
    });
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (next && purchases == null && !loading) load();
  };

  // Match by the requirement the order was placed for; candidates is only one
  // page of the shortlist, so matching on it would hide purchases on other pages.
  const ids = new Set(requirement.candidates.map((c) => c.id));
  const relevant = (purchases ?? []).filter((p) => (p.requirementId ? p.requirementId === requirement.id : p.matchIds.some((id) => ids.has(id))));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unlock history</DialogTitle>
          <DialogDescription>Every contact unlock purchased against this requirement.</DialogDescription>
        </DialogHeader>
        <div aria-live="polite" aria-busy={loading}>
          {loading ? (
            <div className="grid gap-2.5">
              <span className="sr-only">Loading purchase history</span>
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
          ) : failed ? (
            <InlineNotice
              tone="error"
              title="Couldn't load your purchase history"
              action={<OutlineCta size="sm" onClick={load}>Try again</OutlineCta>}
            >
              Check your connection and try again.
            </InlineNotice>
          ) : relevant.length === 0 ? (
            <HelpText>No unlocks purchased for this requirement yet.</HelpText>
          ) : (
            <ul className="m-0 flex max-h-80 list-none flex-col overflow-y-auto p-0">
              {relevant.map((p) => {
                const names = (p.candidates || []).map((c) => c.name).filter((n): n is string => !!n);
                const label = names.length > 0 ? names.join(", ") : p.matchIds.length > 1 ? `Batch of ${p.matchIds.length}` : "Single candidate";
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-hx-line py-2">
                    <span className="min-w-0 text-[13px] text-hx-coal [overflow-wrap:anywhere]">{label}</span>
                    <span className="text-[13px] text-hx-ink-soft">
                      {formatPrice(p.amount, p.creditAppliedPaise)}{p.refundedAt ? " (refunded)" : ""} · {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ArchiveDialog({
  open,
  onOpenChange,
  requirement,
  onArchived,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirement: Requirement;
  onArchived: () => void;
}) {
  const { archiveRequirement } = useEmployerData();
  const [reason, setReason] = useState("");
  const [disposition, setDisposition] = useState<ArchiveDisposition>("keep_candidates");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const ok = await archiveRequirement(requirement.id, { archiveReason: reason.trim() || undefined, archiveDisposition: disposition });
    setSaving(false);
    if (!ok) {
      setError("Couldn't archive this job. Check your connection and try again. If your account is suspended, archiving is turned off.");
      return;
    }
    setReason("");
    onOpenChange(false);
    onArchived();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Archive &ldquo;{requirement.title}&rdquo;?</DialogTitle>
          <DialogDescription>
            Closes the posting to new unlocks. Candidates already unlocked stay unlocked. This only affects new activity.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3.5 py-1">
          <div className="grid gap-2">
            <Label htmlFor="archive-reason">Reason (optional)</Label>
            <Textarea id="archive-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Role filled, put on hold, etc." />
          </div>
          <div role="group" aria-labelledby="archive-disposition-label" className="grid gap-2">
            <Label id="archive-disposition-label">Candidates still in the pipeline</Label>
            <RadioGroup value={disposition} onValueChange={(v) => setDisposition(v as ArchiveDisposition)}>
              <div className="flex items-center gap-2 pointer-coarse:min-h-11">
                <RadioGroupItem value="keep_candidates" id="archive-keep" />
                <Label htmlFor="archive-keep" className="font-normal">Leave their status as is</Label>
              </div>
              <div className="flex items-center gap-2 pointer-coarse:min-h-11">
                <RadioGroupItem value="reject_remaining" id="archive-reject" />
                <Label htmlFor="archive-reject" className="font-normal">Reject everyone still in the pipeline</Label>
              </div>
            </RadioGroup>
            {disposition === "reject_remaining" && (
              <HelpText>Rejected candidates can&apos;t be moved back into the pipeline.</HelpText>
            )}
          </div>
          {error && <InlineNotice tone="error">{error}</InlineNotice>}
        </div>
        <DialogFooter>
          <OutlineCta onClick={() => onOpenChange(false)} disabled={saving}>Cancel</OutlineCta>
          <Button type="button" variant="destructive" onClick={submit} disabled={saving} className="pointer-coarse:h-11">
            {saving ? "Archiving…" : "Archive job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
