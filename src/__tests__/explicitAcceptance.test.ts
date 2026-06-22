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
