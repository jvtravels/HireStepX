/* The shortlist's tab, search, filters and sort live in the query string, so a
   reload or a shared link opens the same view. Pure, so it is unit-tested. */

import type { Sort } from "@/components/SortableHead";
import type { CandidateTab } from "@/employer/_jobDetailHelpers";
import { DEFAULT_SORT, type ContactFilter, type SortColumn } from "./candidateTableModel";

export interface ShortlistView {
  tab: CandidateTab | null;
  search: string;
  contact: ContactFilter;
  location: string;
  sort: Sort<SortColumn>;
  insight: string | null;
}

export const DEFAULT_VIEW: ShortlistView = { tab: null, search: "", contact: "all", location: "all", sort: DEFAULT_SORT, insight: null };

const TABS: readonly CandidateTab[] = ["all", "interviewing", "hired", "not_a_fit"];
const CONTACTS: readonly ContactFilter[] = ["all", "locked", "unlocked"];
const COLUMNS: readonly SortColumn[] = ["name", "match", "interview", "pipeline"];

type Params = { get: (key: string) => string | null };

function parseSort(raw: string | null): Sort<SortColumn> {
  const [column, direction] = (raw ?? "").split(".");
  const known = COLUMNS.find((c) => c === column);
  if (!known || (direction !== "asc" && direction !== "desc")) return DEFAULT_SORT;
  return { column: known, direction };
}

export function parseShortlistView(params: Params): ShortlistView {
  const tab = params.get("tab");
  const contact = params.get("contact");
  return {
    tab: TABS.find((t) => t === tab) ?? null,
    search: params.get("q") ?? "",
    contact: CONTACTS.find((c) => c === contact) ?? "all",
    location: params.get("loc") || "all",
    sort: parseSort(params.get("sort")),
    insight: params.get("insight") || null,
  };
}

/** Writes only what differs from the default, over `base` so unrelated params survive. */
export function writeShortlistView(base: URLSearchParams, view: ShortlistView): URLSearchParams {
  const next = new URLSearchParams(base);
  const set = (key: string, value: string | null) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  set("tab", view.tab && view.tab !== "all" ? view.tab : null);
  set("q", view.search.trim() ? view.search : null);
  set("contact", view.contact !== "all" ? view.contact : null);
  set("loc", view.location !== "all" ? view.location : null);
  set("sort", view.sort.column === DEFAULT_SORT.column && view.sort.direction === DEFAULT_SORT.direction ? null : `${view.sort.column}.${view.sort.direction}`);
  set("insight", view.insight);
  return next;
}
