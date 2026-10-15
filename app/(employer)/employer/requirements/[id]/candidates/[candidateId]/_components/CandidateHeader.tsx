import type { ReactNode } from "react";
import { BriefcaseIcon, ClockIcon, ExternalLinkIcon, LockIcon, MailIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import { cn } from "cn";
import type { Candidate } from "@/employer/mockData";
import { Button } from "@/components/ui/button";
import { Badge, CandidateStatusChip, ScoreChip } from "@/employer/_atoms";
import { canInviteToInterview } from "@/employer/InterviewInviteDialog";
import { readCandidateResponse } from "@/employer/_candidateFields";
import { MetaLine, type MetaPart } from "@/employer/_panelParts";
import { PortfolioLinkIcon } from "@/portfolioLinkIcons";
import { formatPaise, singleUnlockPrice } from "../../../../../../../../server-handlers/_unlock-pricing";
import { HEADER_ACTION, candidateLinks, formatYears, initials, maskedName } from "./helpers";
import { RequestContact } from "./RequestContact";
import { ResumeDownload } from "./ResumeDownload";

function ContactLink({ icon: Icon, label, href, children }: { icon: typeof MailIcon; label: string; href: string; children: ReactNode }) {
  return (
    <a href={href} className="inline-flex items-center gap-2 text-[13px] text-hx-coal hover:underline">
      <Icon size={15} aria-hidden="true" className="shrink-0 text-hx-ink-soft" />
      <span className="sr-only">{label}: </span>
      <span className="[overflow-wrap:anywhere]">{children}</span>
    </a>
  );
}

function MissingContact({ icon: Icon, label }: { icon: typeof MailIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-hx-ink-soft">
      <Icon size={15} aria-hidden="true" className="shrink-0" />
      <span className="sr-only">{label}: </span>
      <span>Not provided</span>
    </span>
  );
}

function HiddenContact({ icon: Icon, label }: { icon: typeof MailIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-hx-ink-soft">
      <Icon size={15} aria-hidden="true" className="shrink-0" />
      <span>{label}</span>
      <LockIcon size={12} aria-hidden="true" className="shrink-0" />
      <span className="sr-only">hidden until unlock</span>
    </span>
  );
}

export function CandidateHeader({
  candidate,
  declined,
  suspended,
  resumeFileName,
  onUnlock,
  onInvite,
  onReject,
}: {
  candidate: Candidate;
  declined: boolean;
  suspended: boolean;
  resumeFileName: string | null;
  onUnlock: () => void;
  onInvite: () => void;
  onReject: () => void;
}) {
  const resume = candidate.resume;
  const displayName = maskedName(candidate);
  const response = declined ? "declined" : readCandidateResponse(candidate);
  const hasCity = !!candidate.city && candidate.city !== "Not specified";
  const links = candidate.unlocked ? candidateLinks(candidate) : [];
  const canInvite = canInviteToInterview(candidate.candidateStatus);
  const canReject = !["hired", "rejected", "not_a_fit"].includes(candidate.candidateStatus);
  const inviteBlocked = suspended || declined;
  const blockedReason = suspended
    ? "Actions are unavailable while your account is suspended."
    : declined && canInvite
      ? "Invite is disabled because this candidate declined contact."
      : null;

  const meta: MetaPart[] = [];
  if (candidate.targetRole) meta.push({ icon: BriefcaseIcon, text: candidate.targetRole });
  if (resume?.yearsExperience != null) meta.push({ icon: BriefcaseIcon, text: `${formatYears(resume.yearsExperience)} experience` });
  if (hasCity) meta.push({ icon: MapPinIcon, text: candidate.city });
  if (candidate.lastActiveDaysAgo >= 0) meta.push({ icon: ClockIcon, text: `Active ${candidate.lastActiveDaysAgo === 0 ? "today" : `${candidate.lastActiveDaysAgo}d ago`}` });

  return (
    <header className="min-w-0 rounded-xl border border-hx-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-80">
          <div className="flex items-center gap-3">
            <div aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-hx-indigo-100 text-[14px] font-semibold text-hx-indigo">
              {candidate.unlocked ? initials(displayName) : <LockIcon size={19} />}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="m-0 text-[clamp(22px,5vw,26px)] leading-tight font-bold tracking-[-0.02em] text-hx-coal [overflow-wrap:anywhere]">{displayName}</h1>
              <CandidateStatusChip status={candidate.candidateStatus} />
              {response === "interested" && <Badge tone="success">Candidate is interested</Badge>}
              {response === "declined" && <Badge tone="error">Declined contact</Badge>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ScoreChip score={candidate.matchScore} />
          {resumeFileName && <ResumeDownload matchId={candidate.id} fileName={resumeFileName} className={HEADER_ACTION} />}
          {canReject && <Button type="button" variant="outline" onClick={onReject} disabled={suspended} className={cn("pointer-coarse:h-11", HEADER_ACTION)}>Reject</Button>}
          {!candidate.unlocked && (
            <Button type="button" onClick={onUnlock} disabled={suspended} className={cn("gap-1.5 pointer-coarse:h-11", HEADER_ACTION)}>
              <LockIcon size={14} aria-hidden="true" />
              Unlock for {formatPaise(singleUnlockPrice().amountPaise)}
              <span className="sr-only"> to reveal identity and contact details and send an invite</span>
            </Button>
          )}
          {canInvite && candidate.unlocked && <Button type="button" onClick={onInvite} disabled={inviteBlocked} className={cn("pointer-coarse:h-11", HEADER_ACTION)}>Send interview invite</Button>}
        </div>
      </div>
      <MetaLine parts={meta} className="mt-3" />
      {blockedReason && <p className="m-0 mt-3 text-right text-[12px] text-hx-ink-soft">{blockedReason}</p>}

      <div className="mt-4 min-w-0 border-t border-hx-line pt-4">
        {candidate.unlocked ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {candidate.contact?.email ? <ContactLink icon={MailIcon} label="Email" href={`mailto:${candidate.contact.email}`}>{candidate.contact.email}</ContactLink> : <MissingContact icon={MailIcon} label="Email" />}
            {candidate.contact?.phone ? <ContactLink icon={PhoneIcon} label="Phone" href={`tel:${candidate.contact.phone}`}>{candidate.contact.phone}</ContactLink> : <MissingContact icon={PhoneIcon} label="Phone" />}
            {links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[13px] text-hx-coal hover:underline">
                <span aria-hidden="true" className="inline-flex shrink-0 text-hx-ink-soft"><PortfolioLinkIcon url={l.url} size={15} /></span>
                <span className="sr-only">{l.label}: </span>
                <span className="[overflow-wrap:anywhere]">{l.host}</span>
                <ExternalLinkIcon size={13} aria-hidden="true" className="shrink-0 text-hx-ink-soft" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ))}
            <RequestContact candidate={candidate} disabled={inviteBlocked} disabledReason={blockedReason} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <HiddenContact icon={MailIcon} label="Email" />
            <HiddenContact icon={PhoneIcon} label="Phone" />
            <HiddenContact icon={ExternalLinkIcon} label="Links" />
          </div>
        )}
      </div>
    </header>
  );
}
