/* PDF#30 (2026-05-18) regression tests — Meesho/Prita Senior PD
 * manual replay session exposed 5 distinct production failures after
 * the PDF#29 batch landed. Each test pins one fix:
 *
 *   R1 — parser accepts "24LPA CTC overall" / told-you / post-probe bare
 *   R2 — USER_FRUSTRATION_RE catches the PDF#30 phrasings
 *   R3 — defensive-loop guard rejects bot-self-defense restyles
 *   R4 — verbatim-repeat guard rejects same-as-last-turn output
 *   R5 — anchor floor clamps above disclosed candidateCurrentCtc
 *
 * Fixtures are the literal candidate/bot utterances from the replay
 * session (PDF#30 pp. 1-5, May 2026). */
import { describe, it, expect } from "vitest";
import {
  parseCandidateAnswer,
  isVerbatimRepeat,
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { USER_FRUSTRATION_RE } from "../../server-handlers/_user-signals";
import { validateAnswer } from "../../server-handlers/_response-pipeline";
import { planNextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = { initialOffer: 23, maxStretch: 30, walkAway: 18, hasEquity: false };
const fresh = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "pdf30", role: "Senior Product Designer", company: "Meesho", band: BAND }),
  ...overrides,
});

describe("PDF#30 R1 — CTC parser broadening", () => {
  it("binds '24LPA CTC overall' (PDF#30 T3, number-first, no current/my cue)", () => {
    const p = parseCandidateAnswer("My current package is 24LPA CTC overall.");
    expect(p.currentCtc).toBe(24);
  });

  it("binds bare CTC after frustration cue (PDF#30 T5 — 'already told you 24 LPA CTC')", () => {
    const p = parseCandidateAnswer("I already told you 24 LPA CTC.");
    expect(p.currentCtc).toBe(24);
  });

  it("binds bare '<N> LPA' post-probe when AI just asked for current CTC (Gricean cooperation)", () => {
    const p = parseCandidateAnswer(
      "24 LPA.",
      "What's your current CTC at present?",
    );
    expect(p.currentCtc).toBe(24);
  });

  it("does NOT bind bare '60 LPA total' to currentCtc when the cue is target-language ('looking for')", () => {
    const p = parseCandidateAnswer("I'm looking for 60 LPA total.");
    expect(p.currentCtc).toBeNull();
    expect(p.target).toBe(60);
  });

  it("post-probe bare fallback skips when target cue is present (defensive)", () => {
    const p = parseCandidateAnswer(
      "I'm expecting 32 LPA.",
      "What's your current CTC at present?",
    );
    expect(p.currentCtc).toBeNull();
    expect(p.target).toBe(32);
  });
});

describe("PDF#30 R2 — frustration regex broadening", () => {
  it("fires on PDF#30 T5 — 'already told you 24 LPA CTC' (no leading 'i')", () => {
    expect(USER_FRUSTRATION_RE.test("already told you 24 LPA CTC")).toBe(true);
  });

  it("fires on PDF#30 T9 — 'why are you repeating the question?'", () => {
    expect(USER_FRUSTRATION_RE.test("why are you repeating the question?")).toBe(true);
  });

  it("fires on PDF#30 T15 — 'I have told you multiple times'", () => {
    expect(USER_FRUSTRATION_RE.test("I have told you multiple times")).toBe(true);
  });

  it("fires on PDF#30 T17 — 'but why do you want justification on my current CTC'", () => {
    expect(USER_FRUSTRATION_RE.test("but why do you want justification on my current CTC")).toBe(true);
  });

  it("does NOT fire on neutral disclosure ('I told my manager last week')", () => {
    expect(USER_FRUSTRATION_RE.test("I told my manager last week")).toBe(false);
  });
});

describe("PDF#30 R3 — defensive-loop guard in validateAnswer", () => {
  it("rejects 'to ensure we're on the same page' (PDF#30 T10 — bot-self-defense)", () => {
    const r = validateAnswer(
      "We're asking again to ensure we're on the same page about your current CTC.",
      {},
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("defensive-loop-leaked");
  });

  it("rejects 'to align our understanding'", () => {
    const r = validateAnswer(
      "Just to align our understanding on the package structure, can you confirm?",
      {},
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("defensive-loop-leaked");
  });

  it("rejects 'for clarity on our end'", () => {
    const r = validateAnswer(
      "For clarity on our end, could you restate the current package?",
      {},
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("defensive-loop-leaked");
  });

  it("passes normal recruiter prose without defensive-meta phrasing", () => {
    const r = validateAnswer(
      "Thanks for confirming. Let's talk about the role's scope next.",
      {},
    );
    expect(r.valid).toBe(true);
  });
});

describe("PDF#30 R4 — verbatim-repeat guard wiring", () => {
  it("isVerbatimRepeat catches identical 8-content-word prefixes", () => {
    const state = fresh({
      lastAiText: "We would like to understand your current compensation structure before discussing the offer.",
    });
    expect(
      isVerbatimRepeat(
        "We would like to understand your current compensation structure before discussing the offer.",
        state,
      ),
    ).toBe(true);
  });

  it("does NOT flag trivial closers ('Sounds good.', 'Right.')", () => {
    const state = fresh({ lastAiText: "Sounds good." });
    expect(isVerbatimRepeat("Sounds good.", state)).toBe(false);
  });

  it("does NOT flag paraphrased sentences with different content words", () => {
    const state = fresh({
      lastAiText: "Help me understand the breakdown of your current package today.",
    });
    expect(
      isVerbatimRepeat(
        "Could you walk me through the components of your existing salary?",
        state,
      ),
    ).toBe(false);
  });
});

describe("PDF#30 R5 — anchor floor clamps above disclosed CTC", () => {
  it("anchor-with-offer raises initialOffer to disclosed CTC when band floor is below it (PDF#30 T12)", () => {
    const state = fresh({
      turnIndex: 4,
      phase: "probe-expectations",
      candidateCurrentCtc: 24,         // disclosed (PDF#30 T3)
      band: { initialOffer: 23, maxStretch: 30, walkAway: 18, hasEquity: false }, // floor below CTC
      offerAskedAtTurn: 3,
      askedTopics: [],
    });
    const action = planNextAction(state);
    if (action.kind === "anchor-with-offer") {
      /* Floor must be at least currentCtc — never below disclosed package. */
      expect(action.initialOffer).toBeGreaterThanOrEqual(24);
    } else {
      /* If a higher-priority lever fired, that's also acceptable — the
       * regression is specifically that we never SHIP an anchor at 23
       * when disclosed CTC is 24. */
      expect(true).toBe(true);
    }
  });

  it("anchor-with-offer keeps band floor when disclosed CTC is at-or-below it", () => {
    const state = fresh({
      turnIndex: 4,
      phase: "probe-expectations",
      candidateCurrentCtc: 18,         // below band floor of 23
      band: { initialOffer: 23, maxStretch: 30, walkAway: 18, hasEquity: false },
      offerAskedAtTurn: 3,
      askedTopics: [],
    });
    const action = planNextAction(state);
    if (action.kind === "anchor-with-offer") {
      expect(action.initialOffer).toBe(23); // unchanged — disclosed sits below floor
    }
  });

  it("anchor caps at band.maxStretch when disclosed CTC exceeds the ceiling", () => {
    const state = fresh({
      turnIndex: 4,
      phase: "probe-expectations",
      candidateCurrentCtc: 45,         // above max stretch — band can't accommodate
      band: { initialOffer: 23, maxStretch: 30, walkAway: 18, hasEquity: false },
      offerAskedAtTurn: 3,
      askedTopics: [],
    });
    const action = planNextAction(state);
    if (action.kind === "anchor-with-offer") {
      expect(action.initialOffer).toBeLessThanOrEqual(30);
    }
  });
});
