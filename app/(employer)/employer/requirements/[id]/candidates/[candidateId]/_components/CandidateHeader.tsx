import type { ReactNode } from "react";
import { BriefcaseIcon, CalendarClockIcon, CheckIcon, CircleAlertIcon, ClockIcon, ExternalLinkIcon, LockIcon, MailIcon, MapPinIcon, PhoneIcon, SparklesIcon, WalletIcon } from "lucide-react";
import { cn } from "cn";
import type { Candidate } from "@/employer/mockData";
import { Button } from "@/components/ui/button";
import { Badge, CandidateStatusChip, ScoreChip } from "@/employer/_atoms";
import { canInviteToInterview } from "@/employer/InterviewInviteDialog";
import { readCandidateResponse } from "@/employer/_candidateFields";
import { MetaLine, SkillChip, type ChipTone, type MetaPart } from "@/employer/_panelParts";
import { IdentityHiddenBadge } from "@/employer/_requirementAtoms";
import { PortfolioLinkIcon } from "@/portfolioLinkIcons";
import { LockedContact } from "./Notices";
import { HEADER_ACTION, candidateLinks, initials, maskedName } from "./helpers";
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

function Tier({ title, icon, tone, skills, iconClass }: { title: string; icon: ReactNode; tone: ChipTone; skills: string[]; iconClass: string }) {
  return (
    <div className="grid min-w-0 gap-1.5 sm:grid-cols-[116px_minmax(0,1fr)] sm:items-start sm:gap-3">
      <h3 className="m-0 flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold text-hx-coal sm:pt-1">
        <span aria-hidden="true" className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-md", iconClass)}>{icon}</span>
        {title}
      </h3>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {skills.map((s) => (
          <li key={s}>
            <SkillChip tone={tone}>{s}</SkillChip>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KeySkills({ skills, required }: { skills: string[]; required: string[] }) {
  const have = new Set(skills.map((s) => s.toLowerCase()));
  const requiredSet = new Set(required.map((s) => s.toLowerCase()));
  const matched = required.filter((s) => have.has(s.toLowerCase()));
  const gaps = required.filter((s) => !have.has(s.toLowerCase()));
  const other = skills.filter((s) => !requiredSet.has(s.toLowerCase())).slice(0, 8);
  const tiers = [
    matched.length > 0 && <Tier key="m" title="Matched" icon={<CheckIcon size={12} />} tone="primary" skills={matched} iconClass="bg-hx-indigo-100 text-hx-indigo" />,
    gaps.length > 0 && <Tier key="g" title="Not on resume" icon={<CircleAlertIcon size={12} />} tone="danger" skills={gaps} iconClass="bg-hx-error-100 text-hx-error-ink" />,
    other.length > 0 && <Tier key="o" title="Also lists" icon={<SparklesIcon size={12} />} tone="neutral" skills={other} iconClass="bg-hx-info-100 text-hx-info" />,
  ].filter(Boolean);
  if (tiers.length === 0) return null;
  return (
    <section aria-labelledby="key-skills-heading" className="min-w-0">
      <h2 id="key-skills-heading" className="m-0 mb-2.5 text-[13px] font-semibold text-hx-ink-soft">Key skills</h2>
      <div className="flex flex-col gap-3">{tiers}</div>
    </section>
  );
}

export function CandidateHeader({
  candidate,
  requiredSkills,
  declined,
  suspended,
  shortlistHref,
  resumeFileName,
  onInvite,
  onReject,
}: {
  candidate: Candidate;
  requiredSkills: string[];
  declined: boolean;
  suspended: boolean;
  shortlistHref: string;
  resumeFileName: string | null;
  onInvite: () => void;
  onReject: () => void;
}) {
  const resume = candidate.resume;
  const displayName = maskedName(candidate);
  const response = declined ? "declined" : readCandidateResponse(candidate);
  const hasCity = !!candidate.city && candidate.city !== "Not specified";
  const summary = candidate.unlocked ? resume?.summary?.trim() : "";
  const notice = candidate.unlocked ? resume?.noticePeriod : null;
  const ctc = candidate.unlocked ? resume?.currentCtc : null;
  const links = candidate.unlocked ? candidateLinks(candidate) : [];
  const selfReported = <span className="sr-only"> (self-reported)</span>;
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
  if (resume?.yearsExperience != null) meta.push({ icon: BriefcaseIcon, text: `${resume.yearsExperience} yrs experience` });
  if (hasCity) meta.push({ icon: MapPinIcon, text: candidate.city });
  if (candidate.lastActiveDaysAgo >= 0) meta.push({ icon: ClockIcon, text: `Active ${candidate.lastActiveDaysAgo === 0 ? "today" : `${candidate.lastActiveDaysAgo}d ago`}` });
  if (notice) meta.push({ icon: CalendarClockIcon, title: "Self-reported", text: <>{notice} notice{selfReported}</> });
  if (ctc) meta.push({ icon: WalletIcon, title: "Self-reported", text: <>{ctc} CTC{selfReported}</> });

  const keySkills = candidate.skills.length > 0 || requiredSkills.length > 0 ? <KeySkills skills={candidate.skills} required={requiredSkills} /> : null;
  const hasContactRow = !candidate.unlocked || !!candidate.contact?.phone || !!candidate.contact?.email || links.length > 0;

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
              {!candidate.unlocked && <IdentityHiddenBadge />}
              {response === "interested" && <Badge tone="success">Candidate is interested</Badge>}
              {response === "declined" && <Badge tone="error">Declined contact</Badge>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ScoreChip score={candidate.matchScore} />
          {resumeFileName && <ResumeDownload matchId={candidate.id} fileName={resumeFileName} className={HEADER_ACTION} />}
          {canReject && <Button type="button" variant="outline" onClick={onReject} disabled={suspended} className={cn("pointer-coarse:h-11", HEADER_ACTION)}>Reject</Button>}
          {canInvite && <Button type="button" onClick={onInvite} disabled={inviteBlocked} className={cn("pointer-coarse:h-11", HEADER_ACTION)}>Send interview invite</Button>}
        </div>
      </div>
      <MetaLine parts={meta} className="mt-3" />
      {blockedReason && <p className="m-0 mt-3 text-right text-[12px] text-hx-ink-soft">{blockedReason}</p>}

      {(summary || keySkills || hasContactRow) && (
        <div className={cn("mt-4 grid min-w-0 gap-x-8 gap-y-4 border-t border-hx-line pt-4", keySkills && (summary || hasContactRow) && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]")}>
          {(summary || hasContactRow) && (
            <div className="flex min-w-0 flex-col gap-4">
              {summary && <p className="m-0 max-w-[75ch] text-[14px] leading-relaxed whitespace-pre-line text-hx-ink-soft [overflow-wrap:anywhere]">{summary}</p>}
              {hasContactRow && (
                <div className={cn(summary && "border-t border-hx-line pt-4")}>
                  {candidate.unlocked ? (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                      {candidate.contact?.phone && <ContactLink icon={PhoneIcon} label="Phone" href={`tel:${candidate.contact.phone}`}>{candidate.contact.phone}</ContactLink>}
                      {candidate.contact?.email && <ContactLink icon={MailIcon} label="Email" href={`mailto:${candidate.contact.email}`}>{candidate.contact.email}</ContactLink>}
                      {links.map((l) => (
                        <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[13px] text-hx-coal hover:underline">
                          <span aria-hidden="true" className="inline-flex shrink-0 text-hx-ink-soft"><PortfolioLinkIcon url={l.url} size={15} /></span>
                          <span className="sr-only">{l.label}: </span>
                          <span className="[overflow-wrap:anywhere]">{l.host}</span>
                          <ExternalLinkIcon size={13} aria-hidden="true" className="shrink-0 text-hx-ink-soft" />
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <LockedContact shortlistHref={shortlistHref} />
                  )}
                </div>
              )}
            </div>
          )}
          {keySkills && <div className={cn("min-w-0", (summary || hasContactRow) && "lg:border-l lg:border-hx-line lg:pl-8")}>{keySkills}</div>}
        </div>
      )}
    </header>
  );
}
