import { Activity, Banknote, CalendarClock, Check, GraduationCap, Hourglass, Lock, MapPin, Target, Trophy, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Candidate } from "@/employer/mockData";
import { CANDIDATE_STATUS_LABEL } from "@/employer/_atoms";
import { Fact, UnlockLink } from "./parts";
import { CARD, NEGATIVE_STATUSES, PIPELINE_STEPS, formatDateTime, formatSessionDate } from "./helpers";

function Stepper({ status }: { status: Candidate["candidateStatus"] }) {
  const negative = NEGATIVE_STATUSES.includes(status);
  const current = negative ? -1 : PIPELINE_STEPS.indexOf(status);
  return (
    <div className="space-y-3">
      <ol aria-label="Hiring pipeline" className="space-y-0">
        {PIPELINE_STEPS.map((step, i) => {
          const reached = !negative && i <= current;
          const isCurrent = i === current;
          const last = i === PIPELINE_STEPS.length - 1;
          return (
            <li key={step} aria-current={isCurrent ? "step" : undefined} className="flex gap-3">
              <div aria-hidden="true" className="flex flex-col items-center">
                <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", reached ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background")}>
                  {reached && !isCurrent && <Check className="size-3" />}
                  {isCurrent && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                </span>
                {!last && <span className={cn("min-h-5 w-px flex-1", reached && i < current ? "bg-primary" : "bg-border")} />}
              </div>
              <p className={cn("pb-4 text-sm leading-5", last && "pb-0", isCurrent ? "font-medium text-foreground" : reached ? "text-foreground" : "text-muted-foreground")}>
                {CANDIDATE_STATUS_LABEL[step]}
                <span className="sr-only">{isCurrent ? " (current stage)" : reached ? " (completed)" : " (not reached)"}</span>
              </p>
            </li>
          );
        })}
      </ol>
      {negative && (
        <p className="flex items-center gap-2 text-sm font-medium text-destructive">
          <X aria-hidden="true" className="size-4" />
          {CANDIDATE_STATUS_LABEL[status]}
        </p>
      )}
    </div>
  );
}

export function CandidateAside({ candidate, shortlistHref, lastSessionDate }: { candidate: Candidate; shortlistHref: string; lastSessionDate: string | null }) {
  const resume = candidate.resume;
  const interview = candidate.interviewScheduledAt ? formatDateTime(candidate.interviewScheduledAt) : "";
  const lastPractice = lastSessionDate ? formatSessionDate(lastSessionDate) : "";

  return (
    <div className="flex flex-col gap-4">
      <Card className={CARD}>
        <CardHeader><CardTitle>Hiring progress</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Stepper status={candidate.candidateStatus} />
          {candidate.candidateStatusNote && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{candidate.candidateStatusNote}</p>
          )}
        </CardContent>
      </Card>

      <Card className={CARD}>
        <CardHeader><CardTitle>At a glance</CardTitle></CardHeader>
        <CardContent>
          <dl className="space-y-4">
            {interview && <Fact icon={CalendarClock} label="Interview" value={interview} />}
            <Fact icon={MapPin} label="Location" value={candidate.city || "Not specified"} />
            {resume?.seniorityLevel && <Fact icon={Trophy} label="Seniority" value={resume.seniorityLevel} />}
            {resume?.noticePeriod && <Fact icon={Hourglass} label="Notice period (self-reported)" value={resume.noticePeriod} />}
            {resume?.currentCtc && <Fact icon={Banknote} label="Current CTC (self-reported)" value={resume.currentCtc} />}
            <Fact icon={Activity} label="Practice interviews" value={candidate.sessionsCompleted > 0 ? `${candidate.sessionsCompleted} completed${lastPractice ? `, last ${lastPractice}` : ""}` : "None yet"} />
            {candidate.sessionsCompleted > 0 && candidate.rosterScore > 0 && (
              <Fact icon={Target} label="Overall practice score" value={`${Math.round(candidate.rosterScore)} / 100`} />
            )}
          </dl>
        </CardContent>
      </Card>

      {!!resume?.education.length && (
        <Card className={CARD}>
          <CardHeader><CardTitle>Education</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-4">
              {resume.education.map((ed, i) => (
                <Fact key={`${ed.school}-${i}`} icon={GraduationCap} label={ed.school || "Institution"} value={`${ed.degree}${ed.year ? ` · ${ed.year}` : ""}`} />
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {!candidate.unlocked && (
        <Card className={cn(CARD, "border-dashed")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock aria-hidden="true" className="size-4" />Identity locked</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Name, contact details, portfolio links and verbatim quotes stay hidden until you unlock this candidate.
            </p>
            <UnlockLink href={shortlistHref} size="sm">Unlock from the shortlist</UnlockLink>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
