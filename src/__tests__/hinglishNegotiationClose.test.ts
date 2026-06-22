/* Hinglish negotiation must parse + close (2026-06-18, live-staging finding).
 *
 * An objective adversarial battery surfaced a Hinglish scenario that
 * stalled: the candidate stated current comp as "Abhi main 24 LPA pe
 * hoon" (right now I'm at 24) and accepted with "Theek hai, accept karta
 * hoon" (okay, I accept). Two structural gaps:
 *
 *   1. The number-role classifier only recognised ENGLISH current-comp
 *      frames ("my current ...", "I'm at ..."). The Hinglish present-
 *      state markers ("abhi main ... pe hoon", "filhaal ... le raha
 *      hoon") never bound, so currentCtc stayed null, discovery never
 *      completed the currentCtc item, and the bot re-probed forever.
 *   2. The acceptance classifier recognised English performatives
 *      ("I accept") and bare Hindi affirmatives ("theek hai" — gated on
 *      an offer being on the table) but NOT the explicit Hinglish
 *      performative "accept karta/karti/karunga hoon". A pure-Hinglish
 *      acceptance fell through to no-match and the close was lost.
 *
 * These tests lock both: the Hinglish current-comp utterance binds to
 * currentCtc, the Hinglish performative is detected as a strong accept,
 * and a full Hinglish transcript reaches phase "accepted" — a real
 * close, never a stall. */
import { describe, it, expect } from "vitest";
import { classifyNumberRoles } from "../../server-handlers/_number-role-classifier";
import { classifyAcceptance, detectExplicitAcceptance } from "../../server-handlers/_acceptance-classifier";
import {
  applyCandidateAnswer,
  applyAiMove,
  pickAiMove,
  initState,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";

describe("Hinglish current-comp parsing", () => {
  it("binds 'Abhi main 24 LPA pe hoon' to currentCtc", () => {
    const r = classifyNumberRoles("Abhi main 24 LPA pe hoon.");
    expect(r.currentCtc).toBe(24);
    expect(r.target).toBeNull();
  });

  it("binds 'filhaal 22 LPA le raha hoon' to currentCtc", () => {
    const r = classifyNumberRoles("Filhaal 22 LPA le raha hoon.");
    expect(r.currentCtc).toBe(22);
  });

  it("still routes 'Mujhe 32 LPA fixed chahiye' to a fixed-scoped target (not current)", () => {
    const r = classifyNumberRoles("Mujhe 32 LPA fixed chahiye.");
    expect(r.target).toBe(32);
    expect(r.targetComponent).toBe("fixed");
    expect(r.currentCtc).toBeNull();
  });
});

describe("Hinglish performative acceptance", () => {
  const POSITIVES = [
    "accept karta hoon",
    "Theek hai, accept karta hoon.",
    "Main accept karti hoon.",
    "Accept kar raha hoon.",
    "Accept karunga.",
    "Accept kar lunga.",
    "Accept kar liya.",
  ];
  for (const text of POSITIVES) {
    it(`detects acceptance: ${text}`, () => {
      const r = classifyAcceptance(text, { offerOnTable: true });
      expect(r.accepted).toBe(true);
    });
  }

  it("does NOT treat a bare Hindi affirmative as accept before an offer exists", () => {
    // "theek hai" alone (no explicit performative) stays gated on an
    // offer being on the table — you can't accept what hasn't been
    // offered. This guards against the over-broad fix.
    const r = classifyAcceptance("Theek hai.", { offerOnTable: false });
    expect(r.accepted).toBe(false);
  });
});

/* PRI-57 (2026-06-22, offline hostile sweep S1). Two further Hinglish gaps,
 * each a NO-CLOSE on a real acceptance:
 *
 *   1. UNIT-LESS present-earn frame. "abhi 30 milta hai mujhe" (right now I
 *      GET 30) carried no salary unit, so Pass 2 never claimed it; the
 *      trailing dative "mujhe" (a TARGET cue) then tripped the targetAnywhere
 *      guard and BLOCKED the bot-asked-current Gricean default — currentCtc
 *      stayed null, discovery never completed, the bot never anchored, and
 *      every later Hindi accept was phase-gate-vetoed (no offer on the table).
 *      Fixed by recognising the Hindi earn verb (milta/kamata/leta) as a
 *      CURRENT right-cue, used BOTH to emit the bare-integer span (Pass 4) and
 *      to score the role — single source CURRENT_CUES.right.
 *   2. Missing accept idioms. "chalega" / "chal jayega" (works), "kar lo"
 *      (go ahead), "de do" (give it), "bhej do" (send it) weren't in
 *      HINDI_MIX_PATTERNS, and "bhej do offer letter" (send the offer letter)
 *      wasn't a strict close-consent idiom, so the close was lost. */
describe("PRI-57: unit-less Hindi current-CTC binds", () => {
  for (const [text, expected] of [
    ["abhi 30 milta hai mujhe", 30],
    ["30 milta hai", 30],
    ["30 kama raha hu", 30],
    ["mera current 30 hai", 30],
  ] as const) {
    it(`binds currentCtc from '${text}'`, () => {
      const r = classifyNumberRoles(text);
      expect(r.currentCtc).toBe(expected);
      expect(r.target).toBeNull();
    });
  }

  it("still routes a genuine 'mujhe X chahiye' target (no earn verb) to target", () => {
    const r = classifyNumberRoles("mujhe 40 LPA chahiye");
    expect(r.target).toBe(40);
    expect(r.currentCtc).toBeNull();
  });
});

describe("PRI-57: Hindi accept idioms", () => {
  for (const text of ["chalega", "chal jayega", "haan chalega", "kar lo", "de do", "bhej do"]) {
    it(`detects acceptance over a standing offer: '${text}'`, () => {
      expect(classifyAcceptance(text, { offerOnTable: true }).accepted).toBe(true);
    });
  }

  it("vetoes the rejection sense 'nahi chalega'", () => {
    expect(classifyAcceptance("yeh nahi chalega", { offerOnTable: true }).accepted).toBe(false);
    expect(classifyAcceptance("nahi chalega", { offerOnTable: true }).accepted).toBe(false);
  });

  it("phase-gates a bare Hindi accept idiom before any offer exists", () => {
    expect(classifyAcceptance("chalega", { offerOnTable: false }).accepted).toBe(false);
  });

  it("treats 'bhej do offer letter' as a strict close-consent (terminal)", () => {
    expect(detectExplicitAcceptance("haan, bhej do offer letter").accepted).toBe(true);
    expect(detectExplicitAcceptance("offer letter bhej dijiye").accepted).toBe(true);
  });
});

describe("full Hinglish transcript reaches a real close", () => {
  function aiTurn(s: NegotiationState): NegotiationState {
    const action = planNextAction(s);
    const move = pickAiMove(s);
    const text = renderCanonicalProse(action, s);
    return applyAiMove(s, move, text);
  }

  it("anchors, counters, and accepts — phase ends 'accepted', never stalls at hom=0", () => {
    let s: NegotiationState = initState({
      sessionId: "s-hinglish-close",
      role: "swe",
      company: "Acme",
      band: { initialOffer: 26, maxStretch: 34, walkAway: 20, hasEquity: true },
    });
    const answers = [
      "Abhi main 24 LPA pe hoon, fixed 20 variable 4.",
      "Notice period 60 din hai, buyout ho sakta hai.",
      "Maine pichle saal poora payments system rebuild kiya tha.",
      "Mujhe 32 LPA fixed chahiye.",
      "Theek hai, accept karta hoon.",
    ];
    for (const ans of answers) {
      s = applyCandidateAnswer(s, ans);
      s = aiTurn(s);
    }
    // currentCtc was parsed from the Hinglish opener.
    expect(s.candidateCurrentCtc).toBe(24);
    // A concrete number landed (no stall).
    expect(s.highestOfferMade).toBeGreaterThan(0);
    // The Hinglish acceptance closed the deal.
    expect(s.phase).toBe("accepted");
  });

  it("PRI-57 S1: unit-less Hindi current-CTC + 'bhej do letter' close — anchors then closes", () => {
    let s: NegotiationState = initState({
      sessionId: "s-pri57-s1",
      role: "swe",
      company: "Acme",
      band: { initialOffer: 26, maxStretch: 34, walkAway: 20, hasEquity: true },
    });
    const answers = [
      "abhi 30 milta hai mujhe, fixed 26 variable 4.",
      "notice period 60 din, buyout ho jayega.",
      "pichle saal maine pura billing system migrate kiya tha.",
      "mujhe 36 chahiye total.",
      "haan chalega, bhej do offer letter.",
    ];
    for (const ans of answers) {
      s = applyCandidateAnswer(s, ans);
      s = aiTurn(s);
    }
    // The unit-less Hindi earn-frame bound currentCtc (was the root stall).
    expect(s.candidateCurrentCtc).toBe(30);
    // A concrete offer landed — discovery completed, the bot anchored.
    expect(s.highestOfferMade).toBeGreaterThan(0);
    // The Hindi close-consent closed the deal.
    expect(s.phase).toBe("accepted");
  });
});

/* PRI-58 (2026-06-22, offline hostile accept/close sweep). The adversarial
 * battery surfaced more unambiguous same-turn close-consent idioms the bank
 * missed — each a NO-CLOSE on a genuine acceptance (bot kept negotiating over
 * an accepted offer). They split two ways:
 *
 *   - STRICT close-consent (terminal, ungated by min-turns): "where do I sign",
 *     "count me in", "you've got a deal", "let's make it official", bare
 *     "agreed", and start-the-paperwork instructions. Asking to sign / opting
 *     in / declaring a deal struck IS consent — structurally identical to the
 *     existing "send the offer letter" strict forms.
 *   - MEDIUM commitment idioms (offer-on-table phase-gated): "I'm sold" and the
 *     Hindi "aage badho / aage badhte hai" (let's move ahead).
 *
 * The load-bearing guard is the shared CONDITIONAL_DEFERRAL veto: a close idiom
 * gated on a FUTURE settlement ("where do I sign once we sort the base", "count
 * me in if you can do 40") must stay rejected by BOTH gates, so adding the new
 * accept idioms can never false-close a deferred condition. */
describe("PRI-58: hostile accept/close idioms", () => {
  const STRICT_CLOSERS = [
    "where do I sign",
    "where do I sign up",
    "count me in",
    "you've got a deal",
    "we've got a deal",
    "let's make it official",
    "let's get the paperwork going",
    "yes, let's get started with the paperwork",
    "agreed",
    "great, agreed.",
  ];
  for (const text of STRICT_CLOSERS) {
    it(`strict-closes: '${text}'`, () => {
      expect(detectExplicitAcceptance(text).accepted).toBe(true);
      expect(classifyAcceptance(text, { offerOnTable: true }).accepted).toBe(true);
    });
  }

  const MEDIUM_CLOSERS = ["I'm sold", "done bhai, aage badho", "pakka, chalo aage badhte hai"];
  for (const text of MEDIUM_CLOSERS) {
    it(`medium-accepts over a standing offer: '${text}'`, () => {
      expect(classifyAcceptance(text, { offerOnTable: true }).accepted).toBe(true);
    });
    it(`phase-gates '${text}' before any offer exists`, () => {
      expect(classifyAcceptance(text, { offerOnTable: false }).accepted).toBe(false);
    });
  }

  /* Deferral guard — the close idiom is real but gated on a future event, so it
   * is NOT a same-turn commitment. Both gates must reject. Zero false-closes. */
  const DEFERRED_REJECTS = [
    "where do I sign once we sort the base",
    "count me in if you can do 40",
    "make it official after you bump the base",
    "you've got a deal-breaker here",
    "I'm sold on the role but the comp is light",
  ];
  for (const text of DEFERRED_REJECTS) {
    it(`does NOT close (deferred/hedged): '${text}'`, () => {
      expect(detectExplicitAcceptance(text).accepted).toBe(false);
      expect(classifyAcceptance(text, { offerOnTable: true }).accepted).toBe(false);
    });
  }
});

/* PRI-59 (2026-06-22, offline PRECISION sweep). The recall-focused idioms
 * (PRI-56/57/58) each carry a short substring a hostile NON-accept shares,
 * risking the worst failure mode — a FALSE-CLOSE: the bot finalises a deal the
 * candidate is actually rejecting, hedging, or deferring. The adversarial
 * battery surfaced 12 such hijacks; all are now sealed by shared single-source
 * vetoes (TAKE_IT_HEDGE / IM_IN_HEDGE / ACCEPT_PROPOSITION / IN_PRINCIPLE +
 * a broadened CONDITIONAL_DEFERRAL that allows a noun phrase between the
 * conditional head and the settle verb). The genuine bare commits MUST still
 * close — these guards lock both directions. */
describe("PRI-59: FALSE-CLOSE precision — hostile substrings must NOT close", () => {
  const MUST_NOT_CLOSE = [
    // "I'll take it" + walk-away / stall continuation
    "I'll take it elsewhere",
    "I'll take it to my current employer",
    "I'll take it under advisement",
    "I'll take it or leave it",
    // "I accept <proposition>" — accepting a fact, not the offer
    "I accept that this is your final number, but it's too low",
    "I accept your position, however I can't move forward",
    "I accept the reality that we're far apart",
    // "I'm in <hedge noun>"
    "I'm in a tough spot here",
    "I'm in talks with another company",
    "I'm in no rush to decide",
    "I'm in the middle of other processes",
    // incomplete-commitment markers
    "I accept in principle, pending the revised base",
    // close idiom gated on a future settlement (noun phrase between)
    "where do I sign, assuming you fix the variable",
    "count me in once the relocation is sorted",
  ];
  for (const text of MUST_NOT_CLOSE) {
    it(`rejects (no false-close): '${text}'`, () => {
      expect(detectExplicitAcceptance(text).accepted).toBe(false);
      expect(classifyAcceptance(text, { offerOnTable: true }).accepted).toBe(false);
    });
  }

  /* The veto scoping must not regress the bare commits. */
  const MUST_STILL_CLOSE = ["I'll take it", "I accept", "I'm in", "where do I sign", "count me in"];
  for (const text of MUST_STILL_CLOSE) {
    it(`still closes the bare commit: '${text}'`, () => {
      const strict = detectExplicitAcceptance(text).accepted;
      const medium = classifyAcceptance(text, { offerOnTable: true }).accepted;
      expect(strict || medium).toBe(true);
    });
  }
});

/* PRI-60 (2026-06-22, offline precision + recall sweep) — three new FALSE-CLOSE
 * classes the recall idioms exposed, plus two missed genuine accepts:
 *   1. RHETORICAL / INVERTED / NEGATED performative — "why would I accept",
 *      "would I accept", "do you think I'd accept", "there's no way I accept".
 *      The bare "I accept" / "I'd accept" substring matched; the governor flips
 *      the meaning. The worst class: the bot finalizing a deal being rejected.
 *   2. "send it" over-match — "send it back / to my email / later" is a redirect
 *      or defer, not consent. Only clause-terminal "send it (over)." closes.
 *   3. Bare "deal" hijack across a comma — "No, deal's off." is a walk-away.
 * MUST_STILL_CLOSE re-locks the genuine forms each fix is scoped around. */
describe("PRI-60: rhetorical/send-it/deal FALSE-CLOSE precision + recall", () => {
  const MUST_NOT_CLOSE = [
    // rhetorical / inverted / negated performative
    "Why would I accept this?",
    "Why on earth would I accept that number?",
    "You expect me to accept that lowball?",
    "Do you really think I'd accept this?",
    "Would I accept this? Not a chance.",
    "There's no way I accept this number.",
    "No way I'd accept that.",
    // send-it redirect / defer
    "Can you send it back with a revised base?",
    "Send it back to your team and let's revisit.",
    "Send it to my email and I'll think about it.",
    "Send it later once the variable is fixed.",
    // bare-deal hijack across a comma
    "No, deal's off.",
    "Sorry, deal is dead at this number.",
  ];
  for (const text of MUST_NOT_CLOSE) {
    it(`rejects (no false-close): '${text}'`, () => {
      expect(detectExplicitAcceptance(text).accepted).toBe(false);
      expect(classifyAcceptance(text, { offerOnTable: true }).accepted).toBe(false);
    });
  }

  // The precision fixes must not regress the genuine commits they scope around.
  const MUST_STILL_CLOSE = [
    "I accept the offer.",
    "Yes, I accept.",
    "I'd accept the offer.",
    "Send it over.",
    "Yes, send it over.",
    "ok, deal.",
    "deal, 40 works for me",
    "You've got a deal.",
    // PRI-60 new recall idioms (must reach BOTH gates)
    "I'm on board.",
    "Happy to proceed.",
  ];
  for (const text of MUST_STILL_CLOSE) {
    it(`still closes the genuine accept: '${text}'`, () => {
      const strict = detectExplicitAcceptance(text).accepted;
      const medium = classifyAcceptance(text, { offerOnTable: true }).accepted;
      expect(strict || medium).toBe(true);
    });
  }

  // The two new recall idioms must reach the STRICT gate (terminal close),
  // not just medium — medium-only would be dropped by the soft-accept gate.
  for (const text of ["I'm on board.", "Happy to proceed."]) {
    it(`reaches the strict close gate: '${text}'`, () => {
      expect(detectExplicitAcceptance(text).accepted).toBe(true);
    });
  }
});

/* PRI-61 (2026-06-22, offline precision sweep) — two more FALSE-CLOSE classes:
 *   1. "I'll take it" + a stall/defer continuation the PRI-59 take-it hedge list
 *      missed — "under consideration/review", "from here", "on board", "as a
 *      maybe", "slow". All are "I'll think about it" in disguise.
 *   2. PARTIAL accept — accepts the role/premise but rejects the MONEY in the
 *      same utterance ("I accept the role but not at this comp", "I'd accept,
 *      except the variable is unacceptable"). A counter, not a clean close.
 * MUST_STILL_CLOSE re-locks the bare commits each fix is scoped around — notably
 * "I'll take it as a yes" must survive the "as a maybe"-only scoping. */
describe("PRI-61: take-it hedge gaps + partial-accept FALSE-CLOSE precision", () => {
  const MUST_NOT_CLOSE = [
    "I'll take it under consideration.",
    "I'll take it under review.",
    "I'll take it from here and get back to you.",
    "I'll take it on board and revert.",
    "I'll take it as a maybe for now.",
    "I'll take it slow and think it over.",
    "I accept the role but not at this comp.",
    "I'd accept, except the variable is unacceptable.",
    "I accept the package but the base is too low.",
  ];
  for (const text of MUST_NOT_CLOSE) {
    it(`rejects (no false-close): '${text}'`, () => {
      expect(detectExplicitAcceptance(text).accepted).toBe(false);
      expect(classifyAcceptance(text, { offerOnTable: true }).accepted).toBe(false);
    });
  }

  const MUST_STILL_CLOSE = [
    "I'll take it.",
    "Yes, I'll take it.",
    "I'll take the offer.",
    "I accept the role.",
    "I accept the role and the comp.",
    "I'll take it as a yes.",
  ];
  for (const text of MUST_STILL_CLOSE) {
    it(`still closes the genuine accept: '${text}'`, () => {
      const strict = detectExplicitAcceptance(text).accepted;
      const medium = classifyAcceptance(text, { offerOnTable: true }).accepted;
      expect(strict || medium).toBe(true);
    });
  }
});
