import { useState } from "react";
import { cn } from "cn";
import { PanelButton } from "@/employer/_panelParts";
import type { Candidate, Requirement } from "@/employer/mockData";
import type { CandidateEvidence } from "@/employer/EmployerDataContext";
import { poolStanding } from "./fitExtras";
import { bestGradedAnswer, buildRoleFit, cleanQuestionText, formatSessionDate, gradedSessionLabel } from "./helpers";
import { StarMarks } from "./parts";
import { ItemRequest, type RequestUi } from "./RequestPopover";

function ClampedText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 300;
  return (
    <div className="grid justify-items-start gap-1">
      <p className={cn("m-0 max-w-[75ch] text-[13px] leading-normal whitespace-pre-line text-hx-coal [overflow-wrap:anywhere]", long && !open && "line-clamp-5")}>{text}</p>
      {long && <PanelButton onClick={() => setOpen((v) => !v)} expanded={open}>{open ? "Show less" : "Show more"}</PanelButton>}
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
  const best = bestGradedAnswer(evidence?.questions);
  const sessions = gradedSessionLabel(candidate, evidence);
  const when = evidence?.sessionDate ? formatSessionDate(evidence.sessionDate) : "";
  return (
    <section aria-labelledby="glance-heading" className="grid min-w-0 gap-3 border-b border-hx-line bg-white px-7 py-5 @container">
      <h2 id="glance-heading" className="m-0 text-[15px] font-semibold text-hx-coal">At a glance</h2>
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
          {hasPractice && best && (
            <>
              <dt className="font-medium text-hx-ink-soft">Best answer</dt>
              <dd className="m-0 flex min-w-0 items-center justify-between gap-x-4 text-hx-coal">
                <span className="min-w-0 flex-1 truncate" title={cleanQuestionText(best.question)}>
                  <span className="font-semibold tabular-nums">{best.score}/100</span> · {cleanQuestionText(best.question)}
                </span>
                {best.star && <StarMarks star={best.star} score={best.score} />}
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
