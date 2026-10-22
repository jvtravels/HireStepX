import { describe, it, expect } from "vitest";
import {
  TIER_LIMITS,
  emailDomain,
  isFreeMailDomain,
  isDisposableMailDomain,
  FREE_MAIL_DOMAINS,
  DISPOSABLE_MAIL_DOMAINS,
  websiteHost,
  isEmployerTier,
  deriveEmployerTier,
  tierAtLeast,
  isSuspended,
  isDeletionPending,
  DELETION_PENDING_REASON,
  shouldAutoSuspend,
  AUTO_SUSPEND_REPORT_THRESHOLD,
  maskedCandidateName,
  registrableDomain,
  isPublicSuffixHost,
  isAcceptableCompanyWebsite,
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

describe("free-mail list (shared by the server gate and the onboarding pre-check)", () => {
  it.each([
    "rediff.com", "rediffmail.com", "outlook.in", "zohomail.in", "zoho.com", "yandex.com", "proton.me",
    "protonmail.com", "gmx.com", "mail.com", "icloud.com", "me.com", "live.in", "hotmail.co.in",
    "yahoo.in", "yahoo.co.in", "ymail.com", "aol.com", "inbox.com", "sify.com", "bol-online.in",
  ])("treats %s as free mail", (domain) => {
    expect(isFreeMailDomain(domain)).toBe(true);
  });
  it("does not flag company domains", () => {
    expect(isFreeMailDomain("acme.com")).toBe(false);
    expect(isFreeMailDomain("gmail.acme.com")).toBe(false);
  });
});

describe("deletion-pending marker", () => {
  it("is a suspension carrying the deletion reason", () => {
    expect(isDeletionPending({ suspended_at: "2026-10-01T00:00:00Z", suspended_reason: DELETION_PENDING_REASON })).toBe(true);
  });
  it("is not set for an admin suspension or an active account", () => {
    expect(isDeletionPending({ suspended_at: "2026-10-01T00:00:00Z", suspended_reason: "reported by 3 candidates" })).toBe(false);
    expect(isDeletionPending({ suspended_at: null, suspended_reason: DELETION_PENDING_REASON })).toBe(false);
    expect(isDeletionPending(null)).toBe(false);
  });
});

describe("expanded free-mail and disposable lists", () => {
  const addedFree = [
    "hey.com", "duck.com", "web.de", "mail.ru", "qq.com", "163.com", "126.com", "airtel.in", "rediffmail.com",
    "outlook.co.uk", "outlook.com.au", "outlook.fr", "outlook.de", "hotmail.co.uk", "hotmail.com.au", "hotmail.fr", "hotmail.de",
    "live.co.uk", "live.com.au", "live.fr", "live.de", "yahoo.fr", "yahoo.de", "yahoo.com.au", "yahoo.com.br", "yahoo.ca", "yahoo.co.jp",
  ];
  const addedDisposable = [
    "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "yopmail.com", "sharklasers.com", "trashmail.com",
    "getnada.com", "maildrop.cc", "throwawaymail.com", "dispostable.com", "fakeinbox.com", "temp-mail.org",
  ];

  it.each(addedFree)("rejects free-mail domain %s", (d) => {
    expect(isFreeMailDomain(d)).toBe(true);
    expect(isDisposableMailDomain(d)).toBe(false);
  });

  it.each(addedDisposable)("rejects disposable domain %s", (d) => {
    expect(isFreeMailDomain(d)).toBe(true);
    expect(isDisposableMailDomain(d)).toBe(true);
  });

  it("never lets a free-mail or disposable address reach email_verified, even with a matching website", () => {
    for (const d of [...addedFree, ...addedDisposable]) {
      expect(deriveEmployerTier({ storedTier: "basic", email: `hr@${d}`, emailConfirmed: true, website: `https://${d}` })).toBe("basic");
    }
  });

  it("accepts plausible company domains", () => {
    for (const d of ["acme.com", "acme.co.in", "hirestepx.com", "tcs.com", "startup.io", "mail.acme.com"]) {
      expect(isFreeMailDomain(d)).toBe(false);
    }
    expect(deriveEmployerTier({ storedTier: "basic", email: "hr@acme.co.in", emailConfirmed: true, website: "acme.co.in" })).toBe("verified");
  });

  it("keeps the two lists disjoint and lowercase", () => {
    for (const d of DISPOSABLE_MAIL_DOMAINS) expect(FREE_MAIL_DOMAINS.has(d)).toBe(false);
    for (const d of [...FREE_MAIL_DOMAINS, ...DISPOSABLE_MAIL_DOMAINS]) expect(d).toBe(d.toLowerCase());
  });
});

describe("verified tier needs an exact registrable-domain match", () => {
  const base = { storedTier: "basic", emailConfirmed: true };
  it("does not verify x@acme.co.in against a website that is just the public suffix co.in", () => {
    expect(deriveEmployerTier({ ...base, email: "x@acme.co.in", website: "co.in" })).toBe("email_verified");
    expect(deriveEmployerTier({ ...base, email: "x@acme.co.in", website: "https://www.co.in/" })).toBe("email_verified");
    expect(deriveEmployerTier({ ...base, email: "x@acme.com", website: "com" })).toBe("email_verified");
  });
  it("verifies acme.co.in against acme.co.in", () => {
    expect(deriveEmployerTier({ ...base, email: "x@acme.co.in", website: "https://acme.co.in" })).toBe("verified");
  });
  it("verifies a subdomain mail host against the apex website, and the reverse", () => {
    expect(deriveEmployerTier({ ...base, email: "x@mail.acme.com", website: "acme.com" })).toBe("verified");
    expect(deriveEmployerTier({ ...base, email: "x@acme.com", website: "https://careers.acme.com/jobs" })).toBe("verified");
  });
  it("rejects lookalike and sibling domains", () => {
    expect(deriveEmployerTier({ ...base, email: "x@evilacme.com", website: "acme.com" })).toBe("email_verified");
    expect(deriveEmployerTier({ ...base, email: "x@acme.com", website: "acme.com.evil.io" })).toBe("email_verified");
    expect(deriveEmployerTier({ ...base, email: "x@foo.co.in", website: "bar.co.in" })).toBe("email_verified");
  });
  it("does not let a shared hosting suffix prove a company", () => {
    expect(deriveEmployerTier({ ...base, email: "x@vercel.app", website: "vercel.app" })).toBe("email_verified");
    expect(deriveEmployerTier({ ...base, email: "x@evil.github.io", website: "good.github.io" })).toBe("email_verified");
  });
  it("never verifies on a free-mail or disposable website", () => {
    expect(deriveEmployerTier({ ...base, email: "x@gmail.com", website: "gmail.com" })).toBe("basic");
    expect(deriveEmployerTier({ ...base, email: "x@acme.com", website: "mailinator.com" })).toBe("email_verified");
  });
});

describe("registrableDomain / isPublicSuffixHost / isAcceptableCompanyWebsite", () => {
  it("resolves multi-label suffixes", () => {
    expect(registrableDomain("mail.acme.co.in")).toBe("acme.co.in");
    expect(registrableDomain("acme.com")).toBe("acme.com");
    expect(registrableDomain("a.b.acme.co.uk")).toBe("acme.co.uk");
    expect(registrableDomain("acme.vercel.app")).toBe("acme.vercel.app");
  });
  it("returns empty for suffixes, IPs and blanks", () => {
    for (const h of ["co.in", "org.in", "ac.in", "gov.in", "nic.in", "edu.in", "net.in", "com", "co.uk", "", "10.0.0.1", "localhost"]) {
      expect(registrableDomain(h), h).toBe("");
    }
    expect(isPublicSuffixHost("co.in")).toBe(true);
    expect(isPublicSuffixHost("acme.co.in")).toBe(false);
  });
  it("accepts real websites and rejects bare suffixes", () => {
    expect(isAcceptableCompanyWebsite("https://www.acme.co.in/careers")).toBe(true);
    expect(isAcceptableCompanyWebsite("co.in")).toBe(false);
    expect(isAcceptableCompanyWebsite("https://com")).toBe(false);
    expect(isAcceptableCompanyWebsite("")).toBe(false);
  });
});

describe("expanded throwaway and Indian free-mail lists", () => {
  it("lists at least 150 disposable domains, all lowercase and well formed", () => {
    expect(DISPOSABLE_MAIL_DOMAINS.size).toBeGreaterThanOrEqual(150);
    for (const d of DISPOSABLE_MAIL_DOMAINS) expect(d, d).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
  });
  it.each(["mailinator.net", "10minutemail.co.uk", "dropmail.me", "emailfake.com", "armyspy.com", "mailsac.com", "tmailor.com", "yopmail.fr"])(
    "treats %s as disposable",
    (d) => {
      expect(isDisposableMailDomain(d)).toBe(true);
      expect(isFreeMailDomain(d)).toBe(true);
    },
  );
  it.each(["rediffmail.com", "in.com", "indiatimes.com", "rediffmail.in"])("treats %s as free mail", (d) => {
    expect(isFreeMailDomain(d)).toBe(true);
  });
  it("keeps free and disposable lists disjoint from real company domains", () => {
    for (const d of ["acme.com", "tcs.com", "infosys.com", "zoho.in"]) expect(isFreeMailDomain(d), d).toBe(false);
  });
});
