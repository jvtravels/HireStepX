"use client";

/* Per-match overflow menu for the candidate: respond (interested / not
   interested), block, report. Block and report are irreversible from the
   candidate's side, so both go through a confirm dialog. Dialogs are rendered
   as siblings of the menu (not children) and the menu is non-modal, otherwise
   Radix's focus/scroll lock from the menu fights the dialog opening from a
   menu item. */

import { useId, useRef, useState } from "react";
import { MoreHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "./AuthContext";
import {
  REPORT_NOTE_MAX, REPORT_REASONS, blockEmployer, dropMatchFromCaches, normalizeResponse,
  reportEmployer, respondToEmployer, responseLabel, storeResponse,
  type EmployerReportReason, type EmployerResponse,
} from "./employerActions";

type DialogKind = "block" | "report" | null;

interface Props {
  matchId: string;
  /** Used in accessible names and dialog copy — the company name, or a generic label when masked. */
  employerLabel: string;
  response: EmployerResponse | null;
  onResponseChange: (next: EmployerResponse | null) => void;
  /** Called after a successful block/report; the parent should leave/refresh the match view. */
  onRemoved: () => void;
  onToast: (message: string, kind?: "error") => void;
}

export function EmployerResponseBadge({ response }: { response: EmployerResponse | null | undefined }) {
  const label = responseLabel(response);
  if (!label) return null;
  const interested = response === "interested";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${interested ? "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}

export default function EmployerActionsMenu({ matchId, employerLabel, response, onResponseChange, onRemoved, onToast }: Props) {
  const { user } = useAuth();
  const noteId = useId();
  const errorId = useId();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [reason, setReason] = useState<EmployerReportReason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const responseRef = useRef(response);
  responseRef.current = response;

  const closeDialog = () => {
    if (busy) return;
    setDialog(null);
    setError(null);
  };

  const onRespond = async (value: string) => {
    const next = normalizeResponse(value);
    if (!next || next === responseRef.current) return;
    const previous = responseRef.current;
    // Optimistic; roll back to the exact previous answer if the server refuses.
    onResponseChange(next);
    storeResponse(matchId, next);
    const result = await respondToEmployer(matchId, next);
    if (result.ok) {
      onToast(next === "interested" ? "Told the employer you're interested." : "Told the employer you're not interested.");
    } else {
      onResponseChange(previous);
      storeResponse(matchId, previous);
      onToast(`Couldn't save your response — ${result.error}`, "error");
    }
  };

  const finishRemoval = (message: string) => {
    storeResponse(matchId, null);
    dropMatchFromCaches(user?.id, matchId);
    setDialog(null);
    setNote("");
    setReason("");
    onToast(message);
    onRemoved();
  };

  const confirmBlock = async () => {
    setBusy(true);
    setError(null);
    const result = await blockEmployer(matchId);
    setBusy(false);
    if (result.ok) finishRemoval("Employer blocked. They can no longer see or contact you.");
    else setError(result.error);
  };

  const confirmReport = async () => {
    if (!reason) { setError("Choose a reason so we can review this properly."); return; }
    setBusy(true);
    setError(null);
    const result = await reportEmployer(matchId, reason, note);
    setBusy(false);
    if (result.ok) finishRemoval("Report sent. The employer is blocked from contacting you.");
    else setError(result.error);
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Actions for ${employerLabel}`}
            className="size-11 shrink-0"
          >
            <MoreHorizontalIcon size={18} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuLabel>Your response</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={response ?? ""} onValueChange={onRespond}>
            <DropdownMenuRadioItem value="interested">I&apos;m interested</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="declined">Not interested</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("block")}>Block this employer</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("report")}>Report this employer</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "block"} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block {employerLabel}?</DialogTitle>
            <DialogDescription>
              They won&apos;t be able to see your practice evidence or contact you again, and this match will be removed
              from your list. If you want us to look into their behaviour, use &ldquo;Report&rdquo; instead.
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="m-0 text-[13px] text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog} disabled={busy}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={confirmBlock} disabled={busy}>
              {busy ? "Blocking…" : "Block employer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "report"} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {employerLabel}</DialogTitle>
            <DialogDescription>
              Reporting also blocks this employer. Our team reviews reports, and employers with repeated reports from
              different candidates are suspended.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup
            aria-label="Reason for report"
            aria-describedby={error ? errorId : undefined}
            value={reason}
            onValueChange={(v) => { setReason(v as EmployerReportReason); setError(null); }}
          >
            {REPORT_REASONS.map((r) => (
              <div key={r.value} className="flex items-start gap-2.5">
                <RadioGroupItem value={r.value} id={`${noteId}-${r.value}`} className="mt-0.5" />
                <Label htmlFor={`${noteId}-${r.value}`} className="flex-col items-start gap-0.5 leading-snug">
                  <span>{r.label}</span>
                  <span className="text-xs font-normal text-muted-foreground">{r.hint}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={noteId}>Add a note (optional)</Label>
            <Textarea
              id={noteId}
              value={note}
              maxLength={REPORT_NOTE_MAX}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything that helps us understand what happened"
            />
            <span className="text-right text-xs text-muted-foreground">
              {note.length}/{REPORT_NOTE_MAX}
            </span>
          </div>
          {error && <p id={errorId} role="alert" className="m-0 text-[13px] text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog} disabled={busy}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={confirmReport} disabled={busy}>
              {busy ? "Sending…" : "Report and block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
