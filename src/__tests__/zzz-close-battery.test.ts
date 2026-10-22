import { describe, it } from "vitest";
import { writeFileSync, appendFileSync } from "node:fs";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction, actionToLever } from "../../server-handlers/_next-action-planner";

const band: NegotiationBand = {
  initialOffer: 40,
  maxStretch: 52,
  walkAway: 34,
  hasEquity: true,
  variableMax: 8,
};

function offeredAt(offer: number): NegotiationState {
  let s = initState({ sessionId: "battery", role: "engineering", company: "Flipkart", band });
  s = { ...s, minTurnsBeforeClose: 0 };
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "ctc" }, "Current CTC?");
  s = applyCandidateAnswer(s, "my current ctc is 38 LPA");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "target" }, "Target?");
  s = applyCandidateAnswer(s, "I'm targeting 50 LPA");
  s = applyAiMove(
    s,
    { lever: "open-with-offer", newTotalLpa: offer, rationale: "anchor" },
    `We can do ₹${offer} LPA.`,
  );
  s = applyCandidateAnswer(s, "let me think");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "x" }, "What's on your mind?");
  return s;
}

function probe(label: string, offer: number, utter: string) {
  const s = applyCandidateAnswer(offeredAt(offer), utter);
  const action = planNextAction(s);
  const move = actionToLever(action, s);
  const closed = action.kind === "close" || action.kind === "auto-accept";
  appendFileSync(
    "/tmp/close-battery.txt",
    `[${label}] offer=${offer} closed=${closed} kind=${action.kind} lever=${move.lever} newTotalLpa=${move.newTotalLpa}` +
      ` condAccept=${s.decisionDeadline?.conditionalAcceptance}` +
      ` | "${utter}"\n`,
  );
}

describe("zzz hostile close battery", () => {
  it("traces", () => {
    writeFileSync("/tmp/close-battery.txt", "HOSTILE CLOSE BATTERY\n");
    probe("pct-bump-10", 40, "I'll accept if you bump the base by 10%.");
    probe("pct-more-8", 40, "Give me 8% more and it's a deal.");
    probe("pct-bump-ceiling", 52, "I'll accept if you bump the base by 10%.");
    probe("vague-couple", 40, "I'll sign if you can push it up by a couple of lakhs.");
    probe("round-up-42", 40, "Round it up to 42 and we're done.");
    probe("absolute-45", 40, "Make it 45 and I'll sign.");
    probe("multi-cond", 40, "I'll accept if you bump base by 2 and add relocation.");
    probe("jb-sweetener", 40, "I'll take it if you throw in a 3L joining bonus.");

    /* ── Batch 2: new hostile accept/close patterns ──
     * MUST-NOT-CLOSE (false-close risk) */
    probe("non-reject-unmet", 40, "I'm not rejecting it, but I need the fixed higher before I sign.");
    probe("accept-if-fixed-not-total", 40, "I accept — assuming that number is fixed, not total.");
    probe("litotes-then-more", 40, "I won't say no to that, but push the base up 3L first.");
    probe("future-revisit-cond", 40, "I'll take it only if we lock a comp review at 6 months.");
    probe("date-condition", 40, "Let's lock it, but only if the joining date moves to March.");
    probe("pending-manager", 40, "Deal — pending my manager's sign-off on the notice buyout.");
    probe("soft-hedge-still-thinking", 40, "That's tempting, I'm leaning yes but not fully there.");

    /* GENUINE ACCEPT (false-non-close risk) — these SHOULD close */
    probe("where-do-i-sign", 40, "Great, where do I sign?");
    probe("litotes-clean", 40, "I won't say no to that. Let's do it.");
    probe("done-deal-clean", 40, "Done deal. Send the letter.");
    probe("proceed-clean", 40, "Sounds good, let's proceed.");

    /* ── Batch 3: hardest accept/close traps ──
     * MUST-NOT-CLOSE — accept idiom with a buried/welded unmet CASH demand */
    probe("accept-preamble-buried", 40, "Yeah, this all sounds right and I'm excited to join and contribute. One small thing though — I'd need the base at 46 before signing.");
    probe("accept-then-welded-demand", 40, "I accept the offer. That said, get me another 3L on base first.");
    probe("question-bump-then-done", 40, "Any chance you can get the base to 45? If so, done.");
    probe("sarcastic-nonaccept", 40, "Oh sure, I'll totally take a pay cut, said no one ever.");

    /* SHOULD-CLOSE — deliverable/met condition or non-cash procedural rider */
    probe("cond-already-met", 40, "I'll sign if you give me 40.");
    probe("round-down-met", 40, "Call it 40 flat and I'm in.");
    probe("double-negative-accept", 40, "There's no way I'm not taking this.");
    probe("procedural-refs", 40, "I'm in, pending reference checks on your end.");
    probe("soft-genuine-close", 40, "The role's great, comp is close, we're basically there — send the paperwork.");
    probe("accept-doc-request", 40, "I accept — and I'll want the joining bonus we discussed reflected in writing.");

    /* ── Batch 4: ordering, leverage, reshuffle, over-block guards ──
     * MUST-NOT-CLOSE */
    probe("demand-first-accept-last", 40, "The base needs to hit 46. Otherwise, yeah, I'm in.");
    probe("comparative-weld", 40, "I accept — but Google is giving me 3L more on base.");
    probe("undeliverable-1more", 52, "I'll take it if you can do just 1 more lakh.");
    probe("reshuffle-plus", 40, "I'll sign if you move 3L from variable into fixed and add 2L on top.");

    /* SHOULD-CLOSE / must-not-over-block */
    probe("not-asking-more", 40, "I'm not asking for more — let's close.");
    probe("concession-at-offer", 40, "Let's just do the 40, done.");
    probe("informal-accept", 40, "ya ill take it, send the letter");
    probe("letter-then-sign", 40, "Send me the offer letter and I'll sign it today.");
    probe("reshuffle-neutral", 40, "I'll accept the 40 — just shift 3L from variable into fixed, same total.");

    /* ── Batch 5: number-expression variety (floors, ranges, noun-forms) ──
     * MUST-NOT-CLOSE — all encode an unmet raise above the ₹40 offer */
    probe("floor-atleast", 40, "I'll sign if you can get me at least 45.");
    probe("floor-noless", 40, "Deal, as long as it's no less than 45.");
    probe("floor-northof", 40, "I'm in for something north of 45.");
    probe("floor-upwards", 40, "I'll take it at upwards of 45.");
    probe("range-between", 40, "I'll accept somewhere between 44 and 46.");
    probe("noun-hike", 40, "Give me a 15% hike and I'm in.");
    probe("noun-raise", 40, "I'll sign with a 4L raise on base.");
    probe("noun-bump-to", 40, "Just a bump to 45 and I'm in.");
    probe("roundup-to", 40, "Round it up to 45 and we're done.");
    probe("crore-hit", 40, "I'll take it if the package hits 1.2 crore.");

    /* ── Batch 6: spelled-out numbers, competing-offer match, decimals,
     *    lakh-word figures, multi-clause welds ──
     * MUST-NOT-CLOSE — each encodes an unmet raise above the ₹40 offer */
    probe("spelled-fortyfive", 40, "I'll sign if you make it forty-five.");
    probe("spelled-fortyeight", 40, "Bring the base to forty eight and I'm in.");
    probe("match-competing", 40, "I'll take it if you match my other offer of 46.");
    probe("beat-competing", 40, "Deal, if you can beat the 47 Razorpay gave me.");
    probe("decimal-target", 40, "I'm in at 45.5, not a rupee less.");
    probe("lakh-word-target", 40, "Get the fixed to 46 lakhs and we're done.");
    probe("multi-clause-weld", 40, "Look, I love the team and the mission, honestly — just get me to 47 and I'll sign tonight.");
    probe("percent-of-current", 40, "I'll accept a 20% bump over my current 38.");
    probe("bring-it-up-to", 40, "Bring it up to 46 and it's a yes from me.");
    probe("nothing-below", 40, "I won't go a rupee below 45, but then I'm yours.");

    /* ── Batch 7: approximations, vague ranges, spelled+competing, bare-figure
     *    -with-bonus, reversed floors ──
     * MUST-NOT-CLOSE — each encodes an unmet raise above the ₹40 offer */
    probe("mid-forties", 40, "I'll take it if it lands in the mid-forties.");
    probe("around-47", 40, "I'm in if it's around 47.");
    probe("roughly-46", 40, "Deal, roughly 46 works for me.");
    probe("about-48", 40, "I'll sign at about 48.");
    probe("spelled-match-competing", 40, "I'll take it if you match the forty seven Amazon gave me.");
    probe("bare-figure-plus-bonus", 40, "47 base plus a 5L joining bonus and I'm done.");
    probe("nothing-under", 40, "I'm in, but nothing under 46.");
    probe("cant-do-less", 40, "I can't do it for anything less than 46.");
    probe("north-spelled", 40, "I'll sign for something north of forty-five.");
    probe("give-or-take", 40, "I'll take it at 47, give or take.");

    /* ── Batch 8: floor-verbs, digit-handle idioms, fractional-crore words,
     *    multipliers, over/above prepositions ──
     * MUST-NOT-CLOSE — each encodes an unmet raise above the ₹40 offer */
    probe("clears-48", 40, "I'm in as long as the total clears 48.");
    probe("tops-46", 40, "Deal, provided it tops 46.");
    probe("over-45", 40, "I'll take it at anything over 45.");
    probe("above-44", 40, "I'll sign for anything above 44.");
    probe("past-45", 40, "Get me past 45 and I'm done.");
    probe("five-handle", 40, "I'll accept once it starts with a 5.");
    probe("half-crore-word", 40, "I'm in if the package is half a crore.");
    probe("two-times-current", 40, "I'll sign if you double my current 38.");
    probe("exceeds-46", 40, "Deal, so long as it exceeds 46.");
    probe("not-a-rupee-under", 40, "I'll take it, not a rupee under 47.");

    /* ── Batch 9: multipliers, percent-over-current, component-specific floors,
     *    digit-handle idioms, and over-block guards ──
     * MUST-NOT-CLOSE — each encodes an unmet raise above the ₹40 offer */
    probe("double-current", 40, "I'll sign if you double my current 38.");
    probe("twice-current", 40, "I'm in at twice my current 38.");
    probe("onepointfive-x", 40, "Deal if you do 1.5x my current 38.");
    probe("pct-over-current", 40, "I'll accept a 30% bump over my current 38.");
    probe("fixed-component-floor", 40, "I'm in if the fixed alone is 46.");
    probe("base-must-be", 40, "The base must be 47 for me to sign.");
    probe("seven-figures-hint", 40, "Get me to a 5 in front and I'll sign.");
    /* SHOULD-CLOSE / must-not-over-block — genuine accepts near these idioms */
    probe("current-is-38-accept", 40, "My current is 38, and this 40 works great — let's close.");
    probe("fixed-is-fine", 40, "The fixed looks fine, send the letter.");
    probe("base-is-good", 40, "The base is good, I'm in.");

    /* ── Batch 11: idiomatic scale-words, comparative floors, ballpark/ish
     *    approximations, positional-range, spelled-alone figures ──
     * MUST-NOT-CLOSE — each encodes an unmet raise above the ₹40 offer */
    probe("ballpark-48", 40, "I'll take it if it's in the ballpark of 48.");
    probe("ish-45", 40, "45-ish and I'm in.");
    probe("bit-more-than-45", 40, "Deal if it's a bit more than 45.");
    probe("closer-to-50", 40, "I'm in if it's closer to 50 than 40.");
    probe("in-the-50s", 40, "I'll sign if it's somewhere in the 50s.");
    probe("higher-end", 40, "Put me at the higher end of the band and I'm done.");
    probe("half-again", 40, "I'll take half again as much as my current 38.");
    probe("a-third-more", 40, "A third more than my current 38 and it's a yes.");
    probe("spelled-fifty-alone", 40, "Make it fifty and I'll sign.");
    probe("top-of-range", 40, "Top of the range and I'm in.");
    /* SHOULD-CLOSE / must-not-over-block — genuine accepts near these idioms */
    probe("ballpark-right", 40, "The comp's in the right ballpark, let's close.");
    probe("fifty-is-current", 40, "My current is already fifty, and this 40 is a step I'll take — send it.");
    probe("in-the-40s-accept", 40, "This is in the 40s and that works for me, I'm in.");

    /* ── Batch 12: positional-ceiling references, plus/and-change floors,
     *    approach-idioms, floor-noun, ultimatum ──
     * MUST-NOT-CLOSE — each encodes an unmet raise above the ₹40 offer */
    probe("plus-45", 40, "Forty-five plus and I'm in.");
    probe("and-change-45", 40, "45 and change works for me.");
    probe("pushing-50", 40, "I'll sign if it's pushing 50.");
    probe("floor-noun-45", 40, "45 is my floor, then I'm yours.");
    probe("top-of-band", 40, "Top of the band and I'll sign.");
    probe("max-of-band", 40, "Put me at the max of the band and done.");
    probe("firm-45", 40, "45, firm — then we're done.");
    probe("or-i-walk-45", 40, "I'm in at 45 or I walk.");
    probe("just-shy-50", 40, "Just shy of 50 and I'll take it.");
    probe("upper-end-band", 40, "Slot me at the upper end of the band, then yes.");
    /* SHOULD-CLOSE / must-not-over-block — genuine accepts near these idioms */
    probe("flat-firm-40", 40, "40 flat, firm, let's sign.");
    probe("floor-hit-40", 40, "40 is my floor and you've hit it, done.");
    probe("plus-jb-40", 40, "40 plus the joining bonus we discussed, I'm in.");

    /* ── Batch 13: floor-noun reversed, N-minimum, round-to-target,
     *    spelled digit-handle, relative bump ──
     * MUST-NOT-CLOSE — each encodes an unmet raise above the ₹40 offer */
    probe("floor-of-45", 40, "My floor is 45, then I'm yours.");
    probe("45-minimum", 40, "45 minimum and I'll sign.");
    probe("round-to-45", 40, "Round it up to 45 and done.");
    probe("five-in-front", 40, "As long as there is a five in front, I am in.");
    probe("bump-of-5", 40, "A bump of 5 and I'm yours.");
    probe("five-more", 40, "Five more and we're done.");
    probe("north-of-45", 40, "Anything north of 45 and I'm in.");
    probe("at-least-45", 40, "At least 45 or no deal.");
    /* SHOULD-CLOSE / must-not-over-block — genuine accepts near these idioms */
    probe("at-least-40-met", 40, "At least 40 is fine, let's sign.");
    probe("no-less-38-met", 40, "No less than 38 was my ask, you've cleared it, done.");
  });
});
