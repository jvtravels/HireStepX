import { Briefcase, Clock, ExternalLink, Lock, Mail, MapPin, Phone } from "lucide-react";
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
import { CARD, TONE_DANGER, TONE_SUCCESS, TONE_WARNING, candidateLinks, initials, maskedName, scoreBand } from "./helpers";
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
  const body = (
    <>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="sr-only">{label}: </span>
      <span className="break-all">{children}</span>
    </>
  );
  const cls = "inline-flex items-center gap-2 text-sm text-foreground";
  return href ? (
    <a href={href} className={cn(cls, "hover:underline")} {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
      {body}
      {href.startsWith("http") && <span className="sr-only"> (opens in a new tab)</span>}
    </a>
  ) : (
    <span className={cls}>{body}</span>
  );
}

export function CandidateHeader({
  candidate,
  suspended,
  declined,
  shortlistHref,
  resumeFileName,
  onInvite,
  onReject,
}: {
  candidate: Candidate;
  suspended: boolean;
  declined: boolean;
  shortlistHref: string;
  resumeFileName: string | null;
  onInvite: () => void;
  onReject: () => void;
}) {
  const resume = candidate.resume;
  const displayName = maskedName(candidate);
  const canInvite = canInviteToInterview(candidate.candidateStatus);
  const canReject = !["hired", "rejected", "not_a_fit"].includes(candidate.candidateStatus);
  const inviteBlocked = suspended || declined;
  const response = declined ? "declined" : readCandidateResponse(candidate);
  const band = scoreBand(candidate.matchScore);
  const links = candidateLinks(candidate);
  const blockedReason = suspended
    ? "Actions are unavailable while your account is suspended."
    : declined
      ? "Invite is disabled because this candidate declined contact."
      : null;

  return (
    <Card className={cn(CARD, "gap-0 py-0")}>
      <div className="flex flex-col gap-5 p-5 md:flex-row md:items-start md:justify-between md:p-6">
        <div className="flex min-w-0 gap-4">
          <Avatar className="size-14 shrink-0" aria-hidden="true">
            <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
              {candidate.unlocked ? initials(displayName) : <Lock className="size-5" />}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-xl font-semibold tracking-tight break-words text-foreground">{displayName}</h1>
              <Badge className={cn("h-6 px-2.5", STATUS_TONE[candidate.candidateStatus])}>{CANDIDATE_STATUS_LABEL[candidate.candidateStatus]}</Badge>
              {response === "interested" && <Badge className={cn("h-6 px-2.5", TONE_SUCCESS)}>Candidate is interested</Badge>}
              {response === "declined" && <Badge className={cn("h-6 px-2.5", TONE_DANGER)}>Declined contact</Badge>}
              {response === "none" && <Badge variant="outline" className="h-6 px-2.5">No response yet</Badge>}
            </div>
            <p className="text-sm font-medium text-foreground">{candidate.targetRole}</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {candidate.city && (
                <li className="inline-flex items-center gap-1.5"><MapPin aria-hidden="true" className="size-3.5" />{candidate.city}</li>
              )}
              {resume?.yearsExperience != null && (
                <li className="inline-flex items-center gap-1.5"><Briefcase aria-hidden="true" className="size-3.5" />{resume.yearsExperience} yrs experience</li>
              )}
              {candidate.lastActiveDaysAgo >= 0 && (
                <li className="inline-flex items-center gap-1.5"><Clock aria-hidden="true" className="size-3.5" />Active {candidate.lastActiveDaysAgo === 0 ? "today" : `${candidate.lastActiveDaysAgo}d ago`}</li>
              )}
            </ul>
            {resume?.headline && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{resume.headline}</p>}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 md:w-56">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
            <div>
              <p className="text-xs text-muted-foreground">Match score</p>
              <p className="text-2xl leading-none font-semibold tabular-nums">
                {candidate.matchScore}
                <span className="text-sm font-normal text-muted-foreground"> / 100</span>
              </p>
            </div>
            <Badge className={cn("h-6 px-2.5", band.className)}>{band.label}</Badge>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
            {canInvite && (
              <Button size="lg" onClick={onInvite} disabled={inviteBlocked} className="w-full pointer-coarse:h-11">
                Send interview invite
              </Button>
            )}
            {canReject && (
              <Button size="lg" variant="outline" onClick={onReject} disabled={suspended} className="w-full pointer-coarse:h-11">
                Reject candidate
              </Button>
            )}
          </div>
          {blockedReason && (canInvite || canReject) && <p className="text-xs text-muted-foreground">{blockedReason}</p>}
        </div>
      </div>

      <Separator />
      <div className="px-5 py-3 md:px-6">
        {candidate.unlocked ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {candidate.contact?.phone && <ContactLink icon={Phone} label="Phone" href={`tel:${candidate.contact.phone}`}>{candidate.contact.phone}</ContactLink>}
            {candidate.contact?.email && <ContactLink icon={Mail} label="Email" href={`mailto:${candidate.contact.email}`}>{candidate.contact.email}</ContactLink>}
            {links.map((l) => (
              <ContactLink key={l.url} icon={ExternalLink} label={l.label} href={l.url}>{l.label}</ContactLink>
            ))}
            {!candidate.contact?.phone && !candidate.contact?.email && links.length === 0 && (
              <p className="text-sm text-muted-foreground">No contact details on file.</p>
            )}
            {resumeFileName && <div className="sm:ml-auto"><ResumeDownload matchId={candidate.id} fileName={resumeFileName} size="sm" /></div>}
          </div>
        ) : (
          <LockedContact shortlistHref={shortlistHref} />
        )}
      </div>
    </Card>
  );
}
