/* Design Interview Loop — dashboard grouping (Stage 2 of the approved
   CEO brief "Role-Based Interviews: Product Designer Track").
   ─────────────────────────────────────────────────────────────────────
   Pure progress computation for the "Design Interview Loop" card: which
   of the 6 approved rounds apply to this designer's seniority, and which
   of those are already done. No new "loop" entity in the data model —
   each round stays an ordinary independent session (one credit, same
   engine, same report); this only groups + counts them for display.

   Round availability reuses roleInterviewMatrix's existing seniority
   gating (a fresher/junior designer doesn't get Panel Interview or
   Strategic — same rule every other role already follows), so the loop
   naturally shows 4-6 rounds depending on who's looking at it, never
   a hardcoded 6. */

import type { InterviewFocus } from "./roleInterviewMatrix";

export interface DesignerLoopRound {
  /** URL-safe slug, matches SessionSetup's focusToType values — pass as
   *  /session/new?focus=<slug> to deep-link straight into that round. */
  slug: string;
  /** Display label, per the approved brief's round table (§5). */
  label: string;
  /** DashboardSession.type value (post-normalizeType) that marks this
   *  round done when found among the candidate's completed sessions. */
  sessionTypeLabel: string;
  done: boolean;
}

export interface DesignerLoopProgress {
  rounds: DesignerLoopRound[];
  doneCount: number;
  total: number;
}

const ROUND_DEFS: ReadonlyArray<{ focus: InterviewFocus; slug: string; label: string; sessionTypeLabel: string }> = [
  { focus: "HR Round", slug: "hr-round", label: "HR / Culture Fit", sessionTypeLabel: "HR Round" },
  { focus: "Portfolio Review", slug: "portfolio-review", label: "Portfolio Review", sessionTypeLabel: "Portfolio Review" },
  { focus: "Design Exercise", slug: "design-exercise", label: "Design Exercise", sessionTypeLabel: "Design Exercise" },
  { focus: "Panel Interview", slug: "panel", label: "Cross-functional / Design Critique", sessionTypeLabel: "Panel" },
  { focus: "Strategic", slug: "strategic", label: "Hiring Manager / Strategic", sessionTypeLabel: "Strategic" },
  { focus: "Salary Negotiation", slug: "salary-negotiation", label: "Salary Negotiation", sessionTypeLabel: "Salary Negotiation" },
];

/** `focuses` is the candidate's own role-profile focus list (profileFromRole(role).focuses)
 *  — already seniority-gated. `completedSessionTypes` is their dashboard session history's
 *  `type` field (DashboardSession.type, already normalizeType'd). */
export function getDesignerLoopProgress(
  focuses: readonly InterviewFocus[],
  completedSessionTypes: Iterable<string>,
): DesignerLoopProgress {
  const relevant = new Set(focuses);
  const done = new Set(completedSessionTypes);
  const rounds = ROUND_DEFS
    .filter((r) => relevant.has(r.focus))
    .map((r) => ({ slug: r.slug, label: r.label, sessionTypeLabel: r.sessionTypeLabel, done: done.has(r.sessionTypeLabel) }));
  return { rounds, doneCount: rounds.filter((r) => r.done).length, total: rounds.length };
}
