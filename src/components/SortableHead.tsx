"use client";

/* Shared per-column click-to-sort table header — used by SessionsV2.tsx
   and DashboardJobs.tsx so both tables offer identical sort UX/styling
   instead of each hand-rolling its own header treatment. */

import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { tokens as T, fonts as F } from "@/auth/_tokens";
import { dur, ease } from "@/_motion";

export type SortDirection = "asc" | "desc";
export type Sort<C extends string> = { column: C; direction: SortDirection };

export function SortableHead<C extends string>({
  column,
  columnLabel,
  width,
  minWidth,
  sort,
  onSortChange,
  defaultDirection = "desc",
  after,
  children,
}: {
  column: C;
  columnLabel: string;
  width?: number | string;
  minWidth?: number;
  sort: Sort<C>;
  onSortChange: (sort: Sort<C>) => void;
  /* Direction a column starts in the first time it's clicked — text
     columns read naturally ascending, numeric/date columns descending. */
  defaultDirection?: SortDirection;
  /* Extra content (e.g. an info-tooltip trigger) rendered after the sort
     button, outside it, so it doesn't also trigger a sort on click. */
  after?: React.ReactNode;
  children: React.ReactNode;
}) {
  const active = sort.column === column;
  const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
  return (
    <TableHead aria-sort={ariaSort} style={{ width, minWidth, fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: T.inkSoft, padding: 0 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => onSortChange({ column, direction: active && sort.direction === "asc" ? "desc" : active ? "asc" : defaultDirection })}
          aria-label={`Sort by ${columnLabel}${active ? `, currently ${sort.direction === "asc" ? "ascending" : "descending"}` : ""}`}
          style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, height: 40, padding: "0 20px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", fontWeight: "inherit", color: active ? T.coal : "inherit", transition: `background ${dur.instant} ${ease.snap}` }}
          onMouseEnter={(e) => { e.currentTarget.style.background = T.rowTint; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          {children}
          {active ? (
            sort.direction === "asc" ? <ChevronUpIcon size={14} aria-hidden="true" /> : <ChevronDownIcon size={14} aria-hidden="true" />
          ) : (
            <ChevronsUpDownIcon size={14} color={T.inkSoft} aria-hidden="true" />
          )}
        </button>
        {after && <span style={{ paddingRight: 12, display: "flex", alignItems: "center" }}>{after}</span>}
      </div>
    </TableHead>
  );
}
