"use client";

import { useRouter } from "next/navigation";
import { MoreVerticalIcon, PencilIcon, ArchiveIcon, ArchiveRestoreIcon, HistoryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RequirementSummary } from "@/employer/mockData";
import { tokens as t } from "@/auth/_tokens";

export default function JobRowActions({
  requirement: r, readOnly, onArchive, onHistory,
}: {
  requirement: RequirementSummary;
  /** Suspended accounts can read but not change jobs (server returns 403). */
  readOnly: boolean;
  onArchive: (r: RequirementSummary) => void;
  onHistory: (r: RequirementSummary) => void;
}) {
  const router = useRouter();
  const isClosed = r.status === "closed";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${r.title}`} className="size-10 pointer-coarse:size-11" style={{ color: t.inkSoft }}>
          <MoreVerticalIcon size={16} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem disabled={isClosed || readOnly} onSelect={() => router.push(`/employer/requirements/${r.id}/edit`)}>
          <PencilIcon className="size-4" aria-hidden="true" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem disabled={readOnly} onSelect={() => onArchive(r)}>
          {isClosed ? (
            <>
              <ArchiveRestoreIcon className="size-4" aria-hidden="true" /> Reopen
            </>
          ) : (
            <>
              <ArchiveIcon className="size-4" aria-hidden="true" /> Archive
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onHistory(r)}>
          <HistoryIcon className="size-4" aria-hidden="true" /> History
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
