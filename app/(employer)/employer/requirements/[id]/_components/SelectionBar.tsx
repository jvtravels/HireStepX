"use client";

import { GitCompareArrowsIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BULK_COPY, canCompare, compareHint, selectionLimitHint, type BulkTarget } from "./shortlistSelection";

/** Sticks to the bottom of the shortlist while candidates are selected. Stage actions only show for an open job. */
export default function SelectionBar({
  count,
  offPage,
  canChangeStage,
  eligible,
  busy,
  onCompare,
  onBulk,
  onClear,
}: {
  count: number;
  /** Selected candidates that are on other pages of the current view. */
  offPage: number;
  canChangeStage: boolean;
  /** How many of the selected candidates each bulk move applies to. */
  eligible: Record<BulkTarget, number>;
  busy: boolean;
  onCompare: () => void;
  onBulk: (target: BulkTarget) => void;
  onClear: () => void;
}) {
  const hint = compareHint(count);
  const summary = `${count} selected${offPage > 0 ? `, ${offPage} on other pages` : ""}`;
  return (
    <>
    {/* Mounted before anything is selected so the first selection is announced, not just read on arrival. */}
    <div role="status" aria-live="polite" className="sr-only">{count > 0 ? `${summary}. ${selectionLimitHint(count)}` : ""}</div>
    {count > 0 && (
    <div
      role="region"
      aria-label="Selected candidates"
      className="sticky bottom-3 z-30 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-hx-line bg-white px-3 py-2"
    >
      <span className="text-[14px] font-semibold text-hx-coal tabular-nums">{summary}</span>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="lg" disabled={!canCompare(count) || busy} onClick={onCompare} className="pointer-coarse:h-11">
          <GitCompareArrowsIcon aria-hidden="true" /> Compare
        </Button>
        {canChangeStage &&
          (Object.keys(BULK_COPY) as BulkTarget[]).map((target) => (
            <Button
              key={target}
              type="button"
              variant="outline"
              size="lg"
              disabled={eligible[target] === 0 || busy}
              onClick={() => onBulk(target)}
              className="pointer-coarse:h-11"
            >
              {BULK_COPY[target].action}
            </Button>
          ))}
        <Button type="button" variant="ghost" size="lg" onClick={onClear} disabled={busy} className="pointer-coarse:h-11">
          <XIcon aria-hidden="true" /> Clear
        </Button>
      </div>
      <span className="text-[13px] text-hx-ink-soft">{[hint, selectionLimitHint(count)].filter(Boolean).join(" ")}</span>
    </div>
    )}
    </>
  );
}
