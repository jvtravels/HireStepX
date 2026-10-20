"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { SearchXIcon, InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SortableHead, type Sort } from "@/components/SortableHead";
import type { RequirementSummary, RequirementStage } from "@/employer/mockData";
import { Badge, StageCell } from "@/employer/_atoms";
import { PostJobLink } from "@/employer/_consoleParts";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "@/hiringMatchFormat";
import { COLUMN_LABEL, budgetLabel, experienceLabel, locationText, type SortColumn } from "./jobsHelpers";
import { DueCell, HeadInfo, MatchesCell } from "./JobCells";

const MotionTableRow = motion.create(TableRow);

/* The title column and the actions column are pinned so a row stays readable
   and actionable while the other columns scroll horizontally. Department is
   the one optional column: it drops out when the region gets narrow, and the
   rest scrolls. Phones never see this table (page.tsx shows cards instead,
   switched in CSS). */
const JOBS_TABLE_CSS = `
.jobs-scroll { container-type: inline-size; }
.jobs-table { min-width: 1200px; }
.jobs-table :is(th, td):first-child { position: sticky; left: 0; z-index: 1; background: ${t.white}; box-shadow: 1px 0 0 ${t.line}; }
.jobs-table thead th:first-child { z-index: 3; background: ${t.rowTint}; }
.jobs-table tbody tr:hover > td:first-child { background: color-mix(in srgb, var(--muted) 50%, ${t.white}); }
.jobs-col-act { position: sticky; right: 0; z-index: 1; background: ${t.white}; box-shadow: -1px 0 0 ${t.line}; }
thead .jobs-col-act { background: ${t.rowTint}; z-index: 3; }
tr:hover > .jobs-col-act { background: color-mix(in srgb, var(--muted) 50%, ${t.white}); }
@container (max-width: 1299px) {
  .jobs-col-dept { display: none; }
  .jobs-table { min-width: 1100px; }
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
                  "Matches"/"Location"/"Due date" all
                  clipped at typical viewport widths despite generous
                  minWidth). Fixed pixel widths don't have that ambiguity:
                  table-fixed honors them exactly, so every label gets
                  guaranteed room regardless of viewport. The job
                  column absorbs Department's pixels when there's no department
                  data to show, so hidden-column space isn't stranded. */}
              <SortableHead column="title" columnLabel={COLUMN_LABEL.title} defaultDirection="asc" width={hasAnyDepartment ? 260 : 320} minWidth={220} sort={sort} onSortChange={setSort}>Job</SortableHead>
              {hasAnyDepartment && (
                <TableHead className="jobs-col-dept" style={{ width: 100, padding: "0 20px", fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.inkSoft }}>Department</TableHead>
              )}
              <SortableHead
                column="stage"
                columnLabel={COLUMN_LABEL.stage}
                width={175}
                sort={sort}
                onSortChange={setSort}
                after={<HeadInfo label="About stage">Where this job is in your hiring pipeline. Move it forward as you review candidates and interview.</HeadInfo>}
              >
                Stage
              </SortableHead>
              <SortableHead
                column="topMatches"
                columnLabel={COLUMN_LABEL.topMatches}
                width={240}
                sort={sort}
                onSortChange={setSort}
                after={<HeadInfo label="About matches">Strong matches are the highest-scoring candidates for this job, with their average score. Evaluated is how many candidates the AI has scored in total.</HeadInfo>}
              >
                Matches
              </SortableHead>
              <SortableHead column="experience" columnLabel={COLUMN_LABEL.experience} width={140} sort={sort} onSortChange={setSort}>Experience</SortableHead>
              <SortableHead column="location" columnLabel={COLUMN_LABEL.location} defaultDirection="asc" width={130} sort={sort} onSortChange={setSort}>Location</SortableHead>
              <SortableHead column="dueDate" columnLabel={COLUMN_LABEL.dueDate} defaultDirection="asc" width={130} sort={sort} onSortChange={setSort}>Due date</SortableHead>
              <TableHead className="jobs-col-act" style={{ width: 56, minWidth: 56 }}>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="mx-stagger">
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={hasAnyDepartment ? 8 : 7} style={{ padding: "40px 14px" }}>
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
                      {!readOnly && <PostJobLink>Create a job</PostJobLink>}
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
                        <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft }}>Not set</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <StageCell
                      stage={r.stage}
                      hasEvaluatedCandidates={r.aiScreening.evaluated > 0}
                      onChange={(stage) => changeStage(r.id, stage)}
                      frozen={isClosed || readOnly} closed={isClosed} matchedOnce={r.status === "zero"}
                    />
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    <MatchesCell r={r} />
                  </TableCell>
                  <TableCell style={{ padding: "12px 20px", verticalAlign: "top", whiteSpace: "normal" }}>
                    {exp ? <Badge tone="neutral">{exp}</Badge> : <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft }}>Any</span>}
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
