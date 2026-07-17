/* Family G / B57 — the post-session upgrade nudge headline is score-aware.
 *
 * The nudge fires at the highest-attention moment (the instant the hero
 * score lands). Its original single headline — "You scored N. Want to see
 * if you can beat it?" — is nonsensical at a perfect 100: there is nothing
 * to beat, so the CTA reads as broken and the report contradicts itself
 * (a 100/100 that still asks you to do better). The framing is chosen from
 * the score here so the report never pitches an impossible goal, while the
 * subcopy (the actual Sprint-Pack offer) is unchanged. Pure + unit-tested;
 * the component only renders what this returns. */

export interface UpgradeNudgeCopy {
  headline: string;
  subcopy: string;
}

/* A perfect score can't be "beaten" — flip the framing from improvement to
 * streak/consistency. The threshold is exact 100 on purpose: 99 still has a
 * point to prove, and the beat-it framing is fair there. */
const PERFECT_SCORE = 100;

const SUBCOPY = "Get 5 more sessions for ₹39 — track your improvement across a Sprint Pack.";

export function upgradeNudgeCopy(score: number): UpgradeNudgeCopy {
  const safe = Number.isFinite(score) ? Math.max(0, Math.min(PERFECT_SCORE, Math.round(score))) : 0;
  if (safe >= PERFECT_SCORE) {
    return {
      headline: "You scored a perfect 100. Keep the streak going?",
      subcopy: SUBCOPY,
    };
  }
  return {
    headline: `You scored ${safe}. Want to see if you can beat it?`,
    subcopy: SUBCOPY,
  };
}
