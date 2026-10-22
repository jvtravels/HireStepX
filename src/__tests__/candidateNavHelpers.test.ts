import { describe, it, expect } from "vitest";
import type { Candidate } from "@/employer/mockData";
import { candidateSignal, fitHeadline, rankCandidates, shortlistPosition } from "../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/helpers";
import { composeRejectNote } from "@/employer/_passReasons";

const cand = (id: string, matchScore: number) => ({ id, matchScore }) as Candidate;

describe("rankCandidates", () => {
  it("orders best match first and keeps API order on ties", () => {
    const ranked = rankCandidates([cand("a", 70), cand("b", 90), cand("c", 70), cand("d", 95)]);
    expect(ranked.map((c) => c.id)).toEqual(["d", "b", "a", "c"]);
  });

  it("does not mutate the input", () => {
    const input = [cand("a", 10), cand("b", 20)];
    rankCandidates(input);
    expect(input.map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("shortlistPosition", () => {
  const ranked = [cand("a", 90), cand("b", 80), cand("c", 70)];

  it("reports position, total and neighbours", () => {
    const p = shortlistPosition(ranked, "b");
    expect(p).toMatchObject({ position: 2, total: 3 });
    expect(p?.prev?.id).toBe("a");
    expect(p?.next?.id).toBe("c");
  });

  it("has no previous at the top and no next at the bottom", () => {
    expect(shortlistPosition(ranked, "a")?.prev).toBeNull();
    expect(shortlistPosition(ranked, "c")?.next).toBeNull();
  });

  it("returns null for an id that is not on the shortlist", () => {
    expect(shortlistPosition(ranked, "zzz")).toBeNull();
  });
});

describe("composeRejectNote", () => {
  it("returns undefined when nothing was entered", () => {
    expect(composeRejectNote([], "   ")).toBeUndefined();
  });

  it("puts reasons first, then the free text", () => {
    expect(composeRejectNote(["Skills gap", "Location"], " Not a fit for the team. ")).toBe("Reasons: Skills gap, Location. Not a fit for the team.");
  });

  it("works with reasons only or text only", () => {
    expect(composeRejectNote(["Communication"], "")).toBe("Reasons: Communication.");
    expect(composeRejectNote([], "Too junior")).toBe("Too junior");
  });
});

const fit = (meets: number, total: number, gaps: string[] = [], close: string[] = []) => ({ meets, total, gaps, close });

describe("fitHeadline", () => {
  it("counts whole criteria and says how many are only partly met", () => {
    expect(fitHeadline(fit(0, 1, [], ["Required skills"]))).toBe("0 of 1 criterion fully met, 1 partly");
    expect(fitHeadline(fit(3, 5, ["Location"], ["Skills"]))).toBe("3 of 5 criteria fully met, 1 partly");
    expect(fitHeadline(fit(4, 4))).toBe("4 of 4 criteria fully met");
  });

  it("is null when there is nothing to compare", () => {
    expect(fitHeadline(fit(0, 0))).toBeNull();
  });
});

describe("candidateSignal", () => {
  it("keeps Strong only when the criteria agree", () => {
    expect(candidateSignal(44, fit(2, 2)).label).toBe("Strong match");
    expect(candidateSignal(44, fit(0, 1, [], ["Required skills"])).label).toBe("Promising match");
    expect(candidateSignal(60, fit(1, 2, ["Experience"])).label).toBe("Promising match");
  });

  it("follows the score band below the strong line", () => {
    expect(candidateSignal(39, fit(2, 2)).label).toBe("Fair match");
    expect(candidateSignal(19, fit(2, 2)).label).toBe("Low match");
  });

  it("reads Low when a fair score meets no criterion at all", () => {
    expect(candidateSignal(25, fit(0, 2, ["Required skills", "Experience"])).label).toBe("Low match");
    expect(candidateSignal(25, fit(0, 2, ["Experience"], ["Required skills"])).label).toBe("Fair match");
  });

  it("treats a candidate with no comparable criteria like the score alone", () => {
    expect(candidateSignal(44, fit(0, 0)).label).toBe("Strong match");
  });
});
