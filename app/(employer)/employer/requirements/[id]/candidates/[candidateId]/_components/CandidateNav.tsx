"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, ClipboardCopyIcon, LinkIcon, Share2Icon } from "lucide-react";
import { cn } from "cn";
import type { Candidate } from "@/employer/mockData";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CandidateStatusChip } from "@/employer/_atoms";
import { maskedName, type ShortlistPosition } from "./helpers";

const STEP = "inline-flex size-7 items-center justify-center rounded-lg border border-hx-line bg-white text-hx-coal pointer-coarse:size-11";

function Step({ href, label, shortcut, children }: { href: string | null; label: string; shortcut: string; children: ReactNode }) {
  if (!href) {
    return (
      <span role="img" aria-label={`${label} (none)`} className={cn(STEP, "opacity-40")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} title={`${label} (${shortcut.toUpperCase()})`} aria-keyshortcuts={shortcut} className={cn(STEP, "hover:bg-hx-row focus-visible:outline-2 focus-visible:outline-offset-2")}>
      <span className="sr-only">{label}</span>
      {children}
    </Link>
  );
}

/** Previous/next through the shortlist, compare and share. Sticks to the top; once the header card scrolls away it also carries who you are looking at and the next step. */
export function CandidateNav({
  candidate,
  shortlist,
  hrefFor,
  others,
  onCompare,
  onCopyLink,
  onCopySummary,
  condensed,
  action,
}: {
  candidate: Candidate;
  shortlist: ShortlistPosition;
  hrefFor: (c: Candidate) => string;
  others: Candidate[];
  onCompare: (otherId: string) => void;
  onCopyLink: () => void;
  onCopySummary: () => void;
  condensed: boolean;
  action: ReactNode;
}) {
  return (
    <nav
      aria-label="Shortlist navigation"
      className={cn(
        "sticky top-0 z-20 flex min-h-12 min-w-0 items-center gap-3 border-b border-hx-line bg-white px-5 py-1.5",
        condensed && "shadow-[0_1px_0_0_var(--hx-line,rgba(0,0,0,0.06))]",
      )}
    >
      {shortlist.total > 1 && (
      <div className="flex shrink-0 items-center gap-1.5">
        <Step href={shortlist.prev ? hrefFor(shortlist.prev) : null} label="Previous candidate" shortcut="k">
          <ChevronLeftIcon size={16} aria-hidden="true" />
        </Step>
        <Step href={shortlist.next ? hrefFor(shortlist.next) : null} label="Next candidate" shortcut="j">
          <ChevronRightIcon size={16} aria-hidden="true" />
        </Step>
        <span className="ml-1 text-[13px] whitespace-nowrap text-hx-ink-soft tabular-nums">
          {shortlist.position} of {shortlist.total}
          <span className="max-sm:hidden"> by match</span>
        </span>
      </div>
      )}

      {condensed && (
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="truncate text-[14px] font-semibold text-hx-coal">{maskedName(candidate)}</span>
          <span className="text-[13px] text-hx-ink-soft tabular-nums max-sm:hidden">{candidate.matchScore} match</span>
          <span className="max-md:hidden"><CandidateStatusChip status={candidate.candidateStatus} /></span>
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {others.length > 0 && !condensed && (
          <Select value="" onValueChange={(v) => v && onCompare(v)}>
            <SelectTrigger size="sm" aria-label="Compare with another candidate" className="border-hx-line bg-white text-sm max-sm:hidden">
              <SelectValue placeholder="Compare with…" />
            </SelectTrigger>
            <SelectContent align="end">
              {others.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {maskedName(o)} ({o.matchScore})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-1.5 text-[13px] pointer-coarse:h-11">
              <Share2Icon size={14} aria-hidden="true" />
              Share
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuItem onSelect={onCopyLink}>
              <LinkIcon aria-hidden="true" />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onCopySummary}>
              <ClipboardCopyIcon aria-hidden="true" />
              Copy summary
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="grid gap-1.5 text-[12px] font-normal text-hx-ink-soft">
              {shortlist.total > 1 && <span className="flex items-center justify-between gap-4">Next or previous <span className="flex gap-1"><Kbd>J</Kbd><Kbd>K</Kbd></span></span>}
              <span className="flex items-center justify-between gap-4">Switch tab <span className="flex gap-1"><Kbd>1</Kbd><Kbd>2</Kbd><Kbd>3</Kbd></span></span>
            </DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
        {condensed && action}
      </div>
    </nav>
  );
}
