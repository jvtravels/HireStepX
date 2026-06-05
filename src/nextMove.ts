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
  /** Weakest skill name — null when no skill is below the practice threshold */
  weakestSkillName: string | null;
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
   * UI uses this to render "From your last HR round: <label>" sublabel.
   */
  coachingFocus: CoachingFocus | null;
}

/**
 * Map known HR-round (v4.2/v4.3) gap codes to a coaching CTA. The deep
 * link carries `?focus=hr-round&drill=<key>` so the session-setup
 * page can later route into drill mode (when it ships); today the
 * unrecognised `drill` query param is harmless and the page boots
 * into the standard hr-round flow.
 *
 * Order in this map doesn't drive priority — `topGaps[0]` does (the
 * caller is responsible for severity-sorting). The map is exported
 * so tests can iterate without re-declaring strings.
 */
export const GAP_CTA_MAP: Record<string, { label: string; headline: string; drill: string }> = {
  resume_transcript_mismatch: {
    label: "Reconcile your resume + interview story",
    headline: "Your last HR round named an employer that isn't on your resume — BGV will catch that. Practice the reconciliation.",
    drill: "resume_facts",
  },
  resume_gap_unaddressed: {
    label: "Practice your career-gap one-liner",
    headline: "Your resume has an unaddressed gap. Drill the one-line answer before the real recruiter asks.",
    drill: "career_gap",
  },
  inflated_seniority_claim: {
    label: "Practice owning your seniority story",
    headline: "Your title reads senior but your years don't yet — drill the honest framing before HR cross-checks.",
    drill: "seniority",
  },
  under_titled_candidate: {
    label: "Practice defending your scope at offer time",
    headline: "Your title under-sells your scope — drill the scope-over-title framing so HR doesn't anchor comp low.",
    drill: "under_titled",
  },
  floor_collapse: {
    label: "Drill the floor-and-rationale comp answer",
    headline: "You collapsed to 'whatever you can offer' last time. Drill holding a floor with rationale.",
    drill: "comp_floor",
  },
  user_anchor_leaked_salary: {
    label: "Practice deflecting comp-first questions",
    headline: "You named a salary before HR asked — that costs leverage. Drill the deflection script.",
    drill: "comp_deflect",
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
    : weakestSkillName
      ? `Practice ${weakestSkillName}`
      : currentStreak > 0
        ? "Keep the streak going"
        : "Start a session";
  const ctaHref = matchedGap
    ? `/session/new?focus=hr-round&drill=${encodeURIComponent(matchedGap.cta.drill)}`
    : weakestSkillName
      ? `/session/new?focus=${encodeURIComponent(weakestSkillName)}`
      : "/session/new";

  const headline = matchedGap
    ? matchedGap.cta.headline
    : weakestSkillName
      ? `Your ${weakestSkillName} is the highest-leverage thing to practice today.`
      : currentStreak >= 3
        ? `You're on a ${currentStreak}-day streak — don't break it.`
        : "Pick up where you left off.";

  const coachingFocus: CoachingFocus | null = matchedGap
    ? { gapCode: matchedGap.code, label: matchedGap.cta.label }
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
    headline,
    ctaLabel,
    ctaHref,
    chips,
    nextStreakMilestone,
    coachingFocus,
  };
}
