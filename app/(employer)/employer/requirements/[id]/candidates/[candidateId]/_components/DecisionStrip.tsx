import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "cn";
import type { Candidate, Requirement } from "@/employer/mockData";
import type { CandidateEvidence } from "@/employer/EmployerDataContext";
import { buildDecisionBrief, overlapReason, poolStanding, scoreReason } from "./fitExtras";
import { bestGradedAnswer, buildRoleFit, cleanQuestionText, formatSessionDate } from "./helpers";
import { StarMarks } from "./parts";
import { ItemRequest, type RequestUi } from "./RequestPopover";

/** One glance before the detail: who this is against the pool, what speaks for them, what to check first. */
export function DecisionStrip({ candidate, requirement, matched, evidence, requestUi }: { candidate: Candidate; requirement: Requirement; matched: string[]; evidence: CandidateEvidence | null; requestUi?: RequestUi }) {
  const rows = buildRoleFit(candidate, requirement, matched, evidence);
  const brief = buildDecisionBrief(rows);
  const hasPractice = candidate.sessionsCompleted > 0 || !!(evidence?.readiness || evidence?.starCompleteness || evidence?.skills.length || evidence?.questions?.length);
  const reason = scoreReason(rows, hasPractice) ?? (candidate.matchBreakdown ? overlapReason(candidate.matchBreakdown, hasPractice) : null);
  const standing = poolStanding(candidate.matchScore, (requirement.candidates ?? []).filter((c) => c.id !== candidate.id));
  if (brief.strengths.length === 0 && brief.risks.length === 0 && !standing && !reason) return null;
  const best = bestGradedAnswer(evidence?.questions);
  const sessions = candidate.sessionsCompleted;
  const when = evidence?.sessionDate ? formatSessionDate(evidence.sessionDate) : "";
  return (
    <section aria-label="At a glance" className="grid min-w-0 gap-3 bg-hx-soft px-7 py-4 @container">
      {hasPractice && (
        <div className="grid gap-1.5">
          <p className="m-0 text-[12px] font-medium text-hx-ink-soft">
            Graded in practice: {sessions > 0 ? `${sessions} session${sessions === 1 ? "" : "s"}` : "practice evidence"}{when ? `, latest ${when}` : ""}
          </p>
          {best && (
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
              <p className="m-0 min-w-0 max-w-[60ch] text-[13px] text-hx-coal [overflow-wrap:anywhere]">
                <span className="font-semibold">Best answer, {best.score} out of 100:</span> {cleanQuestionText(best.question)}
              </p>
              {best.star && <StarMarks star={best.star} />}
            </div>
          )}
        </div>
      )}
      {reason && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="m-0 text-[13px] text-hx-coal">Score {candidate.matchScore}: {reason}</p>
          {!hasPractice && requestUi && (
            <ItemRequest candidate={candidate} ui={requestUi} label="Ask them to practise this role" preset={{ kind: "practice", topic: `Interview practice for ${requirement.title}`.slice(0, 120) }} />
          )}
        </div>
      )}
      {standing && (
        <p className="m-0 text-[13px] text-hx-ink-soft">
          Scores higher than <strong className="font-semibold text-hx-coal tabular-nums">{standing.below} of {standing.total}</strong> other matches for this job.
        </p>
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
