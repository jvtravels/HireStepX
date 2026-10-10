import { BarChart3, FileSearch, ListChecks, MessageSquareQuote, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { CandidateEvidence } from "@/employer/EmployerDataContext";
import type { Candidate } from "@/employer/mockData";
import { readQuotesLocked } from "@/employer/_candidateFields";
import { CARD, TITLE, MAIN_SIDE, PROVENANCE, TONE_DANGER, TONE_SUCCESS, formatSessionDate } from "./helpers";
import { LockedQuotes } from "./Notices";
import { EvidenceStatus, type EvidenceState } from "./OverviewTab";
import { Meter } from "./parts";

function TrendCard({ trend, sessions }: { trend: NonNullable<CandidateEvidence["sessionTrend"]>; sessions: number }) {
  const first = trend[0].score;
  const last = trend[trend.length - 1].score;
  const best = Math.max(...trend.map((t) => t.score));
  const delta = last - first;
  return (
    <Card className={CARD}>
      <CardHeader>
        <CardTitle className={TITLE}><BarChart3 aria-hidden="true" className="size-4 text-primary" />Practice history</CardTitle>
        <CardDescription className="text-md">Overall score of each graded interview, oldest first. {sessions} session{sessions === 1 ? "" : "s"} in total.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-3 gap-4">
          <div>
            <dt className="text-sm text-muted-foreground">Latest</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{last}<span className="text-md font-normal text-muted-foreground"> / 100</span></dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Best</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{best}<span className="text-md font-normal text-muted-foreground"> / 100</span></dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Since first</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-2xl font-bold tabular-nums">
              {trend.length > 1 ? (
                <>
                  {delta > 0 ? <TrendingUp aria-hidden="true" className="size-4 text-emerald-600" /> : delta < 0 ? <TrendingDown aria-hidden="true" className="size-4 text-destructive" /> : null}
                  {delta > 0 ? "+" : ""}{delta}
                </>
              ) : (
                <span className="text-md font-normal text-muted-foreground">One session</span>
              )}
            </dd>
          </div>
        </dl>
        <ol className="space-y-3">
          {trend.map((t, i) => (
            <li key={`${t.date}-${i}`}>
              <Meter label={`${formatSessionDate(t.date)}${t.focus ? ` · ${t.focus}` : ""}`} pct={t.score} />
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export function PracticeTab({
  evidence,
  candidate,
  shortlistHref,
  state,
}: {
  evidence: CandidateEvidence | null;
  candidate: Candidate;
  shortlistHref: string;
  state: EvidenceState;
}) {
  const quotesLocked = readQuotesLocked(evidence, candidate.unlocked);
  const skills = evidence?.skills ?? [];
  const star = evidence?.starCompleteness;
  const trend = evidence?.sessionTrend ?? [];
  const quotes = evidence?.quotes ?? [];
  const hasAnything = skills.length > 0 || !!star || trend.length > 0 || quotes.length > 0 || quotesLocked;

  if (!state.loading && !state.failed && !hasAnything) {
    return (
      <Card className={CARD}>
        <CardContent>
          <Empty className="p-8">
            <EmptyHeader>
              <EmptyMedia variant="icon"><FileSearch /></EmptyMedia>
              <EmptyTitle>No practice evidence yet</EmptyTitle>
              <EmptyDescription>
                This candidate hasn&apos;t completed a graded mock interview, so there are no skill scores, STAR answers or quotes to show. The Resume tab has everything else we know.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <EvidenceStatus state={state}>
        <div className={MAIN_SIDE}>
          <div className="flex min-w-0 flex-col gap-4">
        {trend.length > 0 && <TrendCard trend={trend} sessions={candidate.sessionsCompleted || trend.length} />}
        {(quotesLocked || quotes.length > 0) && (
          <Card className={CARD}>
            <CardHeader>
              <CardTitle className={TITLE}><MessageSquareQuote aria-hidden="true" className="size-4 text-primary" />What they said</CardTitle>
              <CardDescription className="text-md">Verbatim lines from practice answers.</CardDescription>
            </CardHeader>
            <CardContent>
              {quotesLocked ? (
                <LockedQuotes shortlistHref={shortlistHref} />
              ) : (
                <ul className="space-y-3">
                  {quotes.map((q, i) => {
                    const flag = q.kind === "redFlag";
                    return (
                      <li key={i} className="space-y-2 rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={cn("h-6 px-2.5", flag ? TONE_DANGER : TONE_SUCCESS)}>{flag ? "Flag" : "Win"}</Badge>
                          <span className="text-md font-semibold">{q.text}</span>
                        </div>
                        <blockquote className="border-l-2 border-border pl-3 text-md leading-relaxed text-muted-foreground">&ldquo;{q.quote}&rdquo;</blockquote>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
          </div>
          <div className="flex min-w-0 flex-col gap-4">
        {skills.length > 0 && (
          <Card className={CARD}>
            <CardHeader>
              <CardTitle className={TITLE}><ListChecks aria-hidden="true" className="size-4 text-primary" />Skill scores</CardTitle>
              <CardDescription className="text-md">{PROVENANCE}, from the most recent completed session.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {skills.map((s) => (
                  <Meter key={s.name} label={s.name} pct={s.score} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {star && (
          <Card className={CARD}>
            <CardHeader>
              <CardTitle className={TITLE}><ListChecks aria-hidden="true" className="size-4 text-primary" />STAR answer completeness</CardTitle>
              <CardDescription className="text-md">Share of answers that covered Situation, Task, Action and Result.</CardDescription>
            </CardHeader>
            <CardContent>
              <Meter
                                label={`Across ${star.questionsConsidered} question${star.questionsConsidered === 1 ? "" : "s"}`}
                pct={star.pct}
              />
            </CardContent>
          </Card>
        )}

          </div>
        </div>
      </EvidenceStatus>
    </div>
  );
}
