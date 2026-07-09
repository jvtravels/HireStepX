/* Adversarial wall for the conjunction-independent unmet-demand gate
 * (_utterance-intent.ts + classifyAcceptance). This is the CheckList-
 * style behavioral battery that keeps the demand-then-close FALSE-CLOSE
 * class CLOSED: it machine-generates the cross-product of
 *   {demand phrasing} × {conjunction} × {close idiom}
 * and asserts every combination is NOT accepted, regardless of the
 * joiner. The old eight bridge-vetoes only spanned `and|then|&`; a
 * comma / "plus" / "with" / no-joiner defeated all of them at once and
 * FALSE-CLOSED a conditional counter at the un-bumped offer — the worst
 * failure mode. If any future edit reopens a joiner, this wall goes red.
 *
 * The safe-default contract under test: an unmet demand can only BLOCK
 * a close, never create one. Missing a genuine accept costs one turn;
 * fabricating a close on a demand is unrecoverable — so these assert the
 * safe direction exhaustively, and a companion block asserts genuine
 * unconditional accepts still fire (no over-blocking). */
import { describe, it, expect } from "vitest";
import {
  classifyAcceptance,
  detectExplicitAcceptance,
} from "../../server-handlers/_acceptance-classifier";
import { analyzeDemand, carriesUnmetDemand } from "../../server-handlers/_utterance-intent";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" as const };
const accepted = (t: string) => classifyAcceptance(t, ctx).accepted;

/* Demand clauses that, at a ₹40L standing offer, are unmet raises. */
const DEMANDS = [
  "bump the base by 5 lakh",
  "add 5 lakh to the base",
  "match my current base",
  "give me 45",
  "throw in relocation",
  "make it a Principal role",
  "push the base up by a couple percent",
  "get the fixed to 55",
  "I want 2 lakh more",
  "a lakh more",
  "beat their number",
  "include equity",
];

/* Close / commit idioms the candidate welds the demand to. */
const CLOSERS = [
  "I'll sign today",
  "I'm in",
  "deal",
  "count me in",
  "let's close it",
  "you've got a deal",
  "I'll take it",
];

/* Every conjunction that must NOT let the demand slip past — the old
 * vetoes only handled the first three. */
const JOINERS = [", ", " and ", " then ", " & ", " plus ", " with ", "; ", " — ", ". "];

describe("intent gate — generated demand × joiner × closer battery must never FALSE-CLOSE", () => {
  for (const d of DEMANDS) {
    for (const j of JOINERS) {
      for (const c of CLOSERS) {
        const utter = `${d}${j}${c}.`;
        it(`no-close: "${utter}"`, () => expect(accepted(utter)).toBe(false));
      }
    }
  }
});

/* Reversed order — closer first, demand second — must also block. */
describe("intent gate — reversed (closer then demand) must never FALSE-CLOSE", () => {
  for (const d of DEMANDS.slice(0, 6)) {
    for (const c of CLOSERS.slice(0, 4)) {
      const utter = `${c}, but ${d}.`;
      it(`no-close: "${utter}"`, () => expect(accepted(utter)).toBe(false));
    }
  }
});

/* Genuine unconditional accepts — the demand detector must NOT
 * over-block. A number at or below the offer is a concession, not a
 * demand; a numberless commit carries no demand. */
const GENUINE = [
  "Alright, let's do this.",
  "You've got a deal.",
  "Send the paperwork, I'm in.",
  "Okay, I'll take it.",
  "That works for me, let's proceed.",
  "Fine, I accept.",
  "Deal. Send the letter.",
  "Okay, 40 works, I'll take it.",
  "I'll take 40.",
  "Yes, send me the offer letter.",
  "Give me the paperwork and I'm in.",
  "Happy at 38, let's close.",
  "I'll do 40 lpa.",
];
describe("intent gate — genuine unconditional accepts still fire (no over-block)", () => {
  for (const t of GENUINE) {
    it(`accepts: "${t}"`, () => expect(accepted(t)).toBe(true));
  }
});

/* Hostile-probe round (2026-07-09) — demand-then-close phrasings the
 * demand×joiner×closer battery does NOT span: question-form demands,
 * non-imperative sweetener asks, and million/crore currency units. Each
 * must block; each was a live leak before the sweetener-demand /
 * demand-question cores and unit normalization landed. */
describe("intent gate — novel demand-then-close phrasings must block", () => {
  const HOSTILE = [
    // question-form absolute demand > offer
    "could you do 46? deal",
    "any chance of 45? I'll take it",
    "can you get me to 45? I'm in",
    // non-imperative sweetener demand
    "it'd be great to see relocation added, deal",
    "would be perfect with a joining bonus, I'll sign",
    "fine on base but I need equity, deal",
    "I accept, just add a 5 lakh signing bonus",
    // million / crore currency units normalized to lakhs
    "push it to 4.5M, I'll take it",
    "make it 0.5 crore, deal",
  ];
  for (const t of HOSTILE) {
    it(`no-close: "${t}"`, () => expect(accepted(t)).toBe(false));
  }
});

/* Acquiescence conditionals are CONCESSION accepts, not hard conditionals —
 * the broad "if" veto and the bridge-style conditional-accept veto both
 * over-blocked them before the acquiescence exception landed. */
describe("intent gate — acquiescence conditionals still accept (no over-block)", () => {
  for (const t of [
    "if that's the best you can do, I'll take it",
    "if you say so, deal",
    "if that works for you, count me in",
  ]) {
    it(`accepts: "${t}"`, () => expect(accepted(t)).toBe(true));
  }
});

/* Lockstep wall (2026-07-09) — the STRICT gate (detectExplicitAcceptance)
 * drives the closing UI + kernel escalation-boost, so a strict FALSE-ACCEPT on
 * an unmet demand is a soft FALSE-CLOSE. Its HEDGE_VETO_PATTERNS spread only the
 * old conjunction-bridge vetoes (and|then|&); a comma/plus/with/no-joiner
 * defeated them and matched a strict close idiom. A differential probe found
 * 407/756 demand-then-close utterances accepted by the strict gate while the
 * medium gate blocked them. The fix wired analyzeDemand (single source of truth)
 * into detectExplicitAcceptance. This wall asserts the two gates stay in
 * lockstep: the strict gate must NEVER accept an offer-independent demand welded
 * to a close idiom, across every joiner. If a future edit desyncs them, red. */
describe("gate lockstep — strict gate must never accept a demand-then-close", () => {
  /* Offer-independent demands (relative / sweetener / comparative / title /
   * absolute-TARGET change) — flagged by analyzeDemand even with no offer, which
   * is all the strict gate has. Bare "give me N" is excluded: it needs the offer
   * to prove it exceeds, so the strict gate deliberately cannot flag it. */
  const OFFER_INDEPENDENT = [
    "bump the base by 5 lakh",
    "add 5 lakh to the base",
    "match my current base",
    "throw in relocation",
    "make it a Principal role",
    "push the base up by a couple percent",
    "get the fixed to 55",
    "I want 2 lakh more",
    "a lakh more",
    "beat their number",
    "include equity",
    "make it 50",
  ];
  const STRICT_CLOSERS = [
    "I'll take it",
    "I'm in",
    "let's close it",
    "you've got a deal",
    "let's go ahead",
    "send the offer letter",
  ];
  for (const d of OFFER_INDEPENDENT) {
    for (const j of [", ", " and ", " then ", " plus ", " with ", "; ", ". "]) {
      for (const c of STRICT_CLOSERS) {
        const utter = `${d}${j}${c}.`;
        it(`strict blocks: "${utter}"`, () =>
          expect(detectExplicitAcceptance(utter).accepted).toBe(false));
      }
    }
  }
  /* And the strict gate must still fire on clean performatives (no over-block). */
  for (const t of [
    "I accept the offer.",
    "Please send me the offer letter.",
    "I'll take it.",
    "Yes, let's close it.",
    "Let's go ahead.",
  ]) {
    it(`strict accepts clean: "${t}"`, () =>
      expect(detectExplicitAcceptance(t).accepted).toBe(true));
  }
});

/* Future-deferral wall (2026-07-09) — a strong commit verb (sign/take/accept/
 * in) gated on a NOT-yet-true reference point: a clock time ("give me till
 * Monday"), a future event ("the day the joining bonus lands"), a perfect-tense
 * consult ("after I've run it past my spouse"), or a pending revised document
 * ("send the revised letter"). The commit is deferred, so closing NOW is a
 * FALSE-CLOSE. A differential probe found four such phrasings slipping BOTH
 * gates — the demand/consult/review vetoes each required a token these forms
 * lack (a grant verb, a present-tense consult subject, a review verb). The fix
 * widened CONSULT_DEFERRAL to the perfect tense and added TEMPORAL_DEFERRAL /
 * FUTURE_EVENT_CLOSE / REVISED_DOCUMENT to the shared veto array, so both gates
 * reject in lockstep. If a future edit reopens any, this wall goes red. */
describe("intent gate — future/temporal-deferral accepts must never FALSE-CLOSE", () => {
  const DEFERRED = [
    "I'll sign once you put the relocation in writing.",
    "As soon as the equity is confirmed, I'll take it.",
    "I'll accept the moment HR sends the revised letter.",
    "Give me till Monday and I'll sign.",
    "Once it's all in writing, you've got a deal.",
    "I'm ready to sign the minute you bump it to 45.",
    "The day the joining bonus lands, I'm in.",
    "I'll take it after I've run it past my spouse.",
    "Send the revised letter and I'll sign then.",
    "When the base hits 45, count me in.",
    "Get me a couple of days, then deal.",
    "The moment the equity clears, count me in.",
    "Share the updated offer and I'm in.",
  ];
  for (const t of DEFERRED) {
    it(`medium blocks: "${t}"`, () => expect(accepted(t)).toBe(false));
    it(`strict blocks: "${t}"`, () =>
      expect(detectExplicitAcceptance(t).accepted).toBe(false));
  }
});

/* Dismissive-offer-characterization wall (2026-07-09) — a close idiom welded to
 * a PEJORATIVE description of the offer ("count me in, for a pay cut", "I'll take
 * it if you enjoy lowballing me", "deal, if you call this an offer"). The close
 * idiom matches, but the candidate is calling the offer a pay cut / lowball /
 * insult — a sarcastic refusal, so closing is a soft FALSE-CLOSE. A differential
 * probe found 7/10 such phrasings accepted by one or both gates; the fix added
 * DISMISSIVE_OFFER_CHARACTERIZATION_PATTERN to the shared veto array, so both
 * gates reject in lockstep. If a future edit reopens any, this wall goes red. */
describe("intent gate — pejorative offer-characterization + close must never FALSE-CLOSE", () => {
  const DISMISSIVE = [
    "Sure, I'll take it — if you enjoy lowballing me.",
    "Great, count me in, for a pay cut.",
    "Yeah, I'll sign — for someone with half my experience.",
    "Perfect, I accept, if I wanted to be underpaid.",
    "Fine, deal, if you call this an offer.",
    "Sure thing, I'll take it, what a joke.",
    "Deal, what an insult.",
  ];
  for (const t of DISMISSIVE) {
    it(`medium blocks: "${t}"`, () => expect(accepted(t)).toBe(false));
    it(`strict blocks: "${t}"`, () =>
      expect(detectExplicitAcceptance(t).accepted).toBe(false));
  }

  /* No over-block: a SINCERE accept that praises the offer ("so generous") must
     still fire. "so generous" is intentionally NOT a veto token — it carries a
     common genuine-accept sense that the pejorative tokens above do not. */
  for (const t of [
    "That's so generous, I'll take it!",
    "Wow, so generous of you — I'm in.",
    "I'll take it.",
    "Deal, send the paperwork.",
  ]) {
    it(`still accepts sincere: "${t}"`, () => expect(accepted(t)).toBe(true));
  }
});

describe("analyzeDemand — structured extractor unit behavior", () => {
  it("flags an above-offer bare demand only when the offer is known and exceeded", () => {
    expect(carriesUnmetDemand("give me 45", 40)).toBe(true);
    expect(carriesUnmetDemand("give me 40", 40)).toBe(false); // at offer = concession
    expect(carriesUnmetDemand("give me 45")).toBe(false); // offer unknown → not provably a demand
  });
  it("flags an absolute raise target only when it beats the offer", () => {
    expect(carriesUnmetDemand("make it 50", 40)).toBe(true);
    expect(carriesUnmetDemand("make it 40", 40)).toBe(false);
  });
  it("always flags relative/sweetener/comparative/title asks (inherently upward)", () => {
    expect(carriesUnmetDemand("a lakh more", 40)).toBe(true);
    expect(carriesUnmetDemand("throw in a joining bonus", 40)).toBe(true);
    expect(carriesUnmetDemand("beat their number", 40)).toBe(true);
    expect(carriesUnmetDemand("make it a Staff title", 40)).toBe(true);
  });
  it("does not flag gratitude or numberless commits", () => {
    expect(carriesUnmetDemand("3% more than I expected, deal", 40)).toBe(false);
    expect(carriesUnmetDemand("send me the paperwork", 40)).toBe(false);
    expect(carriesUnmetDemand("I'll take it", 40)).toBe(false);
  });
  it("reports which cores fired for telemetry", () => {
    expect(analyzeDemand("make it 50", 40).reasons).toContain("raise-to-target");
    expect(analyzeDemand("throw in equity", 40).reasons).toContain("grant-sweetener");
  });
  /* Pre-number increase word ("another 3L", "an extra 5%", "a further 2L").
   * The increase intent sits BEFORE the figure, so relative-more /
   * demand-for-more (trailing more/higher/extra) miss it — this was the
   * "get me another 3L on base first" welded-demand false-close leak
   * (batch-3 hostile battery, 2026-07-09). Always upward → offer-independent. */
  it("flags a pre-number 'another/extra/additional/further N' cash demand", () => {
    expect(analyzeDemand("get me another 3L on base first").reasons).toContain("another-more");
    expect(carriesUnmetDemand("an extra 5%", 40)).toBe(true);
    expect(carriesUnmetDemand("an additional 3 lakh", 40)).toBe(true);
    expect(carriesUnmetDemand("a further 2L on base", 40)).toBe(true);
    expect(carriesUnmetDemand("another 3 on base", 40)).toBe(true);
    // non-comp "another N" must NOT be read as a cash demand
    expect(carriesUnmetDemand("happy to do another 3 rounds of interviews", 40)).toBe(false);
    expect(carriesUnmetDemand("give me another 2 weeks to decide", 40)).toBe(false);
  });
  it("blocks both gates on an accept idiom welded to a pre-number 'another N' demand", () => {
    const t = "I accept the offer. That said, get me another 3L on base first.";
    expect(accepted(t)).toBe(false);
    expect(detectExplicitAcceptance(t).accepted).toBe(false);
  });
  /* Prepositionless landing verb ("hit/reach/touch/sit at/land at N").
   * raise-to-target needs an explicit "to", so "the base needs to hit 46"
   * slipped through and false-closed "…Otherwise, yeah, I'm in." at the
   * un-bumped offer (batch-4 hostile battery, 2026-07-09). Offer-gated. */
  it("flags a landing-verb absolute target only when it beats the offer", () => {
    expect(carriesUnmetDemand("the base needs to hit 46", 40)).toBe(true);
    expect(carriesUnmetDemand("the base needs to hit 46", 50)).toBe(false); // below offer
    expect(carriesUnmetDemand("reach 50", 40)).toBe(true);
    expect(carriesUnmetDemand("just sit at 48 and I'm in", 40)).toBe(true);
    // comp-context verbs with no adjacent figure must NOT match
    expect(carriesUnmetDemand("I'll reach out to HR, deal at 40.", 40)).toBe(false);
    expect(carriesUnmetDemand("we hit it off, I accept the 40.", 40)).toBe(false);
    expect(carriesUnmetDemand("let me touch base with my spouse, then I'm in.", 40)).toBe(false);
  });
  it("blocks both gates on a landing-verb demand welded before an accept idiom", () => {
    const t = "The base needs to hit 46. Otherwise, yeah, I'm in.";
    expect(accepted(t)).toBe(false);
    expect(detectExplicitAcceptance(t).accepted).toBe(false);
  });

  /* Verb-inflection twin of the landing-verb core: "hits/reaches/touches"
   * (batch-5 hostile battery, 2026-07-09). The original core required the
   * bare verb + "\s", so inflected forms slipped through. */
  it("flags inflected landing verbs (hits/reaches/touches) above the offer", () => {
    expect(carriesUnmetDemand("the package hits 1.2 crore", 40)).toBe(true);
    expect(carriesUnmetDemand("once it reaches 50", 40)).toBe(true);
    expect(carriesUnmetDemand("the base touches 46", 40)).toBe(true);
    expect(carriesUnmetDemand("once it reaches 50", 55)).toBe(false); // below offer
  });

  /* Floor expressions ("at least/no less than/north of/upwards of/in excess
   * of/minimum of/starting at N") name a lower bound the package must meet —
   * an absolute-target demand. "I'm in for something north of 45" false-closed
   * at the ₹40 offer (batch-5 hostile battery, 2026-07-09). Offer-gated. */
  it("flags a floor expression only when the floor beats the offer", () => {
    expect(carriesUnmetDemand("at least 45", 40)).toBe(true);
    expect(carriesUnmetDemand("no less than 45", 40)).toBe(true);
    expect(carriesUnmetDemand("something north of 45", 40)).toBe(true);
    expect(carriesUnmetDemand("upwards of 45", 40)).toBe(true);
    expect(carriesUnmetDemand("in excess of 45", 40)).toBe(true);
    expect(carriesUnmetDemand("a minimum of 45", 40)).toBe(true);
    expect(carriesUnmetDemand("starting at 45", 40)).toBe(true);
    expect(carriesUnmetDemand("at least 40", 40)).toBe(false); // at offer
    expect(carriesUnmetDemand("north of 38", 40)).toBe(false); // below offer
    // offer-unknown: still counts (blocks the strict gate)
    expect(carriesUnmetDemand("north of 45")).toBe(true);
    // non-comp uses with no adjacent figure must NOT match
    expect(carriesUnmetDemand("we're north of the city, deal at 40.", 40)).toBe(false);
    expect(carriesUnmetDemand("at least it's a fair number, I'm in.", 40)).toBe(false);
  });

  /* Noun-form raises ("a 15% hike", "a 4L raise", "a 5% increment") carry the
   * increase intent in a raise NOUN after the figure — missed by verb-magnitude
   * and relative-more. Always unmet (a raise only adds). Excluded after "the"
   * (satisfaction reference, not a demand) so an accept is not over-blocked.
   * Batch-5 hostile battery, 2026-07-09. */
  it("flags a noun-form raise (always unmet), except in a satisfaction frame", () => {
    expect(carriesUnmetDemand("a 15% hike", 40)).toBe(true);
    expect(carriesUnmetDemand("a 4L raise on base", 40)).toBe(true);
    expect(carriesUnmetDemand("a 5% increment", 40)).toBe(true);
    expect(carriesUnmetDemand("a 3L bump", 40)).toBe(true);
    expect(carriesUnmetDemand("a 4L increase", 40)).toBe(true);
    // "the <N> hike" is satisfaction with an agreed item, not a fresh demand
    expect(carriesUnmetDemand("happy with the 15% hike, deal.", 40)).toBe(false);
    // a raise VERB ("raise the question") without an adjacent figure/unit
    expect(carriesUnmetDemand("let me raise the question with HR, I'm in.", 40)).toBe(false);
  });

  it("blocks both gates on a floor/noun/inflected demand welded to an accept", () => {
    for (const t of [
      "I'm in for something north of 45.",
      "Give me a 15% hike and I'm in.",
      "I'll take it if the package hits 1.2 crore.",
    ]) {
      expect(accepted(t)).toBe(false);
      expect(detectExplicitAcceptance(t).accepted).toBe(false);
    }
  });

  /* Competing-offer match ("match my other offer of 46", "beat a competing
   * offer") — beat-match's object list omitted "offer"/"other", so the strict
   * gate read a clean accept and false-closed (batch-6 hostile battery,
   * 2026-07-09). Always unmet (matching a competing figure is upward). */
  it("flags a competing-offer match/beat (always unmet)", () => {
    expect(carriesUnmetDemand("match my other offer of 46", 40)).toBe(true);
    expect(carriesUnmetDemand("just match my offer", 40)).toBe(true);
    expect(carriesUnmetDemand("beat a competing offer", 40)).toBe(true);
    expect(carriesUnmetDemand("match the rival offer", 40)).toBe(true);
    // still fires on the original phrasings
    expect(carriesUnmetDemand("beat their number", 40)).toBe(true);
    expect(carriesUnmetDemand("match my current base", 40)).toBe(true);
    // over-block guards: non-comp "match" objects must NOT fire
    expect(carriesUnmetDemand("match my energy and I'm in", 40)).toBe(false);
    expect(carriesUnmetDemand("I'll match your enthusiasm, deal", 40)).toBe(false);
  });

  /* Trailing floor idiom ("…, not a rupee/penny/paisa less") — the floor sits
   * AFTER the figure, so floor-target (which leads with the floor phrase)
   * missed it and the strict gate false-closed "I'm in at 45.5, not a rupee
   * less" at the offer (batch-6 hostile battery, 2026-07-09). Offer-gated,
   * counts when the offer is unknown so the strict gate blocks it. */
  it("flags a trailing floor idiom only when the pinned figure beats the offer", () => {
    expect(carriesUnmetDemand("I'm in at 45.5, not a rupee less", 40)).toBe(true);
    expect(carriesUnmetDemand("46, not a penny less", 40)).toBe(true);
    expect(carriesUnmetDemand("do 47, not a paisa lower", 40)).toBe(true);
    expect(carriesUnmetDemand("40, not a rupee less", 40)).toBe(false); // at offer
    // offer-unknown: still counts (blocks the strict gate)
    expect(carriesUnmetDemand("I'm in at 45.5, not a rupee less")).toBe(true);
    // over-block guard: no leading figure adjacent to the coin idiom
    expect(carriesUnmetDemand("it's fair, not a penny less than fair", 40)).toBe(false);
  });

  it("blocks both gates on a competing-match / trailing-floor demand", () => {
    for (const t of [
      "I'll take it if you match my other offer of 46.",
      "I'm in at 45.5, not a rupee less.",
    ]) {
      expect(accepted(t)).toBe(false);
      expect(detectExplicitAcceptance(t).accepted).toBe(false);
    }
  });

  /* Spelled-out figures ("forty eight") — candidates and STT transcripts spell
   * salary numbers out, but every demand core needs a DIGIT, so "Bring the base
   * to forty eight and I'm in" false-closed at the un-bumped offer (deferred
   * batch-6 leak, closed 2026-07-09). analyzeDemand now normalizes spelled
   * cardinals to digits at its single choke point, so ALL cores + BOTH gates
   * inherit it. Conservative: only <tens>[-\s]<ones> / bare-tens / teen forms,
   * never bare ones ("one"/"two") which are usually articles/quantifiers. */
  it("flags a spelled-out target above the offer (tens, tens+ones, teens)", () => {
    expect(carriesUnmetDemand("make it forty-five", 40)).toBe(true);
    expect(carriesUnmetDemand("bring the base to forty eight", 40)).toBe(true);
    expect(carriesUnmetDemand("I need fifty two flat", 40)).toBe(true);
    expect(carriesUnmetDemand("raise it to sixty", 40)).toBe(true);
    // offer-gated: a spelled figure at/below the offer is met, no demand
    expect(carriesUnmetDemand("make it thirty-five", 40)).toBe(false);
    // offer-unknown: still counts so the strict gate blocks it
    expect(carriesUnmetDemand("bring the base to forty eight")).toBe(true);
  });

  it("does NOT convert spelled words in ordinary prose (over-block guard)", () => {
    expect(carriesUnmetDemand("I'm excited for the role", 40)).toBe(false);
    expect(carriesUnmetDemand("one small thing though, sounds good", 40)).toBe(false);
    expect(carriesUnmetDemand("give me a couple minutes", 40)).toBe(false);
    expect(carriesUnmetDemand("let's go fifty-fifty on it", 40)).toBe(false);
    expect(carriesUnmetDemand("there were forty-odd people there", 40)).toBe(false);
    expect(carriesUnmetDemand("call me in ten minutes", 40)).toBe(false);
  });

  it("blocks both gates on a spelled-out welded demand", () => {
    for (const t of [
      "Bring the base to forty eight and I'm in.",
      "I'll sign if you make it forty-five.",
    ]) {
      expect(accepted(t)).toBe(false);
      expect(detectExplicitAcceptance(t).accepted).toBe(false);
    }
  });

  /* Beat/match a bare competing FIGURE ("beat the 47", "match 46"). beat-match
   * only bound an OBJECT WORD after the verb, so a competing number quoted bare
   * slipped through; the planner's acceptanceUtteranceFigure then read that
   * figure (within 6% of the sticky target) as an AGREED close and closed AT it
   * — a false-close, since "beat 47" demands strictly MORE than 47 (offline
   * hostile battery, 2026-07-09). Offer-gated absolute target. */
  it("flags a beat/match of a bare figure above the offer", () => {
    expect(carriesUnmetDemand("beat the 47 Razorpay gave me", 40)).toBe(true);
    expect(carriesUnmetDemand("match 46", 40)).toBe(true);
    expect(carriesUnmetDemand("you'll need to exceed the 48 I have", 40)).toBe(true);
    expect(carriesUnmetDemand("top the 50 they offered", 40)).toBe(true);
    // offer-gated: a figure at/below the offer is met, not a demand
    expect(carriesUnmetDemand("beat the 35 elsewhere", 40)).toBe(false);
    // offer-unknown: still counts so the strict gate blocks it
    expect(carriesUnmetDemand("beat the 47 Razorpay gave me")).toBe(true);
  });

  it("does NOT flag beat/match with no numeric object (over-block guard)", () => {
    expect(carriesUnmetDemand("we need to beat the deadline", 40)).toBe(false);
    expect(carriesUnmetDemand("I'll match your energy", 40)).toBe(false);
    expect(carriesUnmetDemand("please beat the 3 references I sent", 40)).toBe(false);
  });

  it("blocks both gates on a beat-the-figure demand", () => {
    for (const t of [
      "Deal, if you can beat the 47 Razorpay gave me.",
      "I'm in if you exceed the 48 I already have.",
    ]) {
      expect(accepted(t)).toBe(false);
      expect(detectExplicitAcceptance(t).accepted).toBe(false);
    }
  });

  /* Vague decade-band demand ("in the mid-forties") — no literal digit, so
   * every digit-anchored core AND the planner's figure resolvers missed it and
   * the conditional accept false-closed at the un-bumped offer (batch-7 hostile
   * leak, 2026-07-09). A representative figure is derived from the band
   * (low/early +2, mid/middle +5, high/late +8 over the decade), offer-gated. */
  it("flags a decade-band demand above the offer, gated by band", () => {
    expect(carriesUnmetDemand("I'll take it if it lands in the mid-forties", 40)).toBe(true);
    expect(carriesUnmetDemand("I want something in the low fifties", 40)).toBe(true);
    expect(carriesUnmetDemand("high forties works", 40)).toBe(true);
    expect(carriesUnmetDemand("somewhere in the mid forties", 40)).toBe(true);
    // offer-gated: a band at/below the offer is met, not a demand
    expect(carriesUnmetDemand("low forties is fine", 42)).toBe(false); // ~42 <= 42
    expect(carriesUnmetDemand("mid thirties is okay", 40)).toBe(false); // ~35 <= 40
    // offer-unknown: still counts so the strict gate blocks it
    expect(carriesUnmetDemand("I'll take it in the mid-forties")).toBe(true);
    // over-block guards — era references and generic prose stay clean
    expect(carriesUnmetDemand("back in the nineties things were different", 40)).toBe(false);
    expect(carriesUnmetDemand("there's nothing here to review", 40)).toBe(false);
  });

  /* Negative-floor idiom ("nothing under 46", "not under 45") — a floor stated
   * as a prohibition. floor-target's leading-phrase list omitted it, so it
   * close-recap'd at the un-bumped offer (batch-7 hostile leak, 2026-07-09). */
  it("flags a negative-floor idiom only when the floor beats the offer", () => {
    expect(carriesUnmetDemand("I'm in, but nothing under 46", 40)).toBe(true);
    expect(carriesUnmetDemand("not under 45 and I'm yours", 40)).toBe(true);
    expect(carriesUnmetDemand("nothing below 47", 40)).toBe(true);
    expect(carriesUnmetDemand("nothing under 38", 40)).toBe(false); // 38 <= 40, met
  });

  it("blocks both gates on a decade-band / negative-floor demand", () => {
    for (const t of [
      "I'll take it if it lands in the mid-forties.",
      "I'm in, but nothing under 46.",
    ]) {
      expect(accepted(t)).toBe(false);
      expect(detectExplicitAcceptance(t).accepted).toBe(false);
    }
  });

  /* Preposition/verb floor idioms ("over 45", "above 44", "it tops 46",
   * "clears 48", "crosses 45", "breaks 46", "surpasses 45") — each pins a floor
   * the package must exceed. The floor-target alternation omitted them, so they
   * false-closed at the ₹40 offer (batch-8 hostile leak, 2026-07-09). Offer-
   * gated, so a below-offer number is met. */
  it("flags preposition/verb floor idioms only when the floor beats the offer", () => {
    expect(carriesUnmetDemand("I'll take it at anything over 45", 40)).toBe(true);
    expect(carriesUnmetDemand("I'll sign for anything above 44", 40)).toBe(true);
    expect(carriesUnmetDemand("provided it tops 46", 40)).toBe(true);
    expect(carriesUnmetDemand("as long as the total clears 48", 40)).toBe(true);
    expect(carriesUnmetDemand("so long as it crosses 45", 40)).toBe(true);
    expect(carriesUnmetDemand("only if it breaks 46", 40)).toBe(true);
    expect(carriesUnmetDemand("if it surpasses 45", 40)).toBe(true);
    // Below-offer floors are met, not demands.
    expect(carriesUnmetDemand("anything over 30 is fine", 40)).toBe(false);
    expect(carriesUnmetDemand("as long as it clears 38", 40)).toBe(false);
    // Offer unknown (strict gate) still flags the floor.
    expect(carriesUnmetDemand("anything over 45")).toBe(true);
  });

  /* Word-form fractional crore ("half a crore" = 50L, "quarter crore" = 25L,
   * "three quarters of a crore" = 75L) — a crore-scale target with no lakh
   * digit, missed by every digit-anchored core; false-closed at the ₹40 offer
   * (batch-8 hostile leak, 2026-07-09). Offer-gated absolute. */
  it("flags a word-form fractional crore, gated by offer", () => {
    expect(carriesUnmetDemand("I'm in if the package is half a crore", 40)).toBe(true);
    expect(carriesUnmetDemand("three quarters of a crore works", 40)).toBe(true);
    expect(carriesUnmetDemand("half a crore", 40)).toBe(true);
    // A quarter crore (25L) is below the ₹40 offer — met, not a demand.
    expect(carriesUnmetDemand("a quarter crore is fine", 40)).toBe(false);
    // Offer unknown (strict gate) still flags it.
    expect(carriesUnmetDemand("if it's half a crore")).toBe(true);
  });

  it("blocks both gates on a floor-idiom / fractional-crore demand", () => {
    for (const t of [
      "I'm in as long as the total clears 48.",
      "I'll take it at anything over 45.",
      "I'm in if the package is half a crore.",
    ]) {
      expect(accepted(t)).toBe(false);
      expect(detectExplicitAcceptance(t).accepted).toBe(false);
    }
  });
});

/* Nibble-after-accept wall (2026-07-09, offline hostile battery). A close
 * idiom stated FIRST, then gated on a trailing condition/demand
 * ("I'll take it, as long as you bump the base to 48", "...contingent on a
 * WFH guarantee", "...assuming the base moves to 50", "...subject to the
 * relocation clause"). A conditional accept is never an unconditional close —
 * the trailing condition means the deal is NOT done. Probe found three that
 * leaked: two because HARD_CONDITIONAL_PATTERN omitted "assuming" / "subject
 * to", and two on the strict gate because it never applied the conditional
 * veto at all (its offer-unknown analyzeDemand can't see a WFH/title/passive
 * demand). Fix wired both gates through the shared blockingConditionalReason()
 * so they veto in lockstep. Asserts every nibble is blocked on BOTH gates and
 * a companion block asserts unconditional accepts still fire (no over-block). */
describe("intent gate — nibble/conditional AFTER an accept idiom must never FALSE-CLOSE", () => {
  const NIBBLES = [
    "I'll take it, as long as you bump the base to 48.",
    "Yes, I accept — provided you add a 5 lakh joining bonus.",
    "Deal, but I'll need relocation covered first.",
    "Sounds good, I'm in, once you confirm the Principal title.",
    "Okay let's do it, assuming the base moves to 50.",
    "Great, count me in — just get the fixed to 55 and we're set.",
    "I'll sign, but only if you match my current 46.",
    "Perfect, I accept, pending you throw in the sign-on bonus.",
    "Alright, I'm on board, so long as equity is added.",
    "Done deal — well, after you push the base up 2 lakh.",
    "Yeah I'll take the offer, contingent on a WFH guarantee.",
    "I'm ready to accept the moment you bump it by 4 lakh.",
    "Consider it accepted, provided the number hits 52.",
    "You've got a deal, subject to the relocation clause.",
    "Happy to accept — one thing, I need 2 lakh more first.",
  ];
  for (const t of NIBBLES) {
    it(`medium gate blocks: "${t}"`, () => expect(accepted(t)).toBe(false));
    it(`strict gate blocks: "${t}"`, () =>
      expect(detectExplicitAcceptance(t).accepted).toBe(false));
  }

  const CLEAN = [
    "I'll take it.",
    "Yes, I accept the offer.",
    "Deal, send the paperwork.",
    "Great, count me in.",
    "Perfect, that works — I'm in.",
    "If that's the best you can do, I'll take it.", // acquiescence carve-out survives
  ];
  for (const t of CLEAN) {
    it(`still accepts unconditional: "${t}"`, () => expect(accepted(t)).toBe(true));
  }
});
