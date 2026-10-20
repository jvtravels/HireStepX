"use client";

import { useState } from "react";
import { DownloadIcon, KeyboardIcon, RefreshCwIcon, SlidersHorizontalIcon } from "lucide-react";
import { cn } from "cn";
import type { Sort } from "@/components/SortableHead";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CONTACT_FILTER_OPTIONS, SORT_OPTIONS, type ContactFilter, type SortColumn } from "./candidateTableModel";

const SECTION = "mb-2 text-[12px] font-semibold text-hx-ink-soft";
const OPTION = "flex min-h-8 cursor-pointer items-center gap-2 text-[14px] text-hx-coal pointer-coarse:min-h-11";
const ACTION = "h-auto min-h-8 w-full justify-start gap-2 px-2 text-[14px] font-medium text-hx-coal pointer-coarse:min-h-11";

/** Filters, sort, export and refresh in one place, so the sticky toolbar holds only the tabs and the search. */
export default function ViewMenu({
  contact,
  onContactChange,
  location,
  onLocationChange,
  locationOptions,
  sort,
  onSortChange,
  activeCount,
  unlockedCount,
  onExport,
  refreshing,
  onRefresh,
  onShowShortcuts,
}: {
  contact: ContactFilter;
  onContactChange: (v: ContactFilter) => void;
  location: string;
  onLocationChange: (v: string) => void;
  locationOptions: string[];
  sort: Sort<SortColumn>;
  onSortChange: (s: Sort<SortColumn>) => void;
  activeCount: number;
  unlockedCount: number;
  onExport: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  onShowShortcuts: () => void;
}) {
  const [open, setOpen] = useState(false);
  const sortValue = `${sort.column}-${sort.direction}`;
  const sortKnown = SORT_OPTIONS.some((s) => s.value === sortValue);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={activeCount > 0 ? `View options, ${activeCount} filter${activeCount === 1 ? "" : "s"} active` : "View options"}
          className="h-9 shrink-0 gap-2 rounded-lg bg-white px-3 text-[14px] font-medium text-hx-coal pointer-coarse:h-11"
        >
          <SlidersHorizontalIcon size={13} aria-hidden="true" />
          View
          {activeCount > 0 && (
            <span aria-hidden="true" className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-hx-indigo px-1 text-[12px] font-semibold text-white">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={16} className="max-h-[min(80vh,560px)] w-[min(300px,calc(100vw-32px))] gap-0 overflow-y-auto p-4">
        <div className="mb-4">
          <div id="view-sort-label" className={SECTION}>Sort by</div>
          <RadioGroup aria-labelledby="view-sort-label" value={sortKnown ? sortValue : ""} onValueChange={(v) => { const next = SORT_OPTIONS.find((s) => s.value === v); if (next) onSortChange(next.sort); }}>
            {SORT_OPTIONS.map((o) => (
              <label key={o.value} className={OPTION}>
                <RadioGroupItem value={o.value} />
                {o.label}
              </label>
            ))}
          </RadioGroup>
        </div>
        <div className="mb-4">
          <div id="view-contact-label" className={SECTION}>Contact</div>
          <RadioGroup aria-labelledby="view-contact-label" value={contact} onValueChange={(v) => onContactChange(v as ContactFilter)}>
            {CONTACT_FILTER_OPTIONS.map((o) => (
              <label key={o.value} className={OPTION}>
                <RadioGroupItem value={o.value} />
                {o.label}
              </label>
            ))}
          </RadioGroup>
        </div>
        {locationOptions.length > 1 && (
          <div className="mb-4">
            <div id="view-location-label" className={SECTION}>Location</div>
            <RadioGroup aria-labelledby="view-location-label" value={location} onValueChange={onLocationChange}>
              {[{ value: "all", label: "All locations" }, ...locationOptions.map((loc) => ({ value: loc, label: loc }))].map((o) => (
                <label key={o.value} className={OPTION}>
                  <RadioGroupItem value={o.value} />
                  {o.label}
                </label>
              ))}
            </RadioGroup>
          </div>
        )}
        <div className="flex flex-col gap-0.5 border-t border-hx-line pt-3">
          {unlockedCount > 0 && (
            <Button type="button" variant="ghost" className={ACTION} onClick={() => { onExport(); setOpen(false); }}>
              <DownloadIcon aria-hidden="true" /> Export {unlockedCount} unlocked as CSV
            </Button>
          )}
          <Button type="button" variant="ghost" className={ACTION} disabled={refreshing} onClick={onRefresh}>
            <RefreshCwIcon aria-hidden="true" className={cn(refreshing && "animate-spin motion-reduce:animate-none")} /> {refreshing ? "Refreshing candidates" : "Refresh candidates"}
          </Button>
          <Button type="button" variant="ghost" className={ACTION} onClick={() => { setOpen(false); onShowShortcuts(); }}>
            <KeyboardIcon aria-hidden="true" /> Keyboard shortcuts
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
