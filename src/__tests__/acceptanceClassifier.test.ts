import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

describe("classifyAcceptance — vetoes", () => {
  it("vetoes walk-away even with accept verb", () => {
    const r = classifyAcceptance("I'd accept but actually I'll pass.");
    expect(r.accepted).toBe(false);
    expect(r.reasons).toContain("walk-away");
  });

  it("vetoes hard conditional", () => {
    const r = classifyAcceptance("I accept if you can add a joining bonus.");
    expect(r.accepted).toBe(false);
    expect(r.reasons).toContain("hard-conditional");
  });

  it("does NOT veto info-seeking conditional", () => {
    const r = classifyAcceptance("I would like to accept, if you could share the breakdown.");
    expect(r.accepted).toBe(true);
  });

  it("vetoes 'but I want more'", () => {
    const r = classifyAcceptance("I'd accept but I want a bit more on base.");
    expect(r.accepted).toBe(false);
    expect(r.reasons).toContain("negotiating-but");
  });

  it("does NOT veto 'but I'd like to know more' (info-seeking)", () => {
    const r = classifyAcceptance("I would like to accept this offer. But I would like to know more about the benefits.");
    expect(r.accepted).toBe(true);
  });

  it("vetoes negation", () => {
    expect(classifyAcceptance("I'm not interested.").accepted).toBe(false);
  });

  it("vetoes weak-affirmative-only starters", () => {
    expect(classifyAcceptance("It okay. Let's get started.").accepted).toBe(false);
    expect(classifyAcceptance("Okay, let's begin.").accepted).toBe(false);
    expect(classifyAcceptance("Sure let's start.").accepted).toBe(false);
  });
});

describe("classifyAcceptance — performative tier", () => {
  it("strong on 'I accept the offer'", () => {
    const r = classifyAcceptance("I accept the offer.");
    expect(r.accepted).toBe(true);
    expect(r.confidence).toBe("strong");
    expect(r.reasons).toContain("performative-verb");
  });

  it("strong on 'I would like to accept'", () => {
    expect(classifyAcceptance("I would like to accept your offer.").confidence).toBe("strong");
  });

  it("strong on 'completely agree'", () => {
    expect(classifyAcceptance("I completely agree with the offer.").confidence).toBe("strong");
  });

  /* Adversarial sweep (2026-06-19) — terse candidates prefix the bare verb
   * with an affirmative (no punctuation) or append a bare object. Before the
   * fix these returned no-match → NO-CLOSE on an unambiguous acceptance. */
  it.each([
    "yes accept",
    "ok accept",
    "yeah accept",
    "okay accept",
    "yes accept it",
    "yep accept it",
    "alright accept the offer",
  ])("strong on terse affirmative+verb %j", (utter) => {
    const r = classifyAcceptance(utter, { offerOnTable: true });
    expect(r.accepted, `should accept: ${utter}`).toBe(true);
    expect(r.reasons).toContain("performative-verb");
  });

  /* Negation / conditional vetoes still run BEFORE the bare-accept arm, so the
   * affirmative-prefix extension must NOT swallow declines or hedges. */
  it.each([
    "no, I won't accept",
    "I can't accept it",
    "I'd accept it if you can add equity",
  ])("does NOT accept negated/conditional %j", (utter) => {
    expect(classifyAcceptance(utter, { offerOnTable: true }).accepted).toBe(false);
  });
});

describe("classifyAcceptance — soft alignment tier", () => {
  it("medium on 'I like the offer'", () => {
    const r = classifyAcceptance("Yes, I like the initial offer. Can you give me a breakdown?");
    expect(r.accepted).toBe(true);
    expect(r.confidence).toBe("medium");
  });

  it("medium on 'aligned with the offer'", () => {
    expect(classifyAcceptance("I'm aligned with your offer.").confidence).toBe("medium");
  });
});

describe("classifyAcceptance — commitment idiom + phase gate", () => {
  it("accepts 'Sounds good' when offer is on table", () => {
    const r = classifyAcceptance("Sounds good, let's go ahead.", { offerOnTable: true });
    expect(r.accepted).toBe(true);
  });

  it("VETOES 'Sounds good' when offer NOT on table (phase gate)", () => {
    /* Structural fix: you can't accept what hasn't been quantified.
       Without an offer on the table, "sounds good" is conversational
       filler, not acceptance. */
    const r = classifyAcceptance("Sounds good, let's go ahead.", { offerOnTable: false });
    expect(r.accepted).toBe(false);
    expect(r.reasons).toContain("phase-gate-no-offer-veto");
  });

  it("accepts commitment idiom with offer reference even when phase gate is false", () => {
    /* The offer reference inside the message overrides the gate —
       the candidate explicitly named the offered package. */
    const r = classifyAcceptance("The offer works for me.", { offerOnTable: false });
    expect(r.accepted).toBe(true);
  });

  it("accepts commitment idiom in back-compat mode (no context)", () => {
    /* Legacy whole-transcript callers don't have phase context.
       Gate skipped; behavior matches pre-Phase-9 path. */
    expect(classifyAcceptance("Sounds good, let's go ahead.").accepted).toBe(true);
  });

  it("accepts deal-CLOSE idioms when offer on table (live-staging 2026-06-19)", () => {
    /* "Let's close it" / "close the deal" is a finalize-the-deal commit,
       NOT a request to end the call. Live bug: the bot shipped a defer
       message and walked over an explicit acceptance. */
    expect(classifyAcceptance("Yes, 40 works. Let's close it.", { offerOnTable: true }).accepted).toBe(true);
    expect(classifyAcceptance("Let's close it.", { offerOnTable: true }).accepted).toBe(true);
    expect(classifyAcceptance("let's close the deal", { offerOnTable: true }).accepted).toBe(true);
    expect(classifyAcceptance("close the deal", { offerOnTable: true }).accepted).toBe(true);
  });

  it("VETOES bare 'let's close it' before any offer (phase gate)", () => {
    /* You can't close a deal that doesn't exist yet — pre-offer filler. */
    const r = classifyAcceptance("let's close it", { offerOnTable: false });
    expect(r.accepted).toBe(false);
    expect(r.reasons).toContain("phase-gate-no-offer-veto");
  });
});

describe("classifyAcceptance — Hindi-mix", () => {
  it("accepts 'theek hai' with offer reference", () => {
    expect(classifyAcceptance("Theek hai, the offer works.").accepted).toBe(true);
  });

  it("vetoes 'theek hai' alone when no offer on table", () => {
    expect(classifyAcceptance("Theek hai.", { offerOnTable: false }).accepted).toBe(false);
  });
});

describe("classifyAcceptance — Session 12 split-clause regression (2026-05-14)", () => {
  /* Candidate said: "I'll join the company. Can you let me know all the
     benefits of the oral CTC?" The trailing interrogative masked the
     commit verb from whole-utterance scans, the kernel never reached
     `accepted`, and benefits disclosure was gated off. Split-clause
     pass tokenizes by sentence boundary and treats acceptance + info
     question as accepted-with-follow-up. */

  it("accepts 'I'll join the company. Can you let me know all the benefits of the oral CTC?'", () => {
    const r = classifyAcceptance(
      "I'll join the company. Can you let me know all the benefits of the oral CTC?",
    );
    expect(r.accepted).toBe(true);
    expect(r.hasFollowUpQuestion).toBe(true);
  });

  it("accepts 'I accept. What about variable components?'", () => {
    const r = classifyAcceptance("I accept. What about variable components?");
    expect(r.accepted).toBe(true);
    expect(r.hasFollowUpQuestion).toBe(true);
  });

  it("accepts 'sounds good, I'll take it. Can you share the joining date?'", () => {
    const r = classifyAcceptance(
      "sounds good, I'll take it. Can you share the joining date?",
    );
    expect(r.accepted).toBe(true);
    expect(r.hasFollowUpQuestion).toBe(true);
  });

  it("does NOT accept a pure follow-up question with no acceptance verb", () => {
    const r = classifyAcceptance("Can you tell me about benefits?");
    expect(r.accepted).toBe(false);
  });

  it("accepts pure acceptance without a follow-up question", () => {
    const r = classifyAcceptance("I'll join the company.");
    expect(r.accepted).toBe(true);
    expect(r.hasFollowUpQuestion).toBe(false);
  });

  it("does NOT accept 'I won't join. Can you do better?' (negation)", () => {
    const r = classifyAcceptance("I won't join. Can you do better?");
    expect(r.accepted).toBe(false);
  });

  it("does NOT accept 'not yet, can I get more time?'", () => {
    const r = classifyAcceptance("not yet, can I get more time?");
    expect(r.accepted).toBe(false);
  });
});

describe("classifyAcceptance — Accenture regression (Phase 9)", () => {
  it("does NOT accept 'It okay. Let's get started.' even with no context", () => {
    /* Real session capture (2026-05-13): candidate said this at turn 1.
       Kernel jumped to `accepted` and ignored a subsequent explicit
       counter. The weak-affirmative-only veto blocks this regardless
       of whether the caller provides offerOnTable. */
    expect(classifyAcceptance("It okay. Let's get started.").accepted).toBe(false);
    expect(classifyAcceptance("It okay. Let's get started.", { offerOnTable: true }).accepted).toBe(false);
    expect(classifyAcceptance("It okay. Let's get started.", { offerOnTable: false }).accepted).toBe(false);
  });
});

describe("classifyAcceptance — Audit Pass 2 Fix D: curly-quote normalization", () => {
  /* iOS / macOS auto-correct rewrites apostrophes to U+2019 (right
     single quotation mark) silently. Pre-fix, all acceptance regex
     banks used ASCII `'` exclusively, so "I'll accept" / "I'm in" /
     "let's close" pasted from iOS Notes never matched. The
     normalizeQuotesLocal helper at the entry of classifyAcceptance
     folds curly variants to ASCII before pattern matching. */
  it("accepts \u201CI\u2019ll accept\u201D (curly apostrophe + curly quotes)", () => {
    const r = classifyAcceptance("I\u2019ll accept.", { offerOnTable: true });
    expect(r.accepted).toBe(true);
  });

  it("accepts \u201CI\u2019m in\u201D with curly apostrophe", () => {
    const r = classifyAcceptance("I\u2019m in.", { offerOnTable: true });
    expect(r.accepted).toBe(true);
  });

  it("accepts \u201Clet\u2019s lock it in\u201D with curly apostrophe", () => {
    const r = classifyAcceptance("Let\u2019s lock it in.", { offerOnTable: true });
    expect(r.accepted).toBe(true);
  });
});

describe("classifyAcceptance — OA-B68 deictic-noun-phrase accept over standing offer", () => {
  /* A candidate accepts by pointing at the recruiter's own last figure — "I'll
     take that number", "I accept that figure", "let's go with that amount",
     "that number works". The take/accept arms recognised only "it"/"the offer"
     as the accept OBJECT, and the propositional-veto's bare "accept that …" arm
     even mis-vetoed "I accept that offer" as accepting a proposition — so a
     clear acceptance was re-countered (NO-CLOSE). Gated post-offer. */
  const opt = { offerOnTable: true, highestOfferMade: 35 };

  for (const u of [
    "I'll take that number",
    "I accept that number",
    "I accept that figure",
    "let's go with that amount",
    "that number works",
    "I accept that offer", // pre-existing false-veto in the propositional guard
  ]) {
    it(`accepts deictic close: "${u}"`, () => {
      expect(classifyAcceptance(u, opt).accepted).toBe(true);
    });
  }

  it("still vetoes a propositional 'accept that <clause>' concession", () => {
    expect(classifyAcceptance("I accept that the company is good but the number is low", opt).accepted).toBe(false);
    expect(classifyAcceptance("I accept that budget is tight", opt).accepted).toBe(false);
    expect(classifyAcceptance("I accept that number is low", opt).accepted).toBe(false);
  });

  it("does NOT close a match REQUEST (a question, not consent)", () => {
    expect(classifyAcceptance("can you match what you mentioned earlier?", opt).accepted).toBe(false);
  });
});
