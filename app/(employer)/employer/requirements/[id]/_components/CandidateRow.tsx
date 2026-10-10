"use client";

import Link from "next/link";
import { CalendarPlusIcon, FileTextIcon, LockIcon, MessageCircleIcon, MoreVerticalIcon, SendIcon } from "lucide-react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CandidateStatusChip, Pill, ScoreChip, SkillTag } from "@/employer/_atoms";
import { IdentityHiddenBadge } from "@/employer/_requirementAtoms";
import type { Candidate } from "@/employer/mockData";
import { canInviteToInterview } from "@/employer/InterviewInviteDialog";
import { singleUnlockPrice } from "../../../../../../server-handlers/_unlock-pricing";
import {
  candidateDisplayName,
  candidateResponseOf,
  candidateSubtitle,
  canMessageCandidate,
  initials,
  interviewSubstep,
} from "./requirementFormat";
import { tdStyle, tdSortableStyle } from "./candidateTableStyles";

function CandidateAvatar({ name, unlocked }: { name: string; unlocked: boolean }) {
  return (
    <Avatar size="lg" aria-hidden="true">
      <AvatarFallback
        style={{ background: unlocked ? t.indigo100 : t.creamSoft, color: unlocked ? t.indigoDeep : t.inkFaint, fontFamily: f.sans, fontWeight: 700, fontSize: textSize.lg }}
      >
        {unlocked ? initials(name) : <LockIcon size={16} />}
      </AvatarFallback>
    </Avatar>
  );
}

const dash = <span style={{ color: t.inkFaint }}>—</span>;

export default function CandidateRow({
  candidate,
  requirementId,
  readOnly,
  suspended,
  selected,
  onToggleSelected,
  onUnlock,
  onViewEvidence,
  onMessage,
  onInvite,
}: {
  candidate: Candidate;
  requirementId: string;
  readOnly: boolean;
  suspended: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  onUnlock: () => void;
  onViewEvidence: () => void;
  onMessage: () => void;
  onInvite: () => void;
}) {
  const name = candidateDisplayName(candidate);
  const response = candidateResponseOf(candidate);
  const substep = interviewSubstep(candidate);
  const unlockPrice = `₹${(singleUnlockPrice().amountPaise / 100).toFixed(0)}`;
  const canMessage = !readOnly && canMessageCandidate(candidate);
  const writeOff = readOnly || suspended;

  return (
    <TableRow role="row" className="cand-tr rq-row" data-selected={selected || undefined} style={{ height: 64, borderBottom: `1px solid ${t.line}` }}>
      {!readOnly && (
        <TableCell role="cell" className="cand-td cand-td-chk" style={{ width: 32, verticalAlign: "middle" }}>
          <Checkbox className="rq-chk" checked={selected} onCheckedChange={onToggleSelected} aria-label={`Select ${name}`} />
        </TableCell>
      )}
      <TableCell role="cell" className="cand-td cand-td-name" style={{ ...tdSortableStyle, maxWidth: 320 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <CandidateAvatar name={candidate.name} unlocked={candidate.unlocked} />
          <div style={{ minWidth: 0 }}>
            <Link
              href={`/employer/requirements/${requirementId}/candidates/${candidate.id}`}
              className="rq-link"
              style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500, fontSize: textSize.md, color: t.coal, textDecoration: "none" }}
            >
              {name}
            </Link>
            {candidateSubtitle(candidate) && (
              <div
                style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: textSize.base, color: t.inkFaint, marginTop: 2 }}
                title={candidateSubtitle(candidate)}
              >
                {candidateSubtitle(candidate)}
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
              {!candidate.unlocked && <IdentityHiddenBadge compact />}
              {response === "interested" && <Pill tone="success">Interested</Pill>}
              {response === "declined" && <Pill tone="neutral">Declined</Pill>}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell role="cell" className="cand-td" data-label="Match" style={tdSortableStyle}>
        <ScoreChip score={candidate.matchScore} />
      </TableCell>
      <TableCell role="cell" className="cand-td" data-label="Practice" style={{ ...tdSortableStyle, color: t.inkSoft }}>
        {candidate.rosterScore} avg score · {candidate.sessionsCompleted} {candidate.sessionsCompleted === 1 ? "session" : "sessions"}
      </TableCell>
      <TableCell role="cell" className="cand-td" data-label="Notice" style={{ ...tdStyle, color: t.inkSoft }}>
        {candidate.resume?.noticePeriod || dash}
      </TableCell>
      <TableCell role="cell" className="cand-td" data-label="CTC" style={{ ...tdStyle, color: t.inkSoft }}>
        {candidate.resume?.currentCtc ? (
          <>
            {candidate.resume.currentCtc}
            <div style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint, marginTop: 2 }}>self-reported</div>
          </>
        ) : (
          dash
        )}
      </TableCell>
      <TableCell role="cell" className="cand-td cand-td-skills" data-label="Skills" style={{ ...tdStyle, maxWidth: 220 }}>
        {candidate.skills.length ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {candidate.skills.slice(0, 3).map((s) => (
              <SkillTag key={s}>{s}</SkillTag>
            ))}
            {candidate.skills.length > 3 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${candidate.skills.length - 3} more skills: ${candidate.skills.slice(3).join(", ")}`}
                    className="rounded-md px-1 focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                    style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint, background: "transparent", border: "none", cursor: "default", outlineColor: t.indigo }}
                  >
                    +{candidate.skills.length - 3}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-64">
                  {candidate.skills.slice(3).join(", ")}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        ) : (
          dash
        )}
      </TableCell>
      <TableCell role="cell" className="cand-td" data-label="Pipeline" style={tdSortableStyle}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
          <CandidateStatusChip status={candidate.candidateStatus} />
          {substep && <span style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint }}>{substep}</span>}
        </div>
      </TableCell>
      <TableCell role="cell" className="cand-td cand-td-act" style={{ ...tdStyle, width: 48, textAlign: "right" }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${name}`}
              className="pointer-coarse:size-11"
              style={{ height: 36, width: 36, color: t.inkFaint }}
            >
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
            {!writeOff && canInviteToInterview(candidate.candidateStatus) && (
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
      </TableCell>
    </TableRow>
  );
}
