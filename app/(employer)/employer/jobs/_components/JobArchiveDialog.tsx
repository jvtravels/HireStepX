"use client";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { RequirementSummary, ArchiveDisposition } from "@/employer/mockData";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { ARCHIVE_REASONS } from "./jobsHelpers";

export default function JobArchiveDialog({
  target, busy, reason, onReasonChange, disposition, onDispositionChange, onConfirm, onClose,
}: {
  target: RequirementSummary | null;
  busy: boolean;
  reason: string;
  onReasonChange: (v: string) => void;
  disposition: ArchiveDisposition;
  onDispositionChange: (v: ArchiveDisposition) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const isClosed = target?.status === "closed";
  return (
    <AlertDialog open={!!target} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isClosed ? "Reopen this job?" : "Archive this job?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {isClosed
              ? `"${target?.title}" will go back to matching candidates and can be edited again.`
              : `"${target?.title}" will be closed to new matches and can't be edited until you reopen it.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!isClosed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 0" }}>
            <div>
              <Label htmlFor="archive-reason" className="mb-1.5">Reason for archiving (optional)</Label>
              <Select value={reason} onValueChange={onReasonChange}>
                <SelectTrigger id="archive-reason" className="w-full">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {ARCHIVE_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label id="archive-disposition-label" className="mb-1.5">What happens to the remaining candidates?</Label>
              <RadioGroup aria-labelledby="archive-disposition-label" value={disposition} onValueChange={(v) => onDispositionChange(v === "reject_remaining" ? "reject_remaining" : "keep_candidates")}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <RadioGroupItem value="keep_candidates" id="disposition-keep" style={{ marginTop: 2 }} />
                  <Label htmlFor="disposition-keep" style={{ fontWeight: 400 }}>Keep candidate data — leave every candidate&apos;s status as-is</Label>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <RadioGroupItem value="reject_remaining" id="disposition-reject" aria-describedby="disposition-reject-help" style={{ marginTop: 2 }} />
                  <div>
                    <Label htmlFor="disposition-reject" style={{ fontWeight: 400 }}>Reject all remaining candidates</Label>
                    <p id="disposition-reject-help" style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkSoft, margin: "2px 0 0" }}>
                      Marks every candidate who isn&apos;t already hired, rejected, or marked not a fit as rejected.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); onConfirm(); }} disabled={busy}>
            {busy ? "Working…" : isClosed ? "Reopen" : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
