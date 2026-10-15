/* Sort / filter model for the candidates table. Pure, so the page, the
   filters popover and the table share one definition. */

import type { Sort } from "@/components/SortableHead";
import type { Candidate } from "@/employer/mockData";
import { inTab, interviewScore, type CandidateTab } from "@/employer/_jobDetailHelpers";
import { candidateDisplayName } from "./requirementFormat";

export type ContactFilter = "all" | "locked" | "unlocked";
export type SortColumn = "name" | "match" | "experience" | "interview" | "pipeline";

export const CONTACT_FILTER_OPTIONS: Array<{ value: ContactFilter; label: string }> = [
  { value: "all", label: "All candidates" },
  { value: "unlocked", label: "Unlocked" },
  { value: "locked", label: "Locked" },
];

export const DEFAULT_SORT: Sort<SortColumn> = { column: "match", direction: "desc" };

export const COLUMN_LABEL: Record<SortColumn, string> = {
  name: "Candidate",
  match: "Role match",
  experience: "Experience",
  interview: "Evidence (interview score)",
  pipeline: "Stage",
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
    case "experience":
      return dir * ((a.resume?.yearsExperience ?? -1) - (b.resume?.yearsExperience ?? -1));
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
}

export function filterCandidates(candidates: Candidate[], state: CandidateFilterState): Candidate[] {
  const q = state.search.trim().toLowerCase();
  return candidates.filter((c) => {
    if (state.contact === "locked" && c.unlocked) return false;
    if (state.contact === "unlocked" && !c.unlocked) return false;
    if (state.location !== "all" && c.city !== state.location) return false;
    if (!inTab(c, state.tab)) return false;
    if (!q) return true;
    /* A locked candidate is found by the masked label the table shows, never
       by the real name the employer hasn't paid to see. */
    const haystack = [candidateDisplayName(c), c.targetRole, c.city, c.resume?.noticePeriod || "", ...c.skills].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}
