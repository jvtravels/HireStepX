import { describe, expect, it } from "vitest";
import { buildRoundProgress, roundProgressDetail, roundProgressHeadline } from "../sessionReport/roundProgress";

const pts = (scores: number[]) => scores.map((score, i) => ({ id: `s${i}`, score }));
const sess = (id: string, focus: string | null = "behavioral") => ({ id, type: "behavioral", focus });

describe("buildRoundProgress", () => {
  it("returns null without a focus, because the trend then mixes rounds", () => {
    expect(buildRoundProgress(sess("s1", null), pts([80, 82]))).toBeNull();
  });

  it("returns null when the viewed session is not in the trend", () => {
    expect(buildRoundProgress(sess("zzz"), pts([80, 82]))).toBeNull();
  });

  it("counts only sessions up to and including the viewed one", () => {
    const p = buildRoundProgress(sess("s1"), pts([72, 75, 90]))!;
    expect(p.qualifying).toBe(2);
    expect(p.cleared).toBe(true);
    const earlier = buildRoundProgress(sess("s0"), pts([72, 75, 90]))!;
    expect(earlier.qualifying).toBe(1);
    expect(earlier.needed).toBe(1);
    expect(earlier.cleared).toBe(false);
  });

  it("flags a viewed session below the bar", () => {
    const p = buildRoundProgress(sess("s1"), pts([80, 55]))!;
    expect(p.viewedQualifies).toBe(false);
    expect(roundProgressHeadline(p)).toBe("1 more session at 70+ to clear Behavioral");
    expect(roundProgressDetail(p)).toBe("This session scored 55, so it does not count yet. 1 of 2 sessions at 70+ so far.");
  });

  it("pluralises when two are needed and labels the round by focus", () => {
    const p = buildRoundProgress({ id: "s0", type: "behavioral", focus: "hr-round" }, pts([60]))!;
    expect(p.label).toBe("HR Round");
    expect(roundProgressHeadline(p)).toBe("2 more sessions at 70+ to clear HR Round");
  });

  it("says the count covers the latest 10 once the window is full", () => {
    const p = buildRoundProgress(sess("s9"), pts([50, 50, 50, 50, 50, 50, 50, 50, 50, 90]))!;
    expect(roundProgressDetail(p)).toContain("in your latest 10");
  });
});
