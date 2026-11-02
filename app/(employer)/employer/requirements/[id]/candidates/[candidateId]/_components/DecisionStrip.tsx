import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "cn";
import type { Candidate, Requirement } from "@/employer/mockData";
import type { CandidateEvidence } from "@/employer/EmployerDataContext";
import { buildDecisionBrief, poolStanding } from "./fitExtras";
import { bestGradedAnswer, buildRoleFit, cleanQuestionText, formatSessionDate } from "./helpers";
import { StarMarks } from "./parts";
import { ItemRequest, type RequestUi } from "./RequestPopover";

/** One glance before the detail: who this is against the pool, what speaks for them, what to check first. */
export function DecisionStrip({ candidate, requirement, matched, evidence, requestUi }: { candidate: Candidate; requirement: Requirement; matched: string[]; evidence: CandidateEvidence | null; requestUi?: RequestUi }) {
  const rows = buildRoleFit(candidate, requirement, matched, evidence);
  const brief = buildDecisionBrief(rows);
  const hasPractice = candidate.sessionsCompleted > 0 || !!(evidence?.readiness || evidence?.starCompleteness || evidence?.skills.length || evidence?.questions?.length);
  /* The criteria count and gaps already sit in the Fit panel below, so only what it lacks is said here. */
  const resumeOnly = !hasPractice && (rows.length > 0 || !!candidate.matchBreakdown);
  const standing = poolStanding(candidate.matchScore, (requirement.candidates ?? []).filter((c) => c.id !== candidate.id));
  if (brief.strengths.length === 0 && brief.risks.length === 0 && !standing && !resumeOnly) return null;
  const best = bestGradedAnswer(evidence?.questions);
  const sessions = candidate.sessionsCompleted;
  const when = evidence?.sessionDate ? formatSessionDate(evidence.sessionDate) : "";
  return (
    <section aria-label="At a glance" className="grid min-w-0 gap-3 border-b border-hx-line bg-white px-7 py-5 @container">
      {(hasPractice || standing) && (
        <dl className="m-0 grid grid-cols-[6.5rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 text-[13px]">
          {hasPractice && (
            <>
              <dt className="font-medium text-hx-ink-soft">Practice</dt>
              <dd className="m-0 text-hx-coal">
                {sessions > 0 ? `${sessions} graded session${sessions === 1 ? "" : "s"}` : "Graded practice evidence"}{when ? `, latest ${when}` : ""}
              </dd>
            </>
          )}
          {hasPractice && best && (
            <>
              <dt className="font-medium text-hx-ink-soft">Best answer</dt>
              <dd className="m-0 flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 text-hx-coal">
                <span className="min-w-0 max-w-[60ch] [overflow-wrap:anywhere]">
                  <span className="font-semibold tabular-nums">{best.score}/100</span> · {cleanQuestionText(best.question)}
                </span>
                {best.star && <StarMarks star={best.star} score={best.score} />}
              </dd>
            </>
          )}
          {standing && (
            <>
              <dt className="font-medium text-hx-ink-soft">Against pool</dt>
              <dd className="m-0 text-hx-coal">
                Higher than <span className="font-semibold tabular-nums">{standing.below} of {standing.total}</span> other matches
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
      <div className={cn("grid gap-x-8 gap-y-2", brief.strengths.length > 0 && brief.risks.length > 0 && "@2xl:grid-cols-2")}>
        {brief.strengths.length > 0 && <ul aria-label="Strengths" className="m-0 flex list-none flex-col gap-1.5 p-0">
          {brief.strengths.map((s) => (
            <li key={s} className="flex items-start gap-2 text-[13px] text-hx-coal">
              <CheckIcon size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-hx-success" />
              {s}
            </li>
          ))}
        </ul>}
        {brief.risks.length > 0 && <ul aria-label="Check first" className="m-0 flex list-none flex-col gap-1.5 p-0">
          {brief.risks.map((r) => (
            <li key={r.text} className="flex items-start gap-2 text-[13px] text-hx-coal">
              <TriangleAlertIcon size={15} aria-hidden="true" className={cn("mt-0.5 shrink-0", r.gap ? "text-hx-error" : "text-hx-warning")} />
              {r.text}
            </li>
          ))}
        </ul>}
      </div>
    </section>
  );
}
