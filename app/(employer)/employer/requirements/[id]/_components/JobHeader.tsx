"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArchiveIcon, BriefcaseIcon, ChevronDownIcon, ClockIcon, HistoryIcon, IndianRupeeIcon, LayersIcon, MapPinIcon, PencilIcon, TrendingUpIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Requirement } from "@/employer/EmployerDataContext";
import { jobStatusPill, type JobStatusTone } from "@/employer/_jobDetailHelpers";
import { PanelButton } from "@/employer/_panelParts";
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

export interface MetaPart {
  icon: LucideIcon;
  text: string;
}

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
}: {
  requirement: Requirement;
  suspended: boolean;
  message: JobMessage | null;
  reopening: boolean;
  onReopen: () => void;
  onReload: () => void;
  expandedContent: ReactNode;
  requirementsSlot: ReactNode;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const closed = requirement.status === "closed";
  const status = jobStatusPill(requirement.status);
  const meta = metaParts(requirement);
  const description = requirement.description ?? "";
  const preview = previewText(description, DESCRIPTION_PREVIEW);
  const shownDescription = expanded || !preview.truncated ? description.trim() : `${preview.text.replace(/\n{2,}/g, "\n")}…`;

  return (
    <header className="min-w-0 rounded-xl border border-hx-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-80">
          <div className="flex items-center gap-3">
            <div aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-hx-indigo-100 text-hx-indigo">
              <BriefcaseIcon size={19} />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="m-0 text-[clamp(22px,5vw,26px)] leading-tight font-bold tracking-[-0.02em] text-hx-coal [overflow-wrap:anywhere]">
                {requirement.title}
              </h1>
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold", STATUS_TONE[status.tone])}>
                <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                {status.label}
              </span>
            </div>
          </div>
          {meta.length > 0 && (
            <p className="m-0 mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px] text-hx-coal max-sm:gap-x-3">
              {meta.map(({ icon: Icon, text }, i) => (
                <span key={text} className="inline-flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true" className="text-hx-ink-soft max-sm:hidden">·</span>}
                  <span className="inline-flex items-center gap-1.5">
                    <Icon size={15} aria-hidden="true" className="shrink-0 text-hx-ink-soft" />
                    {text}
                  </span>
                </span>
              ))}
            </p>
          )}
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
              <Button type="button" variant="outline" aria-label={`More actions for ${requirement.title}`} className="gap-1.5 pointer-coarse:h-11">
                More <ChevronDownIcon aria-hidden="true" />
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

      <div className={cn("mt-4 grid min-w-0 gap-x-8 gap-y-4 border-t border-hx-line pt-4 ", requirementsSlot && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]")}>
        <div className="min-w-0">
          {description && (
            <p className="m-0 max-w-[75ch] text-[14px] leading-relaxed whitespace-pre-line text-hx-ink-soft [overflow-wrap:anywhere]">
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
        </div>
        {requirementsSlot && <div className="min-w-0 lg:border-l lg:border-hx-line lg:pl-8">{requirementsSlot}</div>}
      </div>

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
