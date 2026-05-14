import { describe, it, expect } from "vitest";
import {
  SPECIAL_PERSONAL_DATA_FLAGS,
  redactCandidateProfileForLogs,
  extractCandidateProfile,
} from "../../server-handlers/_candidate-profile";
import type { CandidateProfileResult } from "../../server-handlers/_candidate-profile";

/* Build a CandidateProfileResult with every flag forced true so we can
 * verify that exactly the sensitive ones get zeroed. */
function makeAllTrueProfile(): CandidateProfileResult {
  /* Start from an empty extraction (everything off) and flip booleans on. */
  const base = extractCandidateProfile("");
  const r = { ...base } as unknown as Record<string, unknown>;
  for (const k of Object.keys(r)) {
    if (typeof r[k] === "boolean") r[k] = true;
  }
  return r as unknown as CandidateProfileResult;
}

describe("SPECIAL_PERSONAL_DATA_FLAGS — DPDP classification", () => {
  const expected = [
    "pregnancyDisclosed",
    "pipDisclosed",
    "mentalHealthDisclosed",
    "lgbtqDisclosure",
    "casteReservationContext",
    "pwdDisability",
    "chronicIllnessDisclosed",
    "dietaryReligiousNeed",
    "singleParentConstraint",
    "paternityLeaveAsk",
    "menstrualLeavePolicy",
    "agingParentCare",
    "returnshipMaternity",
  ];

  it("lists exactly the 13 DPDP-classified flags", () => {
    expect([...SPECIAL_PERSONAL_DATA_FLAGS].sort()).toEqual(expected.sort());
  });

  it("every listed flag is a boolean field on CandidateProfileResult", () => {
    const p = extractCandidateProfile("");
    for (const k of SPECIAL_PERSONAL_DATA_FLAGS) {
      expect(typeof (p as unknown as Record<string, unknown>)[k as string]).toBe("boolean");
    }
  });
});

describe("redactCandidateProfileForLogs", () => {
  it("zeroes every sensitive flag", () => {
    const all = makeAllTrueProfile();
    const out = redactCandidateProfileForLogs(all);
    for (const k of SPECIAL_PERSONAL_DATA_FLAGS) {
      expect((out as unknown as Record<string, unknown>)[k as string]).toBe(false);
    }
  });

  it("does NOT zero non-sensitive flags (spot-check 5)", () => {
    const all = makeAllTrueProfile();
    const out = redactCandidateProfileForLogs(all);
    const spotCheck = [
      "tenureSignal", // null is set later but transferred via base extraction; spot-check booleans:
    ];
    // Booleans we expect to remain true:
    const nonSensitiveBooleans = [
      "peopleManagementClaimed",
      "earlySwitcher",
      "hotDomainPremium",
      "internshipConversion",
      "rtoPushback",
    ];
    for (const k of nonSensitiveBooleans) {
      expect((out as unknown as Record<string, unknown>)[k]).toBe(true);
    }
    // spotCheck is informational only — verifying tenureSignal exists.
    expect("tenureSignal" in (out as unknown as Record<string, unknown>)).toBe(true);
    expect(spotCheck.length).toBeGreaterThan(0);
  });

  it("is pure — does not mutate the input", () => {
    const all = makeAllTrueProfile();
    const snapshot = JSON.stringify(all);
    redactCandidateProfileForLogs(all);
    expect(JSON.stringify(all)).toBe(snapshot);
  });

  it("preserves non-boolean fields (collegeTier, careerGapMonths, etc.)", () => {
    const base = extractCandidateProfile("") as unknown as Record<string, unknown>;
    base.careerGapMonths = 12;
    base.collegeTier = "tier-1";
    base.tenureSignal = "frequent";
    const out = redactCandidateProfileForLogs(base as unknown as CandidateProfileResult);
    const outRec = out as unknown as Record<string, unknown>;
    expect(outRec.careerGapMonths).toBe(12);
    expect(outRec.collegeTier).toBe("tier-1");
    expect(outRec.tenureSignal).toBe("frequent");
  });
});
