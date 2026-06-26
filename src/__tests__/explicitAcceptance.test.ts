import { describe, it, expect } from "vitest";
import {
  detectExplicitAcceptance,
  classifyAcceptance,
} from "../../server-handlers/_acceptance-classifier";

describe("Bug 2: detectExplicitAcceptance — strong signals accept", () => {
  it("accepts 'I accept the offer'", () => {
    expect(detectExplicitAcceptance("I accept the offer").accepted).toBe(true);
  });
  it("accepts 'yes I'm accepting'", () => {
    expect(detectExplicitAcceptance("yes I'm accepting").accepted).toBe(true);
  });
  it("accepts 'please send the offer letter'", () => {
    expect(detectExplicitAcceptance("please send the offer letter").accepted).toBe(true);
  });
  it("accepts \"I'm in\"", () => {
    expect(detectExplicitAcceptance("I'm in").accepted).toBe(true);
  });
  it("accepts \"let's move forward with this number\"", () => {
    expect(detectExplicitAcceptance("let's move forward with this number").accepted).toBe(true);
  });
});

describe("Bug 2: detectExplicitAcceptance — hedged signals do NOT accept", () => {
  it("rejects 'sounds good'", () => {
    expect(detectExplicitAcceptance("sounds good").accepted).toBe(false);
  });
  it("rejects 'thank you for clarifying'", () => {
    expect(detectExplicitAcceptance("thank you for clarifying that").accepted).toBe(false);
  });
  it("rejects 'I appreciate'", () => {
    expect(detectExplicitAcceptance("I appreciate the offer").accepted).toBe(false);
  });
  it("rejects \"I'd be comfortable moving forward IF...\"", () => {
    expect(detectExplicitAcceptance("I'd be comfortable moving forward if you can do 30L").accepted).toBe(false);
  });
  it("rejects 'let me think about it'", () => {
    expect(detectExplicitAcceptance("let me think about it").accepted).toBe(false);
  });
  it("rejects empty/null", () => {
    expect(detectExplicitAcceptance("").accepted).toBe(false);
    expect(detectExplicitAcceptance(null).accepted).toBe(false);
  });
});

/* Explicit deal-close commitment idioms (live-staging 2026-06-19).
 * "Yes, let's close it." / "I said yes, let's close." were only reaching
 * the medium-confidence commitment-idiom path, so the kernel's soft-accept
 * trailing-non-counter / min-turns gate blocked the close and the bot kept
 * negotiating over an explicit acceptance (offer ₹35.2L below target ₹36L,
 * candidate said "let's close it" twice, bot replied "let me check with
 * leadership" both times). Promoting them to STRICT makes them behave
 * identically to "let's move forward with this offer" — canCloseSession
 * passes unconditionally on reason="accept", so the deal closes.
 * Guard the deal-close sense (strict) WITHOUT swallowing the negotiation
 * move "close the gap" or the conversational "close this call". */
describe("detectExplicitAcceptance — explicit deal-close commitment idioms", () => {
  it("accepts the live-reproduced close commitments", () => {
    for (const p of [
      "That works. Yes, let's close it.",
      "I said yes, let's close.",
      "Yes, 40 works. Let's close it.",
      "Let's close the deal.",
      "Let's close this.",
      "Let's finalize it.",
      "Let's finalize.",
      "Okay let's lock it in.",
      "Great, close it out.",
    ]) {
      expect(detectExplicitAcceptance(p).accepted, `expected accept: ${p}`).toBe(true);
    }
  });

  it("does NOT accept the negotiation move 'close the gap'", () => {
    expect(detectExplicitAcceptance("Let's close the gap.").accepted).toBe(false);
    expect(detectExplicitAcceptance("Can we close the gap a bit?").accepted).toBe(false);
  });

  it("does NOT accept the conversational 'close this call/interview' forms", () => {
    expect(detectExplicitAcceptance("Let's close this call.").accepted).toBe(false);
    expect(detectExplicitAcceptance("Can we close this interview?").accepted).toBe(false);
    expect(detectExplicitAcceptance("Let's close this conversation.").accepted).toBe(false);
  });

  it("does NOT accept a conditional close (hedge veto)", () => {
    expect(detectExplicitAcceptance("Let's close it if you can match 40.").accepted).toBe(false);
  });
});

/* PRI-56 (2026-06-22, offline hostile sweep S2/S4) — terse spoken close-consent
 * idioms the strict gate missed, so the kernel routed them to the soft-accept
 * path whose trailing-non-counter / min-turns gate DROPPED the close: the bot
 * kept countering / piling levers over an unambiguous acceptance ("deal, 40
 * works", "whatever you just said works", "yes send it", "yes confirmed").
 * Promoted to STRICT (shared CLOSE_CONSENT_IDIOM_PATTERNS, single source with
 * the medium-confidence commitment-idiom path), so canCloseSession passes on
 * reason="accept" and the deal closes — identical to the #124 forward-
 * commitment idioms. HEDGE_VETO still runs first; the kernel consults the
 * strict gate ONLY post-offer, so these cannot force a pre-offer close. */
describe("detectExplicitAcceptance — PRI-56 terse close-consent idioms", () => {
  it("accepts the offline-reproduced terse close idioms", () => {
    for (const p of [
      "ok, deal",
      "deal, 40 works",
      "alright deal",
      "ok fine, whatever you just said works",
      "whatever you offered is fine",
      "whatever works for me",
      "yes send it",
      "send it over",
      "send across the offer letter",
      "yes confirmed",
      "confirmed",
      "ok, confirming",
    ]) {
      expect(detectExplicitAcceptance(p).accepted, `expected accept: ${p}`).toBe(true);
    }
  });

  it("does NOT accept the rejection sense 'deal-breaker' / 'no deal'", () => {
    expect(detectExplicitAcceptance("that's a deal-breaker for me").accepted).toBe(false);
    expect(detectExplicitAcceptance("that's a deal breaker").accepted).toBe(false);
  });

  it("does NOT accept the info-probe 'can you confirm the split'", () => {
    expect(detectExplicitAcceptance("can you confirm the split").accepted).toBe(false);
    expect(detectExplicitAcceptance("could you confirm the breakdown").accepted).toBe(false);
  });

  it("does NOT accept a conditional close-consent (hedge veto)", () => {
    expect(detectExplicitAcceptance("deal, if you can do 40").accepted).toBe(false);
    expect(detectExplicitAcceptance("send it over as long as it's 40 fixed").accepted).toBe(false);
  });
});

describe("detectExplicitAcceptance — PRI-63 hostile sweep (FALSE-CLOSE precision + recall)", () => {
  it("does NOT accept 'go ahead and close the GAP/difference' (negotiation push, not consent)", () => {
    for (const p of [
      "go ahead and close the gap",
      "go ahead and close the gap between our numbers",
      "go ahead and close the difference",
    ]) {
      expect(detectExplicitAcceptance(p).accepted, `must NOT accept: ${p}`).toBe(false);
    }
  });

  it("still accepts the bare 'go ahead and close/send/finalise' commit (no spread-noun)", () => {
    for (const p of [
      "go ahead and close it",
      "go ahead and send the offer letter",
      "go ahead and finalise",
    ]) {
      expect(detectExplicitAcceptance(p).accepted, `expected accept: ${p}`).toBe(true);
    }
  });

  it("does NOT accept a close idiom welded to an explicit money rejection", () => {
    for (const p of [
      "deal? not at this number",
      "close it out? no way at 30",
      "ok deal, but not at this comp",
    ]) {
      expect(detectExplicitAcceptance(p).accepted, `must NOT accept: ${p}`).toBe(false);
    }
  });

  it("accepts the recall idioms 'consider it accepted' / 'sign me up'", () => {
    for (const p of [
      "consider it accepted",
      "consider it done",
      "consider it a deal",
      "sign me up",
    ]) {
      expect(detectExplicitAcceptance(p).accepted, `expected accept: ${p}`).toBe(true);
    }
  });

  it("does NOT mistake the think-it-over 'I'll consider it' for a recall idiom", () => {
    expect(detectExplicitAcceptance("I'll consider it").accepted).toBe(false);
    expect(detectExplicitAcceptance("let me consider it over the weekend").accepted).toBe(false);
  });

  it("recall idioms stay deferral-gated", () => {
    expect(detectExplicitAcceptance("sign me up once you fix the base").accepted).toBe(false);
  });
});

describe("PRI-63b — negated settle-token (FALSE-CLOSE) + comma accept-with-number", () => {
  it("does NOT accept a NEGATED settle token (both gates)", () => {
    for (const p of [
      "not done at 45",
      "this is not a deal at 45",
      "I'm not sold",
      "we're not settled",
    ]) {
      expect(detectExplicitAcceptance(p).accepted, `strict must NOT accept: ${p}`).toBe(false);
      expect(
        classifyAcceptance(p, { offerOnTable: true }).accepted,
        `classify must NOT accept: ${p}`,
      ).toBe(false);
    }
  });

  it("still accepts the comma'd accept-with-number 'ok 45, done'", () => {
    for (const p of ["ok 45, done", "45, deal", "fine, 52, sold"]) {
      expect(
        classifyAcceptance(p, { offerOnTable: true }).accepted,
        `expected accept: ${p}`,
      ).toBe(true);
    }
  });

  it("comma variant keeps the clause-terminal guard ('45, done deliberating' is not an accept)", () => {
    expect(classifyAcceptance("45, done deliberating", { offerOnTable: true }).accepted).toBe(false);
  });
});

/* 10/10-plan A1 (2026-06-23) — permanent per-arm guard for the shared
 * CLOSE_CONSENT_IDIOM bank. A silent break in any arm is a FALSE-CLOSE
 * or a missed-close (the two worst failure modes), and a thin-coverage
 * regex edit silently broke a sibling bank (SOFT_ALIGNMENT "we've"). One
 * representative phrase per arm, asserted through BOTH gates, so the
 * single-source bank stays wired to strict-close and medium accept. */
describe("CLOSE_CONSENT_IDIOM — every arm closes through both gates (permanent guard)", () => {
  const onTable = { offerOnTable: true };
  const arms: Array<[string, string]> = [
    ["1 deal", "ok, deal."],
    ["2 whatever-said", "whatever you just said works"],
    ["2 whatever-works", "whatever works"],
    ["3 send-it", "send it over."],
    ["3 send-letter", "send the offer letter"],
    ["4 confirmed", "yes confirmed."],
    ["5 bhej-do-letter", "bhej do offer letter"],
    ["5 letter-bhej-do", "offer letter bhej do"],
    ["6 where-sign", "where do I sign"],
    ["7 count-me-in", "count me in"],
    ["8 got-a-deal", "we've got a deal"],
    ["9 make-official", "let's make it official"],
    ["10 paperwork-going", "let's get the paperwork going"],
    ["10 get-started-letter", "get started with the offer letter"],
    ["11 agreed", "great, agreed."],
    ["12 on-board", "I'm on board."],
    ["12 happy-proceed", "happy to proceed."],
    ["13 consider-accepted", "consider it accepted"],
    ["13 sign-me-up", "sign me up"],
    ["14 n-it-is", "45 it is."],
    ["15 thats-a-yes", "that's a yes from me"],
    ["16 lock-this-in", "lock this in"],
  ];
  for (const [name, phrase] of arms) {
    it(`arm ${name}: "${phrase}" closes via strict + medium`, () => {
      expect(detectExplicitAcceptance(phrase).accepted, `strict: ${phrase}`).toBe(true);
      expect(classifyAcceptance(phrase, onTable).accepted, `medium: ${phrase}`).toBe(true);
    });
  }
});

describe("PRI-63c — 'do it <redirect>' FALSE-CLOSE + recall (it-is/that's-a-yes/lock-this-in)", () => {
  it("does NOT accept 'let's do it <redirect>' (approach change/defer, not consent)", () => {
    for (const p of [
      "let's do it differently",
      "let's do it your way",
      "let's do it another way",
      "let's do it later",
      "let's do it instead",
    ]) {
      expect(detectExplicitAcceptance(p).accepted, `strict must NOT accept: ${p}`).toBe(false);
      expect(
        classifyAcceptance(p, { offerOnTable: true }).accepted,
        `classify must NOT accept: ${p}`,
      ).toBe(false);
    }
  });

  it("still accepts the present-tense 'let's do it' / 'do it now'", () => {
    expect(detectExplicitAcceptance("let's do it").accepted).toBe(true);
    expect(detectExplicitAcceptance("let's do it now").accepted).toBe(true);
  });

  it("accepts the recall idioms '<n> it is' / \"that's a yes\" / 'lock this in'", () => {
    for (const p of ["45 it is", "that's a yes from me", "yeah let's lock this in", "lock that in"]) {
      expect(detectExplicitAcceptance(p).accepted, `expected accept: ${p}`).toBe(true);
    }
  });

  it("'<n> it is' stays clause-terminal — resigned shrug / probe do NOT accept", () => {
    expect(detectExplicitAcceptance("45? it is what it is").accepted).toBe(false);
    expect(detectExplicitAcceptance("is 45 the final number").accepted).toBe(false);
  });

  it("\"that's a yes\" stays conditional/negotiation gated", () => {
    expect(detectExplicitAcceptance("that's a yes only if base hits 40").accepted).toBe(false);
    expect(classifyAcceptance("that's a yes but I want more", { offerOnTable: true }).accepted).toBe(false);
  });

  /* Offline hostile sweep (2026-06-27) — INFLECTED rhetorical rejection. The
   * performative recall bank matches "I'm accepting" (accept + ing), but the
   * rhetorical FALSE-CLOSE veto keyed on a bare `\baccept\b`, which does NOT
   * match "accepting"/"accepted" (no word boundary after the "t"). Result: an
   * outright rejection like "no way I'm accepting that" slipped the veto and
   * FALSE-CLOSED — the single worst failure class (the bot finalizes a deal the
   * candidate is rejecting). The fix keys every rhetorical arm on the same
   * inflected stem `accept(?:s|ing|ed)?`. This locks BOTH gates (the veto is
   * shared single-source between classifyAcceptance and detectExplicitAcceptance)
   * against any future re-introduction of the bare-stem asymmetry. */
  it("rejects INFLECTED rhetorical / impossibility / disbelief rejections (both gates)", () => {
    const REJECT = [
      "no way I'm accepting that",
      "no way I'm accepting this lowball",
      "why would I be accepting this",
      "you really think I'm accepting that",
      "as if I'd be accepting that",
    ];
    for (const p of REJECT) {
      expect(detectExplicitAcceptance(p).accepted, `strict accepted: ${p}`).toBe(false);
      expect(classifyAcceptance(p, { offerOnTable: true }).accepted, `medium accepted: ${p}`).toBe(false);
    }
  });

  it("still accepts a genuine inflected accept (no rhetorical governor)", () => {
    expect(detectExplicitAcceptance("yes, I'm accepting the offer").accepted).toBe(true);
    expect(classifyAcceptance("yes, I'm accepting the offer", { offerOnTable: true }).accepted).toBe(true);
  });
});
