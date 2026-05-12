/* Tests for the salary-negotiation canonical state kernel.
 * ─────────────────────────────────────────────────────────────────────
 * The kernel is pure — no LLM, no IO, no clock — so the test surface
 * is dense and deterministic. Each test pins one behaviour we expect
 * the legacy architecture's bug class to no longer have a place to
 * live.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  parseCandidateAnswer,
  applyCandidateAnswer,
  foldFactsIntoState,
  derivePhase,
  pickAiMove,
  applyAiMove,
  findOutOfBandNumber,
  isVerbatimRepeat,
  serializeState,
  deserializeState,
  isTerminalPhase,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import type { NegotiationFacts } from "../interviewEvaluation";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };
const init = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s1", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});

/* ─── parseCandidateAnswer ─────────────────────────────────────── */

describe("parseCandidateAnswer", () => {
  it("binds explicit target", () => {
    const p = parseCandidateAnswer("I'm looking for around 25 LPA.");
    expect(p.target).toBe(25);
    expect(p.currentCtc).toBeNull();
  });

  it("binds 'my current package is X' to currentCtc, NOT target", () => {
    /* The Bombay Design Centre regression. */
    const p = parseCandidateAnswer("It's on current package progression because my current package is around 8.5 LPA.");
    expect(p.currentCtc).toBe(8.5);
    expect(p.target).toBeNull();
  });

  it("binds 'currently earning X' to currentCtc", () => {
    const p = parseCandidateAnswer("I'm currently earning 18 LPA at my current company.");
    expect(p.currentCtc).toBe(18);
    expect(p.target).toBeNull();
  });

  it("binds 'in-hand offer of X' to competing, NOT target", () => {
    const p = parseCandidateAnswer("I already have an offer of 24 LPA in hand.");
    expect(p.competing).toBe(24);
    expect(p.target).toBeNull();
  });

  it("disambiguates when same number could match multiple categories", () => {
    /* Mentioning current 18 AND wanting 18 shouldn't double-bind. */
    const p = parseCandidateAnswer("I'm currently at 18 LPA and I'd like 18 LPA in the new role too.");
    expect(p.currentCtc).toBe(18);
    expect(p.target).toBeNull();
  });

  it("detects acceptance", () => {
    expect(parseCandidateAnswer("I accept the offer.").signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer("Sounds good, let's go ahead.").signalsAcceptance).toBe(true);
  });

  it("rejects conditional acceptance", () => {
    expect(parseCandidateAnswer("I accept if you can add a joining bonus.").signalsAcceptance).toBe(false);
  });

  it("rejects 'I accept but I want more' as negotiation", () => {
    expect(parseCandidateAnswer("I'd accept but I want a bit more on base.").signalsAcceptance).toBe(false);
  });

  it("catches real-world acceptance phrases that the old regex missed", () => {
    /* Tech-Mahindra UX session, May 2026: candidate said all three of
       these and the kernel never transitioned to accepted, so the AI
       kept probing for expectations. Each must register. */
    expect(parseCandidateAnswer(
      "I am very excited to join, completely agree with your offer."
    ).signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer(
      "Whatever is your initial offer, I am accepting your initial offer."
    ).signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer(
      "Why are you still asking? I've already accepted."
    ).signalsAcceptance).toBe(true);
  });

  it("catches soft-acceptance phrases from MakeMyTrip UX session (May 2026)", () => {
    /* Real session capture: candidate said "yes, I like the initial offer"
       and "we have already aligned with the initial offer" — the kernel
       missed both and kept probing for expectations, infuriating the
       candidate. Each must register as acceptance. */
    expect(parseCandidateAnswer(
      "Yes, I like the initial offer. Can you give me a breakdown?"
    ).signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer(
      "We have already aligned with the initial offer. Right? Why are you asking again?"
    ).signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer(
      "I'm aligned with your offer."
    ).signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer(
      "The offer aligns with my expectations."
    ).signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer(
      "I'm fine with the offer."
    ).signalsAcceptance).toBe(true);
  });

  it("catches 'I would like to accept' / 'I want to accept' (Lollypop session, May 2026)", () => {
    /* Real session capture: candidate said verbatim "I would like to
       accept your offer. Overall, CTC is good for me." — textbook
       acceptance. The kernel matched none of its patterns (the
       MakeMyTrip-batch rewrite dropped these forms) and kept probing.
       Re-anchor with explicit "would like to" / "want to" verbs. */
    expect(parseCandidateAnswer(
      "I would like to accept your offer. Overall, CTC is good for me."
    ).signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer(
      "I'd like to accept the offer."
    ).signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer(
      "I want to accept this offer."
    ).signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer(
      "I would love to accept your offer."
    ).signalsAcceptance).toBe(true);
  });

  it("does NOT fire on weak-affirmative conversational starters (Accenture session, May 2026)", () => {
    /* Real session capture: candidate said "It okay. Let's get started."
       at the very first turn — clearly conversational filler, not an
       acceptance of the offer. The kernel jumped to `accepted` and
       ignored a subsequent explicit counter ("I was looking around 32
       lakhs"). Weak-affirmative phrases that don't reference the
       offer/deal/number must not trigger acceptance. */
    expect(parseCandidateAnswer("It okay. Let's get started.").signalsAcceptance).toBe(false);
    expect(parseCandidateAnswer("Okay, let's begin.").signalsAcceptance).toBe(false);
    expect(parseCandidateAnswer("Sure, let's get started.").signalsAcceptance).toBe(false);
    expect(parseCandidateAnswer("Alright let's start.").signalsAcceptance).toBe(false);
    /* But once the candidate actually names the offer, soft acceptance
       still fires (regression guard for MakeMyTrip batch). */
    expect(parseCandidateAnswer("Okay, I like the offer.").signalsAcceptance).toBe(true);
  });

  it("catches more idiomatic English acceptance forms", () => {
    expect(parseCandidateAnswer("I'll take it.").signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer("I'm in.").signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer("Your offer works for me.").signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer("Let's lock it in.").signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer("Done deal.").signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer("I have accepted your offer.").signalsAcceptance).toBe(true);
  });

  it("binds bare number in probe-expectations phase as target", () => {
    /* Tech-Mahindra UX session (May 2026): candidate replied
       "30 lpa thirty lakhs per ctc" with no "want / expecting / looking for"
       cue, so the old parser left target=null and the AI kept probing.
       In probe-expectations phase, a bare number with no current/competing
       markers is the expectation. */
    const p = parseCandidateAnswer("30 lpa thirty lakhs per ctc", "", "probe-expectations");
    expect(p.target).toBe(30);
    expect(p.currentCtc).toBeNull();
    expect(p.competing).toBeNull();
  });

  it("does NOT bind bare number outside probe-expectations phase", () => {
    /* The fallback is intentionally narrow — only fires in probe phase to
       avoid ambiguous binding mid-counter. */
    const p = parseCandidateAnswer("30 lpa", "", "counter-offer");
    expect(p.target).toBeNull();
  });

  it("still binds 'my current ctc is X' when phase=probe-expectations", () => {
    /* Bare-number fallback must NOT swallow numbers attached to current CTC.
       Guard tested explicitly so future relaxation can't break it. */
    const p = parseCandidateAnswer("my current ctc is 18 LPA", "", "probe-expectations");
    expect(p.currentCtc).toBe(18);
    expect(p.target).toBeNull();
  });

  it("detects walk-away", () => {
    expect(parseCandidateAnswer("I'm going to have to pass.").signalsWalkAway).toBe(true);
    expect(parseCandidateAnswer("This won't work, I'll walk away.").signalsWalkAway).toBe(true);
  });

  it("scales crore to LPA on competing offers (senior/exec packages)", () => {
    /* Bug class: extractFirstNumber accepted `crore` in the regex but
       returned the raw digit, so "1.5 crore" parsed as 1.5 LPA. The
       clamp at 500 then truncated higher numbers silently. Both fixed
       — crore is normalised to LPA and the clamp is widened to 5000. */
    const p1 = parseCandidateAnswer("I already have an offer of 1.5 crore in hand.");
    expect(p1.competing).toBe(150);

    const p2 = parseCandidateAnswer("I have a competing offer of 3 cr from another firm.");
    expect(p2.competing).toBe(300);
  });

  it("scales crore on current-CTC for senior candidates", () => {
    const p = parseCandidateAnswer("My current package is 1.2 crore at my current company.");
    expect(p.currentCtc).toBe(120);
  });

  it("scales crore on target for executive asks", () => {
    const p = parseCandidateAnswer("I'm expecting around 2 crore for this role.");
    expect(p.target).toBe(200);
  });

  it("rejects absurd magnitudes outside the widened clamp", () => {
    /* 100 crore = 10000 LPA — outside the 5000 ceiling, rejected. */
    const p = parseCandidateAnswer("I'm looking for 100 crore.");
    expect(p.target).toBeNull();
  });

  it("accepts Hindi acceptance phrases", () => {
    expect(parseCandidateAnswer("Theek hai, kar dijiye.").signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer("Ho jayega, manzoor hai.").signalsAcceptance).toBe(true);
    expect(parseCandidateAnswer("Haan thik hai, accept.").signalsAcceptance).toBe(true);
  });

  it("Hindi 'agar' conditional blocks acceptance", () => {
    /* "Agar joining bonus mile, theek hai" — conditional accept, not real. */
    const p = parseCandidateAnswer("Agar joining bonus mile, theek hai.");
    expect(p.signalsAcceptance).toBe(false);
  });

  it("accepts Hindi walk-away phrases", () => {
    expect(parseCandidateAnswer("Mujhe nahi chahiye, sorry.").signalsWalkAway).toBe(true);
    expect(parseCandidateAnswer("Nahi karna mujhe.").signalsWalkAway).toBe(true);
    expect(parseCandidateAnswer("Yeh nahi banega.").signalsWalkAway).toBe(true);
  });

  it("parses Hinglish word-numbers (tees/chalees/pachas LPA)", () => {
    /* Hinglish word-numbers like "tees" (30), "chalees" (40), "pachas"
       (50) are common when candidates code-switch into Hindi for the
       count. Pre-substitute into digits at the parser entry. */
    expect(parseCandidateAnswer("Mujhe tees LPA chahiye.").target).toBe(30);
    expect(parseCandidateAnswer("I'm looking for chalees LPA total.").target).toBe(40);
    expect(parseCandidateAnswer("I want pachas LPA total.").target).toBe(50);
  });

  it("parses Hinglish currentCtc anchors", () => {
    const p = parseCandidateAnswer("Currently bees LPA pe hu.");
    expect(p.currentCtc).toBe(20);
  });

  it("parses USD comp ($150k) and converts to LPA at 83 INR/USD", () => {
    /* $150k × 83 / 100k = 124.5 LPA */
    const p = parseCandidateAnswer("I'm expecting $150k for this role.");
    expect(p.target).toBe(124.5);
  });

  it("parses USD with comma format ($120,000)", () => {
    /* $120,000 × 83 / 100k = 99.6 LPA */
    const p = parseCandidateAnswer("I'm currently earning $120,000 at my US employer.");
    expect(p.currentCtc).toBe(99.6);
  });

  it("parses USD competing offer", () => {
    /* $180k × 83 / 100k = 149.4 LPA */
    const p = parseCandidateAnswer("I already have an offer of $180k from a US firm.");
    expect(p.competing).toBe(149.4);
  });

  it("parses Indian comma-formatted lakhs (30,00,000 LPA)", () => {
    /* 30,00,000 → strip commas → 3000000 LPA — outside clamp, rejected.
       The realistic candidate input is "30 LPA" or "30 lakhs" though, so
       this just confirms the clamp catches the unrealistic case. */
    const p = parseCandidateAnswer("I'm expecting 30,00,000 lakhs.");
    expect(p.target).toBeNull();
  });

  it("parses currentCtc range and binds upper bound", () => {
    const p = parseCandidateAnswer("I'm currently earning 25-28 LPA at my company.");
    expect(p.currentCtc).toBe(28);
  });

  it("parses crore range and scales upper bound (1-1.5 crore = 150 LPA)", () => {
    /* Range regex has unit-on-tail, extractFirstNumber detects crore
       in m[0] and scales — so the upper-bound crore should resolve. */
    const p = parseCandidateAnswer("I'm looking for 1-1.5 crore for this role.");
    expect(p.target).toBe(150);
  });

  it("binds the upper bound when candidate states a range", () => {
    /* Candidates anchor at the top of a stated range, so the upper
       bound is the meaningful target signal. */
    const p1 = parseCandidateAnswer("I'm looking for 30-35 LPA for this role.");
    expect(p1.target).toBe(35);

    const p2 = parseCandidateAnswer("Target around 28 to 32 lakhs.");
    expect(p2.target).toBe(32);

    const p3 = parseCandidateAnswer("Between ₹40 – ₹50 LPA would work.");
    expect(p3.target).toBe(50);
  });

  it("handles empty input safely", () => {
    expect(parseCandidateAnswer("")).toEqual({
      target: null, currentCtc: null, competing: null,
      signalsAcceptance: false, signalsWalkAway: false,
      targetAsRange: false, vossTactics: [], infoAsked: [],
      signalsCompetingExistsWithoutNumber: false,
    });
  });
});

/* ─── applyCandidateAnswer ────────────────────────────────────── */

describe("applyCandidateAnswer", () => {
  it("folds target into state and advances phase", () => {
    /* Need an offer made for counter-offer phase. */
    let s = init({ highestOfferMade: 20, phase: "offer-presented" });
    s = applyCandidateAnswer(s, "I'm looking for 26 LPA.");
    expect(s.candidateTarget).toBe(26);
    expect(s.phase).toBe("counter-offer");
  });

  it("does NOT bind current-package number to target", () => {
    let s = init({ highestOfferMade: 20, phase: "offer-presented" });
    s = applyCandidateAnswer(s, "My current package is around 18 LPA, that's my baseline.");
    expect(s.candidateCurrentCtc).toBe(18);
    expect(s.candidateTarget).toBeNull();
    expect(s.phase).toBe("probe-expectations");
  });

  it("transitions to accepted on acceptance signal", () => {
    let s = init({ highestOfferMade: 22, phase: "counter-offer" });
    s = applyCandidateAnswer(s, "OK, I accept.");
    expect(s.phase).toBe("accepted");
    expect(s.acceptedAtTurn).toBe(0);
  });

  it("transitions to walked-away on walk-away signal", () => {
    let s = init({ highestOfferMade: 22, phase: "counter-offer" });
    s = applyCandidateAnswer(s, "I'll have to pass on this one.");
    expect(s.phase).toBe("walked-away");
    expect(s.walkedAwayAtTurn).toBe(0);
  });

  it("terminal phases are sticky", () => {
    let s = init({ phase: "accepted", acceptedAtTurn: 3 });
    s = applyCandidateAnswer(s, "Actually let me reconsider, I want 30 LPA.");
    expect(s.phase).toBe("accepted");
    expect(s.candidateTarget).toBeNull();
  });

  it("does not mutate input state", () => {
    const s1 = init({ highestOfferMade: 20, phase: "offer-presented" });
    const s2 = applyCandidateAnswer(s1, "I want 25 LPA.");
    expect(s1.candidateTarget).toBeNull();
    expect(s2.candidateTarget).toBe(25);
  });

  it("revised target overwrites earlier target", () => {
    let s = init({ highestOfferMade: 20, phase: "offer-presented", candidateTarget: 30 });
    s = applyCandidateAnswer(s, "OK, I'd settle for 25 LPA actually.");
    expect(s.candidateTarget).toBe(25);
  });
});

/* ─── derivePhase ─────────────────────────────────────────────── */

describe("derivePhase", () => {
  it("opening when no offer made", () => {
    expect(derivePhase(init())).toBe("opening");
  });

  it("offer-presented when offer made, no candidate target", () => {
    expect(derivePhase(init({ highestOfferMade: 20 }))).toBe("offer-presented");
  });

  it("counter-offer when both offer and target exist", () => {
    expect(derivePhase(init({ highestOfferMade: 20, candidateTarget: 25 }))).toBe("counter-offer");
  });

  it("lever-explore when target above maxStretch and 2+ levers used", () => {
    expect(derivePhase(init({
      highestOfferMade: 28, candidateTarget: 35,
      leversUsed: ["open-with-offer", "counter-base"],
    }))).toBe("lever-explore");
  });

  it("stalemate when turn cap reached", () => {
    expect(derivePhase(init({ turnIndex: 8, maxTurns: 8 }))).toBe("stalemate");
  });

  it("terminal phases pass through unchanged", () => {
    expect(derivePhase(init({ phase: "accepted" }))).toBe("accepted");
    expect(derivePhase(init({ phase: "walked-away" }))).toBe("walked-away");
  });

  it("does NOT regress from counter-offer back to probe-expectations", () => {
    /* MakeMyTrip UX session (May 2026): after the candidate engaged
       with the offer and asked for a breakdown, the kernel re-derived
       phase as probe-expectations on the next turn (because target
       wasn't restated). The AI then asked "what are you hoping to
       achieve" — three turns deep into the conversation. */
    const s = init({
      phase: "counter-offer",
      highestOfferMade: 20,
      candidateTarget: null, // candidate didn't restate this turn
      leversUsed: ["open-with-offer", "counter-base"],
    });
    expect(derivePhase(s)).toBe("counter-offer");
  });

  it("does NOT regress from lever-explore back to probe-expectations", () => {
    const s = init({
      phase: "lever-explore",
      highestOfferMade: 24,
      candidateTarget: null,
      leversUsed: ["open-with-offer", "counter-base", "equity-grant"],
    });
    expect(derivePhase(s)).toBe("lever-explore");
  });

  it("if already probed AND candidate engaged, goes to counter-offer not probe", () => {
    /* Once probe has fired AND the candidate revealed ANY signal
       (current CTC, competing offer, asked a question, used a tactic),
       further turns belong in counter-offer territory — re-probing
       would be circular. */
    const s = init({
      highestOfferMade: 20,
      candidateTarget: null,
      leversUsed: ["open-with-offer", "probe"],
      infoAsked: ["fixed-vs-variable"],
    });
    expect(derivePhase(s)).toBe("counter-offer");
  });
});

/* ─── pickAiMove ──────────────────────────────────────────────── */

describe("pickAiMove", () => {
  it("opening → open-with-offer at band initial", () => {
    const m = pickAiMove(init());
    expect(m.lever).toBe("open-with-offer");
    expect(m.newTotalLpa).toBe(20);
  });

  it("offer-presented (no target) → probe", () => {
    const m = pickAiMove(init({ phase: "offer-presented", highestOfferMade: 20 }));
    expect(m.lever).toBe("probe");
    expect(m.newTotalLpa).toBeNull();
  });

  it("intent override: candidate asked for breakdown → benefits-summary, NOT probe (Lollypop, May 2026)", () => {
    /* Real session: phase was offer-presented, candidate said "could
       you walk me through the package?", kernel returned `probe`
       ("what range are you targeting?"). Phase-only routing missed the
       intent. Phase 3 of the rebuild adds an intent override: when
       infoAsked contains a breakdown-style intent AND an offer has been
       made AND benefits-summary has not yet been used, jump to
       benefits-summary. */
    const m = pickAiMove(init({
      phase: "offer-presented",
      highestOfferMade: 20,
      infoAsked: ["package-breakdown"],
    }));
    expect(m.lever).toBe("benefits-summary");
    expect(m.newTotalLpa).toBe(20);
  });

  it("intent override does NOT fire when benefits-summary was already used (one-shot)", () => {
    const m = pickAiMove(init({
      phase: "offer-presented",
      highestOfferMade: 20,
      infoAsked: ["package-breakdown"],
      leversUsed: ["open-with-offer", "benefits-summary"],
    }));
    expect(m.lever).toBe("probe");
  });

  it("intent override does NOT fire before an offer has been made", () => {
    const m = pickAiMove(init({
      phase: "opening",
      highestOfferMade: 0,
      infoAsked: ["package-breakdown"],
    }));
    expect(m.lever).toBe("open-with-offer");
  });

  it("fixed-vs-variable intent also routes to benefits-summary override", () => {
    /* Symmetric to package-breakdown — the candidate asking for the
       fixed/variable split is the same shape of ask, just narrower. */
    const m = pickAiMove(init({
      phase: "offer-presented",
      highestOfferMade: 20,
      infoAsked: ["fixed-vs-variable"],
    }));
    expect(m.lever).toBe("benefits-summary");
  });

  it("counter-offer splits floor → aspiration", () => {
    /* floor=20, target=26, ceiling=28 → split = 20 + (26-20)*0.5 = 23 */
    const m = pickAiMove(init({ phase: "counter-offer", highestOfferMade: 20, candidateTarget: 26 }));
    expect(m.lever).toBe("counter-base");
    expect(m.newTotalLpa).toBe(23);
  });

  it("counter-offer caps at maxStretch when target above ceiling", () => {
    /* target=40, ceiling=28 → aspiration=28, split = 20 + (28-20)*0.5 = 24 */
    const m = pickAiMove(init({ phase: "counter-offer", highestOfferMade: 20, candidateTarget: 40 }));
    expect(m.newTotalLpa).toBe(24);
  });

  it("counter-offer stiffens on repeated counter-base pulls (anti-exploitation)", () => {
    /* floor=20, target=40, ceiling=28 → aspiration=28. Schedule
       0.5 / 0.35 / 0.22 / 0.12 / 0.06 — so a candidate who keeps
       hammering the same demand pulls the AI ever-smaller increments
       rather than reaching maxStretch in 2 turns. */
    const base = { phase: "counter-offer" as const, highestOfferMade: 20, candidateTarget: 40 };

    const t1 = pickAiMove(init({ ...base, leversUsed: [] }));
    expect(t1.newTotalLpa).toBe(24); // 20 + 8 * 0.5

    const t2 = pickAiMove(init({ ...base, leversUsed: ["counter-base"] }));
    expect(t2.newTotalLpa).toBe(22.8); // 20 + 8 * 0.35

    const t3 = pickAiMove(init({ ...base, leversUsed: ["counter-base", "counter-base"] }));
    expect(t3.newTotalLpa).toBe(21.8); // 20 + 8 * 0.22 = 21.76 → 21.8

    /* Past schedule: floors at 0.05 split. */
    const tLate = pickAiMove(init({ ...base, leversUsed: Array(10).fill("counter-base") }));
    expect(tLate.newTotalLpa).toBe(20.4); // 20 + 8 * 0.05
  });

  it("counter-offer rotates to lever-explore when no headroom", () => {
    /* floor=28, target=30, ceiling=28 → aspiration=28, no headroom.
       With equity-first ordering, the cheapest concession (equity grant)
       leads when the band supports it. */
    const m = pickAiMove(init({
      phase: "counter-offer", highestOfferMade: 28, candidateTarget: 30,
    }));
    expect(m.lever).toBe("equity-grant");
  });

  it("lever-explore (equity band): equity → joining-bonus → notice-buyout → benefits → hold-firm", () => {
    /* Equity-first ordering: equity vests over years (paper, dilutive),
       joining bonus is sunk cash at hire — so equity is cheaper for the
       company P&L and is offered first. */
    let state = init({ phase: "lever-explore", highestOfferMade: 28, candidateTarget: 35 });
    expect(pickAiMove(state).lever).toBe("equity-grant");

    state = { ...state, leversUsed: ["equity-grant"] };
    expect(pickAiMove(state).lever).toBe("joining-bonus");

    state = { ...state, leversUsed: ["equity-grant", "joining-bonus"] };
    expect(pickAiMove(state).lever).toBe("notice-buyout");

    state = { ...state, leversUsed: ["equity-grant", "joining-bonus", "notice-buyout"] };
    expect(pickAiMove(state).lever).toBe("benefits-summary");

    state = { ...state, leversUsed: ["equity-grant", "joining-bonus", "notice-buyout", "benefits-summary"] };
    expect(pickAiMove(state).lever).toBe("hold-firm");
  });

  it("lever-explore (no-equity band): joining-bonus leads", () => {
    /* Without equity in the band, joining-bonus is the cheapest available
       lever and goes first. */
    const noEquityBand = { ...BAND, hasEquity: false };
    const state: NegotiationState = {
      ...init({ phase: "lever-explore", highestOfferMade: 28, candidateTarget: 35 }),
      band: noEquityBand,
    };
    expect(pickAiMove(state).lever).toBe("joining-bonus");
  });

  it("lever-explore skips equity-grant when band has no equity", () => {
    const noEquityBand = { ...BAND, hasEquity: false };
    const state: NegotiationState = {
      ...init({ phase: "lever-explore", highestOfferMade: 28, candidateTarget: 35, leversUsed: ["joining-bonus"] }),
      band: noEquityBand,
    };
    expect(pickAiMove(state).lever).toBe("notice-buyout");
  });

  it("accepted → close-acceptance with highest offer", () => {
    const m = pickAiMove(init({ phase: "accepted", highestOfferMade: 24 }));
    expect(m.lever).toBe("close-acceptance");
    expect(m.newTotalLpa).toBe(24);
  });

  it("walked-away → close-walkaway, no number", () => {
    const m = pickAiMove(init({ phase: "walked-away" }));
    expect(m.lever).toBe("close-walkaway");
    expect(m.newTotalLpa).toBeNull();
  });

  it("stalemate → close-stalemate", () => {
    const m = pickAiMove(init({ phase: "stalemate", highestOfferMade: 22 }));
    expect(m.lever).toBe("close-stalemate");
    expect(m.newTotalLpa).toBe(22);
  });
});

/* ─── applyAiMove ─────────────────────────────────────────────── */

describe("applyAiMove", () => {
  it("increments turn, appends lever, updates highestOfferMade", () => {
    let s = init();
    s = applyAiMove(s, { lever: "open-with-offer", newTotalLpa: 20, rationale: "" }, "Here's our offer: ₹20 LPA");
    expect(s.turnIndex).toBe(1);
    expect(s.leversUsed).toEqual(["open-with-offer"]);
    expect(s.highestOfferMade).toBe(20);
    expect(s.lastAiText).toContain("₹20 LPA");
  });

  it("doesn't lower highestOfferMade when new move is smaller", () => {
    let s = init({ highestOfferMade: 24 });
    s = applyAiMove(s, { lever: "hold-firm", newTotalLpa: 22, rationale: "" }, "Holding at our line.");
    expect(s.highestOfferMade).toBe(24);
  });

  it("preserves terminal phase across AI move", () => {
    let s = init({ phase: "accepted", acceptedAtTurn: 2 });
    s = applyAiMove(s, { lever: "close-acceptance", newTotalLpa: 22, rationale: "" }, "Welcome aboard.");
    expect(s.phase).toBe("accepted");
  });
});

/* ─── foldFactsIntoState ──────────────────────────────────────── */

describe("foldFactsIntoState", () => {
  const blankFacts: NegotiationFacts = {
    acceptedImmediately: false,
    rejectedOutright: false,
    candidateCounter: null,
    candidateAskTotal: null,
    candidateAskBase: null,
    candidateCurrentCTC: null,
    hasCompetingOffers: false,
    competingOfferAmount: null,
    topicsRaised: [],
    deflectedNumbers: false,
    askedForTime: false,
    usedTacticalSilence: false,
    mentionedBATNA: false,
    expressedSurprise: false,
  };

  it("imports candidateCounter as target", () => {
    const s = foldFactsIntoState(init(), { ...blankFacts, candidateCounter: "₹26 LPA" });
    expect(s.candidateTarget).toBe(26);
  });

  it("imports current CTC and competing separately", () => {
    const s = foldFactsIntoState(init(), {
      ...blankFacts,
      candidateCurrentCTC: "₹18 LPA",
      competingOfferAmount: "₹24 LPA",
    });
    expect(s.candidateCurrentCtc).toBe(18);
    expect(s.competingOffer).toBe(24);
  });

  it("acceptance flag transitions to terminal", () => {
    const s = foldFactsIntoState(init({ turnIndex: 4 }), { ...blankFacts, acceptedImmediately: true });
    expect(s.phase).toBe("accepted");
    expect(s.acceptedAtTurn).toBe(4);
  });
});

/* ─── findOutOfBandNumber ──────────────────────────────────────── */

describe("findOutOfBandNumber", () => {
  it("returns null when in-band", () => {
    expect(findOutOfBandNumber("Let me come back to you at ₹22 LPA total.", BAND)).toBeNull();
  });

  it("flags number above maxStretch", () => {
    expect(findOutOfBandNumber("I can go to ₹40 LPA on this.", BAND)).toBe(40);
  });

  it("flags number below walkAway", () => {
    expect(findOutOfBandNumber("Our floor is ₹10 LPA.", BAND)).toBe(10);
  });

  it("flags crore notation above maxStretch (LLM injection guard)", () => {
    /* The LLM could route around the LPA-only matcher by writing
       "₹2 crore". Scale crore→LPA so the band check applies. */
    expect(findOutOfBandNumber("I can stretch to ₹2 crore for you.", BAND)).toBe(200);
    expect(findOutOfBandNumber("How about ₹1.5 cr total?", BAND)).toBe(150);
  });

  it("does not flag in-band crore", () => {
    /* 0.22 crore = 22 LPA, inside BAND [16, 28]. */
    expect(findOutOfBandNumber("We can do ₹0.22 crore.", BAND)).toBeNull();
  });

  it("flags Rs. and INR prefixes (notation-switch guard)", () => {
    /* An LLM switching from ₹ to Rs. / INR shouldn't bypass the check. */
    expect(findOutOfBandNumber("My final offer is Rs. 40 LPA total.", BAND)).toBe(40);
    expect(findOutOfBandNumber("How about INR 35 lakhs?", BAND)).toBe(35);
    expect(findOutOfBandNumber("We can do Rs 2 crore.", BAND)).toBe(200);
  });

  it("flags bare unit-suffix numbers without currency prefix", () => {
    /* Real MakeMyTrip UX bug: the static-script opener said
       "We're offering 35 LPA" with no ₹/Rs/INR prefix. The pre-fix
       regex required a currency token and skipped it entirely. */
    expect(findOutOfBandNumber("We're offering 35 LPA basic.", BAND)).toBe(35);
    expect(findOutOfBandNumber("That comes to 40 lakhs total.", BAND)).toBe(40);
  });

  it("does NOT use walkAway as a floor when band is inverted (walkAway > maxStretch)", () => {
    /* The salary-lookup band sometimes ships {init,max,walk} with
       walk > max (walk is recruiter ceiling, max is offer ceiling).
       In that mode walkAway is meaningless as a candidate floor, so
       the under-floor check must be suppressed — otherwise every
       legitimate offer gets flagged as out-of-band and dropped. */
    const inverted = { initialOffer: 20, maxStretch: 26.9, walkAway: 31.9, hasEquity: false };
    expect(findOutOfBandNumber("We're offering ₹20 LPA.", inverted)).toBeNull();
    expect(findOutOfBandNumber("We can stretch to ₹26 LPA.", inverted)).toBeNull();
    /* Above maxStretch is still flagged. */
    expect(findOutOfBandNumber("We can do ₹35 LPA.", inverted)).toBe(35);
  });
});

/* ─── Voss tactic detection ───────────────────────────────────── */

describe("Voss tactic detection", () => {
  it("detects mirroring (echo + question)", () => {
    const p = parseCandidateAnswer("Specific benefits?", "What's most important — base, overall CTC, or specific benefits?");
    expect(p.vossTactics).toContain("mirror");
  });

  it("detects labeling", () => {
    const p = parseCandidateAnswer("It sounds like budget is tight on this req.");
    expect(p.vossTactics).toContain("label");
  });

  it("detects calibrated how-question", () => {
    const p = parseCandidateAnswer("How am I supposed to accept this when comparable roles offer 35 LPA?");
    expect(p.vossTactics).toContain("calibrated");
  });

  it("detects sign-today bundle", () => {
    const p = parseCandidateAnswer("If you can do 30 base, 5L joining bonus, and an equity refresh I'll sign today.");
    expect(p.vossTactics).toContain("sign-today-bundle");
  });

  it("detects current-CTC deflection", () => {
    const p = parseCandidateAnswer("I'd rather not share my current CTC; let's focus on the expected range for this role.");
    expect(p.vossTactics).toContain("deflect-current-ctc");
  });

  it("does not flag generic 'how are you' pleasantries", () => {
    const p = parseCandidateAnswer("How are you today?");
    expect(p.vossTactics).not.toContain("calibrated");
  });
});

/* ─── Info-intent detection ───────────────────────────────────── */

describe("Info-intent detection", () => {
  it("detects clawback question", () => {
    expect(parseCandidateAnswer("What's the clawback period on the joining bonus?").infoAsked).toContain("clawback-period");
  });
  it("detects vest schedule question", () => {
    expect(parseCandidateAnswer("Can you walk me through the vesting schedule and cliff?").infoAsked).toContain("vest-schedule");
  });
  it("detects strike price question", () => {
    expect(parseCandidateAnswer("What's the strike price based on the last 409A?").infoAsked).toContain("strike-price");
  });
  it("detects variable history question", () => {
    expect(parseCandidateAnswer("What was the variable payout percentage over the last 3 years?").infoAsked).toContain("variable-history");
  });
  it("detects in-hand monthly question", () => {
    expect(parseCandidateAnswer("Can I see the in-hand monthly breakdown?").infoAsked).toContain("in-hand-monthly");
  });
  it("detects fixed-vs-variable split question", () => {
    expect(parseCandidateAnswer("What's the fixed vs variable split of the CTC?").infoAsked).toContain("fixed-vs-variable");
  });
  it("detects exercise window question", () => {
    expect(parseCandidateAnswer("What's the post-termination exercise window for ESOPs?").infoAsked).toContain("exercise-window");
  });
  it("detects acceleration question", () => {
    expect(parseCandidateAnswer("Is there accelerated vesting on change of control?").infoAsked).toContain("acceleration");
  });
  it("detects package-breakdown intent (Lollypop, May 2026)", () => {
    /* The recurrent failure mode: candidate asks "walk me through the
       offer" / "break it down" / "what's in the package", AI responded
       with a probe instead of enumerating. New intent + override fixes it. */
    expect(parseCandidateAnswer("Can you walk me through the package?").infoAsked).toContain("package-breakdown");
    expect(parseCandidateAnswer("Could you break the offer down for me?").infoAsked).toContain("package-breakdown");
    expect(parseCandidateAnswer("What's the structure of the CTC?").infoAsked).toContain("package-breakdown");
    expect(parseCandidateAnswer("Tell me more about the package.").infoAsked).toContain("package-breakdown");
  });
});

/* ─── Range ask + competing-without-number ────────────────────── */

describe("targetAsRange + competing-without-number", () => {
  it("flags range target", () => {
    const p = parseCandidateAnswer("I'm looking for 30-35 LPA total.");
    expect(p.targetAsRange).toBe(true);
    expect(p.target).toBe(35);
  });

  it("flags competing without number when hedged", () => {
    const p = parseCandidateAnswer("I have a competing offer but I can't share details.");
    expect(p.competing).toBeNull();
    expect(p.signalsCompetingExistsWithoutNumber).toBe(true);
  });

  it("does not flag competing-without-number when number is present", () => {
    const p = parseCandidateAnswer("I have a competing offer of 32 LPA.");
    expect(p.signalsCompetingExistsWithoutNumber).toBe(false);
    expect(p.competing).toBe(32);
  });
});

/* ─── State application: tactics + walk-away-return ──────────── */

describe("applyCandidateAnswer — tactics", () => {
  it("accumulates voss tactics across turns (sticky)", () => {
    let s = init();
    s = applyCandidateAnswer(s, "It sounds like budget is tight.");
    expect(s.vossTacticsUsed).toContain("label");
    s = applyCandidateAnswer(s, "How can we make this work at 30?");
    expect(s.vossTacticsUsed).toContain("calibrated");
    expect(s.vossTacticsUsed).toContain("label"); // still there
  });

  it("re-opens after walk-away on engagement", () => {
    let s = init({ phase: "walked-away", walkedAwayAtTurn: 2 });
    s = applyCandidateAnswer(s, "Actually let me reconsider — can we get to 25?");
    expect(s.phase).not.toBe("walked-away");
    expect(s.walkAwayReturned).toBe(true);
  });

  it("does NOT re-open on another walk-away phrase", () => {
    let s = init({ phase: "walked-away", walkedAwayAtTurn: 2 });
    s = applyCandidateAnswer(s, "I'm walking away for real now.");
    expect(s.phase).toBe("walked-away");
    expect(s.walkAwayReturned).toBe(false);
  });
});

/* ─── pickAiMove — tactic boosts + modes ───────────────────────── */

describe("pickAiMove tactic boosts", () => {
  it("boosts counter for calibrated+range vs naked counter", () => {
    const base = init({ phase: "counter-offer", candidateTarget: 30, highestOfferMade: 20 });
    const boosted = init({
      phase: "counter-offer", candidateTarget: 30, highestOfferMade: 20,
      candidateAskedAsRange: true,
      vossTacticsUsed: ["calibrated", "label"],
    });
    const m1 = pickAiMove(base);
    const m2 = pickAiMove(boosted);
    expect(m2.newTotalLpa).toBeGreaterThan(m1.newTotalLpa ?? 0);
  });

  it("hardBandCap routes to lever-explore instead of counter-base", () => {
    const s = init({ phase: "counter-offer", candidateTarget: 30, highestOfferMade: 20, hardBandCap: true });
    const m = pickAiMove(s);
    expect(m.lever).not.toBe("counter-base");
  });

  it("verbalAcceptanceTurn forces hold-firm on subsequent counter", () => {
    const s = init({
      phase: "counter-offer", candidateTarget: 30, highestOfferMade: 22,
      verbalAcceptanceTurn: 3,
    });
    const m = pickAiMove(s);
    expect(m.lever).toBe("hold-firm");
  });

  it("soft market reduces concession vs hot market", () => {
    const soft = init({ phase: "counter-offer", candidateTarget: 30, highestOfferMade: 20, marketMode: "soft" });
    const hot = init({ phase: "counter-offer", candidateTarget: 30, highestOfferMade: 20, marketMode: "hot" });
    const ms = pickAiMove(soft);
    const mh = pickAiMove(hot);
    expect(mh.newTotalLpa).toBeGreaterThan(ms.newTotalLpa ?? 0);
  });

  it("walkAwayReturned halves concession curve", () => {
    const normal = init({ phase: "counter-offer", candidateTarget: 30, highestOfferMade: 20 });
    const returned = init({ phase: "counter-offer", candidateTarget: 30, highestOfferMade: 20, walkAwayReturned: true });
    const mn = pickAiMove(normal);
    const mr = pickAiMove(returned);
    expect(mr.newTotalLpa).toBeLessThan(mn.newTotalLpa ?? Infinity);
  });
});

/* ─── Deserialize backward compatibility ───────────────────────── */

describe("deserializeState backfills new optional fields", () => {
  it("accepts pre-tactic-fields state and defaults the new ones", () => {
    /* Simulate an older serialized session that predates the tactic
       fields. */
    const old = {
      sessionId: "s1", role: "swe", company: "acme",
      band: BAND,
      phase: "opening" as const,
      turnIndex: 0, maxTurns: 8,
      candidateTarget: null, candidateCurrentCtc: null, competingOffer: null,
      highestOfferMade: 0, leversUsed: [], lastAiText: "",
      acceptedAtTurn: null, walkedAwayAtTurn: null,
    };
    const s = deserializeState(JSON.stringify(old));
    expect(s.vossTacticsUsed).toEqual([]);
    expect(s.infoAsked).toEqual([]);
    expect(s.marketMode).toBe("neutral");
    expect(s.hardBandCap).toBe(false);
    expect(s.walkAwayReturned).toBe(false);
    expect(s.verbalAcceptanceTurn).toBeNull();
    expect(s.finalOfferAssertedCount).toBe(0);
    expect(s.candidateAskedAsRange).toBe(false);
  });
});

/* ─── isVerbatimRepeat ─────────────────────────────────────────── */

describe("isVerbatimRepeat", () => {
  it("flags exact prefix match", () => {
    const s = init({
      lastAiText: "I appreciate you sharing that. What's most important to you in this package — is it the base number, the overall CTC, or are there specific benefits?",
    });
    const repeat = "I appreciate you sharing that. What's most important to you in this package — is it the base number, the overall CTC, or specific benefits that would move the needle?";
    expect(isVerbatimRepeat(repeat, s)).toBe(true);
  });

  it("doesn't flag genuinely different texts", () => {
    const s = init({ lastAiText: "Let me see what I can do on base." });
    expect(isVerbatimRepeat("How does the equity component look to you?", s)).toBe(false);
  });

  it("doesn't flag when no prior turn", () => {
    expect(isVerbatimRepeat("Anything goes here.", init())).toBe(false);
  });

  it("doesn't flag short closers like 'Sounds good.' (below min-length guard)", () => {
    /* The previous 8-word fingerprint flagged short legitimate closers
       as repeats. With min-length 6 content words, short responses
       can't trigger the guard. */
    const s = init({ lastAiText: "Sounds good." });
    expect(isVerbatimRepeat("Sounds good.", s)).toBe(false);
  });
});

/* ─── End-to-end integration: a full negotiation arc ───────────── */

describe("integration: full arc", () => {
  it("opening → offer → probe → counter → accept", () => {
    let state = init();

    /* T1: AI opens. */
    let move = pickAiMove(state);
    expect(move.lever).toBe("open-with-offer");
    state = applyAiMove(state, move, `Our offer is ₹${move.newTotalLpa} LPA.`);
    expect(state.phase).toBe("offer-presented");

    /* Candidate: I want 26. */
    state = applyCandidateAnswer(state, "I was hoping for around 26 LPA.");
    expect(state.candidateTarget).toBe(26);
    expect(state.phase).toBe("counter-offer");

    /* T2: AI counters. */
    move = pickAiMove(state);
    expect(move.lever).toBe("counter-base");
    expect(move.newTotalLpa).toBe(23);
    state = applyAiMove(state, move, `Let me stretch to ₹${move.newTotalLpa} LPA.`);
    expect(state.highestOfferMade).toBe(23);

    /* Candidate: accepts. */
    state = applyCandidateAnswer(state, "OK, I accept.");
    expect(state.phase).toBe("accepted");

    /* T3: AI closes. */
    move = pickAiMove(state);
    expect(move.lever).toBe("close-acceptance");
    expect(isTerminalPhase(state.phase)).toBe(true);
  });

  it("Bombay Design Centre regression scenario reaches sane state", () => {
    /* Initial offer 7.1, candidate states target 10, then mentions
       current package 8.5 — the legacy bug switched target to 8.5.
       The kernel must keep target=10 across both turns. */
    let state = init({ band: { initialOffer: 7.1, maxStretch: 9, walkAway: 5, hasEquity: false } });
    state = applyAiMove(state, pickAiMove(state), "Offer of ₹7.1 LPA.");
    state = applyCandidateAnswer(state, "I was hoping for around 10 LPA actually.");
    expect(state.candidateTarget).toBe(10);

    state = applyCandidateAnswer(state, "It's on current package progression because my current package is around 8.5 LPA.");
    expect(state.candidateCurrentCtc).toBe(8.5);
    /* The crucial assertion: target must NOT have been displaced. */
    expect(state.candidateTarget).toBe(10);
  });

  it("turn budget exhaustion → stalemate", () => {
    let state = init({ maxTurns: 3 });
    /* 3 AI turns consumed. */
    for (let i = 0; i < 3; i++) {
      state = applyAiMove(state, pickAiMove(state), `turn ${i}`);
    }
    expect(state.turnIndex).toBe(3);
    /* Next derive picks stalemate. */
    expect(derivePhase(state)).toBe("stalemate");
  });
});

/* ─── Serialization round-trip ─────────────────────────────────── */

describe("serialize/deserialize", () => {
  it("round-trips a non-trivial state", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 3,
      candidateTarget: 26,
      candidateCurrentCtc: 18,
      highestOfferMade: 22,
      leversUsed: ["open-with-offer", "probe", "counter-base"],
      lastAiText: "Where I'd land that: bump base...",
    });
    const round = deserializeState(serializeState(s));
    expect(round).toEqual(s);
  });
});

/* ─── Engine wrap contract ─────────────────────────────────────── */

/* These pin the invariant useInterviewEngine.ts relies on when it
   sees `conversationDone: true` from /api/negotiate-turn: the kernel
   must remain in a terminal phase across the closing AI move AND
   across serialize/deserialize, so the engine never re-issues a
   non-terminal turn after wrapping the script into a "closing" slot.
   This is the contract behind the kernel-terminal → closing-slot
   path at useInterviewEngine.ts ~1363-1373. */
describe("engine wrap contract", () => {
  const TERMINAL_PATHS: ReadonlyArray<{
    name: "accepted" | "walked-away" | "stalemate";
    triggerAnswer: string | null;
    expectedLever: "close-acceptance" | "close-walkaway" | "close-stalemate";
  }> = [
    { name: "accepted", triggerAnswer: "I accept the offer, sounds good.", expectedLever: "close-acceptance" },
    { name: "walked-away", triggerAnswer: "I'm out, I'll take the other offer.", expectedLever: "close-walkaway" },
    { name: "stalemate", triggerAnswer: null, expectedLever: "close-stalemate" },
  ];

  for (const path of TERMINAL_PATHS) {
    it(`${path.name}: terminal phase survives wrap move + round-trip`, () => {
      let state = init({ maxTurns: path.name === "stalemate" ? 2 : 8 });
      state = applyAiMove(state, pickAiMove(state), "Our offer is ₹20 LPA.");

      if (path.triggerAnswer) {
        state = applyCandidateAnswer(state, path.triggerAnswer);
      } else {
        /* Burn the turn budget for stalemate. */
        state = applyAiMove(state, pickAiMove(state), "second turn");
      }

      expect(isTerminalPhase(state.phase)).toBe(true);

      const move = pickAiMove(state);
      expect(move.lever).toBe(path.expectedLever);

      const wrapped = applyAiMove(state, move, "wrap text");
      expect(wrapped.phase).toBe(path.name);
      expect(isTerminalPhase(wrapped.phase)).toBe(true);

      /* Serialized form preserves terminality — what crosses the
         wire to the engine on the next turn (if any). */
      const round = deserializeState(serializeState(wrapped));
      expect(isTerminalPhase(round.phase)).toBe(true);
    });
  }
});

/* ─── Hindi-mix parser coverage ────────────────────────────────────
 * Audit gap: Indian candidates frequently code-switch ("Mujhe 25 LPA
 * chahiye", "25 lakh ka package", "Mera target 30 LPA hai"). Deepgram
 * preserves these tokens; the kernel parser previously matched only
 * English ask-context words, so the candidateTarget never bound and the
 * AI never anchored against the candidate's actual number. */
describe("parseCandidateAnswer (Hindi-mix)", () => {
  it("'Mujhe 25 LPA chahiye' → target 25", () => {
    const p = parseCandidateAnswer("Mujhe 25 LPA chahiye");
    expect(p.target).toBe(25);
  });

  it("'25 lakh chahiye' (post-number intent word) → target 25", () => {
    const p = parseCandidateAnswer("Honestly, 25 lakh chahiye for this role.");
    expect(p.target).toBe(25);
  });

  it("'30 LPA ka package' → target 30", () => {
    const p = parseCandidateAnswer("Sir, 30 LPA ka package chahiye.");
    expect(p.target).toBe(30);
  });

  it("'Mera target 28 LPA hai' → target 28", () => {
    const p = parseCandidateAnswer("Mera target 28 LPA hai.");
    expect(p.target).toBe(28);
  });

  it("'22 lakh mil jaye to bahut accha' → target 22", () => {
    const p = parseCandidateAnswer("22 lakh mil jaye to bahut accha hoga.");
    expect(p.target).toBe(22);
  });

  it("Hindi-mix with rupee symbol → target binds", () => {
    const p = parseCandidateAnswer("Main ₹35 LPA expect karta hu.");
    expect(p.target).toBe(35);
  });
});
