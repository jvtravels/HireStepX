import { MessageSquareQuote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { CandidateEvidence } from "@/employer/EmployerDataContext";
import { readQuotesLocked } from "@/employer/_candidateFields";
import { PROVENANCE, TONE_DANGER, TONE_SUCCESS } from "./helpers";
import { LockedQuotes } from "./Notices";
import { EvidenceStatus, type EvidenceState } from "./OverviewTab";
import { Meter } from "./parts";

function NoData({ children }: { children: React.ReactNode }) {
  return (
    <Empty className="border p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon"><MessageSquareQuote /></EmptyMedia>
        <EmptyTitle>Nothing to show yet</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function PracticeTab({
  evidence,
  unlocked,
  shortlistHref,
  state,
}: {
  evidence: CandidateEvidence | null;
  unlocked: boolean;
  shortlistHref: string;
  state: EvidenceState;
}) {
  const quotesLocked = readQuotesLocked(evidence, unlocked);
  const skills = evidence?.skills ?? [];
  const star = evidence?.starCompleteness;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Skill scores</CardTitle>
          <CardDescription>{PROVENANCE}, from the most recent completed session.</CardDescription>
        </CardHeader>
        <CardContent>
          <EvidenceStatus state={state}>
            {skills.length ? (
              <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {skills.map((s) => (
                  <Meter key={s.name} label={s.name} pct={s.score} />
                ))}
              </div>
            ) : (
              <NoData>No completed session has skill data.</NoData>
            )}
          </EvidenceStatus>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>STAR answer completeness</CardTitle>
          <CardDescription>Share of answers that covered Situation, Task, Action and Result.</CardDescription>
        </CardHeader>
        <CardContent>
          <EvidenceStatus state={state}>
            {star ? (
              <Meter
                className="max-w-md"
                label={`Across ${star.questionsConsidered} question${star.questionsConsidered === 1 ? "" : "s"}`}
                pct={star.pct}
              />
            ) : (
              <NoData>No STAR data for this candidate.</NoData>
            )}
          </EvidenceStatus>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What they said</CardTitle>
          <CardDescription>Verbatim lines from practice answers.</CardDescription>
        </CardHeader>
        <CardContent>
          <EvidenceStatus state={state}>
            {quotesLocked ? (
              <LockedQuotes shortlistHref={shortlistHref} />
            ) : evidence && evidence.quotes.length > 0 ? (
              <ul className="space-y-3">
                {evidence.quotes.map((q, i) => {
                  const flag = q.kind === "redFlag";
                  return (
                    <li key={i} className="space-y-2 rounded-lg border border-border/60 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={cn("h-6 px-2.5", flag ? TONE_DANGER : TONE_SUCCESS)}>{flag ? "Flag" : "Win"}</Badge>
                        <span className="text-sm font-medium">{q.text}</span>
                      </div>
                      <blockquote className="border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground">&ldquo;{q.quote}&rdquo;</blockquote>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <NoData>No quotes were recorded from this candidate's sessions.</NoData>
            )}
          </EvidenceStatus>
        </CardContent>
      </Card>
    </div>
  );
}
