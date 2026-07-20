import { describe, it, expect } from "vitest";
import { pickNextMove, GAP_CTA_MAP } from "../nextMove";

/**
 * Tests for the Dashboard "Your next move" CTA decision tree. Covers the
 * exact logic users see at the top of /dashboard: which skill to practice,
 * which CTA to show, and which context chips render. Prior to this, the
 * whole tree lived in inline JSX and was untested — a threshold-off-by-one
 * (score < 70 vs <= 70) would have silently changed who sees a weakness nudge.
 */

describe("pickNextMove", () => {
  describe("weakest-skill selection", () => {
    it("picks the lowest-scoring skill below 70 as the practice target", () => {
      const out = pickNextMove({
        skills: [
          { name: "Communication", score: 55 },
          { name: "Structure",     score: 65 },
          { name: "Technical",     score: 80 },
        ],
        currentStreak: 0,
      });
      expect(out.weakestSkillName).toBe("Communication");
      expect(out.ctaLabel).toBe("Practice Communication");
      expect(out.ctaHref).toBe("/session/new?focus=Communication");
    });

    it("returns null when every skill is ≥ 70 (user doesn't need weakness nudge)", () => {
      const out = pickNextMove({
        skills: [
          { name: "Communication", score: 80 },
          { name: "Structure",     score: 75 },
        ],
        currentStreak: 0,
      });
      expect(out.weakestSkillName).toBe(null);
    });

    it("70 is NOT a weakness (strict less-than) — regression guard for threshold drift", () => {
      const out = pickNextMove({
        skills: [{ name: "Edge", score: 70 }],
        currentStreak: 0,
      });
      expect(out.weakestSkillName).toBe(null);
    });

    it("69 IS a weakness", () => {
      const out = pickNextMove({
        skills: [{ name: "Edge", score: 69 }],
        currentStreak: 0,
      });
      expect(out.weakestSkillName).toBe("Edge");
    });

    it("humanizes a raw camelCase competency key for all user-facing copy, but keeps the raw key for the focus deep-link", () => {
      // Regression: the salary-negotiation rubric scores arrive as raw
      // camelCase keys (`leverageUse`). They used to leak verbatim into the
      // headline/CTA ("Practice leverageUse"), which reads as broken UI.
      const out = pickNextMove({
        skills: [{ name: "leverageUse", score: 40 }],
        currentStreak: 0,
      });
      // raw key preserved for the deep link + analytics
      expect(out.weakestSkillName).toBe("leverageUse");
      expect(out.ctaHref).toBe("/session/new?focus=leverageUse");
      // humanized everywhere a human reads it
      expect(out.weakestSkillLabel).toBe("Leverage use");
      expect(out.ctaLabel).toBe("Practice Leverage use");
      expect(out.headline).toContain("Leverage use");
      // and the raw token must NOT appear in any user-facing string
      expect(out.ctaLabel).not.toContain("leverageUse");
      expect(out.headline).not.toContain("leverageUse");
    });

    it("empty skills list → no weakness", () => {
      const out = pickNextMove({ skills: [], currentStreak: 0 });
      expect(out.weakestSkillName).toBe(null);
      expect(out.weakestSkillLabel).toBe(null);
    });

    it("URL-encodes skill names with spaces or special chars", () => {
      const out = pickNextMove({
        skills: [{ name: "Problem Solving", score: 50 }],
        currentStreak: 0,
      });
      expect(out.ctaHref).toBe("/session/new?focus=Problem%20Solving");
    });
  });

  describe("CTA fallback when no weakness", () => {
    it("active streak → 'Keep the streak going'", () => {
      const out = pickNextMove({ skills: [], currentStreak: 5 });
      expect(out.ctaLabel).toBe("Keep the streak going");
      expect(out.ctaHref).toBe("/session/new");
    });

    it("no streak, no weakness → 'Start a session'", () => {
      const out = pickNextMove({ skills: [], currentStreak: 0 });
      expect(out.ctaLabel).toBe("Start a session");
    });

    it("weakness wins over streak CTA (weakness is higher-leverage)", () => {
      const out = pickNextMove({
        skills: [{ name: "Communication", score: 40 }],
        currentStreak: 10,
      });
      expect(out.ctaLabel).toBe("Practice Communication");
    });
  });

  describe("streak milestones", () => {
    it("below 7 → next milestone is 7", () => {
      expect(pickNextMove({ skills: [], currentStreak: 3 }).nextStreakMilestone).toBe(7);
    });

    it("7..13 → next milestone is 14", () => {
      expect(pickNextMove({ skills: [], currentStreak: 7 }).nextStreakMilestone).toBe(14);
      expect(pickNextMove({ skills: [], currentStreak: 13 }).nextStreakMilestone).toBe(14);
    });

    it("14..29 → next milestone is 30", () => {
      expect(pickNextMove({ skills: [], currentStreak: 14 }).nextStreakMilestone).toBe(30);
      expect(pickNextMove({ skills: [], currentStreak: 29 }).nextStreakMilestone).toBe(30);
    });

    it("≥30 → no next milestone (user is past top tier)", () => {
      expect(pickNextMove({ skills: [], currentStreak: 30 }).nextStreakMilestone).toBe(null);
      expect(pickNextMove({ skills: [], currentStreak: 100 }).nextStreakMilestone).toBe(null);
    });
  });

  describe("chips", () => {
    it("no streak, no schedule → no chips", () => {
      const out = pickNextMove({ skills: [], currentStreak: 0 });
      expect(out.chips).toEqual([]);
    });

    it("active streak → chip shows day count", () => {
      const out = pickNextMove({ skills: [], currentStreak: 3 });
      const streakChip = out.chips.find(c => c.kind === "streak");
      expect(streakChip?.label).toBe("3-day streak");
    });

    it("streak past all milestones → chip still shows day count", () => {
      const out = pickNextMove({ skills: [], currentStreak: 45 });
      const streakChip = out.chips.find(c => c.kind === "streak");
      expect(streakChip?.label).toBe("45-day streak");
    });

    it("schedule chip renders when smartSchedule is truthy", () => {
      const out = pickNextMove({
        skills: [],
        currentStreak: 0,
        smartSchedule: "You practice best in the morning.",
      });
      expect(out.chips.find(c => c.kind === "schedule")?.label).toBe("You practice best in the morning.");
    });

    it("truncates long schedule labels to fit on one row", () => {
      const long = "This is a very long smart-schedule suggestion that would wrap the card on mobile and ruin the compact look we want";
      const out = pickNextMove({
        skills: [],
        currentStreak: 0,
        smartSchedule: long,
      });
      const chip = out.chips.find(c => c.kind === "schedule")!;
      expect(chip.label.length).toBeLessThanOrEqual(48);
      expect(chip.label.endsWith("…")).toBe(true);
    });

    it("chip order is streak → schedule", () => {
      const out = pickNextMove({
        skills: [],
        currentStreak: 5,
        smartSchedule: "Mornings",
      });
      expect(out.chips.map(c => c.kind)).toEqual(["streak", "schedule"]);
    });
  });

  describe("headline", () => {
    it("weakness → weakness-specific headline", () => {
      const out = pickNextMove({
        skills: [{ name: "Structure", score: 45 }],
        currentStreak: 0,
      });
      expect(out.headline).toContain("Structure");
      expect(out.headline).toContain("highest-leverage");
    });

    it("no weakness, streak ≥ 3 → streak-specific headline", () => {
      const out = pickNextMove({ skills: [], currentStreak: 5 });
      expect(out.headline).toContain("5-day streak");
    });

    it("no weakness, streak < 3 → generic welcome-back for returning users", () => {
      const out = pickNextMove({ skills: [], currentStreak: 1, sessionCount: 1 });
      expect(out.headline).toBe("Pick up where you left off.");
    });

    it("no weakness, streak < 3, first-time user (sessionCount=0) → first-session headline", () => {
      const out = pickNextMove({ skills: [], currentStreak: 0, sessionCount: 0 });
      expect(out.headline).toMatch(/first mock interview/i);
    });
  });

  describe("gap-aware CTA (v4.2/v4.3 HR-round)", () => {
    it("matched gap wins over weakest skill (gap CTAs are more concrete)", () => {
      const out = pickNextMove({
        skills: [{ name: "Communication", score: 30 }],
        currentStreak: 0,
        topGaps: ["under_titled_candidate"],
      });
      expect(out.coachingFocus?.gapCode).toBe("under_titled_candidate");
      expect(out.ctaLabel).toBe("Practice defending your scope at offer time");
      expect(out.ctaHref).toBe("/session/new?focus=hr-round&drill=under_titled");
      // weakest-skill still surfaced for the sublabel/legacy callers
      expect(out.weakestSkillName).toBe("Communication");
    });

    it("highest-severity gap (topGaps[0]) takes priority over later entries", () => {
      const out = pickNextMove({
        skills: [],
        currentStreak: 0,
        topGaps: ["resume_transcript_mismatch", "floor_collapse", "under_titled_candidate"],
      });
      expect(out.coachingFocus?.gapCode).toBe("resume_transcript_mismatch");
    });

    it("unknown gap codes fall through to skill-based CTA (additive map)", () => {
      const out = pickNextMove({
        skills: [{ name: "Structure", score: 40 }],
        currentStreak: 0,
        topGaps: ["some_future_gap_we_dont_handle_yet"],
      });
      expect(out.coachingFocus).toBe(null);
      expect(out.ctaLabel).toBe("Practice Structure");
    });

    it("first unknown then known → walks the list and picks the known one", () => {
      const out = pickNextMove({
        skills: [],
        currentStreak: 0,
        topGaps: ["unknown_a", "unknown_b", "floor_collapse"],
      });
      expect(out.coachingFocus?.gapCode).toBe("floor_collapse");
    });

    it("topGaps absent → behavior identical to skill-only callers (backward compat)", () => {
      const out = pickNextMove({
        skills: [{ name: "Structure", score: 40 }],
        currentStreak: 0,
      });
      expect(out.coachingFocus).toBe(null);
      expect(out.ctaLabel).toBe("Practice Structure");
    });

    it("topGaps empty array → also a no-op", () => {
      const out = pickNextMove({
        skills: [],
        currentStreak: 5,
        topGaps: [],
      });
      expect(out.coachingFocus).toBe(null);
      expect(out.ctaLabel).toBe("Keep the streak going");
    });

    it("every gap in GAP_CTA_MAP produces a non-empty label + headline; drill key must be valid when present", () => {
      // Regression guard: nobody adds a gap to the map without filling all fields.
      // drill is optional — campus-placement entries omit it (they use a custom ctaHref
      // that goes to the setup page, not a micro-drill session).
      for (const [code, cta] of Object.entries(GAP_CTA_MAP)) {
        expect(cta.label, `${code}.label`).toBeTruthy();
        expect(cta.headline, `${code}.headline`).toBeTruthy();
        if (cta.drill !== undefined) {
          expect(cta.drill, `${code}.drill`).toMatch(/^[a-z_]+$/);
        }
      }
    });

    it("all four v4.2/v4.3 resume-cross-check codes are covered", () => {
      expect(GAP_CTA_MAP).toHaveProperty("resume_transcript_mismatch");
      expect(GAP_CTA_MAP).toHaveProperty("resume_gap_unaddressed");
      expect(GAP_CTA_MAP).toHaveProperty("inflated_seniority_claim");
      expect(GAP_CTA_MAP).toHaveProperty("under_titled_candidate");
    });
  });

  describe("campus-placement gap-aware CTA (v6.x analyzer flags)", () => {
    it("cgpa_low_no_framing fires a campus-specific CTA pointing to the campus-placement flow", () => {
      const out = pickNextMove({
        skills: [{ name: "leverageUse", score: 30 }],
        currentStreak: 0,
        topGaps: ["cgpa_low_no_framing"],
      });
      expect(out.coachingFocus?.gapCode).toBe("cgpa_low_no_framing");
      expect(out.ctaHref).toBe("/session/new?focus=campus-placement");
      expect(out.coachingSessionFocus).toBe("campus-placement");
      // generic behavioral skill is still exposed but doesn't win the CTA
      expect(out.weakestSkillName).toBe("leverageUse");
    });

    it("no_academic_project_discussed produces campus CTA and correct label", () => {
      const out = pickNextMove({
        skills: [],
        currentStreak: 0,
        topGaps: ["no_academic_project_discussed"],
      });
      expect(out.coachingFocus?.gapCode).toBe("no_academic_project_discussed");
      expect(out.ctaHref).toBe("/session/new?focus=campus-placement");
      expect(out.ctaLabel).toContain("academic project");
    });

    it("bond_refusal fires campus-placement CTA", () => {
      const out = pickNextMove({
        skills: [],
        currentStreak: 0,
        topGaps: ["bond_refusal"],
      });
      expect(out.coachingFocus?.gapCode).toBe("bond_refusal");
      expect(out.ctaHref).toBe("/session/new?focus=campus-placement");
      expect(out.coachingSessionFocus).toBe("campus-placement");
    });

    it("coachingSessionFocus is 'hr-round' for HR gap codes (backward compat)", () => {
      const out = pickNextMove({
        skills: [],
        currentStreak: 0,
        topGaps: ["resume_transcript_mismatch"],
      });
      expect(out.coachingSessionFocus).toBe("hr-round");
    });

    it("coachingSessionFocus is 'salary-negotiation' for salary gap codes", () => {
      const out = pickNextMove({
        skills: [],
        currentStreak: 0,
        topGaps: ["floor_collapse"],
      });
      expect(out.coachingSessionFocus).toBe("salary-negotiation");
    });

    it("coachingSessionFocus is null when no gap matched", () => {
      const out = pickNextMove({ skills: [], currentStreak: 0 });
      expect(out.coachingSessionFocus).toBe(null);
    });

    it("campus gap takes priority over a behavioral skill weakness", () => {
      const out = pickNextMove({
        skills: [{ name: "Communication", score: 20 }],
        currentStreak: 5,
        topGaps: ["generic_passion_no_substance"],
      });
      expect(out.coachingFocus?.gapCode).toBe("generic_passion_no_substance");
      expect(out.ctaHref).toBe("/session/new?focus=campus-placement");
    });

    it("all six campus-placement gap codes are registered", () => {
      const CAMPUS_CODES = [
        "no_academic_project_discussed",
        "generic_passion_no_substance",
        "cgpa_low_no_framing",
        "no_company_specific_research",
        "bond_refusal",
        "bond_unprepared",
      ];
      for (const code of CAMPUS_CODES) {
        expect(GAP_CTA_MAP, `campus code missing: ${code}`).toHaveProperty(code);
      }
    });
  });
});
