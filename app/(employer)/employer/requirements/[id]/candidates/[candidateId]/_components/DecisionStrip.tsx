import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { PanelButton } from "@/employer/_panelParts";
import type { Candidate, Requirement } from "@/employer/mockData";
import type { CandidateEvidence } from "@/employer/EmployerDataContext";
import { poolStanding } from "./fitExtras";
import { buildRoleFit, formatSessionDate, gradedSessionLabel } from "./helpers";
import { ItemRequest, type RequestUi } from "./RequestPopover";

function ClampedText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  /* Only offer "Show more" when the clamp is actually hiding text at this width. */
  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const measure = () => setCut(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, open]);
  return (
    <div className="grid justify-items-start gap-1">
      <p ref={ref} className={cn("m-0 text-[13px] leading-normal whitespace-pre-line text-hx-coal [overflow-wrap:anywhere]", !open && "line-clamp-3 @[48rem]:line-clamp-5")}>{text}</p>
      {(cut || open) && <PanelButton onClick={() => setOpen((v) => !v)} expanded={open}>{open ? "Show less" : "Show more"}</PanelButton>}
    </div>
  );
}

/** One glance before the detail: who this is against the pool, what speaks for them, what to check first. */
export function DecisionStrip({ candidate, requirement, matched, evidence, requestUi }: { candidate: Candidate; requirement: Requirement; matched: string[]; evidence: CandidateEvidence | null; requestUi?: RequestUi }) {
  const rows = buildRoleFit(candidate, requirement, matched, evidence);
  const hasPractice = candidate.sessionsCompleted > 0 || !!(evidence?.readiness || evidence?.starCompleteness || evidence?.skills.length || evidence?.questions?.length);
  /* The criteria count and gaps already sit in the Fit panel below, so only what it lacks is said here. */
  const resumeOnly = !hasPractice && (rows.length > 0 || !!candidate.matchBreakdown);
  const standing = poolStanding(candidate.matchScore, (requirement.candidates ?? []).filter((c) => c.id !== candidate.id));
  const summary = candidate.resume?.summary?.trim();
  if (!hasPractice && !standing && !resumeOnly && !summary) return null;
  const sessions = gradedSessionLabel(candidate, evidence);
  const when = evidence?.sessionDate ? formatSessionDate(evidence.sessionDate) : "";
  return (
    <section aria-labelledby="glance-heading" className="grid min-w-0 gap-3 border-b border-hx-line bg-white px-7 py-5 @container">
      <h2 id="glance-heading" className="sr-only">At a glance</h2>
      {summary && <ClampedText text={summary} />}
      {(hasPractice || standing) && (
        <dl className="m-0 grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 text-[13px] leading-normal">
          {hasPractice && (
            <>
              <dt className="font-medium text-hx-ink-soft">Practice sessions</dt>
              <dd className="m-0 text-hx-coal">
                {sessions !== "0" ? `${sessions} graded for this role` : "Graded practice evidence"}{when ? `, latest ${when}` : ""}
              </dd>
            </>
          )}
          {standing && (
            <>
              <dt className="font-medium text-hx-ink-soft">Ranking</dt>
              <dd className="m-0 text-hx-coal">
                {standing.below === standing.total
                  ? <>Highest of <span className="font-semibold tabular-nums">{standing.total + 1}</span> matches for this job</>
                  : <>Ahead of <span className="font-semibold tabular-nums">{standing.below} of {standing.total}</span> other matches</>}
              </dd>
            </>
          )}
        </dl>
      )}
      {resumeOnly && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="m-0 text-[13px] text-hx-coal">No graded practice yet, so the score reflects the resume only.</p>
          {requestUi && (
            <ItemRequest candidate={candidate} ui={requestUi} label="Ask them to practise this role" preset={{ kind: "practice", topic: `Interview practice for ${requirement.title}`.slice(0, 120) }} />
          )}
        </div>
      )}
    </section>
  );
}
