import { describe, it, expect } from "vitest";
import {
  isCancellationBodyTooLarge,
  parseSubscriptionProfile,
  formatSubscriptionEndDate,
  buildCancellationEmailHtml,
  CANCELLATION_BODY_BYTE_LIMIT,
} from "../../server-handlers/_cancel-subscription-helpers";

/**
 * cancel-subscription is mostly HTTP glue, but the email-formatting and
 * profile-row parsing pieces are user-facing — the email lands in the
 * candidate's inbox, and a wrong/null end date there causes a support
 * ticket. Pure helpers extracted so we can lock both.
 */

describe("isCancellationBodyTooLarge", () => {
  it("permits typical empty cancel body", () => {
    expect(isCancellationBodyTooLarge("0")).toBe(false);
    expect(isCancellationBodyTooLarge(undefined)).toBe(false);
    expect(isCancellationBodyTooLarge(null)).toBe(false);
  });

  it("rejects bodies above 1 MB", () => {
    expect(isCancellationBodyTooLarge(String(CANCELLATION_BODY_BYTE_LIMIT + 1))).toBe(true);
  });

  it("permits bodies at exactly the limit", () => {
    expect(isCancellationBodyTooLarge(String(CANCELLATION_BODY_BYTE_LIMIT))).toBe(false);
  });

  it("treats invalid header as zero (not too large)", () => {
    expect(isCancellationBodyTooLarge("not-a-number")).toBe(false);
  });
});

describe("parseSubscriptionProfile", () => {
  it("returns null when row array is empty", () => {
    expect(parseSubscriptionProfile([])).toBeNull();
  });

  it("returns null when input is not an array", () => {
    expect(parseSubscriptionProfile(null)).toBeNull();
    expect(parseSubscriptionProfile({ id: "x" })).toBeNull();
  });

  it("returns null when first row is null/non-object", () => {
    expect(parseSubscriptionProfile([null])).toBeNull();
    expect(parseSubscriptionProfile(["string-row"])).toBeNull();
  });

  it("returns the first row object when present", () => {
    const row = { email: "a@b.com", subscription_tier: "pro", subscription_end: "2026-06-01" };
    expect(parseSubscriptionProfile([row])).toEqual(row);
  });
});

describe("formatSubscriptionEndDate", () => {
  it("formats a valid ISO date in Indian English", () => {
    // Use a UTC-anchored date so locale offsets don't shift the day.
    const out = formatSubscriptionEndDate("2026-06-15T12:00:00Z");
    expect(out).toMatch(/(June)/);
    expect(out).toMatch(/2026/);
  });

  it("falls back to a humane phrase for null/undefined", () => {
    expect(formatSubscriptionEndDate(null)).toBe("the end of your billing period");
    expect(formatSubscriptionEndDate(undefined)).toBe("the end of your billing period");
    expect(formatSubscriptionEndDate("")).toBe("the end of your billing period");
  });

  it("falls back when the string isn't parseable as a date", () => {
    // "Invalid Date" appearing in a billing email is a support nightmare.
    expect(formatSubscriptionEndDate("nonsense")).toBe("the end of your billing period");
  });
});

describe("buildCancellationEmailHtml", () => {
  const baseParams = {
    userName: "Aarti",
    tier: "pro",
    endDateText: "1 June 2026",
    appUrl: "https://hirestepx.vercel.app",
  };

  it("includes name, tier and end date", () => {
    const html = buildCancellationEmailHtml(baseParams);
    expect(html).toContain("Aarti");
    expect(html).toContain("pro");
    expect(html).toContain("1 June 2026");
  });

  it("HTML-escapes the user name to prevent reflected injection", () => {
    const html = buildCancellationEmailHtml({
      ...baseParams,
      userName: '<script>alert("xss")</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("falls back to 'there' when name is missing", () => {
    const html = buildCancellationEmailHtml({ ...baseParams, userName: null });
    expect(html).toContain("Hi there,");
  });

  it("falls back to 'paid' when tier is missing", () => {
    const html = buildCancellationEmailHtml({ ...baseParams, tier: null });
    expect(html).toContain("paid");
  });

  it("strips trailing slash from appUrl in the reactivate link", () => {
    const html = buildCancellationEmailHtml({ ...baseParams, appUrl: "https://example.com/" });
    expect(html).toContain('href="https://example.com/dashboard/settings"');
  });
});
