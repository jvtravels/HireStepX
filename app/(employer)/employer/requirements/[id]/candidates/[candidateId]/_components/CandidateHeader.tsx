import { Briefcase, Check, Clock, ExternalLink, Lock, Mail, MapPin, Phone, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Candidate, CandidateStatus } from "@/employer/mockData";
import { CANDIDATE_STATUS_LABEL } from "@/employer/_atoms";
import { canInviteToInterview } from "@/employer/InterviewInviteDialog";
import { readCandidateResponse } from "@/employer/_candidateFields";
import { LockedContact } from "./Notices";
import { CARD, NEGATIVE_STATUSES, PIPELINE_STEPS, TONE_DANGER, TONE_SUCCESS, TONE_WARNING, candidateLinks, initials, maskedName, scoreBand } from "./helpers";
import { ResumeDownload } from "./ResumeDownload";

const STATUS_TONE: Record<CandidateStatus, string> = {
  shortlisted: "bg-secondary text-secondary-foreground",
  interview_invited: "bg-primary/10 text-primary",
  interviewing: "bg-primary/10 text-primary",
  hired: TONE_SUCCESS,
  rejected: TONE_DANGER,
  not_a_fit: TONE_DANGER,
  no_response: TONE_WARNING,
};

function ContactLink({ icon: Icon, label, href, children }: { icon: typeof Mail; label: string; href?: string; children: React.ReactNode }) {
  const external = !!href?.startsWith("http");
  return (
    <a href={href} className="inline-flex items-center gap-2 text-sm text-foreground hover:underline" {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="sr-only">{label}: </span>
      <span className="break-all">{children}</span>
      {external && <span className="sr-only"> (opens in a new tab)</span>}
    </a>
  );
}

function ratioTone(ratio: number): string {
  return ratio >= 0.75 ? TONE_SUCCESS : ratio >= 0.5 ? TONE_WARNING : TONE_DANGER;
}

function Stat({ label, value, unit, note, badge }: { label: string; value: string; unit?: string; note: string; badge?: { label: string; className: string } }) {
  return (
    <div className="flex flex-col gap-1.5 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {badge && <Badge className={cn("h-5 px-2", badge.className)}>{badge.label}</Badge>}
      </div>
      <p className="text-3xl leading-none font-bold tabular-nums">
        {value}
        {unit && <span className="text-sm font-normal text-muted-foreground"> {unit}</span>}
      </p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function SummaryStrip({ candidate, matchedCount, requiredCount }: { candidate: Candidate; matchedCount: number; requiredCount: number }) {
  const band = scoreBand(candidate.matchScore);
  const skillRatio = requiredCount ? matchedCount / requiredCount : 0;
  const practised = candidate.sessionsCompleted > 0;
  const years = candidate.resume?.yearsExperience;
  return (
    <Card className={cn(CARD, "gap-0 overflow-hidden py-0")}>
      <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        <Stat label="Match score" value={String(candidate.matchScore)} unit="/ 100" note="Role, skill and location fit" badge={band} />
        <Stat
          label="Required skills"
          value={requiredCount ? `${matchedCount}/${requiredCount}` : "—"}
          note={requiredCount ? "Found on the resume" : "None listed"}
          badge={requiredCount ? { label: skillRatio >= 0.75 ? "Good" : skillRatio >= 0.5 ? "Partial" : "Low", className: ratioTone(skillRatio) } : undefined}
        />
        <Stat
          label="Practice interviews"
          value={practised ? String(candidate.sessionsCompleted) : "None"}
          note={practised && candidate.rosterScore > 0 ? `Average score ${Math.round(candidate.rosterScore)} / 100` : "No graded interviews yet"}
        />
        <Stat label="Experience" value={years != null ? String(years) : "—"} unit={years != null ? "yrs" : undefined} note={candidate.resume?.seniorityLevel || "Not stated on resume"} />
      </div>
    </Card>
  );
}

function Progress({ status }: { status: CandidateStatus }) {
  const negative = NEGATIVE_STATUSES.includes(status);
  const current = negative ? -1 : PIPELINE_STEPS.indexOf(status);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-xs font-medium text-muted-foreground">Hiring progress</p>
      <ol aria-label="Hiring pipeline" className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {PIPELINE_STEPS.map((step, i) => {
          const reached = !negative && i <= current;
          const isCurrent = i === current;
          return (
            <li key={step} aria-current={isCurrent ? "step" : undefined} className={cn("flex items-center gap-1.5 text-sm", isCurrent ? "font-medium text-foreground" : reached ? "text-foreground" : "text-muted-foreground")}>
              <span aria-hidden="true" className={cn("flex size-4 items-center justify-center rounded-full border", reached ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                {reached && !isCurrent && <Check className="size-2.5" />}
                {isCurrent && <span className="size-1.5 rounded-full bg-primary-foreground" />}
              </span>
              {CANDIDATE_STATUS_LABEL[step]}
              <span className="sr-only">{isCurrent ? " (current stage)" : reached ? " (completed)" : " (not reached)"}</span>
            </li>
          );
        })}
      </ol>
      {negative && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
          <X aria-hidden="true" className="size-4" />
          {CANDIDATE_STATUS_LABEL[status]}
        </p>
      )}
    </div>
  );
}

export function CandidateHeader({
  candidate,
  suspended,
  declined,
  shortlistHref,
  resumeFileName,
  matchedCount,
  requiredCount,
  onInvite,
  onReject,
}: {
  candidate: Candidate;
  suspended: boolean;
  declined: boolean;
  shortlistHref: string;
  resumeFileName: string | null;
  matchedCount: number;
  requiredCount: number;
  onInvite: () => void;
  onReject: () => void;
}) {
  const resume = candidate.resume;
  const displayName = maskedName(candidate);
  const canInvite = canInviteToInterview(candidate.candidateStatus);
  const canReject = !["hired", "rejected", "not_a_fit"].includes(candidate.candidateStatus);
  const inviteBlocked = suspended || declined;
  const response = declined ? "declined" : readCandidateResponse(candidate);
  const links = candidateLinks(candidate);
  const hasCity = !!candidate.city && candidate.city !== "Not specified";
  const blockedReason = suspended
    ? "Actions are unavailable while your account is suspended."
    : declined
      ? "Invite is disabled because this candidate declined contact."
      : null;

  return (
    <div className="flex flex-col gap-4">
      <Card className={cn(CARD, "gap-0 py-0")}>
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="size-14 shrink-0" aria-hidden="true">
              <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
                {candidate.unlocked ? initials(displayName) : <Lock className="size-5" />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h1 className="text-xl font-semibold tracking-tight break-words">{displayName}</h1>
                <Badge className={cn("h-6 px-2.5", STATUS_TONE[candidate.candidateStatus])}>{CANDIDATE_STATUS_LABEL[candidate.candidateStatus]}</Badge>
                {response === "interested" && <Badge className={cn("h-6 px-2.5", TONE_SUCCESS)}>Candidate is interested</Badge>}
                {response === "declined" && <Badge className={cn("h-6 px-2.5", TONE_DANGER)}>Declined contact</Badge>}
              </div>
              <p className="text-sm font-medium">{candidate.targetRole}</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {hasCity && <li className="inline-flex items-center gap-1.5"><MapPin aria-hidden="true" className="size-3.5" />{candidate.city}</li>}
                {resume?.yearsExperience != null && <li className="inline-flex items-center gap-1.5"><Briefcase aria-hidden="true" className="size-3.5" />{resume.yearsExperience} yrs experience</li>}
                {candidate.lastActiveDaysAgo >= 0 && <li className="inline-flex items-center gap-1.5"><Clock aria-hidden="true" className="size-3.5" />Active {candidate.lastActiveDaysAgo === 0 ? "today" : `${candidate.lastActiveDaysAgo}d ago`}</li>}
              </ul>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
            {canInvite && <Button onClick={onInvite} disabled={inviteBlocked} className="pointer-coarse:h-11">Send interview invite</Button>}
            {canReject && <Button variant="outline" onClick={onReject} disabled={suspended} className="pointer-coarse:h-11">Reject candidate</Button>}
          </div>
        </div>
        {blockedReason && (canInvite || canReject) && <p className="px-5 pb-3 text-xs text-muted-foreground">{blockedReason}</p>}
        <Separator />
        <div className="px-5 py-3">
          {candidate.unlocked ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {candidate.contact?.phone && <ContactLink icon={Phone} label="Phone" href={`tel:${candidate.contact.phone}`}>{candidate.contact.phone}</ContactLink>}
              {candidate.contact?.email && <ContactLink icon={Mail} label="Email" href={`mailto:${candidate.contact.email}`}>{candidate.contact.email}</ContactLink>}
              {links.map((l) => <ContactLink key={l.url} icon={ExternalLink} label={l.label} href={l.url}>{l.label}</ContactLink>)}
              {!candidate.contact?.phone && !candidate.contact?.email && links.length === 0 && <p className="text-sm text-muted-foreground">No contact details on file.</p>}
              {resumeFileName && <div className="sm:ml-auto"><ResumeDownload matchId={candidate.id} fileName={resumeFileName} size="sm" /></div>}
            </div>
          ) : (
            <LockedContact shortlistHref={shortlistHref} />
          )}
        </div>
        <Separator />
        <div className="px-5 py-3"><Progress status={candidate.candidateStatus} /></div>
      </Card>
      <SummaryStrip candidate={candidate} matchedCount={matchedCount} requiredCount={requiredCount} />
    </div>
  );
}
