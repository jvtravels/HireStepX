import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "cn";
import type { Candidate, Requirement } from "@/employer/mockData";
import type { CandidateEvidence } from "@/employer/EmployerDataContext";
import { buildDecisionBrief, overlapReason, poolStanding, scoreReason } from "./fitExtras";
import { buildRoleFit } from "./helpers";

/** One glance before the detail: who this is against the pool, what speaks for them, what to check first. */
export function DecisionStrip({ candidate, requirement, matched, evidence }: { candidate: Candidate; requirement: Requirement; matched: string[]; evidence: CandidateEvidence | null }) {
  const rows = buildRoleFit(candidate, requirement, matched, evidence);
  const brief = buildDecisionBrief(rows);
  const hasPractice = !!(evidence?.readiness || evidence?.starCompleteness || evidence?.skills.length || evidence?.questions?.length);
  const reason = scoreReason(rows, hasPractice) ?? (candidate.matchBreakdown ? overlapReason(candidate.matchBreakdown, hasPractice) : null);
  const standing = poolStanding(candidate.matchScore, (requirement.candidates ?? []).filter((c) => c.id !== candidate.id));
  if (brief.strengths.length === 0 && brief.risks.length === 0 && !standing && !reason) return null;
  return (
    <section aria-label="At a glance" className="grid min-w-0 gap-3 bg-hx-soft px-7 py-4 @container">
      {reason && <p className="m-0 text-[13px] text-hx-coal">Score {candidate.matchScore}: {reason}</p>}
      {standing && (
        <p className="m-0 text-[13px] text-hx-ink-soft">
          Scores higher than <strong className="font-semibold text-hx-coal tabular-nums">{standing.below} of {standing.total}</strong> other matches for this job.
        </p>
      )}
      <div className="grid gap-x-8 gap-y-2 @2xl:grid-cols-2">
        <ul aria-label="Strengths" className="m-0 flex list-none flex-col gap-1.5 p-0">
          {brief.strengths.map((s) => (
            <li key={s} className="flex items-start gap-2 text-[13px] text-hx-coal">
              <CheckIcon size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-hx-success" />
              {s}
            </li>
          ))}
        </ul>
        <ul aria-label="Check first" className="m-0 flex list-none flex-col gap-1.5 p-0">
          {brief.risks.map((r) => (
            <li key={r.text} className="flex items-start gap-2 text-[13px] text-hx-coal">
              <TriangleAlertIcon size={15} aria-hidden="true" className={cn("mt-0.5 shrink-0", r.gap ? "text-hx-error" : "text-hx-warning")} />
              {r.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
