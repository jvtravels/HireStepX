"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEmployerData, type Requirement } from "@/employer/EmployerDataContext";
import type { Candidate, CandidateStatus } from "@/employer/mockData";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Card, Eyebrow, PrimaryCta } from "@/employer/_atoms";
import { EmptyNote, ErrorRetry, IdentityHiddenBadge, InlineNotice, LinkCta, PageSkeleton, SuspendedBanner } from "@/employer/_requirementAtoms";
import { failureMessage, setCandidateStatus } from "@/employer/_requirementCalls";
import { useEmployerAccess } from "@/employer/_useEmployerAccess";
import { candidateDisplayName, candidateResponseOf } from "../_components/requirementFormat";

interface OutcomeOption {
  status: CandidateStatus;
  label: string;
  hint: string;
  /** Needs the candidate unlocked first (the server answers 402 otherwise). */
  needsUnlock: boolean;
  /** Terminal on the server: confirm before submitting. */
  terminal: boolean;
}

const OPTIONS: Record<Exclude<CandidateStatus, "shortlisted">, OutcomeOption> = {
  interview_invited: { status: "interview_invited", label: "Interview invited", hint: "You've asked them to interview.", needsUnlock: true, terminal: false },
  interviewing: { status: "interviewing", label: "Interviewing", hint: "They're in your interview process.", needsUnlock: true, terminal: false },
  hired: { status: "hired", label: "Hired", hint: "They accepted an offer.", needsUnlock: true, terminal: true },
  rejected: { status: "rejected", label: "Rejected", hint: "You decided not to move forward.", needsUnlock: false, terminal: true },
  not_a_fit: { status: "not_a_fit", label: "Not a fit", hint: "The match wasn't right for this role.", needsUnlock: false, terminal: true },
  no_response: { status: "no_response", label: "No response", hint: "They didn't reply to you.", needsUnlock: false, terminal: true },
};

/** Mirrors the transition table enforced by employer-candidate-status. */
const NEXT: Record<CandidateStatus, Array<keyof typeof OPTIONS>> = {
  shortlisted: ["interview_invited", "rejected", "not_a_fit"],
  interview_invited: ["interviewing", "rejected", "not_a_fit", "no_response"],
  interviewing: ["hired", "rejected", "not_a_fit", "no_response"],
  hired: [],
  rejected: [],
  not_a_fit: [],
  no_response: [],
};

const STATUS_NAME: Record<CandidateStatus, string> = {
  shortlisted: "Shortlisted",
  interview_invited: "Interview invited",
  interviewing: "Interviewing",
  hired: "Hired",
  rejected: "Rejected",
  not_a_fit: "Not a fit",
  no_response: "No response",
};

const OUTCOME_CSS = `
.out-opt { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border: 1px solid ${t.line}; border-radius: 10px; cursor: pointer; min-height: 44px; }
.out-opt[data-checked="true"] { border-color: ${t.indigo}; background: ${t.indigo100}; }
.out-opt[data-disabled="true"] { cursor: not-allowed; opacity: 0.75; }
.out-opt:focus-within { outline: 2px solid ${t.indigo}; outline-offset: 2px; }
.out-link:focus-visible { outline: 2px solid ${t.indigo}; outline-offset: 2px; border-radius: 4px; }
`;

export default function OutcomeFeedbackPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { fetchRequirementDetail } = useEmployerData();
  const access = useEmployerAccess();
  const candidateId = searchParams.get("candidate");

  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<keyof typeof OPTIONS | "">("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savedStatus, setSavedStatus] = useState<CandidateStatus | null>(null);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    fetchRequirementDetail(params.id).then((r) => {
      if (!active) return;
      setRequirement(r);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchRequirementDetail, params.id]);

  useEffect(() => load(), [load]);

  const backHref = `/employer/requirements/${params.id}`;
  const backLink = (
    <Link href={backHref} className="out-link inline-flex items-center pointer-coarse:min-h-11" style={{ fontFamily: f.sans, fontSize: textSize.md, fontWeight: 600, color: t.indigo }}>
      Back to shortlist
    </Link>
  );

  if (loading) return <PageSkeleton label="Loading candidate" />;

  if (!requirement) {
    return (
      <ErrorRetry title="Couldn't load this requirement" message="We couldn't reach HireStepX, or this requirement no longer exists." onRetry={() => load()}>
        {backLink}
      </ErrorRetry>
    );
  }

  const candidate: Candidate | undefined = requirement.candidates.find((c) => c.id === candidateId);
  if (!candidate) {
    return (
      <EmptyNote title="Candidate not found" action={<LinkCta variant="outline" href={backHref}>Back to shortlist</LinkCta>}>
        This candidate isn&apos;t on the shortlist for {requirement.title}. Open this page from a candidate on the shortlist.
      </EmptyNote>
    );
  }

  const current: CandidateStatus = candidate.candidateStatus ?? "shortlisted";
  const name = candidateDisplayName(candidate);
  const declined = candidateResponseOf(candidate) === "declined";
  const available = NEXT[current];
  const selected = choice ? OPTIONS[choice] : null;
  const blocked = access.suspended || declined;

  const save = async () => {
    if (!selected) return;
    setConfirmOpen(false);
    setSubmitting(true);
    setError(null);
    const result = await setCandidateStatus(candidate.id, { candidateStatus: selected.status, note: notes.trim() || undefined });
    setSubmitting(false);
    if (!result.ok) {
      setError(failureMessage("status", result, { tier: access.tier, limit: undefined }));
      return;
    }
    setSavedStatus(selected.status);
  };

  const onSubmit = () => {
    if (!selected || blocked) return;
    if (selected.terminal) setConfirmOpen(true);
    else void save();
  };

  if (savedStatus) {
    return (
      <div style={{ maxWidth: 480, margin: "48px auto", textAlign: "center", padding: "0 16px" }}>
        <div role="status" aria-live="polite">
          <h1 style={{ fontFamily: f.sans, fontSize: textSize["2xl"], color: t.coal, margin: "0 0 8px" }}>Outcome saved</h1>
          <p style={{ fontFamily: f.sans, fontSize: textSize.md, color: t.inkSoft, margin: "0 0 20px", overflowWrap: "anywhere" }}>
            {name} is now marked as {STATUS_NAME[savedStatus].toLowerCase()} for {requirement.title}. This helps us improve future shortlists.
          </p>
        </div>
        <style>{OUTCOME_CSS}</style>
        <LinkCta variant="outline" href={backHref}>Back to shortlist</LinkCta>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", minWidth: 0 }}>
      <style>{OUTCOME_CSS}</style>
      {access.suspended && (
        <div style={{ marginBottom: 16 }}>
          <SuspendedBanner />
        </div>
      )}
      <Eyebrow tone="indigo">Outcome feedback</Eyebrow>
      <h1 style={{ fontFamily: f.sans, fontSize: "clamp(22px, 6vw, 26px)", color: t.coal, margin: "8px 0 4px", overflowWrap: "anywhere" }}>How did it go with {name}?</h1>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "0 0 20px" }}>
        <p style={{ fontFamily: f.sans, fontSize: textSize.md, color: t.inkSoft, margin: 0, overflowWrap: "anywhere" }}>{requirement.title}</p>
        {!candidate.unlocked && <IdentityHiddenBadge compact />}
      </div>

      <Card aria-label="Record an outcome">
        {declined && (
          <div style={{ marginBottom: 16 }}>
            <InlineNotice tone="warning" title="This candidate declined">
              They chose not to be contacted for this role, so their status can&apos;t be changed any further.
            </InlineNotice>
          </div>
        )}
        {!declined && available.length === 0 ? (
          <InlineNotice tone="info" title={`Already ${STATUS_NAME[current].toLowerCase()}`}>
            {name} is in a final status, so there is no further outcome to record.
          </InlineNotice>
        ) : (
          !declined && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
              style={{ display: "flex", flexDirection: "column", gap: 18 }}
            >
              <p style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft, margin: 0 }}>
                Current status: <strong style={{ color: t.coal }}>{STATUS_NAME[current]}</strong>
              </p>
              <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
                <legend style={{ fontFamily: f.sans, fontSize: textSize.base, fontWeight: 600, color: t.coal, marginBottom: 8, padding: 0 }}>
                  Outcome <span aria-hidden="true">*</span>
                  <span className="sr-only"> (required)</span>
                </legend>
                <RadioGroup value={choice} onValueChange={(v) => { setChoice(v as keyof typeof OPTIONS); setError(null); }} required aria-required="true" disabled={blocked}>
                  {available.map((key) => {
                    const o = OPTIONS[key];
                    const locked = o.needsUnlock && !candidate.unlocked;
                    const id = `outcome-${key}`;
                    return (
                      <label key={key} htmlFor={id} className="out-opt" data-checked={choice === key} data-disabled={locked || blocked}>
                        <RadioGroupItem id={id} value={key} disabled={locked || blocked} aria-describedby={`${id}-hint`} />
                        <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                          <span style={{ fontFamily: f.sans, fontSize: textSize.md, fontWeight: 600, color: t.coal }}>{o.label}</span>
                          <span id={`${id}-hint`} style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft }}>
                            {locked ? "Unlock this candidate from the shortlist first." : o.hint}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
              </fieldset>
              <div style={{ display: "grid", gap: 8 }}>
                <Label htmlFor="outcome-notes">Notes (optional)</Label>
                <Textarea
                  id="outcome-notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={blocked}
                  placeholder="Anything that would help us improve future shortlists?"
                />
              </div>
              <div aria-live="polite">
                {error && (
                  <InlineNotice tone="error" title="Couldn't save this outcome" live={false}>
                    {error}
                  </InlineNotice>
                )}
              </div>
              <PrimaryCta full disabled={!selected || submitting || blocked} loading={submitting} onClick={onSubmit}>
                {submitting ? "Saving…" : "Save outcome"}
              </PrimaryCta>
            </form>
          )
        )}
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {name} as {selected ? selected.label.toLowerCase() : "this outcome"}?</AlertDialogTitle>
            <AlertDialogDescription>This is a final status. It can&apos;t be changed afterwards.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void save()}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
