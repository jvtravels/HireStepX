"use client";

import { InfoIcon } from "lucide-react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { SortableHead, type Sort } from "@/components/SortableHead";
import { TablePaginationFooter } from "@/components/TablePaginationFooter";
import { Table, TableBody, TableCaption, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card } from "@/employer/_atoms";
import type { Candidate } from "@/employer/mockData";
import CandidateRow from "./CandidateRow";
import { CAND_TABLE_CSS, HEADER_CELL_STYLE } from "./candidateTableStyles";
import { COLUMN_LABEL, type SortColumn } from "./candidateTableModel";

/** Focusable info trigger: a real button so keyboard and touch users get the
    same explanation as hover users. */
function HeadInfo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:p-3"
          style={{ display: "inline-flex", alignItems: "center", color: t.inkFaint, background: "transparent", border: "none", cursor: "pointer", padding: 8, margin: -6, outlineColor: t.indigo }}
        >
          <InfoIcon size={12} aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

/* Below 768px the column headers are hidden, so sorting moves to this select. */
const MOBILE_SORTS: Array<{ value: string; label: string; sort: Sort<SortColumn> }> = [
  { value: "match-desc", label: "Best match first", sort: { column: "match", direction: "desc" } },
  { value: "match-asc", label: "Lowest match first", sort: { column: "match", direction: "asc" } },
  { value: "name-asc", label: "Candidate A to Z", sort: { column: "name", direction: "asc" } },
  { value: "sessions-desc", label: "Most practice sessions", sort: { column: "sessions", direction: "desc" } },
  { value: "pipeline-asc", label: "Pipeline: earliest stage", sort: { column: "pipeline", direction: "asc" } },
];

export default function CandidatesTable({
  rows,
  requirementId,
  readOnly,
  suspended,
  selectedIds,
  onToggleSelected,
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
  readOnly: boolean;
  suspended: boolean;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
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

  return (
    <>
      <div className="md:hidden" style={{ marginBottom: 12 }}>
        <label htmlFor="cand-mobile-sort" style={{ display: "block", fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint, marginBottom: 4 }}>
          Sort candidates
        </label>
        <select
          id="cand-mobile-sort"
          value={mobileKnown ? mobileValue : "match-desc"}
          onChange={(e) => {
            const next = MOBILE_SORTS.find((s) => s.value === e.target.value);
            if (next) onSortChange(next.sort);
          }}
          style={{ width: "100%", minHeight: 44, padding: "0 12px", borderRadius: 8, border: `1px solid ${t.line}`, background: t.white, color: t.coal, fontFamily: f.sans, fontSize: textSize.md }}
        >
          {MOBILE_SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <Card pad={0} className="cand-shell" style={{ overflow: "hidden", boxShadow: "none", flex: "0 0 auto", display: "flex", flexDirection: "column" }}>
        <div className="cand-scroll" style={{ overflowX: "auto", flex: "0 0 auto" }}>
          <style>{CAND_TABLE_CSS}</style>
          <Table role="table" className="cand-table" containerClassName="overflow-visible" style={{ minWidth: 950 }}>
            <TableCaption className="sr-only">
              Candidates for this requirement, {filteredCount} shown. Column headers are buttons that sort the table.
            </TableCaption>
            <TableHeader className="cand-thead">
              <TableRow style={{ background: t.rowTint, height: 40 }}>
                {!readOnly && (
                  <TableHead style={{ width: 32 }}>
                    <span className="sr-only">Select</span>
                  </TableHead>
                )}
                <SortableHead column="name" columnLabel={COLUMN_LABEL.name} defaultDirection="asc" width="30%" minWidth={240} sort={sort} onSortChange={onSortChange}>
                  Candidate
                </SortableHead>
                <SortableHead
                  column="match"
                  columnLabel={COLUMN_LABEL.match}
                  width="7%"
                  minWidth={80}
                  sort={sort}
                  onSortChange={onSortChange}
                  after={<HeadInfo label="About Match">How well this candidate&apos;s role, skills, and location fit this requirement, out of 100. Candidates with no practice sessions can still score on resume fit alone.</HeadInfo>}
                >
                  Match
                </SortableHead>
                <SortableHead
                  column="sessions"
                  columnLabel={COLUMN_LABEL.sessions}
                  width="13%"
                  minWidth={150}
                  sort={sort}
                  onSortChange={onSortChange}
                  after={<HeadInfo label="About Practice history">&quot;Avg score&quot; is this candidate&apos;s average score (0 to 100) across all their completed practice interviews on HireStepX, not specific to this requirement. &quot;Sessions&quot; is how many practice interviews they&apos;ve completed in total.</HeadInfo>}
                >
                  Practice history
                </SortableHead>
                <TableHead style={{ ...HEADER_CELL_STYLE, width: "9%", minWidth: 110 }}>Notice period</TableHead>
                <TableHead style={{ ...HEADER_CELL_STYLE, width: "10%", minWidth: 120 }}>Current CTC</TableHead>
                <TableHead style={{ ...HEADER_CELL_STYLE, width: "21%", minWidth: 190 }}>Skills</TableHead>
                <SortableHead
                  column="pipeline"
                  columnLabel={COLUMN_LABEL.pipeline}
                  defaultDirection="asc"
                  width="10%"
                  minWidth={140}
                  sort={sort}
                  onSortChange={onSortChange}
                  after={<HeadInfo label="About Pipeline">Where this candidate currently stands in your hiring process for this requirement.</HeadInfo>}
                >
                  Pipeline
                </SortableHead>
                <TableHead style={{ ...HEADER_CELL_STYLE, width: 48 }}>
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
      </Card>
    </>
  );
}
