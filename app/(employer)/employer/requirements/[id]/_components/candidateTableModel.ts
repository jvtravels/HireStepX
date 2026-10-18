/* Sort / filter model for the candidates table. Pure, so the page, the
   filters popover and the table share one definition. */

import type { Sort } from "@/components/SortableHead";
import type { Candidate } from "@/employer/mockData";
import { inTab, interviewScore, matchesInsight, type CandidateTab, type InsightFilter } from "@/employer/_jobDetailHelpers";
import { candidateDisplayName } from "./requirementFormat";

export type ContactFilter = "all" | "locked" | "unlocked";
export type SortColumn = "name" | "match" | "interview" | "pipeline";

export const CONTACT_FILTER_OPTIONS: Array<{ value: ContactFilter; label: string }> = [
  { value: "all", label: "All candidates" },
  { value: "unlocked", label: "Unlocked" },
  { value: "locked", label: "Locked" },
];

export const DEFAULT_SORT: Sort<SortColumn> = { column: "match", direction: "desc" };

/* One list for the mobile sort select and the View menu, so both offer the same orders. */
export const SORT_OPTIONS: Array<{ value: string; label: string; sort: Sort<SortColumn> }> = [
  { value: "match-desc", label: "Best match first", sort: { column: "match", direction: "desc" } },
  { value: "match-asc", label: "Lowest match first", sort: { column: "match", direction: "asc" } },
  { value: "name-asc", label: "Candidate A to Z", sort: { column: "name", direction: "asc" } },
  { value: "interview-desc", label: "Highest interview score", sort: { column: "interview", direction: "desc" } },
  { value: "pipeline-asc", label: "Stage: earliest first", sort: { column: "pipeline", direction: "asc" } },
];

export const COLUMN_LABEL: Record<SortColumn, string> = {
  name: "Candidate",
  match: "Role match",
  interview: "Evidence (interview score)",
  pipeline: "Stage",
};

const SORT_PILL: Record<SortColumn, { name: string; asc: string; desc: string }> = {
  name: { name: "Name", asc: "A to Z", desc: "Z to A" },
  match: { name: "Match score", asc: "low to high", desc: "high to low" },
  interview: { name: "Interview score", asc: "low to high", desc: "high to low" },
  pipeline: { name: "Stage", asc: "earliest first", desc: "latest first" },
};

/** What the toolbar pill says about the current sort, e.g. `{ name: "Match score", order: "high to low" }`. */
export function describeSort(sort: Sort<SortColumn>): { name: string; order: string } {
  const label = SORT_PILL[sort.column];
  return { name: label.name, order: label[sort.direction] };
}

/** Which skill chips fit in a row: matched first, but one slot is always kept for a gap so a miss never hides. */
export function skillChipSlots(matched: string[], gaps: string[], max = 3): { matched: string[]; gaps: string[]; hidden: number } {
  const gapSlots = gaps.length > 0 ? Math.min(gaps.length, Math.max(1, max - matched.length)) : 0;
  const matchedSlots = Math.min(matched.length, max - gapSlots);
  return {
    matched: matched.slice(0, matchedSlots),
    gaps: gaps.slice(0, gapSlots),
    hidden: matched.length + gaps.length - matchedSlots - gapSlots,
  };
}

/* Funnel order, not alphabetical: "hired" sorts ahead of "interviewing" ahead
   of "shortlisted". Rejected/declined outcomes sort last. */
const PIPELINE_RANK: Record<Candidate["candidateStatus"], number> = {
  shortlisted: 0,
  interview_invited: 1,
  interviewing: 2,
  hired: 3,
  not_a_fit: 4,
  no_response: 5,
  rejected: 6,
};

export function compareCandidates(a: Candidate, b: Candidate, sort: Sort<SortColumn>): number {
  const dir = sort.direction === "asc" ? 1 : -1;
  switch (sort.column) {
    case "name":
      return dir * candidateDisplayName(a).localeCompare(candidateDisplayName(b));
    case "match":
      return dir * (a.matchScore - b.matchScore);
    case "interview":
      return dir * ((interviewScore(a) ?? -1) - (interviewScore(b) ?? -1));
    case "pipeline":
      return dir * (PIPELINE_RANK[a.candidateStatus] - PIPELINE_RANK[b.candidateStatus]);
  }
}

export interface CandidateFilterState {
  search: string;
  contact: ContactFilter;
  location: string;
  tab: CandidateTab;
  insight: InsightFilter | null;
}

export function filterCandidates(candidates: Candidate[], state: CandidateFilterState): Candidate[] {
  const q = state.search.trim().toLowerCase();
  return candidates.filter((c) => {
    if (state.contact === "locked" && c.unlocked) return false;
    if (state.contact === "unlocked" && !c.unlocked) return false;
    if (state.location !== "all" && c.city !== state.location) return false;
    if (!inTab(c, state.tab)) return false;
    if (state.insight && !matchesInsight(c, state.insight)) return false;
    if (!q) return true;
    /* A locked candidate is found by the masked label the table shows, never
       by the real name the employer hasn't paid to see. */
    const haystack = [candidateDisplayName(c), c.targetRole, c.city, c.resume?.noticePeriod || "", ...c.skills].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}
