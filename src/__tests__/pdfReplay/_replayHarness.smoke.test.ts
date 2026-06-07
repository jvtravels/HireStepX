/* Month 3 PR-1 — Replay-harness smoke tests.
 *
 * Locks the harness contract before any PDF fixture starts depending
 * on it. Asserts:
 *   - replayTranscript drives state forward turn by turn
 *   - decisionLog grows by 1 per turn
 *   - guardrail flags, ledger facts, and reader functions all work
 *     against the replayed state exactly as they do in live sessions
 *   - replayUpTo is a strict prefix of replayTranscript */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  replayUpTo,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import {
  getFact,
  size,
} from "../../../server-handlers/_conversation-ledger";
import {
  countGuardrailFlag,
  guardrailFlagSummary,
  lastFamilyEmitted,
} from "../../../server-handlers/_decision-log-readers";

const SMOKE_FIXTURE: ReplayInput = {
  init: pdfReplayInit("m3-pr1-smoke"),
  turns: [
    { candidate: "My current CTC is 14 LPA.", aiText: "Got it." },
    { candidate: "I'm asking for 28 LPA.", aiText: "Why 28?" },
    { candidate: "Because I've been delivering platform-level impact.", aiText: "Understood." },
  ],
};

describe("M3 PR-1 — replayTranscript drives a session end-to-end", () => {
  it("returns a NegotiationState with one decisionLog entry per turn", () => {
    const state = replayTranscript(SMOKE_FIXTURE);
    expect(state.decisionLog?.length).toBe(SMOKE_FIXTURE.turns.length);
  });

  it("populates the ledger from candidate disclosures", () => {
    const state = replayTranscript(SMOKE_FIXTURE);
    /* current-ctc disclosure on turn 1 should land in the ledger via
     * the M1 dual-write. */
    expect(getFact(state.ledger!, "current-ctc")).toBe(14);
    expect(size(state.ledger!)).toBeGreaterThan(0);
  });

  it("decisionLog entries carry actionKind + family (M2 PR-2 stamp)", () => {
    const state = replayTranscript(SMOKE_FIXTURE);
    const entries = state.decisionLog ?? [];
    /* At least one entry should have an actionKind+family stamped (not
     * every turn will set actionKind — depends on planner branch). */
    const stamped = entries.filter((e) => e.actionKind && e.family);
    expect(stamped.length).toBeGreaterThan(0);
  });

  it("reader functions work against the replayed state", () => {
    const state = replayTranscript(SMOKE_FIXTURE);
    /* The smoke fixture has no consecutive coercive moves so the
     * pressure-repeat count should be 0. */
    expect(countGuardrailFlag(state, "pressure-repeat")).toBe(0);
    expect(guardrailFlagSummary(state)).toBeDefined();
    /* lastFamilyEmitted may return null when the most recent move's
     * branch had no actionKind (e.g. info-disclosure levers). We assert
     * the call doesn't throw — value can be null or a family string. */
    const lastFam = lastFamilyEmitted(state);
    expect(lastFam === null || typeof lastFam === "string").toBe(true);
  });
});

describe("M3 PR-1 — replayUpTo is a strict prefix", () => {
  it("replayUpTo(n) has exactly n decisionLog entries", () => {
    const partial = replayUpTo(SMOKE_FIXTURE, 2);
    expect(partial.decisionLog?.length).toBe(2);
  });

  it("replayUpTo(0) returns the initial state with no decisions", () => {
    const partial = replayUpTo(SMOKE_FIXTURE, 0);
    expect(partial.decisionLog ?? []).toEqual([]);
  });

  it("replayUpTo(N) equals replayTranscript for full N", () => {
    const full = replayTranscript(SMOKE_FIXTURE);
    const partial = replayUpTo(SMOKE_FIXTURE, SMOKE_FIXTURE.turns.length);
    expect(partial.decisionLog?.length).toBe(full.decisionLog?.length);
    expect(getFact(partial.ledger!, "current-ctc")).toBe(
      getFact(full.ledger!, "current-ctc"),
    );
  });
});

describe("M3 PR-1 — harness handles empty / single-turn inputs", () => {
  it("zero turns returns clean initial state", () => {
    const state = replayTranscript({
      init: pdfReplayInit("m3-pr1-empty"),
      turns: [],
    });
    expect(state.decisionLog ?? []).toEqual([]);
    expect(size(state.ledger!)).toBe(0);
  });

  it("single turn produces exactly one decision entry", () => {
    const state = replayTranscript({
      init: pdfReplayInit("m3-pr1-single"),
      turns: [{ candidate: "Hi.", aiText: "Hello." }],
    });
    expect(state.decisionLog?.length).toBe(1);
  });
});
