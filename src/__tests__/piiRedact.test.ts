import { describe, it, expect } from "vitest";
import {
  redactPii,
  redactProfilePii,
} from "../../server-handlers/_pii-redact";

describe("redactPii", () => {
  it("redacts email addresses", () => {
    expect(redactPii("Contact me at rahul@example.com today")).toBe(
      "Contact me at [redacted] today",
    );
  });

  it("redacts emails embedded in narrative", () => {
    expect(
      redactPii("Reach Rahul at rahul.sharma@gmail.co.in for details"),
    ).toBe("Reach Rahul at [redacted] for details");
  });

  it("redacts Indian +91 phone numbers", () => {
    expect(redactPii("Call me on +91 98765 43210")).toBe(
      "Call me on [redacted]",
    );
    expect(redactPii("Call me on +91-98765-43210")).toBe(
      "Call me on [redacted]",
    );
  });

  it("redacts bare 10-digit Indian mobile numbers", () => {
    // Starts with 6/7/8/9 — Indian mobile range
    expect(redactPii("Mobile: 9876543210")).toBe("Mobile: [redacted]");
    expect(redactPii("Reach 7012345678 anytime")).toBe(
      "Reach [redacted] anytime",
    );
  });

  it("redacts generic E.164 international numbers", () => {
    expect(redactPii("US line: +1 415 555 0142")).toBe(
      "US line: [redacted]",
    );
  });

  it("redacts Indian PAN numbers", () => {
    expect(redactPii("PAN: ABCDE1234F is on file")).toBe(
      "PAN: [redacted] is on file",
    );
  });

  it("redacts Aadhaar numbers", () => {
    expect(redactPii("Aadhaar 1234 5678 9012 verified")).toBe(
      "Aadhaar [redacted] verified",
    );
    expect(redactPii("Aadhaar 1234-5678-9012 verified")).toBe(
      "Aadhaar [redacted] verified",
    );
  });

  it("redacts US SSN", () => {
    expect(redactPii("SSN: 123-45-6789 confidential")).toBe(
      "SSN: [redacted] confidential",
    );
  });

  it("redacts multiple PII types in one string", () => {
    expect(
      redactPii(
        "Email rahul@gmail.com or call +91 98765 43210 — PAN ABCDE1234F",
      ),
    ).toBe("Email [redacted] or call [redacted] — PAN [redacted]");
  });

  // ─── False-positive guards ───
  // These are the tests that protect narrative quality. If any of
  // these flips to redacting, the redactor is too aggressive and
  // burning legitimate professional content.

  it("does NOT redact metric numbers like '32%' or '$10,000'", () => {
    expect(redactPii("Improved CTR by 32% over 6 months")).toBe(
      "Improved CTR by 32% over 6 months",
    );
    expect(redactPii("Saved the team $10,000 in tooling costs")).toBe(
      "Saved the team $10,000 in tooling costs",
    );
  });

  it("does NOT redact company names or domains in context", () => {
    expect(
      redactPii("Worked at Acme Corp on the platform team"),
    ).toBe("Worked at Acme Corp on the platform team");
  });

  it("does NOT redact years like '2020-2024'", () => {
    expect(redactPii("Senior PM 2020-2024 at Acme")).toBe(
      "Senior PM 2020-2024 at Acme",
    );
  });

  it("does NOT redact short numbers attached to nouns ('5 years', '300 users')", () => {
    expect(redactPii("Led 5 engineers over 3 years building 300 features")).toBe(
      "Led 5 engineers over 3 years building 300 features",
    );
  });

  it("returns input unchanged when nothing matches", () => {
    const clean = "Senior Designer with 8 years building scalable systems";
    expect(redactPii(clean)).toBe(clean);
  });

  it("handles empty / non-string input defensively", () => {
    expect(redactPii("")).toBe("");
    // @ts-expect-error - testing non-string input
    expect(redactPii(null)).toBe(null);
    // @ts-expect-error - testing non-string input
    expect(redactPii(undefined)).toBe(undefined);
  });

  it("is stable across multiple calls (regex state reset)", () => {
    const input = "rahul@gmail.com and rohit@gmail.com";
    // Call twice; both should produce the same result. Stateful
    // global regexes can drift if lastIndex isn't reset.
    expect(redactPii(input)).toBe("[redacted] and [redacted]");
    expect(redactPii(input)).toBe("[redacted] and [redacted]");
  });
});

describe("redactProfilePii", () => {
  it("redacts strings in scalar fields (headline, summary)", () => {
    const out = redactProfilePii({
      headline: "Senior PM, reach at rahul@gmail.com",
      summary: "Led teams; mobile 9876543210",
      yearsExperience: 8,
    });
    expect(out.headline).toBe("Senior PM, reach at [redacted]");
    expect(out.summary).toBe("Led teams; mobile [redacted]");
    expect(out.yearsExperience).toBe(8); // numeric leaf untouched
  });

  it("redacts strings inside string-arrays", () => {
    const out = redactProfilePii({
      improvements: [
        "Add quantified outcomes to bullets",
        "Email rahul@example.com from contact info",
      ],
    });
    expect(out.improvements).toEqual([
      "Add quantified outcomes to bullets",
      "Email [redacted] from contact info",
    ]);
  });

  it("recurses one level into nested objects (e.g. scoreBreakdown)", () => {
    const out = redactProfilePii({
      scoreBreakdown: {
        quantifiedAchievements: 18,
        rationale: "Email shown: rahul@gmail.com",
      },
    });
    const breakdown = out.scoreBreakdown as Record<string, unknown>;
    expect(breakdown.quantifiedAchievements).toBe(18);
    expect(breakdown.rationale).toBe("Email shown: [redacted]");
  });

  it("preserves non-string array members untouched", () => {
    const out = redactProfilePii({ topSkills: ["React", "TypeScript", null, 42] });
    expect(out.topSkills).toEqual(["React", "TypeScript", null, 42]);
  });

  it("is idempotent — running it twice produces the same output", () => {
    const initial = {
      summary: "Reach me at rahul@gmail.com or 9876543210",
      improvements: ["Add metrics", "Trim contact info from rahul@gmail.com"],
    };
    const once = redactProfilePii({ ...initial });
    const twice = redactProfilePii({ ...once });
    expect(twice).toEqual(once);
  });
});
