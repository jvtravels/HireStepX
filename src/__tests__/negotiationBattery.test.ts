/* Negotiation battery (2026-06-18) — locks the deterministic ship path
 * (LLM-off worst case) against regressions discovered via the offline
 * simulator. Each scenario replays a full conversation through the REAL
 * kernel + planner + canonical-prose renderer.
 *
 * Invariants asserted on EVERY shipped recruiter line, across every
 * scenario — these are phrasing-independent output contracts, not
 * per-phrase patches:
 *   • Indian-HR register: no honorifics / USD / 401k / PTO / k-salary.
 *   • Indian-HR fluency (D5): no stacked discourse fillers, no broken
 *     capitalization after a sentence-final period.
 *   • No content-free filler shipped once an offer is on the table.
 *
 * Per-scenario behavioural asserts (close on accept, etc.) are added as
 * each structural defect is fixed, so this file is the running spec for
 * "the negotiation is smooth and reaches a real close."
 */
import { describe, it, expect } from "vitest";
import {
  runConversation,
  registerViolations,
  fluencyViolations,
  fillerHit,
  normLine,
  type SimTurn,
} from "./_negotiationSim";
import type { NegotiationBand } from "../../server-handlers/_negotiation-kernel";

const band: NegotiationBand = { initialOffer: 28, maxStretch: 40, walkAway: 22, hasEquity: true };

interface Scenario {
  name: string;
  turns: string[];
  band?: NegotiationBand;
}

const SCENARIOS: Scenario[] = [
  {
    name: "S1 happy-path close",
    turns: [
      "I'm a backend engineer with 6 years, currently at 26 LPA.",
      "I'm targeting around 36 LPA total.",
      "Can you move closer to 36?",
      "Is that really your best?",
      "Okay, what about a joining bonus?",
      "Alright, that works. I accept.",
    ],
  },
  {
    name: "S2 competing-offer-with-letter",
    turns: [
      "Currently at 30 LPA, 7 years in data engineering.",
      "I have a written offer from Flipkart at 42 LPA.",
      "Can you match 42?",
      "The Flipkart letter is in hand though, I need you to get closer.",
      "Where can we land on this?",
      "Fine, if you add an early joining bonus I'll sign.",
    ],
    band: { initialOffer: 28, maxStretch: 40, walkAway: 22, hasEquity: true },
  },
  {
    name: "S3 Hinglish pushes",
    turns: [
      "Abhi 24 LPA pe hoon, 5 saal ka experience hai.",
      "Mujhe 34 chahiye total.",
      "Thoda aur ho sakta hai kya?",
      "Yaar thoda stretch karo na.",
      "Theek hai, agar joining bonus mil jaye toh done.",
    ],
  },
  {
    name: "S4 withholding CTC then lowball-from-us pressure",
    turns: [
      "I'd rather not share my current CTC.",
      "Let's just say I'm looking for 38 LPA.",
      "That offer feels low. Can you do better?",
      "Is that it?",
      "I need at least 35 to consider this seriously.",
      "Okay 35 works, I'm in.",
    ],
  },
  {
    name: "S5 notice-period + joining-date depth",
    turns: [
      "I'm at 32 LPA, 8 years, currently serving notice.",
      "I'm targeting 40 LPA.",
      "My notice is 90 days — can you buy it out?",
      "Can I join earlier if you cover the buyout?",
      "Great, then I accept at the revised number.",
    ],
  },
];

/* Adversarial battery (2026-06-19) — the four "must-never-happen" failures
 * surfaced by the offline adversarial probe. Each locks a structural
 * invariant of a real-life close, not a phrasing detail:
 *   A6 terse non-disclosure — bot must still put a number on the table and
 *      reach a close; it must NOT stalemate because the candidate is curt.
 *   A7 bare-accept — a single committal word ("accepted") over a standing
 *      offer must close the deal.
 *   A8 base-component hammer — a repeated direct "what's the base?" must be
 *      answered; the bot must never ship the same line twice in a row.
 *   A9 unitless close — terse unit-less disclosure that still resolves. */
const ADVERSARIAL: Scenario[] = [
  {
    name: "A6 terse non-disclosure",
    turns: ["ok", "hmm", "sure", "yeah", "fine", "ok"],
  },
  {
    name: "A7 bare-accept over standing offer",
    turns: [
      "I'm at 26 LPA, 6 years.",
      "I'm looking for around 34 LPA.",
      "What can you do?",
      "alright, accepted",
    ],
  },
  {
    name: "A8 base-component hammer",
    turns: [
      "I'm at 25 LPA.",
      "What can you do on the base?",
      "What can you do on the base?",
      "And the base specifically?",
    ],
  },
  {
    name: "A9 unitless close",
    turns: ["currently 26 LPA", "I want at least 32", "alright, accepted"],
  },
];

function runScenario(sc: Scenario): SimTurn[] {
  return runConversation({
    sessionId: sc.name.replace(/\s+/g, "-"),
    band: sc.band ?? band,
    turns: sc.turns,
  }).transcript;
}

/** No mangled opener: a decorative sentence-prefix opener glued onto a
 *  fresh capitalized sentence ("Coming to Let's start with…") or two
 *  stacked openers. Phrasing-independent structural garble. */
function mangledOpener(text: string): string | null {
  const t = text || "";
  const m =
    t.match(/\bComing to\s+(?=[A-Z][a-z])/) ||
    t.match(/\b(?:So,|Quick one —|Coming to)\s+(?:So,|Quick one —|Coming to)\b/);
  return m ? m[0] : null;
}

describe("negotiation battery — register + fluency output contracts", () => {
  for (const sc of SCENARIOS) {
    it(`${sc.name}: every line is clean Indian-HR register`, () => {
      for (const t of runScenario(sc)) {
        const v = registerViolations(t.aiText);
        expect(v, `register violation in: ${t.aiText}`).toEqual([]);
      }
    });

    it(`${sc.name}: every line is fluent (no stacked fillers / broken caps)`, () => {
      for (const t of runScenario(sc)) {
        const v = fluencyViolations(t.aiText);
        expect(v, `fluency violation in: ${t.aiText}`).toEqual([]);
      }
    });

    it(`${sc.name}: no content-free filler once an offer is on the table`, () => {
      for (const t of runScenario(sc)) {
        if (t.highestOfferMade > 0) {
          expect(
            fillerHit(t.aiText),
            `filler shipped over a standing offer: ${t.aiText}`,
          ).toBeNull();
        }
      }
    });
  }
});

describe("negotiation battery — reaches a real close", () => {
  it("S1 happy-path accepts and terminates", () => {
    const transcript = runScenario(SCENARIOS[0]);
    const last = transcript[transcript.length - 1];
    expect(last.terminal, "S1 should reach a terminal phase").toBe(true);
    expect(last.phase).toBe("accepted");
  });

  it("S5 buyout path accepts and terminates", () => {
    const transcript = runScenario(SCENARIOS[4]);
    const last = transcript[transcript.length - 1];
    expect(last.terminal, "S5 should reach a terminal phase").toBe(true);
    expect(last.phase).toBe("accepted");
  });
});

describe("negotiation battery — adversarial must-never-happen invariants", () => {
  /* Universal across every adversarial scenario: clean register, no mangled
   * openers, and never the SAME line twice in a row (a verbatim dodge-loop). */
  for (const sc of ADVERSARIAL) {
    it(`${sc.name}: register clean, no mangled opener, no verbatim loop`, () => {
      const transcript = runScenario(sc);
      let prev = "";
      for (const t of transcript) {
        expect(registerViolations(t.aiText), `register: ${t.aiText}`).toEqual([]);
        expect(mangledOpener(t.aiText), `mangled opener: ${t.aiText}`).toBeNull();
        const cur = normLine(t.aiText);
        if (cur)
          expect(cur, `verbatim repeat of prior line: ${t.aiText}`).not.toBe(prev);
        prev = cur;
      }
    });
  }

  it("A6 terse non-disclosure: bot still anchors a number (no stalemate)", () => {
    const transcript = runScenario(ADVERSARIAL[0]);
    expect(
      transcript.some((t) => t.highestOfferMade > 0),
      "bot must put a concrete offer on the table even when the candidate is terse",
    ).toBe(true);
  });

  it("A7 bare-accept over standing offer closes", () => {
    const transcript = runScenario(ADVERSARIAL[1]);
    const last = transcript[transcript.length - 1];
    expect(last.phase, "a bare 'accepted' over a standing offer must close").toBe(
      "accepted",
    );
    expect(last.terminal).toBe(true);
  });

  it("A8 base-component hammer is answered, never dodged twice", () => {
    const transcript = runScenario(ADVERSARIAL[2]);
    // The two repeated base questions are turns index 2 and 3 (after opener).
    // Across the responses the bot must surface a concrete number at least
    // once rather than deflecting both times.
    expect(
      transcript.some((t) => t.highestOfferMade > 0),
      "a repeated direct base question must be answered with a number",
    ).toBe(true);
  });

  it("A9 unitless close reaches accepted", () => {
    const transcript = runScenario(ADVERSARIAL[3]);
    const last = transcript[transcript.length - 1];
    expect(last.phase, "unit-less disclosure + bare accept must close").toBe(
      "accepted",
    );
  });
});

/* Outcome battery (2026-06-19) — accept against a STATED BAND with no
 * concrete point offer. When the candidate's current CTC sits BELOW the
 * band floor the planner presents the band as a RANGE
 * (`band-anchor-with-rationale`, newTotalLpa:null) so they have room to
 * bargain up; no `highestOfferMade` is stamped. A candidate can still
 * ACCEPT the stated band outright without countering. The sev-1 this
 * locks: with highestOfferMade still 0 the acceptance classifier vetoed
 * the accept as pre-offer filler (offerOnTable=false) and every close
 * path gated out — the session dead-ended on the candidate's "that works
 * for me, let's close" and NEVER closed. Surfaced by the adversarial
 * outcome battery (`competing-offer-then-accept`). The fix treats a
 * presented band as an offer-on-table and registers the band floor as the
 * standing offer on acceptance, so the close lands on the floor.
 *
 * These bands put the candidate's CTC BELOW initialOffer to force the
 * range-anchor branch (the concrete-offer branch is already covered by
 * S1/A7/A9 above). */
const HIGH_BAND: NegotiationBand = {
  initialOffer: 32,
  maxStretch: 40,
  walkAway: 26,
  hasEquity: true,
};

describe("negotiation battery — accept against a stated band closes", () => {
  it("competing-offer + outright accept of the range band closes above the disclosed-CTC floor", () => {
    const { transcript, finalState } = runConversation({
      sessionId: "outcome-competing-offer-accept",
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
    const last = transcript[transcript.length - 1];
    expect(
      last.phase,
      "accepting a stated range-band outright must reach a real close, not dead-end at offer 0",
    ).toBe("accepted");
    expect(last.terminal).toBe(true);
    /* #115 fast-follow (2026-06-20): the accept-on-band close now respects the
     * disclosed-CTC hike floor (bandAcceptOfferFloor) instead of locking the
     * raw band floor. The old behaviour closed at the band floor (₹32L) — a
     * single-digit hike that sat BELOW the candidate's own stated competing
     * offer of ₹38L (the under-market pay-cut defect). With a Staff Engineer
     * (senior → 25% hike floor) on a tight band, the floor saturates the band
     * ceiling, so the close lands at maxStretch 40 — the candidate's target. */
    expect(
      finalState.highestOfferMade,
      "the close must clear the raw band floor — no sub-CTC / sub-competing-offer close",
    ).toBeGreaterThan(HIGH_BAND.initialOffer);
    expect(
      finalState.highestOfferMade,
      "the close is capped at the band ceiling — never fabricated above maxStretch",
    ).toBeLessThanOrEqual(HIGH_BAND.maxStretch);
    /* Deterministic landing for this fixture: disclosed-CTC hike floor
     * saturates the tight band → close at the ceiling. */
    expect(finalState.highestOfferMade).toBe(40);
  });

  it("below-floor CTC + 'I accept' over the range band closes", () => {
    const { transcript } = runConversation({
      sessionId: "outcome-below-floor-accept",
      role: "Staff Engineer",
      company: "Stripe",
      band: HIGH_BAND,
      turns: [
        "I'm at Swiggy, 28 LPA, 23 fixed 5 variable.",
        "Targeting around 42.",
        "What can you offer?",
        "Okay, that's fair. I accept.",
      ],
    });
    const last = transcript[transcript.length - 1];
    expect(
      last.phase,
      "an explicit 'I accept' over a presented band must close",
    ).toBe("accepted");
    expect(last.terminal).toBe(true);
  });
});

/* #119 (2026-06-21, live staging) — post-anchor discovery regression.
 * Repro: a desperate / content-free candidate who never discloses a number.
 * The bot correctly anchors the band floor (A6 stonewall escape), but a turn
 * later REGRESSED into a cold "share your current CTC — fixed, variable,
 * in-hand?" discovery-probe — looping backwards over an offer it had already
 * put on the table. Once an offer stands and the candidate has stonewalled,
 * the recruiter must hold the number and move toward a decision, never dig
 * back into the candidate's *current* comp. */
describe("negotiation battery — no post-anchor current-CTC regression (#119)", () => {
  /* A backwards probe asks about the candidate's CURRENT comp split after an
   * offer is already on the table. Forward expectation asks ("what were you
   * expecting?") are fine — they shape the counter; current-comp digs do not. */
  const BACKWARD_CURRENT_CTC_RE =
    /current\s+(?:total\s+)?ctc[^.?!]*\b(?:fixed|variable|in-?hand|split)\b|\bfixed[,\s].*variable.*in-?hand\b/i;

  it("content-free stonewall: bot never re-probes current CTC once an offer is on the table", () => {
    const STONEWALL_BAND: NegotiationBand = {
      initialOffer: 32,
      maxStretch: 58,
      walkAway: 28,
      hasEquity: true,
    };
    const { transcript } = runConversation({
      sessionId: "post-anchor-stonewall",
      role: "Engineering Manager",
      company: "Flipkart",
      band: STONEWALL_BAND,
      initExtras: { experienceLevel: "senior", applicableYoe: 11 },
      turns: [
        "Hi, thanks for the call.",
        "Honestly whatever you can offer is fine, I really want this role.",
        "I don't really have a number in mind, just tell me what you can do.",
        "I trust you, whatever works for the company works for me.",
        "Yeah I'll take whatever the package is, let's just finalize.",
        "Please just go ahead with whatever you think is fair.",
        "I'm good with anything, no need to discuss numbers.",
        "Let's just lock it in, whatever you decide.",
      ],
    });

    // The bot must put a real number down despite the stonewall.
    expect(
      transcript.some((t) => t.highestOfferMade > 0),
      "bot must anchor a concrete offer even under a total stonewall",
    ).toBe(true);

    // Once an offer is on the table, no later line may dig back into the
    // candidate's CURRENT CTC split — that is the backwards regression.
    let offerSeen = false;
    for (const t of transcript) {
      if (t.highestOfferMade > 0) offerSeen = true;
      if (offerSeen) {
        expect(
          BACKWARD_CURRENT_CTC_RE.test(t.aiText),
          `post-anchor backwards current-CTC probe: ${t.aiText}`,
        ).toBe(false);
      }
    }

    // And register stays clean (no "ballpark" — #120) across the whole flow.
    for (const t of transcript) {
      expect(registerViolations(t.aiText), `register: ${t.aiText}`).toEqual([]);
    }
  });
});

describe("negotiation battery — stonewall anchors, never ₹0 stalemate (#121)", () => {
  /* Live staging repro (Flipkart EM, real LLM): a content-free / desperate
   * candidate who refuses EVERY number got probed turn after turn — the
   * reactive-followups (ctc-gentle-push / range-deflection / answer-direct)
   * captured each turn so the deep A6 stonewall escape never got a turn, the
   * bot NEVER anchored, and the kernel dumped the session to a ₹0-offer
   * "let's pause here" stalemate close. The hoisted planStonewallAnchor (call
   * site 1, above the reactive-followups) must guarantee a concrete number
   * lands and the session converges to a real close. */
  const REFUSAL_BAND: NegotiationBand = {
    initialOffer: 45,
    maxStretch: 70,
    walkAway: 38,
    hasEquity: true,
  };
  const REFUSAL_TURNS = [
    "I'd rather not share my current CTC.",
    "I don't want to give a number.",
    "Can you just tell me what you're offering?",
    "Whatever you think is fair.",
    "I really need this job, please.",
    "Just make me an offer, I'm flexible.",
    "Okay that sounds fine.",
    "Yes, I accept.",
  ];

  it("anchors a concrete offer and closes — no ₹0 stalemate", () => {
    const { transcript, finalState } = runConversation({
      sessionId: "stonewall-anchor-121",
      role: "Engineering Manager",
      company: "Flipkart",
      band: REFUSAL_BAND,
      initExtras: {
        experienceLevel: "senior",
        applicableYoe: 10,
        totalYoe: 10,
        primaryDomain: "engineering",
      },
      turns: REFUSAL_TURNS,
    });

    // A real number must land — never a ₹0-offer dead end.
    const anchored = transcript.filter((t) => t.highestOfferMade > 0);
    expect(
      anchored.length > 0,
      "stonewall must produce a concrete offer, not a ₹0 stalemate",
    ).toBe(true);
    expect(finalState.highestOfferMade).toBeGreaterThan(0);
    // The offer must sit within the band (floor..ceiling), not below walk-away.
    expect(finalState.highestOfferMade).toBeGreaterThanOrEqual(
      REFUSAL_BAND.initialOffer,
    );
    expect(finalState.highestOfferMade).toBeLessThanOrEqual(
      REFUSAL_BAND.maxStretch,
    );

    // The conversation must converge to a real terminal close, not stalemate.
    const last = transcript[transcript.length - 1];
    expect(last.terminal, "stonewall flow should reach a terminal phase").toBe(
      true,
    );
    expect(
      finalState.phase,
      "must close (accepted), not stalemate",
    ).not.toBe("stalemate");

    // Register + fluency stay clean throughout.
    for (const t of transcript) {
      expect(registerViolations(t.aiText), `register: ${t.aiText}`).toEqual([]);
      expect(fluencyViolations(t.aiText), `fluency: ${t.aiText}`).toEqual([]);
    }
  });
});

/* #122 (2026-06-21, live staging) — post-anchor re-probe loop. After the
 * #121 stonewall anchor put ₹32.7L on the table (phase = "probe-expectations"),
 * a content-free candidate ("Hmm." / "I see." / "Okay.") got the IDENTICAL
 * "What fitment were you expecting for this role?" probe-expectations action
 * three turns running — the bot begging for a number while ignoring its own
 * standing offer. probe-expectations is a PRE-anchor move; once an offer
 * stands the recruiter must HOLD it (offer-recap) and invite a decision,
 * never re-probe expectations and never auto-escalate cash for free. */
describe("negotiation battery — no post-anchor expectations re-probe (#122)", () => {
  const STONEWALL_BAND: NegotiationBand = {
    initialOffer: 32.7,
    maxStretch: 56,
    walkAway: 26.6,
    hasEquity: true,
  };

  it("content-free stonewall: once an offer stands, never re-probe 'what were you expecting'", () => {
    const { transcript } = runConversation({
      sessionId: "post-anchor-reprobe-122",
      role: "Engineering Manager",
      company: "Flipkart",
      band: STONEWALL_BAND,
      initExtras: {
        experienceLevel: "senior",
        applicableYoe: 9,
        totalYoe: 9,
        primaryDomain: "engineering",
      },
      turns: [
        "Hmm.",
        "I see.",
        "Not sure.",
        "Okay.",
        "Right.",
        "Hmm.",
        "I see.",
        "Okay.",
        "Sure.",
        "Hmm.",
      ],
      stopOnTerminal: false,
    });

    // An offer must land (the #121 anchor).
    expect(
      transcript.some((t) => t.highestOfferMade > 0),
      "bot must anchor a concrete offer under a stonewall",
    ).toBe(true);

    // Once an offer is on the table, no later turn may emit the
    // expectations re-probe — neither the action kind nor its prose.
    const EXPECTATIONS_PROBE_RE = /what fitment were you expecting/i;
    let offerSeen = false;
    for (const t of transcript) {
      if (t.highestOfferMade > 0) offerSeen = true;
      if (!offerSeen) continue;
      expect(
        t.kind,
        `post-anchor probe-expectations re-probe: ${t.aiText}`,
      ).not.toBe("probe-expectations");
      expect(
        EXPECTATIONS_PROBE_RE.test(t.aiText),
        `post-anchor begs for a number over a standing offer: ${t.aiText}`,
      ).toBe(false);
    }

    // Register + fluency stay clean throughout.
    for (const t of transcript) {
      expect(registerViolations(t.aiText), `register: ${t.aiText}`).toEqual([]);
      expect(fluencyViolations(t.aiText), `fluency: ${t.aiText}`).toEqual([]);
    }
  });
});
