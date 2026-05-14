/* Phase 34 (2026-05-14) — kernel audit event derivation.
 *
 * Tests the pure event-derivation function against real kernel state
 * transitions. Each test runs the kernel for one or two turns and
 * asserts the emitted event sequence is exactly what we expect. This
 * pins the audit contract so future kernel changes that affect
 * observability fail CI rather than silently degrade post-mortem
 * quality.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  pickAiMove,
  applyAiMove,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";
import { deriveKernelEvents } from "../../server-handlers/_kernel-audit";

const BAND: NegotiationBand = { initialOffer: 30, maxStretch: 60, walkAway: 22, hasEquity: true };

describe("Phase 34 — deriveKernelEvents", () => {
  it("emits no events when nothing changed", () => {
    const state = initState({ sessionId: "s", role: "Software Engineer", company: "accenture", band: BAND });
    expect(deriveKernelEvents(state, state)).toEqual([]);
  });

  it("emits FRESH_GRAD_DISCLOSED + BAND_REBASED on first disclosure", () => {
    const state = initState({
      sessionId: "s",
      role: "Software Engineer",
      company: "accenture",
      band: { initialOffer: 35, maxStretch: 65, walkAway: 28, hasEquity: true },
      candidateApplicableYoe: 5,
    });
    const next = applyCandidateAnswer(state, "Actually I'm a fresh graduate.");
    const events = deriveKernelEvents(state, next);
    const types = events.map((e) => e.type);
    expect(types).toContain("FRESH_GRAD_DISCLOSED");
    expect(types).toContain("BAND_REBASED");
    const rebase = events.find((e) => e.type === "BAND_REBASED");
    if (rebase && rebase.type === "BAND_REBASED") {
      expect(rebase.reason).toBe("fresh-grad-disclosure");
      expect(rebase.toInitialOffer).toBeLessThan(rebase.fromInitialOffer);
    }
  });

  it("emits PHASE_TRANSITION + TERMINAL_ENTRY on acceptance", () => {
    const base = initState({ sessionId: "s", role: "Software Engineer", company: "accenture", band: BAND });
    /* Set up an offer first so acceptance is meaningful. */
    const moved = applyAiMove(base, { lever: "open-with-offer", newTotalLpa: 30, rationale: "open" }, "opener");
    const next = applyCandidateAnswer(moved, "Yes, I accept the offer.");
    const events = deriveKernelEvents(moved, next);
    const types = events.map((e) => e.type);
    expect(types).toContain("PHASE_TRANSITION");
    expect(types).toContain("TERMINAL_ENTRY");
    const terminal = events.find((e) => e.type === "TERMINAL_ENTRY");
    if (terminal && terminal.type === "TERMINAL_ENTRY") {
      expect(terminal.phase).toBe("accepted");
    }
  });

  it("emits LEVER_FIRED when a move is applied", () => {
    const state = initState({ sessionId: "s", role: "Software Engineer", company: "accenture", band: BAND });
    const move = pickAiMove(state);
    const next = applyAiMove(state, move, "x");
    const events = deriveKernelEvents(state, next, move);
    const lever = events.find((e) => e.type === "LEVER_FIRED");
    expect(lever).toBeDefined();
    if (lever && lever.type === "LEVER_FIRED") {
      expect(lever.lever).toBe(move.lever);
    }
  });

  it("emits HIGHEST_OFFER_BUMPED when an offer is applied above prior max", () => {
    const state = initState({ sessionId: "s", role: "Software Engineer", company: "accenture", band: BAND });
    const move = { lever: "open-with-offer" as const, newTotalLpa: 35, rationale: "open" };
    const next = applyAiMove(state, move, "x");
    const events = deriveKernelEvents(state, next, move);
    const bump = events.find((e) => e.type === "HIGHEST_OFFER_BUMPED");
    expect(bump).toBeDefined();
    if (bump && bump.type === "HIGHEST_OFFER_BUMPED") {
      expect(bump.from).toBe(0);
      expect(bump.to).toBe(35);
    }
  });

  it("emits JOINING_BONUS_SET on a JB lever with amount", () => {
    const state = initState({ sessionId: "s", role: "Software Engineer", company: "accenture", band: BAND });
    const move = {
      lever: "joining-bonus" as const,
      newTotalLpa: null,
      joiningBonusAmount: 3,
      rationale: "jb",
    };
    const next = applyAiMove(state, move, "x");
    const events = deriveKernelEvents(state, next, move);
    const jb = events.find((e) => e.type === "JOINING_BONUS_SET");
    expect(jb).toBeDefined();
    if (jb && jb.type === "JOINING_BONUS_SET") {
      expect(jb.amount).toBe(3);
    }
  });

  it("does NOT emit FRESH_GRAD_DISCLOSED on a sticky-second disclosure", () => {
    const base = initState({
      sessionId: "s",
      role: "Software Engineer",
      company: "accenture",
      band: { initialOffer: 35, maxStretch: 65, walkAway: 28, hasEquity: true },
      candidateApplicableYoe: 5,
    });
    const afterFirst = applyCandidateAnswer(base, "I'm a fresh graduate.");
    const afterSecond = applyCandidateAnswer(afterFirst, "Like I said, fresh grad.");
    const events = deriveKernelEvents(afterFirst, afterSecond);
    expect(events.find((e) => e.type === "FRESH_GRAD_DISCLOSED")).toBeUndefined();
    expect(events.find((e) => e.type === "BAND_REBASED")).toBeUndefined();
  });

  it("derivation is pure — same inputs always yield same events", () => {
    const state = initState({ sessionId: "s", role: "Software Engineer", company: "accenture", band: BAND });
    const next = applyCandidateAnswer(state, "Yes, I accept.");
    const e1 = deriveKernelEvents(state, next);
    const e2 = deriveKernelEvents(state, next);
    expect(e1).toEqual(e2);
  });
});
