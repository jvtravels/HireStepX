"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { PlusIcon, SearchXIcon, EyeIcon, InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SortableHead, type Sort } from "@/components/SortableHead";
import type { RequirementSummary, RequirementStage } from "@/employer/mockData";
import { Badge, StageCell } from "@/employer/_atoms";
import { PrimaryLink } from "@/employer/_consoleParts";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "@/hiringMatchFormat";
import { COLUMN_LABEL, budgetLabel, experienceLabel, locationText, type SortColumn } from "./jobsHelpers";
import { DueCell, HeadInfo } from "./JobCells";
import StrongMatchCell from "./StrongMatchCell";

const MotionTableRow = motion.create(TableRow);

/* The table can only be as wide as its scroll region, so columns are dropped by
   priority (department, then strong match) as the region narrows instead of
   truncating whichever happens to be last. min-width tracks the visible
   columns, the actions column is pinned so row actions are always reachable,
   and everything else scrolls horizontally. */
const JOBS_TABLE_CSS = `
.jobs-scroll { container-type: inline-size; }
.jobs-table { min-width: 1411px; }
.jobs-col-act { position: sticky; right: 0; z-index: 1; background: ${t.white}; box-shadow: -1px 0 0 ${t.line}; }
thead .jobs-col-act { background: ${t.rowTint}; }
tr:hover > .jobs-col-act { background: color-mix(in srgb, var(--muted) 50%, ${t.white}); }
@container (max-width: 1439px) {
  .jobs-col-strong { display: none; }
  .jobs-table { min-width: 1276px; }
}
@container (max-width: 1299px) {
  .jobs-col-dept { display: none; }
  .jobs-table { min-width: 1176px; }
}
`;

/** Row-wide click is a pointer convenience only; the title link is the real
 *  keyboard/AT target. Clicks that land on (or portal out of) an interactive
 *  descendant — stage picker, row menu, tooltips — must not navigate. */
function shouldIgnoreRowClick(e: React.MouseEvent<HTMLElement>): boolean {
  const target = e.target as HTMLElement;
  if (!e.currentTarget.contains(target)) return true;
  return !!target.closest("a, button, input, select, textarea, [role='combobox'], [role='menuitem'], [role='option']");
}

export default function JobsTable({
  rows, hasAnyDepartment, sort, onSortChange, readOnly, onStage, onOpen, rowActions, search, onlySearchActive, onClear,
}: {
  rows: RequirementSummary[];
  hasAnyDepartment: boolean;
  sort: Sort<SortColumn>;
  onSortChange: (s: Sort<SortColumn>) => void;
  readOnly: boolean;
  onStage: (id: string, stage: RequirementStage) => void;
  onOpen: (href: string) => void;
  rowActions: (r: RequirementSummary) => React.ReactNode;
  search: string;
  onlySearchActive: boolean;
  onClear: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const openRow = (e: React.MouseEvent<HTMLElement>, href: string) => {
    if (shouldIgnoreRowClick(e)) return;
    onOpen(href);
  };
  const pageRows = rows;
  const setSort = onSortChange;
  const changeStage = onStage;
  return (
        <>
        <style>{JOBS_TABLE_CSS}</style>
        <Table aria-label="Posted jobs" className="table-fixed jobs-table" containerClassName="overflow-visible" style={{ width: "100%" }}>
          <TableHeader>
            <TableRow style={{ background: t.rowTint, height: 40, position: "sticky", top: 0, zIndex: 1 }}>
              {/* table-fixed computes column widths from these first-row
                  declarations — but per-cell minWidth is NOT a reliable
                  floor when a column's own width is a percentage: Chrome
                  resolves the percentage against the table's rendered width
                  and can land below minWidth, silently truncating
                  SortableHead's ellipsis'd label (confirmed in production —
                  "AI Screening"/"Top Matches"/"Location"/"Due Date" all
                  clipped at typical viewport widths despite generous
                  minWidth). Fixed pixel widths don't have that ambiguity:
                  table-fixed honors them exactly, so every label gets
                  guaranteed room regardless of viewport. Opportunity
                  absorbs Department's pixels when there's no department
                  data to show, so hidden-column space isn't stranded. */}
              <SortableHead column="title" columnLabel={COLUMN_LABEL.title} defaultDirection="asc" width={hasAnyDepartment ? 220 : 320} minWidth={190} sort={sort} onSortChange={setSort}>Opportunity</SortableHead>
              {hasAnyDepartment && (
                <TableHead className="jobs-col-dept" style={{ width: 100, padding: "0 20px", fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.inkSoft }}>Department</TableHead>
              )}
              <SortableHead
                column="stage"
                columnLabel={COLUMN_LABEL.stage}
                width={175}
                sort={sort}
                onSortChange={setSort}
                after={<HeadInfo label="About stage">Where this posting is in your hiring pipeline — move it forward as you review candidates and interview.</HeadInfo>}
              >
                Stage
              </SortableHead>
              <SortableHead
                column="matches"
                columnLabel={COLUMN_LABEL.matches}
                width={165}
                sort={sort}
                onSortChange={setSort}
                after={<HeadInfo label="About AI Screening">How many candidates the AI has evaluated against this requirement, and the score range across them.</HeadInfo>}
              >
                AI Screening
              </SortableHead>
              <SortableHead
                column="topMatches"
                columnLabel={COLUMN_LABEL.topMatches}
                width={160}
                sort={sort}
                onSortChange={setSort}
                after={<HeadInfo label="About Top Matches">The curated shortlist of highest-scoring candidates, with their average match score.</HeadInfo>}
              >
                Top Matches
              </SortableHead>
              <TableHead className="jobs-col-strong" style={{ width: 135, fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.inkSoft }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  Strong Match
                  <HeadInfo label="About Strong Match">The best of the shortlist — candidates scoring highest against this requirement's evaluation criteria. Hover a candidate to see their experience and skills.</HeadInfo>
                </div>
              </TableHead>
              <SortableHead column="experience" columnLabel={COLUMN_LABEL.experience} width={140} sort={sort} onSortChange={setSort}>Experience</SortableHead>
              <SortableHead column="location" columnLabel={COLUMN_LABEL.location} defaultDirection="asc" width={130} sort={sort} onSortChange={setSort}>Location</SortableHead>
              <SortableHead column="dueDate" columnLabel={COLUMN_LABEL.dueDate} defaultDirection="asc" width={130} sort={sort} onSortChange={setSort}>Due Date</SortableHead>
              <TableHead className="jobs-col-act" style={{ width: 56, minWidth: 56 }}>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={hasAnyDepartment ? 10 : 9} style={{ padding: "40px 14px" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <SearchXIcon size={22} color={t.inkSoft} aria-hidden="true" />
                    <p style={{ fontFamily: f.sans, fontSize: textSize.base, fontWeight: 600, color: t.coal, margin: 0 }}>
                      {search.trim() ? `No results for "${search.trim()}"` : "No jobs match these filters"}
                    </p>
                    <p style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkSoft, margin: 0 }}>
                      {search.trim() ? "Try a different search term, or clear it to see all your jobs." : "Try adjusting or clearing your filters."}
                    </p>
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <Button variant="outline" onClick={onClear} style={{ borderRadius: 8, height: 40, fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 500 }}>
                        {onlySearchActive ? "Clear search" : "Clear filters"}
                      </Button>
                      {!readOnly && <PrimaryLink href="/employer/requirements/new" icon={<PlusIcon size={14} strokeWidth={2.5} aria-hidden="true" />}>Create</PrimaryLink>}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((r, rowIndex) => {
              const mode = r.workMode ? WORK_MODE_LABEL[r.workMode] || r.workMode : null;
              const jobType = r.employmentType ? EMPLOYMENT_TYPE_LABEL[r.employmentType] || r.employmentType : null;
              const exp = experienceLabel(r);
              const budget = budgetLabel(r);
              const href = `/employer/requirements/${r.id}`;
              const isClosed = r.status === "closed";
              return (
                <MotionTableRow
                  key={r.id}
                  layout={reduceMotion ? false : "position"}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1], delay: rowIndex * 0.03 }}
                  onClick={(e) => openRow(e, href)}
                  className="cursor-pointer"
                  style={{ minHeight: 72 }}
                >
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Link
                        href={href}
                        className="hover:underline"
                        style={{ fontFamily: f.sans, fontSize: textSize.md, fontWeight: 500, color: t.coal, textDecoration: "none", overflowWrap: "anywhere" }}
                      >
                        {r.title}
                      </Link>
                      {isClosed && <Badge tone="neutral">Closed</Badge>}
                    </div>
                    {(budget || jobType) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft, marginTop: 2 }}>
                        <span>{[budget, jobType].filter(Boolean).join(" · ")}</span>
                        {(r.durationWeeks != null || r.hoursPerWeek != null) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label="Duration and hours details"
                                onClick={(e) => e.stopPropagation()}
                                className="pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center"
                                style={{ display: "inline-flex", alignItems: "center", color: t.inkSoft, background: "none", border: "none", padding: 8, margin: -8, cursor: "pointer" }}
                              >
                                <InfoIcon size={13} aria-hidden="true" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              {[
                                r.durationWeeks != null ? `${r.durationWeeks} ${r.durationWeeks === 1 ? "week" : "weeks"}` : null,
                                r.hoursPerWeek != null ? `${r.hoursPerWeek} hrs/week` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    )}
                    {r.skills.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {r.skills.slice(0, 3).map((s) => (
                          <span key={s} style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkSoft, background: t.creamSoft, padding: "2px 7px", borderRadius: 999 }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  {hasAnyDepartment && (
                    <TableCell className="jobs-col-dept" style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                      {r.department ? (
                        <span style={{ fontFamily: f.sans, fontSize: textSize.md, fontWeight: 500, color: t.coal }}>{r.department}</span>
                      ) : (
                        <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft }}>—</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <StageCell
                      stage={r.stage}
                      hasEvaluatedCandidates={r.aiScreening.evaluated > 0}
                      onChange={(stage) => changeStage(r.id, stage)}
                      frozen={isClosed || readOnly}
                    />
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    {r.status === "generating" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Spinner style={{ width: 12, height: 12 }} color={t.inkSoft} aria-hidden="true" />
                        <Badge tone="brand">Finding candidates</Badge>
                      </div>
                    ) : r.aiScreening.evaluated === 0 ? (
                      <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft }}>—</span>
                    ) : (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: f.sans, fontSize: textSize.md, fontWeight: 500, color: t.coal }}>
                          <EyeIcon size={13} color={t.inkSoft} aria-hidden="true" />
                          {r.aiScreening.totalMatched > r.aiScreening.evaluated
                            ? `Top ${r.aiScreening.evaluated} (of ${r.aiScreening.totalMatched} matched)`
                            : `${r.aiScreening.evaluated} evaluated`}
                        </div>
                        {r.aiScreening.scoreLow != null && r.aiScreening.scoreHigh != null && (
                          <div style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft, marginTop: 1 }}>
                            Score range {r.aiScreening.scoreLow}–{r.aiScreening.scoreHigh}%
                          </div>
                        )}
                      </>
                    )}
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    {r.aiScreening.evaluated === 0 ? (
                      <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft }}>—</span>
                    ) : r.aiScreening.topMatches > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        <Badge tone="info">Top {r.aiScreening.topMatches}</Badge>
                        {r.aiScreening.strongAvgScore != null && (
                          <div style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft, marginTop: 1 }}>{r.aiScreening.strongAvgScore}% avg match score</div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft }}>None yet</span>
                    )}
                  </TableCell>
                  <TableCell className="jobs-col-strong" style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <StrongMatchCell aiScreening={r.aiScreening} />
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    {exp ? <Badge tone="info">{exp}</Badge> : <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft }}>Any</span>}
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <div style={{ fontFamily: f.sans, fontSize: textSize.md, fontWeight: 500, color: t.coal }}>{locationText(r) || "Not specified"}</div>
                    {mode && mode !== locationText(r) && (
                      <div style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft, marginTop: 1 }}>
                        {mode === "Remote" ? `Remote · based in ${locationText(r)}` : mode}
                      </div>
                    )}
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <DueCell dueDate={r.dueDate} />
                  </TableCell>
                  <TableCell className="jobs-col-act" style={{ padding: "12px 10px", verticalAlign: "top", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    {rowActions(r)}
                  </TableCell>
                </MotionTableRow>
              );
            })}
          </TableBody>
        </Table>
        </>
  );
}
