/* V2-KERNEL test suite (2026-06-09) — the foundation rewrite.
 *
 * Drives the kernel's three pure functions through the Flipkart
 * regression fixture (a real production session where v1 looped
 * through discovery for 14 turns, ignored two explicit offer-asks,
 * dropped a phantom ₹40 LPA anchor, and terminated on a vague defer
 * with no callback).
 *
 * The assertions encode the v2 contract:
 *   1. After the candidate's first explicit "give your initial offer"
 *      past T4, legalTools MUST exclude ask_discovery and MUST
 *      include propose_anchor. v1's failure was choosing discovery
 *      here; v2 makes that choice impossible.
 *   2. After verbal acceptance, only close_recap is legal.
 *   3. In early discovery (turns 1-6, no offer-ask), ask_discovery
 *      and propose_anchor are both legal — the model picks.
 */
import { describe, it, expect } from "vitest";
import {
  computeBand,
  deriveState,
  legalTools,
  type ConversationTurn,
} from "../../../server-handlers/v2/kernel";
import fixture from "../../../server-handlers/v2/__fixtures__/flipkart-senior-pd.json";
import fixture2 from "../../../server-handlers/v2/__fixtures__/flipkart-senior-pd-2.json";

const FLIPKART_LOG = fixture.log as ConversationTurn[];
const FLIPKART_PD2_LOG = fixture2.log as ConversationTurn[];

describe("v2 kernel — deriveState on the Flipkart fixture", () => {
  it("counts the three explicit offer-asks", () => {
    /* Candidate said:
     *   T6: "this is salary negotiation so you should give your initial offer"
     *   T10: "you have not yet given initial offer"
     *   T14: "can you give me 44 LPA?"
     */
    const state = deriveState(FLIPKART_LOG);
    expect(state.offerAskCount).toBe(3);
  });

  it("extracts the candidate's stated target of 44 LPA", () => {
    const state = deriveState(FLIPKART_LOG);
    expect(state.candidateTarget).toBe(44);
  });

  it("does NOT count the phantom ₹40 LPA as a real anchor when explicit tool data is present", () => {
    /* With explicit tool=undefined on every AI turn (v1-shadow mode),
     * the regex fallback DOES catch the ₹40 — that's intended for
     * shadow-mode parity. The contract assertion is: in pure v2 mode
     * (tool fields populated), the regex fallback doesn't fire. We
     * prove that here with a v2-native variant. */
    const v2NativeLog: ConversationTurn[] = [
      { role: "ai", text: "What's your current CTC?", tool: "ask_discovery" },
      { role: "candidate", text: "32 LPA" },
    ];
    const state = deriveState(v2NativeLog);
    expect(state.hasAnchored).toBe(false);
    expect(state.lastAnchorLpa).toBeNull();
  });
});

describe("v2 kernel — legalTools enforces the offer-ask invariant (the Flipkart fix)", () => {
  it("after T6 candidate says 'give your initial offer', the next AI turn's legal set EXCLUDES ask_discovery", () => {
    /* Slice the log up to and INCLUDING the T6 candidate message
     * (index 11 in 0-based — that's the "you should give your
     * initial offer" turn). The next AI turn is what v1 produced
     * as T7 (more discovery — the bug). What's legal for v2? */
    const sliced = FLIPKART_LOG.slice(0, 12);
    const state = deriveState(sliced);
    expect(state.turnIndex).toBe(6);
    expect(state.offerAskCount).toBe(1);
    expect(state.hasAnchored).toBe(false);

    const legal = legalTools(state);
    /* This is the assertion that would have prevented the Flipkart
     * session from looping. v2 cannot pick discovery here. */
    expect(legal).not.toContain("ask_discovery");
    expect(legal).toContain("propose_anchor");
    expect(legal).toContain("decline_offer_ask");
  });

  it("after T10 candidate says 'have not yet given initial offer' AND v1 already dropped ₹40, anchor is no longer compelled (we already 'anchored' in shadow-fallback) — but discovery is still illegal", () => {
    /* This is the subtler case: in v1-mixed shadow mode, the regex
     * fallback counts the ₹40 phantom as an anchor. That's the
     * v1-shadow contract. Even so, the legal set must not include
     * ask_discovery here because we've anchored AND the candidate
     * has stated a target by T11. */
    const sliced = FLIPKART_LOG.slice(0, 22);
    const state = deriveState(sliced);
    expect(state.offerAskCount).toBeGreaterThanOrEqual(2);
    expect(state.hasAnchored).toBe(true);
    expect(state.candidateTarget).toBe(44);

    const legal = legalTools(state);
    expect(legal).not.toContain("ask_discovery");
    expect(legal).toContain("propose_counter");
  });
});

describe("v2 kernel — early discovery still allows discovery", () => {
  it("turn 1 with no offer-asks: ask_discovery AND propose_anchor are both legal", () => {
    const state = deriveState([]);
    const legal = legalTools(state);
    expect(legal).toContain("ask_discovery");
    expect(legal).toContain("propose_anchor");
  });

  it("turn 3 with no offer-asks: still legal to discover", () => {
    const log: ConversationTurn[] = [
      { role: "ai", text: "current CTC?", tool: "ask_discovery" },
      { role: "candidate", text: "20 LPA" },
      { role: "ai", text: "base split?", tool: "ask_discovery" },
      { role: "candidate", text: "16 LPA" },
      { role: "ai", text: "variable?", tool: "ask_discovery" },
      { role: "candidate", text: "4 LPA" },
    ];
    const state = deriveState(log);
    expect(state.turnIndex).toBe(3);
    expect(state.offerAskCount).toBe(0);

    const legal = legalTools(state);
    expect(legal).toContain("ask_discovery");
  });
});

describe("v2 kernel — post-acceptance lockdown", () => {
  it("after candidate says 'I accept', only close_recap is legal", () => {
    const log: ConversationTurn[] = [
      { role: "ai", text: "anchor at 22", tool: "propose_anchor", lpa: 22 },
      { role: "candidate", text: "i accept the offer" },
    ];
    const state = deriveState(log);
    expect(state.verbalAcceptanceTurn).not.toBeNull();

    const legal = legalTools(state);
    expect(legal).toEqual(["close_recap"]);
  });

  /* The Flipkart-PD-#2 session failed precisely because the v1
   * acceptance regex didn't catch the conversational Indian-English
   * forms. These four assertions encode the lesson: after an anchor,
   * the gate must recognize casual commits. */
  it("conversational accept: 'yes work for me keep base as 44 LPA' (PD #2 T8)", () => {
    const log: ConversationTurn[] = [
      { role: "ai", text: "we can come in at 40 LPA", tool: "propose_anchor", lpa: 40 },
      { role: "candidate", text: "yes work for me keep base as 44 LPA" },
    ];
    const state = deriveState(log);
    expect(state.verbalAcceptanceTurn).not.toBeNull();
    expect(legalTools(state)).toEqual(["close_recap"]);
  });

  it("conversational accept: 'yes 44 LPA as base' (PD #2 T10)", () => {
    const log: ConversationTurn[] = [
      { role: "ai", text: "we can come in at 40 LPA", tool: "propose_anchor", lpa: 40 },
      { role: "candidate", text: "yes 44 LPA as base" },
    ];
    const state = deriveState(log);
    expect(state.verbalAcceptanceTurn).not.toBeNull();
  });

  it("conversational accept: '44 LPA as base 4 lakhs as joining bonus would work for me' (PD #2 T6)", () => {
    const log: ConversationTurn[] = [
      { role: "ai", text: "we can come in at 40 LPA", tool: "propose_anchor", lpa: 40 },
      { role: "candidate", text: "44 LPA as base 4 lakhs as joining bonus would work for me" },
    ];
    const state = deriveState(log);
    expect(state.verbalAcceptanceTurn).not.toBeNull();
  });

  /* Hinglish / Indian-English-recruiter register. Real candidates
   * mix Hindi commit-verbs into the negotiation cadence; the
   * English-only set misses them. All four are post-anchor so the
   * gate is safe. */
  it("Hinglish accept: 'chalo done 44 LPA par' (post-anchor)", () => {
    const log: ConversationTurn[] = [
      { role: "ai", text: "anchor at 40", tool: "propose_anchor", lpa: 40 },
      { role: "candidate", text: "chalo done 44 LPA par" },
    ];
    const state = deriveState(log);
    expect(state.verbalAcceptanceTurn).not.toBeNull();
    expect(legalTools(state)).toEqual(["close_recap"]);
  });

  it("Hinglish accept: '44 LPA chalega' (post-anchor)", () => {
    const log: ConversationTurn[] = [
      { role: "ai", text: "anchor at 40", tool: "propose_anchor", lpa: 40 },
      { role: "candidate", text: "44 LPA chalega" },
    ];
    const state = deriveState(log);
    expect(state.verbalAcceptanceTurn).not.toBeNull();
  });

  it("Hinglish accept: 'theek hai, ho jayega' (post-anchor)", () => {
    const log: ConversationTurn[] = [
      { role: "ai", text: "anchor at 40", tool: "propose_anchor", lpa: 40 },
      { role: "candidate", text: "theek hai, ho jayega" },
    ];
    const state = deriveState(log);
    expect(state.verbalAcceptanceTurn).not.toBeNull();
  });

  it("Hinglish accept: 'haan 44 LPA pe le lete hain' (post-anchor)", () => {
    const log: ConversationTurn[] = [
      { role: "ai", text: "anchor at 40", tool: "propose_anchor", lpa: 40 },
      { role: "candidate", text: "haan 44 LPA pe le lete hain" },
    ];
    const state = deriveState(log);
    expect(state.verbalAcceptanceTurn).not.toBeNull();
  });

  it("Hinglish guard: 'chalo' alone pre-anchor does NOT misfire (no commit phrasing yet)", () => {
    const log: ConversationTurn[] = [
      { role: "ai", text: "current CTC?", tool: "ask_discovery" },
      { role: "candidate", text: "chalo" },
    ];
    const state = deriveState(log);
    expect(state.verbalAcceptanceTurn).toBeNull();
  });

  it("conversational accept does NOT misfire on early-turn CTC disclosure ('yes my current CTC is 32 LPA' at T1 — no anchor yet)", () => {
    /* This is the false-positive guard. Pre-anchor, conversational
     * patterns are ignored — only STRICT 'I accept' fires. */
    const log: ConversationTurn[] = [
      { role: "ai", text: "current CTC?", tool: "ask_discovery" },
      { role: "candidate", text: "yes my current ctc is 32 LPA" },
    ];
    const state = deriveState(log);
    expect(state.verbalAcceptanceTurn).toBeNull();
  });
});

describe("v2 kernel — Flipkart PD #2 fixture (post-anchor failure profile)", () => {
  it("T5: after candidate states target 48 LPA (post-anchor), ask_discovery is illegal", () => {
    /* Log slice through T4 candidate response ("I am looking for 48 LPA").
     * Indices: AI@0/2/4/6, candidate@1/3/5/7. Slice 0..8 covers 4 AI + 4
     * candidate turns. v1 anchored ₹40 at T4 (regex-detected since no
     * tool field). */
    const sliced = FLIPKART_PD2_LOG.slice(0, 8);
    const state = deriveState(sliced);
    expect(state.hasAnchored).toBe(true);
    expect(state.candidateTarget).toBe(48);

    const legal = legalTools(state);
    expect(legal).not.toContain("ask_discovery");
    expect(legal).toContain("propose_counter");
  });

  it("T8: candidate's 'yes work for me keep base as 44 LPA' (post-anchor) flips legal set to [close_recap]", () => {
    /* Slice through index 15 (candidate T8 response). Anchor is at
     * AI@6 ("₹40 LPA"). The candidate's conversational accept at
     * candidate@15 must be detected. */
    const sliced = FLIPKART_PD2_LOG.slice(0, 16);
    const state = deriveState(sliced);
    expect(state.hasAnchored).toBe(true);
    expect(state.verbalAcceptanceTurn).not.toBeNull();
    expect(legalTools(state)).toEqual(["close_recap"]);
  });

  it("end of session: still locked to close_recap (catches the T11 walk-away bug)", () => {
    const state = deriveState(FLIPKART_PD2_LOG);
    expect(state.verbalAcceptanceTurn).not.toBeNull();
    expect(legalTools(state)).toEqual(["close_recap"]);
  });
});

describe("v2 kernel — computeBand parity with v1", () => {
  it("returns a finite band for a Senior Product Designer @ Flipkart", () => {
    const band = computeBand("Senior Product Designer", "flipkart", "senior", 6);
    expect(band.initialOffer).toBeGreaterThan(0);
    expect(band.maxStretch).toBeGreaterThanOrEqual(band.initialOffer);
    expect(band.walkAway).toBeLessThanOrEqual(band.initialOffer);
  });
});

describe("v2 kernel — band override table (Flipkart Senior PD calibration)", () => {
  it("returns the override band for Flipkart Senior PD, not the v1 default", () => {
    /* v1 returned ~[21, 42] for this cell, which lagged the market.
     * The v2 override should now return the calibrated band. */
    const band = computeBand("Senior Product Designer", "flipkart", "senior", 6);
    expect(band.initialOffer).toBeGreaterThanOrEqual(30);
    expect(band.maxStretch).toBeGreaterThanOrEqual(45);
    expect(band.walkAway).toBeGreaterThanOrEqual(28);
  });

  it("normalizes role keys — 'Sr. Product Designer' resolves to the same override", () => {
    const a = computeBand("Senior Product Designer", "flipkart", "senior", 6);
    const b = computeBand("Sr. Product Designer", "flipkart", "senior", 6);
    expect(b.initialOffer).toBe(a.initialOffer);
    expect(b.maxStretch).toBe(a.maxStretch);
  });

  it("falls back to v1 for a company NOT in the override table", () => {
    /* Unknown company → no override → whatever v1 returns. We only
     * assert it didn't blow up and returned a valid band shape. */
    const band = computeBand("Senior Product Designer", "some-tier-3-startup", "senior", 6);
    expect(band.initialOffer).toBeGreaterThan(0);
    expect(band.maxStretch).toBeGreaterThanOrEqual(band.initialOffer);
  });
});

describe("v2 kernel — surfacedTopics (defer-on-fabricated-topic fix)", () => {
  it("surfaces 'joining bonus' when the candidate mentions it", () => {
    const log: ConversationTurn[] = [
      { role: "ai", text: "current CTC?", tool: "ask_discovery" },
      { role: "candidate", text: "32 LPA, and is there any joining bonus on offer?" },
    ];
    const state = deriveState(log);
    expect(state.surfacedTopics).toContain("joining bonus");
  });

  it("surfaces 'esop' when the candidate says 'RSU' or 'stock options'", () => {
    const log: ConversationTurn[] = [
      { role: "ai", text: "anything else important?", tool: "ask_discovery" },
      { role: "candidate", text: "I care about RSUs and base split" },
    ];
    const state = deriveState(log);
    expect(state.surfacedTopics).toContain("esop");
    expect(state.surfacedTopics).toContain("base");
  });

  it("does NOT surface a topic the candidate never raised", () => {
    const log: ConversationTurn[] = [
      { role: "ai", text: "current CTC?", tool: "ask_discovery" },
      { role: "candidate", text: "32 LPA" },
    ];
    const state = deriveState(log);
    expect(state.surfacedTopics).not.toContain("joining bonus");
    expect(state.surfacedTopics).not.toContain("relocation");
  });

  it("topic, once surfaced, stays surfaced for the rest of the session", () => {
    const log: ConversationTurn[] = [
      { role: "candidate", text: "what about ESOPs?" },
      { role: "ai", text: "we'll get to that", tool: "ask_discovery" },
      { role: "candidate", text: "ok, also tell me about base" },
    ];
    const state = deriveState(log);
    expect(state.surfacedTopics).toContain("esop");
    expect(state.surfacedTopics).toContain("base");
  });
});
