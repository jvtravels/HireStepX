/* Sort / filter model for the candidates table. Pure, so the page, the
   filters popover and the table share one definition. */

import type { Sort } from "@/components/SortableHead";
import type { Candidate } from "@/employer/mockData";
import { candidateDisplayName } from "./requirementFormat";

export type ContactFilter = "all" | "locked" | "unlocked";
export type PipelineFilter = "all" | "interviewing" | "hired";
export type SortColumn = "name" | "match" | "sessions" | "pipeline";

export const CONTACT_FILTER_OPTIONS: Array<{ value: ContactFilter; label: string }> = [
  { value: "all", label: "All candidates" },
  { value: "unlocked", label: "Unlocked" },
  { value: "locked", label: "Locked" },
];

export const DEFAULT_SORT: Sort<SortColumn> = { column: "match", direction: "desc" };

export const COLUMN_LABEL: Record<SortColumn, string> = {
  name: "Candidate",
  match: "Match",
  sessions: "Practice history",
  pipeline: "Pipeline",
};

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
    case "sessions":
      return dir * (a.sessionsCompleted - b.sessionsCompleted);
    case "pipeline":
      return dir * (PIPELINE_RANK[a.candidateStatus] - PIPELINE_RANK[b.candidateStatus]);
  }
}

export interface CandidateFilterState {
  search: string;
  contact: ContactFilter;
  location: string;
  pipeline: PipelineFilter;
}

export function filterCandidates(candidates: Candidate[], state: CandidateFilterState): Candidate[] {
  const q = state.search.trim().toLowerCase();
  return candidates.filter((c) => {
    if (state.contact === "locked" && c.unlocked) return false;
    if (state.contact === "unlocked" && !c.unlocked) return false;
    if (state.location !== "all" && c.city !== state.location) return false;
    if (state.pipeline === "interviewing" && c.candidateStatus !== "interview_invited" && c.candidateStatus !== "interviewing") return false;
    if (state.pipeline === "hired" && c.candidateStatus !== "hired") return false;
    if (!q) return true;
    /* Locked candidates are searchable by role/skills but never by a name the
       employer isn't entitled to see. */
    const haystack = [c.unlocked ? c.name : "", c.targetRole, c.city, c.resume?.noticePeriod || "", ...c.skills].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}
