/**
 * Pure logic for the Dashboard "Your next move" CTA card (DashboardHome.tsx).
 *
 * Given the user's skills + streak + credits, decide:
 *   - Which skill (if any) is the highest-leverage practice target
 *   - Which headline to show
 *   - Which label + URL to use on the primary CTA
 *   - Which context chips to render
 *
 * Extracted from inline JSX so the decision tree has unit tests. Was
 * previously untested; a typo in the threshold (e.g. <70 vs <= 70) means
 * users with exactly-70 skills would get no weakness-specific nudge.
 */

import { skillLabel } from "./skillCopy";

export interface SkillLike {
  name: string;
  score: number;
}

export interface NextMoveInput {
  skills: SkillLike[];
  currentStreak: number;
  smartSchedule?: string | null;
  /**
   * Gap flag codes from the user's most recent session_insights row,
   * highest-severity first (e.g. "resume_transcript_mismatch",
   * "floor_collapse"). When the first entry matches GAP_CTA_MAP, the
   * card surfaces a gap-specific CTA instead of the generic
   * weakest-skill one — gap CTAs are far more actionable.
   *
   * Optional: when absent or empty, behavior is identical to the
   * skill-only fallback.
   */
  topGaps?: string[];
}

export interface NextMoveChip {
  kind: "streak" | "schedule";
  label: string;
}

export interface CoachingFocus {
  /** The matched gap code (e.g. "resume_transcript_mismatch"). */
  gapCode: string;
  /** Short human-readable label for the gap, used in the subtitle chip. */
  label: string;
}

export interface NextMove {
  /**
   * Weakest skill key — null when no skill is below the practice threshold.
   * This is the RAW competency key (e.g. `leverageUse`) preserved for
   * deep-link `?focus=` params and analytics. For anything user-facing,
   * use `weakestSkillLabel` instead — the raw key reads as broken UI.
   */
  weakestSkillName: string | null;
  /**
   * Humanized, sentence-embeddable label for the weakest skill
   * (`leverageUse` → "Leverage use"). null when no weakness fired.
   * Use this in all copy; never render `weakestSkillName` directly.
   */
  weakestSkillLabel: string | null;
  /** Hero copy for the card */
  headline: string;
  /** CTA button text */
  ctaLabel: string;
  /** CTA deep link into the session-setup flow */
  ctaHref: string;
  /** Context chips (rendered only when meaningful) */
  chips: NextMoveChip[];
  /** Milestone the user is still chasing, or null when past 30 days */
  nextStreakMilestone: number | null;
  /**
   * The gap that drove the CTA, when a known gap from topGaps matched.
   * null when no recognised gap fired (falls back to skill-based CTA).
   * UI uses this to render "From your last <sessionType>: <label>" sublabel.
   */
  coachingFocus: CoachingFocus | null;
  /**
   * Which session focus the matched gap came from (e.g. "hr-round",
   * "campus-placement", "salary-negotiation"). null when no gap fired.
   * Dashboard subtitle uses this to say the right session type name.
   */
  coachingSessionFocus: string | null;
}

/**
 * Map known gap codes (HR-round v4.2/v4.3 + campus-placement v6.x) to a
 * coaching CTA. The deep link `ctaHref` defaults to the hr-round drill
 * URL; entries from other focus types override it explicitly.
 *
 * Order in this map doesn't drive priority — `topGaps[0]` does (the
 * caller is responsible for severity-sorting). The map is exported
 * so tests can iterate without re-declaring strings.
 *
 * `sessionFocus` tags which session type the gap came from — used by the
 * dashboard subtitle to say "From your last Campus Placement session:"
 * instead of the hardcoded "HR round".
 */
export const GAP_CTA_MAP: Record<string, {
  label: string;
  headline: string;
  drill: string;
  /** Which session focus this gap belongs to. Drives the subtitle copy. */
  sessionFocus?: string;
  /** Override the CTA href. When absent, defaults to hr-round drill URL. */
  ctaHref?: string;
}> = {
  /* ── HR round (v4.2/v4.3 resume cross-checks) ── */
  resume_transcript_mismatch: {
    label: "Reconcile your resume + interview story",
    headline: "Your last HR round named an employer that isn't on your resume — BGV will catch that. Practice the reconciliation.",
    drill: "resume_facts",
    sessionFocus: "hr-round",
  },
  resume_gap_unaddressed: {
    label: "Practice your career-gap one-liner",
    headline: "Your resume has an unaddressed gap. Drill the one-line answer before the real recruiter asks.",
    drill: "career_gap",
    sessionFocus: "hr-round",
  },
  inflated_seniority_claim: {
    label: "Practice owning your seniority story",
    headline: "Your title reads senior but your years don't yet — drill the honest framing before HR cross-checks.",
    drill: "seniority",
    sessionFocus: "hr-round",
  },
  under_titled_candidate: {
    label: "Practice defending your scope at offer time",
    headline: "Your title under-sells your scope — drill the scope-over-title framing so HR doesn't anchor comp low.",
    drill: "under_titled",
    sessionFocus: "hr-round",
  },
  /* ── Salary negotiation ── */
  floor_collapse: {
    label: "Drill the floor-and-rationale comp answer",
    headline: "You collapsed to 'whatever you can offer' last time. Drill holding a floor with rationale.",
    drill: "comp_floor",
    sessionFocus: "salary-negotiation",
  },
  user_anchor_leaked_salary: {
    label: "Practice deflecting comp-first questions",
    headline: "You named a salary before HR asked — that costs leverage. Drill the deflection script.",
    drill: "comp_deflect",
    sessionFocus: "salary-negotiation",
  },
  /* ── Campus placement (v6.x analyzer flags) ── */
  no_academic_project_discussed: {
    label: "Practice your academic project deep-dive",
    headline: "You didn't discuss any academic projects last session — every campus screener will ask. Drill one project end-to-end.",
    drill: "academic_project",
    sessionFocus: "campus-placement",
    ctaHref: "/interview?type=behavioral&focus=campus-placement",
  },
  generic_passion_no_substance: {
    label: "Substantiate your passion with specifics",
    headline: "Your passion statement had no evidence behind it — recruiters probe for specifics. Drill one concrete proof point.",
    drill: "passion_substance",
    sessionFocus: "campus-placement",
    ctaHref: "/interview?type=behavioral&focus=campus-placement",
  },
  cgpa_low_no_framing: {
    label: "Prepare your CGPA framing story",
    headline: "Your CGPA came up without a framing narrative — a solid one-liner on trajectory turns a liability into a signal. Drill it.",
    drill: "cgpa_framing",
    sessionFocus: "campus-placement",
    ctaHref: "/interview?type=behavioral&focus=campus-placement",
  },
  no_company_specific_research: {
    label: "Research your target company and practice 'why us'",
    headline: "You had no company-specific insight last session — every HR will ask 'why us?' Drill your research and answer.",
    drill: "why_company",
    sessionFocus: "campus-placement",
    ctaHref: "/interview?type=behavioral&focus=campus-placement",
  },
  bond_refusal: {
    label: "Prepare your bond/service agreement response",
    headline: "You refused the bond question outright — that's an instant red flag. Drill the diplomatic 'willing-to-discuss' framing.",
    drill: "bond_handling",
    sessionFocus: "campus-placement",
    ctaHref: "/interview?type=behavioral&focus=campus-placement",
  },
  bond_unprepared: {
    label: "Prepare your stance on the bond/service agreement",
    headline: "Bond agreements are standard at this tier — having no answer reads as uninformed. Drill the confident, positive-intent response.",
    drill: "bond_stance",
    sessionFocus: "campus-placement",
    ctaHref: "/interview?type=behavioral&focus=campus-placement",
  },
};

/** Threshold below which a skill is flagged as the practice target. */
const PRACTICE_THRESHOLD = 70;

/** Cap chip label length for the schedule chip so the card stays single-row on desktop. */
const CHIP_MAX = 48;

export function pickNextMove(input: NextMoveInput): NextMove {
  const { skills, currentStreak, smartSchedule, topGaps } = input;

  // First-priority gap: the highest-severity gap from the user's last
  // insight, IF it's one we have coaching CTA copy for. Unknown gap
  // codes fall through silently — additive map, never blocks.
  const matchedGap = (() => {
    if (!topGaps || topGaps.length === 0) return null;
    for (const code of topGaps) {
      const cta = GAP_CTA_MAP[code];
      if (cta) return { code, cta };
    }
    return null;
  })();

  // Lowest-scoring skill under the threshold is the highest-leverage target.
  // Ties broken by input order (stable sort).
  const weakestSkillName = (() => {
    if (!skills || skills.length === 0) return null;
    const sorted = [...skills].sort((a, b) => a.score - b.score);
    const low = sorted[0];
    return low && low.score < PRACTICE_THRESHOLD ? low.name : null;
  })();

  // Humanized label for all user-facing copy. The raw key stays in
  // `weakestSkillName` for the `?focus=` deep link + analytics.
  const weakestSkillLabel = weakestSkillName ? skillLabel(weakestSkillName) : null;

  // Highest unmet milestone among 7/14/30. null once past 30.
  const nextStreakMilestone =
    currentStreak < 7 ? 7 :
    currentStreak < 14 ? 14 :
    currentStreak < 30 ? 30 :
    null;

  // CTA priority: matched gap > weakest skill > streak > cold start.
  // Gap CTAs win because they're concrete coaching directives, not
  // generic "practice X" nudges.
  const ctaLabel = matchedGap
    ? matchedGap.cta.label
    : weakestSkillLabel
      ? `Practice ${weakestSkillLabel}`
      : currentStreak > 0
        ? "Keep the streak going"
        : "Start a session";
  /* Gap entries may carry their own ctaHref (e.g. campus-placement gaps
   * go to /interview?type=behavioral&focus=campus-placement, not hr-round).
   * HR-round and salary-negotiation gaps fall back to the drill URL. */
  const ctaHref = matchedGap
    ? (matchedGap.cta.ctaHref ?? `/session/new?focus=hr-round&drill=${encodeURIComponent(matchedGap.cta.drill)}`)
    : weakestSkillName
      ? `/session/new?focus=${encodeURIComponent(weakestSkillName)}`
      : "/session/new";

  const headline = matchedGap
    ? matchedGap.cta.headline
    : weakestSkillLabel
      ? `Your ${weakestSkillLabel} is the highest-leverage thing to practice today.`
      : currentStreak >= 3
        ? `You're on a ${currentStreak}-day streak — don't break it.`
        : "Pick up where you left off.";

  const coachingFocus: CoachingFocus | null = matchedGap
    ? { gapCode: matchedGap.code, label: matchedGap.cta.label }
    : null;
  const coachingSessionFocus: string | null = matchedGap
    ? (matchedGap.cta.sessionFocus ?? "hr-round")
    : null;

  const chips: NextMoveChip[] = [];
  if (currentStreak > 0) {
    chips.push({
      kind: "streak",
      label: `${currentStreak}-day streak`,
    });
  }
  if (smartSchedule) {
    const short = smartSchedule.length > CHIP_MAX ? `${smartSchedule.slice(0, CHIP_MAX - 3)}…` : smartSchedule;
    chips.push({ kind: "schedule", label: short });
  }

  return {
    weakestSkillName,
    weakestSkillLabel,
    headline,
    ctaLabel,
    ctaHref,
    chips,
    nextStreakMilestone,
    coachingFocus,
    coachingSessionFocus,
  };
}
