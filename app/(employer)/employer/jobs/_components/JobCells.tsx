"use client";

import { InfoIcon, XIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge, type BadgeTone } from "@/employer/_atoms";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { daysUntil } from "./jobsHelpers";

/* Info "i" next to a column header. The visible target is small to keep the
   header compact, but coarse pointers (touch) get a full 44px hit area. */
export function HeadInfo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          className="pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center"
          style={{ display: "inline-flex", alignItems: "center", color: t.inkSoft, background: "transparent", border: "none", cursor: "pointer", padding: 8, margin: -6 }}
        >
          <InfoIcon size={12} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

export function DueCell({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) {
    return (
      <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft }}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">No due date</span>
      </span>
    );
  }
  const left = daysUntil(dueDate);
  const tone: BadgeTone = left < 0 ? "error" : left <= 7 ? "warning" : "neutral";
  const label = left < 0 ? `${Math.abs(left)}d overdue` : left === 0 ? "Due today" : `${left}d left`;
  return (
    <div>
      <div style={{ fontFamily: f.sans, fontSize: textSize.md, fontWeight: 500, color: t.coal }}>{dueDate}</div>
      <div style={{ marginTop: 4, width: "fit-content" }}>
        <Badge tone={tone}>{label}</Badge>
      </div>
    </div>
  );
}

export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 6px 4px 10px", borderRadius: 999, background: t.rowTint, fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.coal }}>
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        className="box-content flex size-4 -m-1.5 items-center justify-center rounded-full border-0 bg-transparent p-1.5 pointer-coarse:size-8 pointer-coarse:-m-3.5"
        style={{ color: t.inkSoft, cursor: "pointer" }}
      >
        <XIcon size={11} aria-hidden="true" />
      </button>
    </span>
  );
}
