import { describe, it, expect } from "vitest";
import { checkFollowUpCap } from "../_follow-up-cap";

describe("checkFollowUpCap", () => {
  const q = { type: "question" as const };
  const fu = { type: "follow-up" as const };
  const intro = { type: "intro" as const };
  const closing = { type: "closing" as const };

  it("allows insertion when no follow-ups exist yet", () => {
    const r = checkFollowUpCap({ script: [intro, q, q, q, q, q, closing] });
    expect(r.allowed).toBe(true);
    expect(r.currentTurns).toBe(5);
    expect(r.maxTurns).toBe(8); // 5 + ceil(5*0.5) = 5 + 3
  });

  it("3-question mini session caps at 5 total turns", () => {
    const r = checkFollowUpCap({ script: [intro, q, q, q] });
    expect(r.maxTurns).toBe(5); // 3 + ceil(3*0.5) = 3 + 2
    expect(r.allowed).toBe(true);
  });

  it("blocks insertion when cap is reached", () => {
    const r = checkFollowUpCap({ script: [intro, q, fu, q, fu, q, fu, fu] });
    // 3 questions + 4 follow-ups = 7 turns, max is 5 → blocked
    expect(r.currentTurns).toBe(7);
    expect(r.maxTurns).toBe(5);
    expect(r.allowed).toBe(false);
  });

  it("blocks exactly at the boundary", () => {
    // 5 questions, max = 8; with 8 turns already (5 q + 3 fu), no more
    const r = checkFollowUpCap({ script: [intro, q, fu, q, fu, q, fu, q, q, closing] });
    expect(r.currentTurns).toBe(8);
    expect(r.maxTurns).toBe(8);
    expect(r.allowed).toBe(false);
  });

  it("ignores intro and closing in counts", () => {
    const r = checkFollowUpCap({ script: [intro, intro, closing, closing] });
    expect(r.currentTurns).toBe(0);
    expect(r.maxTurns).toBe(0);
    expect(r.allowed).toBe(false); // 0 < 0 = false; defensible (no questions = no insertion)
  });

  it("scales linearly: 10 base questions → max 15 turns", () => {
    const script = [intro, ...Array(10).fill(q), closing];
    const r = checkFollowUpCap({ script });
    expect(r.maxTurns).toBe(15);
  });
});
