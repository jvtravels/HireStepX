/* Pure extraction logic for employer-candidate-evidence.ts, unit-tested
 * against the real code rather than an inline copy — mirrors the
 * _employer-candidate-status-helpers.ts pattern.
 *
 * Reuses the RISkill shape persisted at sessions.report_json.skills (see
 * server-handlers/_readiness-core.ts) rather than inventing a new one —
 * only `name` and `score` are surfaced to the employer console, since
 * `weight` is an internal scoring detail with no display meaning here. */

export interface EvidenceSkill {
  name: string;
  score: number;
}

/** Narrows an unknown report_json blob down to its `skills` array, dropping
 *  any entry that doesn't have a real name + finite score rather than
 *  fabricating placeholders for malformed rows. */
export function extractEvidenceSkills(reportJson: unknown): EvidenceSkill[] {
  if (!reportJson || typeof reportJson !== "object") return [];
  const skills = (reportJson as { skills?: unknown }).skills;
  if (!Array.isArray(skills)) return [];
  const out: EvidenceSkill[] = [];
  for (const entry of skills) {
    if (!entry || typeof entry !== "object") continue;
    const name = (entry as { name?: unknown }).name;
    const score = (entry as { score?: unknown }).score;
    if (typeof name !== "string" || !name.trim()) continue;
    if (typeof score !== "number" || !Number.isFinite(score)) continue;
    out.push({ name: name.trim(), score });
  }
  return out;
}

export interface SessionRow {
  user_id: string;
  created_at: string;
  report_json: unknown;
  type?: string;
}

/** Mirrors skillFamily() in src/interviewAPI.ts: salary-negotiation sessions
 *  score a disjoint skill set (anchoring, walk-away discipline, ...) that's
 *  meaningless evidence for a hiring requirement, which is always evaluating
 *  interview-family competence. Excluded here for the same reason that
 *  function keeps the two families from bleeding into each other. */
export function isNegotiationSession(type: string | undefined): boolean {
  return (type || "").toLowerCase().includes("negotiation");
}

/** A session only counts as usable evidence once it's actually been scored —
 *  `report_json` is written by /api/evaluate-session at completion, so a row
 *  with no extractable skills is either still in progress, was abandoned
 *  before evaluation, or genuinely has nothing to show. Distinguishing this
 *  from "negotiation session" lets the picker below skip incomplete rows the
 *  same way it skips off-topic ones. */
function hasEvidence(row: SessionRow): boolean {
  return extractEvidenceSkills(row.report_json).length > 0;
}

/** Picks, per candidate user id, the most-recent session row that's actually
 *  relevant, COMPLETED evidence for a hiring requirement — skipping
 *  salary-negotiation sessions (disjoint skill dimensions) and skipping rows
 *  that never made it to a scored report (abandoned/incomplete), so an
 *  in-progress or abandoned attempt never shadows an older completed session
 *  that has real skill data. Rows are expected pre-sorted newest-first by the
 *  caller's query, but this re-checks created_at defensively rather than
 *  trusting query order. */
export function latestSessionByUser(rows: SessionRow[]): Map<string, SessionRow> {
  const latest = new Map<string, SessionRow>();
  for (const row of rows) {
    if (isNegotiationSession(row.type)) continue;
    if (!hasEvidence(row)) continue;
    const existing = latest.get(row.user_id);
    if (!existing || new Date(row.created_at).getTime() > new Date(existing.created_at).getTime()) {
      latest.set(row.user_id, row);
    }
  }
  return latest;
}
