import { describe, it, expect } from "vitest";
import type { Candidate } from "@/employer/mockData";
import { composeRejectNote, rankCandidates, shortlistPosition } from "../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/helpers";

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
