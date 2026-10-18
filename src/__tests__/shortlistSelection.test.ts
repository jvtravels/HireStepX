import { describe, it, expect } from "vitest";
import type { Candidate, CandidateStatus } from "../employer/mockData";
import {
  bulkSummary, canCompare, compareHint, compareHref, mapWithConcurrency, parseCompareIds, planBulkMove,
  pruneSelection, reverse, toggleId, undoable,
} from "../../app/(employer)/employer/requirements/[id]/_components/shortlistSelection";
import { DEFAULT_VIEW, parseShortlistView, writeShortlistView } from "../../app/(employer)/employer/requirements/[id]/_components/shortlistUrlState";

const cand = (id: string, candidateStatus: CandidateStatus) => ({ id, candidateStatus }) as Candidate;
const params = (q: string) => new URLSearchParams(q);

describe("selection", () => {
  it("toggles an id without mutating the original set", () => {
    const a = new Set(["1"]);
    const b = toggleId(a, "2");
    expect([...b]).toEqual(["1", "2"]);
    expect([...a]).toEqual(["1"]);
    expect([...toggleId(b, "1")]).toEqual(["2"]);
  });

  it("prunes ids that left the shortlist and keeps the same set when nothing changed", () => {
    const sel = new Set(["1", "gone"]);
    expect([...pruneSelection(sel, [{ id: "1" }, { id: "2" }])]).toEqual(["1"]);
    const same = new Set(["1"]);
    expect(pruneSelection(same, [{ id: "1" }])).toBe(same);
  });

  it("allows comparing two or three and explains why not otherwise", () => {
    expect([0, 1, 2, 3, 4].map(canCompare)).toEqual([false, false, true, true, false]);
    expect(compareHint(1)).toBe("Select 1 more to compare");
    expect(compareHint(2)).toBeNull();
    expect(compareHint(4)).toBe("Compare up to 3 candidates");
  });

  it("builds and parses the compare link, including the older a and b pair", () => {
    expect(compareHref("job1", ["a", "b", "c"])).toBe("/employer/requirements/job1/compare?ids=a,b,c");
    expect(parseCompareIds(params("ids=a,b,c,d"))).toEqual(["a", "b", "c"]);
    expect(parseCompareIds(params("ids=a,a, b"))).toEqual(["a", "b"]);
    expect(parseCompareIds(params("a=x&b=y"))).toEqual(["x", "y"]);
    expect(parseCompareIds(params(""))).toEqual([]);
  });
});

describe("bulk moves and undo", () => {
  const list = [cand("1", "shortlisted"), cand("2", "rejected"), cand("3", "interview_invited"), cand("4", "hired"), cand("5", "shortlisted")];

  it("rejects only candidates the pipeline allows and counts the rest as skipped", () => {
    const plan = planBulkMove(list, new Set(["1", "2", "3", "4"]), "rejected");
    expect(plan.changes.map((c) => c.id)).toEqual(["1", "3"]);
    expect(plan.skipped).toBe(2);
  });

  it("moves only rejected candidates back to To review", () => {
    const plan = planBulkMove(list, new Set(["1", "2"]), "shortlisted");
    expect(plan.changes).toEqual([{ id: "2", from: "rejected", to: "shortlisted" }]);
    expect(plan.skipped).toBe(1);
  });

  it("offers undo only for moves the pipeline can reverse", () => {
    const changes = [
      { id: "1", from: "shortlisted" as const, to: "rejected" as const },
      { id: "3", from: "interview_invited" as const, to: "interviewing" as const },
    ];
    expect(undoable(changes).map((c) => c.id)).toEqual(["1"]);
    expect(reverse(undoable(changes))).toEqual([{ id: "1", from: "rejected", to: "shortlisted" }]);
  });

  it("summarises partial results in words", () => {
    expect(bulkSummary("rejected", 2, 1, 1)).toBe("Rejected 2 candidates. 1 didn't save. 1 skipped because they can't be rejected from their stage.");
    expect(bulkSummary("shortlisted", 0, 0, 2)).toContain("Couldn't update any candidates.");
  });

  it("limits how many calls run at once and keeps result order", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight -= 1;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(peak).toBe(3);
  });
});

describe("shortlist URL state", () => {
  it("reads defaults from an empty query", () => {
    expect(parseShortlistView(params(""))).toEqual(DEFAULT_VIEW);
  });

  it("round-trips tab, search, filters, sort and insight", () => {
    const view = { tab: "interviewing" as const, search: "react dev", contact: "unlocked" as const, location: "Pune", sort: { column: "name" as const, direction: "asc" as const }, insight: "stale" };
    const qs = writeShortlistView(new URLSearchParams(), view);
    expect(qs.toString()).toBe("tab=interviewing&q=react+dev&contact=unlocked&loc=Pune&sort=name.asc&insight=stale");
    expect(parseShortlistView(qs)).toEqual(view);
  });

  it("writes nothing for the default view and keeps unrelated params", () => {
    expect(writeShortlistView(new URLSearchParams(), DEFAULT_VIEW).toString()).toBe("");
    expect(writeShortlistView(new URLSearchParams("utm=x&q=old"), DEFAULT_VIEW).toString()).toBe("utm=x");
  });

  it("ignores values it does not recognise", () => {
    const view = parseShortlistView(params("tab=bogus&contact=nope&sort=weird.up"));
    expect(view.tab).toBeNull();
    expect(view.contact).toBe("all");
    expect(view.sort).toEqual(DEFAULT_VIEW.sort);
  });
});
