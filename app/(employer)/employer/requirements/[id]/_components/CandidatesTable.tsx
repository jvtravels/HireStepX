"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { SortableHead, type Sort } from "@/components/SortableHead";
import { TablePaginationFooter } from "@/components/TablePaginationFooter";
import { Table, TableBody, TableCaption, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InfoTip } from "@/employer/_panelParts";
import type { Candidate, CandidateStatus } from "@/employer/mockData";
import CandidateRow from "./CandidateRow";
import { CAND_TABLE_CSS } from "./candidateTableStyles";
import { COLUMN_LABEL, SORT_OPTIONS, type SortColumn } from "./candidateTableModel";

/* Below 768px the column headers are hidden, so sorting moves to this select. */
const PLAIN_HEAD = "h-10 px-3 text-[13px] font-semibold text-hx-ink-soft";

export default function CandidatesTable({
  rows,
  requirementId,
  requiredSkills,
  readOnly,
  suspended,
  sort,
  onSortChange,
  onUnlock,
  onViewEvidence,
  onMessage,
  onStageChange,
  selectedIds,
  onSelectedChange,
  activeId,
  totalCount,
  filteredCount,
  rowsPerPage,
  onRowsPerPageChange,
  page,
  totalPages,
  onPageChange,
}: {
  rows: Candidate[];
  requirementId: string;
  requiredSkills: string[];
  readOnly: boolean;
  suspended: boolean;
  sort: Sort<SortColumn>;
  onSortChange: (s: Sort<SortColumn>) => void;
  onUnlock: (c: Candidate) => void;
  onViewEvidence: (c: Candidate) => void;
  onMessage: (c: Candidate) => void;
  onStageChange: (c: Candidate, status: CandidateStatus) => void;
  selectedIds: ReadonlySet<string>;
  onSelectedChange: (c: Candidate, checked: boolean) => void;
  activeId: string | null;
  totalCount: number;
  filteredCount: number;
  rowsPerPage: number;
  onRowsPerPageChange: (n: number) => void;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [moreRight, setMoreRight] = useState(false);

  /* When the table is narrower than its columns the Stage column sits past the fold; the fade next to the
     pinned Actions column tells the employer there is more to scroll to. */
  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (el) setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, rows.length]);

  const mobileValue = `${sort.column}-${sort.direction}`;
  const mobileKnown = SORT_OPTIONS.some((s) => s.value === mobileValue);

  return (
    <>
      <div className="mb-3 md:hidden">
        <label htmlFor="cand-mobile-sort" className="mb-1 block text-[13px] text-hx-ink-soft">
          Sort candidates
        </label>
        <select
          id="cand-mobile-sort"
          value={mobileKnown ? mobileValue : "match-desc"}
          onChange={(e) => {
            const next = SORT_OPTIONS.find((s) => s.value === e.target.value);
            if (next) onSortChange(next.sort);
          }}
          className="min-h-11 w-full rounded-lg border border-hx-line bg-white px-3 text-[14px] text-hx-coal"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="cand-shell flex flex-none flex-col overflow-clip rounded-xl border border-hx-line bg-white">
        <div className="relative">
        <div
          ref={scrollRef}
          onScroll={measure}
          role="region"
          aria-label="Candidates table. Scroll sideways to see more columns."
          // Keyboard users can only scroll an overflow region they can focus.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="cand-scroll flex-none overflow-x-auto min-[1240px]:overflow-x-clip focus-visible:outline-2 focus-visible:-outline-offset-2"
        >
          <style>{CAND_TABLE_CSS}</style>
          <Table role="table" className="cand-table min-w-[860px]" containerClassName="overflow-visible">
            <TableCaption className="sr-only">
              Candidates for this job, {filteredCount} shown. Each row has a checkbox to select it. Column headers are buttons that sort the table.
            </TableCaption>
            <TableHeader className="cand-thead">
              <TableRow className="h-10 bg-hx-row">
                <SortableHead inset={12} column="name" columnLabel={COLUMN_LABEL.name} defaultDirection="asc" width="29%" minWidth={200} sort={sort} onSortChange={onSortChange}>
                  Candidate
                </SortableHead>
                <SortableHead
                  inset={12}
                  column="match"
                  columnLabel={COLUMN_LABEL.match}
                  width="25%"
                  minWidth={160}
                  sort={sort}
                  onSortChange={onSortChange}
                  after={<InfoTip label="About Role match">The overall match score out of 100, which weighs skills, role and location. Below it, how many of this job's required skills the candidate lists, and which ones are missing. They may still have a missing skill, so confirm it in the interview.</InfoTip>}
                >
                  Role match
                </SortableHead>
                <TableHead className={`${PLAIN_HEAD} w-[13%] min-w-[120px]`}>
                  <span className="inline-flex items-center gap-0.5">
                    Availability
                    <InfoTip label="About Availability">The candidate's own notice period, as written on their resume. We show their words when we can't read a number.</InfoTip>
                  </span>
                </TableHead>
                <SortableHead
                  inset={12}
                  column="interview"
                  columnLabel={COLUMN_LABEL.interview}
                  width="17%"
                  minWidth={150}
                  sort={sort}
                  onSortChange={onSortChange}
                  after={<InfoTip label="About Evidence">The average score from graded HireStepX mock interviews, out of 100, and how many interviews it comes from. Below it, the other sources on file: resume, GitHub and portfolio links. Interview scores measure practice performance and are separate from the role match. Select a row's evidence to see the per-skill report.</InfoTip>}
                >
                  Evidence
                </SortableHead>
                <SortableHead
                  inset={12}
                  column="pipeline"
                  columnLabel={COLUMN_LABEL.pipeline}
                  defaultDirection="asc"
                  width="16%"
                  minWidth={130}
                  sort={sort}
                  onSortChange={onSortChange}
                  after={<InfoTip label="About Stage">Where this candidate currently stands in your hiring process for this job.</InfoTip>}
                >
                  Stage
                </SortableHead>
                <TableHead className="cand-th-act w-px whitespace-nowrap px-2">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody role="rowgroup" className="mx-stagger">
              {rows.map((c) => (
                <CandidateRow
                  key={c.id}
                  candidate={c}
                  requirementId={requirementId}
                  requiredSkills={requiredSkills}
                  readOnly={readOnly}
                  suspended={suspended}
                  onUnlock={() => onUnlock(c)}
                  onViewEvidence={() => onViewEvidence(c)}
                  onMessage={() => onMessage(c)}
                  onStageChange={(status) => onStageChange(c, status)}
                  selected={selectedIds.has(c.id)}
                  onSelectedChange={(checked) => onSelectedChange(c, checked)}
                  active={activeId === c.id}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 right-24 hidden w-12 bg-[linear-gradient(to_left,var(--color-white),transparent)] transition-opacity duration-200 ease-out motion-reduce:transition-none md:block",
            moreRight ? "opacity-100" : "opacity-0",
          )}
        />
        </div>
        <TablePaginationFooter
          entityLabel="candidate"
          entityLabelPlural="candidates"
          totalCount={totalCount}
          filteredCount={filteredCount}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={onRowsPerPageChange}
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </div>
    </>
  );
}
