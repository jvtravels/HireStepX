import { Check, FileText, Minus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CandidateEvidence } from "@/employer/EmployerDataContext";
import { READINESS_LABEL } from "./helpers";

type Stat = { label: string; value: string; hint: string; good?: boolean };

function buildStats(
  sessions: number,
  evidence: CandidateEvidence | null,
  avg: number | null,
): Stat[] {
  const stats: Stat[] = [];
  const readiness = evidence?.readiness;
  const star = evidence?.starCompleteness;
  if (readiness) {
    stats.push({
      label: "Practice readiness",
      value: READINESS_LABEL[readiness.band],
      hint: `${readiness.confidence} confidence`,
      good: readiness.band !== "leanHire",
    });
  }
  if (avg != null) stats.push({ label: "Avg skill score", value: `${avg}`, hint: "out of 100", good: avg >= 70 });
  if (star) {
    stats.push({
      label: "STAR answers",
      value: `${star.pct}%`,
      hint: `${star.questionsConsidered} question${star.questionsConsidered === 1 ? "" : "s"}`,
      good: star.pct >= 70,
    });
  }
  stats.push({ label: "Practice sessions", value: `${sessions}`, hint: "graded" });
  return stats;
}

/** Evidence-strength banner, stat strip and required-skill coverage in one scannable block. */
export function CandidateBrief({
  sessions,
  evidence,
  evidenceLoading,
  evidenceFailed,
  avg,
  matchedSkills,
  unmatchedSkills,
}: {
  sessions: number;
  evidence: CandidateEvidence | null;
  evidenceLoading: boolean;
  evidenceFailed: boolean;
  avg: number | null;
  matchedSkills: string[];
  unmatchedSkills: string[];
}) {
  const practiced = sessions > 0 && !!evidence && (!!evidence.readiness || evidence.skills.length > 0);
  const totalSkills = matchedSkills.length + unmatchedSkills.length;

  return (
    <section aria-labelledby="brief-heading" className="rounded-xl border border-border/60 bg-card">
      <h2 id="brief-heading" className="sr-only">
        Candidate brief
      </h2>

      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
            practiced ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground",
          )}
        >
          {practiced ? <Sparkles className="size-4" /> : <FileText className="size-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-foreground">
            {evidenceLoading
              ? "Checking practice evidence…"
              : practiced
                ? `Backed by ${sessions} graded practice session${sessions === 1 ? "" : "s"}`
                : "Resume match only, no practice evidence yet"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {evidenceLoading
              ? "Scores appear here as soon as they load."
              : evidenceFailed
                ? "We couldn't load practice evidence. Try again from the Overview tab."
                : practiced
                  ? "Scored by HireStepX AI from mock interviews. This is practice performance, not a verified employment check."
                  : "This candidate hasn't completed a graded mock interview, so the match score reflects resume and profile fit. Probe the skills below in your interview."}
          </p>
        </div>
      </div>

      {practiced && (
        <dl className="grid grid-cols-2 border-t border-border/60 sm:grid-cols-4">
          {buildStats(sessions, evidence, avg).map((s, i) => (
            <div key={s.label} className={cn("p-4 sm:px-5", i > 0 && "border-border/60 sm:border-l", i >= 2 && "border-t sm:border-t-0")}>
              <dt className="text-xs font-medium text-muted-foreground">{s.label}</dt>
              <dd className={cn("mt-1 text-xl font-semibold", s.good ? "text-emerald-700" : "text-foreground")}>{s.value}</dd>
              <dd className="text-xs text-muted-foreground">{s.hint}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="border-t border-border/60 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Required skills</h3>
          {totalSkills > 0 && (
            <span className="text-xs text-muted-foreground">
              {matchedSkills.length} of {totalSkills} found on resume
            </span>
          )}
        </div>
        {totalSkills === 0 ? (
          <p className="text-sm text-muted-foreground">This requirement lists no required skills.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {matchedSkills.map((s) => (
              <li
                key={s}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"
              >
                <Check aria-hidden="true" className="size-3" />
                {s}
                <span className="sr-only"> (found on resume)</span>
              </li>
            ))}
            {unmatchedSkills.map((s) => (
              <li
                key={s}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-background px-2.5 py-1 text-xs text-muted-foreground"
              >
                <Minus aria-hidden="true" className="size-3" />
                {s}
                <span className="sr-only"> (not found on resume)</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
