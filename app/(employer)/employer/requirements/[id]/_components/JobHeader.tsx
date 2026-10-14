"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArchiveIcon, BriefcaseIcon, ChevronDownIcon, HistoryIcon, PencilIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Requirement } from "@/employer/EmployerDataContext";
import { jobStatusPill, type JobStatusTone } from "@/employer/_jobDetailHelpers";
import { PanelButton } from "@/employer/_panelParts";
import { InlineNotice } from "@/employer/_requirementAtoms";
import { EMPLOYMENT_TYPE_LABEL, WORK_MODE_LABEL } from "@/hiringMatchFormat";
import { ArchiveDialog, UnlockHistoryDialog } from "./JobDialogs";
import type { JobMessage } from "./useJobActions";

const DESCRIPTION_PREVIEW = 240;

const STATUS_TONE: Record<JobStatusTone, string> = {
  success: "bg-hx-success-100 text-hx-success-ink",
  info: "bg-hx-info-100 text-hx-info",
  neutral: "bg-hx-soft text-hx-neutral-ink",
  warning: "bg-hx-warning-100 text-hx-warning-ink",
  error: "bg-hx-error-100 text-hx-error-ink",
};

export function metaParts(r: Requirement): string[] {
  const place = r.locations.length > 0 ? r.locations.join(", ") : r.location;
  const mode = r.workMode ? WORK_MODE_LABEL[r.workMode] || r.workMode : null;
  const type = r.employmentType ? EMPLOYMENT_TYPE_LABEL[r.employmentType] || r.employmentType : null;
  const where = place && mode ? `${mode} (${place})` : place || mode;
  return [where, type, r.department].filter((p): p is string => !!p);
}

export default function JobHeader({
  requirement,
  suspended,
  message,
  reopening,
  onReopen,
  onReload,
  expandedContent,
}: {
  requirement: Requirement;
  suspended: boolean;
  message: JobMessage | null;
  reopening: boolean;
  onReopen: () => void;
  onReload: () => void;
  expandedContent: ReactNode;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const closed = requirement.status === "closed";
  const status = jobStatusPill(requirement.status);
  const meta = metaParts(requirement);
  const description = requirement.description ?? "";
  const long = description.length > DESCRIPTION_PREVIEW;
  const hasMore = long || expandedContent != null;
  const shownDescription = expanded || !long ? description : `${description.slice(0, DESCRIPTION_PREVIEW).trimEnd()}…`;

  return (
    <header>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-80 items-start gap-3.5">
          <div aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-hx-indigo-100 text-hx-indigo">
            <BriefcaseIcon size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="m-0 text-[clamp(22px,5vw,26px)] leading-tight font-bold tracking-[-0.02em] text-hx-coal [overflow-wrap:anywhere]">
                {requirement.title}
              </h1>
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold", STATUS_TONE[status.tone])}>
                <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                {status.label}
              </span>
            </div>
            {meta.length > 0 && (
              <p className="m-0 mt-1.5 flex flex-wrap items-center gap-x-2 text-[14px] text-hx-ink-soft">
                {meta.map((part, i) => (
                  <span key={part} className="inline-flex items-center gap-2">
                    {i > 0 && <span aria-hidden="true">·</span>}
                    {part}
                  </span>
                ))}
              </p>
            )}
          </div>
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

      {description && (
        <p className="m-0 mt-4 max-w-[75ch] text-[14px] leading-relaxed text-hx-ink-soft [overflow-wrap:anywhere]">
          {shownDescription}
          {hasMore && (
            <>
              {" "}
              <PanelButton expanded={expanded} onClick={() => setExpanded((v) => !v)}>
                {expanded ? "View less" : "View more"}
              </PanelButton>
            </>
          )}
        </p>
      )}
      {!description && hasMore && (
        <div className="mt-3">
          <PanelButton expanded={expanded} onClick={() => setExpanded((v) => !v)}>
            {expanded ? "View less" : "View role details"}
          </PanelButton>
        </div>
      )}

      {expanded && expandedContent}

      {message && (
        <div className="mt-3">
          <InlineNotice tone={message.tone}>{message.text}</InlineNotice>
        </div>
      )}

      <ArchiveDialog open={archiveOpen} onOpenChange={setArchiveOpen} requirement={requirement} onArchived={onReload} />
      <UnlockHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} requirement={requirement} />
    </header>
  );
}
