"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
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
import { motion, useReducedMotion } from "motion/react";
import { cn } from "cn";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/Toast";
import { CANDIDATE_STATUS_LABEL, matchBand } from "@/employer/_atoms";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { availabilityOf, evidenceLabels, evidenceLinks, evidenceSources, interviewScore, scoreTone, candidateSkillFit, type ScoreTone } from "@/employer/_jobDetailHelpers";
import { DotLabel } from "@/employer/_panelParts";
import type { Candidate, CandidateStatus } from "@/employer/mockData";
import { nextCandidateStatuses } from "../../../../../../server-handlers/_employer-candidate-status-helpers";
import { formatPaise, singleUnlockPrice } from "../../../../../../server-handlers/_unlock-pricing";
import { skillChipSlots } from "./candidateTableModel";
import { candidateDisplayName, candidateResponseOf, candidateSubtitle, canInviteCandidate, canMessageCandidate, initials, interviewSubstep, practisedLabel } from "./requirementFormat";

const MotionRow = motion.create(TableRow);

const STAGE_TONE: Record<CandidateStatus, string> = {
  shortlisted: "bg-hx-indigo-100 text-hx-indigo",
  interview_invited: "bg-hx-copper-100 text-hx-copper-dark",
  interviewing: "bg-hx-copper-100 text-hx-copper-dark",
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

/* The match number uses the same bands as the match chip and badge, so the colours never disagree. */
const MATCH_TEXT = { strong: "text-hx-success-ink", fair: "text-hx-warning-ink", low: "text-hx-ink-soft" } as const;

const VISIBLE_CHIPS = 3;

const CHIP = "inline-flex min-w-0 max-w-24 items-center gap-1 rounded-full px-2 py-0.5 text-[12px] leading-4";

/* One cell for the whole skills story: the overall score, then the required skills
   as chips (filled when the resume has them, dashed and muted when it does not).
   The tooltip lists every skill so the row stays scannable. */
function SkillMatch({ score, matched, gaps, noneMet }: { score: number; matched: string[]; gaps: string[]; noneMet: boolean }) {
  const total = matched.length + gaps.length;
  const rounded = Math.round(score);
  const slots = skillChipSlots(matched, gaps, VISIBLE_CHIPS);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[13px] text-hx-ink-soft tabular-nums">
        <span className={cn("text-[15px] font-semibold", MATCH_TEXT[matchBand(rounded)])}>{rounded}</span>/100
      </span>
      {total > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${matched.length} of ${total} required skills.${matched.length > 0 ? ` Has ${matched.join(", ")}.` : ""}${gaps.length > 0 ? ` Missing ${gaps.join(", ")}.` : ""}`}
              className="flex w-full min-w-0 cursor-default items-center gap-1 rounded-md border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
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
            {noneMet && <div className="mt-1">Fits on role and location but lists none of the required skills, so it is not ranked as a strong match.</div>}
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
  shortlisted: { label: "Reopen (back to To review)", icon: RotateCcwIcon, closes: false },
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
  selected,
  selectDisabled,
  showAvailability,
  onSelectedChange,
  active,
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
  selected: boolean;
  /** The selection limit is reached, so this unselected row can't be added. */
  selectDisabled: boolean;
  showAvailability: boolean;
  /** `range` is true for a shift-click, which selects everything between the last click and this row. */
  onSelectedChange: (checked: boolean, range: boolean) => void;
  /** The row the j/k keyboard cursor is on. */
  active: boolean;
}) {
  const name = candidateDisplayName(candidate);
  const rowRef = useRef<HTMLTableRowElement | null>(null);
  const shiftHeld = useRef(false);
  useEffect(() => {
    if (active) rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);
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
  // The server refuses an invite for a candidate who declined or withdrew, so don't offer it.
  const moves = writeOff ? [] : nextCandidateStatuses(candidate.candidateStatus).filter((m) => m !== "interview_invited" || canInviteCandidate(candidate));
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
  const reduceMotion = useReducedMotion();

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
    <MotionRow ref={rowRef} layout={reduceMotion ? false : "position"} transition={{ layout: { duration: 0.22, ease: [0.25, 1, 0.5, 1] } }} exit={reduceMotion ? undefined : { opacity: 0, transition: { duration: 0.16, ease: [0.25, 1, 0.5, 1] } }} role="row" onClick={openProfile} data-selected={selected} data-active={active} className="cand-tr rq-row h-[76px] cursor-pointer border-b border-hx-line">
      <TableCell role="cell" className="cand-td cand-td-name max-w-[240px] px-3 py-3 align-middle">
        <div className="flex min-w-0 items-center gap-3">
          <Checkbox
            checked={selected}
            disabled={selectDisabled && !selected}
            // Radix reports the change without the event, so the modifier is read from the click that causes it.
            onClick={(e) => { shiftHeld.current = e.shiftKey; }}
            onCheckedChange={(v) => onSelectedChange(v === true, shiftHeld.current)}
            aria-label={`Select ${name}`}
            className="shrink-0 pointer-coarse:size-6 pointer-coarse:after:-inset-3"
          />
          <Avatar size="lg" aria-hidden="true" title={candidate.unlocked ? undefined : "Name and contact are hidden until you unlock."}>
            <AvatarFallback className={cn("text-[13px] font-bold", candidate.unlocked ? "bg-hx-indigo-100 text-hx-indigo" : "bg-hx-soft text-hx-ink-soft")}>
              {candidate.unlocked ? initials(candidate.name) : <LockIcon size={15} />}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <HoverCard openDelay={400} closeDelay={80}>
              <HoverCardTrigger asChild>
                <Link href={profileHref} className="rq-link block truncate text-[14px] font-semibold text-hx-coal no-underline">
                  {name}
                </Link>
              </HoverCardTrigger>
              <HoverCardContent side="bottom" align="start" className="w-72 p-3">
                <div className="text-[13px] font-semibold text-hx-coal">{name}</div>
                {subtitle && <div className="mt-0.5 text-[12px] text-hx-ink-soft">{subtitle}</div>}
                <dl className="m-0 mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12px] tabular-nums">
                  <dt className="text-hx-ink-soft">Last active</dt>
                  <dd className="m-0 text-hx-coal">{practised ? practised.replace(/^Practised /, "") : "Unknown"}</dd>
                </dl>
              </HoverCardContent>
            </HoverCard>
            {subtitle && (
              <div className="mt-0.5 truncate text-[12.5px] text-hx-ink-soft" title={subtitle}>
                {subtitle}
              </div>
            )}
            {(response === "interested" || response === "declined") && <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {response === "interested" && <span className="rounded-full bg-hx-success-100 px-2 py-0.5 text-[11px] font-semibold text-hx-success-ink">Interested</span>}
              {response === "declined" && <span className="rounded-full bg-hx-soft px-2 py-0.5 text-[11px] font-semibold text-hx-neutral-ink">Declined</span>}
            </div>}
          </div>
        </div>
      </TableCell>
      <TableCell role="cell" className="cand-td cand-td-fit px-3 py-3 align-middle" data-label="Role match for this job">
        <SkillMatch score={candidate.matchScore} matched={matched} gaps={gaps} noneMet={candidate.requiredSkillsMet === 0} />
      </TableCell>
      {showAvailability && (
        <TableCell role="cell" className="cand-td px-3 py-3 align-middle whitespace-normal" data-label="Availability">
          <DotLabel tone={availability.tone}>{availability.label}</DotLabel>
        </TableCell>
      )}
      <TableCell role="cell" className="cand-td px-3 py-3 align-middle" data-label="Evidence">
        {evidence.total === 0 ? (
          <span className="text-[13px] text-hx-ink-soft">No sources yet</span>
        ) : (
          <div className="flex flex-col items-start gap-0.5">
            <button
              type="button"
              onClick={onViewEvidence}
              aria-label={`Evidence for ${name}: ${score != null ? `interview score ${score} out of 100 across ${evidence.interviews} ${evidence.interviews === 1 ? "interview" : "interviews"}${practised ? `, ${practised.toLowerCase()}` : ""}` : "no graded interviews"}${!candidate.unlocked && sourceLabels.length > 0 ? `. Also ${sourceLabels.join(", ")}` : ""}. View evidence report`}
              className="group flex cursor-pointer flex-col items-start rounded-md border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
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
                      className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-hx-indigo underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60 pointer-coarse:min-h-11"
                    >
                      Resume
                    </button>
                  )}
                  {links.github && (
                    <>
                      {evidence.resume && <span aria-hidden="true" className="px-1">·</span>}
                      <a href={links.github} target="_blank" rel="noopener noreferrer" aria-label={`${name}'s GitHub, opens in a new tab`} className="text-hx-indigo underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center">
                        GitHub
                      </a>
                    </>
                  )}
                  {links.web && (
                    <>
                      {(evidence.resume || links.github) && <span aria-hidden="true" className="px-1">·</span>}
                      <a href={links.web} target="_blank" rel="noopener noreferrer" aria-label={`${name}'s portfolio, opens in a new tab`} className="text-hx-indigo underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center">
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
                    "inline-flex cursor-pointer items-center gap-1 rounded-full border-0 py-1 pr-2 pl-2.5 text-[12px] font-semibold whitespace-nowrap transition-[filter] duration-150 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none pointer-coarse:min-h-11",
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
          {primary && primary.icon === LockIcon && (
            <Button
              type="button"
              variant="outline"
              disabled={primary.disabled}
              onClick={primary.onSelect}
              aria-label={`${primary.label}: ${name}`}
              className="h-9 gap-1.5 px-3 text-[13px] font-semibold text-hx-indigo pointer-coarse:h-11"
            >
              <LockIcon size={14} aria-hidden="true" />
              {primary.label}
            </Button>
          )}
          {primary && primary.icon !== LockIcon && (
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
    </MotionRow>
  );
}
