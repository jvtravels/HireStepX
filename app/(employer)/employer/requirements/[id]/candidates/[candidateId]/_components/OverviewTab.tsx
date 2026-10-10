import { Check, FileSearch, Minus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CandidateEvidence } from "@/employer/EmployerDataContext";
import type { Candidate } from "@/employer/mockData";
import { Meter } from "./parts";
import { CARD, PROVENANCE, READINESS_LABEL, TONE_SUCCESS, evidenceAverage, formatSessionDate } from "./helpers";

export type EvidenceState = { evidence: CandidateEvidence | null; loading: boolean; failed: boolean; onRetry: () => void };

export function EvidenceStatus({ state, children }: { state: EvidenceState; children: React.ReactNode }) {
  if (state.loading) {
    return (
      <div role="status" className="space-y-3">
        <span className="sr-only">Loading practice-session evidence…</span>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    );
  }
  if (state.failed) {
    return (
      <Alert variant="destructive" role="alert" className="flex flex-wrap items-center justify-between gap-3">
        <AlertDescription>Couldn't load practice-session evidence.</AlertDescription>
        <Button size="sm" variant="outline" onClick={state.onRetry}>Try again</Button>
      </Alert>
    );
  }
  return <>{children}</>;
}

function MatchCard({ candidate, requirementTitle, fitReasons }: { candidate: Candidate; requirementTitle: string; fitReasons: string[] }) {
  const b = candidate.matchBreakdown;
  return (
    <Card className={CARD}>
      <CardHeader>
        <CardTitle>Fit for {requirementTitle}</CardTitle>
        <CardDescription>How this candidate lines up with the requirement.</CardDescription>
      </CardHeader>
      <CardContent className={cn("grid gap-6", b && fitReasons.length > 0 && "md:grid-cols-2")}>
        {b && (
          <div className="space-y-4">
            <Meter label="Role match" pct={b.roleMatch} />
            <Meter label="Skill match" pct={b.skillMatch} />
            {candidate.city && <Meter label="Location match" pct={b.locationMatch} />}
          </div>
        )}
        {fitReasons.length > 0 && (
          <ul className="space-y-2.5">
            {fitReasons.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-sm leading-relaxed">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                {r}
              </li>
            ))}
          </ul>
        )}
        {!b && fitReasons.length === 0 && <p className="text-sm text-muted-foreground">No fit details available for this match.</p>}
      </CardContent>
    </Card>
  );
}

function SkillsCard({ matched, unmatched }: { matched: string[]; unmatched: string[] }) {
  const total = matched.length + unmatched.length;
  return (
    <Card className={CARD}>
      <CardHeader>
        <CardTitle>Required skills</CardTitle>
        {total > 0 && <CardDescription>{matched.length} of {total} found on the resume</CardDescription>}
        {total > 0 && (
          <CardAction className="w-24">
            <Progress aria-hidden="true" value={(matched.length / total) * 100} className="h-1.5" />
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 && <p className="text-sm text-muted-foreground">This requirement lists no required skills.</p>}
        {matched.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">On resume</p>
            <ul className="flex flex-wrap gap-2">
              {matched.map((s) => (
                <li key={s}>
                  <Badge className={cn("h-6 px-2.5", TONE_SUCCESS)}>
                    <Check aria-hidden="true" />
                    {s}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
        {unmatched.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Not on resume</p>
            <ul className="flex flex-wrap gap-2">
              {unmatched.map((s) => (
                <li key={s}>
                  <Badge variant="outline" className="h-6 px-2.5 text-muted-foreground">
                    <Minus aria-hidden="true" />
                    {s}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EvidenceCard({ candidate, unmatched, state }: { candidate: Candidate; unmatched: string[]; state: EvidenceState }) {
  const { evidence } = state;
  const avg = evidenceAverage(evidence);
  const hasEvidence = !!(evidence?.readiness || evidence?.starCompleteness || evidence?.skills.length);
  const verified = evidence?.verifiedCapabilities ?? [];
  const last = evidence?.sessionDate ? formatSessionDate(evidence.sessionDate) : "";

  return (
    <Card className={CARD}>
      <CardHeader>
        <CardTitle>Practice evidence</CardTitle>
        {hasEvidence && (
          <CardDescription>
            {candidate.sessionsCompleted} graded session{candidate.sessionsCompleted === 1 ? "" : "s"}
            {last ? `, last on ${last}` : ""}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <EvidenceStatus state={state}>
          {hasEvidence ? (
            <div className="space-y-5">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {evidence?.readiness && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Readiness</dt>
                    <dd className="mt-1 text-lg font-semibold">{READINESS_LABEL[evidence.readiness.band]}</dd>
                    <dd className="text-xs text-muted-foreground">{evidence.readiness.confidence} confidence</dd>
                  </div>
                )}
                {avg != null && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Avg skill score</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums">{avg}<span className="text-sm font-normal text-muted-foreground"> / 100</span></dd>
                  </div>
                )}
                {evidence?.starCompleteness && (
                  <div>
                    <dt className="text-xs text-muted-foreground">STAR answers</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums">{evidence.starCompleteness.pct}%</dd>
                    <dd className="text-xs text-muted-foreground">{evidence.starCompleteness.questionsConsidered} question{evidence.starCompleteness.questionsConsidered === 1 ? "" : "s"}</dd>
                  </div>
                )}
              </dl>
              {verified.length > 0 && (
                <ul className="divide-y divide-border/60 rounded-lg border border-border">
                  {verified.map((cap) => (
                    <li key={cap.key} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <span>{cap.label}</span>
                      {cap.verified ? (
                        <Badge className={cn("h-6 px-2.5", TONE_SUCCESS)}>Verified{cap.verifiedDateLabel ? ` · ${cap.verifiedDateLabel}` : ""}</Badge>
                      ) : (
                        <Badge variant="outline" className="h-6 px-2.5 text-muted-foreground">Not yet verified</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">
                {PROVENANCE}. This is practice performance, not an employment check. Verified means 70+ on the skill across 2 or more sessions, the same bar shown on the candidate's own dashboard.
              </p>
            </div>
          ) : (
            <Empty className="border p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileSearch /></EmptyMedia>
                <EmptyTitle>No practice evidence yet</EmptyTitle>
                <EmptyDescription>
                  This candidate hasn't completed a graded mock interview, so the match reflects their resume only.
                </EmptyDescription>
              </EmptyHeader>
              {unmatched.length > 0 && (
                <EmptyContent>
                  <p className="text-xs font-medium text-muted-foreground">Worth probing in your interview</p>
                  <ul className="flex flex-wrap justify-center gap-1.5">
                    {unmatched.slice(0, 5).map((s) => (
                      <li key={s}><Badge variant="secondary">{s}</Badge></li>
                    ))}
                  </ul>
                </EmptyContent>
              )}
            </Empty>
          )}
        </EvidenceStatus>
      </CardContent>
    </Card>
  );
}

export function OverviewTab({
  candidate,
  fitReasons,
  requirementTitle,
  matched,
  unmatched,
  state,
}: {
  candidate: Candidate;
  fitReasons: string[];
  requirementTitle: string;
  matched: string[];
  unmatched: string[];
  state: EvidenceState;
}) {
  return (
    <div className="flex flex-col gap-4">
      <MatchCard candidate={candidate} requirementTitle={requirementTitle} fitReasons={fitReasons} />
      <SkillsCard matched={matched} unmatched={unmatched} />
      <EvidenceCard candidate={candidate} unmatched={unmatched} state={state} />
    </div>
  );
}
