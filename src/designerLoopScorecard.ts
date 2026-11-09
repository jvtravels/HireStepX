/* Design Interview Loop — combined scorecard (Stage 3 of the approved
   CEO brief "Role-Based Interviews: Product Designer Track").
   ─────────────────────────────────────────────────────────────────────
   Once a candidate has finished 2+ of the loop's rounds, pulls their
   per-round overall score and skill-dimension breakdown together into
   one view — reusing each round's existing report, no new scoring run
   or "live" combination system (same precedent as Readiness Index and
   the employer evidence extractor: fold already-computed report data,
   don't recompute it).

   Skill dimensions come from skill_scores (RealSession), already a flat
   { name: score } map derived server-side from each round's own
   scoringRubric (see data/focus-question-recipes.ts) — no new field. */

import type { DesignerLoopRound } from "./designerLoop";
import type { RealSession } from "./dashboardData";

export interface ScorecardSkill {
  name: string;
  score: number;
}

export interface ScorecardRoundEntry {
  slug: string;
  label: string;
  overallScore: number;
  skills: ScorecardSkill[];
}

export interface DesignerLoopScorecard {
  rounds: ScorecardRoundEntry[];
  /** Average of each represented round's overall score, rounded to the
   *  nearest point. null when no completed round has a matching session. */
  averageScore: number | null;
  /** Mirrors the brief's "once 2+ rounds" gate — true once 2 or more
   *  rounds have a usable entry in `rounds`. */
  visible: boolean;
}

interface DashboardSessionLike {
  id: string;
  type: string;
}

/** `loopRounds` is getDesignerLoopProgress's own round list (already
 *  seniority-gated, already knows which are done). `recentSessions` +
 *  `realSessions` are the dashboard's own session arrays, joined by id
 *  since realSessions carries skill_scores and recentSessions carries
 *  the normalized type label the loop rounds key off. When a round has
 *  been played more than once, recentSessions' most-recent-first order
 *  (see getSessionData) means `.find()` picks the latest attempt. */
export function getDesignerLoopScorecard(
  loopRounds: readonly DesignerLoopRound[],
  recentSessions: readonly DashboardSessionLike[],
  realSessions: readonly RealSession[],
): DesignerLoopScorecard {
  const rawById = new Map(realSessions.map((r) => [r.id, r]));
  const rounds: ScorecardRoundEntry[] = [];

  for (const round of loopRounds) {
    if (!round.done) continue;
    const match = recentSessions.find((s) => s.type === round.sessionTypeLabel);
    if (!match) continue;
    const raw = rawById.get(match.id);
    if (!raw) continue;
    const skills: ScorecardSkill[] = raw.skill_scores
      ? Object.entries(raw.skill_scores).map(([name, score]) => ({ name, score }))
      : [];
    rounds.push({ slug: round.slug, label: round.label, overallScore: raw.score, skills });
  }

  const averageScore = rounds.length > 0
    ? Math.round(rounds.reduce((sum, r) => sum + r.overallScore, 0) / rounds.length)
    : null;

  return { rounds, averageScore, visible: rounds.length >= 2 };
}
