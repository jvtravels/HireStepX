"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import {
  CalendarPlusIcon,
  CheckIcon,
  ChevronDownIcon,
  CodeXmlIcon,
  FileTextIcon,
  GlobeIcon,
  LockIcon,
  MessageCircleIcon,
  MicIcon,
  MoreVerticalIcon,
  SendIcon,
} from "lucide-react";
import { cn } from "cn";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CANDIDATE_STATUS_LABEL } from "@/employer/_atoms";
import { availabilityOf, evidenceSources, interviewScore, scoreTone, skillFit, type ScoreTone } from "@/employer/_jobDetailHelpers";
import { DotLabel } from "@/employer/_panelParts";
import { IdentityHiddenBadge } from "@/employer/_requirementAtoms";
import { canInviteToInterview } from "@/employer/InterviewInviteDialog";
import type { Candidate, CandidateStatus } from "@/employer/mockData";
import { formatPaise, singleUnlockPrice } from "../../../../../../server-handlers/_unlock-pricing";
import { candidateDisplayName, candidateResponseOf, candidateSubtitle, canMessageCandidate, initials, interviewSubstep, practisedLabel } from "./requirementFormat";

const VISIBLE_FIT_ITEMS = 2;

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

const EMPTY = <span className="text-hx-ink-soft">&mdash;</span>;

function FitItems({ items, kind }: { items: string[]; kind: "match" | "gap" }) {
  if (items.length === 0) return EMPTY;
  const shown = items.slice(0, VISIBLE_FIT_ITEMS);
  const rest = items.slice(VISIBLE_FIT_ITEMS);
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {shown.map((item) => (
        <li key={item} className="flex items-center gap-1.5 text-[13px] text-hx-coal">
          {kind === "match" ? (
            <CheckIcon size={13} strokeWidth={2.5} aria-hidden="true" className="shrink-0 text-hx-success" />
          ) : (
            <span aria-hidden="true" className="mx-[3px] size-1.5 shrink-0 rounded-full bg-hx-warning" />
          )}
          <span className="min-w-0 [overflow-wrap:anywhere]">{item}</span>
        </li>
      ))}
      {rest.length > 0 && (
        <li>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${rest.length} more: ${rest.join(", ")}`}
                className="cursor-default rounded-md border-0 bg-transparent p-0 text-[12px] font-medium text-hx-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo pointer-coarse:min-h-11 pointer-coarse:min-w-11"
              >
                +{rest.length} more
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-64">
              {rest.join(", ")}
            </TooltipContent>
          </Tooltip>
        </li>
      )}
    </ul>
  );
}

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
  onInvite,
}: {
  candidate: Candidate;
  requirementId: string;
  requiredSkills: string[];
  readOnly: boolean;
  suspended: boolean;
  onUnlock: () => void;
  onViewEvidence: () => void;
  onMessage: () => void;
  onInvite: () => void;
}) {
  const name = candidateDisplayName(candidate);
  const subtitle = candidateSubtitle(candidate);
  const response = candidateResponseOf(candidate);
  const substep = interviewSubstep(candidate);
  const unlockPrice = formatPaise(singleUnlockPrice().amountPaise);
  const canMessage = !readOnly && canMessageCandidate(candidate);
  const writeOff = readOnly || suspended;
  const { matched, gaps } = skillFit(candidate.skills, requiredSkills);
  const years = candidate.resume?.yearsExperience ?? null;
  const availability = availabilityOf(candidate.resume?.noticePeriod);
  const score = interviewScore(candidate);
  const evidence = evidenceSources(candidate);
  const practised = practisedLabel(candidate.lastActiveDaysAgo);
  const canInvite = !writeOff && canInviteToInterview(candidate.candidateStatus);
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
      <TableCell role="cell" className="cand-td cand-td-name max-w-[300px] px-3 py-3 align-middle">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar size="lg" aria-hidden="true">
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
              {!candidate.unlocked && <IdentityHiddenBadge compact />}
              {response === "interested" && <span className="rounded-full bg-hx-success-100 px-2 py-0.5 text-[11px] font-semibold text-hx-success-ink">Interested</span>}
              {response === "declined" && <span className="rounded-full bg-hx-soft px-2 py-0.5 text-[11px] font-semibold text-hx-neutral-ink">Declined</span>}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell role="cell" className="cand-td cand-td-fit px-3 py-3 align-middle" data-label="Role match for this job">
        <FitItems items={matched} kind="match" />
      </TableCell>
      <TableCell role="cell" className="cand-td cand-td-fit px-3 py-3 align-middle" data-label="Key gaps">
        <FitItems items={gaps} kind="gap" />
      </TableCell>
      <TableCell role="cell" className="cand-td px-3 py-3 align-middle" data-label="Experience">
        <span className="text-[13px] text-hx-coal">{years != null ? `${years} ${years === 1 ? "year" : "years"}` : EMPTY}</span>
      </TableCell>
      <TableCell role="cell" className="cand-td px-3 py-3 align-middle whitespace-normal" data-label="Availability">
        <DotLabel tone={availability.tone}>{availability.label}</DotLabel>
      </TableCell>
      <TableCell role="cell" className="cand-td px-3 py-3 align-middle" data-label="Evidence">
        {evidence.total === 0 ? (
          <span className="text-[13px] text-hx-ink-soft">No sources yet</span>
        ) : (
          <button
            type="button"
            onClick={onViewEvidence}
            aria-label={`Evidence for ${name}: ${evidence.total} ${evidence.total === 1 ? "source" : "sources"}${score != null ? `, interview score ${score} out of 100 across ${candidate.sessionsCompleted} ${candidate.sessionsCompleted === 1 ? "interview" : "interviews"}${practised ? `, ${practised.toLowerCase()}` : ""}` : ""}. View evidence report`}
            className="group flex cursor-pointer flex-col items-start gap-1 rounded-md border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo pointer-coarse:min-h-11"
          >
            <span aria-hidden="true" className="flex items-center gap-1.5 text-hx-ink-soft">
              {evidence.resume && <FileTextIcon size={15} />}
              {evidence.interviews > 0 && <MicIcon size={15} />}
              {evidence.web > 0 && <GlobeIcon size={15} />}
              {evidence.github > 0 && <CodeXmlIcon size={15} />}
            </span>
            <span className="text-[13px] text-hx-coal group-hover:underline">
              {evidence.total} {evidence.total === 1 ? "source" : "sources"}
            </span>
            {score != null && (
              <span title={practised ?? undefined} className="text-[12px] text-hx-ink-soft tabular-nums">
                Interview <span className={cn("font-semibold", SCORE_TEXT[scoreTone(score)])}>{score}</span>/100
              </span>
            )}
          </button>
        )}
      </TableCell>
      <TableCell role="cell" className="cand-td px-3 py-3 align-middle" data-label="Stage">
        <div className="flex flex-col items-start gap-1">
          {!writeOff ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Stage for ${name}: ${CANDIDATE_STATUS_LABEL[candidate.candidateStatus]}. Open stage actions`}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1 rounded-full border-0 py-1 pr-2 pl-2.5 text-[12px] font-semibold whitespace-nowrap transition-[filter] duration-150 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo motion-reduce:transition-none pointer-coarse:min-h-11",
                    STAGE_TONE[candidate.candidateStatus],
                  )}
                >
                  {CANDIDATE_STATUS_LABEL[candidate.candidateStatus]}
                  <ChevronDownIcon size={13} aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {canInvite && (
                  <DropdownMenuItem onSelect={onInvite}>
                    <CalendarPlusIcon className="size-4" aria-hidden="true" /> {candidate.unlocked ? "Invite to interview" : "Unlock to invite"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href={`/employer/requirements/${requirementId}/outcome?candidate=${candidate.id}`}>
                    <MessageCircleIcon className="size-4" aria-hidden="true" /> Record outcome
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
      <TableCell role="cell" className="cand-td cand-td-act px-3 py-3 align-middle">
        <div className="flex items-center justify-end gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`} className="size-9 text-hx-ink-soft pointer-coarse:size-11">
                <MoreVerticalIcon size={16} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {!candidate.unlocked && !readOnly && (
                <DropdownMenuItem disabled={suspended} onSelect={onUnlock}>
                  <LockIcon className="size-4" aria-hidden="true" /> Unlock for {unlockPrice}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={onViewEvidence}>
                <FileTextIcon className="size-4" aria-hidden="true" /> View evidence report
              </DropdownMenuItem>
              {canMessage && (
                <DropdownMenuItem disabled={suspended} onSelect={onMessage}>
                  <SendIcon className="size-4" aria-hidden="true" /> Message candidate
                </DropdownMenuItem>
              )}
              {canInvite && (
                <DropdownMenuItem onSelect={onInvite}>
                  <CalendarPlusIcon className="size-4" aria-hidden="true" /> {candidate.unlocked ? "Invite to interview" : "Unlock to invite"}
                </DropdownMenuItem>
              )}
              {!writeOff && (
                <DropdownMenuItem asChild>
                  <Link href={`/employer/requirements/${requirementId}/outcome?candidate=${candidate.id}`}>
                    <MessageCircleIcon className="size-4" aria-hidden="true" /> Record outcome
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}
