"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import {
  CalendarPlusIcon,
  CheckIcon,
  ChevronDownIcon,
  LockIcon,
  MessageCircleIcon,
  MoreVerticalIcon,
  RotateCcwIcon,
  SendIcon,
  UserRoundCheckIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/Toast";
import { CANDIDATE_STATUS_LABEL } from "@/employer/_atoms";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { availabilityOf, evidenceLabels, evidenceLinks, evidenceSources, interviewScore, scoreTone, candidateSkillFit, type ScoreTone } from "@/employer/_jobDetailHelpers";
import { DotLabel } from "@/employer/_panelParts";
import type { Candidate, CandidateStatus } from "@/employer/mockData";
import { nextCandidateStatuses } from "../../../../../../server-handlers/_employer-candidate-status-helpers";
import { formatPaise, singleUnlockPrice } from "../../../../../../server-handlers/_unlock-pricing";
import { skillChipSlots } from "./candidateTableModel";
import { candidateDisplayName, candidateResponseOf, candidateSubtitle, canMessageCandidate, initials, interviewSubstep, practisedLabel } from "./requirementFormat";

const STAGE_TONE: Record<CandidateStatus, string> = {
  shortlisted: "bg-hx-indigo-100 text-hx-indigo",
  interview_invited: "bg-hx-violet-100 text-hx-violet",
  interviewing: "bg-hx-warning-100 text-hx-warning-ink",
  hired: "bg-hx-success-100 text-hx-success-ink",
  rejected: "bg-hx-error-100 text-hx-error-ink",
  not_a_fit: "bg-hx-soft text-hx-neutral-ink",
  no_response: "bg-hx-soft text-hx-neutral-ink",
};

const SCORE_TEXT: Record<ScoreTone, string> = {
  success: "text-hx-success-ink",
  warning: "text-hx-warning-ink",
  error: "text-hx-error-ink",
};

const VISIBLE_CHIPS = 3;

const CHIP = "inline-flex min-w-0 max-w-24 items-center gap-1 rounded-full px-2 py-0.5 text-[12px] leading-4";

/* One cell for the whole skills story: the overall score, then the required skills
   as chips (filled when the resume has them, dashed and muted when it does not).
   The tooltip lists every skill so the row stays scannable. */
function SkillMatch({ score, matched, gaps }: { score: number; matched: string[]; gaps: string[] }) {
  const total = matched.length + gaps.length;
  const rounded = Math.round(score);
  const slots = skillChipSlots(matched, gaps, VISIBLE_CHIPS);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[13px] text-hx-ink-soft tabular-nums">
        <span className={cn("text-[15px] font-semibold", SCORE_TEXT[scoreTone(rounded)])}>{rounded}</span>/100
      </span>
      {total > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${matched.length} of ${total} required skills.${matched.length > 0 ? ` Has ${matched.join(", ")}.` : ""}${gaps.length > 0 ? ` Missing ${gaps.join(", ")}.` : ""}`}
              className="flex w-full min-w-0 cursor-default items-center gap-1 rounded-md border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo pointer-coarse:min-h-11"
            >
              {slots.matched.map((skill) => (
                <span key={`has-${skill}`} aria-hidden="true" className={cn(CHIP, "bg-hx-indigo-100 text-hx-indigo")}>
                  <CheckIcon size={10} strokeWidth={3} className="shrink-0" />
                  <span className="truncate">{skill}</span>
                </span>
              ))}
              {slots.gaps.map((skill) => (
                <span key={`miss-${skill}`} aria-hidden="true" className={cn(CHIP, "border border-dashed border-hx-line bg-white text-hx-ink-soft")}>
                  <span className="truncate">{skill}</span>
                </span>
              ))}
              {slots.hidden > 0 && (
                <span aria-hidden="true" className="shrink-0 text-[12px] text-hx-ink-soft tabular-nums">
                  +{slots.hidden}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-64">
            <div>{matched.length} of {total} required skills</div>
            {matched.length > 0 && <div>Has: {matched.join(", ")}</div>}
            {gaps.length > 0 && <div>Missing: {gaps.join(", ")}</div>}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

interface PrimaryAction {
  label: string;
  icon: LucideIcon;
  disabled: boolean;
  onSelect: () => void;
}

/* How each legal next stage reads in the Stage menu. Forward moves come first,
   closing outcomes after the separator; the order within each group follows the
   server transition table. */
const MOVE_COPY: Record<CandidateStatus, { label: string; icon: LucideIcon; closes: boolean }> = {
  shortlisted: { label: "Reopen", icon: RotateCcwIcon, closes: false },
  interview_invited: { label: "Invite to interview", icon: CalendarPlusIcon, closes: false },
  interviewing: { label: "Mark as interviewing", icon: UserRoundCheckIcon, closes: false },
  hired: { label: "Mark as hired", icon: CheckIcon, closes: true },
  rejected: { label: "Reject", icon: XIcon, closes: true },
  not_a_fit: { label: "Not a fit", icon: XIcon, closes: true },
  no_response: { label: "No response", icon: XIcon, closes: true },
};

function StagePill({ status, className }: { status: CandidateStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap", STAGE_TONE[status], className)}>
      {CANDIDATE_STATUS_LABEL[status]}
    </span>
  );
}

export default function CandidateRow({
  candidate,
  requirementId,
  requiredSkills,
  readOnly,
  suspended,
  onUnlock,
  onViewEvidence,
  onMessage,
  onStageChange,
}: {
  candidate: Candidate;
  requirementId: string;
  requiredSkills: string[];
  readOnly: boolean;
  suspended: boolean;
  onUnlock: () => void;
  onViewEvidence: () => void;
  onMessage: () => void;
  onStageChange: (status: CandidateStatus) => void;
}) {
  const name = candidateDisplayName(candidate);
  const subtitle = candidateSubtitle(candidate);
  const response = candidateResponseOf(candidate);
  const substep = interviewSubstep(candidate);
  const unlockPrice = formatPaise(singleUnlockPrice().amountPaise);
  const canMessage = !readOnly && canMessageCandidate(candidate);
  const writeOff = readOnly || suspended;
  const { matched, gaps } = candidateSkillFit(candidate, requiredSkills);
  const availability = availabilityOf(candidate.resume?.noticePeriod);
  const score = interviewScore(candidate);
  const evidence = evidenceSources(candidate);
  const sourceLabels = evidenceLabels(evidence);
  const links = evidenceLinks(candidate);
  const { fetchCandidateResumeUrl } = useEmployerData();
  const { toast } = useToast();
  const [resumeBusy, setResumeBusy] = useState(false);
  const openResume = async () => {
    setResumeBusy(true);
    const file = await fetchCandidateResumeUrl(candidate.id);
    setResumeBusy(false);
    if (!file) {
      toast("Couldn't open the resume. Try again, or open the evidence report.", "error");
      return;
    }
    window.location.assign(file.url);
  };
  const practised = practisedLabel(candidate.lastActiveDaysAgo);
  const moves = writeOff ? [] : nextCandidateStatuses(candidate.candidateStatus);
  const forwardMoves = moves.filter((m) => !MOVE_COPY[m].closes);
  const closingMoves = moves.filter((m) => MOVE_COPY[m].closes);
  const canInvite = moves.includes("interview_invited");
  const primary: PrimaryAction | null =
    !candidate.unlocked && !readOnly
      ? { label: `Unlock for ${unlockPrice}`, icon: LockIcon, disabled: suspended, onSelect: onUnlock }
      : canInvite
        ? { label: "Invite to interview", icon: CalendarPlusIcon, disabled: false, onSelect: () => onStageChange("interview_invited") }
        : canMessage
          ? { label: "Message candidate", icon: SendIcon, disabled: suspended, onSelect: onMessage }
          : null;
  const showMessageInMenu = canMessage && primary?.onSelect !== onMessage;
  const profileHref = `/employer/requirements/${requirementId}/candidates/${candidate.id}`;
  const router = useRouter();

  // Menus render in portals but React still bubbles their clicks here, so only
  // act on clicks whose target is really inside the row and not a control.
  const openProfile = (e: MouseEvent<HTMLTableRowElement>) => {
    const target = e.target as HTMLElement;
    if (!e.currentTarget.contains(target)) return;
    if (target.closest("a, button, input, [role='menuitem'], [role='menu']")) return;
    if (window.getSelection()?.toString()) return;
    router.push(profileHref);
  };

  return (
    <TableRow role="row" onClick={openProfile} className="cand-tr rq-row h-[76px] cursor-pointer border-b border-hx-line">
      <TableCell role="cell" className="cand-td cand-td-name max-w-[240px] px-3 py-3 align-middle">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar size="lg" aria-hidden="true" title={candidate.unlocked ? undefined : "Name and contact are hidden until you unlock."}>
            <AvatarFallback className={cn("text-[13px] font-bold", candidate.unlocked ? "bg-hx-indigo-100 text-hx-indigo" : "bg-hx-soft text-hx-ink-soft")}>
              {candidate.unlocked ? initials(candidate.name) : <LockIcon size={15} />}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <Link href={profileHref} className="rq-link block truncate text-[14px] font-semibold text-hx-coal no-underline">
              {name}
            </Link>
            {subtitle && (
              <div className="mt-0.5 truncate text-[12.5px] text-hx-ink-soft" title={subtitle}>
                {subtitle}
              </div>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {response === "interested" && <span className="rounded-full bg-hx-success-100 px-2 py-0.5 text-[11px] font-semibold text-hx-success-ink">Interested</span>}
              {response === "declined" && <span className="rounded-full bg-hx-soft px-2 py-0.5 text-[11px] font-semibold text-hx-neutral-ink">Declined</span>}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell role="cell" className="cand-td cand-td-fit px-3 py-3 align-middle" data-label="Role match for this job">
        <SkillMatch score={candidate.matchScore} matched={matched} gaps={gaps} />
      </TableCell>
      <TableCell role="cell" className="cand-td px-3 py-3 align-middle whitespace-normal" data-label="Availability">
        <DotLabel tone={availability.tone}>{availability.label}</DotLabel>
      </TableCell>
      <TableCell role="cell" className="cand-td px-3 py-3 align-middle" data-label="Evidence">
        {evidence.total === 0 ? (
          <span className="text-[13px] text-hx-ink-soft">No sources yet</span>
        ) : (
          <div className="flex flex-col items-start gap-0.5">
            <button
              type="button"
              onClick={onViewEvidence}
              aria-label={`Evidence for ${name}: ${score != null ? `interview score ${score} out of 100 across ${evidence.interviews} ${evidence.interviews === 1 ? "interview" : "interviews"}${practised ? `, ${practised.toLowerCase()}` : ""}` : "no graded interviews"}${!candidate.unlocked && sourceLabels.length > 0 ? `. Also ${sourceLabels.join(", ")}` : ""}. View evidence report`}
              className="group flex cursor-pointer flex-col items-start rounded-md border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo pointer-coarse:min-h-11"
            >
              {score != null ? (
                <span title={practised ?? undefined} className="text-[13px] text-hx-ink-soft tabular-nums group-hover:underline">
                  <span className={cn("text-[15px] font-semibold", SCORE_TEXT[scoreTone(score)])}>{score}</span>/100
                  <span> · {evidence.interviews} {evidence.interviews === 1 ? "interview" : "interviews"}</span>
                </span>
              ) : (
                <span className="text-[13px] text-hx-ink-soft group-hover:underline">No interviews yet</span>
              )}
            </button>
            {sourceLabels.length > 0 &&
              (candidate.unlocked ? (
                <span className="flex flex-wrap items-center text-[12px] text-hx-ink-soft">
                  {evidence.resume && (
                    <button
                      type="button"
                      onClick={() => (candidate.hasResumeFile ? void openResume() : router.push(profileHref))}
                      disabled={resumeBusy}
                      aria-label={candidate.hasResumeFile ? `Download ${name}'s resume` : `View ${name}'s resume on their profile`}
                      className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-hx-indigo underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo disabled:cursor-wait disabled:opacity-60 pointer-coarse:min-h-11"
                    >
                      Resume
                    </button>
                  )}
                  {links.github && (
                    <>
                      {evidence.resume && <span aria-hidden="true" className="px-1">·</span>}
                      <a href={links.github} target="_blank" rel="noopener noreferrer" aria-label={`${name}'s GitHub, opens in a new tab`} className="text-hx-indigo underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center">
                        GitHub
                      </a>
                    </>
                  )}
                  {links.web && (
                    <>
                      {(evidence.resume || links.github) && <span aria-hidden="true" className="px-1">·</span>}
                      <a href={links.web} target="_blank" rel="noopener noreferrer" aria-label={`${name}'s portfolio, opens in a new tab`} className="text-hx-indigo underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center">
                        Portfolio
                      </a>
                    </>
                  )}
                </span>
              ) : (
                <span className="text-[12px] text-hx-ink-soft">{sourceLabels.join(" · ")}</span>
              ))}
          </div>
        )}
      </TableCell>
      <TableCell role="cell" className="cand-td px-3 py-3 align-middle" data-label="Stage">
        <div className="flex flex-col items-start gap-1">
          {moves.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Stage for ${name}: ${CANDIDATE_STATUS_LABEL[candidate.candidateStatus]}. Move to another stage`}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1 rounded-full border-0 py-1 pr-2 pl-2.5 text-[12px] font-semibold whitespace-nowrap transition-[filter] duration-150 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo motion-reduce:transition-none pointer-coarse:min-h-11",
                    STAGE_TONE[candidate.candidateStatus],
                  )}
                >
                  {CANDIDATE_STATUS_LABEL[candidate.candidateStatus]}
                  <ChevronDownIcon size={13} aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Move to</DropdownMenuLabel>
                {forwardMoves.map((m) => {
                  const Icon = MOVE_COPY[m].icon;
                  const needsUnlock = !candidate.unlocked && (m === "interview_invited" || m === "interviewing" || m === "hired");
                  return (
                    <DropdownMenuItem key={m} onSelect={() => onStageChange(m)}>
                      <Icon className="size-4" aria-hidden="true" /> {needsUnlock ? `Unlock to ${MOVE_COPY[m].label.toLowerCase()}` : MOVE_COPY[m].label}
                    </DropdownMenuItem>
                  );
                })}
                {forwardMoves.length > 0 && closingMoves.length > 0 && <DropdownMenuSeparator />}
                {closingMoves.map((m) => {
                  const Icon = MOVE_COPY[m].icon;
                  const needsUnlock = !candidate.unlocked && m === "hired";
                  return (
                    <DropdownMenuItem key={m} onSelect={() => onStageChange(m)}>
                      <Icon className="size-4" aria-hidden="true" /> {needsUnlock ? `Unlock to ${MOVE_COPY[m].label.toLowerCase()}` : MOVE_COPY[m].label}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/employer/requirements/${requirementId}/outcome?candidate=${candidate.id}`}>
                    <MessageCircleIcon className="size-4" aria-hidden="true" /> Move with a note
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <StagePill status={candidate.candidateStatus} />
          )}
          {substep && <span className="text-[11.5px] text-hx-ink-soft">{substep}</span>}
        </div>
      </TableCell>
      <TableCell role="cell" className="cand-td cand-td-act w-px whitespace-nowrap px-2 py-3 align-middle">
        <div className="flex items-center justify-end gap-0.5">
          {primary && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" disabled={primary.disabled} onClick={primary.onSelect} aria-label={`${primary.label}: ${name}`} className="size-8 text-hx-indigo pointer-coarse:size-11">
                  <primary.icon size={16} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{primary.label}</TooltipContent>
            </Tooltip>
          )}
          {showMessageInMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`} className="size-8 text-hx-ink-soft pointer-coarse:size-11">
                  <MoreVerticalIcon size={16} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem disabled={suspended} onSelect={onMessage}>
                  <SendIcon className="size-4" aria-hidden="true" /> Message candidate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
