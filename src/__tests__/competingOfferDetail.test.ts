import { describe, it, expect } from "vitest";
import {
  extractCompetingOfferDetail,
  mergeCompetingOfferDetail,
} from "../../server-handlers/_competing-offer-detail";

describe("extractCompetingOfferDetail — company", () => {
  it("detects google", () => {
    expect(extractCompetingOfferDetail("offer from Google").company).toBe("google");
  });

  it("detects amazon via 'AWS'", () => {
    expect(extractCompetingOfferDetail("AWS offered me").company).toBe("amazon");
  });

  it("detects flipkart", () => {
    expect(extractCompetingOfferDetail("Flipkart is in the running").company).toBe("flipkart");
  });

  it("detects tcs via 'tata consultancy'", () => {
    expect(extractCompetingOfferDetail("Tata Consultancy gave me an offer").company).toBe("tcs");
  });

  it("returns null when no known brand", () => {
    expect(extractCompetingOfferDetail("offer from a small startup").company).toBe(null);
  });
});

describe("extractCompetingOfferDetail — status", () => {
  it("detects signed", () => {
    expect(extractCompetingOfferDetail("I've signed the offer").status).toBe("signed");
  });

  it("detects letter", () => {
    expect(extractCompetingOfferDetail("I have the offer letter").status).toBe("letter");
  });

  it("detects email", () => {
    expect(extractCompetingOfferDetail("offer on email confirmed").status).toBe("email");
  });

  it("detects verbal", () => {
    expect(extractCompetingOfferDetail("verbally offered last week").status).toBe("verbal");
  });
});

describe("extractCompetingOfferDetail — stage", () => {
  it("detects accepted", () => {
    expect(extractCompetingOfferDetail("I've accepted their offer").stage).toBe("accepted");
  });

  it("detects offered", () => {
    expect(extractCompetingOfferDetail("I have an offer in hand").stage).toBe("offered");
  });

  it("detects interviewing", () => {
    expect(extractCompetingOfferDetail("interviewing with Google").stage).toBe("interviewing");
  });
});

describe("extractCompetingOfferDetail — letterShareOffered", () => {
  it("detects 'happy to share'", () => {
    expect(extractCompetingOfferDetail("happy to share the letter").letterShareOffered).toBe(true);
  });

  it("detects 'will forward the offer'", () => {
    expect(extractCompetingOfferDetail("will forward the offer").letterShareOffered).toBe(true);
  });

  it("false when not mentioned", () => {
    expect(extractCompetingOfferDetail("hello").letterShareOffered).toBe(false);
  });
});

describe("extractCompetingOfferDetail — hasAny", () => {
  it("false on empty", () => {
    expect(extractCompetingOfferDetail("").hasAny).toBe(false);
  });

  it("true when any field set", () => {
    expect(extractCompetingOfferDetail("offer from Google").hasAny).toBe(true);
  });
});

describe("mergeCompetingOfferDetail", () => {
  it("non-null overrides prior", () => {
    const prior = extractCompetingOfferDetail("offer from Google");
    const next = extractCompetingOfferDetail("offer from Amazon");
    expect(mergeCompetingOfferDetail(prior, next).company).toBe("amazon");
  });

  it("null preserves prior", () => {
    const prior = extractCompetingOfferDetail("offer from Google");
    const next = extractCompetingOfferDetail("I have the offer letter");
    const m = mergeCompetingOfferDetail(prior, next);
    expect(m.company).toBe("google");
    expect(m.status).toBe("letter");
  });

  it("letterShareOffered monotone-up", () => {
    const prior = extractCompetingOfferDetail("happy to share the letter");
    const next = extractCompetingOfferDetail("hello");
    expect(mergeCompetingOfferDetail(prior, next).letterShareOffered).toBe(true);
  });

  it("handles null prior", () => {
    const next = extractCompetingOfferDetail("offer from Google");
    expect(mergeCompetingOfferDetail(null, next).company).toBe("google");
  });
});

describe("Phase 27 — competing-offer onHold detection", () => {
  it("detects 'joining is on hold'", () => {
    expect(extractCompetingOfferDetail("My joining is on hold at Flipkart.").onHold).toBe(true);
  });

  it("detects 'offer rescinded'", () => {
    expect(extractCompetingOfferDetail("They rescinded the offer after the hiring freeze.").onHold).toBe(true);
  });

  it("detects 'BGV is pending'", () => {
    expect(extractCompetingOfferDetail("BGV is pending, joining delayed").onHold).toBe(true);
  });

  it("detects 'joining frozen'", () => {
    expect(extractCompetingOfferDetail("joining is frozen until Q3").onHold).toBe(true);
  });

  it("false when not mentioned", () => {
    expect(extractCompetingOfferDetail("I have a great offer from Google").onHold).toBe(false);
  });

  it("merge: onHold is monotone-up", () => {
    const prior = extractCompetingOfferDetail("joining is on hold");
    const next = extractCompetingOfferDetail("hello");
    expect(mergeCompetingOfferDetail(prior, next).onHold).toBe(true);
  });

  it("hasAny true when only onHold fires", () => {
    expect(extractCompetingOfferDetail("joining is on hold").hasAny).toBe(true);
  });
});

/* Crack 2 (2026-05-17) — hasConcreteTell() now reads the ACCUMULATED
 * CompetingOfferDetail rather than single-utterance extraction. Real
 * candidates dribble: company at T14, amount at T16, status at T18.
 * The mergeCompetingOfferDetail folder accumulates each piece across
 * turns; proofProvided flips to true once all three are present in the
 * merged record. proofProvided=true sticky still blocks
 * fake-leverage-challenge regardless. */
describe("hasConcreteTell — accumulated proofProvided across turns", () => {
  it("all three in one utterance → proofProvided=true (existing behavior preserved)", () => {
    const detail = extractCompetingOfferDetail(
      "I have an offer letter from Razorpay at 30 LPA",
    );
    const merged = mergeCompetingOfferDetail(null, detail);
    expect(merged.company).toBe("razorpay");
    expect(merged.status).toBe("letter");
    expect(merged.amount).toBe(30);
    expect(merged.proofProvided).toBe(true);
  });

  it("dribbled across 3 turns (company → amount → status) → proofProvided=true", () => {
    const t1 = extractCompetingOfferDetail("I'm in conversations with Razorpay");
    const m1 = mergeCompetingOfferDetail(null, t1);
    expect(m1.company).toBe("razorpay");
    expect(m1.proofProvided).toBe(false);

    const t2 = extractCompetingOfferDetail("the number being discussed is around 32 LPA");
    const m2 = mergeCompetingOfferDetail(m1, t2);
    expect(m2.company).toBe("razorpay");
    expect(m2.amount).toBe(32);
    expect(m2.proofProvided).toBe(false);

    const t3 = extractCompetingOfferDetail("I have the offer letter in hand now");
    const m3 = mergeCompetingOfferDetail(m2, t3);
    expect(m3.company).toBe("razorpay");
    expect(m3.amount).toBe(32);
    expect(m3.status).toBe("letter");
    expect(m3.proofProvided).toBe(true);
  });

  it("only two of three accumulated (company + amount, no status) → proofProvided=false", () => {
    const t1 = extractCompetingOfferDetail("I'm talking to Flipkart");
    const m1 = mergeCompetingOfferDetail(null, t1);
    const t2 = extractCompetingOfferDetail("they mentioned 28 LPA");
    const m2 = mergeCompetingOfferDetail(m1, t2);
    expect(m2.company).toBe("flipkart");
    expect(m2.amount).toBe(28);
    expect(m2.status).toBe(null);
    expect(m2.proofProvided).toBe(false);
  });

  it("proofProvided is sticky once true (further utterances don't undo it)", () => {
    const t1 = extractCompetingOfferDetail(
      "verbal offer from Swiggy at 25 LPA",
    );
    const m1 = mergeCompetingOfferDetail(null, t1);
    expect(m1.proofProvided).toBe(true);
    const t2 = extractCompetingOfferDetail("anyway, how about your offer?");
    const m2 = mergeCompetingOfferDetail(m1, t2);
    expect(m2.proofProvided).toBe(true);
  });

  it("amount extraction: crore form is normalised to LPA (×100)", () => {
    const detail = extractCompetingOfferDetail("the offer is 1.2 crore from Google");
    expect(detail.amount).toBe(120);
  });

  it("amount extraction: 'lakhs' form recognised", () => {
    const detail = extractCompetingOfferDetail("they offered 24 lakhs verbally");
    expect(detail.amount).toBe(24);
  });

  it("amount is last-stated-wins on merge (candidate revises number)", () => {
    const m1 = mergeCompetingOfferDetail(null, extractCompetingOfferDetail("Razorpay offered 28 LPA"));
    const m2 = mergeCompetingOfferDetail(
      m1,
      extractCompetingOfferDetail("actually their offer is 32 LPA, not 28"),
    );
    expect(m2.amount).toBe(32);
  });
});
