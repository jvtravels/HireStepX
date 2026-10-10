import { describe, it, expect } from "vitest";
import {
  EMPLOYER_DISCOVERY_POLICY_VERSION,
  NOTE_MAX_LENGTH,
  asCandidateResponse,
  asConsentSource,
  asEmployerAction,
  asVisibility,
  buildConsentLogRow,
  consentActionFor,
  countDistinctReporters,
  decideAutoSuspension,
  isReportReason,
  isUuid,
  respondNotificationText,
  sanitizeNote,
  shapeConsentHistory,
} from "../../server-handlers/_candidate-consent-helpers";

describe("input validation", () => {
  it("isUuid", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid("11111111-1111-4111-8111-111111111111' or 1=1")).toBe(false);
  });
  it("asVisibility accepts only masked | off", () => {
    expect(asVisibility("masked")).toBe("masked");
    expect(asVisibility("off")).toBe("off");
    expect(asVisibility("public")).toBeNull();
    expect(asVisibility(null)).toBeNull();
  });
  it("asConsentSource falls back to settings for unknown strings", () => {
    expect(asConsentSource("post_session_prompt")).toBe("post_session_prompt");
    expect(asConsentSource("<script>")).toBe("settings");
    expect(asConsentSource(undefined)).toBe("settings");
  });
  it("asEmployerAction / asCandidateResponse", () => {
    expect(asEmployerAction("block")).toBe("block");
    expect(asEmployerAction("delete")).toBeNull();
    expect(asCandidateResponse("interested")).toBe("interested");
    expect(asCandidateResponse("none")).toBeNull();
  });
  it("isReportReason validates against the allow-list", () => {
    expect(isReportReason("spam")).toBe(true);
    expect(isReportReason("harassment")).toBe(true);
    expect(isReportReason("rude")).toBe(false);
    expect(isReportReason(5)).toBe(false);
  });
});

describe("sanitizeNote", () => {
  it("returns null for empty, whitespace-only and non-string input", () => {
    expect(sanitizeNote("")).toBeNull();
    expect(sanitizeNote("  \n\t ")).toBeNull();
    expect(sanitizeNote(42)).toBeNull();
    expect(sanitizeNote(undefined)).toBeNull();
  });
  it("strips control characters and collapses whitespace", () => {
    expect(sanitizeNote("a\u0000b\u0007  c\n\nd")).toBe("a b c d");
  });
  it("caps length at NOTE_MAX_LENGTH", () => {
    expect(sanitizeNote("x".repeat(2000))!.length).toBe(NOTE_MAX_LENGTH);
  });
  it("honours a custom max and trims after truncating", () => {
    expect(sanitizeNote("hello world", 6)).toBe("hello");
  });
});

describe("buildConsentLogRow", () => {
  const base = { userId: "u1", source: "settings" };
  it("returns null when nothing changed (no log entry for no-ops)", () => {
    expect(buildConsentLogRow({ ...base, current: "masked", next: "masked" })).toBeNull();
    expect(buildConsentLogRow({ ...base, current: "off", next: "off" })).toBeNull();
  });
  it("records a withdrawal with the current policy version", () => {
    expect(buildConsentLogRow({ ...base, current: "masked", next: "off" })).toEqual({
      user_id: "u1",
      purpose: "employer_discovery",
      action: "withdrawn",
      policy_version: EMPLOYER_DISCOVERY_POLICY_VERSION,
      source: "settings",
    });
  });
  it("records a grant when re-enabling and sanitises an unknown source", () => {
    const row = buildConsentLogRow({ userId: "u1", current: "off", next: "masked", source: "weird" });
    expect(row).toMatchObject({ action: "granted", source: "settings" });
    expect(consentActionFor("masked")).toBe("granted");
  });
});

describe("shapeConsentHistory", () => {
  it("camel-cases valid rows and drops malformed ones", () => {
    expect(
      shapeConsentHistory([
        { action: "withdrawn", created_at: "t1", source: "dashboard" },
        { action: "bogus", created_at: "t2" },
        { action: "granted" },
        { action: "granted", created_at: "t3" },
      ]),
    ).toEqual([
      { action: "withdrawn", createdAt: "t1", source: "dashboard" },
      { action: "granted", createdAt: "t3", source: "settings" },
    ]);
    expect(shapeConsentHistory(null)).toEqual([]);
  });
});

describe("report count -> suspend decision", () => {
  it("counts DISTINCT reporters, ignoring malformed rows", () => {
    expect(countDistinctReporters([{ reporter_user_id: "a" }, { reporter_user_id: "a" }, { reporter_user_id: "b" }, {}, { reporter_user_id: 5 }])).toBe(2);
    expect(countDistinctReporters(null)).toBe(0);
  });
  it("does not suspend below the threshold", () => {
    expect(decideAutoSuspension(2, false)).toEqual({ suspend: false });
  });
  it("suspends at 3 distinct reporters with a reason that records the count", () => {
    expect(decideAutoSuspension(3, false)).toEqual({ suspend: true, reason: "auto: 3 candidate reports" });
  });
  it("never re-suspends an already-suspended employer", () => {
    expect(decideAutoSuspension(10, true)).toEqual({ suspend: false });
  });
});

describe("respondNotificationText", () => {
  it("uses the masked name and role", () => {
    const t = respondNotificationText("interested", "Candidate #abc123", "SRE");
    expect(t.title).toMatch(/interested/i);
    expect(t.body).toBe("Candidate #abc123 responded as interested for SRE.");
  });
  it("handles declined without a role", () => {
    expect(respondNotificationText("declined", "Candidate #abc123", null).body).toBe("Candidate #abc123 declined contact.");
  });
});
