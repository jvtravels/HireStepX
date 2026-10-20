"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useEmployerBreadcrumb } from "@/employer/EmployerShell";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { PrimaryCta, CANDIDATE_STATUS_LABEL } from "@/employer/_atoms";
import { EmptyNote, ErrorRetry, InlineNotice, LinkCta, PageSkeleton, SuspendedBanner } from "@/employer/_requirementAtoms";
import { failureMessage, setCandidateStatus } from "@/employer/_requirementCalls";
import { useEmployerAccess } from "@/employer/_useEmployerAccess";
import { nextCandidateStatuses } from "../../../../../../server-handlers/_employer-candidate-status-helpers";
import { candidateDisplayName, candidateResponseOf, isFinalStatus, isWithdrawn, reversibilityNote } from "../_components/requirementFormat";

interface OutcomeOption {
  status: CandidateStatus;
  label: string;
  hint: string;
  /** Needs the candidate unlocked first (the server answers 402 otherwise). */
  needsUnlock: boolean;
}

/** Wording per target status. Which of these are offered, and which are final,
 *  comes from the server transition table (nextCandidateStatuses), not from here. */
const OPTIONS: Record<CandidateStatus, OutcomeOption> = {
  shortlisted: { status: "shortlisted", label: "Reopen", hint: `Put them back in "${CANDIDATE_STATUS_LABEL.shortlisted}" so you can reconsider.`, needsUnlock: false },
  interview_invited: { status: "interview_invited", label: CANDIDATE_STATUS_LABEL.interview_invited, hint: "You've asked them to interview.", needsUnlock: true },
  interviewing: { status: "interviewing", label: CANDIDATE_STATUS_LABEL.interviewing, hint: "They're in your interview process.", needsUnlock: true },
  hired: { status: "hired", label: CANDIDATE_STATUS_LABEL.hired, hint: "They accepted an offer.", needsUnlock: true },
  rejected: { status: "rejected", label: CANDIDATE_STATUS_LABEL.rejected, hint: "You decided not to move forward. You can reopen this later.", needsUnlock: false },
  not_a_fit: { status: "not_a_fit", label: CANDIDATE_STATUS_LABEL.not_a_fit, hint: "The match wasn't right for this job.", needsUnlock: false },
  no_response: { status: "no_response", label: CANDIDATE_STATUS_LABEL.no_response, hint: "They didn't reply to you.", needsUnlock: false },
};

const OUTCOME_CSS = `
.out-opt { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border: 1px solid ${t.line}; border-radius: 10px; cursor: pointer; min-height: 44px; }
.out-opt[data-checked="true"] { border-color: ${t.indigo}; background: ${t.indigo100}; }
.out-opt[data-disabled="true"] { cursor: not-allowed; opacity: 0.75; }
.out-opt:focus-within { outline: 2px solid ${t.indigo}; outline-offset: 2px; }
.out-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; }
.out-main { padding: 24px 28px; display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.out-aside { padding: 24px 28px; border-left: 1px solid ${t.line}; background: ${t.pageBg}; display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.out-foot { grid-column: 1 / -1; display: flex; justify-content: flex-end; align-items: center; gap: 12px; padding: 16px 28px; border-top: 1px solid ${t.line}; }
@media (max-width: 900px) {
  .out-grid { grid-template-columns: minmax(0, 1fr); }
  .out-aside { border-left: 0; border-top: 1px solid ${t.line}; }
  .out-foot { flex-direction: column-reverse; align-items: stretch; }
}
.out-link:focus-visible { outline: 2px solid ${t.indigo}; outline-offset: 2px; border-radius: 4px; }
`;

const SUMMARY_LABEL = { fontFamily: f.sans, fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: t.inkSoft, margin: 0 } as const;

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <dt style={SUMMARY_LABEL}>{label}</dt>
      <dd style={{ fontFamily: f.sans, fontSize: textSize.md, fontWeight: 500, color: t.coal, margin: 0, overflowWrap: "anywhere" }}>{value}</dd>
    </div>
  );
}

export default function OutcomeFeedbackPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { fetchRequirementDetail } = useEmployerData();
  const access = useEmployerAccess();
  const candidateId = searchParams.get("candidate");

  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<CandidateStatus | "">("");
  const [notes, setNotes] = useState("");
  const [tellCandidate, setTellCandidate] = useState(false);
  const [candidateMessage, setCandidateMessage] = useState("");
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

  useEmployerBreadcrumb(requirement ? [{ label: requirement.title, path: `/employer/requirements/${params.id}` }, { label: "Hiring outcome" }] : null);

  const backHref = `/employer/requirements/${params.id}`;
  const backLink = (
    <Link href={backHref} className="out-link inline-flex items-center pointer-coarse:min-h-11" style={{ fontFamily: f.sans, fontSize: textSize.md, fontWeight: 600, color: t.indigo }}>
      Back to shortlist
    </Link>
  );

  if (loading) return <PageSkeleton label="Loading candidate" />;

  if (!requirement) {
    return (
      <ErrorRetry title="Couldn't load this job" message="We couldn't reach HireStepX, or this job no longer exists." onRetry={() => load()}>
        {backLink}
      </ErrorRetry>
    );
  }

  const candidate: Candidate | undefined = requirement.candidates.find((c) => c.id === candidateId);
  if (!candidate) {
    return (
      <EmptyNote title="Candidate not found" action={<LinkCta variant="outline" href={backHref}>Back to shortlist</LinkCta>}>
        {requirement.nextPage
          ? `This candidate isn't among the ${requirement.candidates.length} loaded of ${requirement.total ?? requirement.candidates.length} for ${requirement.title}. Open this page from a candidate on the shortlist.`
          : `This candidate isn't on the shortlist for ${requirement.title}. Open this page from a candidate on the shortlist.`}
      </EmptyNote>
    );
  }

  const current: CandidateStatus = candidate.candidateStatus ?? "shortlisted";
  const name = candidateDisplayName(candidate);
  const declined = candidateResponseOf(candidate) === "declined";
  const withdrew = isWithdrawn(candidate);
  // A candidate who declined or withdrew can still be closed out, but never invited.
  const available = nextCandidateStatuses(current).filter((s) => !((declined || withdrew) && s === "interview_invited"));
  const selected = choice ? OPTIONS[choice] : null;
  const blocked = access.suspended;
  const canMessage = !!selected && selected.status !== "shortlisted" && candidate.unlocked && !declined && !withdrew;
  const sendMessage = canMessage && tellCandidate;

  const save = async () => {
    if (!selected) return;
    setConfirmOpen(false);
    setSubmitting(true);
    setError(null);
    // `note` is private to the employer. `candidateMessage` is sent explicitly
    // (empty when unchecked) so the server never mistakes the note for a message to the candidate.
    const result = await setCandidateStatus(candidate.id, {
      candidateStatus: selected.status,
      note: notes.trim() || undefined,
      candidateMessage: sendMessage ? candidateMessage.trim() : "",
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(failureMessage("status", result, { tier: access.tier, limit: undefined }));
      return;
    }
    setSavedStatus(selected.status);
  };

  const onSubmit = () => {
    if (!selected || blocked) return;
    if (isFinalStatus(selected.status)) setConfirmOpen(true);
    else void save();
  };

  if (savedStatus) {
    return (
      <div style={{ width: "100%", minWidth: 0 }}>
        <style>{OUTCOME_CSS}</style>
        <section aria-label="Outcome saved" style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: 16, overflow: "hidden" }}>
          <div role="status" aria-live="polite" style={{ maxWidth: 520, margin: "0 auto", padding: "64px 28px", textAlign: "center" }}>
            <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 999, background: t.indigo100, color: t.indigo, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <CheckIcon size={24} />
            </span>
            <h1 style={{ fontFamily: f.sans, fontSize: 20, fontWeight: 600, color: t.coal, margin: "0 0 8px", letterSpacing: "-0.01em" }}>Outcome saved</h1>
            <p style={{ fontFamily: f.sans, fontSize: textSize.md, color: t.inkSoft, margin: "0 0 24px", overflowWrap: "anywhere", lineHeight: 1.5 }}>
              {name} is now marked as {CANDIDATE_STATUS_LABEL[savedStatus].toLowerCase()} for {requirement.title}. {isFinalStatus(savedStatus) ? "" : reversibilityNote(savedStatus)}
            </p>
            <LinkCta variant="outline" href={backHref}>Back to shortlist</LinkCta>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      <style>{OUTCOME_CSS}</style>
      {access.suspended && (
        <div style={{ marginBottom: 16 }}>
          <SuspendedBanner />
        </div>
      )}
      <section aria-label="Record an outcome" style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: 16, overflow: "hidden" }}>
        <header style={{ padding: "20px 28px", borderBottom: `1px solid ${t.line}` }}>
          <h1 style={{ fontFamily: f.sans, fontSize: 20, fontWeight: 600, color: t.coal, margin: 0, letterSpacing: "-0.01em", overflowWrap: "anywhere" }}>How did it go with {name}?</h1>
          <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: "4px 0 0", overflowWrap: "anywhere" }}>{requirement.title}</p>
        </header>
        {available.length === 0 ? (
          <div style={{ padding: "24px 28px" }}>
            <InlineNotice tone="info" title={`Already ${CANDIDATE_STATUS_LABEL[current].toLowerCase()}`}>
              {name} is in a final status, so there is no further outcome to record.
            </InlineNotice>
          </div>
        ) : (
          <form
            className="out-grid"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            <div className="out-main">
              {(declined || withdrew) && (
                <InlineNotice tone="warning" title={withdrew ? "This candidate withdrew" : "This candidate declined"}>
                  {withdrew ? "They withdrew from employer contact" : "They chose not to be contacted for this job"}, so you can&apos;t invite them. You can still close them out.
                </InlineNotice>
              )}
              <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
                <legend style={{ fontFamily: f.sans, fontSize: textSize.base, fontWeight: 600, color: t.coal, marginBottom: 8, padding: 0 }}>
                  Outcome <span aria-hidden="true">*</span>
                  <span className="sr-only"> (required)</span>
                </legend>
                <RadioGroup value={choice} onValueChange={(v) => { setChoice(v as CandidateStatus); setError(null); }} required aria-required="true" disabled={blocked}>
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
                <Label htmlFor="outcome-notes">Private note (optional)</Label>
                <Textarea
                  id="outcome-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={blocked}
                  placeholder="Why this outcome? Only your team can see this."
                  aria-describedby="outcome-notes-hint"
                />
                <p id="outcome-notes-hint" className="m-0 text-xs text-muted-foreground">
                  Internal only. The candidate never sees this note.
                </p>
              </div>
              {selected && selected.status !== "shortlisted" && !canMessage && (
                <p className="m-0 text-xs text-muted-foreground">
                  {candidate.unlocked
                    ? "They can't be messaged right now, so only the status will change."
                    : "Unlock this candidate to send them a message. For now only the status will change."}
                </p>
              )}
              {canMessage && (
                <div style={{ display: "grid", gap: 8 }}>
                  <label htmlFor="outcome-tell" className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <Checkbox id="outcome-tell" checked={tellCandidate} onCheckedChange={(v) => setTellCandidate(v === true)} disabled={blocked} />
                    Also send a message to the candidate
                  </label>
                  {sendMessage && (
                    <>
                      <Label htmlFor="outcome-message">Message to candidate</Label>
                      <Textarea
                        id="outcome-message"
                        rows={3}
                        maxLength={1000}
                        value={candidateMessage}
                        onChange={(e) => setCandidateMessage(e.target.value)}
                        disabled={blocked}
                        placeholder="The candidate will see this in their conversation with you."
                      />
                    </>
                  )}
                </div>
              )}
              <div aria-live="polite">
                {error && (
                  <InlineNotice tone="error" title="Couldn't save this outcome" live={false}>
                    {error}
                  </InlineNotice>
                )}
              </div>
            </div>
            <aside className="out-aside" aria-label="Candidate summary">
              <dl style={{ margin: 0, display: "grid", gap: 16 }}>
                <SummaryRow label="Current status" value={CANDIDATE_STATUS_LABEL[current]} />
                {candidate.targetRole && <SummaryRow label="Target role" value={candidate.targetRole} />}
                {candidate.city && <SummaryRow label="Location" value={candidate.city} />}
                <SummaryRow label="Match score" value={`${candidate.matchScore} / 100`} />
                {candidate.skills.length > 0 && (
                  <div style={{ display: "grid", gap: 6 }}>
                    <dt style={SUMMARY_LABEL}>Skills</dt>
                    <dd style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {candidate.skills.slice(0, 6).map((skill) => (
                        <span key={skill} style={{ fontFamily: f.sans, fontSize: 12, color: t.coal, background: t.white, border: `1px solid ${t.line}`, borderRadius: 6, padding: "2px 8px" }}>{skill}</span>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
              <div style={{ borderTop: `1px solid ${t.line}`, paddingTop: 16, display: "grid", gap: 4 }}>
                <span style={SUMMARY_LABEL}>What happens next</span>
                <p style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft, margin: 0, lineHeight: 1.5 }}>
                  {selected ? reversibilityNote(selected.status) : "Pick an outcome to see what changes for you and the candidate."}
                </p>
              </div>
            </aside>
            <div className="out-foot">
              <LinkCta variant="outline" href={backHref}>Cancel</LinkCta>
              <PrimaryCta disabled={!selected || submitting || blocked} loading={submitting} onClick={onSubmit}>
                {submitting ? "Saving…" : "Save outcome"}
              </PrimaryCta>
            </div>
          </form>
        )}
      </section>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {name} as {selected ? selected.label.toLowerCase() : "this outcome"}?</AlertDialogTitle>
            <AlertDialogDescription>{selected ? reversibilityNote(selected.status) : ""}</AlertDialogDescription>
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
