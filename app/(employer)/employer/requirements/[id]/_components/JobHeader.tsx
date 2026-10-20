"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArchiveIcon, ChevronDownIcon, ClockIcon, HistoryIcon, IndianRupeeIcon, LayersIcon, MapPinIcon, MoreVerticalIcon, PencilIcon, TrendingUpIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Requirement } from "@/employer/EmployerDataContext";
import { jobStatusPill, type JobStatusTone } from "@/employer/_jobDetailHelpers";
import { MetaLine, PanelButton, type MetaPart } from "@/employer/_panelParts";
import { InlineNotice } from "@/employer/_requirementAtoms";
import { EMPLOYMENT_TYPE_LABEL, WORK_MODE_LABEL } from "@/hiringMatchFormat";
import { ArchiveDialog, UnlockHistoryDialog } from "./JobDialogs";
import { budgetLabel, experienceLabel, previewText, whereLabel } from "./requirementFormat";
import type { JobMessage } from "./useJobActions";

const DESCRIPTION_PREVIEW = 420;

const STATUS_TONE: Record<JobStatusTone, string> = {
  success: "bg-hx-success-100 text-hx-success-ink",
  info: "bg-hx-info-100 text-hx-info",
  neutral: "bg-hx-soft text-hx-neutral-ink",
  warning: "bg-hx-warning-100 text-hx-warning-ink",
  error: "bg-hx-error-100 text-hx-error-ink",
};

export function metaParts(r: Requirement): MetaPart[] {
  const place = r.locations.length > 0 ? r.locations.join(", ") : r.location;
  const mode = r.workMode ? WORK_MODE_LABEL[r.workMode] || r.workMode : null;
  const type = r.employmentType ? EMPLOYMENT_TYPE_LABEL[r.employmentType] || r.employmentType : null;
  const where = whereLabel(place, mode);
  const experience = experienceLabel(r.experienceMin, r.experienceMax)?.replace(" experience", "");
  const parts: Array<[LucideIcon, string | null | undefined]> = [
    [MapPinIcon, where],
    [ClockIcon, type],
    [LayersIcon, r.department],
    [TrendingUpIcon, experience],
    [IndianRupeeIcon, budgetLabel(r)],
  ];
  return parts.filter((p): p is [LucideIcon, string] => !!p[1]).map(([icon, text]) => ({ icon, text }));
}

export default function JobHeader({
  requirement,
  suspended,
  message,
  reopening,
  onReopen,
  onReload,
  expandedContent,
  requirementsSlot,
  insightsSlot,
}: {
  requirement: Requirement;
  suspended: boolean;
  message: JobMessage | null;
  reopening: boolean;
  onReopen: () => void;
  onReload: () => void;
  expandedContent: ReactNode;
  requirementsSlot: ReactNode;
  insightsSlot?: ReactNode;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const closed = requirement.status === "closed";
  const status = jobStatusPill(requirement.status);
  const meta = metaParts(requirement);
  const description = requirement.description ?? "";
  const responsibilities = requirement.responsibilities?.trim() ?? "";
  const preview = previewText(description, DESCRIPTION_PREVIEW);
  const shownDescription = expanded || !preview.truncated ? description.trim() : `${preview.text.replace(/\n{2,}/g, "\n")}…`;

  return (
    <header className="flex min-w-0 flex-col px-7 py-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-80">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="m-0 text-[20px] leading-tight font-semibold text-hx-coal [overflow-wrap:anywhere]">
              {requirement.title}
            </h1>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold", STATUS_TONE[status.tone])}>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
              {status.label}
            </span>
          </div>
          <MetaLine parts={meta} className="mt-3" />
        </div>

        <div className="flex items-center gap-2">
          {closed && (
            <Button type="button" variant="outline" onClick={onReopen} disabled={reopening || suspended} className="pointer-coarse:h-11">
              {reopening ? "Reopening…" : "Reopen"}
            </Button>
          )}
          {!closed &&
            (suspended ? (
              <Button type="button" variant="outline" disabled className="gap-1.5">
                <PencilIcon aria-hidden="true" /> Edit job
              </Button>
            ) : (
              <Button asChild variant="outline" className="gap-1.5 pointer-coarse:h-11">
                <Link href={`/employer/requirements/${requirement.id}/edit`}>
                  <PencilIcon aria-hidden="true" /> Edit job
                </Link>
              </Button>
            ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label={`More actions for ${requirement.title}`} className="text-hx-ink-soft pointer-coarse:size-11">
                <MoreVerticalIcon size={16} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                <HistoryIcon size={14} aria-hidden="true" /> Unlock history
              </DropdownMenuItem>
              {!closed && (
                <DropdownMenuItem
                  disabled={suspended}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive"
                  onSelect={() => setArchiveOpen(true)}
                >
                  <ArchiveIcon size={14} aria-hidden="true" /> Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        className={cn(
          "mt-4 grid min-w-0 content-start gap-x-8 gap-y-5 border-t border-hx-line pt-4",
          requirementsSlot && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]",
        )}
      >
        <div className="min-w-0">
          {description && (
            <p className="m-0 max-w-[75ch] text-[13.5px] leading-relaxed whitespace-pre-line text-hx-ink-soft [overflow-wrap:anywhere]">
              {shownDescription}
              {preview.truncated && (
                <>
                  {" "}
                  <PanelButton expanded={expanded} onClick={() => setExpanded((v) => !v)}>
                    {expanded ? "View less" : "View more"}
                  </PanelButton>
                </>
              )}
            </p>
          )}
          {responsibilities && (
            <div className={cn(description && "mt-4")}>
              <h2 className="m-0 mb-1.5 text-[13px] font-semibold text-hx-coal">Responsibilities</h2>
              <p className="m-0 max-w-[75ch] text-[13.5px] leading-relaxed whitespace-pre-line text-hx-ink-soft [overflow-wrap:anywhere]">{responsibilities}</p>
            </div>
          )}
        </div>
        {requirementsSlot && <div className="min-w-0 lg:border-l lg:border-hx-line lg:pl-8">{requirementsSlot}</div>}
      </div>

      {insightsSlot && <div className="mt-4 border-t border-hx-line pt-4">{insightsSlot}</div>}

      {expandedContent != null && (
        <div className="mt-4 border-t border-hx-line pt-3">
          <h2 className="m-0">
            <PanelButton expanded={detailsOpen} controls="job-role-details" onClick={() => setDetailsOpen((v) => !v)}>
              Role details
              <ChevronDownIcon size={15} aria-hidden="true" className={cn("transition-transform duration-150 motion-reduce:transition-none", detailsOpen && "rotate-180")} />
            </PanelButton>
          </h2>
          {detailsOpen && (
            <div id="job-role-details" className="mt-3">
              {expandedContent}
            </div>
          )}
        </div>
      )}

      {message && (
        <div className="mt-4">
          <InlineNotice tone={message.tone}>{message.text}</InlineNotice>
        </div>
      )}

      <ArchiveDialog open={archiveOpen} onOpenChange={setArchiveOpen} requirement={requirement} onArchived={onReload} />
      <UnlockHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} requirement={requirement} />
    </header>
  );
}
