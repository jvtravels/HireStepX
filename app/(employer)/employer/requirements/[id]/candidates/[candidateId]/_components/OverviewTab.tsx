import Link from "next/link";
import { BarChart3, Check, Lightbulb, ListChecks, Minus, Sparkles, Target, ThumbsUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CandidateEvidence } from "@/employer/EmployerDataContext";
import type { Candidate } from "@/employer/mockData";
import type { Requirement } from "@/employer/EmployerDataContext";
import { Meter } from "./parts";
import { CARD, TITLE, MAIN_SIDE, PROVENANCE, READINESS_LABEL, TONE_SUCCESS, buildResumeInsights, evidenceAverage, formatSessionDate } from "./helpers";

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

function MatchCard({ candidate, fitReasons }: { candidate: Candidate; fitReasons: string[] }) {
  const b = candidate.matchBreakdown;
  const hasCity = !!candidate.city && candidate.city !== "Not specified";
  return (
    <Card className={CARD}>
      <CardHeader>
        <CardTitle className={TITLE}><Target aria-hidden="true" className="size-4 text-primary" />Why this match</CardTitle>
        <CardDescription className="text-md">The match score blends role, skill and location fit. Each part is scored out of 100.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {b && (
          <div className="space-y-4">
            <Meter label="Role match" pct={b.roleMatch} />
            <Meter label="Skill match" pct={b.skillMatch} />
            {hasCity && <Meter label="Location match" pct={b.locationMatch} />}
          </div>
        )}
        {fitReasons.length > 0 && (
          <ul className="space-y-2.5">
            {fitReasons.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-md leading-relaxed">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                {r}
              </li>
            ))}
          </ul>
        )}
        {!b && fitReasons.length === 0 && <p className="text-md text-muted-foreground">No fit details available for this match.</p>}
      </CardContent>
    </Card>
  );
}

function SkillsCard({ matched, unmatched }: { matched: string[]; unmatched: string[] }) {
  const total = matched.length + unmatched.length;
  return (
    <Card className={CARD}>
      <CardHeader>
        <CardTitle className={TITLE}><ListChecks aria-hidden="true" className="size-4 text-primary" />Required skills</CardTitle>
        {total > 0 && <CardDescription className="text-md">{matched.length} of {total} found on the resume</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 && <p className="text-md text-muted-foreground">This requirement lists no required skills.</p>}
        {matched.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">On resume</p>
            <ul className="flex flex-wrap gap-2">
              {matched.map((s) => (
                <li key={s}><Badge className={cn("h-6 px-2.5", TONE_SUCCESS)}><Check aria-hidden="true" />{s}</Badge></li>
              ))}
            </ul>
          </div>
        )}
        {unmatched.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">Not on resume</p>
            <ul className="flex flex-wrap gap-2">
              {unmatched.map((s) => (
                <li key={s}><Badge variant="outline" className="h-6 px-2.5 text-muted-foreground"><Minus aria-hidden="true" />{s}</Badge></li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Bullets({ icon: Icon, title, items, tone }: { icon: typeof ThumbsUp; title: string; items: string[]; tone: string }) {
  return (
    <div className="space-y-2.5">
      <h3 className="flex items-center gap-2 text-base font-semibold"><Icon aria-hidden="true" className={`size-4 ${tone}`} />{title}</h3>
      <ul className="space-y-2 text-md leading-relaxed text-muted-foreground">
        {items.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );
}

function AnalysisCard({ candidate, requirement, matched, unmatched, shortlistHref }: { candidate: Candidate; requirement: Requirement; matched: string[]; unmatched: string[]; shortlistHref: string }) {
  const insights = buildResumeInsights(candidate, requirement, matched, unmatched);
  return (
    <Card className={CARD}>
      <CardHeader>
        <CardTitle className={TITLE}><Sparkles aria-hidden="true" className="size-4 text-primary" />Resume analysis</CardTitle>
        <CardDescription className="text-md">Generated from the resume against {requirement.title}. Nothing here is added by the candidate.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!candidate.unlocked ? (
          <p className="text-md text-muted-foreground">
            The resume analysis is locked.{" "}
            <Link href={shortlistHref} className="font-semibold text-primary underline-offset-4 hover:underline">Unlock from the shortlist</Link> to view it.
          </p>
        ) : (
          <>
            <p className="text-md leading-relaxed">{insights.snapshot}</p>
            {(insights.strengths.length > 0 || insights.probes.length > 0) && (
              <div className="grid gap-5">
                {insights.strengths.length > 0 && <Bullets icon={ThumbsUp} title="What stands out" items={insights.strengths} tone="text-emerald-600" />}
                {insights.probes.length > 0 && <Bullets icon={Lightbulb} title="Worth probing in the interview" items={insights.probes} tone="text-amber-600" />}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EvidenceCard({ candidate, state, onOpenPractice }: { candidate: Candidate; state: EvidenceState; onOpenPractice: () => void }) {
  const { evidence } = state;
  const avg = evidenceAverage(evidence);
  const hasEvidence = !!(evidence?.readiness || evidence?.starCompleteness || evidence?.skills.length);
  const verified = evidence?.verifiedCapabilities ?? [];
  const last = evidence?.sessionDate ? formatSessionDate(evidence.sessionDate) : "";

  return (
    <Card className={CARD}>
      <CardHeader>
        <CardTitle className={TITLE}><BarChart3 aria-hidden="true" className="size-4 text-primary" />Practice evidence</CardTitle>
        {hasEvidence && (
          <CardDescription className="text-md">
            {candidate.sessionsCompleted} graded session{candidate.sessionsCompleted === 1 ? "" : "s"}
            {last ? `, last on ${last}` : ""}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <EvidenceStatus state={state}>
          {hasEvidence ? (
            <div className="space-y-5">
              <dl className="grid grid-cols-2 gap-4">
                {evidence?.readiness && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Readiness</dt>
                    <dd className="mt-1 text-2xl font-bold">{READINESS_LABEL[evidence.readiness.band]}</dd>
                    <dd className="text-sm text-muted-foreground">{evidence.readiness.confidence} confidence</dd>
                  </div>
                )}
                {avg != null && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Avg skill score</dt>
                    <dd className="mt-1 text-2xl font-bold tabular-nums">{avg}<span className="text-md font-normal text-muted-foreground"> / 100</span></dd>
                  </div>
                )}
                {evidence?.starCompleteness && (
                  <div>
                    <dt className="text-sm text-muted-foreground">STAR answers</dt>
                    <dd className="mt-1 text-2xl font-bold tabular-nums">{evidence.starCompleteness.pct}%</dd>
                    <dd className="text-sm text-muted-foreground">{evidence.starCompleteness.questionsConsidered} question{evidence.starCompleteness.questionsConsidered === 1 ? "" : "s"}</dd>
                  </div>
                )}
              </dl>
              {verified.length > 0 && (
                <ul className="divide-y divide-border/60 rounded-lg border border-border">
                  {verified.map((cap) => (
                    <li key={cap.key} className="flex items-center justify-between gap-3 px-3 py-2.5 text-md">
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
              <p className="text-sm leading-relaxed text-muted-foreground">
                {PROVENANCE}. This is practice performance, not an employment check. Verified means 70+ on the skill across 2 or more sessions, the same bar shown on the candidate's own dashboard.
              </p>
            </div>
          ) : (
            <p className="text-md text-muted-foreground">
              No graded practice interviews yet, so this match reflects the resume only.{" "}
              <button type="button" onClick={onOpenPractice} className="font-semibold text-primary underline-offset-4 hover:underline">View practice tab</button>
            </p>
          )}
        </EvidenceStatus>
      </CardContent>
    </Card>
  );
}

export function OverviewTab({
  candidate,
  requirement,
  fitReasons,
  matched,
  unmatched,
  shortlistHref,
  state,
  onOpenPractice,
}: {
  candidate: Candidate;
  requirement: Requirement;
  fitReasons: string[];
  matched: string[];
  unmatched: string[];
  shortlistHref: string;
  state: EvidenceState;
  onOpenPractice: () => void;
}) {
  return (
    <div className={MAIN_SIDE}>
      <div className="flex min-w-0 flex-col gap-4">
        <MatchCard candidate={candidate} fitReasons={fitReasons} />
        <AnalysisCard candidate={candidate} requirement={requirement} matched={matched} unmatched={unmatched} shortlistHref={shortlistHref} />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <SkillsCard matched={matched} unmatched={unmatched} />
        <EvidenceCard candidate={candidate} state={state} onOpenPractice={onOpenPractice} />
      </div>
    </div>
  );
}
