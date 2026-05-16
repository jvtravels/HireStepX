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
