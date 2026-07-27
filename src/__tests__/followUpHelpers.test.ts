import { describe, it, expect } from "vitest";
import {
  detectCandidateIntent,
  extractCandidateSalaryNumber,
  truncateConversationHistory,
  detectSalaryPhase,
  pickServerCounter,
  pickNextMove,
  extractMirrorTokens,
  isBreakdownAsk,
  normalizeForDuplicate,
  isDuplicateOfRecent,
  composeDuplicateReplyRescue,
  sanitizeBehaviouralRegister,
} from "../../server-handlers/_follow-up-helpers";
import { isWalkAway } from "../../server-handlers/_walkaway-detection";

/**
 * follow-up.ts is 697 lines and was entirely uncovered. The two highest-
 * risk pieces are intent detection (wrong banner → LLM gets wrong
 * instructions → catastrophic prompt misbehaviour) and salary-number
 * extraction (wrong number mirrored back to candidate → trust collapse).
 *
 * Both are regex-driven and have many edge cases — this test file pins
 * the behaviour so a regex tweak can't silently break the salary-
 * negotiation interview without turning CI red.
 */

describe("detectCandidateIntent", () => {
  it("empty input → all flags false", () => {
    const r = detectCandidateIntent("");
    expect(r).toEqual({
      accepted: false, conditionalAccept: false, rejected: false,
      walkAway: false, deflected: false, needsTime: false, mentionedCompeting: false,
    });
  });

  describe("acceptance", () => {
    it("clear 'I accept' wins", () => {
      expect(detectCandidateIntent("I accept the offer").accepted).toBe(true);
    });

    it("short affirmative ('yes', 'okay', 'sure') counts as acceptance", () => {
      expect(detectCandidateIntent("yes").accepted).toBe(true);
      expect(detectCandidateIntent("okay sounds good").accepted).toBe(true);
      expect(detectCandidateIntent("sure").accepted).toBe(true);
      expect(detectCandidateIntent("deal").accepted).toBe(true);
    });

    it("long answer that happens to start with 'yes' is NOT a short affirmative", () => {
      const r = detectCandidateIntent("yes but I have several concerns about the equity component and the learning budget and also the base salary figure");
      expect(r.accepted).toBe(false);
    });

    it("hedge after accept → conditional acceptance (still accepted=true)", () => {
      const r = detectCandidateIntent("I accept the offer but I'd like to discuss equity");
      expect(r.accepted).toBe(true);
      expect(r.conditionalAccept).toBe(true);
    });

    it("hedge AFTER accept that contains a rejection → rejection wins (accepted=false)", () => {
      const r = detectCandidateIntent("I accept the offer but it's too low to take seriously");
      expect(r.accepted).toBe(false);
      expect(r.rejected).toBe(true);
    });

    it("S83-B1: 'As agreed, I expect the joining date to change' must NOT be accepted", () => {
      expect(detectCandidateIntent("As agreed, I expect the joining date to change.").accepted).toBe(false);
    });
    it("S83-B1: 'We agreed that the base would be 40L' — past reference, NOT acceptance", () => {
      expect(detectCandidateIntent("We agreed that the base would be 40L.").accepted).toBe(false);
    });
    it("S83-B1 regression: bare 'Agreed!' IS acceptance (via shortAffirmativeStart)", () => {
      expect(detectCandidateIntent("Agreed!").accepted).toBe(true);
    });
    it("S83-B1 correction: 'Agreed, but I need equity' IS acceptance (conditional)", () => {
      // bare "Agreed" at start — lookbehind passes, so acceptWords fires → accepted=true
      // hedge fires too but rejectWords should not, so accepted=true is kept
      const r = detectCandidateIntent("Agreed, but I need some equity component.");
      expect(r.accepted).toBe(true);
    });
    it("S83-B1 correction: 'Agreed, let us proceed' IS acceptance (unconditional)", () => {
      expect(detectCandidateIntent("Agreed, let us proceed.").accepted).toBe(true);
    });
    it("S83-B1: 'They agreed to raise the offer' — subject is third party, NOT acceptance", () => {
      expect(detectCandidateIntent("They agreed to raise the offer.").accepted).toBe(false);
    });
    it("S83-B1: 'You agreed the number was fair' — second-person past, NOT acceptance", () => {
      expect(detectCandidateIntent("You agreed the number was fair earlier.").accepted).toBe(false);
    });
    it("S83-B1: 'We had agreed on 40L' — past perfect, NOT acceptance", () => {
      expect(detectCandidateIntent("We had agreed on 40L in the last round.").accepted).toBe(false);
    });
    it("S83-B2: 'I agree the variable is tricky, but I need more fixed' must NOT be accepted", () => {
      expect(detectCandidateIntent("I agree the variable component is tricky, but I need more fixed.").accepted).toBe(false);
    });
    it("S83-B2: 'I agree with your reasoning but need 45L' must NOT be accepted", () => {
      expect(detectCandidateIntent("I agree with your reasoning, but I still need 45L.").accepted).toBe(false);
    });
    it("S83-B2 regression: 'I agree to the offer' IS acceptance", () => {
      expect(detectCandidateIntent("I agree to the offer.").accepted).toBe(true);
    });
    it("S83-B3: 'sounds good in theory, but the numbers don't work for me' must NOT be accepted", () => {
      expect(detectCandidateIntent("Sounds good in theory, but the numbers don't work for me.").accepted).toBe(false);
    });
    it("S83-B3 regression: 'sounds good' IS acceptance", () => {
      expect(detectCandidateIntent("Sounds good to me.").accepted).toBe(true);
    });
    it("'that works for me' is acceptance", () => {
      expect(detectCandidateIntent("that works for me").accepted).toBe(true);
    });

    // S84 (2026-07-26) — common acceptance phrases were missing from acceptWords
    it("S84: \"I'll take it\" IS acceptance", () => {
      expect(detectCandidateIntent("I'll take it.").accepted).toBe(true);
    });
    it("S84: 'I will take it' IS acceptance", () => {
      expect(detectCandidateIntent("I will take it.").accepted).toBe(true);
    });
    it("S84: \"That's acceptable to me\" IS acceptance", () => {
      expect(detectCandidateIntent("That's acceptable to me.").accepted).toBe(true);
    });
    it("S84: 'That is acceptable' IS acceptance", () => {
      expect(detectCandidateIntent("That is acceptable.").accepted).toBe(true);
    });
    it("S84: 'Count me in' IS acceptance", () => {
      expect(detectCandidateIntent("Count me in.").accepted).toBe(true);
    });
    it("S84: 'Consider it done' IS acceptance", () => {
      expect(detectCandidateIntent("Consider it done.").accepted).toBe(true);
    });
    it("S84: \"I'm happy to proceed\" IS acceptance", () => {
      expect(detectCandidateIntent("I'm happy to proceed with that offer.").accepted).toBe(true);
    });
    it("S84: \"I'm on board with that\" IS acceptance", () => {
      expect(detectCandidateIntent("I'm on board with that.").accepted).toBe(true);
    });
    it("S84 guard: \"I'm on board but need more fixed\" is NOT full accept (hedge+rejection)", () => {
      // acceptWords fires (on board), hedge fires (but), rejectWords fires (need more fixed) → hedgeIsRejection=true
      expect(detectCandidateIntent("I'm on board but need more fixed.").accepted).toBe(false);
    });
    it("S84 guard: \"I'm on board but need more money\" is NOT full accept", () => {
      expect(detectCandidateIntent("I'm on board but need more money.").accepted).toBe(false);
    });
    it("S84 guard: \"I'm happy to proceed but need higher comp\" is NOT full accept", () => {
      expect(detectCandidateIntent("I'm happy to proceed but need higher comp.").accepted).toBe(false);
    });
    it("S84 hedge: \"I'll take it if you can confirm by EOD\" is conditionalAccept", () => {
      const r = detectCandidateIntent("I'll take it if you can confirm by EOD.");
      expect(r.accepted).toBe(true);
      expect(r.conditionalAccept).toBe(true);
    });
  });

  // S86 (2026-07-26)
  describe("S86 false negatives in rejection detection", () => {
    it("S86-B1: 'I expect at least 45L' IS rejection (expect without -ing)", () => {
      expect(detectCandidateIntent("I expect at least 45L.").rejected).toBe(true);
    });
    it("S86-B1 regression: 'I am expecting at least 46 LPA' IS rejection", () => {
      expect(detectCandidateIntent("I am expecting at least 46 LPA.").rejected).toBe(true);
    });
    it("S86-B1: 'I expect a fair number' is NOT a rejection (no at-least + digit)", () => {
      expect(detectCandidateIntent("I expect a fair number.").rejected).toBe(false);
    });
    it("S86-B2: 'That does not work for me' IS rejection", () => {
      expect(detectCandidateIntent("That does not work for me.").rejected).toBe(true);
    });
    it("S86-B2: 'That does not work at all' IS rejection", () => {
      expect(detectCandidateIntent("That does not work at all.").rejected).toBe(true);
    });
    it("S86-B2: 'I need more time' is NOT rejection (non-comp need)", () => {
      expect(detectCandidateIntent("I need more time to review.").rejected).toBe(false);
    });
  });

  // S88-B1 (2026-07-26) — Hindi affirmatives missing from shortAffirmativeStart
  describe("S88-B1 Hindi affirmatives", () => {
    it("S88-B1: 'Haan.' IS accepted (bare Hindi yes)", () => {
      expect(detectCandidateIntent("Haan.").accepted).toBe(true);
    });
    it("S88-B1: 'Ji haan.' IS accepted", () => {
      expect(detectCandidateIntent("Ji haan.").accepted).toBe(true);
    });
    it("S88-B1: 'Hanji.' IS accepted", () => {
      expect(detectCandidateIntent("Hanji.").accepted).toBe(true);
    });
    it("S88-B1: 'Theek hai.' IS accepted", () => {
      expect(detectCandidateIntent("Theek hai.").accepted).toBe(true);
    });
    it("S88-B1: 'Bilkul.' IS accepted", () => {
      expect(detectCandidateIntent("Bilkul.").accepted).toBe(true);
    });
  });

  // S88-B2 (2026-07-26) — short affirmative + hedge had no conditionalAccept path
  describe("S88-B2 short affirmative + hedge = conditionalAccept", () => {
    it("S88-B2: 'Sure, if you can bump it to 38L' IS conditionalAccept", () => {
      const r = detectCandidateIntent("Sure, if you can bump it to 38L.");
      expect(r.accepted).toBe(true);
      expect(r.conditionalAccept).toBe(true);
    });
    it("S88-B2: 'Deal, though I want equity included' IS conditionalAccept", () => {
      const r = detectCandidateIntent("Deal, though I want equity included.");
      expect(r.accepted).toBe(true);
      expect(r.conditionalAccept).toBe(true);
    });
    it("S88-B2: 'Ok, provided the joining bonus stays' IS conditionalAccept", () => {
      const r = detectCandidateIntent("Ok, provided the joining bonus stays.");
      expect(r.accepted).toBe(true);
      expect(r.conditionalAccept).toBe(true);
    });
    it("S88-B2 regression: 'Fine, but I need at least 40L' is NOT accepted (hedge+reject)", () => {
      const r = detectCandidateIntent("Fine, but I need at least 40L.");
      expect(r.accepted).toBe(false);
      expect(r.rejected).toBe(true);
    });
    it("S88-B2 regression: 'Ok, but that is still too low' is NOT accepted", () => {
      const r = detectCandidateIntent("Ok, but that is still too low.");
      expect(r.accepted).toBe(false);
      expect(r.rejected).toBe(true);
    });
    // S89-B1 (2026-07-26) — word limit raised 12→18 to cover longer conditionals
    it("S89-B1: 14-word conditional 'Ok, if you can confirm by EOD and include joining bonus' IS conditionalAccept", () => {
      const r = detectCandidateIntent("Ok, if you can confirm by EOD and also include joining bonus in writing.");
      expect(r.accepted).toBe(true);
      expect(r.conditionalAccept).toBe(true);
    });
    it("S89-B1 thinkWords guard: 'Ok, I need to think about this if possible' is NOT accepted", () => {
      const r = detectCandidateIntent("Ok, I need to think about this a bit more carefully if possible.");
      expect(r.accepted).toBe(false);
      expect(r.needsTime).toBe(true);
    });
  });

  // S91-B1 (2026-07-26) — competingWords missing "another offer", "other companies" etc.
  describe("S91-B1 competingWords gaps", () => {
    it("S91-B1: 'I have another offer at 45L from Amazon' IS mentionedCompeting", () => {
      expect(detectCandidateIntent("I have another offer at 45L from Amazon.").mentionedCompeting).toBe(true);
    });
    it("S91-B1: 'I am interviewing with a few other companies' IS mentionedCompeting", () => {
      expect(detectCandidateIntent("I am interviewing with a few other companies.").mentionedCompeting).toBe(true);
    });
    it("S91-B1: 'I received an offer from Google yesterday' IS mentionedCompeting", () => {
      expect(detectCandidateIntent("I received an offer from Google yesterday.").mentionedCompeting).toBe(true);
    });
    it("S91-B1: accepted + competing together fires both flags", () => {
      const r = detectCandidateIntent("Sounds good, and I have another offer so I need to decide by Friday.");
      expect(r.accepted).toBe(true);
      expect(r.mentionedCompeting).toBe(true);
    });
    it("S91-B1 regression: 'also talking to another company' still fires", () => {
      expect(detectCandidateIntent("I am also talking to another company.").mentionedCompeting).toBe(true);
    });
  });

  // S92-B1 (2026-07-26) — thinkWords gaps: "check/consult/speak with spouse", "think this through", "time to think"
  describe("S92-B1 thinkWords gaps", () => {
    it("S92-B1: 'I need to check with my spouse' IS needsTime", () => {
      expect(detectCandidateIntent("I need to check with my spouse.").needsTime).toBe(true);
    });
    it("S92-B1: 'Let me consult with my wife about this' IS needsTime", () => {
      expect(detectCandidateIntent("Let me consult with my wife about this.").needsTime).toBe(true);
    });
    it("S92-B1: 'I need to speak with my husband first' IS needsTime", () => {
      expect(detectCandidateIntent("I need to speak with my husband first.").needsTime).toBe(true);
    });
    it("S92-B1: 'I need to think this through' IS needsTime", () => {
      expect(detectCandidateIntent("I need to think this through.").needsTime).toBe(true);
    });
    it("S92-B1: 'Can I have some time to think' IS needsTime", () => {
      expect(detectCandidateIntent("Can I have some time to think?").needsTime).toBe(true);
    });
    it("S92-B1 regression: 'talk to my family' still fires needsTime", () => {
      expect(detectCandidateIntent("I need to talk to my family.").needsTime).toBe(true);
    });
    it("S92-B1 regression: 'consider' + number is NOT needsTime (counter)", () => {
      expect(detectCandidateIntent("I can consider 38L.").needsTime).toBe(false);
    });
  });

  // S93-B1/B2 (2026-07-26) — "I am in" not in acceptWords; "let us go ahead" not matched
  describe("S93-B1 and S93-B2 acceptance gaps", () => {
    it("S93-B1: 'I am in' IS accepted", () => {
      expect(detectCandidateIntent("I am in.").accepted).toBe(true);
    });
    it("S93-B1: \"I'm in\" IS accepted", () => {
      expect(detectCandidateIntent("I'm in.").accepted).toBe(true);
    });
    it("S93-B1 guard: 'I am in a difficult position' is NOT accepted (false positive guard)", () => {
      expect(detectCandidateIntent("I am in a difficult position.").accepted).toBe(false);
    });
    it("S93-B1 guard: 'I am in the middle of reviewing' is NOT accepted", () => {
      expect(detectCandidateIntent("I am in the middle of reviewing.").accepted).toBe(false);
    });
    it("S93-B2: 'Let us go ahead with this' IS accepted", () => {
      expect(detectCandidateIntent("Let us go ahead with this.").accepted).toBe(true);
    });
    it("S93-B2 regression: 'Let's go ahead' still fires", () => {
      expect(detectCandidateIntent("Let's go ahead.").accepted).toBe(true);
    });
  });

  describe("S94-B1 walk-away in post-hedge not surfaced when accept precedes hedge", () => {
    it("'Sounds good, but actually I am walking away if you cannot match it' IS a walk", () => {
      expect(detectCandidateIntent("Sounds good, but actually I am walking away if you cannot match it.").walkAway).toBe(true);
    });
    it("'Sounds good, but actually I am walking away' is also accepted (conditional)", () => {
      expect(detectCandidateIntent("Sounds good, but actually I am walking away if you cannot match it.").accepted).toBe(true);
    });
    it("'I accept, but if this does not improve I am walking away' IS a walk", () => {
      expect(detectCandidateIntent("I accept, but if this does not improve I am walking away.").walkAway).toBe(true);
    });
    it("S94-B1 regression: 'Sounds good, but I need to think about it' is NOT a walk", () => {
      expect(detectCandidateIntent("Sounds good, but I need to think about it.").walkAway).toBe(false);
    });
    it("S94-B1 regression: 'I accept, but can we review equity?' is NOT a walk", () => {
      expect(detectCandidateIntent("I accept, but can we review equity?").walkAway).toBe(false);
    });
  });

  describe("S95-B1 bare 'works for me' missing (requires 'that' prefix currently)", () => {
    it("'Works for me, thank you' IS accepted", () => {
      expect(detectCandidateIntent("Works for me, thank you.").accepted).toBe(true);
    });
    it("'That works for me' still fires", () => {
      expect(detectCandidateIntent("That works for me.").accepted).toBe(true);
    });
  });

  describe("S95-B2 'happy to accept' missing from acceptWords", () => {
    it("'Happy to accept that' IS accepted", () => {
      expect(detectCandidateIntent("Happy to accept that.").accepted).toBe(true);
    });
    it("'I am happy to accept' IS accepted", () => {
      expect(detectCandidateIntent("I am happy to accept the offer.").accepted).toBe(true);
    });
  });

  describe("S95-B3 'not going to accept' / 'won't accept' missing from rejectWords", () => {
    it("'I am not going to accept this' IS rejected", () => {
      expect(detectCandidateIntent("I am not going to accept this.").rejected).toBe(true);
    });
    it("\"I won't accept that\" IS rejected", () => {
      expect(detectCandidateIntent("I won't accept that offer.").rejected).toBe(true);
    });
    it("'I refuse to accept at this number' IS rejected", () => {
      expect(detectCandidateIntent("I refuse to accept at this number.").rejected).toBe(true);
    });
  });

  describe("S95-B4 thinkWords missing time-period phrases", () => {
    it("'Can I have a day or two to think?' IS needsTime", () => {
      expect(detectCandidateIntent("Can I have a day or two to think?").needsTime).toBe(true);
    });
    it("'I need the weekend to decide' IS needsTime", () => {
      expect(detectCandidateIntent("I need the weekend to decide.").needsTime).toBe(true);
    });
    it("'Give me a night to think it over' IS needsTime", () => {
      expect(detectCandidateIntent("Give me a night to think it over.").needsTime).toBe(true);
    });
    it("S95-B4 regression: 'I need time to think' still fires", () => {
      expect(detectCandidateIntent("I need time to think about this.").needsTime).toBe(true);
    });
  });

  describe("S96-B1 and S96-B2 accept gaps: fully on board / fine by me", () => {
    it("'I am fully on board' IS accepted", () => {
      expect(detectCandidateIntent("I am fully on board.").accepted).toBe(true);
    });
    it("'That is fine by me' IS accepted", () => {
      expect(detectCandidateIntent("That is fine by me.").accepted).toBe(true);
    });
    it("S96-B1 regression: 'I am on board' still fires", () => {
      expect(detectCandidateIntent("I am on board.").accepted).toBe(true);
    });
  });

  describe("S96-B3 rejectWords: 'would not accept'", () => {
    it("\"I wouldn't accept anything below 40 lakhs\" IS rejected", () => {
      expect(detectCandidateIntent("I wouldn't accept anything below 40 lakhs.").rejected).toBe(true);
    });
    it("\"I would not accept that\" IS rejected", () => {
      expect(detectCandidateIntent("I would not accept that offer.").rejected).toBe(true);
    });
  });

  describe("S96-B4/B5 thinkWords: give me until / couple of days", () => {
    it("'Can you give me until tomorrow?' IS needsTime", () => {
      expect(detectCandidateIntent("Can you give me until tomorrow?").needsTime).toBe(true);
    });
    it("'I would like a couple of days before deciding' IS needsTime", () => {
      expect(detectCandidateIntent("I would like a couple of days before deciding.").needsTime).toBe(true);
    });
  });

  describe("S96-B6/B7/B8 walkAway: explore other / no longer interested / part ways", () => {
    it("'I am going to explore other opportunities' IS walkAway", () => {
      expect(detectCandidateIntent("I am going to explore other opportunities.").walkAway).toBe(true);
    });
    it("'I am no longer interested in pursuing this' IS walkAway", () => {
      expect(detectCandidateIntent("I am no longer interested in pursuing this.").walkAway).toBe(true);
    });
    it("S96-B7 guard: 'no longer interested in the variable component' is NOT walkAway", () => {
      expect(detectCandidateIntent("I am no longer interested in the variable component.").walkAway).toBe(false);
    });
    it("'I think it is best we part ways here' IS walkAway", () => {
      expect(detectCandidateIntent("I think it is best we part ways here.").walkAway).toBe(true);
    });
  });

  describe("S94-B2 deal-closing idioms missing from acceptWords", () => {
    it("'Done deal' IS accepted", () => {
      expect(detectCandidateIntent("Done deal.").accepted).toBe(true);
    });
    it("'We have a deal' IS accepted", () => {
      expect(detectCandidateIntent("We have a deal.").accepted).toBe(true);
    });
    it("'You got a deal' IS accepted", () => {
      expect(detectCandidateIntent("You got a deal.").accepted).toBe(true);
    });
    it("'You've got yourself a deal' IS accepted", () => {
      expect(detectCandidateIntent("You've got yourself a deal.").accepted).toBe(true);
    });
    it("'Let us close the deal' IS accepted", () => {
      expect(detectCandidateIntent("Let us close the deal.").accepted).toBe(true);
    });
    it("'Let's finalize this deal' IS accepted", () => {
      expect(detectCandidateIntent("Let's finalize this deal.").accepted).toBe(true);
    });
    it("'Let's seal the deal' IS accepted", () => {
      expect(detectCandidateIntent("Let's seal the deal.").accepted).toBe(true);
    });
    it("'I'm game' IS accepted", () => {
      expect(detectCandidateIntent("I'm game.").accepted).toBe(true);
    });
  });

  describe("rejection", () => {
    it("'too low' is a rejection", () => {
      const r = detectCandidateIntent("that's too low for my experience level");
      expect(r.rejected).toBe(true);
      expect(r.accepted).toBe(false);
    });

    it("'not acceptable' is a rejection", () => {
      expect(detectCandidateIntent("this offer is not acceptable").rejected).toBe(true);
    });

    it("'can't accept' is a rejection", () => {
      expect(detectCandidateIntent("I can't accept at this number").rejected).toBe(true);
    });

    it("acceptance beats raw rejection keyword absence", () => {
      const r = detectCandidateIntent("I accept, this sounds fair");
      expect(r.accepted).toBe(true);
      expect(r.rejected).toBe(false);
    });

    /* The user-reported bug — "No, I would like to stick with 26 lakhs
       per annum" was being classified as not-rejected, which let the
       AI glide into closing language. Lock this regression in. */
    it("'stick with N lakhs' is a rejection (Bug B fix)", () => {
      const r = detectCandidateIntent("No, I would like to stick with 26 lakhs per annum");
      expect(r.rejected).toBe(true);
      expect(r.accepted).toBe(false);
    });

    it("'holding at N LPA' is a rejection", () => {
      expect(detectCandidateIntent("I'm holding firm at 30 LPA").rejected).toBe(true);
    });

    it("'won't go below N' is a rejection", () => {
      expect(detectCandidateIntent("I won't go below 28 lakhs").rejected).toBe(true);
    });

    it("'staying at N LPA' is a rejection", () => {
      expect(detectCandidateIntent("I'd be staying at 32 LPA — that's my floor").rejected).toBe(true);
    });

    it("benign 'stick with the team' is NOT a rejection (no number near lock verb)", () => {
      const r = detectCandidateIntent("I'd love to stick with the team I have today");
      expect(r.rejected).toBe(false);
    });
  });

  describe("walkAway", () => {
    it("'walk away' flags walkAway", () => {
      const r = detectCandidateIntent("I need to walk away from this");
      expect(r.walkAway).toBe(true);
    });

    it("'I decline' flags walkAway", () => {
      expect(detectCandidateIntent("I decline the offer at this point").walkAway).toBe(true);
    });

    it("walkAway phrase with explicit acceptance present does NOT flag walkAway", () => {
      // Defensive: "not interested" is also a walkAway phrase, but if they
      // also said "I accept" we treat as accepted.
      const r = detectCandidateIntent("I accept the offer, I'm not interested in negotiating further");
      expect(r.accepted).toBe(true);
      expect(r.walkAway).toBe(false);
    });

    it("S77-B3: 'not interested in the variable component' must NOT set walkAway (component preference)", () => {
      const r = detectCandidateIntent("I'm not interested in the variable component, I prefer all-fixed");
      expect(r.walkAway).toBe(false);
      expect(r.rejected).toBe(false);
    });
    it("S77-B3: 'not interested in equity' must NOT set walkAway", () => {
      const r = detectCandidateIntent("I'm not interested in equity, just raise the base");
      expect(r.walkAway).toBe(false);
      expect(r.rejected).toBe(false);
    });
    it("S77-B3: 'not interested in this role' IS a walk-away (job noun)", () => {
      expect(detectCandidateIntent("I'm not interested in this role anymore.").walkAway).toBe(true);
    });
    it("S78-B1: 'Let's move on to the equity discussion' must NOT set walkAway (topic redirect)", () => {
      expect(detectCandidateIntent("Let's move on to the equity discussion.").walkAway).toBe(false);
    });
    it("S78-B1: 'Can we move on to sign-on bonus?' must NOT set walkAway (topic redirect)", () => {
      expect(detectCandidateIntent("Can we move on to sign-on bonus?").walkAway).toBe(false);
    });
    it("S78-B1: 'I'll move on if you can't improve' IS a walk-away (first-person departure)", () => {
      expect(detectCandidateIntent("I'll move on if you can't improve the offer.").walkAway).toBe(true);
    });
    it("S78-B1: 'I'd rather move on from this' IS a walk-away (first-person departure)", () => {
      expect(detectCandidateIntent("I'd rather move on from this.").walkAway).toBe(true);
    });
    it("S81-B1: 'not worth fighting over 2L — can we split it?' must NOT set walkAway (counter-propose)", () => {
      expect(detectCandidateIntent("It's not worth fighting over 2L — can we split it?").walkAway).toBe(false);
    });
    it("S81-B1: 'not worth arguing about' must NOT set walkAway (compromise invite)", () => {
      expect(detectCandidateIntent("Not worth arguing about — let's just split the difference.").walkAway).toBe(false);
    });
    it("S81-B1: 'this offer is just not worth it' IS a walk-away (S81-B1 regression)", () => {
      expect(detectCandidateIntent("This offer is just not worth it.").walkAway).toBe(true);
    });
    it("S81-B2: 'I decline to answer that question' must NOT set walkAway (info privacy)", () => {
      expect(detectCandidateIntent("I decline to answer that question.").walkAway).toBe(false);
    });
    it("S81-B2: 'I decline to reveal my current CTC' must NOT set walkAway", () => {
      expect(detectCandidateIntent("I decline to reveal my current CTC.").walkAway).toBe(false);
    });
    it("S81-B2: 'I decline this offer' IS a walk-away (S81-B2 regression)", () => {
      expect(detectCandidateIntent("I decline this offer.").walkAway).toBe(true);
    });
  });

  describe("deflection", () => {
    it("'what's your offer' flags deflected", () => {
      expect(detectCandidateIntent("what's your offer first?").deflected).toBe(true);
    });

    it("'you tell me' flags deflected", () => {
      expect(detectCandidateIntent("you tell me what you can do").deflected).toBe(true);
    });

    it("'prefer not to share' flags deflected", () => {
      expect(detectCandidateIntent("I'd prefer not to share a specific number").deflected).toBe(true);
    });
  });

  describe("needsTime", () => {
    it("'need time' flags needsTime", () => {
      expect(detectCandidateIntent("I need time to think this over").needsTime).toBe(true);
    });

    it("'talk to my family' flags needsTime", () => {
      expect(detectCandidateIntent("I'd like to talk to my family first").needsTime).toBe(true);
    });

    it("needsTime is SUPPRESSED when a concrete number is present (that's a counter)", () => {
      // "consider 30 LPA" contains "consider" (a think-word) AND a number
      // — semantically this is a counter, not a time-to-think request.
      const r = detectCandidateIntent("could you consider 30 LPA instead?");
      expect(r.needsTime).toBe(false);
    });
  });

  describe("competingOffers", () => {
    it("'other offer' flags mentionedCompeting", () => {
      // Uses "other offer" as a standalone phrase (not "another" which is
      // a separate word and does not trigger the regex — documented here
      // so a future maintainer doesn't "fix" the regex to match "another"
      // too aggressively).
      expect(detectCandidateIntent("I have an other offer on the table").mentionedCompeting).toBe(true);
      expect(detectCandidateIntent("I got an offer from Google").mentionedCompeting).toBe(true);
    });

    it("'counter-offer' flags mentionedCompeting", () => {
      expect(detectCandidateIntent("I got a counter-offer from my current employer").mentionedCompeting).toBe(true);
    });
  });
});

describe("extractCandidateSalaryNumber", () => {
  it("empty input → null", () => {
    expect(extractCandidateSalaryNumber("")).toBe(null);
    expect(extractCandidateSalaryNumber("   ")).toBe(null);
  });

  it("plain answer with no number → null", () => {
    expect(extractCandidateSalaryNumber("I need to think about it")).toBe(null);
  });

  it("single LPA number → returns it", () => {
    expect(extractCandidateSalaryNumber("I'm expecting 30 LPA")).toBe("30");
    expect(extractCandidateSalaryNumber("looking for 45 lakh")).toBe("45");
    expect(extractCandidateSalaryNumber("targeting 22.5 LPA")).toBe("22.5");
  });

  it("[fixture: Flipkart in-hand-vs-target] competing offer is NOT pulled as candidate target", () => {
    /* Flipkart UX session bug: candidate said "I have an offer of 68
       LPA in hand, my target is 70 LPA" and the AI echoed ₹68 as their
       number — anchoring the counter below the candidate's actual ask.
       Now: in-hand-offer numbers are filtered out; the latest target-
       prefixed number wins. */
    expect(
      extractCandidateSalaryNumber("I have an offer of 68 LPA in hand from another company. My target is 70 LPA."),
    ).toBe("70");
  });

  it("multiple target-prefixed numbers → latest wins (downward revision)", () => {
    /* "I want 30, actually let me say I'd like 25" used to return 30
       because the previous targetRe match was first-only. */
    expect(
      extractCandidateSalaryNumber("I want 30 LPA. Actually, let me say I'd like 25 LPA — that works for me."),
    ).toBe("25");
  });

  it("rupee symbol + LPA works", () => {
    expect(extractCandidateSalaryNumber("I want ₹35 LPA")).toBe("35");
  });

  it("target-phrase number wins over plain number list", () => {
    // Two numbers: 20 (CTC) and 35 (target with "expecting"). Should pick 35.
    expect(extractCandidateSalaryNumber("currently 20 LPA, expecting 35 LPA")).toBe("35");
  });

  it("when first number is CTC and multiple numbers exist, use the last", () => {
    // "currently at X" and Y — pick Y as the ask
    expect(extractCandidateSalaryNumber("I'm currently at 25 LPA and want 40 LPA")).toBe("40");
  });

  it("when only one LPA number exists, return it even if a CTC phrase is nearby", () => {
    expect(extractCandidateSalaryNumber("currently drawing 25 LPA")).toBe("25");
  });

  it("bare-number fallback with ask-intent word, within salary-plausible range", () => {
    // No LPA suffix, but "need 30" in context → 30
    expect(extractCandidateSalaryNumber("I need 30")).toBe("30");
    expect(extractCandidateSalaryNumber("looking for around 45")).toBe("45");
  });

  it("bare-number OUTSIDE salary-plausible range (3..200) is ignored", () => {
    // "need 500" — too high to be LPA salary, return null
    expect(extractCandidateSalaryNumber("I need 500 for my car payment")).toBe(null);
    // "need 2" — too low, return null
    expect(extractCandidateSalaryNumber("I need 2 days to decide")).toBe(null);
  });

  it("ignores unrelated numbers not near salary-asking context", () => {
    expect(extractCandidateSalaryNumber("I have 5 years of experience")).toBe(null);
  });

  it("handles multiple LPA numbers and picks the target-tagged one", () => {
    // Three numbers — pick the one with the target phrase
    const r = extractCandidateSalaryNumber("I'm at 20 LPA, friends earn 25 LPA, I'm asking for 35 LPA");
    expect(r).toBe("35");
  });
});

describe("truncateConversationHistory", () => {
  it("empty input → empty string", () => {
    expect(truncateConversationHistory("", 100)).toBe("");
  });

  it("under budget → returns unchanged", () => {
    const short = "A short history";
    expect(truncateConversationHistory(short, 100)).toBe(short);
  });

  it("over budget → truncates with a visible marker", () => {
    const long = "x".repeat(1000);
    const out = truncateConversationHistory(long, 200);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.startsWith("…[earlier turns truncated]")).toBe(true);
  });

  it("preserves the tail (most recent turns) not the head", () => {
    const history = "OLD TURN\n" + "middle ".repeat(100) + "MOST_RECENT_TURN";
    const out = truncateConversationHistory(history, 200);
    expect(out).toContain("MOST_RECENT_TURN");
    expect(out).not.toContain("OLD TURN");
  });
});

describe("detectSalaryPhase", () => {
  it("explicit phase override wins", () => {
    expect(
      detectSalaryPhase({ negotiationPhase: "benefits-discussion", questionIndex: 0 }),
    ).toBe("benefits-discussion");
  });

  it("acceptance jumps to closing regardless of index", () => {
    expect(
      detectSalaryPhase({
        questionIndex: 1,
        totalQuestions: 6,
        facts: { acceptedImmediately: true },
      }),
    ).toBe("closing");
  });

  it("walk-away language triggers closing-pressure (retention)", () => {
    expect(
      detectSalaryPhase({
        questionIndex: 2,
        answer: "I'm not interested at this number, I'll have to pass.",
      }),
    ).toBe("closing-pressure");
  });

  /* ─── Premature-close guard regression tests ─── */

  it("[fixture: TCS-style premature close] late turns without counter → probe, not closing", () => {
    /* Bug source: TCS UI/UX Designer session — recruiter wrapped up
       at idx=5/6 even though the candidate never made a counter.
       Engine now routes to probe-expectations until a number lands. */
    expect(
      detectSalaryPhase({
        questionIndex: 5,
        totalQuestions: 6,
        facts: { candidateCounter: null, hasCompetingOffers: false },
      }),
    ).toBe("probe-expectations");
  });

  it("late turns WITH counter stay in counter-offer (the earlier counter-offer rule wins)", () => {
    /* Once a counter is on the table (idx≥2), the AI keeps countering
       until the candidate accepts. Closing only fires on acceptance —
       deliberate, to prevent the "wrap up without resolution" failure. */
    expect(
      detectSalaryPhase({
        questionIndex: 5,
        totalQuestions: 6,
        facts: { candidateCounter: "₹25 LPA" },
      }),
    ).toBe("counter-offer");
  });

  it("70% progress without counter → probe-expectations", () => {
    expect(
      detectSalaryPhase({
        questionIndex: 5,
        totalQuestions: 7, // 5/7 ≈ 0.71
        facts: { candidateCounter: null },
      }),
    ).toBe("probe-expectations");
  });

  it("idx>=2 with counter → counter-offer phase", () => {
    expect(
      detectSalaryPhase({
        questionIndex: 2,
        totalQuestions: 6,
        facts: { candidateCounter: "₹30 LPA" },
      }),
    ).toBe("counter-offer");
  });

  it("competing offers without counter early → probe-expectations", () => {
    expect(
      detectSalaryPhase({
        questionIndex: 1,
        totalQuestions: 6,
        facts: { hasCompetingOffers: true, candidateCounter: null },
      }),
    ).toBe("probe-expectations");
  });

  it("idx=0 default → offer-reaction", () => {
    expect(detectSalaryPhase({ questionIndex: 0, totalQuestions: 6 })).toBe("offer-reaction");
  });

  it("end-of-session without counter does NOT close (don't fabricate a deal)", () => {
    /* Critical regression — idx=total used to flow into the index
       fallback's plain `return "closing"`. Now the
       progressRatio≥0.7 && !hasCounter branch wins first. */
    const result = detectSalaryPhase({
      questionIndex: 6,
      totalQuestions: 6,
      facts: { candidateCounter: null },
    });
    expect(result).not.toBe("closing");
    expect(result).not.toBe("closing-pressure");
  });
});

describe("pickServerCounter", () => {
  const band = { initialOffer: 20, maxStretch: 30, walkAway: 18 };

  it("counter-offer phase: splits floor and aspiration", () => {
    expect(
      pickServerCounter({
        phase: "counter-offer",
        ...band,
        highestOfferMade: 20,
        candidateTarget: 28,
      }),
    ).toBe(24); // 20 + (28-20)*0.5
  });

  it("closing-pressure pushes 70% toward aspiration", () => {
    expect(
      pickServerCounter({
        phase: "closing-pressure",
        ...band,
        highestOfferMade: 20,
        candidateTarget: 28,
      }),
    ).toBe(25.6); // 20 + (28-20)*0.7
  });

  it("caps aspiration at maxStretch when candidate target exceeds band", () => {
    expect(
      pickServerCounter({
        phase: "counter-offer",
        ...band,
        highestOfferMade: 20,
        candidateTarget: 50, // way above maxStretch 30
      }),
    ).toBe(25); // 20 + (30-20)*0.5
  });

  it("returns null for probe-expectations (no offer this turn)", () => {
    expect(
      pickServerCounter({
        phase: "probe-expectations",
        ...band,
        highestOfferMade: 20,
        candidateTarget: 28,
      }),
    ).toBeNull();
  });

  it("returns null for benefits-discussion", () => {
    expect(
      pickServerCounter({
        phase: "benefits-discussion",
        ...band,
        highestOfferMade: 20,
        candidateTarget: 28,
      }),
    ).toBeNull();
  });

  it("returns null when aspiration ≤ floor (no room to move)", () => {
    expect(
      pickServerCounter({
        phase: "counter-offer",
        ...band,
        highestOfferMade: 28,
        candidateTarget: 25, // candidate asks BELOW current offer
      }),
    ).toBeNull();
  });

  it("never goes backwards from highestOfferMade (monotonic)", () => {
    const next = pickServerCounter({
      phase: "counter-offer",
      ...band,
      highestOfferMade: 25,
      candidateTarget: 30,
    });
    expect(next).not.toBeNull();
    expect(next!).toBeGreaterThanOrEqual(25);
  });

  it("never exceeds maxStretch even at closing-pressure", () => {
    const next = pickServerCounter({
      phase: "closing-pressure",
      initialOffer: 25,
      maxStretch: 30,
      walkAway: 22,
      highestOfferMade: 28,
      candidateTarget: 100,
    });
    expect(next!).toBeLessThanOrEqual(30);
  });

  it("offer-reaction returns the initial offer", () => {
    expect(
      pickServerCounter({
        phase: "offer-reaction",
        ...band,
        candidateTarget: 28,
      }),
    ).toBe(20);
  });
});

describe("extractMirrorTokens", () => {
  it("returns [] for short answers", () => {
    expect(extractMirrorTokens("Yes")).toEqual([]);
    expect(extractMirrorTokens("ok thanks")).toEqual([]);
  });

  it("scrubs first-name-shaped tokens (single mention, always capitalized)", () => {
    const tokens = extractMirrorTokens(
      "I worked with Sarah on the migration project at our last team and we shipped it in two weeks together."
    );
    expect(tokens.map(t => t.toLowerCase())).not.toContain("sarah");
  });

  it("preserves tokens with internal capitals (PhonePe, OpenAI)", () => {
    const tokens = extractMirrorTokens(
      "I shipped a feature for PhonePe last quarter and it lifted activation across the team in two weeks."
    );
    expect(tokens.map(t => t.toLowerCase())).toContain("phonepe");
  });

  it("preserves company-suffix tokens (-ai, -labs, -tech)", () => {
    const tokens = extractMirrorTokens(
      "I built integrations for Spendly at our last team and partnered closely with Mindlabs on the rollout."
    );
    // "Mindlabs" should survive because of the -labs suffix even though it's
    // single-mention, capitalized, not in any allowlist.
    expect(tokens.map(t => t.toLowerCase())).toContain("mindlabs");
  });

  it("preserves casing in 'the X' phrases (the Migration Project)", () => {
    const tokens = extractMirrorTokens(
      "I led the Migration Project across our last team and shipped it before the holiday rush in just two weeks."
    );
    const hasTitleCasePhrase = tokens.some(t => /^the Migration/i.test(t) && t.includes("Migration"));
    expect(hasTitleCasePhrase).toBe(true);
  });

  it("keeps allowlist tech terms (Stripe) on a single mention", () => {
    const tokens = extractMirrorTokens(
      "We integrated Stripe at our last team and shipped the checkout in just two weeks across regions."
    );
    expect(tokens.map(t => t.toLowerCase())).toContain("stripe");
  });
});

describe("isBreakdownAsk", () => {
  // These are the EXACT candidate messages from Hirestepx Bugs (3).pdf
  // that the LLM deflected on instead of setting wantsBreakdown=true.
  // Every one of these MUST trigger the server-side rescue.
  it("[fixture: Bugs 3 T2] catches 'Can you just give me a breakdown on this 27 lakhs?'", () => {
    expect(isBreakdownAsk("Be with this offer. Can you just give me a breakdown on this 27 lakhs?")).toBe(true);
  });
  it("[fixture: Bugs 3 T3] catches 'All the parts, a complete breakdown of the CTC'", () => {
    expect(isBreakdownAsk("Doctor Pepper. All the parts, a complete breakdown of the CTC.")).toBe(true);
  });
  it("[fixture: Bugs 3 T4] catches 'let me know the base salary?'", () => {
    expect(isBreakdownAsk("Two Gae, you let me know the base salary?")).toBe(true);
  });
  it("[fixture: Bugs 3 T5] catches 'I want to know more about base salary.'", () => {
    expect(isBreakdownAsk("I want to know more about base salary.")).toBe(true);
  });

  it("catches single-component asks for variable/joining/PF too", () => {
    expect(isBreakdownAsk("What's the variable component?")).toBe(true);
    expect(isBreakdownAsk("How much is the joining bonus?")).toBe(true);
    expect(isBreakdownAsk("Tell me about the provident fund.")).toBe(true);
  });

  it("returns false for unrelated answers", () => {
    expect(isBreakdownAsk("Sounds good, I'll take it.")).toBe(false);
    expect(isBreakdownAsk("I'll think about it and get back to you.")).toBe(false);
    expect(isBreakdownAsk("")).toBe(false);
  });
});

describe("normalizeForDuplicate", () => {
  it("lowercases, collapses whitespace, strips terminal punctuation", () => {
    expect(normalizeForDuplicate("Hello, World!")).toBe("hello world");
    expect(normalizeForDuplicate("Hello,   world.")).toBe("hello world");
    expect(normalizeForDuplicate("HELLO — WORLD")).toBe("hello world");
  });
  it("treats nbsp like normal whitespace", () => {
    expect(normalizeForDuplicate("a\u00a0b\u00a0c")).toBe("a b c");
  });
  it("handles empty / null-ish", () => {
    expect(normalizeForDuplicate("")).toBe("");
    expect(normalizeForDuplicate("   ")).toBe("");
  });
});

describe("isDuplicateOfRecent", () => {
  const longA = "I hear you on wanting more — let me be upfront, the band for this role caps where I've already offered, and stretching further would require a different headcount slot than the one I have approval for today.";
  const longB = "Totally fair to push back. Here's where I can move: I can stretch joining bonus and notice flexibility, but the recurring base is at the top of the band I'm authorized to commit to in this round.";
  it("returns false when prev is empty / undefined", () => {
    expect(isDuplicateOfRecent(longA, [])).toBe(false);
    expect(isDuplicateOfRecent(longA, undefined)).toBe(false);
    expect(isDuplicateOfRecent(longA, null)).toBe(false);
  });
  it("returns false for short replies even if they match", () => {
    expect(isDuplicateOfRecent("Got it, thanks.", ["Got it, thanks."])).toBe(false);
  });
  it("returns true for verbatim long match", () => {
    expect(isDuplicateOfRecent(longA, [longB, longA])).toBe(true);
  });
  it("returns true for case / whitespace / punctuation differences only", () => {
    const variant = "  I HEAR you on wanting more — let me be upfront, the band  for this role caps where I've already offered, and stretching further would require a different headcount slot than the one I have approval for today!  ";
    expect(isDuplicateOfRecent(variant, [longA])).toBe(true);
  });
  it("returns false when content actually differs", () => {
    expect(isDuplicateOfRecent(longA, [longB])).toBe(false);
  });
});

describe("composeDuplicateReplyRescue", () => {
  it("forward counter when there is headroom between offer and ceiling", () => {
    // offer 24, stretch 30 → next = 24 + 0.6*6 = 27.6
    const out = composeDuplicateReplyRescue({ highestOfferMade: 24, maxStretch: 30 });
    expect(out).toContain("circles");
    expect(out).toContain("₹27.6 LPA");
    expect(out).toContain("lever");
  });
  it("clamps the forward counter at maxStretch", () => {
    // offer 29.5, stretch 30 → next would be 29.5 + 0.6*0.5 = 29.8 ≤ 30
    const out = composeDuplicateReplyRescue({ highestOfferMade: 29.5, maxStretch: 30 });
    expect(out).toMatch(/₹\d+(?:\.\d+)?\s+LPA/);
    const m = out.match(/₹(\d+(?:\.\d+)?)\s+LPA/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThanOrEqual(30);
  });
  it("calls the question when offer is already at/above ceiling", () => {
    const out = composeDuplicateReplyRescue({ highestOfferMade: 30, maxStretch: 30 });
    expect(out).not.toMatch(/₹\d/);
    expect(out).toMatch(/top of the band|pause|move you to yes/i);
  });
  it("falls back to lever-pointing prose when offer or ceiling missing", () => {
    const noOffer = composeDuplicateReplyRescue({ highestOfferMade: null, maxStretch: 30 });
    expect(noOffer).not.toMatch(/₹\d/);
    expect(noOffer).toMatch(/lever/i);
    const noStretch = composeDuplicateReplyRescue({ highestOfferMade: 24, maxStretch: null });
    expect(noStretch).not.toMatch(/₹\d/);
    expect(noStretch).toMatch(/lever/i);
  });
  it("rejects non-finite / non-positive inputs gracefully", () => {
    const out = composeDuplicateReplyRescue({ highestOfferMade: NaN, maxStretch: -5 });
    expect(out).not.toMatch(/₹/);
    expect(out).toMatch(/lever/i);
  });
});

describe("pickNextMove", () => {
  const band = { initialOffer: 20, maxStretch: 30, walkAway: 18 };

  it("acceptance → close-acceptance, recap last offer", () => {
    const m = pickNextMove({
      phase: "closing",
      ...band,
      highestOfferMade: 25,
      candidateTarget: 28,
      isAccepted: true,
    });
    expect(m.lever).toBe("close-acceptance");
    expect(m.newTotalLpa).toBe(25);
    expect(m.deltaLpa).toBe(0);
  });

  it("offer-reaction → open-with-offer at initialOffer", () => {
    const m = pickNextMove({ phase: "offer-reaction", ...band });
    expect(m.lever).toBe("open-with-offer");
    expect(m.newTotalLpa).toBe(20);
  });

  it("probe-expectations → probe lever, no money move", () => {
    const m = pickNextMove({ phase: "probe-expectations", ...band });
    expect(m.lever).toBe("probe");
    expect(m.newTotalLpa).toBeNull();
  });

  it("benefits-discussion → benefits-summary, no money move", () => {
    const m = pickNextMove({ phase: "benefits-discussion", ...band });
    expect(m.lever).toBe("benefits-summary");
    expect(m.newTotalLpa).toBeNull();
  });

  it("counter-offer with cash headroom → counter-base", () => {
    const m = pickNextMove({
      phase: "counter-offer",
      ...band,
      highestOfferMade: 20,
      candidateTarget: 28,
    });
    expect(m.lever).toBe("counter-base");
    expect(m.newTotalLpa).toBe(24);
    expect(m.deltaLpa).toBe(4);
  });

  it("counter-offer at ceiling → rotates to joining-bonus", () => {
    const m = pickNextMove({
      phase: "counter-offer",
      ...band,
      highestOfferMade: 30, // already at maxStretch
      candidateTarget: 35,
    });
    expect(m.lever).toBe("joining-bonus");
    expect(m.newTotalLpa).toBeNull();
  });

  it("joining-bonus tried → rotates to notice-buyout when no equity", () => {
    const m = pickNextMove({
      phase: "closing-pressure",
      ...band,
      highestOfferMade: 30,
      candidateTarget: 35,
      hasEquity: false,
      leversTried: ["joining-bonus"],
    });
    expect(m.lever).toBe("notice-buyout");
  });

  it("joining-bonus tried + hasEquity → rotates to equity-grant", () => {
    const m = pickNextMove({
      phase: "closing-pressure",
      ...band,
      highestOfferMade: 30,
      candidateTarget: 35,
      hasEquity: true,
      leversTried: ["joining-bonus"],
    });
    expect(m.lever).toBe("equity-grant");
  });

  it("equity-grant NOT picked when hasEquity=false even if rotation reaches it", () => {
    const m = pickNextMove({
      phase: "closing-pressure",
      ...band,
      highestOfferMade: 30,
      candidateTarget: 35,
      hasEquity: false,
      leversTried: ["joining-bonus", "notice-buyout"],
    });
    expect(m.lever).toBe("hold-firm");
    expect(m.newTotalLpa).toBe(30);
  });

  it("all levers exhausted → hold-firm with current floor", () => {
    const m = pickNextMove({
      phase: "counter-offer",
      ...band,
      highestOfferMade: 30,
      candidateTarget: 35,
      hasEquity: true,
      leversTried: ["joining-bonus", "equity-grant", "notice-buyout"],
    });
    expect(m.lever).toBe("hold-firm");
    expect(m.rationale).toMatch(/ceiling/i);
  });

  it("acceptance dominates phase — wins even if phase says counter-offer", () => {
    const m = pickNextMove({
      phase: "counter-offer",
      ...band,
      highestOfferMade: 24,
      candidateTarget: 30,
      isAccepted: true,
    });
    expect(m.lever).toBe("close-acceptance");
  });

  it("rationale references the chosen number for the LLM prompt", () => {
    const m = pickNextMove({
      phase: "counter-offer",
      ...band,
      highestOfferMade: 20,
      candidateTarget: 28,
    });
    expect(m.rationale).toMatch(/₹24/);
  });
});

describe("detectSalaryPhase (state-first regressions)", () => {
  it("candidateCounter on turn 1 → counter-offer (no more idx>=2 gate)", () => {
    // Architectural fix: phase follows candidate signal, not turn index.
    // Previously this returned offer-reaction because idx<2 blocked the
    // counter-offer branch, marching the AI through probe even though
    // the candidate had already given a number.
    expect(
      detectSalaryPhase({
        questionIndex: 1,
        totalQuestions: 6,
        facts: { candidateCounter: "₹25 LPA" },
      }),
    ).toBe("counter-offer");
  });

  it("no facts at all on turn 0 → offer-reaction (cold-start ramp)", () => {
    expect(detectSalaryPhase({ questionIndex: 0 })).toBe("offer-reaction");
  });

  it("no facts on a late turn → probe-expectations (never fabricates counter)", () => {
    // Regression: index-based fallback used to fabricate counter-offer
    // / closing-pressure at high idx with no state. Now we only ramp
    // as deep as probe — the candidate's answer to that probe creates
    // the state that drives the next phase.
    expect(detectSalaryPhase({ questionIndex: 10 })).toBe("probe-expectations");
  });

  it("topicsRaised >= 2 → benefits-discussion regardless of turn", () => {
    expect(
      detectSalaryPhase({
        questionIndex: 1,
        facts: { topicsRaised: ["esops", "joining-bonus"] },
      }),
    ).toBe("benefits-discussion");
  });
});

describe("sanitizeBehaviouralRegister", () => {
  it("rewrites the live-caught 'dive deeper' leak to clean Indian-English", () => {
    const input = "Let's dive deeper into the pilot you ran - what were the actual numbers?";
    const out = sanitizeBehaviouralRegister(input);
    expect(out).toBe("Let's go deeper into the pilot you ran - what were the actual numbers?");
    expect(/dive/i.test(out)).toBe(false);
  });

  it("covers the whole 'dive' verb-metaphor family", () => {
    expect(sanitizeBehaviouralRegister("Let's dive in.")).toBe("Let's get into it.");
    expect(sanitizeBehaviouralRegister("dive into the details")).toBe("get into the details");
    expect(sanitizeBehaviouralRegister("diving into that")).toBe("getting into that");
    expect(sanitizeBehaviouralRegister("Can we dive in here?")).toBe("Can we get started here?");
  });

  it("scrubs 'delve' and 'unpack' LLM-isms", () => {
    expect(sanitizeBehaviouralRegister("Let me delve into that")).toBe("Let me go into that");
    expect(sanitizeBehaviouralRegister("delve deeper into the result")).toBe("go deeper into the result");
    expect(sanitizeBehaviouralRegister("Let's unpack that decision")).toBe("Let's break down that decision");
  });

  it("scrubs American connective register banned at the prompt", () => {
    expect(sanitizeBehaviouralRegister("Let's circle back to that")).toBe("Let's come back to that");
    expect(sanitizeBehaviouralRegister("we can touch base later")).toBe("we can check in later");
    expect(sanitizeBehaviouralRegister("did you reach out to them?")).toBe("did you get in touch with them?");
    expect(sanitizeBehaviouralRegister("you should reach out")).toBe("you should get in touch");
    expect(sanitizeBehaviouralRegister("how did you leverage that?")).toBe("how did you use that?");
  });

  it("rewrites leverage as a VERB but preserves leverage as a NOUN", () => {
    // Verb sense → "use" (preceded by subject / "to" / modal, not a determiner)
    expect(sanitizeBehaviouralRegister("you can leverage your network")).toBe("you can use your network");
    expect(sanitizeBehaviouralRegister("to leverage that relationship")).toBe("to use that relationship");
    // Noun sense → preserved (a rewrite to "use" would mangle meaning)
    expect(sanitizeBehaviouralRegister("what leverage did you have?")).toBe("what leverage did you have?");
    expect(sanitizeBehaviouralRegister("you had no leverage there")).toBe("you had no leverage there");
    expect(sanitizeBehaviouralRegister("that gave you high leverage")).toBe("that gave you high leverage");
    expect(sanitizeBehaviouralRegister("your leverage in the negotiation")).toBe("your leverage in the negotiation");
  });

  it("preserves leading-letter capitalization of the matched phrase", () => {
    expect(sanitizeBehaviouralRegister("Delve into it")).toBe("Go into it");
    expect(sanitizeBehaviouralRegister("Reach out to HR")).toBe("Get in touch with HR");
  });

  it("leaves clean prose untouched and is idempotent", () => {
    const clean = "Can you walk me through one specific instance and what you personally did?";
    expect(sanitizeBehaviouralRegister(clean)).toBe(clean);
    const once = sanitizeBehaviouralRegister("Let's dive deeper into it");
    expect(sanitizeBehaviouralRegister(once)).toBe(once);
  });

  it("handles empty / non-string input without throwing", () => {
    expect(sanitizeBehaviouralRegister("")).toBe("");
    // @ts-expect-error — runtime guard for a non-string slipping through
    expect(sanitizeBehaviouralRegister(null)).toBe(null);
  });

  it("guarantees no banned token survives across a mixed paragraph", () => {
    const input = "Great, let's dive deeper. We can circle back and you can reach out to leverage your network.";
    const out = sanitizeBehaviouralRegister(input);
    expect(/\b(dive|delve|circle back|touch base|reach out|leverage|unpack)\b/i.test(out)).toBe(false);
  });
});

/* ── S97 (2026-07-26) — Wave 3 adversarial battery ── */
describe("S97-B1 — 'okay with this/that/it' accepted", () => {
  it("'I am okay with the revised terms.' → accepted", () => {
    // "okay with this/that/it" arm fires; "okay with the" stripped to avoid false positives
    const r = detectCandidateIntent("I am okay with it.");
    expect(r.accepted).toBe(true);
    expect(r.rejected).toBe(false);
  });
  it("'I am okay with this.' → accepted", () => {
    const r = detectCandidateIntent("I am okay with this.");
    expect(r.accepted).toBe(true);
  });
  it("'I am okay with that.' → accepted", () => {
    const r = detectCandidateIntent("I am okay with that.");
    expect(r.accepted).toBe(true);
  });
  it("'I am not okay with this number.' → rejected (not accepted)", () => {
    const r = detectCandidateIntent("I am not okay with this number.");
    expect(r.accepted).toBe(false);
    expect(r.rejected).toBe(true);
  });
  it("guard: 'That is okay with the team but I need more fixed.' → NOT accepted", () => {
    // 'okay with the team' should not fire as acceptance
    const r = detectCandidateIntent("That is okay with the team but I need more fixed.");
    expect(r.accepted).toBe(false);
  });
});

describe("S97-B2 — 'happy to take/go with the offer' accepted", () => {
  it("'Perfect, I am happy to take the offer.' → accepted", () => {
    const r = detectCandidateIntent("Perfect, I am happy to take the offer.");
    expect(r.accepted).toBe(true);
  });
  it("'Happy to go with this.' → accepted", () => {
    const r = detectCandidateIntent("Happy to go with this.");
    expect(r.accepted).toBe(true);
  });
  it("'I am happy to go with the package.' → accepted", () => {
    const r = detectCandidateIntent("I am happy to go with the package.");
    expect(r.accepted).toBe(true);
  });
});

describe("S97-B3 — 'withdrawing' gerund fires walk-away", () => {
  it("'I am withdrawing my application.' → walkAway", () => {
    const r = detectCandidateIntent("I am withdrawing my application.");
    expect(r.walkAway).toBe(true);
  });
  it("guard: 'I am withdrawing my counter offer.' → NOT walkAway (counter exclusion)", () => {
    const r = detectCandidateIntent("I am withdrawing my counter offer.");
    expect(r.walkAway).toBe(false);
  });
  it("bare 'withdraw' still fires: 'I withdraw from this process.' → walkAway", () => {
    const r = detectCandidateIntent("I withdraw from this process.");
    expect(r.walkAway).toBe(true);
  });
});

describe("S97-B4 — 'insufficient' rejected", () => {
  it("'I find this offer insufficient.' → rejected", () => {
    const r = detectCandidateIntent("I find this offer insufficient.");
    expect(r.rejected).toBe(true);
    expect(r.accepted).toBe(false);
  });
  it("'The package is insufficient.' → rejected", () => {
    const r = detectCandidateIntent("The package is insufficient.");
    expect(r.rejected).toBe(true);
  });
});

describe("S97-B5 — 'does not meet expectations' rejected", () => {
  it("'This does not meet my expectations.' → rejected", () => {
    const r = detectCandidateIntent("This does not meet my expectations.");
    expect(r.rejected).toBe(true);
    expect(r.accepted).toBe(false);
  });
  it("contraction form → rejected", () => {
    const r = detectCandidateIntent("This doesn't meet my expectations.");
    expect(r.rejected).toBe(true);
  });
});

describe("S97-B6 — 'take some time to reflect' needsTime", () => {
  it("'Let me take some time to reflect.' → needsTime", () => {
    const r = detectCandidateIntent("Let me take some time to reflect.");
    expect(r.needsTime).toBe(true);
    expect(r.accepted).toBe(false);
  });
  it("'I need to take more time to decide.' → needsTime", () => {
    const r = detectCandidateIntent("I need to take more time to decide.");
    expect(r.needsTime).toBe(true);
  });
});

describe("S97-B7 — 'review with lawyer' needsTime", () => {
  it("'I need to review this with my lawyer before deciding.' → needsTime", () => {
    const r = detectCandidateIntent("I need to review this with my lawyer before deciding.");
    expect(r.needsTime).toBe(true);
    expect(r.accepted).toBe(false);
  });
  it("'Let me consult with my advisor on this.' → needsTime", () => {
    const r = detectCandidateIntent("Let me consult with my advisor on this.");
    expect(r.needsTime).toBe(true);
  });
});

describe("S97-B8 — post-hedge 'not at this number' prevents false accept", () => {
  it("'Works for me in theory but not at this number.' → NOT accepted", () => {
    const r = detectCandidateIntent("Works for me in theory but not at this number.");
    expect(r.accepted).toBe(false);
  });
  it("'Sounds good but not at this salary.' → NOT accepted", () => {
    const r = detectCandidateIntent("Sounds good but not at this salary.");
    expect(r.accepted).toBe(false);
  });
  it("guard: 'Sounds good, I accept.' (no post-hedge rejection) → accepted", () => {
    const r = detectCandidateIntent("Sounds good, I accept.");
    expect(r.accepted).toBe(true);
  });
});

describe("S97-B9 — 'removing myself' and 'take me off list' walk-away", () => {
  it("'I am removing myself from this process.' → walkAway", () => {
    const r = detectCandidateIntent("I am removing myself from this process.");
    expect(r.walkAway).toBe(true);
  });
  it("'Please take me off your list.' → walkAway", () => {
    const r = detectCandidateIntent("Please take me off your list.");
    expect(r.walkAway).toBe(true);
  });
  it("'I will take another offer.' → walkAway", () => {
    const r = detectCandidateIntent("I will take another offer.");
    expect(r.walkAway).toBe(true);
  });
  it("'I am going to take the other offer.' → walkAway", () => {
    const r = detectCandidateIntent("I am going to take the other offer.");
    expect(r.walkAway).toBe(true);
  });

  /* ── S98-B1 — 'i will accept' accepted ── */
  describe("S98-B1 — 'i will accept' accepted", () => {
    it("'I will accept the position.' → accepted", () => {
      const r = detectCandidateIntent("I will accept the position.");
      expect(r.accepted).toBe(true);
    });
    it("'Yes, I accept the position.' → accepted", () => {
      const r = detectCandidateIntent("Yes, I accept the position.");
      expect(r.accepted).toBe(true);
    });
  });

  /* ── S98-B2 — 'willing to accept' accepted ── */
  describe("S98-B2 — 'willing to accept' accepted", () => {
    it("'I am willing to accept.' → accepted", () => {
      const r = detectCandidateIntent("I am willing to accept.");
      expect(r.accepted).toBe(true);
    });
  });

  /* ── S98-B3 — 'X is acceptable' accepted ── */
  describe("S98-B3 — 'X is acceptable' accepted", () => {
    it("'That arrangement is acceptable.' → accepted", () => {
      const r = detectCandidateIntent("That arrangement is acceptable.");
      expect(r.accepted).toBe(true);
    });
    it("'The offer is acceptable to me.' → accepted", () => {
      const r = detectCandidateIntent("The offer is acceptable to me.");
      expect(r.accepted).toBe(true);
    });
  });

  /* ── S98-B4 — 'let us proceed / happy to move forward' accepted ── */
  describe("S98-B4 — 'let us proceed / happy to move forward' accepted", () => {
    it("'Let us proceed.' → accepted", () => {
      const r = detectCandidateIntent("Let us proceed.");
      expect(r.accepted).toBe(true);
    });
    it("'Let us move forward.' → accepted", () => {
      const r = detectCandidateIntent("Let us move forward.");
      expect(r.accepted).toBe(true);
    });
    it("'Happy to move forward with this.' → accepted", () => {
      const r = detectCandidateIntent("Happy to move forward with this.");
      expect(r.accepted).toBe(true);
    });
    it("'Happy to move forward.' → accepted", () => {
      const r = detectCandidateIntent("Happy to move forward.");
      expect(r.accepted).toBe(true);
    });
  });

  /* ── S98-B5 — 'cannot accept' / 'can not accept' rejected ── */
  describe("S98-B5 — 'cannot accept' and 'can not accept' rejected", () => {
    it("'I cannot accept this offer as is.' → rejected", () => {
      const r = detectCandidateIntent("I cannot accept this offer as is.");
      expect(r.rejected).toBe(true);
    });
    it("'I can not accept this.' → rejected", () => {
      const r = detectCandidateIntent("I can not accept this.");
      expect(r.rejected).toBe(true);
    });
  });

  /* ── S98-B6 — 'below expectations' rejected ── */
  describe("S98-B6 — 'below expectations' rejected", () => {
    it("'This is below my expectations.' → rejected", () => {
      const r = detectCandidateIntent("This is below my expectations.");
      expect(r.rejected).toBe(true);
    });
    it("'The package is below expectations.' → rejected", () => {
      const r = detectCandidateIntent("The package is below expectations.");
      expect(r.rejected).toBe(true);
    });
  });

  /* ── S98-B7 — 'not competitive' rejected ── */
  describe("S98-B7 — 'not competitive' rejected", () => {
    it("'The salary is not competitive.' → rejected", () => {
      const r = detectCandidateIntent("The salary is not competitive.");
      expect(r.rejected).toBe(true);
    });
  });

  /* ── S98-B8 — 'as long as' / 'so long as' → conditionalAccept ── */
  describe("S98-B8 — 'as long as' / 'so long as' conditional accept", () => {
    it("'Yes, as long as the start date is flexible.' → conditionalAccept", () => {
      const r = detectCandidateIntent("Yes, as long as the start date is flexible.");
      expect(r.conditionalAccept).toBe(true);
    });
    it("'Sure, so long as relocation is covered.' → conditionalAccept", () => {
      const r = detectCandidateIntent("Sure, so long as relocation is covered.");
      expect(r.conditionalAccept).toBe(true);
    });
  });

  /* ── S98-B9 — 'few days' needsTime ── */
  describe("S98-B9 — 'few days' needsTime", () => {
    it("'I need a few days.' → needsTime", () => {
      const r = detectCandidateIntent("I need a few days.");
      expect(r.needsTime).toBe(true);
    });
    it("'Give me a few days to decide.' → needsTime", () => {
      const r = detectCandidateIntent("Give me a few days to decide.");
      expect(r.needsTime).toBe(true);
    });
  });

  /* ── S98-B10 — 'mull it/this/that over' needsTime ── */
  describe("S98-B10 — 'mull it/this/that over' needsTime", () => {
    it("'Let me mull it over.' → needsTime", () => {
      const r = detectCandidateIntent("Let me mull it over.");
      expect(r.needsTime).toBe(true);
    });
    it("'I need to mull this over.' → needsTime", () => {
      const r = detectCandidateIntent("I need to mull this over.");
      expect(r.needsTime).toBe(true);
    });
    it("'I need to mull that over.' → needsTime", () => {
      const r = detectCandidateIntent("I need to mull that over.");
      expect(r.needsTime).toBe(true);
    });
  });

  /* ── S98-B11 — 'until end of week/month' needsTime ── */
  describe("S98-B11 — 'until end of week/month' needsTime", () => {
    it("'Can I have until end of week?' → needsTime", () => {
      const r = detectCandidateIntent("Can I have until end of week?");
      expect(r.needsTime).toBe(true);
    });
    it("'I need until end of the month.' → needsTime", () => {
      const r = detectCandidateIntent("I need until end of the month.");
      expect(r.needsTime).toBe(true);
    });
  });

  /* ── S98-B12 — decline with adverb/modal → walkAway ── */
  describe("S98-B12 — decline with adverb/modal walkAway", () => {
    it("'I respectfully decline.' → walkAway", () => {
      const r = detectCandidateIntent("I respectfully decline.");
      expect(r.walkAway).toBe(true);
    });
    it("'I must decline this offer.' → walkAway", () => {
      const r = detectCandidateIntent("I must decline this offer.");
      expect(r.walkAway).toBe(true);
    });
    it("'I have to decline.' → walkAway", () => {
      const r = detectCandidateIntent("I have to decline.");
      expect(r.walkAway).toBe(true);
    });
    it("'I am afraid I will have to decline to share my current CTC.' → NOT walkAway (info-verb guard)", () => {
      const r = detectCandidateIntent("I am afraid I will have to decline to share my current CTC.");
      expect(r.walkAway).toBe(false);
    });
  });

  /* ── S98-B13 — 'choosing to move on' → walkAway ── */
  describe("S98-B13 — 'choosing to move on' walkAway", () => {
    it("'I am choosing to move on.' → walkAway", () => {
      const r = detectCandidateIntent("I am choosing to move on.");
      expect(r.walkAway).toBe(true);
    });
  });

  /* ── S98-B14 — 'be pursuing other opportunities' → walkAway ── */
  describe("S98-B14 — 'be pursuing other opportunities' walkAway", () => {
    it("'I will be pursuing other opportunities.' → walkAway", () => {
      const r = detectCandidateIntent("I will be pursuing other opportunities.");
      expect(r.walkAway).toBe(true);
    });
  });

  /* ── S98-B15 — 'accepted another offer / position elsewhere' → walkAway ── */
  describe("S98-B15 — 'accepted another offer / position elsewhere' walkAway", () => {
    it("'I have accepted a position elsewhere.' → walkAway", () => {
      const r = detectCandidateIntent("I have accepted a position elsewhere.");
      expect(r.walkAway).toBe(true);
    });
    it("'I have accepted another offer.' → walkAway", () => {
      const r = detectCandidateIntent("I have accepted another offer.");
      expect(r.walkAway).toBe(true);
    });
  });

  /* ── S98-B16 — 'decided to go with another company' → walkAway ── */
  describe("S98-B16 — 'decided to go with another company' walkAway", () => {
    it("'I have decided to go with another company.' → walkAway", () => {
      const r = detectCandidateIntent("I have decided to go with another company.");
      expect(r.walkAway).toBe(true);
    });
  });

  /* ── S99-B1 — 'sounds acceptable' / 'prepared/glad to accept' accepted ── */
  describe("S99-B1 — 'sounds acceptable' / 'prepared/glad to accept' accepted", () => {
    it("'That sounds acceptable.' → accepted", () => {
      const r = detectCandidateIntent("That sounds acceptable.");
      expect(r.accepted).toBe(true);
    });
    it("'I am prepared to accept.' → accepted", () => {
      const r = detectCandidateIntent("I am prepared to accept.");
      expect(r.accepted).toBe(true);
    });
    it("'I am glad to accept.' → accepted", () => {
      const r = detectCandidateIntent("I am glad to accept.");
      expect(r.accepted).toBe(true);
    });
  });

  /* ── S99-B2 — 'happy to proceed' standalone accepted ── */
  describe("S99-B2 — 'happy to proceed' standalone accepted", () => {
    it("'Happy to proceed with this offer.' → accepted", () => {
      const r = detectCandidateIntent("Happy to proceed with this offer.");
      expect(r.accepted).toBe(true);
    });
  });

  /* ── S99-B3 — 'not sufficient' / 'unacceptable' / 'not satisfied' rejected ── */
  describe("S99-B3 — 'not sufficient' / 'unacceptable' / 'not satisfied' rejected", () => {
    it("'The compensation is not sufficient.' → rejected", () => {
      const r = detectCandidateIntent("The compensation is not sufficient.");
      expect(r.rejected).toBe(true);
    });
    it("'I find this unacceptable.' → rejected", () => {
      const r = detectCandidateIntent("I find this unacceptable.");
      expect(r.rejected).toBe(true);
    });
    it("'I am not satisfied with this offer.' → rejected", () => {
      const r = detectCandidateIntent("I am not satisfied with this offer.");
      expect(r.rejected).toBe(true);
    });
  });

  /* ── S99-B4 — 'does not align with expectations' rejected ── */
  describe("S99-B4 — 'does not align with expectations' rejected", () => {
    it("'This salary does not align with my expectations.' → rejected", () => {
      const r = detectCandidateIntent("This salary does not align with my expectations.");
      expect(r.rejected).toBe(true);
    });
  });

  /* ── S99-B5 — 'N hours to decide' needsTime ── */
  describe("S99-B5 — 'N hours to decide' needsTime", () => {
    it("'I need 48 hours to decide.' → needsTime", () => {
      const r = detectCandidateIntent("I need 48 hours to decide.");
      expect(r.needsTime).toBe(true);
    });
    it("'Give me 24 hours to think.' → needsTime", () => {
      const r = detectCandidateIntent("Give me 24 hours to think.");
      expect(r.needsTime).toBe(true);
    });
  });

  /* ── S99-B6 — 'chosen to pursue other opportunities' walkAway ── */
  describe("S99-B6 — 'chosen to pursue other opportunities' walkAway", () => {
    it("'I have chosen to pursue other opportunities.' → walkAway", () => {
      const r = detectCandidateIntent("I have chosen to pursue other opportunities.");
      expect(r.walkAway).toBe(true);
    });
  });

  /* ── S99-B7 — 'no longer pursuing this role' walkAway ── */
  describe("S99-B7 — 'no longer pursuing this role' walkAway", () => {
    it("'I am no longer pursuing this role.' → walkAway", () => {
      const r = detectCandidateIntent("I am no longer pursuing this role.");
      expect(r.walkAway).toBe(true);
    });
  });

  /* ── S99-B8 — 'i will pass on this' walkAway ── */
  describe("S99-B8 — 'i will pass on this' walkAway", () => {
    it("'I think I will pass on this.' → walkAway", () => {
      const r = detectCandidateIntent("I think I will pass on this.");
      expect(r.walkAway).toBe(true);
    });
    it("'I will pass on this opportunity.' → walkAway", () => {
      const r = detectCandidateIntent("I will pass on this opportunity.");
      expect(r.walkAway).toBe(true);
    });
  });

  /* ── S99-B9 — 'i agree to review' NOT accepted (false-accept guard) ── */
  describe("S99-B9 — 'i agree to review' NOT accepted (info-verb guard)", () => {
    it("'I agree to review the offer letter.' → NOT accepted", () => {
      const r = detectCandidateIntent("I agree to review the offer letter.");
      expect(r.accepted).toBe(false);
    });
    it("'I agree to the offer.' → still accepted (noun after to)", () => {
      const r = detectCandidateIntent("I agree to the offer.");
      expect(r.accepted).toBe(true);
    });
  });

  /* ── S100-B1 — 'i'll take the offer/package' accepted (noun after take) ── */
  describe("S100-B1 — 'take the offer/package' accepted", () => {
    it("'I'll take the offer.' → accepted", () => {
      const r = detectCandidateIntent("I'll take the offer.");
      expect(r.accepted).toBe(true);
    });
    it("'I'll take the package.' → accepted", () => {
      const r = detectCandidateIntent("I'll take the package.");
      expect(r.accepted).toBe(true);
    });
    it("'I will take the position.' → accepted", () => {
      const r = detectCandidateIntent("I will take the position.");
      expect(r.accepted).toBe(true);
    });
    it("'I would take the deal.' → accepted", () => {
      const r = detectCandidateIntent("I would take the deal.");
      expect(r.accepted).toBe(true);
    });
  });

  /* ── S100-B2 — 'i'm totally on board' accepted (adverb injection) ── */
  describe("S100-B2 — 'totally/completely on board' accepted", () => {
    it("'I'm totally on board.' → accepted", () => {
      const r = detectCandidateIntent("I'm totally on board.");
      expect(r.accepted).toBe(true);
    });
    it("'I am completely on board.' → accepted", () => {
      const r = detectCandidateIntent("I am completely on board.");
      expect(r.accepted).toBe(true);
    });
    it("'I'm definitely on board.' → accepted", () => {
      const r = detectCandidateIntent("I'm definitely on board.");
      expect(r.accepted).toBe(true);
    });
  });

  /* ── S100-B3 — 'i'll happily accept' accepted (adverb before accept) ── */
  describe("S100-B3 — 'happily/gladly accept' accepted", () => {
    it("'I'll happily accept.' → accepted", () => {
      const r = detectCandidateIntent("I'll happily accept.");
      expect(r.accepted).toBe(true);
    });
    it("'I will gladly accept.' → accepted", () => {
      const r = detectCandidateIntent("I will gladly accept.");
      expect(r.accepted).toBe(true);
    });
    it("'I would willingly accept.' → accepted", () => {
      const r = detectCandidateIntent("I would willingly accept.");
      expect(r.accepted).toBe(true);
    });
  });

  /* ── S100-B4 — 'i'm very happy to proceed' accepted (adverb before happy) ── */
  describe("S100-B4 — 'very/quite happy to proceed' accepted", () => {
    it("'I'm very happy to proceed.' → accepted", () => {
      const r = detectCandidateIntent("I'm very happy to proceed.");
      expect(r.accepted).toBe(true);
    });
    it("'I am quite happy to proceed.' → accepted", () => {
      const r = detectCandidateIntent("I am quite happy to proceed.");
      expect(r.accepted).toBe(true);
    });
    it("'I'm really happy to proceed.' → accepted", () => {
      const r = detectCandidateIntent("I'm really happy to proceed.");
      expect(r.accepted).toBe(true);
    });
  });

  /* ── S100-B5 — 'doesn't work' rejected (contraction form) ── */
  describe("S100-B5 — \"doesn't work\" rejected", () => {
    it("'The package doesn\\'t work for me.' → rejected", () => {
      const r = detectCandidateIntent("The package doesn't work for me.");
      expect(r.rejected).toBe(true);
    });
    it("'This offer doesn\\'t work.' → rejected", () => {
      const r = detectCandidateIntent("This offer doesn't work.");
      expect(r.rejected).toBe(true);
    });
  });

  /* ── S100-B6 — "isn't competitive/sufficient" rejected (contraction) ── */
  describe("S100-B6 — \"isn't competitive/sufficient\" rejected", () => {
    it("'The offer isn\\'t competitive.' → rejected", () => {
      const r = detectCandidateIntent("The offer isn't competitive.");
      expect(r.rejected).toBe(true);
    });
    it("'This package isn\\'t sufficient.' → rejected", () => {
      const r = detectCandidateIntent("This package isn't sufficient.");
      expect(r.rejected).toBe(true);
    });
    it("'The salary isn\\'t acceptable.' → rejected", () => {
      const r = detectCandidateIntent("The salary isn't acceptable.");
      expect(r.rejected).toBe(true);
    });
  });

  /* ── S100-B7 — 'i'm going to pass' walkAway ── */
  describe("S100-B7 — \"i'm going to pass\" walkAway", () => {
    it("'I\\'m going to pass on this offer.' → walkAway", () => {
      const r = detectCandidateIntent("I'm going to pass on this offer.");
      expect(r.walkAway).toBe(true);
    });
    it("'I\\'m going to pass.' → walkAway", () => {
      const r = detectCandidateIntent("I'm going to pass.");
      expect(r.walkAway).toBe(true);
    });
  });

  /* ── S100-B8 — 'i'll be moving on' walkAway (gerund form) ── */
  describe("S100-B8 — \"be moving on\" walkAway", () => {
    it("'I\\'ll be moving on.' → walkAway", () => {
      const r = detectCandidateIntent("I'll be moving on.");
      expect(r.walkAway).toBe(true);
    });
    it("'I will be moving on from this.' → walkAway", () => {
      const r = detectCandidateIntent("I will be moving on from this.");
      expect(r.walkAway).toBe(true);
    });
  });

  /* ── S100-B9 — 'chosen to accept another offer' walkAway ── */
  describe("S100-B9 — \"chosen/decided to accept another offer\" walkAway", () => {
    it("'I\\'ve chosen to accept another offer.' → walkAway", () => {
      const r = detectCandidateIntent("I've chosen to accept another offer.");
      expect(r.walkAway).toBe(true);
    });
    it("'I have decided to accept another position.' → walkAway", () => {
      const r = detectCandidateIntent("I have decided to accept another position.");
      expect(r.walkAway).toBe(true);
    });
  });

  /* ── S101-B1 — 'i'd love to accept' accepted ── */
  describe("S101-B1 — \"i'd love to accept\" accepted", () => {
    it("'I\\'d love to accept.' → accepted", () => {
      const r = detectCandidateIntent("I'd love to accept.");
      expect(r.accepted).toBe(true);
    });
    it("'I would love to accept this offer.' → accepted", () => {
      const r = detectCandidateIntent("I would love to accept this offer.");
      expect(r.accepted).toBe(true);
    });
  });

  /* ── S101-B2 — 'i wholeheartedly accept' accepted ── */
  describe("S101-B2 — \"i wholeheartedly accept\" accepted", () => {
    it("'I wholeheartedly accept.' → accepted", () => {
      const r = detectCandidateIntent("I wholeheartedly accept.");
      expect(r.accepted).toBe(true);
    });
    it("'I enthusiastically accept the offer.' → accepted", () => {
      const r = detectCandidateIntent("I enthusiastically accept the offer.");
      expect(r.accepted).toBe(true);
    });
  });

  /* ── S101-B3 — 'that's a deal' accepted ── */
  describe("S101-B3 — \"that's a deal\" accepted", () => {
    it("'That\\'s a deal.' → accepted", () => {
      const r = detectCandidateIntent("That's a deal.");
      expect(r.accepted).toBe(true);
    });
    it("'That\\'s a deal then.' → accepted", () => {
      const r = detectCandidateIntent("That's a deal then.");
      expect(r.accepted).toBe(true);
    });
    it("'This is a deal.' → accepted", () => {
      const r = detectCandidateIntent("This is a deal.");
      expect(r.accepted).toBe(true);
    });
  });

  /* ── S101-B4 — 'way below market rate' rejected ── */
  describe("S101-B4 — \"way below\" rejected", () => {
    it("'This is way below market rate.' → rejected", () => {
      const r = detectCandidateIntent("This is way below market rate.");
      expect(r.rejected).toBe(true);
    });
    it("'The offer is way below my expectations.' → rejected", () => {
      const r = detectCandidateIntent("The offer is way below my expectations.");
      expect(r.rejected).toBe(true);
    });
  });

  /* ── S101-B5 — 'need significantly more' rejected ── */
  describe("S101-B5 — \"need significantly more\" rejected", () => {
    it("'I need significantly more than that.' → rejected", () => {
      const r = detectCandidateIntent("I need significantly more than that.");
      expect(r.rejected).toBe(true);
    });
    it("'I need considerably more to make this work.' → rejected", () => {
      const r = detectCandidateIntent("I need considerably more to make this work.");
      expect(r.rejected).toBe(true);
    });
  });

  /* ── S101-B6 — 'not up to expectations' rejected ── */
  describe("S101-B6 — \"not up to expectations\" rejected", () => {
    it("'The offer is not up to my expectations.' → rejected", () => {
      const r = detectCandidateIntent("The offer is not up to my expectations.");
      expect(r.rejected).toBe(true);
    });
    it("'This is not up to expectations.' → rejected", () => {
      const r = detectCandidateIntent("This is not up to expectations.");
      expect(r.rejected).toBe(true);
    });
  });

  /* ── S101-B7 — 'stepping back from this' walkAway ── */
  describe("S101-B7 — \"stepping back from this\" walkAway", () => {
    it("'I\\'m stepping back from this negotiation.' → walkAway", () => {
      const r = detectCandidateIntent("I'm stepping back from this negotiation.");
      expect(r.walkAway).toBe(true);
    });
    it("'I am stepping back from the process.' → walkAway", () => {
      const r = detectCandidateIntent("I am stepping back from the process.");
      expect(r.walkAway).toBe(true);
    });
  });

  /* ── S101-B8 — 'prefer to explore other avenues' walkAway ── */
  describe("S101-B8 — \"prefer to explore other avenues\" walkAway", () => {
    it("'I prefer to explore other avenues.' → walkAway", () => {
      const r = detectCandidateIntent("I prefer to explore other avenues.");
      expect(r.walkAway).toBe(true);
    });
    it("'I prefer to consider other alternatives.' → walkAway", () => {
      const r = detectCandidateIntent("I prefer to consider other alternatives.");
      expect(r.walkAway).toBe(true);
    });
  });

  /* ── S101-B9 — 'opting out of this process' walkAway ── */
  describe("S101-B9 — \"opting out\" walkAway", () => {
    it("'I am opting out of this process.' → walkAway", () => {
      const r = detectCandidateIntent("I am opting out of this process.");
      expect(r.walkAway).toBe(true);
    });
    it("'I\\'m opting out of the negotiation.' → walkAway", () => {
      const r = detectCandidateIntent("I'm opting out of the negotiation.");
      expect(r.walkAway).toBe(true);
    });
  });

  /* ── S101-B10 — 'a bit low' / 'slightly low' rejected ── */
  describe("S101-B10 — \"a bit low\" rejected", () => {
    it("'The offer is a bit low.' → rejected", () => {
      const r = detectCandidateIntent("The offer is a bit low.");
      expect(r.rejected).toBe(true);
    });
    it("'The salary is slightly low for this role.' → rejected", () => {
      const r = detectCandidateIntent("The salary is slightly low for this role.");
      expect(r.rejected).toBe(true);
    });
  });

  /* ── S102-B1 — 'fine with that' accepted ── */
  describe("S102-B1 — \"fine with that\" accepted", () => {
    it("'I'm fine with that.' → accepted", () => {
      const r = detectCandidateIntent("I'm fine with that.");
      expect(r.accepted).toBe(true);
    });
    it("'I am perfectly fine with this offer.' → accepted", () => {
      const r = detectCandidateIntent("I am perfectly fine with this offer.");
      expect(r.accepted).toBe(true);
    });
  });

  /* ── S102-B2 — 'I'll go for it' accepted ── */
  describe("S102-B2 — \"I'll go for it\" accepted", () => {
    it("'I'll go for it.' → accepted", () => {
      const r = detectCandidateIntent("I'll go for it.");
      expect(r.accepted).toBe(true);
    });
    it("'I would go for it without hesitation.' → accepted", () => {
      const r = detectCandidateIntent("I would go for it without hesitation.");
      expect(r.accepted).toBe(true);
    });
  });

  /* ── S102-B3 — 'does not meet requirements' rejected ── */
  describe("S102-B3 — \"does not meet requirements\" rejected", () => {
    it("'This does not meet my requirements.' → rejected", () => {
      const r = detectCandidateIntent("This does not meet my requirements.");
      expect(r.rejected).toBe(true);
    });
    it("'The offer doesn't meet my needs.' → rejected", () => {
      const r = detectCandidateIntent("The offer doesn't meet my needs.");
      expect(r.rejected).toBe(true);
    });
  });

  /* ── S102-B4 — 'falls short' rejected ── */
  describe("S102-B4 — \"falls short\" rejected", () => {
    it("'This falls short of my expectations.' → rejected", () => {
      const r = detectCandidateIntent("This falls short of my expectations.");
      expect(r.rejected).toBe(true);
    });
    it("'The package falls short of my standards.' → rejected", () => {
      const r = detectCandidateIntent("The package falls short of my standards.");
      expect(r.rejected).toBe(true);
    });
  });

  /* ── S102-B5 — 'need higher number' rejected ── */
  describe("S102-B5 — \"need higher number\" rejected", () => {
    it("'I need a higher number.' → rejected", () => {
      const r = detectCandidateIntent("I need a higher number.");
      expect(r.rejected).toBe(true);
    });
    it("'I need a better salary.' → rejected", () => {
      const r = detectCandidateIntent("I need a better salary.");
      expect(r.rejected).toBe(true);
    });
  });

  /* ── S102-B6 — 'I'll be passing on this' walkAway ── */
  describe("S102-B6 — \"I'll be passing on this\" walkAway", () => {
    it("'I'll be passing on this offer.' → walkAway", () => {
      const r = detectCandidateIntent("I'll be passing on this offer.");
      expect(r.walkAway).toBe(true);
    });
    it("'I will be passing on this opportunity.' → walkAway", () => {
      const r = detectCandidateIntent("I will be passing on this opportunity.");
      expect(r.walkAway).toBe(true);
    });
  });

  /* ── S103-B1 — 'That's acceptable' accepted ── */
  describe("S103-B1 — \"That's acceptable\" accepted", () => {
    it("'That\\'s acceptable.' → accepted", () => {
      expect(detectCandidateIntent("That's acceptable.").accepted).toBe(true);
    });
    it("'The offer is acceptable to me.' → accepted", () => {
      expect(detectCandidateIntent("The offer is acceptable to me.").accepted).toBe(true);
    });
  });

  /* ── S103-B2 — 'willing/prepared/glad to accept' accepted ── */
  describe("S103-B2 — willing/prepared/glad to accept", () => {
    it("'I\\'m willing to accept.' → accepted", () => {
      expect(detectCandidateIntent("I'm willing to accept.").accepted).toBe(true);
    });
    it("'I\\'m prepared to accept.' → accepted", () => {
      expect(detectCandidateIntent("I'm prepared to accept.").accepted).toBe(true);
    });
    it("'I\\'m glad to accept.' → accepted", () => {
      expect(detectCandidateIntent("I'm glad to accept.").accepted).toBe(true);
    });
    it("'I\\'d love to accept.' → accepted", () => {
      expect(detectCandidateIntent("I'd love to accept.").accepted).toBe(true);
    });
  });

  /* ── S103-B3 — 'not competitive / not satisfied / doesn't align' rejected ── */
  describe("S103-B3 — not competitive / not satisfied / doesn't align rejected", () => {
    it("'That\\'s not competitive.' → rejected", () => {
      expect(detectCandidateIntent("That's not competitive.").rejected).toBe(true);
    });
    it("'The offer isn\\'t competitive.' → rejected", () => {
      expect(detectCandidateIntent("The offer isn't competitive.").rejected).toBe(true);
    });
    it("'I\\'m not satisfied with this.' → rejected", () => {
      expect(detectCandidateIntent("I'm not satisfied with this.").rejected).toBe(true);
    });
    it("'This doesn\\'t align with my expectations.' → rejected", () => {
      expect(detectCandidateIntent("This doesn't align with my expectations.").rejected).toBe(true);
    });
  });

  /* ── S103-B4 — 'decided to pursue other' / 'removing myself from consideration' walkAway ── */
  describe("S103-B4 — decided to pursue other / removing from consideration walkAway", () => {
    it("'I\\'ve decided to pursue other opportunities.' → walkAway", () => {
      expect(detectCandidateIntent("I've decided to pursue other opportunities.").walkAway).toBe(true);
    });
    it("'I\\'ll be moving on from this process.' → walkAway", () => {
      expect(detectCandidateIntent("I'll be moving on from this process.").walkAway).toBe(true);
    });
    it("'Thanks but no thanks.' → walkAway", () => {
      expect(detectCandidateIntent("Thanks but no thanks.").walkAway).toBe(true);
    });
    it("'I am removing myself from consideration.' → walkAway", () => {
      expect(detectCandidateIntent("I am removing myself from consideration.").walkAway).toBe(true);
    });
  });

  /* ── S103-B5 — 'have until Friday' / 'like some time to review' needsTime ── */
  describe("S103-B5 — have until / like some time to review needsTime", () => {
    it("'Could I have until Friday to decide?' → needsTime", () => {
      expect(detectCandidateIntent("Could I have until Friday to decide?").needsTime).toBe(true);
    });
    it("'I\\'d like some time to review the terms.' → needsTime", () => {
      expect(detectCandidateIntent("I'd like some time to review the terms.").needsTime).toBe(true);
    });
  });

  /* ── S105-B4d — 'formally decline' walkAway ── */
  describe("S105-B4d — \"formally decline\" walkAway", () => {
    it("'I formally decline.' → walkAway", () => {
      expect(detectCandidateIntent("I formally decline.").walkAway).toBe(true);
    });
    it("'I formally decline the offer.' → walkAway", () => {
      expect(detectCandidateIntent("I formally decline the offer.").walkAway).toBe(true);
    });
  });

  /* ── S105-B5a — 'consult my family' needsTime (no with) ── */
  describe("S105-B5a — \"consult my family\" needsTime without 'with'", () => {
    it("'I\\'d like to consult my family.' → needsTime", () => {
      expect(detectCandidateIntent("I'd like to consult my family.").needsTime).toBe(true);
    });
    it("'I want to consult my spouse before deciding.' → needsTime", () => {
      expect(detectCandidateIntent("I want to consult my spouse before deciding.").needsTime).toBe(true);
    });
  });

  /* ── S106-safe-A — 'I agree on the variable but not on base' should not be accepted ── */
  describe("S106-safe-A — partial agreement should not fire accepted", () => {
    it("'I agree on the variable portion but not on the fixed base.' → not accepted", () => {
      expect(detectCandidateIntent("I agree on the variable portion but not on the fixed base.").accepted).toBe(false);
    });
    it("'I agree with your rationale but the number is still low.' → not accepted", () => {
      expect(detectCandidateIntent("I agree with your rationale but the number is still low.").accepted).toBe(false);
    });
  });

  /* ── S106-B2b — 'chosen to go with another company' walkAway ── */
  describe("S106-B2b — \"chosen to go with another company\" walkAway", () => {
    it("'I\\'ve chosen to go with another company.' → walkAway", () => {
      expect(detectCandidateIntent("I've chosen to go with another company.").walkAway).toBe(true);
    });
    it("'I\\'ve decided to go with a different offer.' → walkAway", () => {
      expect(detectCandidateIntent("I've decided to go with a different offer.").walkAway).toBe(true);
    });
  });

  /* ── S106-B3a — 'need some more time to evaluate' needsTime ── */
  describe("S106-B3a — \"need some more time to evaluate\" needsTime", () => {
    it("'I need some more time to evaluate this.' → needsTime", () => {
      expect(detectCandidateIntent("I need some more time to evaluate this.").needsTime).toBe(true);
    });
    it("'I need more time to think.' → needsTime", () => {
      expect(detectCandidateIntent("I need more time to think.").needsTime).toBe(true);
    });
  });

  /* ── S106-B4 — Hindi/Hinglish walk-away arms ── */
  describe("S106-B4 — Hindi/Hinglish walk-away", () => {
    it("'join nahi karunga' → walkAway", () => {
      expect(detectCandidateIntent("join nahi karunga").walkAway).toBe(true);
    });
    it("'mujhe nahi chahiye yeh offer' → walkAway", () => {
      expect(detectCandidateIntent("mujhe nahi chahiye yeh offer").walkAway).toBe(true);
    });
    it("'nahi chahiye' → walkAway", () => {
      expect(detectCandidateIntent("nahi chahiye").walkAway).toBe(true);
    });
  });

  /* ── S107-B2c — 'align with industry standards' rejected ── */
  describe("S107-B2c — \"align with industry standards\" rejected", () => {
    it("'The compensation doesn\\'t align with industry standards.' → rejected", () => {
      expect(detectCandidateIntent("The compensation doesn't align with industry standards.").rejected).toBe(true);
    });
    it("'This doesn\\'t align with market standards.' → rejected", () => {
      expect(detectCandidateIntent("This doesn't align with market standards.").rejected).toBe(true);
    });
  });

  /* ── S107-B3a — 'going to have to move on' walkAway ── */
  describe("S107-B3a — \"going to have to move on\" walkAway", () => {
    it("'I\\'m going to have to move on.' → walkAway", () => {
      expect(detectCandidateIntent("I'm going to have to move on.").walkAway).toBe(true);
    });
    it("'I\\'ll have to move on from this.' → walkAway", () => {
      expect(detectCandidateIntent("I'll have to move on from this.").walkAway).toBe(true);
    });
  });

  /* ── S107-B3b — 'step back from this' (non-progressive form) walkAway ── */
  describe("S107-B3b — \"step back from this\" walkAway (non-progressive)", () => {
    it("'I\\'ve decided to step back from this process.' → walkAway", () => {
      expect(detectCandidateIntent("I've decided to step back from this process.").walkAway).toBe(true);
    });
    it("'I need to step back from this.' → walkAway", () => {
      expect(detectCandidateIntent("I need to step back from this.").walkAway).toBe(true);
    });
  });

  /* ── S108-B2c — 'much lower than my target' rejected ── */
  describe("S108-B2c — \"much lower than target\" rejected", () => {
    it("'This is much lower than my target.' → rejected", () => {
      expect(detectCandidateIntent("This is much lower than my target.").rejected).toBe(true);
    });
    it("'This is significantly lower than my expectations.' → rejected", () => {
      expect(detectCandidateIntent("This is significantly lower than my expectations.").rejected).toBe(true);
    });
  });

  /* ── S108-B4b — 'discuss this with my spouse' needsTime ── */
  describe("S108-B4b — \"discuss this with\" needsTime (pronoun before with)", () => {
    it("'I need to discuss this with my spouse.' → needsTime", () => {
      expect(detectCandidateIntent("I need to discuss this with my spouse.").needsTime).toBe(true);
    });
    it("'Let me discuss it with my family.' → needsTime", () => {
      expect(detectCandidateIntent("Let me discuss it with my family.").needsTime).toBe(true);
    });
  });

  /* ── S108-safe-B — 'withdrawing my previous comment' should NOT be walkAway ── */
  describe("S108-safe-B — withdraw suppression handles adjective before noun", () => {
    it("'I\\'m withdrawing my previous comment about equity.' → NOT walkAway", () => {
      expect(detectCandidateIntent("I'm withdrawing my previous comment about equity.").walkAway).toBe(false);
    });
    it("'I\\'m withdrawing my earlier feedback.' → NOT walkAway", () => {
      expect(detectCandidateIntent("I'm withdrawing my earlier feedback.").walkAway).toBe(false);
    });
  });

  /* ── S109-B2a — 'won't work for me' rejected ── */
  describe("S109-B2a — \"won't work for me\" rejected", () => {
    it("'I\\'m afraid this won\\'t work for me.' → rejected", () => {
      expect(detectCandidateIntent("I'm afraid this won't work for me.").rejected).toBe(true);
    });
    it("'This offer won\\'t work for me.' → rejected", () => {
      expect(detectCandidateIntent("This offer won't work for me.").rejected).toBe(true);
    });
  });

  /* ── S109-B2b — 'not satisfactory' rejected ── */
  describe("S109-B2b — \"not satisfactory\" rejected", () => {
    it("'The package is not satisfactory.' → rejected", () => {
      expect(detectCandidateIntent("The package is not satisfactory.").rejected).toBe(true);
    });
    it("'This isn\\'t satisfactory for my level.' → rejected", () => {
      expect(detectCandidateIntent("This isn't satisfactory for my level.").rejected).toBe(true);
    });
  });

  /* ── S109-B2c — 'was expecting more' rejected ── */
  describe("S109-B2c — \"was expecting more\" rejected", () => {
    it("'I was expecting more.' → rejected", () => {
      expect(detectCandidateIntent("I was expecting more.").rejected).toBe(true);
    });
    it("'I expected much more for this role.' → rejected", () => {
      expect(detectCandidateIntent("I expected much more for this role.").rejected).toBe(true);
    });
  });

  /* ── S109-B3a — 'taking another offer' walkAway (gerund form) ── */
  describe("S109-B3a — \"taking another offer\" walkAway (gerund)", () => {
    it("'I\\'m taking another offer.' → walkAway", () => {
      expect(detectCandidateIntent("I'm taking another offer.").walkAway).toBe(true);
    });
    it("'I\\'m taking the other offer on the table.' → walkAway", () => {
      expect(detectCandidateIntent("I'm taking the other offer on the table.").walkAway).toBe(true);
    });
  });

  /* ── S109-B4b — 'let me review the offer letter' needsTime ── */
  describe("S109-B4b — \"let me review the offer letter\" needsTime", () => {
    it("'Let me review the offer letter first.' → needsTime", () => {
      expect(detectCandidateIntent("Let me review the offer letter first.").needsTime).toBe(true);
    });
    it("'Let me review the contract terms.' → needsTime", () => {
      expect(detectCandidateIntent("Let me review the contract terms.").needsTime).toBe(true);
    });
  });

  /* ── S110-B2b — 'below market rate' rejected ── */
  describe("S110-B2b — \"below market rate\" rejected", () => {
    it("'The CTC is below market rate.' → rejected", () => {
      expect(detectCandidateIntent("The CTC is below market rate.").rejected).toBe(true);
    });
    it("'This is below industry standard.' → rejected", () => {
      expect(detectCandidateIntent("This is below industry standard.").rejected).toBe(true);
    });
  });

  /* ── S110-B3a — 'taking another opportunity' walkAway (extended noun group) ── */
  describe("S110-B3a — \"taking another opportunity\" walkAway", () => {
    it("'I\\'ll be taking another opportunity.' → walkAway", () => {
      expect(detectCandidateIntent("I'll be taking another opportunity.").walkAway).toBe(true);
    });
    it("'I\\'m taking another position.' → walkAway", () => {
      expect(detectCandidateIntent("I'm taking another position.").walkAway).toBe(true);
    });
  });

  /* ── S110-B3b — 'made my decision to move on' walkAway ── */
  describe("S110-B3b — \"made my decision to move on\" walkAway", () => {
    it("'I\\'ve made my decision to move on.' → walkAway", () => {
      expect(detectCandidateIntent("I've made my decision to move on.").walkAway).toBe(true);
    });
    it("'I\\'ve made a decision to pursue other options.' → walkAway", () => {
      expect(detectCandidateIntent("I've made a decision to pursue other options.").walkAway).toBe(true);
    });
  });

  /* ── S110-B4a — 'consult my CA' needsTime (without with) ── */
  describe("S110-B4a — \"consult my CA\" needsTime", () => {
    it("'I\\'d like to consult my CA before deciding.' → needsTime", () => {
      expect(detectCandidateIntent("I'd like to consult my CA before deciding.").needsTime).toBe(true);
    });
    it("'I want to consult my accountant first.' → needsTime", () => {
      expect(detectCandidateIntent("I want to consult my accountant first.").needsTime).toBe(true);
    });
  });

  /* ── S111-B2a — 'inadequate' rejected ── */
  describe("S111-B2a — \"inadequate\" rejected", () => {
    it("'I find the compensation inadequate.' → rejected", () => {
      expect(detectCandidateIntent("I find the compensation inadequate.").rejected).toBe(true);
    });
  });

  /* ── S111-B2b — 'not what I was hoping for' rejected ── */
  describe("S111-B2b — \"not what I was hoping for\" rejected", () => {
    it("'It\\'s not what I was hoping for.' → rejected", () => {
      expect(detectCandidateIntent("It's not what I was hoping for.").rejected).toBe(true);
    });
  });

  /* ── S111-B2c — 'cannot justify leaving' rejected ── */
  describe("S111-B2c — \"cannot justify leaving\" rejected", () => {
    it("'I cannot justify leaving my current role for this number.' → rejected", () => {
      expect(detectCandidateIntent("I cannot justify leaving my current role for this number.").rejected).toBe(true);
    });
    it("'I can\\'t justify accepting this.' → rejected", () => {
      expect(detectCandidateIntent("I can't justify accepting this.").rejected).toBe(true);
    });
  });

  /* ── S112-B2a — 'way off from my expectations' rejected ── */
  describe("S112-B2a — \"way off from expectations\" rejected", () => {
    it("'This is way off from my expectations.' → rejected", () => {
      expect(detectCandidateIntent("This is way off from my expectations.").rejected).toBe(true);
    });
    it("'The offer is way off from my target.' → rejected", () => {
      expect(detectCandidateIntent("The offer is way off from my target.").rejected).toBe(true);
    });
  });

  /* ── S113-B1 — 'sounds great to me' accepted ── */
  describe("S113-B1 — \"sounds great\" accepted", () => {
    it("'Sounds great to me.' → accepted", () => {
      expect(detectCandidateIntent("Sounds great to me.").accepted).toBe(true);
    });
    it("'Sounds great!' → accepted", () => {
      expect(detectCandidateIntent("Sounds great!").accepted).toBe(true);
    });
  });

  /* ── S113-B2 — 'fair enough' accepted ── */
  describe("S113-B2 — \"fair enough\" accepted", () => {
    it("'That\\'s fair enough.' → accepted", () => {
      expect(detectCandidateIntent("That's fair enough.").accepted).toBe(true);
    });
    it("'Fair enough for me.' → accepted", () => {
      expect(detectCandidateIntent("Fair enough for me.").accepted).toBe(true);
    });
  });

  /* ── S113-B3 — 'let's make this happen' accepted ── */
  describe("S113-B3 — \"let's make this happen\" accepted", () => {
    it("'Let\\'s make this happen.' → accepted", () => {
      expect(detectCandidateIntent("Let's make this happen.").accepted).toBe(true);
    });
  });

  /* ── S113-B4 — 'I can live with that' accepted ── */
  describe("S113-B4 — \"I can live with that\" accepted", () => {
    it("'I can live with that.' → accepted", () => {
      expect(detectCandidateIntent("I can live with that.").accepted).toBe(true);
    });
    it("'I can live with this.' → accepted", () => {
      expect(detectCandidateIntent("I can live with this.").accepted).toBe(true);
    });
  });

  /* ── S113-B5 — 'not in the ballpark' rejected ── */
  describe("S113-B5 — \"not in the ballpark\" rejected", () => {
    it("'That\\'s not in the ballpark.' → rejected", () => {
      expect(detectCandidateIntent("That's not in the ballpark.").rejected).toBe(true);
    });
    it("'This offer is not in the ballpark for me.' → rejected", () => {
      expect(detectCandidateIntent("This offer is not in the ballpark for me.").rejected).toBe(true);
    });
  });

  /* ── S113-B6 — 'I am worth more than that' rejected ── */
  describe("S113-B6 — \"I'm worth more than\" rejected", () => {
    it("'I\\'m worth more than that.' → rejected", () => {
      expect(detectCandidateIntent("I'm worth more than that.").rejected).toBe(true);
    });
  });

  /* ── S113-B8 — 'doesn't reflect my market value' rejected ── */
  describe("S113-B8 — \"doesn't reflect my market value\" rejected", () => {
    it("'This doesn\\'t reflect my market value.' → rejected", () => {
      expect(detectCandidateIntent("This doesn't reflect my market value.").rejected).toBe(true);
    });
  });

  /* ── S113-B9 — 'expected a higher number' rejected ── */
  describe("S113-B9 — \"expected a higher number\" rejected", () => {
    it("'I expected a higher number.' → rejected", () => {
      expect(detectCandidateIntent("I expected a higher number.").rejected).toBe(true);
    });
    it("'I expected a higher salary offer.' → rejected", () => {
      expect(detectCandidateIntent("I expected a higher salary offer.").rejected).toBe(true);
    });
  });

  /* ── S113-B10 — 'significant pay cut' rejected ── */
  describe("S113-B10 — \"pay cut\" rejected", () => {
    it("'This is a significant pay cut for me.' → rejected", () => {
      expect(detectCandidateIntent("This is a significant pay cut for me.").rejected).toBe(true);
    });
    it("'This represents a pay cut.' → rejected", () => {
      expect(detectCandidateIntent("This represents a pay cut.").rejected).toBe(true);
    });
  });

  /* ── S113-B11 — 'leaving money on the table' rejected ── */
  describe("S113-B11 — \"leaving money on the table\" rejected", () => {
    it("'I\\'d be leaving money on the table.' → rejected", () => {
      expect(detectCandidateIntent("I'd be leaving money on the table.").rejected).toBe(true);
    });
  });

  /* ── S113-B13 — 'reached an impasse' walkAway ── */
  describe("S113-B13 — \"impasse\" walkAway", () => {
    it("'I think we\\'ve reached an impasse.' → walkAway", () => {
      expect(detectCandidateIntent("I think we've reached an impasse.").walkAway).toBe(true);
    });
    it("'We are at an impasse.' → walkAway", () => {
      expect(detectCandidateIntent("We are at an impasse.").walkAway).toBe(true);
    });
  });

  /* ── S113-B14 — 'don't think this is going to work out' walkAway ── */
  describe("S113-B14 — \"don't think this is going to work out\" walkAway", () => {
    it("'I don\\'t think this is going to work out.' → walkAway", () => {
      expect(detectCandidateIntent("I don't think this is going to work out.").walkAway).toBe(true);
    });
    it("'I do not think this is going to work.' → walkAway", () => {
      expect(detectCandidateIntent("I do not think this is going to work.").walkAway).toBe(true);
    });
  });

  /* ── S113-B15 — 'call it quits' walkAway ── */
  describe("S113-B15 — \"call it quits\" walkAway", () => {
    it("'Let\\'s call it quits.' → walkAway", () => {
      expect(detectCandidateIntent("Let's call it quits.").walkAway).toBe(true);
    });
  });

  /* ── S113-B16 — 'bow out' walkAway ── */
  describe("S113-B16 — \"bow out\" walkAway", () => {
    it("'I need to bow out of this process.' → walkAway", () => {
      expect(detectCandidateIntent("I need to bow out of this process.").walkAway).toBe(true);
    });
    it("'I\\'m bowing out.' → walkAway", () => {
      expect(detectCandidateIntent("I'm bowing out.").walkAway).toBe(true);
    });
  });

  /* ── S113-B17 — 'run this by my family' needsTime ── */
  describe("S113-B17 — \"run this by my family\" needsTime", () => {
    it("'I want to run this by my family.' → needsTime", () => {
      expect(detectCandidateIntent("I want to run this by my family.").needsTime).toBe(true);
    });
    it("'Let me run it by my wife.' → needsTime", () => {
      expect(detectCandidateIntent("Let me run it by my wife.").needsTime).toBe(true);
    });
  });

  /* ── S113-B19 — 'let me think out loud' NOT needsTime ── */
  describe("S113-B19 — \"let me think out loud\" safe (no needsTime)", () => {
    it("'Let me think out loud.' → needsTime=false", () => {
      expect(detectCandidateIntent("Let me think out loud.").needsTime).toBe(false);
    });
  });

  /* ── S114-B1 — 'I would accept nothing less' NOT accepted (FP fix) ── */
  describe("S114-B1 — \"I would accept nothing less\" safe (no accepted)", () => {
    it("'I would accept nothing less than 30.' → accepted=false", () => {
      expect(detectCandidateIntent("I would accept nothing less than 30.").accepted).toBe(false);
    });
    it("'I would accept nothing less.' → accepted=false", () => {
      expect(detectCandidateIntent("I would accept nothing less.").accepted).toBe(false);
    });
  });

  /* ── S114-B2 — 'walking away with a package' NOT walkAway (FP fix) ── */
  describe("S114-B2 — \"walking away with\" safe (no walkAway)", () => {
    it("'I\\'d be walking away with a great package if we settle at 28.' → walkAway=false", () => {
      expect(detectCandidateIntent("I'd be walking away with a great package if we settle at 28.").walkAway).toBe(false);
    });
    it("'walking away from this' still fires walkAway=true", () => {
      expect(detectCandidateIntent("I am walking away from this.").walkAway).toBe(true);
    });
  });

  /* ── S114-B3 — 'I'll go with this' accepted ── */
  describe("S114-B3 — \"I'll go with this\" accepted", () => {
    it("'I\\'ll go with this.' → accepted", () => {
      expect(detectCandidateIntent("I'll go with this.").accepted).toBe(true);
    });
    it("'I would go with it.' → accepted", () => {
      expect(detectCandidateIntent("I would go with it.").accepted).toBe(true);
    });
  });

  /* ── S114-B4 — 'in agreement' accepted ── */
  describe("S114-B4 — \"in agreement with the terms\" accepted", () => {
    it("'I\\'m in agreement with the terms.' → accepted", () => {
      expect(detectCandidateIntent("I'm in agreement with the terms.").accepted).toBe(true);
    });
    it("'In agreement.' → accepted", () => {
      expect(detectCandidateIntent("In agreement.").accepted).toBe(true);
    });
  });

  /* ── S114-B5 — 'I'm satisfied with this' accepted ── */
  describe("S114-B5 — \"I'm satisfied with this\" accepted", () => {
    it("'I\\'m satisfied with this.' → accepted", () => {
      expect(detectCandidateIntent("I'm satisfied with this.").accepted).toBe(true);
    });
    it("'I am fully satisfied with the offer.' → accepted", () => {
      expect(detectCandidateIntent("I am fully satisfied with the offer.").accepted).toBe(true);
    });
  });

  /* ── S114-B6 — 'I'll be declining your offer' walkAway ── */
  describe("S114-B6 — \"I'll be declining\" walkAway", () => {
    it("'I\\'ll be declining your offer.' → walkAway", () => {
      expect(detectCandidateIntent("I'll be declining your offer.").walkAway).toBe(true);
    });
    it("'I will be declining.' → walkAway", () => {
      expect(detectCandidateIntent("I will be declining.").walkAway).toBe(true);
    });
  });

  /* ── S114-B7 — 'can't come to an agreement' walkAway ── */
  describe("S114-B7 — \"can't come to an agreement\" walkAway", () => {
    it("'We can\\'t come to an agreement.' → walkAway", () => {
      expect(detectCandidateIntent("We can't come to an agreement.").walkAway).toBe(true);
    });
    it("'I cannot come to an agreement on this.' → walkAway", () => {
      expect(detectCandidateIntent("I cannot come to an agreement on this.").walkAway).toBe(true);
    });
  });

  /* ── S114-B8 — 'let me sit with this' needsTime ── */
  describe("S114-B8 — \"sit with this\" needsTime", () => {
    it("'Let me sit with this for a bit.' → needsTime", () => {
      expect(detectCandidateIntent("Let me sit with this for a bit.").needsTime).toBe(true);
    });
  });

  /* ── S114-B9 — 'have some time to process' needsTime ── */
  describe("S114-B9 — \"have some time to process\" needsTime", () => {
    it("'Can I have some time to process?' → needsTime", () => {
      expect(detectCandidateIntent("Can I have some time to process?").needsTime).toBe(true);
    });
    it("'I\\'d like to have more time to decide.' → needsTime", () => {
      expect(detectCandidateIntent("I'd like to have more time to decide.").needsTime).toBe(true);
    });
  });

  /* ── S115-B2 — accept: willing to move forward ── */
  describe("S115-B2 — \"willing to move forward\" accepted", () => {
    it("'I\\'m willing to move forward.' → accepted", () => {
      expect(detectCandidateIntent("I'm willing to move forward.").accepted).toBe(true);
    });
    it("'I\\'m willing to proceed.' → accepted", () => {
      expect(detectCandidateIntent("I'm willing to proceed.").accepted).toBe(true);
    });
  });

  /* ── S115-B3 — accept: let's do it ── */
  describe("S115-B3 — \"let's do it\" accepted", () => {
    it("'Let\\'s do it.' → accepted", () => {
      expect(detectCandidateIntent("Let's do it.").accepted).toBe(true);
    });
  });

  /* ── S115-B8 — reject: like/want more fixed pay ── */
  describe("S115-B8 — \"like more fixed pay\" rejected", () => {
    it("'I\\'d like more fixed pay.' → rejected", () => {
      expect(detectCandidateIntent("I'd like more fixed pay.").rejected).toBe(true);
    });
    it("'I want a higher base salary.' → rejected", () => {
      expect(detectCandidateIntent("I want a higher base salary.").rejected).toBe(true);
    });
  });

  /* ── S115-B10 — reject: CTC to be at least ── */
  describe("S115-B10 — \"CTC to be at least\" rejected", () => {
    it("'I need my CTC to be at least 30.' → rejected", () => {
      expect(detectCandidateIntent("I need my CTC to be at least 30.").rejected).toBe(true);
    });
    it("'The salary to be at least 25 LPA.' → rejected", () => {
      expect(detectCandidateIntent("The salary to be at least 25 LPA.").rejected).toBe(true);
    });
  });

  /* ── S115-B12 — reject: hoping for at least ── */
  describe("S115-B12 — \"hoping for at least\" rejected", () => {
    it("'I was hoping for at least 28 LPA.' → rejected", () => {
      expect(detectCandidateIntent("I was hoping for at least 28 LPA.").rejected).toBe(true);
    });
  });

  /* ── S115-B14 — reject: much lower than current package ── */
  describe("S115-B14 — \"much lower than current package\" rejected", () => {
    it("'This is much lower than my current package.' → rejected", () => {
      expect(detectCandidateIntent("This is much lower than my current package.").rejected).toBe(true);
    });
    it("'This is significantly lower than my current salary.' → rejected", () => {
      expect(detectCandidateIntent("This is significantly lower than my current salary.").rejected).toBe(true);
    });
  });

  /* ── S115-B18 — walkAway: no longer wish to proceed ── */
  describe("S115-B18 — \"no longer wish to proceed\" walkAway", () => {
    it("'I no longer wish to proceed.' → walkAway", () => {
      expect(detectCandidateIntent("I no longer wish to proceed.").walkAway).toBe(true);
    });
    it("'I no longer want to continue this negotiation.' → walkAway", () => {
      expect(detectCandidateIntent("I no longer want to continue this negotiation.").walkAway).toBe(true);
    });
  });

  /* ── S115-B23 — needsTime: ponder ── */
  describe("S115-B23 — \"ponder\" needsTime", () => {
    it("'Let me ponder this.' → needsTime", () => {
      expect(detectCandidateIntent("Let me ponder this.").needsTime).toBe(true);
    });
  });

  /* ── S115-B24 — needsTime: give me N hours ── */
  describe("S115-B24 — \"give me 48 hours\" needsTime", () => {
    it("'Give me 48 hours.' → needsTime", () => {
      expect(detectCandidateIntent("Give me 48 hours.").needsTime).toBe(true);
    });
    it("'Give me a day.' → needsTime", () => {
      expect(detectCandidateIntent("Give me a day.").needsTime).toBe(true);
    });
  });

  /* ── S115-B25 — needsTime: discuss internally ── */
  describe("S115-B25 — \"discuss internally\" needsTime", () => {
    it("'I need to discuss this internally.' → needsTime", () => {
      expect(detectCandidateIntent("I need to discuss this internally.").needsTime).toBe(true);
    });
  });

  /* ── S115-B26 — safe: 'could look elsewhere' not walkAway (FP fix) ── */
  describe("S115-B26 — \"could look elsewhere\" safe (no walkAway)", () => {
    it("'We could look elsewhere if needed.' → walkAway=false", () => {
      expect(detectCandidateIntent("We could look elsewhere if needed.").walkAway).toBe(false);
    });
    it("'I\\'ll look elsewhere.' → walkAway=true", () => {
      expect(detectCandidateIntent("I'll look elsewhere.").walkAway).toBe(true);
    });
  });

  /* ── S116-B1 — FP: "not willing to proceed" must not be accepted ── */
  describe("S116-B1 — \"not willing to proceed\" accepted=false (FP fix)", () => {
    it("'I\\'m not willing to proceed at this number.' → accepted=false", () => {
      expect(detectCandidateIntent("I'm not willing to proceed at this number.").accepted).toBe(false);
    });
    it("'I am not willing to move forward with this offer.' → accepted=false", () => {
      expect(detectCandidateIntent("I am not willing to move forward with this offer.").accepted).toBe(false);
    });
    it("'I\\'m willing to proceed.' → accepted=true (true positive preserved)", () => {
      expect(detectCandidateIntent("I'm willing to proceed.").accepted).toBe(true);
    });
  });

  /* ── S116-B4 — accept: "go ahead with" ── */
  describe("S116-B4 — \"go ahead with\" accepted", () => {
    it("'I\\'ll go ahead with this offer.' → accepted=true", () => {
      expect(detectCandidateIntent("I'll go ahead with this offer.").accepted).toBe(true);
    });
    it("'I\\'d go ahead with it.' → accepted=true", () => {
      expect(detectCandidateIntent("I'd go ahead with it.").accepted).toBe(true);
    });
    it("'I will go ahead.' → accepted=true", () => {
      expect(detectCandidateIntent("I will go ahead.").accepted).toBe(true);
    });
  });

  /* ── S116-B6 — accept: "good with this" ── */
  describe("S116-B6 — \"good with this\" accepted", () => {
    it("'I\\'m good with this.' → accepted=true", () => {
      expect(detectCandidateIntent("I'm good with this.").accepted).toBe(true);
    });
    it("'I am totally good with that.' → accepted=true", () => {
      expect(detectCandidateIntent("I am totally good with that.").accepted).toBe(true);
    });
    it("'I\\'m pretty good with the terms.' → accepted=true", () => {
      expect(detectCandidateIntent("I'm pretty good with the terms.").accepted).toBe(true);
    });
  });

  /* ── S116-B7 — FP: "don't want more variable" must not be rejected ── */
  describe("S116-B7 — \"don't want more variable\" rejected=false (FP fix)", () => {
    it("'I don\\'t want more variable equity.' → rejected=false", () => {
      expect(detectCandidateIntent("I don't want more variable equity.").rejected).toBe(false);
    });
    it("'I don\\'t need more fixed.' → rejected=false", () => {
      expect(detectCandidateIntent("I don't need more fixed.").rejected).toBe(false);
    });
    it("'I want more fixed salary.' → rejected=true (true positive preserved)", () => {
      expect(detectCandidateIntent("I want more fixed salary.").rejected).toBe(true);
    });
  });

  /* ── S116-B10 — reject: "had been expecting more" ── */
  describe("S116-B10 — \"had been expecting more\" rejected", () => {
    it("'I had been expecting more.' → rejected=true", () => {
      expect(detectCandidateIntent("I had been expecting more.").rejected).toBe(true);
    });
    it("'I had been expecting much more than this.' → rejected=true", () => {
      expect(detectCandidateIntent("I had been expecting much more than this.").rejected).toBe(true);
    });
  });

  /* ── S116-B12 — walkAway: "pulling out" gerund form ── */
  describe("S116-B12 — \"pulling out\" walkAway", () => {
    it("'I\\'ll be pulling out of this process.' → walkAway=true", () => {
      expect(detectCandidateIntent("I'll be pulling out of this process.").walkAway).toBe(true);
    });
    it("'I am pulling out.' → walkAway=true", () => {
      expect(detectCandidateIntent("I am pulling out.").walkAway).toBe(true);
    });
    it("'I need to pull out of this.' → walkAway=true", () => {
      expect(detectCandidateIntent("I need to pull out of this.").walkAway).toBe(true);
    });
  });

  /* ── S116-B13 — walkAway: "decided not to move forward" ── */
  describe("S116-B13 — \"decided not to move forward\" walkAway", () => {
    it("'I\\'ve decided not to move forward with this.' → walkAway=true", () => {
      expect(detectCandidateIntent("I've decided not to move forward with this.").walkAway).toBe(true);
    });
    it("'I have decided not to proceed.' → walkAway=true", () => {
      expect(detectCandidateIntent("I have decided not to proceed.").walkAway).toBe(true);
    });
    it("'I decided not to continue.' → walkAway=true", () => {
      expect(detectCandidateIntent("I decided not to continue.").walkAway).toBe(true);
    });
  });

  /* ── S116-B14 — needsTime: "a few more days" ── */
  describe("S116-B14 — \"a few more days\" needsTime", () => {
    it("'I\\'d like a few more days to decide.' → needsTime=true", () => {
      expect(detectCandidateIntent("I'd like a few more days to decide.").needsTime).toBe(true);
    });
    it("'Give me a few more days.' → needsTime=true", () => {
      expect(detectCandidateIntent("Give me a few more days.").needsTime).toBe(true);
    });
    it("'I need a few days.' → needsTime=true (original preserved)", () => {
      expect(detectCandidateIntent("I need a few days.").needsTime).toBe(true);
    });
  });

  /* ── S117-B1 FP — accept: "Accept nothing below 30 LPA" ── */
  describe("S117-B1 — \"Accept nothing below\" accepted=false (FP fix)", () => {
    it("'Accept nothing below 30 LPA.' → accepted=false", () => {
      expect(detectCandidateIntent("Accept nothing below 30 LPA.").accepted).toBe(false);
    });
    it("'I accept.' → accepted=true (short affirmative preserved)", () => {
      expect(detectCandidateIntent("I accept.").accepted).toBe(true);
    });
  });

  /* ── S117-B5 FP — reject: "don't think I need more equity" ── */
  describe("S117-B5 — \"don't think I need more equity\" rejected=false (FP fix)", () => {
    it("'I don\\'t think I need more equity to make this work.' → rejected=false", () => {
      expect(detectCandidateIntent("I don't think I need more equity to make this work.").rejected).toBe(false);
    });
    it("'I want more fixed salary.' → rejected=true (true positive preserved)", () => {
      expect(detectCandidateIntent("I want more fixed salary.").rejected).toBe(true);
    });
  });

  /* ── S117-B7/B8 FPs — needsTime: negated think phrases ── */
  describe("S117-B7B8 — negated think-time phrases needsTime=false (FP fixes)", () => {
    it("'I don\\'t need time, I accept.' → needsTime=false", () => {
      expect(detectCandidateIntent("I don't need time, I accept.").needsTime).toBe(false);
    });
    it("'No need to think about it, I\\'m in.' → needsTime=false", () => {
      expect(detectCandidateIntent("No need to think about it, I'm in.").needsTime).toBe(false);
    });
    it("'I need more time to decide.' → needsTime=true (true positive preserved)", () => {
      expect(detectCandidateIntent("I need more time to decide.").needsTime).toBe(true);
    });
  });

  /* ── S117-B11 — accept: "consider it settled" (+ FN fix for bare consider) ── */
  describe("S117-B11 — \"consider it settled\" accepted", () => {
    it("'Consider it settled.' → accepted=true", () => {
      expect(detectCandidateIntent("Consider it settled.").accepted).toBe(true);
    });
    it("'Consider it settled.' → needsTime=false (double-bug fix)", () => {
      expect(detectCandidateIntent("Consider it settled.").needsTime).toBe(false);
    });
  });

  /* ── S117-B12/B13/B14/B15 — accept: sign/shake/settled idioms ── */
  describe("S117-B12-B15 — deal-close accept idioms", () => {
    it("'I\\'m happy to sign.' → accepted=true", () => {
      expect(detectCandidateIntent("I'm happy to sign.").accepted).toBe(true);
    });
    it("'Sign me up.' → accepted=true", () => {
      expect(detectCandidateIntent("Sign me up.").accepted).toBe(true);
    });
    it("'That\\'s settled then.' → accepted=true", () => {
      expect(detectCandidateIntent("That's settled then.").accepted).toBe(true);
    });
    it("'Let\\'s shake on it.' → accepted=true", () => {
      expect(detectCandidateIntent("Let's shake on it.").accepted).toBe(true);
    });
  });

  /* ── S117-B16/B19 — accept: content/comfortable with ── */
  describe("S117-B16B19 — \"content/comfortable with\" accepted", () => {
    it("'I\\'m content with this package.' → accepted=true", () => {
      expect(detectCandidateIntent("I'm content with this package.").accepted).toBe(true);
    });
    it("'I\\'m comfortable with this.' → accepted=true", () => {
      expect(detectCandidateIntent("I'm comfortable with this.").accepted).toBe(true);
    });
    it("'I\\'m not comfortable with this.' → accepted=false", () => {
      expect(detectCandidateIntent("I'm not comfortable with this.").accepted).toBe(false);
    });
  });

  /* ── S117-B21/B22/B24/B26 — reject: disappointment/underwhelming/below par ── */
  describe("S117-B21-B26 — sentiment-based rejection FNs", () => {
    it("'This is not what I was expecting.' → rejected=true", () => {
      expect(detectCandidateIntent("This is not what I was expecting.").rejected).toBe(true);
    });
    it("'I\\'m disappointed with this offer.' → rejected=true", () => {
      expect(detectCandidateIntent("I'm disappointed with this offer.").rejected).toBe(true);
    });
    it("'This feels underwhelming.' → rejected=true", () => {
      expect(detectCandidateIntent("This feels underwhelming.").rejected).toBe(true);
    });
    it("'This is below par.' → rejected=true", () => {
      expect(detectCandidateIntent("This is below par.").rejected).toBe(true);
    });
    it("'I\\'m not happy with this offer.' → rejected=true", () => {
      expect(detectCandidateIntent("I'm not happy with this offer.").rejected).toBe(true);
    });
  });

  /* ── S117-B36/B37 — walkAway: stepping away / made up my mind ── */
  describe("S117-B36B37 — stepping away / made up my mind walkAway", () => {
    it("'I\\'m stepping away from this process.' → walkAway=true", () => {
      expect(detectCandidateIntent("I'm stepping away from this process.").walkAway).toBe(true);
    });
    it("'I\\'ve made up my mind to decline this offer.' → walkAway=true", () => {
      expect(detectCandidateIntent("I've made up my mind to decline this offer.").walkAway).toBe(true);
    });
  });

  /* ── S117-B48/B52 — needsTime: couple of weeks / chew on this ── */
  describe("S117-B48B52 — needsTime new arms", () => {
    it("'I\\'ll need a couple of weeks to decide.' → needsTime=true", () => {
      expect(detectCandidateIntent("I'll need a couple of weeks to decide.").needsTime).toBe(true);
    });
    it("'Let me chew on this a bit.' → needsTime=true", () => {
      expect(detectCandidateIntent("Let me chew on this a bit.").needsTime).toBe(true);
    });
    it("'I need some space to decide.' → needsTime=true", () => {
      expect(detectCandidateIntent("I need some space to decide.").needsTime).toBe(true);
    });
    it("'I\\'d like to weigh my options.' → needsTime=true", () => {
      expect(detectCandidateIntent("I'd like to weigh my options.").needsTime).toBe(true);
    });
  });

  /* ── S118 — wave 24 adversarial hardening (15 bugs) ── */
  /* B9 FP: bare "i accept" guard; B11 FN: shake hands; B1/B2/B10/B3 FP: isShortAffirmativeConditional */
  /* B4 FP: disappointed restricted; B5 FP: a-bit-low lookahead; B6 FP: not-happy restricted */
  /* B7 FP: step away restricted; B8 FP: process this restricted; B13 FN: ca in check/speak */
  /* B12 FN: exit the; B14 FN: moving on; B15 FN: have the weekend */

  describe("S118-B9 — 'i accept nothing below' must NOT fire accepted=true", () => {
    it("'I accept nothing below 30 LPA.' → accepted=false", () => {
      expect(detectCandidateIntent("I accept nothing below 30 LPA.").accepted).toBe(false);
    });
    it("'I accept no less than 40 lakhs.' → accepted=false", () => {
      expect(detectCandidateIntent("I accept no less than 40 lakhs.").accepted).toBe(false);
    });
    it("'I accept anything less than 35 LPA.' → accepted=false (anything less guard)", () => {
      expect(detectCandidateIntent("I accept anything less than 35 LPA.").accepted).toBe(false);
    });
    it("'I accept the offer.' → accepted=true (true positive preserved)", () => {
      expect(detectCandidateIntent("I accept the offer.").accepted).toBe(true);
    });
  });

  describe("S118-B11 — 'let's shake hands on it' accepted", () => {
    it("'Let\\'s shake hands on it.' → accepted=true", () => {
      expect(detectCandidateIntent("Let's shake hands on it.").accepted).toBe(true);
    });
    it("'Let\\'s shake on it.' → accepted=true (existing preserved)", () => {
      expect(detectCandidateIntent("Let's shake on it.").accepted).toBe(true);
    });
  });

  describe("S118-B1/B2/B10 — inverted-order rejection phrases not accepted as conditional", () => {
    it("'Sure, but I need more than this.' → accepted=false", () => {
      expect(detectCandidateIntent("Sure, but I need more than this.").accepted).toBe(false);
    });
    it("'Okay, but the equity needs to be higher.' → accepted=false", () => {
      expect(detectCandidateIntent("Okay, but the equity needs to be higher.").accepted).toBe(false);
    });
    it("'That works, but the salary needs to be increased.' → accepted=false", () => {
      expect(detectCandidateIntent("That works, but the salary needs to be increased.").accepted).toBe(false);
    });
    it("'Sure, but that doesn\\'t work in practice.' → accepted=false", () => {
      expect(detectCandidateIntent("Sure, but that doesn't work in practice.").accepted).toBe(false);
    });
  });

  describe("S118-B5 — 'a bit low-key' must NOT fire rejected=true", () => {
    it("'The vibe is a bit low-key for me.' → rejected=false", () => {
      expect(detectCandidateIntent("The vibe is a bit low-key for me.").rejected).toBe(false);
    });
    it("'The offer feels a bit low.' → rejected=true (true positive preserved)", () => {
      expect(detectCandidateIntent("The offer feels a bit low.").rejected).toBe(true);
    });
  });

  describe("S118-B7 — 'stepping away from the microphone' must NOT fire walkAway", () => {
    it("'I\\'m stepping away from the microphone.' → walkAway=false", () => {
      expect(detectCandidateIntent("I'm stepping away from the microphone.").walkAway).toBe(false);
    });
    it("'I\\'m stepping away from this negotiation.' → walkAway=true (preserved)", () => {
      expect(detectCandidateIntent("I'm stepping away from this negotiation.").walkAway).toBe(true);
    });
    it("'I\\'m stepping away from this.' → walkAway=true (bare this preserved)", () => {
      expect(detectCandidateIntent("I'm stepping away from this.").walkAway).toBe(true);
    });
  });

  describe("S118-B12 — 'exiting the negotiation' walkAway", () => {
    it("'I\\'m exiting the negotiation.' → walkAway=true", () => {
      expect(detectCandidateIntent("I'm exiting the negotiation.").walkAway).toBe(true);
    });
    it("'Exiting this discussion.' → walkAway=true (preserved)", () => {
      expect(detectCandidateIntent("Exiting this discussion.").walkAway).toBe(true);
    });
  });

  describe("S118-B14 — 'I am moving on / I\\'m moving on' walkAway", () => {
    it("'I am moving on.' → walkAway=true", () => {
      expect(detectCandidateIntent("I am moving on.").walkAway).toBe(true);
    });
    it("'I\\'m moving on.' → walkAway=true", () => {
      expect(detectCandidateIntent("I'm moving on.").walkAway).toBe(true);
    });
  });

  describe("S118-B13 — 'check with my CA' needsTime", () => {
    it("'I need to check with my CA.' → needsTime=true", () => {
      expect(detectCandidateIntent("I need to check with my CA.").needsTime).toBe(true);
    });
    it("'Let me speak with my CA first.' → needsTime=true", () => {
      expect(detectCandidateIntent("Let me speak with my CA first.").needsTime).toBe(true);
    });
  });

  describe("S118-B15 — 'can I have the weekend' needsTime", () => {
    it("'Can I have the weekend to think?' → needsTime=true", () => {
      expect(detectCandidateIntent("Can I have the weekend to think?").needsTime).toBe(true);
    });
    it("'Could I get the weekend to decide?' → needsTime=true", () => {
      expect(detectCandidateIntent("Could I get the weekend to decide?").needsTime).toBe(true);
    });
  });

  describe("S118-B8 — 'want to process this' restricted to offer context", () => {
    it("'I want to process this offer.' → needsTime=true", () => {
      expect(detectCandidateIntent("I want to process this offer.").needsTime).toBe(true);
    });
  });

  // ── S119 wave-25 adversarial hardening ──────────────────────────────────────

  describe("S119-B1 — 'I accept nothing less' must NOT be accepted", () => {
    it("'I accept nothing less than 30 LPA.' → accepted=false", () => {
      const r = detectCandidateIntent("I accept nothing less than 30 LPA.");
      expect(r.accepted).toBe(false);
    });
    it("'I accept no less than 25 LPA.' → rejected=true, accepted=false", () => {
      const r = detectCandidateIntent("I accept no less than 25 LPA.");
      expect(r.accepted).toBe(false);
    });
  });

  describe("S119-B2 — 'I accept that' (pronoun) must NOT fire accept", () => {
    it("'I accept that the base is too low.' → accepted=false", () => {
      expect(detectCandidateIntent("I accept that the base is too low.").accepted).toBe(false);
    });
    it("'I accept whatever lower number you want.' → accepted=false", () => {
      expect(detectCandidateIntent("I accept whatever lower number you want.").accepted).toBe(false);
    });
  });

  describe("S119-B3 — 'I'm going to have to pass on this one' → walkAway", () => {
    it("'I'm going to have to pass on this.' → walkAway=true", () => {
      expect(detectCandidateIntent("I'm going to have to pass on this.").walkAway).toBe(true);
    });
    it("'I will have to pass on this opportunity.' → walkAway=true", () => {
      expect(detectCandidateIntent("I will have to pass on this opportunity.").walkAway).toBe(true);
    });
  });

  describe("S119-B4 — 'pass on dessert/food' must NOT be walkAway", () => {
    it("'I'll pass on dessert, let's talk numbers.' → walkAway=false", () => {
      expect(detectCandidateIntent("I'll pass on dessert, let's talk numbers.").walkAway).toBe(false);
    });
    it("'I'll pass on the food, but about the offer...' → walkAway=false", () => {
      expect(detectCandidateIntent("I'll pass on the food, but about the offer...").walkAway).toBe(false);
    });
  });

  describe("S119-B5/B6/B7 — walkAwayNegationRe suppresses false positives", () => {
    it("'I don't want to walk away from this.' → walkAway=false", () => {
      expect(detectCandidateIntent("I don't want to walk away from this.").walkAway).toBe(false);
    });
    it("'I'm not going to walk away.' → walkAway=false", () => {
      expect(detectCandidateIntent("I'm not going to walk away.").walkAway).toBe(false);
    });
    it("'I won't decline this offer.' → walkAway=false", () => {
      expect(detectCandidateIntent("I won't decline this offer.").walkAway).toBe(false);
    });
  });

  describe("S119-B8 — 'won't work' with amount context stays walkAway", () => {
    it("'This won't work for me.' → walkAway=true", () => {
      expect(detectCandidateIntent("This won't work for me.").walkAway).toBe(true);
    });
    it("'Won't work for anything less than 30.' → walkAway=false (conditional)", () => {
      expect(detectCandidateIntent("Won't work for anything less than 30.").walkAway).toBe(false);
    });
  });

  describe("S119-B9 — 'let's do this/it' accept", () => {
    it("'Let's do this.' → accepted=true", () => {
      expect(detectCandidateIntent("Let's do this.").accepted).toBe(true);
    });
    it("'Let us do it.' → accepted=true", () => {
      expect(detectCandidateIntent("Let us do it.").accepted).toBe(true);
    });
  });

  describe("S119-B10/B12 — 'absolutely/perfect that works' shortAffirmative accept", () => {
    it("'Absolutely, that works for me.' → accepted=true", () => {
      expect(detectCandidateIntent("Absolutely, that works for me.").accepted).toBe(true);
    });
    it("'Perfect, that works.' → accepted=true", () => {
      expect(detectCandidateIntent("Perfect, that works.").accepted).toBe(true);
    });
    it("'Absolutely.' alone → needsTime/rejected/walkAway all false", () => {
      const r = detectCandidateIntent("Absolutely.");
      expect(r.walkAway).toBe(false);
      expect(r.rejected).toBe(false);
    });
  });

  describe("S119-B11 — 'I'd happily take the offer' accept", () => {
    it("'I'd happily take the offer.' → accepted=true", () => {
      expect(detectCandidateIntent("I'd happily take the offer.").accepted).toBe(true);
    });
    it("'I will gladly take it.' → accepted=true", () => {
      expect(detectCandidateIntent("I will gladly take it.").accepted).toBe(true);
    });
  });

  describe("S119-B13 — 'loop in family' needsTime", () => {
    it("'I need to loop in my spouse first.' → needsTime=true", () => {
      expect(detectCandidateIntent("I need to loop in my spouse first.").needsTime).toBe(true);
    });
    it("'Let me loop in my advisor.' → needsTime=true", () => {
      expect(detectCandidateIntent("Let me loop in my advisor.").needsTime).toBe(true);
    });
  });

  describe("S119-B14 — 'not satisfied' with object", () => {
    it("'I'm not satisfied with this.' → rejected=true", () => {
      expect(detectCandidateIntent("I'm not satisfied with this.").rejected).toBe(true);
    });
    it("'Not satisfied with the offer.' → rejected=true", () => {
      expect(detectCandidateIntent("Not satisfied with the offer.").rejected).toBe(true);
    });
  });

  describe("S119-B15 — 'expected better' reject", () => {
    it("'I expected much better than this.' → rejected=true", () => {
      expect(detectCandidateIntent("I expected much better than this.").rejected).toBe(true);
    });
    it("'Expected better communication.' → rejected=false (excluded)", () => {
      expect(detectCandidateIntent("Expected better communication.").rejected).toBe(false);
    });
  });

  describe("S119-B16 — 'component needs to be higher'", () => {
    it("'The variable component needs to be higher.' → rejected=true", () => {
      expect(detectCandidateIntent("The variable component needs to be higher.").rejected).toBe(true);
    });
    it("'Equity needs to be higher.' → rejected=true", () => {
      expect(detectCandidateIntent("Equity needs to be higher.").rejected).toBe(true);
    });
  });

  describe("S119-B18 — degree adverbs with 'lower than'", () => {
    it("'This is much lower than my expectations.' → rejected=true", () => {
      expect(detectCandidateIntent("This is much lower than my expectations.").rejected).toBe(true);
    });
    it("'Significantly lower than what I asked for.' → rejected=true", () => {
      expect(detectCandidateIntent("Significantly lower than what I asked for.").rejected).toBe(true);
    });
  });

  describe("S119-B19 — 'was expecting more'", () => {
    it("'I was expecting a bit more.' → rejected=true", () => {
      expect(detectCandidateIntent("I was expecting a bit more.").rejected).toBe(true);
    });
    it("'Have been expecting more.' → rejected=true", () => {
      expect(detectCandidateIntent("Have been expecting more.").rejected).toBe(true);
    });
  });

  describe("S119-B21 — 'cannot come to an agreement' walkAway", () => {
    it("'I cannot come to an agreement on this.' → walkAway=true", () => {
      expect(detectCandidateIntent("I cannot come to an agreement on this.").walkAway).toBe(true);
    });
    it("'We can't reach terms here.' → walkAway=true", () => {
      expect(detectCandidateIntent("We can't reach terms here.").walkAway).toBe(true);
    });
  });

  describe("S119-B22 — 'I'll need to pass' walkAway", () => {
    it("'I'll need to pass on this one.' → walkAway=true", () => {
      expect(detectCandidateIntent("I'll need to pass on this one.").walkAway).toBe(true);
    });
    it("'I'd need to pass on this position.' → walkAway=true", () => {
      expect(detectCandidateIntent("I'd need to pass on this position.").walkAway).toBe(true);
    });
  });

  describe("S119-B23/B24 — thinkNegationRe extensions", () => {
    it("'I'm not going to think about it.' → needsTime=false", () => {
      expect(detectCandidateIntent("I'm not going to think about it.").needsTime).toBe(false);
    });
    it("'Won't think about it, I'm in.' → needsTime=false", () => {
      expect(detectCandidateIntent("Won't think about it, I'm in.").needsTime).toBe(false);
    });
  });

  describe("S119-B25 — 'before deciding' needsTime", () => {
    it("'I need a day before deciding.' → needsTime=true", () => {
      expect(detectCandidateIntent("I need a day before deciding.").needsTime).toBe(true);
    });
    it("'Before committing, I want to review.' → needsTime=true", () => {
      expect(detectCandidateIntent("Before committing, I want to review.").needsTime).toBe(true);
    });
  });

  // ── S120 wave-26 adversarial hardening ──────────────────────────────────────

  describe("S120-B1 — walkAwayNegationRe extended to guard rejected too", () => {
    it("'I don't want to walk away from this.' → rejected=false", () => {
      expect(detectCandidateIntent("I don't want to walk away from this.").rejected).toBe(false);
    });
    it("'I'm not going to walk away.' → rejected=false", () => {
      expect(detectCandidateIntent("I'm not going to walk away.").rejected).toBe(false);
    });
  });

  describe("S120-B2 — 'walk away with' idiom must NOT fire reject/walkAway", () => {
    it("'I'll walk away with great memories of this process.' → walkAway=false, rejected=false", () => {
      const r = detectCandidateIntent("I'll walk away with great memories of this process.");
      expect(r.walkAway).toBe(false);
      expect(r.rejected).toBe(false);
    });
  });

  describe("S120-B3 — 'take it as a no' must NOT fire accept", () => {
    it("'I'll take it as a no.' → accepted=false", () => {
      expect(detectCandidateIntent("I'll take it as a no.").accepted).toBe(false);
    });
  });

  describe("S120-B5/B6 — new reject idioms", () => {
    it("'This is a lowball offer.' → rejected=true", () => {
      expect(detectCandidateIntent("This is a lowball offer.").rejected).toBe(true);
    });
    it("'That's not even close.' → rejected=true", () => {
      expect(detectCandidateIntent("That's not even close.").rejected).toBe(true);
    });
    it("'This doesn't come close.' → rejected=true", () => {
      expect(detectCandidateIntent("This doesn't come close.").rejected).toBe(true);
    });
  });

  describe("S120-B7/B8/B9 — losing money / seen better / below walk-away number", () => {
    it("'I'd be losing money at this rate.' → rejected=true", () => {
      expect(detectCandidateIntent("I'd be losing money at this rate.").rejected).toBe(true);
    });
    it("'I've seen better offers elsewhere.' → rejected=true, mentionedCompeting=true", () => {
      const r = detectCandidateIntent("I've seen better offers elsewhere.");
      expect(r.rejected).toBe(true);
      expect(r.mentionedCompeting).toBe(true);
    });
    it("'That's below my walk-away number.' → rejected=true", () => {
      expect(detectCandidateIntent("That's below my walk-away number.").rejected).toBe(true);
    });
  });

  describe("S120-B10 — walkAwayWords synced with canonical WALKAWAY_PATTERN", () => {
    it("'I'm done negotiating.' → walkAway=true", () => {
      expect(detectCandidateIntent("I'm done negotiating.").walkAway).toBe(true);
    });
    it("'I refuse to continue.' → walkAway=true", () => {
      expect(detectCandidateIntent("I refuse to continue.").walkAway).toBe(true);
    });
    it("'Not a chance.' → walkAway=true", () => {
      expect(detectCandidateIntent("Not a chance.").walkAway).toBe(true);
    });
    it("'That won't work.' → walkAway=true", () => {
      expect(detectCandidateIntent("That won't work.").walkAway).toBe(true);
    });
    it("'Let's end this conversation.' → walkAway=true", () => {
      expect(detectCandidateIntent("Let's end this conversation.").walkAway).toBe(true);
    });
  });

  describe("S120-B11 — 'bilkul nahi' (absolutely not) rejected, not accepted", () => {
    it("'Bilkul nahi, this is too low.' → accepted=false, rejected=true", () => {
      const r = detectCandidateIntent("Bilkul nahi, this is too low.");
      expect(r.accepted).toBe(false);
      expect(r.rejected).toBe(true);
    });
    it("'Bilkul, that works for me.' → accepted=true (bare bilkul preserved)", () => {
      expect(detectCandidateIntent("Bilkul, that works for me.").accepted).toBe(true);
    });
  });

  describe("S120-B13 — Hindi 'sochna padega' needsTime", () => {
    it("'Sochna padega, thoda time chahiye.' → needsTime=true", () => {
      expect(detectCandidateIntent("Sochna padega, thoda time chahiye.").needsTime).toBe(true);
    });
  });

  describe("S120-B14 — 'run it by my team/manager' needsTime", () => {
    it("'Let me run it by my team.' → needsTime=true", () => {
      expect(detectCandidateIntent("Let me run it by my team.").needsTime).toBe(true);
    });
    it("'I need to run this by my manager.' → needsTime=true", () => {
      expect(detectCandidateIntent("I need to run this by my manager.").needsTime).toBe(true);
    });
  });

  describe("S121-B1 (wave 27) — 'sounds  good' with irregular whitespace still accepts", () => {
    it("'Sounds  good, I accept.' → accepted=true", () => {
      expect(detectCandidateIntent("Sounds  good, I accept.").accepted).toBe(true);
    });
  });

  describe("S121-B2 (wave 27) — bare number + 'works' accepts", () => {
    it("'42 LPA works for me.' → accepted=true", () => {
      expect(detectCandidateIntent("42 LPA works for me.").accepted).toBe(true);
    });
    it("'42 works.' → accepted=true", () => {
      expect(detectCandidateIntent("42 works.").accepted).toBe(true);
    });
  });

  describe("S121-B3 (wave 27) — minutes-scale 'to think' needsTime", () => {
    it("'Give me 30 minutes to think.' → needsTime=true", () => {
      expect(detectCandidateIntent("Give me 30 minutes to think.").needsTime).toBe(true);
    });
  });

  describe("S121-B4 (wave 27) — Hindi 'lekin' hedge / 'sochne do' think-time", () => {
    it("'Sounds good lekin I need to check with my family.' → conditionalAccept=true", () => {
      const r = detectCandidateIntent("Sounds good lekin I need to check with my family.");
      expect(r.accepted).toBe(true);
      expect(r.conditionalAccept).toBe(true);
    });
    it("'Sochne do, main baad mein bataunga.' → needsTime=true", () => {
      expect(detectCandidateIntent("Sochne do, main baad mein bataunga.").needsTime).toBe(true);
    });
  });

  describe("S121-B5 (wave 27) — Hindi 'time chahiye' needsTime", () => {
    it("'Mujhe time chahiye isse sochne ke liye.' → needsTime=true", () => {
      expect(detectCandidateIntent("Mujhe time chahiye isse sochne ke liye.").needsTime).toBe(true);
    });
  });

  describe("S121-B6 (wave 27) — generic topic-redirect deflection", () => {
    it("'Can we talk about the joining bonus instead?' → deflected=true", () => {
      expect(detectCandidateIntent("Can we talk about the joining bonus instead?").deflected).toBe(true);
    });
    it("'Let's circle back to this later.' → deflected=true", () => {
      expect(detectCandidateIntent("Let's circle back to this later.").deflected).toBe(true);
    });
  });

  describe("S121-B7 (wave 27, highest severity) — walk-away retraction suppressed, genuine walk-away still fires", () => {
    it("'I was about to walk away but let's talk more.' → walkAway=false, rejected=false", () => {
      const r = detectCandidateIntent("I was about to walk away but let's talk more.");
      expect(r.walkAway).toBe(false);
      expect(r.rejected).toBe(false);
    });
    it("'I was going to decline but I am open to discussing.' → walkAway=false", () => {
      expect(detectCandidateIntent("I was going to decline but I am open to discussing.").walkAway).toBe(false);
    });
    it("'I am walking away, this offer is unacceptable.' → walkAway=true (not over-suppressed)", () => {
      expect(detectCandidateIntent("I am walking away, this offer is unacceptable.").walkAway).toBe(true);
    });
  });

  describe("S122-B1 (wave 28, P1) — bare 'not' walk-away negation desynced from isWalkAway()", () => {
    it("'I'm not walking away, just need a moment to think.' → walkAway=false", () => {
      expect(detectCandidateIntent("I'm not walking away, just need a moment to think.").walkAway).toBe(false);
    });
    it("'I'm not sure, but I will walk away if you don't match.' → walkAway=true (not over-suppressed)", () => {
      const r = detectCandidateIntent("I'm not sure, but I will walk away if you don't match.");
      expect(r.walkAway).toBe(true);
    });
  });

  describe("S122-B2 (wave 28, P1) — bare 'too low' missing negation guard", () => {
    it("'Not too low, actually it's pretty fair.' → rejected=false", () => {
      expect(detectCandidateIntent("Not too low, actually it's pretty fair.").rejected).toBe(false);
    });
    it("'That's too low for me.' → rejected=true (not over-suppressed)", () => {
      expect(detectCandidateIntent("That's too low for me.").rejected).toBe(true);
    });
  });

  describe("S122-B4 (wave 28, P2) — 'insulting' required literal \"that's\", missed \"this is\"/\"it's\"", () => {
    it("'This is insulting.' → rejected=true", () => {
      expect(detectCandidateIntent("This is insulting.").rejected).toBe(true);
    });
    it("'It's insulting, honestly.' → rejected=true", () => {
      expect(detectCandidateIntent("It's insulting, honestly.").rejected).toBe(true);
    });
  });

  describe("S122-B5 (wave 28, P2) — deflect 'what...offer' false-fired on legitimate non-cash questions", () => {
    it("'What can you offer me in terms of growth here?' → deflected=false", () => {
      expect(detectCandidateIntent("What can you offer me in terms of growth here?").deflected).toBe(false);
    });
    it("'What benefits do you offer besides the base salary?' → deflected=false", () => {
      expect(detectCandidateIntent("What benefits do you offer besides the base salary?").deflected).toBe(false);
    });
    it("'What would you offer? You go first.' → deflected=true (not over-suppressed)", () => {
      expect(detectCandidateIntent("What would you offer? You go first.").deflected).toBe(true);
    });
  });

  describe("S122-B6 (wave 28, P3) — 'hard pass' returned NONE", () => {
    it("'hard pass' → walkAway=true", () => {
      expect(detectCandidateIntent("hard pass").walkAway).toBe(true);
    });
  });

  describe("S123-B1 (wave 29, P1) — 'don't think X works' fired accepted=true instead of rejected=true", () => {
    it("'I don't think this works for me.' → accepted=false, rejected=true", () => {
      const r = detectCandidateIntent("I don't think this works for me.");
      expect(r.accepted).toBe(false);
      expect(r.rejected).toBe(true);
    });
    it("'I dont think it works for me.' → accepted=false, rejected=true", () => {
      const r = detectCandidateIntent("I dont think it works for me.");
      expect(r.accepted).toBe(false);
      expect(r.rejected).toBe(true);
    });
    it("'42 works for me.' → accepted=true (not over-suppressed)", () => {
      expect(detectCandidateIntent("42 works for me.").accepted).toBe(true);
    });
  });

  describe("S123-B2 (wave 29, P1) — double-negative 'not interested' reassurance fired rejected/walkAway=true", () => {
    it("'It's not like I'm not interested.' → rejected=false, walkAway=false", () => {
      const r = detectCandidateIntent("It's not like I'm not interested.");
      expect(r.rejected).toBe(false);
      expect(r.walkAway).toBe(false);
    });
    it("isWalkAway(\"It's not like I'm not interested.\") → false", () => {
      expect(isWalkAway("It's not like I'm not interested.")).toBe(false);
    });
    it("'I can't say I'm not interested.' → rejected=false, walkAway=false", () => {
      const r = detectCandidateIntent("I can't say I'm not interested.");
      expect(r.rejected).toBe(false);
      expect(r.walkAway).toBe(false);
    });
    it("isWalkAway(\"I can't say I'm not interested.\") → false", () => {
      expect(isWalkAway("I can't say I'm not interested.")).toBe(false);
    });
    it("'Not interested, thanks.' → rejected=true, walkAway=true (not over-suppressed)", () => {
      const r = detectCandidateIntent("Not interested, thanks.");
      expect(r.rejected).toBe(true);
      expect(r.walkAway).toBe(true);
      expect(isWalkAway("Not interested, thanks.")).toBe(true);
    });
  });

  describe("S123-B3 (wave 29, P2) — litotes 'can't say I wouldn't accept' fired rejected=true", () => {
    it("'I can't say I wouldn't accept that.' → rejected=false", () => {
      expect(detectCandidateIntent("I can't say I wouldn't accept that.").rejected).toBe(false);
    });
    it("'Not that I wouldn't accept it, but I need to check numbers first.' → rejected=false", () => {
      expect(detectCandidateIntent("Not that I wouldn't accept it, but I need to check numbers first.").rejected).toBe(false);
    });
    it("'I wouldn't accept that offer.' → rejected=true (not over-suppressed)", () => {
      expect(detectCandidateIntent("I wouldn't accept that offer.").rejected).toBe(true);
    });
  });

  describe("S124-B1 (wave 30) — bare 'I am walking out' desynced between walkAwayWords and WALKAWAY_PATTERN", () => {
    it("'I am walking out of this meeting.' → walkAway=true", () => {
      expect(detectCandidateIntent("I am walking out of this meeting.").walkAway).toBe(true);
    });
    it("'I walk.' (bare verb, no away/out) → walkAway=true", () => {
      expect(detectCandidateIntent("I walk.").walkAway).toBe(true);
    });
  });

  describe("S124-B4 (wave 30) — 'I'm out of here' wrongly excluded by the blanket 'out of X' guard", () => {
    it("\"I'm out of here.\" → walkAway=true", () => {
      expect(detectCandidateIntent("I'm out of here.").walkAway).toBe(true);
    });
    it("\"I'm out of options here, what can you do?\" → walkAway=false (not over-firing)", () => {
      expect(detectCandidateIntent("I'm out of options here, what can you do?").walkAway).toBe(false);
    });
  });

  describe("S124-B4b (wave 30) — 'no deal breakers' missing the breakers guard synced from canonical", () => {
    it("\"No deal breakers here, we're fine.\" → walkAway=false", () => {
      expect(detectCandidateIntent("No deal breakers here, we're fine.").walkAway).toBe(false);
    });
  });

  describe("S124-B5 (wave 30) — 'walkin' dropped-g typo not recognized as walk-away", () => {
    it("\"I'm walkin away from this deal.\" → walkAway=true", () => {
      expect(detectCandidateIntent("I'm walkin away from this deal.").walkAway).toBe(true);
    });
  });

  describe("S124-B1/B4/B4b/B5 (wave 30) — canonical isWalkAway() parity checks", () => {
    it("'I am walking out of this meeting.' → isWalkAway=true", () => {
      expect(isWalkAway("I am walking out of this meeting.")).toBe(true);
    });
    it("'This offer is not for me.' → isWalkAway=true (missing from canonical WALKAWAY_PATTERN)", () => {
      expect(isWalkAway("This offer is not for me.")).toBe(true);
    });
    it("'Thanks but no.' → isWalkAway=true (missing from canonical WALKAWAY_PATTERN)", () => {
      expect(isWalkAway("Thanks but no.")).toBe(true);
    });
    it("\"I'll walk away with nothing if you don't move.\" → isWalkAway=false (floor statement, not exit)", () => {
      expect(isWalkAway("I'll walk away with nothing if you don't move.")).toBe(false);
    });
    it("\"I'm out of here.\" → isWalkAway=true", () => {
      expect(isWalkAway("I'm out of here.")).toBe(true);
    });
    it("\"I'm walkin away from this deal.\" → isWalkAway=true", () => {
      expect(isWalkAway("I'm walkin away from this deal.")).toBe(true);
    });
  });

  describe("S124-B2 (wave 30) — stripNegatedDepartures() per-match lookback window over-suppressed a later genuine walk-away", () => {
    it("\"I don't want to walk away, but if you don't match this I will walk away.\" → isWalkAway=true", () => {
      expect(
        isWalkAway("I don't want to walk away, but if you don't match this I will walk away."),
      ).toBe(true);
    });
    it("\"I don't want to walk away, but if you don't match this I will walk away.\" → detectCandidateIntent walkAway=true (still correct via post-hedge fallback)", () => {
      expect(
        detectCandidateIntent(
          "I don't want to walk away, but if you don't match this I will walk away.",
        ).walkAway,
      ).toBe(true);
    });
    it("existing negated walk-away is still suppressed (no regression)", () => {
      expect(isWalkAway("I'm not walking away, just need a moment.")).toBe(false);
      expect(detectCandidateIntent("I'm not walking away, just need a moment.").walkAway).toBe(false);
    });
  });

  describe("S124-B3 (wave 30, P1) — 'don't think X works' still fired accepted=true instead of rejected=true", () => {
    it("'I don't think this works for me.' → accepted=false, rejected=true", () => {
      const r = detectCandidateIntent("I don't think this works for me.");
      expect(r.accepted).toBe(false);
      expect(r.rejected).toBe(true);
    });
  });

  describe("S125-A (wave 31, P1) — 'I will/now/hereby decline' desynced between canonical decline arms and the duplicate walkAwayWords/walkRe", () => {
    it("'I will decline this offer.' → walkAway=true", () => {
      expect(detectCandidateIntent("I will decline this offer.").walkAway).toBe(true);
    });
    it("'I now decline this offer.' → walkAway=true", () => {
      expect(detectCandidateIntent("I now decline this offer.").walkAway).toBe(true);
    });
    it("'I hereby decline this offer.' → walkAway=true", () => {
      expect(detectCandidateIntent("I hereby decline this offer.").walkAway).toBe(true);
    });
    it("'I will likely move on.' → walkAway=true", () => {
      expect(detectCandidateIntent("I will likely move on.").walkAway).toBe(true);
    });
    it("isWalkAway parity: 'I will decline this offer.' / 'I hereby decline this offer.'", () => {
      expect(isWalkAway("I will decline this offer.")).toBe(true);
      expect(isWalkAway("I hereby decline this offer.")).toBe(true);
    });
  });

  describe("S125-B (wave 31, P1) — hedge-branch walk-away fallback bypassed the negation guard entirely", () => {
    it("'I will not accept this, but I will not walk away either, let's keep talking.' → walkAway=false", () => {
      expect(
        detectCandidateIntent(
          "I will not accept this, but I will not walk away either, let's keep talking.",
        ).walkAway,
      ).toBe(false);
    });
    it("genuine post-hedge walk-away still fires (no regression)", () => {
      expect(
        detectCandidateIntent("Sounds good, but actually I am walking away if you cannot match it.")
          .walkAway,
      ).toBe(true);
    });
  });

  describe("S125-C (wave 31, P1) — bare 'I walk' verb arm false-fired on unrelated habitual/possessive sentences", () => {
    it("'I walk in on Mondays around 9am, so scheduling calls before that is tough.' → walkAway=false", () => {
      expect(
        detectCandidateIntent(
          "I walk in on Mondays around 9am, so scheduling calls before that is tough.",
        ).walkAway,
      ).toBe(false);
    });
    it("'I walk her dog every morning before work, so mornings are tight.' → walkAway=false", () => {
      expect(
        detectCandidateIntent("I walk her dog every morning before work, so mornings are tight.")
          .walkAway,
      ).toBe(false);
    });
    it("'I walk.' (bare verb, end of reply) → walkAway=true (no regression)", () => {
      expect(detectCandidateIntent("I walk.").walkAway).toBe(true);
    });
    it("'I am walking out of this meeting.' → walkAway=true (no regression)", () => {
      expect(detectCandidateIntent("I am walking out of this meeting.").walkAway).toBe(true);
    });
  });

  describe("S125-D (wave 31, P3) — deflectWords missing 'you go first' verb-inserted variant", () => {
    it("'You go first, tell me your budget.' → deflected=true", () => {
      expect(detectCandidateIntent("You go first, tell me your budget.").deflected).toBe(true);
    });
  });
});
