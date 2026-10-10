import { describe, it, expect } from "vitest";
import {
  TIER_LIMITS,
  emailDomain,
  isFreeMailDomain,
  websiteHost,
  isEmployerTier,
  deriveEmployerTier,
  tierAtLeast,
  isSuspended,
  shouldAutoSuspend,
  AUTO_SUSPEND_REPORT_THRESHOLD,
  maskedCandidateName,
} from "../../server-handlers/_employer-trust";

describe("emailDomain / isFreeMailDomain / websiteHost", () => {
  it("extracts and lowercases the domain", () => {
    expect(emailDomain("Jane@Acme.CO.in")).toBe("acme.co.in");
    expect(emailDomain("nope")).toBe("");
    expect(emailDomain(null)).toBe("");
  });
  it("flags free-mail and disposable domains", () => {
    expect(isFreeMailDomain("gmail.com")).toBe(true);
    expect(isFreeMailDomain(" Yahoo.in ")).toBe(true);
    expect(isFreeMailDomain("mailinator.com")).toBe(true);
    expect(isFreeMailDomain("acme.com")).toBe(false);
  });
  it("normalises website hosts", () => {
    expect(websiteHost("https://www.acme.co.in/careers")).toBe("acme.co.in");
    expect(websiteHost("acme.com")).toBe("acme.com");
    expect(websiteHost("")).toBe("");
    expect(websiteHost(undefined)).toBe("");
  });
});

describe("deriveEmployerTier", () => {
  const base = { storedTier: "basic", email: null, emailConfirmed: false, website: null };

  it("stays basic for free-mail even when confirmed", () => {
    expect(deriveEmployerTier({ ...base, email: "x@gmail.com", emailConfirmed: true })).toBe("basic");
  });
  it("stays basic when the company email is unconfirmed", () => {
    expect(deriveEmployerTier({ ...base, email: "x@acme.com", emailConfirmed: false })).toBe("basic");
  });
  it("is email_verified for a confirmed company domain with no matching website", () => {
    expect(deriveEmployerTier({ ...base, email: "x@acme.com", emailConfirmed: true })).toBe("email_verified");
    expect(deriveEmployerTier({ ...base, email: "x@acme.com", emailConfirmed: true, website: "https://other.com" })).toBe("email_verified");
  });
  it("is verified when the email domain matches the website (incl. subdomains)", () => {
    expect(deriveEmployerTier({ ...base, email: "x@acme.com", emailConfirmed: true, website: "https://www.acme.com" })).toBe("verified");
    expect(deriveEmployerTier({ ...base, email: "x@acme.com", emailConfirmed: true, website: "careers.acme.com" })).toBe("verified");
  });
  it("never lowers a stored tier", () => {
    expect(deriveEmployerTier({ ...base, storedTier: "verified", email: "x@gmail.com", emailConfirmed: true })).toBe("verified");
    expect(deriveEmployerTier({ ...base, storedTier: "email_verified" })).toBe("email_verified");
  });
  it("treats an unknown stored tier as basic", () => {
    expect(deriveEmployerTier({ ...base, storedTier: "platinum" })).toBe("basic");
    expect(isEmployerTier("platinum")).toBe(false);
    expect(isEmployerTier("verified")).toBe(true);
  });
  it("does not let a lookalike suffix domain pass", () => {
    expect(deriveEmployerTier({ ...base, email: "x@evilacme.com", emailConfirmed: true, website: "https://acme.com" })).toBe("email_verified");
  });
});

describe("tier limits and ordering", () => {
  it("limits grow with tier", () => {
    expect(TIER_LIMITS.basic.unlocksPerDay).toBeLessThan(TIER_LIMITS.email_verified.unlocksPerDay);
    expect(TIER_LIMITS.email_verified.unlocksPerDay).toBeLessThan(TIER_LIMITS.verified.unlocksPerDay);
    expect(TIER_LIMITS.basic.openRequirements).toBeLessThan(TIER_LIMITS.verified.openRequirements);
  });
  it("tierAtLeast compares ranks", () => {
    expect(tierAtLeast("verified", "email_verified")).toBe(true);
    expect(tierAtLeast("basic", "email_verified")).toBe(false);
    expect(tierAtLeast("basic", "basic")).toBe(true);
  });
});

describe("suspension", () => {
  it("detects suspended employers", () => {
    expect(isSuspended({ suspended_at: "2026-10-01T00:00:00Z" })).toBe(true);
    expect(isSuspended({ suspended_at: null })).toBe(false);
    expect(isSuspended(null)).toBe(false);
  });
  it("auto-suspends at the report threshold", () => {
    expect(shouldAutoSuspend(AUTO_SUSPEND_REPORT_THRESHOLD - 1)).toBe(false);
    expect(shouldAutoSuspend(AUTO_SUSPEND_REPORT_THRESHOLD)).toBe(true);
  });
});

describe("maskedCandidateName", () => {
  it("uses the first six characters of the match id", () => {
    expect(maskedCandidateName("abcdef12-3456")).toBe("Candidate #abcdef");
  });
});
