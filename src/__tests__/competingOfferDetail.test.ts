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
