/* Close-classifier acceptance guards — findings #124 / #125 / #126
 * (2026-06-21, live-staging Flipkart-EM hardening loop).
 *
 * These lock three structural fixes in the salary-negotiation kernel's
 * acceptance path. All three run through the REAL deterministic pipeline
 * (kernel + planner + canonical-prose) via the offline simulator, i.e. the
 * worst case we ship when the LLM is unavailable.
 *
 *   #124 — a forward-commitment idiom over a standing offer
 *          ("Sounds good, let's go ahead") must CLOSE the session, not
 *          route back to a discovery / expectations probe. The strict
 *          acceptance gate now recognises let's-go-ahead/proceed/do-it so
 *          it bypasses the PDF#48 one-turn-wait the same way an explicit
 *          "I accept" does.
 *
 *   #125 — on a band accept, the close number must honour an in-band
 *          candidate TARGET (capped at the band ceiling), not silently fall
 *          back to the disclosed-CTC hike floor. A committed offer must be
 *          registered (highestOfferMade > 0), never ₹0.
 *
 *   #126 — the candidate's OWN ask (expected CTC / target) is theirs to
 *          revise. Lowering it ("I want 50" → "if you can do 38 I'm in") is
 *          a concession, not a factual contradiction, so the
 *          contradiction-callout (reserved for immutable facts like current
 *          CTC) must NOT fire.
 */
import { describe, it, expect } from "vitest";
import { runConversation } from "./_negotiationSim";
import type { NegotiationBand } from "../../server-handlers/_negotiation-kernel";

const EM_BAND: NegotiationBand = {
  initialOffer: 32.7,
  maxStretch: 56,
  walkAway: 26.6,
  hasEquity: true,
};
const EM_EXTRAS = {
  applicableYoe: 9,
  experienceLevel: "senior",
  currentCtcLpa: 14,
};

describe("close-classifier acceptance guards (#124/#125/#126)", () => {
  it("#124 — forward-commitment idiom over a standing offer closes the session", () => {
    const { transcript, finalState } = runConversation({
      role: "Engineering Manager",
      company: "Flipkart",
      band: EM_BAND,
      initExtras: EM_EXTRAS,
      turns: ["My current is 14.", "Sounds good, let's go ahead."],
    });
    // An offer was on the table before the accept...
    expect(finalState.highestOfferMade).toBeGreaterThan(0);
    // ...and the forward-commitment idiom drove a real close.
    expect(finalState.phase).toBe("accepted");
    expect(transcript[transcript.length - 1].terminal).toBe(true);
  });

  it("#125 — band accept registers a committed offer (never ₹0), honouring an in-band target", () => {
    const HIGH_BAND: NegotiationBand = {
      initialOffer: 32,
      maxStretch: 40,
      walkAway: 26,
      hasEquity: true,
    };
    const { finalState } = runConversation({
      role: "Staff Engineer",
      company: "Stripe",
      band: HIGH_BAND,
      turns: [
        "I'm at Razorpay, 30 LPA, 24 fixed 6 variable.",
        "I have a competing offer at 38.",
        "Targeting 40 to move.",
        "Where would you land?",
        "That works for me. Let's go ahead and close.",
      ],
    });
    expect(finalState.phase).toBe("accepted");
    // In-band target (40) is honoured over the disclosed-CTC floor, capped
    // at the band ceiling — never the ₹0 / floor-only fallback.
    expect(finalState.highestOfferMade).toBe(40);
  });

  it("#128 — in-band conditional accept above the gap concedes (not a justify-probe) and converges", () => {
    const { transcript, finalState } = runConversation({
      role: "Engineering Manager",
      company: "Flipkart",
      band: { initialOffer: 32, maxStretch: 52, walkAway: 28, hasEquity: true },
      initExtras: { applicableYoe: 8, experienceLevel: "senior", currentCtcLpa: 34 },
      turns: [
        "Currently 34 LPA.",
        "I have a competing offer from Razorpay at 46.",
        "Can you match it?",
        "If you can do 46 I'm in.",
        "46 works, I'll sign today.",
        "Yes, 46 and I'm in.",
      ],
    });
    // The turn that handled "If you can do 46 I'm in." must be a cash
    // concession, NOT a probe interrogating the candidate for the number they
    // just committed to. (Pre-#128 this fired probe-expectations / a reactive
    // justify-probe and stalled.)
    const condTurn = transcript.find((t) => t.candidate === "If you can do 46 I'm in.");
    expect(condTurn).toBeTruthy();
    expect(condTurn!.kind).not.toMatch(/probe|reactive|expectations/i);
    // The offer must move UP toward the in-band ask (39 → >39), never stall flat.
    expect(condTurn!.highestOfferMade).toBeGreaterThan(39);
    // And the negotiation converges to a real close (no probe loop).
    expect(finalState.phase).toBe("accepted");
  });

  it("#129 — firm accept restating the in-band figure closes AT that figure, not the bare offer", () => {
    const { finalState } = runConversation({
      role: "Engineering Manager",
      company: "Flipkart",
      band: { initialOffer: 32, maxStretch: 52, walkAway: 28, hasEquity: true },
      initExtras: { applicableYoe: 8, experienceLevel: "senior", currentCtcLpa: 34 },
      turns: [
        "Currently 34 LPA.",
        "I have a competing offer from Razorpay at 46.",
        "Can you match it?",
        "If you can do 46 I'm in.",
        "46 works, I'll sign today.",
      ],
    });
    expect(finalState.phase).toBe("accepted");
    // The candidate agreed at 46 (in band, above the standing offer). The close
    // must land at 46 — never stealth-close on the bare offer the planner had
    // crept to (a #105-class under-close).
    expect(finalState.highestOfferMade).toBe(46);
  });

  it("#127 — terse accept-with-number ('fine 22 done') is acceptance AND closes at the stated figure", () => {
    const { finalState } = runConversation({
      role: "Engineering Manager",
      company: "Acme",
      band: { initialOffer: 18, maxStretch: 26, walkAway: 14, hasEquity: false },
      initExtras: { applicableYoe: 4, experienceLevel: "mid", currentCtcLpa: 16 },
      turns: ["16 fixed.", "want 24", "that's too low", "fine 22 done"],
    });
    // "fine 22 done" self-lowers from the 24 ask and welds the settle figure to
    // a commit token. It must (a) classify as acceptance — not fire another
    // anchor/counter — and (b) close at 22 (in band, above the offer), the
    // figure the candidate actually committed to, not the stale 24 ask nor the
    // bare standing offer.
    expect(finalState.phase).toBe("accepted");
    expect(finalState.highestOfferMade).toBe(22);
  });

  it("#126 — self-lowered ask is a concession, not a contradiction-callout", () => {
    const { transcript } = runConversation({
      role: "Engineering Manager",
      company: "Flipkart",
      band: EM_BAND,
      initExtras: EM_EXTRAS,
      turns: ["I want 50.", "Come on, stretch.", "if you can do 38 I'm in"],
      stopOnTerminal: false,
    });
    // Revising one's own ask downward must never trip the "which figure
    // should I take to the panel?" contradiction-callout.
    expect(transcript.every((t) => t.kind !== "contradiction-callout")).toBe(true);
  });

  it("#132 — an info-disclosure lever never re-fires verbatim on consecutive turns above the ceiling", () => {
    // Live Flipkart-EM (2026-06-21): the candidate, already pushed to the
    // band ceiling (open CTC-lifted to maxStretch), kept demanding a higher
    // fixed number. Because `state.infoAsked` is CUMULATIVE, an early
    // "bonus"/"variable" mention left `compensation-breakdown` sticky and the
    // planner re-shipped the SAME canonical "On the structure — fixed is the
    // bulk…" disclosure on consecutive turns (only an LLM-inserted "right,"
    // differed). The one-shot lever guard now lets each company-policy
    // disclosure fire at most once; a re-ask falls through to the
    // counter/close path instead of looping the explainer.
    const CEIL_BAND: NegotiationBand = {
      initialOffer: 32.7,
      maxStretch: 53.2,
      walkAway: 27.7,
      hasEquity: true,
    };
    const { transcript } = runConversation({
      role: "Engineering Manager",
      company: "Flipkart",
      band: CEIL_BAND,
      initExtras: { applicableYoe: 10, experienceLevel: "senior", currentCtcLpa: 48 },
      turns: [
        "My current CTC is 48 LPA — 40 fixed plus about 8 in variable and stock.",
        "I'm targeting 65 LPA fixed. That's the number that makes this move worthwhile.",
        "Equity is fine, but the fixed cash is what matters. I have a competing offer from Razorpay at 62 LPA fixed. If you can get close on cash, I'm ready to sign.",
        "A one-time bonus doesn't move my base. Can you get the fixed to 58 LPA? If you can do that, we have a deal.",
        "Let's not go in circles on structure. Put your best fixed number on the table right now, and if it works I'll sign today.",
        "I hear you on the buyout, but I need a fixed number. What's your best fixed?",
        "Come on, give me the best fixed you can do.",
      ],
      stopOnTerminal: false,
    });
    // No single info-disclosure lever ships twice in a row…
    const INFO_LEVERS = new Set([
      "compensation-summary",
      "benefits-summary",
      "notice-period-summary",
      "hike-context-summary",
    ]);
    for (let i = 1; i < transcript.length; i++) {
      const prev = transcript[i - 1];
      const cur = transcript[i];
      if (INFO_LEVERS.has(cur.lever)) {
        expect(cur.lever).not.toBe(prev.lever);
      }
    }
    // …and no canonical line repeats verbatim across the whole conversation.
    const botLines = transcript.map((t) => t.aiText.trim()).filter(Boolean);
    expect(new Set(botLines).size).toBe(botLines.length);
  });

  /* PRI-56 (2026-06-22, offline hostile sweep S2/S4) — terse spoken
   * close-consent idioms ("deal, 40 works", "whatever you just said works",
   * "yes send it", "yes confirmed") were only reaching the medium-confidence
   * commitment-idiom path, so the kernel's soft-accept trailing-non-counter /
   * min-turns gate DROPPED the close and the bot kept countering / piling
   * levers over an unambiguous acceptance. Promoting them to the strict gate
   * (shared CLOSE_CONSENT_IDIOM_PATTERNS) routes them through
   * closeReason="accept", which canCloseSession passes unconditionally. */
  const PRI56_BAND: NegotiationBand = {
    initialOffer: 28,
    maxStretch: 42,
    walkAway: 24,
    hasEquity: true,
  };

  it("PRI-56 S2 — 'whatever you just said works' over a standing offer closes", () => {
    const { transcript, finalState } = runConversation({
      role: "Engineering Manager",
      company: "Flipkart",
      band: PRI56_BAND,
      turns: [
        "I'm at 30 fixed currently",
        "I was hoping for 38",
        "ok fine, whatever you just said works",
      ],
    });
    expect(finalState.phase).toBe("accepted");
    expect(transcript[transcript.length - 1].terminal).toBe(true);
    // Closes on a committed in-band figure (the standing offer or the honoured
    // in-band target ≤ ceiling), never ₹0 and never above the ceiling.
    expect(finalState.highestOfferMade).toBeGreaterThan(0);
    expect(finalState.highestOfferMade).toBeLessThanOrEqual(PRI56_BAND.maxStretch);
  });

  it("PRI-56 S4 — 'deal, 40 works' after an in-band anchor closes (capped at ceiling)", () => {
    const { transcript, finalState } = runConversation({
      role: "Engineering Manager",
      company: "Flipkart",
      band: PRI56_BAND,
      turns: [
        "I have a competing offer at 55 fixed",
        "I need at least 50",
        "ok, what about 40 fixed",
        "deal, 40 works",
      ],
    });
    expect(finalState.phase).toBe("accepted");
    expect(transcript[transcript.length - 1].terminal).toBe(true);
    expect(finalState.highestOfferMade).toBeGreaterThan(0);
    expect(finalState.highestOfferMade).toBeLessThanOrEqual(PRI56_BAND.maxStretch);
  });

  it("PRI-56 — pre-offer 'whatever works' / 'send it' must NOT force a ₹0 close", () => {
    // The strict gate is consulted post-offer only; verify the guard holds end
    // to end — a close-consent idiom uttered before any offer exists must not
    // dead-end the session at a phantom ₹0 acceptance.
    const { finalState } = runConversation({
      role: "Engineering Manager",
      company: "Flipkart",
      band: PRI56_BAND,
      turns: ["whatever works", "send it"],
      stopOnTerminal: false,
    });
    expect(finalState.highestOfferMade === 0 ? finalState.phase : "ok").not.toBe("accepted");
  });
});
