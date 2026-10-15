"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { SortableHead, type Sort } from "@/components/SortableHead";
import { TablePaginationFooter } from "@/components/TablePaginationFooter";
import { Table, TableBody, TableCaption, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InfoTip } from "@/employer/_panelParts";
import type { Candidate } from "@/employer/mockData";
import CandidateRow from "./CandidateRow";
import { CAND_TABLE_CSS } from "./candidateTableStyles";
import { COLUMN_LABEL, type SortColumn } from "./candidateTableModel";

/* Below 768px the column headers are hidden, so sorting moves to this select. */
const MOBILE_SORTS: Array<{ value: string; label: string; sort: Sort<SortColumn> }> = [
  { value: "match-desc", label: "Best match first", sort: { column: "match", direction: "desc" } },
  { value: "match-asc", label: "Lowest match first", sort: { column: "match", direction: "asc" } },
  { value: "name-asc", label: "Candidate A to Z", sort: { column: "name", direction: "asc" } },
  { value: "experience-desc", label: "Most experience", sort: { column: "experience", direction: "desc" } },
  { value: "interview-desc", label: "Highest interview score", sort: { column: "interview", direction: "desc" } },
  { value: "pipeline-asc", label: "Stage: earliest first", sort: { column: "pipeline", direction: "asc" } },
];

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
  onInvite,
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
  onInvite: (c: Candidate) => void;
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

  /* Below ~1400px the Stage column sits past the fold; the fade next to the
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
  const mobileKnown = MOBILE_SORTS.some((s) => s.value === mobileValue);

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
            const next = MOBILE_SORTS.find((s) => s.value === e.target.value);
            if (next) onSortChange(next.sort);
          }}
          className="min-h-11 w-full rounded-lg border border-hx-line bg-white px-3 text-[14px] text-hx-coal"
        >
          {MOBILE_SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="cand-shell flex flex-none flex-col overflow-hidden rounded-xl border border-hx-line bg-white">
        <div className="relative">
        <div
          ref={scrollRef}
          onScroll={measure}
          role="region"
          aria-label="Candidates table. Scroll sideways to see more columns."
          // Keyboard users can only scroll an overflow region they can focus.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="cand-scroll flex-none overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-hx-indigo"
        >
          <style>{CAND_TABLE_CSS}</style>
          <Table role="table" className="cand-table min-w-[880px]" containerClassName="overflow-visible">
            <TableCaption className="sr-only">
              Candidates for this requirement, {filteredCount} shown. Column headers are buttons that sort the table.
            </TableCaption>
            <TableHeader className="cand-thead">
              <TableRow className="h-10 bg-hx-row">
                <SortableHead column="name" columnLabel={COLUMN_LABEL.name} defaultDirection="asc" width="22%" minWidth={200} sort={sort} onSortChange={onSortChange}>
                  Candidate
                </SortableHead>
                <SortableHead
                  column="match"
                  columnLabel={COLUMN_LABEL.match}
                  width="14%"
                  minWidth={120}
                  sort={sort}
                  onSortChange={onSortChange}
                  after={<InfoTip label="About Role match">How well the candidate fits this job. Shows required skills from this posting that the candidate lists. Sorting uses the overall match score, out of 100, which also weighs role and location fit.</InfoTip>}
                >
                  Role match
                </SortableHead>
                <TableHead className={`${PLAIN_HEAD} w-[13%] min-w-[110px]`}>
                  <span className="inline-flex items-center gap-0.5">
                    Key gaps
                    <InfoTip label="About Key gaps">Required skills the candidate has not listed. They may still have them, so confirm in the interview.</InfoTip>
                  </span>
                </TableHead>
                <SortableHead column="experience" columnLabel={COLUMN_LABEL.experience} width="9%" minWidth={96} sort={sort} onSortChange={onSortChange}>
                  Experience
                </SortableHead>
                <TableHead className={`${PLAIN_HEAD} w-[11%] min-w-[120px]`}>
                  <span className="inline-flex items-center gap-0.5">
                    Availability
                    <InfoTip label="About Availability">The candidate's own notice period, as written on their resume. We show their words when we can't read a number.</InfoTip>
                  </span>
                </TableHead>
                <SortableHead
                  column="interview"
                  columnLabel={COLUMN_LABEL.interview}
                  width="12%"
                  minWidth={120}
                  sort={sort}
                  onSortChange={onSortChange}
                  after={<InfoTip label="About Evidence">What backs the profile: resume, graded HireStepX mock interviews and shared portfolio or GitHub links. Sorting uses the average interview score, out of 100, which is practice performance and separate from the resume match. Select a row's evidence to see the per-skill report.</InfoTip>}
                >
                  Evidence
                </SortableHead>
                <SortableHead
                  column="pipeline"
                  columnLabel={COLUMN_LABEL.pipeline}
                  defaultDirection="asc"
                  width="11%"
                  minWidth={120}
                  sort={sort}
                  onSortChange={onSortChange}
                  after={<InfoTip label="About Stage">Where this candidate currently stands in your hiring process for this requirement.</InfoTip>}
                >
                  Stage
                </SortableHead>
                <TableHead className="cand-th-act w-16 min-w-16">
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
                  onInvite={() => onInvite(c)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 right-16 hidden w-12 bg-[linear-gradient(to_left,var(--color-white),transparent)] transition-opacity duration-200 ease-out motion-reduce:transition-none md:block",
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
