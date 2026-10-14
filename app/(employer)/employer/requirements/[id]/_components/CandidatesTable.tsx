"use client";

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
  { value: "pipeline-asc", label: "Stage: earliest first", sort: { column: "pipeline", direction: "asc" } },
];

const PLAIN_HEAD = "h-10 px-3 text-[13px] font-semibold text-hx-ink-soft";

export default function CandidatesTable({
  rows,
  requirementId,
  requiredSkills,
  readOnly,
  suspended,
  selectedIds,
  onToggleSelected,
  onToggleAll,
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
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onToggleAll: (ids: string[], select: boolean) => void;
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
  const mobileValue = `${sort.column}-${sort.direction}`;
  const mobileKnown = MOBILE_SORTS.some((s) => s.value === mobileValue);
  const selectedOnPage = rows.filter((r) => selectedIds.has(r.id)).length;
  const allSelected = rows.length > 0 && selectedOnPage === rows.length;
  const someSelected = selectedOnPage > 0 && !allSelected;

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
        <div className="cand-scroll flex-none overflow-x-auto">
          <style>{CAND_TABLE_CSS}</style>
          <Table role="table" className="cand-table min-w-[1120px]" containerClassName="overflow-visible">
            <TableCaption className="sr-only">
              Candidates for this requirement, {filteredCount} shown. Column headers are buttons that sort the table.
            </TableCaption>
            <TableHeader className="cand-thead">
              <TableRow className="h-10 bg-hx-row">
                {!readOnly && (
                  <TableHead className="w-10 pr-0 pl-4">
                    <input
                      type="checkbox"
                      aria-label="Select all candidates on this page"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={() => onToggleAll(rows.map((r) => r.id), !allSelected)}
                      className="size-4 cursor-pointer accent-hx-indigo pointer-coarse:size-5"
                    />
                  </TableHead>
                )}
                <SortableHead column="name" columnLabel={COLUMN_LABEL.name} defaultDirection="asc" width="24%" minWidth={250} sort={sort} onSortChange={onSortChange}>
                  Candidate
                </SortableHead>
                <SortableHead
                  column="match"
                  columnLabel={COLUMN_LABEL.match}
                  width="15%"
                  minWidth={170}
                  sort={sort}
                  onSortChange={onSortChange}
                  after={<InfoTip label="About Role match">Required skills from this posting that the candidate lists. Sorting uses the overall match score, out of 100, which also weighs role and location fit.</InfoTip>}
                >
                  Role match for this job
                </SortableHead>
                <TableHead className={`${PLAIN_HEAD} w-[14%] min-w-40`}>
                  <span className="inline-flex items-center gap-0.5">
                    Key gaps (validate)
                    <InfoTip label="About Key gaps">Required skills the candidate has not listed. They may still have them, so confirm in the interview.</InfoTip>
                  </span>
                </TableHead>
                <SortableHead column="experience" columnLabel={COLUMN_LABEL.experience} width="9%" minWidth={120} sort={sort} onSortChange={onSortChange}>
                  Experience
                </SortableHead>
                <TableHead className={`${PLAIN_HEAD} w-[11%] min-w-36`}>Availability</TableHead>
                <TableHead className={`${PLAIN_HEAD} w-[9%] min-w-28`}>
                  <span className="inline-flex items-center gap-0.5">
                    Evidence
                    <InfoTip label="About Evidence">Where the signal comes from: the resume, portfolio or profile links, and HireStepX practice interviews.</InfoTip>
                  </span>
                </TableHead>
                <SortableHead
                  column="pipeline"
                  columnLabel={COLUMN_LABEL.pipeline}
                  defaultDirection="asc"
                  width="10%"
                  minWidth={150}
                  sort={sort}
                  onSortChange={onSortChange}
                  after={<InfoTip label="About Stage">Where this candidate currently stands in your hiring process for this requirement.</InfoTip>}
                >
                  Stage
                </SortableHead>
                <TableHead className="cand-th-act w-[200px] min-w-[200px]">
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
                  selected={selectedIds.has(c.id)}
                  onToggleSelected={() => onToggleSelected(c.id)}
                  onUnlock={() => onUnlock(c)}
                  onViewEvidence={() => onViewEvidence(c)}
                  onMessage={() => onMessage(c)}
                  onInvite={() => onInvite(c)}
                />
              ))}
            </TableBody>
          </Table>
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
