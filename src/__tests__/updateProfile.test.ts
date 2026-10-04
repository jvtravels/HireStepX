import { describe, it, expect } from "vitest";
import { sanitizeUpdate, ALLOWED_COLUMNS, stampResumeParsedAt, sanitizePortfolioLinks } from "../../server-handlers/update-profile";

/**
 * sanitizeUpdate is the allow-list filter that stands between an
 * authenticated client's PATCH and the profiles table. A regression here
 * means a malicious/buggy client could write columns it shouldn't
 * (subscription_tier, email_verified, session_credits — anything not on
 * the allow-list). These tests pin the boundary.
 */
describe("sanitizeUpdate", () => {
  it("drops non-allowlisted columns", () => {
    const result = sanitizeUpdate({
      name: "Jay",
      subscription_tier: "pro", // not on allow-list
      session_credits: 999,     // not on allow-list
      deleted_at: "2099-01-01", // not on allow-list
    });
    expect(result).toEqual({ name: "Jay" });
    expect("subscription_tier" in result).toBe(false);
    expect("session_credits" in result).toBe(false);
  });

  it("caps resume_text at 50,000 characters", () => {
    const huge = "a".repeat(200_000);
    const result = sanitizeUpdate({ resume_text: huge });
    expect((result.resume_text as string).length).toBe(50_000);
  });

  it("caps resume_file_name at 255 characters", () => {
    const result = sanitizeUpdate({ resume_file_name: "x".repeat(1000) });
    expect((result.resume_file_name as string).length).toBe(255);
  });

  it("caps other string fields at 500 characters", () => {
    const result = sanitizeUpdate({ name: "z".repeat(1000), target_role: "y".repeat(800) });
    expect((result.name as string).length).toBe(500);
    expect((result.target_role as string).length).toBe(500);
  });

  it("preserves arrays, booleans, numbers, nulls, objects", () => {
    const result = sanitizeUpdate({
      practice_timestamps: ["2026-04-01T00:00:00Z", "2026-04-02T00:00:00Z"],
      has_completed_onboarding: true,
      preferred_session_length: 15,
      resume_data: { topSkills: ["a", "b"] },
      interview_types: null,
    });
    expect(result.practice_timestamps).toEqual(["2026-04-01T00:00:00Z", "2026-04-02T00:00:00Z"]);
    expect(result.has_completed_onboarding).toBe(true);
    expect(result.preferred_session_length).toBe(15);
    expect(result.resume_data).toEqual({ topSkills: ["a", "b"] });
    expect(result.interview_types).toBe(null);
  });

  it("rejects non-object input", () => {
    expect(sanitizeUpdate(null)).toEqual({});
    expect(sanitizeUpdate(undefined)).toEqual({});
    expect(sanitizeUpdate("malicious string")).toEqual({});
    expect(sanitizeUpdate(123)).toEqual({});
    expect(sanitizeUpdate([])).toEqual({});
  });

  it("rejects function values (don't pass callables into JSON body)", () => {
    const result = sanitizeUpdate({ name: () => "injected" });
    expect(result.name).toBeUndefined();
  });

  it("preserves XSS payloads as literal strings (DB is not the XSS boundary)", () => {
    // sanitizeUpdate is an auth/column filter, not an HTML sanitizer.
    // XSS payloads must be escaped at render time, not here. But we
    // want to confirm they aren't mangled or rejected.
    const xss = "<script>alert(1)</script>";
    const result = sanitizeUpdate({ target_company: xss });
    expect(result.target_company).toBe(xss);
  });

  it("ALLOWED_COLUMNS never drifts silently — assertion pins the set", () => {
    // If you add or remove a column from update-profile.ts you MUST update
    // this test. The set is load-bearing for security; a silent add of
    // e.g. "session_credits" would let clients grant themselves credits.
    expect(Array.from(ALLOWED_COLUMNS).sort()).toEqual([
      "cancel_at_period_end",
      "city",
      "experience_level",
      "feedback_style",
      "has_completed_onboarding",
      "industry",
      "interview_date",
      "interview_focus",
      "interview_types",
      "is_profile_public",
      "learning_style",
      "name",
      "portfolio_links",
      "practice_timestamps",
      "preferred_session_length",
      "resume_data",
      "resume_file_name",
      "resume_text",
      "resume_version_id",
      "session_length",
      "target_company",
      "target_role",
    ]);
  });

  it("does not forward the id field — server derives from JWT, never from client", () => {
    const result = sanitizeUpdate({ id: "attacker-user-id", name: "Jay" });
    expect("id" in result).toBe(false);
    expect(result.name).toBe("Jay");
  });

  it("validates portfolio_links items through sanitizePortfolioLinks rather than passing the raw array", () => {
    const result = sanitizeUpdate({
      portfolio_links: [
        { title: "My GitHub", url: "https://github.com/jay" },
        { title: "Bad one", url: "javascript:alert(1)" },
      ],
    });
    expect(result.portfolio_links).toEqual([{ title: "My GitHub", url: "https://github.com/jay" }]);
  });
});

/**
 * sanitizePortfolioLinks is the only thing standing between a candidate's
 * raw input and what an employer sees as "proof of work" — it must only
 * ever pass through real, well-formed, candidate-entered links.
 */
describe("sanitizePortfolioLinks", () => {
  it("keeps well-formed http(s) links with a title", () => {
    const result = sanitizePortfolioLinks([
      { title: "Portfolio site", url: "https://jay.dev" },
      { title: "GitHub", url: "http://github.com/jay" },
    ]);
    expect(result).toEqual([
      { title: "Portfolio site", url: "https://jay.dev" },
      { title: "GitHub", url: "http://github.com/jay" },
    ]);
  });

  it("drops items with a non-http(s) url (javascript:, data:, bare strings)", () => {
    const result = sanitizePortfolioLinks([
      { title: "XSS attempt", url: "javascript:alert(1)" },
      { title: "Data URI", url: "data:text/html,<script>1</script>" },
      { title: "No protocol", url: "github.com/jay" },
    ]);
    expect(result).toEqual([]);
  });

  it("drops items with an empty or missing title", () => {
    const result = sanitizePortfolioLinks([
      { title: "", url: "https://jay.dev" },
      { title: "   ", url: "https://jay.dev" },
      { url: "https://jay.dev" },
    ]);
    expect(result).toEqual([]);
  });

  it("caps at 5 links, dropping the rest", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ title: `Link ${i}`, url: `https://example.com/${i}` }));
    const result = sanitizePortfolioLinks(many);
    expect(result).toHaveLength(5);
    expect(result[0].title).toBe("Link 0");
    expect(result[4].title).toBe("Link 4");
  });

  it("trims and caps title/url length", () => {
    const result = sanitizePortfolioLinks([
      { title: `  ${"x".repeat(200)}  `, url: `https://example.com/${"y".repeat(600)}` },
    ]);
    expect(result[0].title.length).toBe(120);
    expect(result[0].url.length).toBe(500);
  });

  it("ignores non-array input and non-object items", () => {
    expect(sanitizePortfolioLinks(null)).toEqual([]);
    expect(sanitizePortfolioLinks(undefined)).toEqual([]);
    expect(sanitizePortfolioLinks("not an array")).toEqual([]);
    expect(sanitizePortfolioLinks([null, "string", 42, { title: "ok", url: "https://a.com" }])).toEqual([
      { title: "ok", url: "https://a.com" },
    ]);
  });
});

/* Single source of truth for resume freshness (PRI-33): every resume_data
 * write is stamped here, server-side, so the ~13 client construction sites
 * of StoredResume don't each have to remember to do it. */
describe("stampResumeParsedAt", () => {
  const NOW = "2026-06-17T10:00:00.000Z";

  it("stamps parsedAt onto a resume_data object write", () => {
    const updates = { resume_data: { _type: "ai", headline: "PM" } };
    const out = stampResumeParsedAt({ ...updates }, NOW);
    expect((out.resume_data as Record<string, unknown>).parsedAt).toBe(NOW);
    // Existing fields are preserved.
    expect((out.resume_data as Record<string, unknown>)._type).toBe("ai");
    expect((out.resume_data as Record<string, unknown>).headline).toBe("PM");
  });

  it("overwrites a stale/client-supplied parsedAt — a write means just-refreshed", () => {
    const out = stampResumeParsedAt({ resume_data: { _type: "fallback", parsedAt: "2020-01-01T00:00:00.000Z" } }, NOW);
    expect((out.resume_data as Record<string, unknown>).parsedAt).toBe(NOW);
  });

  it("is a no-op when the update carries no resume_data", () => {
    const out = stampResumeParsedAt({ name: "Jay" }, NOW);
    expect(out).toEqual({ name: "Jay" });
    expect("resume_data" in out).toBe(false);
  });

  it("does not stamp when resume_data is null (an explicit clear)", () => {
    const out = stampResumeParsedAt({ resume_data: null }, NOW);
    expect(out.resume_data).toBeNull();
  });

  it("does not treat an array as a resume_data object", () => {
    const out = stampResumeParsedAt({ resume_data: [1, 2, 3] }, NOW);
    expect(Array.isArray(out.resume_data)).toBe(true);
    expect((out.resume_data as unknown[]).length).toBe(3);
  });
});
