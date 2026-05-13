import { describe, it, expect } from "vitest";
import {
  extractRetentionCounter,
  mergeRetentionCounter,
  EMPTY_RETENTION_COUNTER,
} from "../../server-handlers/_retention-counter";

describe("extractRetentionCounter — trigger detection", () => {
  it("detects 'retention offer'", () => {
    expect(extractRetentionCounter("My current company gave me a retention offer of ₹35L.").hasAny).toBe(true);
  });

  it("detects 'counter-offer from current'", () => {
    expect(extractRetentionCounter("I got a counter-offer from my current employer.").hasAny).toBe(true);
  });

  it("detects 'current employer is matching'", () => {
    expect(extractRetentionCounter("Current employer is matching my new offer.").hasAny).toBe(true);
  });

  it("detects 'asked me to stay'", () => {
    expect(extractRetentionCounter("They asked me to stay with a bump.").hasAny).toBe(true);
  });

  it("returns empty when no retention context", () => {
    expect(extractRetentionCounter("I'm looking at 28 LPA.").hasAny).toBe(false);
  });
});

describe("extractRetentionCounter — amount", () => {
  it("parses 'retention bonus of 35 LPA'", () => {
    expect(extractRetentionCounter("retention bonus of 35 LPA").amountLpa).toBe(35);
  });

  it("parses 'matching 40L'", () => {
    expect(extractRetentionCounter("current employer matching 40L").amountLpa).toBe(40);
  });

  it("amount null when not stated", () => {
    expect(extractRetentionCounter("they're trying to retain me").amountLpa).toBeNull();
  });
});

describe("extractRetentionCounter — declined", () => {
  it("detects 'declined the retention'", () => {
    const r = extractRetentionCounter("They offered a retention bonus but I declined the retention.");
    expect(r.declined).toBe(true);
  });

  it("detects 'turned down the counter'", () => {
    const r = extractRetentionCounter("current employer counter-offering, I turned down the counter");
    expect(r.declined).toBe(true);
  });

  it("false when not declined", () => {
    const r = extractRetentionCounter("retention offer of 35L on the table");
    expect(r.declined).toBe(false);
  });
});

describe("mergeRetentionCounter", () => {
  it("amount last-stated-wins", () => {
    const prior = extractRetentionCounter("retention offer of 30L");
    const next = extractRetentionCounter("retention offer revised to 35L");
    expect(mergeRetentionCounter(prior, next).amountLpa).toBe(35);
  });

  it("declined monotone-up", () => {
    const prior = extractRetentionCounter("retention offer of 30L, declined the retention");
    const next = extractRetentionCounter("still in conversations");
    expect(mergeRetentionCounter(prior, next).declined).toBe(true);
  });

  it("hasAny monotone-up", () => {
    const prior = extractRetentionCounter("retention offer of 30L");
    const next = extractRetentionCounter("hello");
    expect(mergeRetentionCounter(prior, next).hasAny).toBe(true);
  });

  it("handles null prior", () => {
    const next = extractRetentionCounter("retention offer of 30L");
    expect(mergeRetentionCounter(null, next).amountLpa).toBe(30);
  });

  it("EMPTY constant", () => {
    expect(EMPTY_RETENTION_COUNTER).toEqual({ amountLpa: null, declined: false, hasAny: false });
  });
});
