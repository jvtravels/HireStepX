/* ─── Evidence Capabilities ───
 * A fixed set of 4 capabilities a candidate can build verified proof of
 * through practice. "Verified" means 2+ sessions scoring 70+ on the
 * underlying competency, applied consistently across all four rows —
 * a single good run could be a fluke, two can't both be.
 *
 * Pure and dependency-free (no React, no Supabase, no browser APIs) so it
 * can be imported both from the candidate dashboard (src/dashboardData.ts
 * re-exports it) and from an edge-runtime server-handler — one definition
 * of "verified" governs what the candidate sees and what an employer sees,
 * so the two surfaces can never drift apart. Mirrors the pattern already
 * used by save-session.ts importing src/sessionReport/progressTracking. */

export interface EvidenceCapability {
  key: string;
  label: string;
  verified: boolean;
  verifiedDateLabel: string | null;
}

/** Minimal session shape this module needs — a structural subset of
 *  RealSession (src/dashboardData.ts) that a server-handler's own session
 *  row type can satisfy without importing React/Supabase-dependent code. */
export interface EvidenceSessionInput {
  date: string;
  score: number;
  focus: string;
  skill_scores?: Record<string, number> | null;
}

export const EVIDENCE_VERIFY_THRESHOLD = 70;
export const EVIDENCE_VERIFY_MIN_SESSIONS = 2;

function extractScore(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "object" && raw !== null && "score" in raw) return (raw as { score: number }).score;
  return 0;
}

function formatVerifiedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function computeEvidenceCapabilities<T extends EvidenceSessionInput>(sessions: T[]): EvidenceCapability[] {
  const bySkill = (skillKey: string) =>
    sessions
      .filter(s => s.skill_scores && skillKey in s.skill_scores && extractScore(s.skill_scores[skillKey]) >= EVIDENCE_VERIFY_THRESHOLD)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const byFocus = (focus: string) =>
    sessions
      .filter(s => s.focus === focus && s.score >= EVIDENCE_VERIFY_THRESHOLD)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const build = (label: string, key: string, hits: T[]): EvidenceCapability => ({
    key, label,
    verified: hits.length >= EVIDENCE_VERIFY_MIN_SESSIONS,
    verifiedDateLabel: hits.length >= EVIDENCE_VERIFY_MIN_SESSIONS ? formatVerifiedDate(hits[0].date) : null,
  });

  return [
    build("Communication", "communication", bySkill("communication")),
    build("Salary Negotiation", "salary-negotiation", byFocus("salary-negotiation")),
    build("Problem Solving", "problemSolving", bySkill("problemSolving")),
    build("Leadership", "leadership", bySkill("leadership")),
  ];
}
